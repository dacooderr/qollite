// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3ad1ca1, mod/panorama/scripts/bettermap_position.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimap position. Moves the whole minimap by setting align + margin on
// #minimap_persp_wrapper - the positioning hook that already mirrors the vanilla
// #minimap_persp anchor (bottom-right). The map always stays anchored there (D18);
// the two offsets move it as a FRACTION of the free travel (rules in qollite_map_draw.js).
// Overlay markers live inside #minimap_container, so they move with the map.
//
// No drag: the cursor is captured during play (the HUD context has no cursor
// API), which is why the old drag module was removed - placement is settings-
// driven only.
var QolLiteMapPosition = (function () {
    var FALLBACK_W = 1920, FALLBACK_H = 1080;   // used until the HUD has laid out (actuallayout* = 0)

    function _ctx() { return $.GetContextPanel(); }
    function _panel(id) { var c = _ctx(); return c ? c.FindChildTraverse(id) : null; }
    function _log(m) { QolLiteMapLog.log("pos: " + m); }

    // The wrapper's margins are relative to its PARENT (#minimap_ui_clamp_container),
    // so that container's laid-out box is the free-travel space. actuallayout* are
    // screen px, while the map size and the margins written below are style px, so
    // divide by the panel's UI scale as Valve does (Dota ui_cavern_crawl_map.js:24).
    // In-game run 1 measured 2560x1440 at uiScale 1.333: 1920x1080 style px.
    function _bounds(wrap) {
        var p = wrap && wrap.GetParent ? wrap.GetParent() : null;
        var w = p && p.actuallayoutwidth ? p.actuallayoutwidth : 0;
        var h = p && p.actuallayoutheight ? p.actuallayoutheight : 0;
        if (w <= 0 || h <= 0) { return { w: FALLBACK_W, h: FALLBACK_H, scale: 1 }; }   // not laid out yet
        var kx = p.actualuiscale_x > 0 ? p.actualuiscale_x : 1;
        var ky = p.actualuiscale_y > 0 ? p.actualuiscale_y : 1;
        return { w: w / kx, h: h / ky, scale: kx };
    }

    function _mapSize() {
        var s = QolLiteMapState.get();
        var px = Number(s.minimapSizePx) || 400;
        return Math.max(s.minimapSizeMinPx, Math.min(s.minimapSizeMaxPx, px));
    }

    function apply() {
        var wrap = _panel("minimap_persp_wrapper");
        if (!wrap) { return; }
        var s = QolLiteMapState.get();
        var b = _bounds(wrap), M = _mapSize();
        var p = QolLiteMapDraw.placement(s, b, M);

        wrap.style.horizontalAlign = "right";
        wrap.style.verticalAlign = "bottom";
        wrap.style.marginLeft = "0px";
        wrap.style.marginTop = "0px";
        wrap.style.marginRight = p.marginH + "px";
        wrap.style.marginBottom = p.marginV + "px";

        // Persist the sanitised fractions (defensive - clamps any out-of-range
        // value back into [-1,1]).
        if (p.fx !== Number(s.minimapOffsetX) || p.fy !== Number(s.minimapOffsetY)) {
            QolLiteMapState.patch({ minimapOffsetX: p.fx, minimapOffsetY: p.fy });
        }
        _log("apply: bounds=" + Math.round(b.w) + "x" + Math.round(b.h) +
            " map=" + M + " uiScale=" + b.scale + " frac=" + p.fx.toFixed(2) + "," + p.fy.toFixed(2) +
            " margin=" + p.marginH + "," + p.marginV);
    }

    function init() {
        apply();
        // Re-apply once the HUD has certainly laid out, so the travel uses real
        // container bounds (actuallayout* can be 0 on the first frame).
        $.Schedule(0.5, apply);
    }

    return { init: init, apply: apply };
})();
