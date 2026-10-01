// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 0237ebe, mod/panorama/scripts/bettermap_poi.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

var QolLiteMapPoi = (function () {
    var MAP_NAME = "dl_midtown";

    var SMALL_FACTOR = 0.6;             // small POI = base size * factor (min 1px)
    var UNDERGROUND_Z_MAX = 0;          // world z below this = underground POI
    var LEVEL_POLL_SEC = 0.25;
    var DEFAULT_SPAWN_SEC = 180;        // data without a per-POI `s` (pre-6722 dumps): 3:00

    var _markers = [];                  // { panel, t, small, under, spawn }
    var _underground = false;
    var _inTunnels = false;
    var _inverted = false;              // invert_map at the last placement (team 2's rotated map)
    var _spawnedKey = "";               // which spawn times the clock has passed (change => re-filter)

    function _log(msg) {
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("poi: " + msg); }
    }

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    // Build 6722 has three minimap views on #hud_minimap: surface, `is_underground`
    // (mid tunnels) and `in_tunnels` (the new rat-tunnel layer). z splits surface /
    // underground; small props show only in the rat-tunnel view, and that view
    // shows only them (owner decision 2026-09-30 - the 0.5-scale props are their
    // own spawn group 1 on 6722).
    function _isUnderground() { return QolLiteMapMinimap.hasClassAbove("is_underground"); }
    function _isInTunnels() { return QolLiteMapMinimap.hasClassAbove("in_tunnels"); }

    // Match-clock seconds from the top-bar GameTime label; null before the
    // clock exists (pregame/loading), which we treat as "already spawned".
    function _gameTimeSeconds() {
        var label = _panel("GameTime");
        if (!label || typeof label.text !== "string") { return null; }
        var mm = label.text.replace(/<[^>]+>/g, "").match(/(\d+):(\d{2})/);
        if (!mm) { return null; }
        return (parseInt(mm[1], 10) * 60) + parseInt(mm[2], 10);
    }

    function _applyMarkerStyle(m) {
        var state = QolLiteMapState.get();
        var base = Number(state.poiMarkerSizePx) || 3;
        var px = m.small ? Math.max(1, Math.round(base * SMALL_FACTOR)) : base;
        var opacity = Math.max(0.01, Math.min(1, Number(state.poiOpacity) || 0.8));
        var p = m.panel;
        p.style.width = px + "px";
        p.style.height = px + "px";
        p.style.transform = "translateX(" + (-px / 2) + "px) translateY(" + (-px / 2) + "px)";
        p.style.backgroundColor = QolLiteMapDraw.poiColor(m.t, opacity);
        p.style.zIndex = "10";
    }

    function _visible(m, state, clock) {
        if (state.poiFrom3Min && clock !== null && clock < m.spawn) { return false; }
        if (m.t === "crate" && !state.poiCratesEnabled) { return false; }
        if (m.t === "statue" && !state.poiStatuesEnabled) { return false; }
        if (m.t === "tough" && !state.poiToughEnabled) { return false; }
        // Small props live in the rat tunnels: shown only while that view is up.
        if (m.small && !_inTunnels) { return false; }
        // Always follow the current level (owner, 2026-10-01: no "show all levels" option).
        if (_inTunnels) { return m.small; }
        return m.under === _underground;
    }

    // Comma list of the distinct spawn times already reached; changes only when
    // the clock crosses one (3:00 / 5:00 / 10:00 on 6722), so the poll re-filters
    // at those moments instead of every tick. null clock (pregame) = all spawned.
    function _spawnKey(clock) {
        var seen = {}, out = [];
        for (var i = 0; i < _markers.length; i++) {
            var s = _markers[i].spawn;
            if (!seen[s] && (clock === null || clock >= s)) { seen[s] = true; out.push(s); }
        }
        return out.sort(function (a, b) { return a - b; }).join(",");
    }

    function _applyVisibility() {
        var state = QolLiteMapState.get();
        var clock = _gameTimeSeconds();
        for (var i = 0; i < _markers.length; i++) {
            _markers[i].panel.style.visibility = _visible(_markers[i], state, clock) ? "visible" : "collapse";
        }
    }

    // Data u/v are world-oriented; team 2's rotated minimap is drawn mirrored.
    function _placeMarker(m) {
        var at = QolLiteMapMinimap.toScreen(m.u, m.v);
        m.panel.style.x = (at.u * 100).toFixed(4) + "%";
        m.panel.style.y = (at.v * 100).toFixed(4) + "%";
    }

    function _renderMarkers() {
        var host = _panel("minimap_markers");
        if (!host) { _log("#minimap_markers not found, skip render"); return; }
        while (host.GetChildCount() > 0) { host.GetChild(0).DeleteAsync(0); }
        _markers = [];

        var data = (typeof QolLiteMapPoiData !== "undefined") ? QolLiteMapPoiData[MAP_NAME] : null;
        if (!data || !data.pois) { _log("no QolLiteMapPoiData for map " + MAP_NAME); return; }

        for (var i = 0; i < data.pois.length; i++) {
            var p = data.pois[i];
            if (typeof p.u !== "number" || typeof p.v !== "number") { continue; }
            // A type added to the data before the runtime knows it - skip, never throw.
            if (!QolLiteMapDraw.hasPoiType(p.t)) { continue; }
            var marker = $.CreatePanel("Panel", host, "poi_" + i);
            marker.style.horizontalAlign = "left";
            marker.style.verticalAlign = "top";
            // x/y are Panorama's position components and accept % of parent
            // (Valve: citadel_shop_mods_list.css). percentX/percentY are NOT real
            // properties and the current build throws on unknown style names.
            var m = {
                panel: marker, t: p.t, small: !!p.small, under: p.z < UNDERGROUND_Z_MAX,
                spawn: (typeof p.s === "number") ? p.s : DEFAULT_SPAWN_SEC, u: p.u, v: p.v
            };
            _placeMarker(m);
            _applyMarkerStyle(m);
            _markers.push(m);
        }
        _applyVisibility();
    }

    function _applyAllStyles() {
        for (var i = 0; i < _markers.length; i++) { _applyMarkerStyle(_markers[i]); }
    }

    function _pollLevel() {
        var u = _isUnderground();
        var t = _isInTunnels();
        if (u !== _underground || t !== _inTunnels) {
            _underground = u;
            _inTunnels = t;
            _log("level -> " + (t ? "rat tunnels (small only)" : (u ? "underground" : "surface")));
            _applyVisibility();
        }
        var inv = QolLiteMapMinimap.isInverted();
        if (inv !== _inverted) {
            _inverted = inv;
            _log("invert_map -> " + inv + ", re-placing markers");
            for (var i = 0; i < _markers.length; i++) { _placeMarker(_markers[i]); }
        }
        var key = _spawnKey(_gameTimeSeconds());
        if (key !== _spawnedKey) {
            _spawnedKey = key;
            _log("spawnGate -> spawned times [" + key + "]");
            _applyVisibility();
        }
        $.Schedule(LEVEL_POLL_SEC, _pollLevel);
    }

    function init() {
        _underground = _isUnderground();
        _inTunnels = _isInTunnels();
        _inverted = QolLiteMapMinimap.isInverted();
        _renderMarkers();
        _pollLevel();

        if (typeof QolLiteMapLog !== "undefined") {
            var c = 0, cs = 0, s = 0, ss = 0, tg = 0;
            for (var i = 0; i < _markers.length; i++) {
                var m = _markers[i];
                if (m.t === "crate") { m.small ? cs++ : c++; }
                else if (m.t === "statue") { m.small ? ss++ : s++; }
                else if (m.t === "tough") { tg++; }
            }
            QolLiteMapLog.info("poi: " + _markers.length + " markers (crates " + c + "/" + cs +
                " small, statues " + s + "/" + ss + " small, tough " + tg + "), underground=" + _underground);
        }
    }

    // Re-apply everything from QolLiteMapState (QolLiteMapApply.all).
    function refresh() {
        _applyVisibility();
        _applyAllStyles();
    }

    return { init: init, refresh: refresh };
})();
