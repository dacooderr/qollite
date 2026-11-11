// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_poi.js
"use strict";

var QolLiteMapPoi = (function () {
    var MAP_NAME = "dl_midtown";

    var SMALL_FACTOR = 0.6;
    var UNDERGROUND_Z_MAX = 0;
    var LEVEL_POLL_SEC = 0.25;
    var DEFAULT_SPAWN_SEC = 180;

    var _markers = [];
    var _host = null;
    var _underground = false;
    var _inTunnels = false;
    var _inverted = false;
    var _spawnedKey = "";

    function _log(msg) {
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("poi: " + msg); }
    }

    function _panel(id) { return QolLiteMapHud.find(id); }

    function _isUnderground() { return QolLiteMapMinimap.hasClassAbove("is_underground"); }
    function _isInTunnels() { return QolLiteMapMinimap.hasClassAbove("in_tunnels"); }

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
        p.style.backgroundColor = QolLiteMapDraw.poiColor(m.t, state[QolLiteMapDraw.colorKey(m.t)], opacity);
        p.style.zIndex = "10";
    }

    function _visible(m, state, clock) {
        if (state.poiFrom3Min && clock !== null && clock < m.spawn) { return false; }
        if (m.t === "crate" && !state.poiCratesEnabled) { return false; }
        if (m.t === "statue" && !state.poiStatuesEnabled) { return false; }
        if (m.t === "tough" && !state.poiToughEnabled) { return false; }
        if (m.t === "apple" && !state.poiApplesEnabled) { return false; }
        if (m.small && !_inTunnels) { return false; }
        if (_inTunnels) { return m.small; }
        return m.under === _underground;
    }

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

    function _placeMarker(m) {
        var at = QolLiteMapMinimap.toScreen(m.u, m.v);
        m.panel.style.x = (at.u * 100).toFixed(4) + "%";
        m.panel.style.y = (at.v * 100).toFixed(4) + "%";
    }

    function _renderMarkers() {
        var host = _panel("minimap_markers");
        _host = host;
        _markers = [];
        if (!host) { _log("#minimap_markers not found, skip render"); return; }
        for (var k = host.GetChildCount() - 1; k >= 0; k--) { host.GetChild(k).DeleteAsync(0); }

        var data = (typeof QolLiteMapPoiData !== "undefined") ? QolLiteMapPoiData[MAP_NAME] : null;
        if (!data || !data.pois) { _log("no QolLiteMapPoiData for map " + MAP_NAME); return; }

        for (var i = 0; i < data.pois.length; i++) {
            var p = data.pois[i];
            if (typeof p.u !== "number" || typeof p.v !== "number") { continue; }
            if (!QolLiteMapDraw.hasPoiType(p.t)) { continue; }
            var marker = $.CreatePanel("Panel", host, "poi_" + i);
            marker.style.horizontalAlign = "left";
            marker.style.verticalAlign = "top";
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
            var c = 0, cs = 0, s = 0, ss = 0, tg = 0, ap = 0;
            for (var i = 0; i < _markers.length; i++) {
                var m = _markers[i];
                if (m.t === "crate") { m.small ? cs++ : c++; }
                else if (m.t === "statue") { m.small ? ss++ : s++; }
                else if (m.t === "tough") { tg++; }
                else if (m.t === "apple") { ap++; }
            }
            QolLiteMapLog.info("poi: " + _markers.length + " markers (crates " + c + "/" + cs +
                " small, statues " + s + "/" + ss + " small, tough " + tg + ", apples " + ap + "), underground=" + _underground);
        }
    }

    function refresh() {
        if (!_host || !_host.IsValid()) { _renderMarkers(); return; }
        _applyVisibility();
        _applyAllStyles();
    }

    return { init: init, refresh: refresh };
})();
