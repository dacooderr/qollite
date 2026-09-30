// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_size.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

var QolLiteMapSize = (function () {
    var FULL_WIDTH_PX = 10000;           // effectively "no cap" - HUD/minimap spans the full monitor
    var ULT_LARGE_PX = 750;             // minimap size while a map ability is aimed (Mirage Traveler)
    // Build 6722 draws the map at a fixed 360px inside the 400px container/compass
    // frame (hud_minimap.css #hud_minimap vs hud.css #minimap_container), so the
    // map itself must be scaled with the container or the slider only grows the frame.
    var MAP_TO_CONTAINER = 360 / 400;
    var MT_POLL_SEC = 0.06;
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
        var state = QolLiteMapState.get();
        var px = _sanitizeSize(state.minimapSizePx);
        _applyContainerSize(px);

        var slider = _panel("minimap_size_slider");
        if (slider) {
            var ctrl = slider.FindChildTraverse("Slider");
            if (ctrl) { ctrl.value = px; }
            var entry = slider.FindChildTraverse("TextEntry");
            if (entry) { entry.text = String(px); }
        }
        // A larger map shrinks how far the position offset can go before the map
        // runs off screen; re-clamp the placement against the new size.
        if (typeof QolLiteMapPosition !== "undefined" && QolLiteMapPosition.apply) { QolLiteMapPosition.apply(); }
    }

    function applyCurrentSize() {
        var state = QolLiteMapState.get();
        _applyContainerSize(_sanitizeSize(state.minimapSizePx));
    }

    // Since build 6722 the only vanilla cap on the minimap's clamp_width container
    // is Valve's own ultrawide option (`.AspectRatio21x9_clampwidth .clamp_width`
    // max-width 1920px). Full-Width HUD lifts it; off hands control back to
    // Valve's CSS (null clears the inline value - Valve idiom, dota play.js).
    function applyClampWidth() {
        var clamp = _panel("minimap_ui_clamp_container");
        if (!clamp) { return; }
        var full = !!QolLiteMapState.get().hudFullWidth;
        clamp.style.maxWidth = full ? (FULL_WIDTH_PX + "px") : null;
    }

    function _bindFullWidthToggle() {
        var t = _panel("minimap_full_width_toggle");
        if (!t) { return; }
        if (typeof t.SetSelected === "function") { t.SetSelected(!!QolLiteMapState.get().hudFullWidth); }
        t.SetPanelEvent("onactivate", function () {
            QolLiteMapState.patch({ hudFullWidth: !QolLiteMapState.get().hudFullWidth });
            if (typeof t.SetSelected === "function") { t.SetSelected(!!QolLiteMapState.get().hudFullWidth); }
            applyClampWidth();
            // the usable width changed -> re-clamp the map's position offsets.
            if (typeof QolLiteMapPosition !== "undefined" && QolLiteMapPosition.apply) { QolLiteMapPosition.apply(); }
        });
    }

    function bindSlider() {
        var slider = _panel("minimap_size_slider");
        if (!slider) { return; }
        var ctrl = slider.FindChildTraverse("Slider");
        if (!ctrl) { return; }

        var state = QolLiteMapState.get();
        ctrl.min = state.minimapSizeMinPx;
        ctrl.max = state.minimapSizeMaxPx;
        ctrl.value = _sanitizeSize(state.minimapSizePx);

        ctrl.SetPanelEvent("onvaluechanged", function () {
            var px = _sanitizeSize(ctrl.value);
            QolLiteMapState.patch({ minimapSizePx: px });
            apply();
        });
    }

    // True while a map-targeted ability is being aimed (engine class
    // `map_targeting` on the minimap). Verify in-game that Mirage's Traveler
    // triggers it.
    function _isMapTargeting() { return QolLiteMapMinimap.hasClassAbove("map_targeting"); }

    function _pollMapTargeting() {
        var on = !!QolLiteMapState.get().ultLargeMapEnabled && _isMapTargeting();
        if (on !== _ultActive) {
            _ultActive = on;
            if (typeof QolLiteMapLog !== "undefined") {
                QolLiteMapLog.log("size: map_targeting -> " + (on ? "enlarge" : "restore"));
            }
            if (on) { _applyContainerSize(ULT_LARGE_PX); } else { applyCurrentSize(); }
        }
        $.Schedule(MT_POLL_SEC, _pollMapTargeting);
    }

    function _bindUltToggle() {
        var t = _panel("minimap_ult_map_toggle");
        if (!t) { return; }
        if (typeof t.SetSelected === "function") { t.SetSelected(!!QolLiteMapState.get().ultLargeMapEnabled); }
        t.SetPanelEvent("onactivate", function () {
            QolLiteMapState.patch({ ultLargeMapEnabled: !QolLiteMapState.get().ultLargeMapEnabled });
            if (typeof t.SetSelected === "function") { t.SetSelected(!!QolLiteMapState.get().ultLargeMapEnabled); }
        });
    }

    function init() {
        bindSlider();
        apply();
        applyClampWidth();
        _bindFullWidthToggle();
        _bindUltToggle();
        _pollMapTargeting();
    }

    return { init: init, apply: apply, applyCurrentSize: applyCurrentSize, applyClampWidth: applyClampWidth };
})();
