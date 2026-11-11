// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_view.js
"use strict";

var QolLiteMapView = (function () {
    var TAB_EVENT = "CitadelScoreboardToggle";
    var ALT_EVENT = "CitadelMinimapToggle";
    var TAB_CLASS = "gScoreboardOpen";
    var ALT_CLASS = "gDetailView";
    var SAFETY_POLL_SEC = 0.5;
    var STALE_OPEN_TICKS = 2;
    var DETAIL_STATE_IDS = [
        "minimap_persp", "context_action_container", "AbilitiesContainer",
        "cast_failed_box", "CheaterVoteBox", "DamageReportGlobalClassListener"
    ];
    var _openByEvent = {};
    var _closedByEvent = {};
    var _staleTicks = 0;
    var _listeners = [];
    var _tab = false;
    var _alt = false;
    var _last = "";

    var TARGET_CLASS = "gMinimapTargeting";
    var TARGET_STATE_CLASS = "map_targeting";
    var TARGET_POLL_SEC = 0.06;
    var _target = false;

    function _panel(id) { return QolLiteMapHud.find(id); }

    function _classShown(cls) {
        var ancestor = _panel("minimap_persp");
        while (ancestor) {
            if (ancestor.BHasClass && ancestor.BHasClass(cls)) { return true; }
            if (!ancestor.GetParent) { break; }
            ancestor = ancestor.GetParent();
        }
        for (var i = 0; i < DETAIL_STATE_IDS.length; i++) {
            var panel = _panel(DETAIL_STATE_IDS[i]);
            if (panel && panel.BHasClass(cls)) { return true; }
        }
        return false;
    }

    function _resolve(event, classShown) {
        if (_openByEvent[event]) { return true; }
        if (_closedByEvent[event]) { return false; }
        return classShown;
    }

    function tabOpen() { return _tab; }
    function altOpen() { return _alt; }
    function anyOpen() { return _tab || _alt; }
    function targeting() { return _target; }
    function onChange(fn) { _listeners.push(fn); }

    function _key() { return (_tab ? "T" : "") + (_alt ? "A" : "") + (_target ? "M" : ""); }

    function _readTarget() {
        var hud = _panel("hud_minimap");
        if (hud && hud.BHasClass && hud.BHasClass(TARGET_STATE_CLASS)) { _target = true; return; }
        var ancestor = _panel("minimap_persp");
        while (ancestor) {
            if (ancestor.BHasClass && ancestor.BHasClass(TARGET_CLASS)) { _target = true; return; }
            if (!ancestor.GetParent) { break; }
            ancestor = ancestor.GetParent();
        }
        _target = false;
    }

    function _notify() {
        var now = _key();
        if (now === _last) { return; }
        _last = now;
        for (var i = 0; i < _listeners.length; i++) {
            try { _listeners[i](); }
            catch (e) { QolLiteMapLog.error("view: listener threw: " + (e && e.message ? e.message : e)); }
        }
    }

    function _onEvent(name) {
        return function (open) {
            QolLiteMapLog.log("view: " + name + "(" + open + ")");
            _openByEvent[name] = !!open;
            _closedByEvent[name] = !open;
            _staleTicks = 0;
            if (name === TAB_EVENT) { _tab = !!open; } else { _alt = !!open; }
            _notify();
        };
    }

    function _refresh() {
        var tabShown = _classShown(TAB_CLASS), altShown = _classShown(ALT_CLASS);
        if (!tabShown) { _closedByEvent[TAB_EVENT] = false; }
        if (!altShown) { _closedByEvent[ALT_EVENT] = false; }
        if (tabShown || altShown) {
            _staleTicks = 0;
        } else if ((_openByEvent[TAB_EVENT] || _openByEvent[ALT_EVENT]) && ++_staleTicks >= STALE_OPEN_TICKS) {
            QolLiteMapLog.log("view: open by event but no view class - close event missed, releasing");
            _openByEvent = {};
            _staleTicks = 0;
        }
        _tab = _resolve(TAB_EVENT, tabShown);
        _alt = _resolve(ALT_EVENT, altShown);
    }

    function _poll() {
        $.Schedule(SAFETY_POLL_SEC, _poll);
        _refresh();
        _notify();
    }

    function _pollTarget() {
        $.Schedule(TARGET_POLL_SEC, _pollTarget);
        _readTarget();
        _notify();
    }

    function init() {
        $.RegisterForUnhandledEvent(TAB_EVENT, _onEvent(TAB_EVENT));
        $.RegisterForUnhandledEvent(ALT_EVENT, _onEvent(ALT_EVENT));
        _refresh();
        _readTarget();
        _last = _key();
        $.Schedule(SAFETY_POLL_SEC, _poll);
        $.Schedule(TARGET_POLL_SEC, _pollTarget);
    }

    return { init: init, tabOpen: tabOpen, altOpen: altOpen, anyOpen: anyOpen, targeting: targeting, onChange: onChange };
})();
