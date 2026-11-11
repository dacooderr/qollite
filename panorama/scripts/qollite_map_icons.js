// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_icons.js
"use strict";

var QolLiteMapIcons = (function () {
    var HUD_ID = "hud_minimap";
    var NATIVE_PCT = 100;
    var ZOOM_CLASS = "useZoomedMinimap";
    var ZOOM_POLL_SEC = 0.5;
    var _applied = {};
    var _pollErrLogged = false;

    function _hud() { return QolLiteMapHud.find(HUD_ID); }

    function _pct(e) {
        var v = QolLiteMapSchema.sanitize(e.key, QolLiteMapState.get()[e.key]);
        return v === undefined ? e.def : v;
    }

    function _want(e, zoomed) {
        if (e.icon.zoomAside && zoomed) { return null; }
        var pct = _pct(e);
        var drawn = e.icon.fit ? QolLiteMapSize.drawnPx() : null;
        if (drawn) { pct = QolLiteMapSchema.fitSnap(e.icon.fit, pct * QolLiteMapSchema.LIMITS.mapDrawnNativePx / drawn); }
        if (pct === NATIVE_PCT && !e.icon.always) { return null; }
        return e.icon.cls + pct;
    }

    function apply() {
        var hud = _hud();
        if (!hud || !hud.SetHasClass) { return; }
        var zoomed = QolLiteMapMinimap.hasClassAbove(ZOOM_CLASS);
        var list = QolLiteMapSchema.iconEntries();
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            var want = _want(e, zoomed);
            var had = _applied[e.key] || null;
            if (want === had && (!want || hud.BHasClass(want))) { continue; }
            if (had) { hud.SetHasClass(had, false); }
            if (want) { hud.SetHasClass(want, true); }
            _applied[e.key] = want;
            QolLiteMapLog.log("icons: " + e.key + " -> " + (want || "native"));
        }
    }

    function className(key) {
        var e = QolLiteMapSchema.byKey(key);
        if (!e || !e.icon) { return null; }
        return _want(e, false);
    }

    function _poll() {
        try { apply(); }
        catch (e) {
            if (!_pollErrLogged) { _pollErrLogged = true; QolLiteMapLog.error("icons: apply threw: " + (e && e.message ? e.message : e)); }
        }
        $.Schedule(ZOOM_POLL_SEC, _poll);
    }

    function init() { _poll(); }

    function refresh() { apply(); }

    return { init: init, refresh: refresh, className: className };
})();
