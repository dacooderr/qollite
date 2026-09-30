// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_preview.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Live minimap preview in the escape menu (spec:
// docs/specs/2026-09-30-minimap-preview.md). While the menu is open Valve hides
// the whole HUD (`.ShowEscapeMenu .HudCore { opacity: 0 }`) - and the hidden
// minimap's layout freezes - so tuning BetterMap from UMM was blind.
//
// For a few seconds after ANY BetterMap setting changes (while the menu is open)
// we show the REAL minimap instead of a mock: the root gets `bm_preview_live`,
// whose CSS (hud.vcss) un-hides .HudCore and clears the menu backdrop, and every
// HudCore panel that is NOT on the path down to #minimap_persp_wrapper is made
// transparent here. So size, position, POI markers, player icon size, urn - every
// change - shows exactly as it will in play. (Earlier mock/twin versions could
// only show size + position; the owner asked for everything.)
var QolLiteMapPreview = (function () {
    var LIVE_CLASS = "bm_preview_live";
    var MENU_CLASS = "ShowEscapeMenu";       // Valve root class while the escape menu is open
    var PATH_LEAF_ID = "minimap_persp_wrapper";
    var PATH_TOP_CLASS = "HudCore";          // stop un-hiding siblings here
    var IDLE_POLL_SEC = 0.25;
    var PREVIEW_HOLD_SEC = 4;                // stay up this long after the last change

    var _sig = null;
    var _shownUntil = 0;                     // Date.now() ms to hide at
    var _live = false;
    var _hidden = [];                        // [{ panel, opacity }] - inline opacity to restore

    function _ctx() { return $.GetContextPanel(); }
    function _panel(id) { var c = _ctx(); return c ? c.FindChildTraverse(id) : null; }
    function _log(m) { if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("preview: " + m); } }

    // Any BetterMap setting counts (size, position, markers, player icons, ...).
    function _signature() { return JSON.stringify(QolLiteMapState.get()); }

    function _menuOpen() {
        var node = _panel(PATH_LEAF_ID);
        while (node) {
            if (node.BHasClass && node.BHasClass(MENU_CLASS)) { return true; }
            node = node.GetParent ? node.GetParent() : null;
        }
        return false;
    }

    // Make every sibling off the wrapper -> HudCore path transparent, remembering
    // its inline opacity so _restore puts back exactly what was there.
    function _hideOffPath() {
        _hidden = [];
        var node = _panel(PATH_LEAF_ID);
        while (node && node.GetParent) {
            var parent = node.GetParent();
            if (!parent) { break; }
            var n = parent.GetChildCount();
            for (var i = 0; i < n; i++) {
                var c = parent.GetChild(i);
                if (!c || c === node || !c.style) { continue; }
                _hidden.push({ panel: c, opacity: c.style.opacity });
                c.style.opacity = "0";
            }
            if (parent.BHasClass && parent.BHasClass(PATH_TOP_CLASS)) { break; }
            node = parent;
        }
    }

    function _restore() {
        for (var i = 0; i < _hidden.length; i++) {
            var h = _hidden[i];
            if (!h.panel || !h.panel.IsValid || !h.panel.IsValid()) { continue; }
            // "" / undefined means there was no inline value: clear ours (Valve idiom: = null).
            h.panel.style.opacity = h.opacity ? h.opacity : null;
        }
        _hidden = [];
    }

    function _setLive(on) {
        if (on === _live) { return; }
        var root = _ctx();
        if (!root) { return; }
        if (on) { _hideOffPath(); }
        root.SetHasClass(LIVE_CLASS, on);
        if (!on) { _restore(); }
        _live = on;
        _log((on ? "live on" : "live off") + " (root " + root.paneltype + ", hid " + _hidden.length + ")");
    }

    function _poll() {
        var sig = _signature();
        var changed = (_sig !== null && sig !== _sig);
        _sig = sig;
        if (!_menuOpen()) {
            _shownUntil = 0;
            _setLive(false);
        } else {
            if (changed) { _shownUntil = Date.now() + PREVIEW_HOLD_SEC * 1000; }
            _setLive(Date.now() < _shownUntil);
        }
        $.Schedule(IDLE_POLL_SEC, _poll);
    }

    function init() {
        if (!_panel(PATH_LEAF_ID)) { QolLiteMapLog.error("preview: #" + PATH_LEAF_ID + " not found - preview off"); return; }
        _sig = _signature();
        _poll();
    }

    return { init: init };
})();
