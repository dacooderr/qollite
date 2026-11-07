// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_rotate.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Rotating Minimap (spec docs/specs/2026-11-04-rotating-minimap.md, §3 as amended by the probe results §5.1): the
// local player's arrow in the frame's centre pointing up, the map turning and moving under it, zoomed. Owns three
// writes while active - #hud_minimap's position and alignment, #HudMinimapContainer's turn, #minimap_container's
// frame mask - and one bm_rot_<n> class on #hud_minimap that turns the icons back upright (generated rules,
// schema `turn`). QolLiteMapSize asks zoom() for the map size. Off (north up, normal size) while TAB / Alt / a
// map-aimed ability / Valve's zoomed minimap shows the whole map (R6, R7).
var QolLiteMapRotate = (function () {
    // ~every frame up to 100 Hz; a 0-delay loop cannot be driven by the test clock (spec §5.1 amendment).
    // Probe P6: a tick of this kind costs 0.05-0.07 ms.
    var TICK_SEC = 0.01;
    // While wanted but no local marker exists yet (loading, spectating): look again at this rate (R8).
    var RETRY_SEC = 0.5;
    // §5.1 P1: the layer turns by -(h + 90) for the arrow to point up (owner, run 4; QOL Lock's north offset).
    var NORTH_OFFSET_DEG = 90;
    // Team 2: Valve flips the whole map (invert_map), and with the team-1 turn the arrow pointed down and the map
    // moved down (owner, 2026-11-05) - half a turn more.
    var INVERTED_EXTRA_DEG = 180;
    // DEBUG only: one line of loop cost per this interval (owner 2026-11-05: "Не растет ли нагрузка … Сделай проверки").
    var STATS_SEC = 10;
    var MASK = 'url("s2r://panorama/images/minimap/compass_frame_mask_psd.vtex")';   // §5.1 P3
    // Valve's #hud_minimap alignment (hud_minimap.css): written back, an alias cannot be cleared (§5.1 P4).
    var VALVE_MAP_ALIGN = "center";
    var HEADING_RE = /rotate3d\(\s*-?\d+(?:\.\d+)?deg\s*,\s*(-?\d+(?:\.\d+)?)deg/;
    var POSITION_RE = /(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/;
    var _on = false;
    var _ticking = false;
    var _retrying = false;
    var _marker = null;
    var _startMap = null;      // the panels _start wrote to: a HUD rebuild replaces them and the tick re-asserts
    var _startContainer = null;
    var _heading = null;       // the last heading read
    var _turnClass = null;
    var _last = {};            // the last value written per property key, so a tick writes only changes
    var _img = null;           // the local marker's #MainImage, kept while valid (no subtree search per tick)
    var _stats = { since: 0, ticks: 0, ms: 0, writes: 0, swaps: 0 };

    function _panel(id) { return QolLiteMapHud.find(id); }
    function _turn() { return QolLiteMapSchema.byKey("rotateMapEnabled").turn; }

    function _wanted() {
        return !!QolLiteMapState.get().rotateMapEnabled && !QolLiteMapView.anyOpen() && !QolLiteMapView.targeting() &&
            !QolLiteMapTabMap.active() && !QolLiteMapMinimap.hasClassAbove("useZoomedMinimap");
    }

    function active() { return _on; }
    function zoom() { return _on ? Number(QolLiteMapState.get().rotateMapZoomPct) / 100 : 1; }

    function _localMarker(map) {
        if (_marker && _marker.IsValid() && _marker.BHasClass("localplayer")) { return _marker; }
        _marker = null;
        var list = map.FindChildrenWithClassTraverse("localplayer") || [];
        for (var i = 0; i < list.length; i++) { if (list[i].BHasClass("player")) { _marker = list[i]; break; } }
        return _marker;
    }

    function _write(panel, prop, value) {
        var k = panel.id + "." + prop;
        if (_last[k] === value) { return; }
        panel.style[prop] = value;
        _last[k] = value;
        _stats.writes++;
    }

    function _setTurnClass(map, cls) {
        if (_turnClass === cls) { return; }
        if (_turnClass) { map.SetHasClass(_turnClass, false); }
        if (cls) { map.SetHasClass(cls, true); }
        _turnClass = cls;
        _stats.swaps++;
    }

    function _start(map, container) {
        _last = {};
        _turnClass = null;
        _startMap = map;
        _startContainer = container;
        _write(map, "horizontalAlign", "left");
        _write(map, "verticalAlign", "top");
        _write(container, "opacityMask", MASK);
    }

    function _stop() {
        var map = _panel("hud_minimap"), layer = _panel("HudMinimapContainer"), container = _panel("minimap_container");
        if (map) {
            map.style.position = null;
            map.style.horizontalAlign = VALVE_MAP_ALIGN;
            map.style.verticalAlign = VALVE_MAP_ALIGN;
            _setTurnClass(map, null);
        }
        if (layer) { layer.style.preTransformRotate2d = null; }
        if (container) { container.style.opacityMask = null; }
        _last = {};
        _heading = null;
    }

    // One frame: the player at the layer's centre, the layer turned against the heading, icons back upright.
    function _apply(map, layer, marker) {
        if (!_img || !_img.IsValid() || _img.GetParent() !== marker) { _img = marker.FindChildTraverse("MainImage"); }
        var h = _img ? HEADING_RE.exec(String(_img.style.transform || "")) : null;
        var inverted = QolLiteMapMinimap.isInverted();
        if (h) { _heading = Number(h[1]); }
        var p = POSITION_RE.exec(String(marker.style.position || ""));
        var ui = layer.actualuiscale_x > 0 ? layer.actualuiscale_x : 1;
        var lw = layer.actuallayoutwidth / ui, mw = map.actuallayoutwidth / ui;
        if (p && lw > 0 && mw > 0) {
            var cx = Number(p[1]) + 50 * marker.actuallayoutwidth / map.actuallayoutwidth;
            var cy = Number(p[2]) + 50 * marker.actuallayoutheight / map.actuallayoutheight;
            // Team 2: Valve flips the whole map (.invert_map.HudMinimap { transform: scaleY(-1) scaleX(-1) }), so
            // the player is drawn at the mirrored point (owner 2026-11-05: the centre was the opposite point).
            if (inverted) { cx = 100 - cx; cy = 100 - cy; }
            _write(map, "position", Math.round(lw / 2 - mw * cx / 100) + "px " + Math.round(lw / 2 - mw * cy / 100) + "px 0px");
        }
        if (_heading !== null) {
            var off = NORTH_OFFSET_DEG + (inverted ? INVERTED_EXTRA_DEG : 0);
            var up = ((_heading + off) % 360 + 360) % 360;
            _write(layer, "preTransformRotate2d", (-(_heading + off)).toFixed(2) + "deg");
            var t = _turn(), n = Math.round(up / t.stepDeg) % (360 / t.stepDeg);
            _setTurnClass(map, n === 0 ? null : t.cls + n);
        }
    }

    // A throw in the loop (final review M2) ends the mode cleanly - Valve's north-up map, the normal size - and the
    // slow re-check tries again, instead of leaving the map turned with no loop running.
    function _tick() {
        _ticking = false;
        if (!_on) { return; }
        try { _tickBody(); }
        catch (e) {
            if (!_tickErrLogged) { _tickErrLogged = true; QolLiteMapLog.error("rotate: loop threw: " + (e && e.message ? e.message : e)); }
            _ticking = false;
            _on = false;
            try { _stop(); QolLiteMapSize.apply(); }
            catch (e2) { QolLiteMapLog.error("rotate: stop threw: " + (e2 && e2.message ? e2.message : e2)); }
            if (!_retrying) { _retrying = true; $.Schedule(RETRY_SEC, _retry); }
        }
    }

    function _tickBody() {
        var map = _panel("hud_minimap"), layer = _panel("HudMinimapContainer"), container = _panel("minimap_container");
        var marker = map ? _localMarker(map) : null;
        if (!_wanted() || !map || !layer || !container || !marker) { refresh(); return; }
        if (map !== _startMap || container !== _startContainer || !map.IsValid() || !container.IsValid()) { _start(map, container); }
        var t0 = Date.now();
        _apply(map, layer, marker);
        _stats.ms += Date.now() - t0;
        _stats.ticks++;
        _logStats(t0);
        _ticking = true;
        $.Schedule(TICK_SEC, _tick);
    }

    // DEBUG: the loop's own cost - JS time (Date.now has 1 ms steps, so the sum is a rough mean), style writes that
    // changed a value, and icon-class swaps (each restyles the markers; that cost is engine-side, not in the ms).
    function _logStats(now) {
        if (!_stats.since) { _stats.since = now; return; }
        if (now - _stats.since < STATS_SEC * 1000) { return; }
        if (QolLiteMapLog.isDebug()) {
            QolLiteMapLog.log("rotate: " + STATS_SEC + " s - " + _stats.ticks + " ticks, " + _stats.ms + " ms JS, " +
                _stats.writes + " writes, " + _stats.swaps + " icon-class swaps");
        }
        _stats = { since: now, ticks: 0, ms: 0, writes: 0, swaps: 0 };
    }

    var _tickErrLogged = false;  // one error line for a throwing loop, not one per retry

    function _retry() {
        _retrying = false;
        refresh();
    }

    // Starts or stops the mode from the setting, the views and the marker; QolLiteMapSize re-sizes on a change.
    function refresh() {
        var map = _panel("hud_minimap"), container = _panel("minimap_container"), layer = _panel("HudMinimapContainer");
        var want = _wanted();
        var can = want && !!map && !!container && !!layer && !!_localMarker(map);
        if (can && !_on) {
            _on = true;
            _start(map, container);
            _apply(map, layer, _localMarker(map));   // no half-started frame before the first tick
            QolLiteMapLog.log("rotate: on");
            QolLiteMapSize.apply();
        } else if (!can && _on) {
            _on = false;
            _stop();
            QolLiteMapLog.log("rotate: off");
            QolLiteMapSize.apply();
        }
        if (_on && !_ticking) { _ticking = true; $.Schedule(TICK_SEC, _tick); }
        // Any suspension that is not a view change (Valve's zoomed minimap, the TAB-map preview) ends silently:
        // while the setting is on, look again at the slow rate.
        if (!!QolLiteMapState.get().rotateMapEnabled && !_on && !_retrying) { _retrying = true; $.Schedule(RETRY_SEC, _retry); }
    }

    function init() {
        QolLiteMapView.onChange(refresh);
        refresh();
    }

    return { init: init, refresh: refresh, active: active, zoom: zoom };
})();
