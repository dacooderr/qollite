// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_size.js
"use strict";

var QolLiteMapSize = (function () {
    var FULL_WIDTH_PX = 10000;
    function _limits() { return QolLiteMapSchema.LIMITS; }
    function _mapToContainer() { return _limits().mapDrawnNativePx / _limits().minimapSizeNativePx; }
    var HOLD_REAPPLY_SEC = 0.03;
    var _mapSizeClass = null;
    var _fitClass = null;
    var _drawn = null;
    var _iconsErrLogged = false;
    var ZOOM_POLL_SEC = 0.5;
    var _zoomedSeen = null;
    var _holding = false;

    function _panel(id) { return QolLiteMapHud.find(id); }

    function _setMapSizeClass(map, px) {
        var want = px === null ? null : QolLiteMapSchema.byKey("minimapSizePx").mapScale.cls + px;
        if (_mapSizeClass && _mapSizeClass !== want) { map.SetHasClass(_mapSizeClass, false); }
        if (want) { map.SetHasClass(want, true); }
        _mapSizeClass = want;
    }

    function _setDrawn(map, px) {
        var fit = QolLiteMapSchema.byKey("minimapSizePx").mapFit;
        var v = px === null ? 100 : QolLiteMapSchema.fitSnap(fit, 100 * _limits().mapDrawnNativePx / px);
        var want = v === 100 ? null : fit.cls + v;
        if (map) {
            if (_fitClass && _fitClass !== want) { map.SetHasClass(_fitClass, false); }
            if (want) { map.SetHasClass(want, true); }
            _fitClass = want;
        }
        if (px !== _drawn) {
            _drawn = px;
            try { QolLiteMapIcons.refresh(); }
            catch (e) {
                if (!_iconsErrLogged) { _iconsErrLogged = true; QolLiteMapLog.error("size: icons refresh threw: " + (e && e.message ? e.message : e)); }
            }
        }
    }

    function _clearSizes() {
        var ids = ["minimap_persp", "minimap_container", "minimap_frame", "hud_minimap"];
        for (var i = 0; i < ids.length; i++) {
            var p = _panel(ids[i]);
            if (p) { p.style.width = null; p.style.height = null; }
        }
        var map = _panel("hud_minimap");
        if (map) { _setMapSizeClass(map, null); }
        _setDrawn(map, null);
    }

    function _applyContainerSize(px) {
        if (QolLiteMapView.targeting()) { _clearSizes(); return; }
        var size = px + "px";
        var persp = _panel("minimap_persp");
        if (persp) { persp.style.width = size; persp.style.height = size; }
        var container = _panel("minimap_container");
        if (container) { container.style.width = size; container.style.height = size; }
        var frame = _panel("minimap_frame");
        if (frame) { frame.style.width = size; frame.style.height = size; }

        var zoom = QolLiteMapRotate.zoom();
        var drawn = Math.round(px * _mapToContainer() * zoom);
        if (zoom > 1) { drawn = Math.min(drawn, QolLiteMapState.get().rotateMapMaxDrawnPx); }
        var mapSize = drawn + "px";
        var zoomed = QolLiteMapMinimap.hasClassAbove("useZoomedMinimap");
        var map = _panel("hud_minimap");
        if (map) {
            map.style.width = zoomed ? null : mapSize;
            map.style.height = zoomed ? null : mapSize;
            _setMapSizeClass(map, zoomed ? null : px);
        }
        _setDrawn(map, map && !zoomed ? drawn : null);
    }

    function _sanitizeSize(value) {
        var state = QolLiteMapState.get();
        var min = state.minimapSizeMinPx;
        var max = state.minimapSizeMaxPx;
        var step = state.minimapSizeStepPx;
        var px = Math.round(Number(value) / step) * step;
        return Math.max(min, Math.min(max, px || state.minimapSizePx));
    }

    function _targetPx() {
        var s = QolLiteMapState.get();
        return QolLiteMapTabMap.active() ? Number(s.tabMapSizePx) : _sanitizeSize(s.minimapSizePx);
    }

    function apply() {
        _applyContainerSize(_targetPx());
        QolLiteMapPosition.apply();
    }

    function applyCurrentSize() {
        _applyContainerSize(_targetPx());
    }

    function applyClampWidth() {
        var clamp = QolLiteMapHud.clamp();
        if (!clamp) { return; }
        clamp.style.maxWidth = QolLiteMapState.get().hudFullWidth ? (FULL_WIDTH_PX + "px") : null;
    }

    function applyMapOpacity() {
        var container = _panel("minimap_container");
        var layer = _panel("HudMinimapContainer");
        var s = QolLiteMapState.get();
        if (layer) { layer.style.opacity = null; }
        if (container) { container.style.opacity = String(QolLiteMapTabMap.active() ? s.tabMapOpacity : s.mapOpacity); }
    }

    function _keepTargetSize() {
        var persp = _panel("minimap_persp");
        if (persp) { persp.style.opacity = "1"; }
        applyCurrentSize();
    }

    function _holdTick() {
        if (!QolLiteMapView.anyOpen()) { _holding = false; return; }
        _keepTargetSize();
        $.Schedule(HOLD_REAPPLY_SEC, _holdTick);
    }

    function _startHold() {
        if (_holding) { return; }
        _holding = true;
        _holdTick();
    }

    function _onView() {
        apply();
        if (QolLiteMapView.anyOpen()) { _startHold(); }
    }

    function _zoomPoll() {
        $.Schedule(ZOOM_POLL_SEC, _zoomPoll);
        var zoomed = QolLiteMapMinimap.hasClassAbove("useZoomedMinimap");
        if (_zoomedSeen !== null && zoomed !== _zoomedSeen) {
            _zoomedSeen = zoomed;
            QolLiteMapLog.log("size: zoomed minimap -> " + zoomed + ", re-applying");
            apply();
        }
        _zoomedSeen = zoomed;
    }

    function init() {
        apply();
        applyClampWidth();
        applyMapOpacity();
        QolLiteMapView.onChange(_onView);
        _onView();
        _zoomPoll();
    }

    function drawnPx() { return _drawn; }

    return {
        init: init, apply: apply, drawnPx: drawnPx,
        applyClampWidth: applyClampWidth, applyMapOpacity: applyMapOpacity
    };
})();
