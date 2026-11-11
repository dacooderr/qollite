// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_tabmap.js
"use strict";

var QolLiteMapTabMap = (function () {
    var _applied = false;

    var PREVIEW_HOLD_SEC = 4;
    var PREVIEW_TICK_SEC = 0.25;
    var _previewUntil = 0;
    var _tickRunning = false;

    function _previewing() { return Date.now() < _previewUntil && QolLiteMapPreview.showing(); }

    function active() {
        if (QolLiteMapView.targeting()) { return false; }
        return (!!QolLiteMapState.get().tabMapEnabled && QolLiteMapView.tabOpen()) || _previewing();
    }

    function refresh() {
        var now = active();
        if (!now && !_applied) { return; }
        if (now !== _applied) { QolLiteMapLog.log("tabmap: " + (now ? "on" : "off")); }
        _applied = now;
        QolLiteMapSize.apply();
        QolLiteMapSize.applyMapOpacity();
    }

    function _tick() {
        if (_previewing()) { $.Schedule(PREVIEW_TICK_SEC, _tick); return; }
        _tickRunning = false;
        _previewUntil = 0;
        refresh();
        QolLiteMapRotate.refresh();
    }

    function preview() {
        if (!QolLiteMapPreview.showing()) { return; }
        _previewUntil = Date.now() + PREVIEW_HOLD_SEC * 1000;
        _applied = true;
        if (!_tickRunning) { _tickRunning = true; $.Schedule(PREVIEW_TICK_SEC, _tick); }
    }

    function init() {
        _applied = active();
        QolLiteMapView.onChange(refresh);
    }

    return { init: init, active: active, refresh: refresh, preview: preview };
})();
