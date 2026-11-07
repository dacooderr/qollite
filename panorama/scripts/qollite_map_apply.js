// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_apply.js
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
    // At most one placement re-apply per this interval while an offset slider is dragged: Valve
    // animates every size change of #minimap_persp and #minimap_container over 0.15 s (hud.css
    // transition-duration, build 6759), so a new one never starts while one is still animating.
    // In-game 2026-10-07 a drag to the maximum sent 14 size changes in one second and the GPU's
    // texture memory went over budget right after (spec 2026-10-07-hud-runtime-entry, Task 0 run 1).
    var PLACE_MIN_SEC = 0.15;
    var _placeCooling = false;
    var _placeSkipped = 0;            // changes that arrived during the cool-down
    // A setting that re-sizes the map (Minimap Size, TAB Map Size, the rotating minimap's zoom) is applied once
    // its value settles, this long after the LAST change, not per drag step. A zoom drag re-sized the map ~6
    // times a second and the GPU lost its device on 2026-11-05 (spec rotating-minimap R12); a Minimap Size drag
    // through the cool-down above still logged "Extremely low memory" the same day (R13).
    var SIZE_SETTLE_SEC = 0.4;
    var _settleTimers = {};           // name -> the scheduled handle of its pending apply

    function all() {
        QolLiteMapSize.applyClampWidth();
        QolLiteMapSize.apply();            // also re-places via QolLiteMapPosition.apply
        QolLiteMapSize.applyMapOpacity();
        QolLiteMapPoi.refresh();
        QolLiteMapMinimal.refresh();
        QolLiteMapIcons.refresh();
        QolLiteMapLocation.refresh();
        // The store loads after every module's init: a Rotating Minimap saved on starts here (owner 2026-11-05:
        // "вращение включено, но на самой миникарте нет"); a HUD rebuild re-asserts it too.
        QolLiteMapRotate.refresh();
        $.Schedule(LAYOUT_SETTLE_SEC, QolLiteMapPosition.apply);
        // QolLiteMapUrn reads state in its own poll.
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

    // `fn` runs once, SIZE_SETTLE_SEC after the last call with this name (R12, R13).
    function _settle(name, fn) {
        if (_settleTimers[name] !== undefined) { $.CancelScheduled(_settleTimers[name]); }
        _settleTimers[name] = $.Schedule(SIZE_SETTLE_SEC, function () { delete _settleTimers[name]; fn(); });
    }

    // A TAB setting shows the TAB map while it is tuned in a menu (tab-map spec B9): preview() first, so
    // active() is true when the size is placed, and the opacity (cheap) follows. Outside a preview the
    // mode applies on the next TAB press.
    // The rotating minimap steps aside for the TAB form before it is placed, so no rotated, zoomed TAB frame and no
    // extra resize show (final review M3).
    function _tabMap() { QolLiteMapTabMap.preview(); QolLiteMapRotate.refresh(); _place(); _mapOpacity(); }
    // TAB Map Size (R13): a change that opens the preview shows the TAB map at once, at the value of that first
    // change; later values apply once the slider settles. While the preview shows, a drag only extends it.
    function _tabMapSize() {
        var opening = !QolLiteMapTabMap.active();
        QolLiteMapTabMap.preview();
        QolLiteMapRotate.refresh();
        if (opening) { _place(); _mapOpacity(); }
        _settle("tabMapSize", _place);
    }
    function _size() { _settle("size", _place); }
    function _mapOpacity() { QolLiteMapSize.applyMapOpacity(); }
    function _fullWidth() {
        QolLiteMapSize.applyClampWidth();
        QolLiteMapSize.apply();
        $.Schedule(LAYOUT_SETTLE_SEC, QolLiteMapPosition.apply);
    }
    // The urn tracker's marker reads its class from QolLiteMapIcons in its own poll.
    function _icons() { QolLiteMapIcons.refresh(); }
    function _minimal() { QolLiteMapMinimal.refresh(); }
    function _location() { QolLiteMapLocation.refresh(); }
    function _poi() { QolLiteMapPoi.refresh(); }
    // Read by its module's own poll (QolLiteMapUrn).
    function _polled() {}
    function _rotate() { QolLiteMapRotate.refresh(); _place(); }
    function _zoom() { _settle("zoom", _rotate); }

    // One settings-window change re-applies only what that key affects. A drag
    // sends dozens of sets, and all() restyles every POI marker on each (run 2:
    // 188 sets in a few seconds). tests/apply.test.js checks that every schema key
    // is listed here, so a new setting cannot silently do nothing.
    var BY_KEY = {
        minimapSizePx: _size, minimapOffsetX: _place, minimapOffsetY: _place,
        mapOpacity: _mapOpacity,
        hudFullWidth: _fullWidth,
        locationLabelScalePct: _location,
        tabMapEnabled: _tabMap, tabMapSizePx: _tabMapSize, tabMapOpacity: _tabMap,
        rotateMapEnabled: _rotate, rotateMapZoomPct: _zoom,
        selfIconScalePct: _icons, allyIconScalePct: _icons, enemyIconScalePct: _icons,
        towerIconScalePct: _icons, shopIconScalePct: _icons, runeIconScalePct: _icons,
        urnIconScalePct: _icons,
        minimalMap: _minimal,
        poiCratesEnabled: _poi, poiStatuesEnabled: _poi, poiToughEnabled: _poi, poiApplesEnabled: _poi,
        poiCrateColor: _poi, poiStatueColor: _poi, poiToughColor: _poi, poiAppleColor: _poi,
        poiFrom3Min: _poi,
        poiMarkerSizePx: _poi, poiOpacity: _poi,
        urnTrackerEnabled: _polled
    };

    // An unlisted key re-applies everything: slower, never wrong.
    function key(k) {
        if (Object.prototype.hasOwnProperty.call(BY_KEY, k)) { BY_KEY[k](); } else { all(); }
    }

    return { all: all, key: key, ROUTED_KEYS: Object.keys(BY_KEY) };
})();
