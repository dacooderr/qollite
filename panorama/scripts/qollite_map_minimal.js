// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_minimal.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimalist minimap: strips the decorative chrome (frame, blur, dark backing,
// old flat background, zipline lanes, neutral/upper overlays) down to just the
// map render + markers. The toggle class is set on BOTH #hud_minimap and
// #minimap_persp because the two sets of layers live in different style scopes:
// the map's own layers are inside the C++ HudMinimap panel (styled by our
// hud_minimap.vcss copy that the panel loads), the frame/blur/backing are our
// wrapper panels in hud.vcss - a class on only one wouldn't reach both.
var QolLiteMapMinimal = (function () {
    var CLASS = "BmMinimalMap";

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    function _apply() {
        var on = !!QolLiteMapState.get().minimalMap;
        var hud = _panel("hud_minimap");
        if (hud && hud.SetHasClass) { hud.SetHasClass(CLASS, on); }
        var persp = _panel("minimap_persp");
        if (persp && persp.SetHasClass) { persp.SetHasClass(CLASS, on); }
        _applyMinimalOpacity(on);
    }

    // QOL Lite local delta (not in upstream BetterMap): "Minimalist Map Opacity".
    // The pre-6711 bundle faded #canvas + .backgroundImage. Build 6711 draws the map as
    // backgroundImage1..3 whose per-level opacity is Valve CSS (surface / underground /
    // rat tunnels), so an inline opacity on them would show every level at once. Their
    // common parent, the minimap anchor #MinimapBackgroundTest, has no CSS opacity, so
    // the fade goes there. Off: null clears the inline value and hands it back to CSS.
    function _minimalOpacity() {
        var v = Number(QolLiteMapState.get().minimalMapOpacity);
        if (isNaN(v)) { v = QolLiteMapState.DEFAULTS.minimalMapOpacity; }
        return Math.max(0, Math.min(1, v));
    }

    function _applyMinimalOpacity(on) {
        var layers = QolLiteMapMinimap.anchor();
        if (layers && layers.style) { layers.style.opacity = on ? String(_minimalOpacity()) : null; }
    }

    function _syncControls() {
        var t = _panel("minimap_minimal_toggle");
        if (t && typeof t.SetSelected === "function") { t.SetSelected(!!QolLiteMapState.get().minimalMap); }
        var row = _panel("minimap_minimal_opacity_slider");   // QOL Lite local delta (not in upstream BetterMap)
        var ctrl = row ? row.FindChildTraverse("Slider") : null;
        if (ctrl) { ctrl.value = _minimalOpacity(); }
    }

    function bindControls() {
        _bindOpacitySlider();
        var t = _panel("minimap_minimal_toggle");
        if (!t) { return; }
        t.SetPanelEvent("onactivate", function () {
            QolLiteMapState.patch({ minimalMap: !QolLiteMapState.get().minimalMap });
            _syncControls();
            _apply();
        });
    }

    // QOL Lite local delta (not in upstream BetterMap): the in-HUD "Minimalist Map Opacity" slider (0..1 percentage widget).
    function _bindOpacitySlider() {
        var row = _panel("minimap_minimal_opacity_slider");
        var ctrl = row ? row.FindChildTraverse("Slider") : null;
        if (!ctrl) { return; }
        ctrl.SetPanelEvent("onvaluechanged", function () {
            QolLiteMapState.patch({ minimalMapOpacity: Math.max(0, Math.min(1, Math.round(ctrl.value * 100) / 100)) });
            _apply();
        });
    }

    function init() {
        bindControls();
        _syncControls();
        _apply();
    }

    // Re-apply from state; used when the value changes outside the in-HUD panel
    // (the UMM adapter pushing a value).
    function refresh() {
        _syncControls();
        _apply();
    }

    return { init: init, refresh: refresh };
})();
