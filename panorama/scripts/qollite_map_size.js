// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_size.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimap size, Valve's 21:9 clamp (Full-Width HUD), map opacity, and keeping the
// target size (normal, or the TAB map's) while a view (TAB / Alt) is open. Values come from QolLiteMapState; the
// settings UI is Valve's settings window (qollite_map_popup.js), not this module.
var QolLiteMapSize = (function () {
    var FULL_WIDTH_PX = 10000;           // effectively "no cap" - HUD/minimap spans the full monitor
    // Build 6722 draws the map at a fixed 360px inside the 400px container/compass
    // frame (hud_minimap.css #hud_minimap vs hud.css #minimap_container), so the
    // map itself must be scaled with the container or the slider only grows the frame.
    // Read when used: the load order is undefined (CLAUDE.md), QolLiteMapSchema may load after this file.
    function _limits() { return QolLiteMapSchema.LIMITS; }
    function _mapToContainer() { return _limits().mapDrawnNativePx / _limits().minimapSizeNativePx; }
    // While a view is open, Valve rescaled the map; re-applying our size every
    // 0.03 s is what kept it steady (the retired always-on poll, carried over from
    // qollite_map_settings.js). Probe E6 (spec 2026-10-07-hud-runtime-entry §5) saw no
    // rescale with Valve's current CSS; whether the loop is still needed is open
    // (runtime-cost audit F3), so the rate stays, but only while a view is open.
    var HOLD_REAPPLY_SEC = 0.03;
    var _mapSizeClass = null;    // the bm_mapsize_<px> class last put on #hud_minimap
    var _fitClass = null;        // the bm_fit_<v> class last put on #hud_minimap
    var _drawn = null;           // the CSS px last written as #hud_minimap's width, null while Valve sizes it
    var _iconsErrLogged = false; // one error line for a throwing QolLiteMapIcons.refresh, not one per change
    // Valve's zoomed minimap is a game setting the player can switch mid-session, and no event is known for it: this
    // poll re-applies on a flip, so the map width and bm_fit_ go back to Valve (icons-keep-size K3; review M1).
    var ZOOM_POLL_SEC = 0.5;
    var _zoomedSeen = null;      // useZoomedMinimap at the last poll
    var _holding = false;        // the 0.03 s re-apply loop is scheduled

    function _panel(id) { return QolLiteMapHud.find(id); }

    // The class that selects the generated #CastRange counter-scale (schema
    // minimapSizePx.mapScale). None in the zoomed minimap, where Valve sizes the map.
    // Set on every apply, so a recreated #hud_minimap gets it back with the size.
    function _setMapSizeClass(map, px) {
        var want = px === null ? null : QolLiteMapSchema.byKey("minimapSizePx").mapScale.cls + px;
        if (_mapSizeClass && _mapSizeClass !== want) { map.SetHasClass(_mapSizeClass, false); }
        if (want) { map.SetHasClass(want, true); }
        _mapSizeClass = want;
    }

    // Icons-keep-size spec §4: the drawn map size the %-sized markers are counter-scaled against. The `bm_fit_<v>`
    // class (v = native / drawn on the mapFit grid; none at 100 or while Valve sizes the map) scales the markers
    // without a size setting; QolLiteMapIcons folds the same ratio into the player classes, so it is told when the
    // size changes - not on every hold-loop tick, where nothing changes. Set on every apply, so a recreated
    // #hud_minimap gets it back.
    function _setDrawn(map, px) {
        var fit = QolLiteMapSchema.byKey("minimapSizePx").mapFit;
        var v = px === null ? 100 : QolLiteMapSchema.fitSnap(fit, 100 * _limits().mapDrawnNativePx / px);
        var want = v === 100 ? null : fit.cls + v;
        // Without the panel the class we set stays tracked, so it is removed once the panel is found again.
        if (map) {
            if (_fitClass && _fitClass !== want) { map.SetHasClass(_fitClass, false); }
            if (want) { map.SetHasClass(want, true); }
            _fitClass = want;
        }
        if (px !== _drawn) {
            _drawn = px;
            // Another module, called from the hold loop too: a throw must not end that loop (review L2).
            try { QolLiteMapIcons.refresh(); }
            catch (e) {
                if (!_iconsErrLogged) { _iconsErrLogged = true; QolLiteMapLog.error("size: icons refresh threw: " + (e && e.message ? e.message : e)); }
            }
        }
    }

    // Hands the sizes back to Valve's CSS (null clears the inline value).
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
        // Remove-traveler spec T5: while a map ability is aimed, Valve's .gMinimapTargeting rules size the
        // minimap (600 x 680 persp, 560 container / frame, 504 map); our inline sizes would beat them.
        if (QolLiteMapView.targeting()) { _clearSizes(); return; }
        var size = px + "px";
        var persp = _panel("minimap_persp");
        if (persp) { persp.style.width = size; persp.style.height = size; }
        var container = _panel("minimap_container");
        if (container) { container.style.width = size; container.style.height = size; }
        var frame = _panel("minimap_frame");
        if (frame) { frame.style.width = size; frame.style.height = size; }

        // The map image scales with the container. In the zoomed minimap mode Valve
        // sizes #hud_minimap itself (HudMinimapSize5..11) and pans it, so we hand the
        // size back to its CSS there. Our POI/urn overlay lives inside #hud_minimap at
        // 100 % of it (bettermap.vcss), so it follows the map in both modes.
        // The rotating minimap zooms the map inside the same frame (rotating spec R4); the range-circle class
        // stays the unzoomed size (known limit, spec §5.1 amendment).
        // Spec R11: while zoomed the drawn map is capped (rotateMapMaxDrawnPx); unzoomed sizes (Minimap Size, the
        // TAB map) are the player's own and stay as set.
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

    // The size the map should have now: the TAB map's while it is on, else the setting's.
    function _targetPx() {
        var s = QolLiteMapState.get();
        return QolLiteMapTabMap.active() ? Number(s.tabMapSizePx) : _sanitizeSize(s.minimapSizePx);
    }

    function apply() {
        _applyContainerSize(_targetPx());
        // A larger map shrinks how far the position offset can go before the map
        // runs off screen; re-clamp the placement against the new size.
        QolLiteMapPosition.apply();
    }

    function applyCurrentSize() {
        _applyContainerSize(_targetPx());
    }

    // Since build 6722 the only vanilla cap on the minimap's clamp_width container
    // is Valve's own ultrawide option (`.AspectRatio21x9_clampwidth .clamp_width`
    // max-width 1920px). Full-Width HUD lifts it; off hands control back to
    // Valve's CSS (null clears the inline value - Valve idiom, dota play.js).
    function applyClampWidth() {
        var clamp = QolLiteMapHud.clamp();
        if (!clamp) { return; }
        clamp.style.maxWidth = QolLiteMapState.get().hudFullWidth ? (FULL_WIDTH_PX + "px") : null;
    }

    // Opacity of the whole map block: #minimap_container holds Valve's #minimap_blur and #minimap_frame (the
    // backdrop) beside #HudMinimapContainer, so the backdrop, the engine's markers and our overlay (inside
    // #hud_minimap) fade together (owner 2026-11-05, spec tab-map B13; it was #HudMinimapContainer alone, spec
    // H13 of the HUD entry). While the TAB map is on, its own opacity replaces the setting's (spec
    // 2026-11-04-tab-map B4). Minimalist Minimap's inline opacity 0 on the frame / blur multiplies and keeps
    // them hidden. An inline value that earlier code left on #HudMinimapContainer would multiply: cleared.
    function applyMapOpacity() {
        var container = _panel("minimap_container");
        var layer = _panel("HudMinimapContainer");
        var s = QolLiteMapState.get();
        if (layer) { layer.style.opacity = null; }
        if (container) { container.style.opacity = String(QolLiteMapTabMap.active() ? s.tabMapOpacity : s.mapOpacity); }
    }

    // Idempotent: every value it sets is the same on each call.
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

    // Every view change (TAB, Alt, map targeting) re-applies; every value is idempotent. Opening starts the hold
    // loop; closing does nothing more: the loop ends by itself on its next tick.
    function _onView() {
        apply();
        if (QolLiteMapView.anyOpen()) { _startHold(); }
    }

    // Rescheduled first, so a throwing apply() cannot end the poll.
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

    // The CSS px BetterMap draws #hud_minimap at, or null while Valve sizes it (its zoomed minimap, map targeting)
    // or before the first apply (icons-keep-size spec §4).
    function drawnPx() { return _drawn; }

    return {
        init: init, apply: apply, drawnPx: drawnPx,
        applyClampWidth: applyClampWidth, applyMapOpacity: applyMapOpacity
    };
})();
