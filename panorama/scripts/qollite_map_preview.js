// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 0237ebe, mod/panorama/scripts/bettermap_preview.js
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
// change - shows exactly as it will in play.
//
// Valve's settings window covers the screen, so BetterMap's own subsection there
// (qollite_map_popup.js) also asks for a LIFT while it is on screen (spec
// docs/specs/2026-10-01-native-settings.md §6.2): the same live preview, plus
// HudCore drawn above PopupManager - its sibling under CitadelHud, which draws
// later and so on top. The off-path panels, invisible but now above the window,
// stop taking clicks meanwhile.
var QolLiteMapPreview = (function () {
    var LIVE_CLASS = "bm_preview_live";
    var MENU_CLASS = "ShowEscapeMenu";       // Valve root class while the escape menu is open
    var PATH_LEAF_ID = "minimap_persp_wrapper";
    var PATH_TOP_CLASS = "HudCore";          // stop un-hiding siblings here
    var IDLE_POLL_SEC = 0.25;
    var PREVIEW_HOLD_SEC = 4;                // stay up this long after the last change
    // The popup beats every 0.25 s (qollite_map_popup.js LIFT_BEAT_SEC); three missed
    // beats drop the lift, so a destroyed popup can never leave the map on top.
    var LIFT_TTL_SEC = 0.75;
    // HudCore and PopupManager are siblings under CitadelHud (hud.vxml:79/:396); only
    // the dashboard gives PopupManager a z-index (dashboard.css:69-73, shipped VPK,
    // read 2026-10-01), so 1 puts HudCore above it.
    var LIFT_Z_INDEX = "1";

    var _sig = null;
    var _shownUntil = 0;                     // Date.now() ms to hide at
    var _liftUntil = 0;                      // Date.now() ms the lift expires at
    var _ready = false;                      // init() found the leaf; lift() is a no-op before
    var _noCoreLogged = false;
    var _undefLogged = false;
    var _live = false;
    var _lifted = false;
    var _hidden = [];                        // [{ panel, opacity, hittest, hittestchildren }]
    var _core = null;                        // HudCore while lifted
    var _coreZ = null;                       // its inline zIndex before the lift

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

    function _hudCore() {
        var node = _panel(PATH_LEAF_ID);
        while (node) {
            if (node.BHasClass && node.BHasClass(PATH_TOP_CLASS)) { return node; }
            node = node.GetParent ? node.GetParent() : null;
        }
        return null;
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

    // Runs only while live (_hidden is filled). It must be switched off before
    // _setLive(false) empties _hidden, or the hit-testing would not come back.
    function _setLift(on) {
        if (on === _lifted) { return; }
        for (var i = 0; i < _hidden.length; i++) {
            var h = _hidden[i];
            if (!h.panel || !h.panel.IsValid || !h.panel.IsValid()) { continue; }
            if (on) {
                h.hittest = h.panel.hittest;
                h.hittestchildren = h.panel.hittestchildren;
                h.panel.hittest = false;
                h.panel.hittestchildren = false;
            } else if (h.hittest !== undefined) {
                h.panel.hittest = h.hittest;
                h.panel.hittestchildren = h.hittestchildren;
            } else if (!_undefLogged) {
                // Reading these members back is not measured in-game.
                _undefLogged = true;
                QolLiteMapLog.error("preview: hittest read back undefined - not restored");
            }
        }
        if (on) {
            _core = _hudCore();
            if (_core) { _coreZ = _core.style.zIndex; _core.style.zIndex = LIFT_Z_INDEX; }
        } else if (_core) {
            if (_core.IsValid()) { _core.style.zIndex = _coreZ ? _coreZ : null; }
            _core = null;
        }
        _lifted = on;
        _log("lift " + (on ? "on" : "off") + " (" + _hidden.length + " off-path panels)");
    }

    function _update() {
        var now = Date.now();
        var sig = _signature();
        var changed = (_sig !== null && sig !== _sig);
        _sig = sig;
        var menu = _menuOpen();
        if (!menu) { _shownUntil = 0; }
        else if (changed) { _shownUntil = now + PREVIEW_HOLD_SEC * 1000; }
        var lift = now < _liftUntil;
        // Fail closed: without the HudCore stop, _hideOffPath would walk up to the
        // root and hide PopupManager itself.
        if (lift && _hudCore() === null) {
            if (!_noCoreLogged) {
                _noCoreLogged = true;
                QolLiteMapLog.error("preview: lift ignored - no HudCore above #" + PATH_LEAF_ID);
            }
            lift = false;
        }
        if (!lift) { _setLift(false); }
        _setLive(lift || (menu && now < _shownUntil));
        if (lift) { _setLift(true); }
    }

    function _poll() {
        _update();
        $.Schedule(IDLE_POLL_SEC, _poll);
    }

    function init() {
        if (!_panel(PATH_LEAF_ID)) { QolLiteMapLog.error("preview: #" + PATH_LEAF_ID + " not found - preview off"); return; }
        _sig = _signature();
        _ready = true;
        _poll();
    }

    // Show the live preview as if a setting had just changed. The settings popup's
    // peek uses it: there the change happens in another context, so this module's
    // signature poll would only see it after the value arrives.
    function hold() { _shownUntil = Date.now() + PREVIEW_HOLD_SEC * 1000; }

    // The settings popup's heartbeat while our subsection is on screen (on=true), or
    // its "gone" (on=false). Applied at once, not on the next poll.
    function lift(on) {
        if (!_ready) { return; }
        _liftUntil = on ? Date.now() + LIFT_TTL_SEC * 1000 : 0;
        _update();
    }

    return { init: init, hold: hold, lift: lift };
})();
