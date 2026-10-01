// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 0237ebe, mod/panorama/scripts/bettermap_size.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimap size, Valve's 21:9 clamp (Full-Width HUD), map opacity, the Traveler
// enlargement while a map ability is aimed, and keeping the map at its normal
// size while TAB is held. Values come from QolLiteMapState; the settings UI is
// Valve's settings window (qollite_map_popup.js), not this module.
var QolLiteMapSize = (function () {
    var FULL_WIDTH_PX = 10000;           // effectively "no cap" - HUD/minimap spans the full monitor
    var ULT_LARGE_PX = 750;              // minimap size while a map ability is aimed (Mirage Traveler)
    // Build 6722 draws the map at a fixed 360px inside the 400px container/compass
    // frame (hud_minimap.css #hud_minimap vs hud.css #minimap_container), so the
    // map itself must be scaled with the container or the slider only grows the frame.
    var MAP_TO_CONTAINER = 360 / 400;
    var MT_POLL_SEC = 0.06;
    // Valve rescales the map while the TAB detail view is open, so we re-apply our
    // size every 0.03 s - the rate that kept it steady.
    var DETAIL_POLL_SEC = 0.03;
    var DETAIL_STATE_IDS = [
        "minimap_persp", "minimap_persp_wrapper", "context_action_container", "AbilitiesContainer",
        "cast_failed_box", "CheaterVoteBox", "DamageReportGlobalClassListener"
    ];
    var _ultActive = false;

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    function _applyContainerSize(px) {
        var size = px + "px";
        var persp = _panel("minimap_persp");
        if (persp) { persp.style.width = size; persp.style.height = size; }
        var container = _panel("minimap_container");
        if (container) { container.style.width = size; container.style.height = size; }
        var frame = _panel("minimap_frame");
        if (frame) { frame.style.width = size; frame.style.height = size; }

        // The POI/urn overlay must cover exactly the drawn map. In the zoomed
        // minimap mode Valve sizes #hud_minimap itself (HudMinimapSize5..11) and
        // pans it, so we hand the size back to its CSS there.
        var mapSize = Math.round(px * MAP_TO_CONTAINER) + "px";
        var zoomed = QolLiteMapMinimap.hasClassAbove("useZoomedMinimap");
        var map = _panel("hud_minimap");
        if (map) {
            map.style.width = zoomed ? null : mapSize;
            map.style.height = zoomed ? null : mapSize;
        }
        var overlay = _panel("minimap_overlay_root");
        if (overlay) { overlay.style.width = mapSize; overlay.style.height = mapSize; }
    }

    function _sanitizeSize(value) {
        var state = QolLiteMapState.get();
        var min = state.minimapSizeMinPx;
        var max = state.minimapSizeMaxPx;
        var step = state.minimapSizeStepPx;
        var px = Math.round(Number(value) / step) * step;
        return Math.max(min, Math.min(max, px || state.minimapSizePx));
    }

    function apply() {
        _applyContainerSize(_ultActive ? ULT_LARGE_PX : _sanitizeSize(QolLiteMapState.get().minimapSizePx));
        // A larger map shrinks how far the position offset can go before the map
        // runs off screen; re-clamp the placement against the new size.
        QolLiteMapPosition.apply();
    }

    function applyCurrentSize() {
        _applyContainerSize(_sanitizeSize(QolLiteMapState.get().minimapSizePx));
    }

    // Since build 6722 the only vanilla cap on the minimap's clamp_width container
    // is Valve's own ultrawide option (`.AspectRatio21x9_clampwidth .clamp_width`
    // max-width 1920px). Full-Width HUD lifts it; off hands control back to
    // Valve's CSS (null clears the inline value - Valve idiom, dota play.js).
    function applyClampWidth() {
        var clamp = _panel("minimap_ui_clamp_container");
        if (!clamp) { return; }
        clamp.style.maxWidth = QolLiteMapState.get().hudFullWidth ? (FULL_WIDTH_PX + "px") : null;
    }

    // Opacity of the map image layer only; markers sit in #minimap_overlay_root.
    function applyMapOpacity() {
        var layer = _panel("HudMinimapContainer");
        if (layer) { layer.style.opacity = String(QolLiteMapState.get().mapOpacity); }
    }

    // True while a map-targeted ability is being aimed (engine class
    // `map_targeting` on the minimap).
    function _isMapTargeting() { return QolLiteMapMinimap.hasClassAbove("map_targeting"); }

    function _pollMapTargeting() {
        var on = !!QolLiteMapState.get().ultLargeMapEnabled && _isMapTargeting();
        if (on !== _ultActive) {
            _ultActive = on;
            QolLiteMapLog.log("size: map_targeting -> " + (on ? "enlarge" : "restore"));
            if (on) { _applyContainerSize(ULT_LARGE_PX); } else { applyCurrentSize(); }
        }
        $.Schedule(MT_POLL_SEC, _pollMapTargeting);
    }

    function _isDetailViewVisible() {
        var ancestor = _panel("minimap_persp");
        while (ancestor) {
            if (ancestor.BHasClass && (ancestor.BHasClass("gDetailView") || ancestor.BHasClass("gScoreboardOpen"))) { return true; }
            if (!ancestor.GetParent) { break; }
            ancestor = ancestor.GetParent();
        }
        for (var i = 0; i < DETAIL_STATE_IDS.length; i++) {
            var panel = _panel(DETAIL_STATE_IDS[i]);
            if (panel && (panel.BHasClass("gDetailView") || panel.BHasClass("gScoreboardOpen"))) { return true; }
        }
        var ctx = $.GetContextPanel();
        return !!(ctx && (ctx.BHasClass("gDetailView") || ctx.BHasClass("gScoreboardOpen")));
    }

    function _pollDetailView() {
        if (_isDetailViewVisible()) {
            var persp = _panel("minimap_persp");
            if (persp) {
                persp.SetHasClass("DisableBigMapScaleOnTab", true);
                persp.style.opacity = "1";
            }
            applyCurrentSize();
        }
        $.Schedule(DETAIL_POLL_SEC, _pollDetailView);
    }

    function init() {
        apply();
        applyClampWidth();
        applyMapOpacity();
        _pollMapTargeting();
        _pollDetailView();
    }

    return {
        init: init, apply: apply,
        applyClampWidth: applyClampWidth, applyMapOpacity: applyMapOpacity
    };
})();
