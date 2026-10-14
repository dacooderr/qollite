// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ a9f121a, mod/panorama/scripts/bettermap_apply.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Re-applies features from QolLiteMapState. The single entry point for whatever
// changes settings from outside a feature module - the UMM adapter, the settings
// window (qollite_map_settings_bus.js) and the store after a load - so none of them
// needs the feature list. Every call below is idempotent.
var QolLiteMapApply = (function () {
    // Layout lands a frame or two after a style change (panorama_notes.md: measure
    // again after ~0.35 s), so the clamp width's effect on the travel bounds is
    // only visible then.
    var LAYOUT_SETTLE_SEC = 0.35;
    // At most one size / position re-apply per this interval while a slider is dragged: Valve
    // animates every size change of #minimap_persp and #minimap_container over 0.15 s (hud.css
    // transition-duration, build 6759), so a new size never starts while one is still animating.
    // In-game 2026-10-07 a drag to the maximum sent 14 size changes in one second and the GPU's
    // texture memory went over budget right after (spec 2026-10-07-hud-runtime-entry, Task 0 run 1).
    var PLACE_MIN_SEC = 0.15;
    var _placeCooling = false;
    var _placeSkipped = 0;            // changes that arrived during the cool-down

    function all() {
        QolLiteMapSize.applyClampWidth();
        QolLiteMapSize.apply();            // also re-places via QolLiteMapPosition.apply
        QolLiteMapSize.applyMapOpacity();
        QolLiteMapPoi.refresh();
        QolLiteMapMinimal.refresh();
        QolLiteMapIcons.refresh();
        $.Schedule(LAYOUT_SETTLE_SEC, QolLiteMapPosition.apply);
        // QolLiteMapUrn and the Traveler enlargement read state in their own polls.
    }

    // The first change applies at once; changes during the cool-down are folded into one trailing
    // apply, which reads the latest state.
    function _place() {
        if (_placeCooling) { _placeSkipped++; return; }
        QolLiteMapSize.apply();            // also re-places via QolLiteMapPosition.apply
        _placeCooling = true;
        $.Schedule(PLACE_MIN_SEC, _placeCooled);
    }

    function _placeCooled() {
        _placeCooling = false;
        if (_placeSkipped === 0) { return; }
        QolLiteMapLog.log("apply: placement re-applied once for " + _placeSkipped + " folded change(s)");
        _placeSkipped = 0;
        _place();
    }

    function _mapOpacity() { QolLiteMapSize.applyMapOpacity(); }
    function _fullWidth() {
        QolLiteMapSize.applyClampWidth();
        QolLiteMapSize.apply();
        $.Schedule(LAYOUT_SETTLE_SEC, QolLiteMapPosition.apply);
    }
    // The urn tracker's marker reads its class from QolLiteMapIcons in its own poll.
    function _icons() { QolLiteMapIcons.refresh(); }
    function _minimal() { QolLiteMapMinimal.refresh(); }
    function _poi() { QolLiteMapPoi.refresh(); }
    // Read by their modules' own polls (QolLiteMapSize's map-targeting poll, QolLiteMapUrn).
    function _polled() {}

    // One settings-window change re-applies only what that key affects. A drag
    // sends dozens of sets, and all() restyles every POI marker on each (run 2:
    // 188 sets in a few seconds). tests/apply.test.js checks that every schema key
    // is listed here, so a new setting cannot silently do nothing.
    var BY_KEY = {
        minimapSizePx: _place, minimapOffsetX: _place, minimapOffsetY: _place,
        mapOpacity: _mapOpacity,
        hudFullWidth: _fullWidth,
        selfIconScalePct: _icons, allyIconScalePct: _icons, enemyIconScalePct: _icons,
        towerIconScalePct: _icons, shopIconScalePct: _icons, runeIconScalePct: _icons,
        urnIconScalePct: _icons,
        minimalMap: _minimal,
        poiCratesEnabled: _poi, poiStatuesEnabled: _poi, poiToughEnabled: _poi, poiApplesEnabled: _poi,
        poiCrateColor: _poi, poiStatueColor: _poi, poiToughColor: _poi, poiAppleColor: _poi,
        poiFrom3Min: _poi,
        poiMarkerSizePx: _poi, poiOpacity: _poi,
        ultLargeMapEnabled: _polled, urnTrackerEnabled: _polled
    };

    // An unlisted key re-applies everything: slower, never wrong.
    function key(k) {
        if (Object.prototype.hasOwnProperty.call(BY_KEY, k)) { BY_KEY[k](); } else { all(); }
    }

    return { all: all, key: key, ROUTED_KEYS: Object.keys(BY_KEY) };
})();
