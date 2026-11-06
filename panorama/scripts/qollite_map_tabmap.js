// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_tabmap.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Larger Map on TAB (spec docs/specs/2026-11-04-tab-map.md): while TAB is held, the minimap sits in
// the screen centre at its own size and opacity, above the TAB screen. This module owns only the
// mode; QolLiteMapSize (size, opacity) and QolLiteMapPosition (placement, stacking) ask active() and
// write their own panels (B3, B4).
var QolLiteMapTabMap = (function () {
    var _applied = false;     // the mode the owners last applied

    // A change of a TAB setting in a menu shows the TAB map this long after the last change; the
    // same hold as the live preview (qollite_map_preview.js PREVIEW_HOLD_SEC), which keeps the real
    // minimap on screen that long.
    var PREVIEW_HOLD_SEC = 4;
    var PREVIEW_TICK_SEC = 0.25;   // the preview module's own poll rate: how soon a closed menu ends it
    var _previewUntil = 0;         // Date.now() ms the preview ends at
    var _tickRunning = false;

    // Only while the real minimap is still on screen in a menu: Esc ends the preview at once, not
    // after the hold, so it never covers live play.
    function _previewing() { return Date.now() < _previewUntil && QolLiteMapPreview.showing(); }

    function active() {
        if (QolLiteMapView.targeting()) { return false; }   // remove-traveler spec T7: Valve's layout wins
        return (!!QolLiteMapState.get().tabMapEnabled && QolLiteMapView.tabOpen()) || _previewing();
    }

    // Re-applies through the owners when the mode is on (a value may have changed) or has just
    // changed. While it stays off a setting change has nothing to show: the settings window and
    // TAB are never on screen together.
    function refresh() {
        var now = active();
        if (!now && !_applied) { return; }
        if (now !== _applied) { QolLiteMapLog.log("tabmap: " + (now ? "on" : "off")); }
        _applied = now;
        QolLiteMapSize.apply();            // also re-places via QolLiteMapPosition.apply
        QolLiteMapSize.applyMapOpacity();
    }

    // One tick runs while a preview lasts; once it is over it clears the hold and refreshes once,
    // which returns the map to its normal form.
    function _tick() {
        if (_previewing()) { $.Schedule(PREVIEW_TICK_SEC, _tick); return; }
        _tickRunning = false;
        _previewUntil = 0;
        refresh();
        // The rotating minimap comes back on this tick, not on its slow re-check up to 0.5 s later (final review M3).
        QolLiteMapRotate.refresh();
    }

    // Tab-map spec B9, B10: starts or extends the hold, only while the real minimap is on screen in
    // a menu. It applies nothing itself: QolLiteMapApply follows with the size placement (a TAB Map Size
    // drag once it settles, rotating spec R13) and the opacity, which then see active() true.
    function preview() {
        if (!QolLiteMapPreview.showing()) { return; }
        _previewUntil = Date.now() + PREVIEW_HOLD_SEC * 1000;
        _applied = true;           // the owners are about to apply the TAB form: the last tick must undo it
        if (!_tickRunning) { _tickRunning = true; $.Schedule(PREVIEW_TICK_SEC, _tick); }
    }

    function init() {
        _applied = active();
        QolLiteMapView.onChange(refresh);
    }

    return { init: init, active: active, refresh: refresh, preview: preview };
})();
