// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_player.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Player icon size on the minimap. The player markers are Valve's C++ snippets
// inside #hud_minimap (`.map_button.player`, local player included), so we can't
// size them per panel reliably - the engine creates/recycles them. Instead one
// class on #hud_minimap selects a pre-transform-scale2d rule in hud_minimap.vcss
// (bm_player_scale_50 .. _200): the same property Valve itself uses to size
// player markers in the zoomed minimap, so it scales around the marker centre.
//
// Valve's zoomed-minimap mode already sets pre-transform-scale2d on players
// (0.3 / 0.2 per zoom level); our class would override that, so it is dropped
// while `useZoomedMinimap` is active and Valve's sizing applies unchanged.
var QolLiteMapPlayer = (function () {
    var CLASS_PREFIX = "bm_player_scale_";
    var NATIVE_PCT = 100;       // identity scale: no class, Valve's own size
    var ZOOM_POLL_SEC = 0.5;    // zoom mode is a game setting - rarely changes mid-match
    var _applied = null;        // class currently on #hud_minimap (or null)

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    function _sanitize(v) {
        var d = QolLiteMapState.DEFAULTS;
        var pct = Math.round(Number(v) / d.playerIconScaleStepPct) * d.playerIconScaleStepPct;
        if (!isFinite(pct) || pct === 0) { pct = d.playerIconScalePct; }
        return Math.max(d.playerIconScaleMinPct, Math.min(d.playerIconScaleMaxPct, pct));
    }

    function apply() {
        var hud = _panel("hud_minimap");
        if (!hud || !hud.SetHasClass) { return; }
        var pct = _sanitize(QolLiteMapState.get().playerIconScalePct);
        var want = (pct === NATIVE_PCT || QolLiteMapMinimap.hasClassAbove("useZoomedMinimap")) ? null : CLASS_PREFIX + pct;
        if (want === _applied) { return; }
        if (_applied) { hud.SetHasClass(_applied, false); }
        if (want) { hud.SetHasClass(want, true); }
        _applied = want;
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("player: icon scale -> " + (want || "native")); }
    }

    function _syncSlider() {
        var slider = _panel("minimap_player_size_slider");
        if (!slider) { return; }
        var ctrl = slider.FindChildTraverse("Slider");
        if (ctrl) { ctrl.value = _sanitize(QolLiteMapState.get().playerIconScalePct); }
    }

    function _bindSlider() {
        var slider = _panel("minimap_player_size_slider");
        if (!slider) { return; }
        var ctrl = slider.FindChildTraverse("Slider");
        if (!ctrl) { return; }
        ctrl.min = QolLiteMapState.DEFAULTS.playerIconScaleMinPct;
        ctrl.max = QolLiteMapState.DEFAULTS.playerIconScaleMaxPct;
        ctrl.SetPanelEvent("onvaluechanged", function () {
            QolLiteMapState.patch({ playerIconScalePct: _sanitize(ctrl.value) });
            apply();
        });
    }

    function _pollZoom() {
        apply();
        $.Schedule(ZOOM_POLL_SEC, _pollZoom);
    }

    function init() {
        _bindSlider();
        _syncSlider();
        _pollZoom();
    }

    // Re-apply from state (the UMM adapter pushing a value).
    function refresh() {
        _syncSlider();
        apply();
    }

    return { init: init, refresh: refresh };
})();
