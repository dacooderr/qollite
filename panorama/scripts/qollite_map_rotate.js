// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_rotate.js
"use strict";

var QolLiteMapRotate = (function () {
    var TICK_SEC = 0.01;
    var RETRY_SEC = 0.5;
    var NORTH_OFFSET_DEG = 90;
    var INVERTED_EXTRA_DEG = 180;
    var STATS_SEC = 10;
    var MASK = 'url("s2r://panorama/images/minimap/compass_frame_mask_psd.vtex")';
    var VALVE_MAP_ALIGN = "center";
    var HEADING_RE = /rotate3d\(\s*-?\d+(?:\.\d+)?deg\s*,\s*(-?\d+(?:\.\d+)?)deg/;
    var POSITION_RE = /(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/;
    var _on = false;
    var _ticking = false;
    var _retrying = false;
    var _marker = null;
    var _startMap = null;
    var _startContainer = null;
    var _heading = null;
    var _turnClass = null;
    var _last = {};
    var _img = null;
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

    function _logStats(now) {
        if (!_stats.since) { _stats.since = now; return; }
        if (now - _stats.since < STATS_SEC * 1000) { return; }
        if (QolLiteMapLog.isDebug()) {
            QolLiteMapLog.log("rotate: " + STATS_SEC + " s - " + _stats.ticks + " ticks, " + _stats.ms + " ms JS, " +
                _stats.writes + " writes, " + _stats.swaps + " icon-class swaps");
        }
        _stats = { since: now, ticks: 0, ms: 0, writes: 0, swaps: 0 };
    }

    var _tickErrLogged = false;

    function _retry() {
        _retrying = false;
        refresh();
    }

    function refresh() {
        var map = _panel("hud_minimap"), container = _panel("minimap_container"), layer = _panel("HudMinimapContainer");
        var want = _wanted();
        var can = want && !!map && !!container && !!layer && !!_localMarker(map);
        if (can && !_on) {
            _on = true;
            _start(map, container);
            _apply(map, layer, _localMarker(map));
            QolLiteMapLog.log("rotate: on");
            QolLiteMapSize.apply();
        } else if (!can && _on) {
            _on = false;
            _stop();
            QolLiteMapLog.log("rotate: off");
            QolLiteMapSize.apply();
        }
        if (_on && !_ticking) { _ticking = true; $.Schedule(TICK_SEC, _tick); }
        if (!!QolLiteMapState.get().rotateMapEnabled && !_on && !_retrying) { _retrying = true; $.Schedule(RETRY_SEC, _retry); }
    }

    function init() {
        QolLiteMapView.onChange(refresh);
        refresh();
    }

    return { init: init, refresh: refresh, active: active, zoom: zoom };
})();
