// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_position.js
"use strict";

var QolLiteMapPosition = (function () {
    var FALLBACK_W = 1920, FALLBACK_H = 1080;
    var Z_ABOVE_TAB = 2147483647;
    var GAME_STATE_EVENT = "CitadelGameStateChanged";
    var LAYOUT_SETTLE_SEC = 0.35;

    function _panel(id) { return QolLiteMapHud.find(id); }
    function _log(m) { QolLiteMapLog.log("pos: " + m); }

    function _bounds(wrap) {
        var p = wrap && wrap.GetParent ? wrap.GetParent() : null;
        var w = p && p.actuallayoutwidth ? p.actuallayoutwidth : 0;
        var h = p && p.actuallayoutheight ? p.actuallayoutheight : 0;
        if (w <= 0 || h <= 0) { return { w: FALLBACK_W, h: FALLBACK_H, scale: 1 }; }
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
        if (QolLiteMapView.targeting()) { _centre(wrap, null); return; }
        if (QolLiteMapTabMap.active()) { _centre(wrap, String(Z_ABOVE_TAB)); return; }
        wrap.style.zIndex = null;
        var s = QolLiteMapState.get();
        var b = _bounds(wrap), M = _mapSize();
        var p = QolLiteMapDraw.placement(s, b, M);

        wrap.style.horizontalAlign = "right";
        wrap.style.verticalAlign = "bottom";
        wrap.style.marginLeft = "0px";
        wrap.style.marginTop = "0px";
        wrap.style.marginRight = p.marginH + "px";
        wrap.style.marginBottom = p.marginV + "px";

        if (p.fx !== Number(s.minimapOffsetX) || p.fy !== Number(s.minimapOffsetY)) {
            QolLiteMapState.patch({ minimapOffsetX: p.fx, minimapOffsetY: p.fy });
        }
        _log("apply: bounds=" + Math.round(b.w) + "x" + Math.round(b.h) +
            " map=" + M + " uiScale=" + b.scale + " frac=" + p.fx.toFixed(2) + "," + p.fy.toFixed(2) +
            " margin=" + p.marginH + "," + p.marginV);
    }

    function _centre(wrap, zIndex) {
        wrap.style.horizontalAlign = "center";
        wrap.style.verticalAlign = "center";
        wrap.style.marginLeft = "0px";
        wrap.style.marginTop = "0px";
        wrap.style.marginRight = "0px";
        wrap.style.marginBottom = "0px";
        wrap.style.zIndex = zIndex;
        _log("apply: " + (zIndex ? "TAB map" : "map targeting") + ", centred");
    }

    function init() {
        apply();
        $.Schedule(0.5, apply);
        try {
            $.RegisterForUnhandledEvent(GAME_STATE_EVENT, function () { $.Schedule(LAYOUT_SETTLE_SEC, apply); });
        } catch (e) { QolLiteMapLog.error("pos: " + GAME_STATE_EVENT + " not registered - placement is set on setting changes only"); }
    }

    return { init: init, apply: apply };
})();
