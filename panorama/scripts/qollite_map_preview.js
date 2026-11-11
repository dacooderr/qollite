// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_preview.js
"use strict";

var QolLiteMapPreview = (function () {
    var MENU_ID = "EscapeMenu";
    var CLEAR = "#00000000";
    var MENU_CLASS = "ShowEscapeMenu";
    var PATH_LEAF_ID = "minimap_persp_wrapper";
    var PATH_TOP_CLASS = "HudCore";
    var IDLE_POLL_SEC = 0.25;
    var PREVIEW_HOLD_SEC = 4;
    var LIFT_TTL_SEC = 0.75;
    var LIFT_Z_INDEX = "1";

    var _sig = null;
    var _shownUntil = 0;
    var _liftUntil = 0;
    var _ready = false;
    var _noCoreLogged = false;
    var _undefLogged = false;
    var _live = false;
    var _lifted = false;
    var _hidden = [];
    var _core = null;
    var _wrap = null;
    var _wrapHitChildren;
    var _coreZ = null;
    var _shown = [];
    var _readBackLogged = false;

    function _panel(id) { return QolLiteMapHud.find(id); }
    function _log(m) { if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("preview: " + m); } }

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
                _logReadBack("off-path #" + c.id, c.style.opacity);
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
            h.panel.style.opacity = h.opacity ? h.opacity : null;
        }
        _hidden = [];
    }

    function _logReadBack(what, value) {
        if (_readBackLogged) { return; }
        _readBackLogged = true;
        _log("style read-back " + what + " = " + JSON.stringify(value));
    }

    function _setInline(panel, prop, value) {
        if (!panel) { return; }
        _shown.push({ panel: panel, prop: prop });
        panel.style[prop] = value;
    }

    function _unsetInline() {
        for (var i = 0; i < _shown.length; i++) {
            if (_shown[i].panel.IsValid()) { _shown[i].panel.style[_shown[i].prop] = null; }
        }
        _shown = [];
    }

    function _setLive(on) {
        if (on === _live) { return; }
        if (on) {
            _hideOffPath();
            _setInline(_hudCore(), "opacity", "1");
            _setInline(_panel(MENU_ID), "backgroundColor", CLEAR);
        } else {
            _unsetInline();
            _restore();
        }
        _live = on;
        _log((on ? "live on" : "live off") + " (hid " + _hidden.length + ")");
    }

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
                _undefLogged = true;
                QolLiteMapLog.error("preview: hittest read back undefined - not restored");
            }
        }
        if (on) {
            _core = _hudCore();
            if (_core) { _coreZ = _core.style.zIndex; _core.style.zIndex = LIFT_Z_INDEX; }
            _wrap = _panel(PATH_LEAF_ID);
            if (_wrap) { _wrapHitChildren = _wrap.hittestchildren; _wrap.hittestchildren = false; }
        } else if (_core) {
            if (_core.IsValid()) { _core.style.zIndex = _coreZ ? _coreZ : null; }
            _core = null;
        }
        if (!on && _wrap) {
            if (_wrap.IsValid()) { _wrap.hittestchildren = _wrapHitChildren !== undefined ? _wrapHitChildren : true; }
            _wrap = null;
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
        if (!_panel(PATH_LEAF_ID)) { _log("#" + PATH_LEAF_ID + " not there yet - the poll picks it up"); }
        _sig = _signature();
        _ready = true;
        _poll();
    }

    function hold() { _shownUntil = Date.now() + PREVIEW_HOLD_SEC * 1000; }

    function lift(on) {
        if (!_ready) { return; }
        _liftUntil = on ? Date.now() + LIFT_TTL_SEC * 1000 : 0;
        _update();
    }

    function showing() { return _menuOpen() || _lifted; }

    return { init: init, hold: hold, lift: lift, showing: showing };
})();
