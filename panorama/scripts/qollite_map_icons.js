// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_icons.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Per-type minimap icon sizes (spec docs/specs/2026-10-01-minimap-icon-sizes.md §5.3).
// The engine's markers are C++ .map_button panels inside #hud_minimap that it creates
// and recycles, so nothing is sized per panel: each icon setting puts one class on
// #hud_minimap, `<cls><pct>`, selecting a pre-transform-scale2d rule that
// pipeline/build_minimap_styles.py generates into hud_minimap.vcss. The rules must
// live in that file: HudMinimap's panels see only the sheets its own layout loads
// (research note §5, probe runs 1-2). C++ sets no inline scale on the markers (run 2).
//
// 100 % puts no class (Valve's own size), except for `always` entries: the local
// player also carries .friend, so without its own class an ally size would reach it.
// Valve sizes players itself in the zoomed minimap (pre-transform-scale2d 0.3 / 0.2),
// so `zoomAside` entries drop their class while useZoomedMinimap is on.
var QolLiteMapIcons = (function () {
    var HUD_ID = "hud_minimap";
    var NATIVE_PCT = 100;
    var ZOOM_CLASS = "useZoomedMinimap";
    var ZOOM_POLL_SEC = 0.5;    // zoom mode is a game setting - rarely changes mid-match
    var _applied = {};          // key -> the class currently on #hud_minimap, or null
    var _pollErrLogged = false; // one error line, not one every ZOOM_POLL_SEC

    function _hud() {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(HUD_ID) : null;
    }

    function _pct(e) {
        var v = QolLiteMapSchema.sanitize(e.key, QolLiteMapState.get()[e.key]);
        return v === undefined ? e.def : v;
    }

    // The class an icon setting wants now, or null for Valve's own size.
    function _want(e, zoomed) {
        if (e.icon.zoomAside && zoomed) { return null; }
        var pct = _pct(e);
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
            // The engine may recreate #hud_minimap (unmeasured): a class we think we set but
            // the panel lacks is set again, so a fresh panel does not stay at Valve's size.
            if (want === had && (!want || hud.BHasClass(want))) { continue; }
            if (had) { hud.SetHasClass(had, false); }
            if (want) { hud.SetHasClass(want, true); }
            _applied[e.key] = want;
            QolLiteMapLog.log("icons: " + e.key + " -> " + (want || "native"));
        }
    }

    // The size class for one of BetterMap's own markers (the urn tracker), or null.
    // Not affected by the zoom: only player entries step aside there.
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

    // Re-apply from state (QolLiteMapApply).
    function refresh() { apply(); }

    return { init: init, refresh: refresh, className: className };
})();
