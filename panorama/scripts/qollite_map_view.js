// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_view.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// TAB (scoreboard), Alt (ability menu / detail view) and Valve's map targeting: state for every module that
// reacts to them (qollite_map_size.js, qollite_map_tabmap.js). Moved out of qollite_map_size.js when a
// second and third module needed it (spec docs/specs/2026-11-04-tab-map.md B7).
var QolLiteMapView = (function () {
    // Probe run 1 (2026-10-04, build 6745, then in our hud.vxml context): each event fires on
    // every open and close with one boolean, true = open (they reached the context of another of
    // Valve's layouts too: entry probe E6, 2026-10-07); the global class (gScoreboardOpen /
    // gDetailView) follows 2-33 ms later. So an event is trusted over the class, both ways; the
    // class only stands in for an event that never came. QOL Lock listens to the same TAB event
    // (ql_app.js).
    var TAB_EVENT = "CitadelScoreboardToggle";
    var ALT_EVENT = "CitadelMinimapToggle";
    var TAB_CLASS = "gScoreboardOpen";
    var ALT_CLASS = "gDetailView";
    // Safety net for a missed event (e.g. a HUD reload while TAB is held): reads the classes.
    // 0.5 s is QOL Lock's idle rate for the same TAB handling
    // (ql_minimap_runtime/manifest.js `_determineOptimalRate`).
    var SAFETY_POLL_SEC = 0.5;
    // A missed close event: open by event, but no view class on this many safety ticks in a row.
    // Two, because the class trails the event by up to 33 ms and a single tick can land inside
    // that gap.
    var STALE_OPEN_TICKS = 2;
    // Valve's GlobalClassListeners for the view classes (hud.xml). Our wrapper is no listener and
    // is not listed (its old hud.vxml copy held one).
    var DETAIL_STATE_IDS = [
        "minimap_persp", "context_action_container", "AbilitiesContainer",
        "cast_failed_box", "CheaterVoteBox", "DamageReportGlobalClassListener"
    ];
    var _openByEvent = {};     // event name -> true while its last event said open
    var _closedByEvent = {};   // event name -> true from a close event until its class is gone
    var _staleTicks = 0;
    var _listeners = [];
    // The state every module reads. Cached because the size hold loop reads it every 30 ms and
    // the class walk costs several HUD searches (QolLiteMapHud.find keeps no miss): it is
    // recomputed only on an event and on each safety poll, so a class that stands in for a
    // missed event is heard at the next poll (<= SAFETY_POLL_SEC).
    var _tab = false;
    var _alt = false;
    var _last = "";            // the state the listeners last heard

    // Remove-traveler spec T6 / T8: Valve centres and enlarges the minimap while a map ability is aimed, by CSS on
    // `.gMinimapTargeting #minimap_persp` (hud.css of 2026-11-04, :1923-1942) - a descendant selector, so the class
    // sits on an ANCESTOR of the persp, not on it (test run 2, 2026-11-05: the persp never carried it). The class
    // logger of that run measured `map_targeting` on #hud_minimap during the aim, so that counts too. No event is
    // known for either, so a class poll at the rate the removed Traveler poll ran since 3.0.
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

    // An event is trusted both ways; the class (already read by the caller) decides only when
    // no event speaks.
    function _resolve(event, classShown) {
        if (_openByEvent[event]) { return true; }
        if (_closedByEvent[event]) { return false; }   // the class still trails the close event
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
            // The event speaks for its own view; the other keeps what it had.
            if (name === TAB_EVENT) { _tab = !!open; } else { _alt = !!open; }
            _notify();
        };
    }

    // Walks each class once and reuses the result for the stale-release check and the state.
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

    // Both polls reschedule first, so one throw cannot end them for the session (final review L4): no event exists
    // for map targeting, and the safety poll is what releases a missed close.
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
