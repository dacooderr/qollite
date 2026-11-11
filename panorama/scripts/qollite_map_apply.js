// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_apply.js
"use strict";

var QolLiteMapApply = (function () {
    var LAYOUT_SETTLE_SEC = 0.35;
    var PLACE_MIN_SEC = 0.15;
    var _placeCooling = false;
    var _placeSkipped = 0;
    var SIZE_SETTLE_SEC = 0.4;
    var _settleTimers = {};

    function all() {
        QolLiteMapSize.applyClampWidth();
        QolLiteMapSize.apply();
        QolLiteMapSize.applyMapOpacity();
        QolLiteMapPoi.refresh();
        QolLiteMapMinimal.refresh();
        QolLiteMapIcons.refresh();
        QolLiteMapLocation.refresh();
        QolLiteMapRotate.refresh();
        $.Schedule(LAYOUT_SETTLE_SEC, QolLiteMapPosition.apply);
    }

    function _place() {
        if (_placeCooling) { _placeSkipped++; return; }
        QolLiteMapSize.apply();
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

    function _settle(name, fn) {
        if (_settleTimers[name] !== undefined) { $.CancelScheduled(_settleTimers[name]); }
        _settleTimers[name] = $.Schedule(SIZE_SETTLE_SEC, function () { delete _settleTimers[name]; fn(); });
    }

    function _tabMap() { QolLiteMapTabMap.preview(); QolLiteMapRotate.refresh(); _place(); _mapOpacity(); }
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
    function _icons() { QolLiteMapIcons.refresh(); }
    function _minimal() { QolLiteMapMinimal.refresh(); }
    function _location() { QolLiteMapLocation.refresh(); }
    function _poi() { QolLiteMapPoi.refresh(); }
    function _polled() {}
    function _rotate() { QolLiteMapRotate.refresh(); _place(); }
    function _zoom() { _settle("zoom", _rotate); }

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

    function key(k) {
        if (Object.prototype.hasOwnProperty.call(BY_KEY, k)) { BY_KEY[k](); } else { all(); }
    }

    return { all: all, key: key, ROUTED_KEYS: Object.keys(BY_KEY) };
})();
