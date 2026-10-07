// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_size.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimap size, Valve's 21:9 clamp (Full-Width HUD), map opacity, the Traveler
// enlargement while a map ability is aimed, and keeping the map at its normal
// size while TAB is held. Values come from QolLiteMapState; the settings UI is
// Valve's settings window (qollite_map_popup.js), not this module.
var QolLiteMapSize = (function () {
    var FULL_WIDTH_PX = 10000;           // effectively "no cap" - HUD/minimap spans the full monitor
    // Build 6722 draws the map at a fixed 360px inside the 400px container/compass
    // frame (hud_minimap.css #hud_minimap vs hud.css #minimap_container), so the
    // map itself must be scaled with the container or the slider only grows the frame.
    var MAP_TO_CONTAINER = 360 / 400;
    var MT_POLL_SEC = 0.06;
    // TAB (scoreboard) and Alt (ability menu / detail view) open and close
    // events. Probe run 1 (2026-10-04, build 6745), in this hud.vxml context: each
    // fires on every open and close with one boolean, true = open; the global
    // class (gScoreboardOpen / gDetailView) follows 2-33 ms later, so the handler
    // trusts the argument instead of reading a class that has not flipped yet.
    // QOL Lock listens to the same TAB event (ql_app.js).
    var DETAIL_EVENTS = ["CitadelScoreboardToggle", "CitadelMinimapToggle"];
    // While a view is open, Valve rescales the map; re-applying our size every
    // 0.03 s is what kept it steady (the retired always-on poll, carried over from
    // qollite_map_settings.js). Not re-measured since DisableBigMapScaleOnTab, so the
    // rate stays, but only while a view is open.
    var HOLD_REAPPLY_SEC = 0.03;
    // Safety net for a missed event (e.g. a HUD reload while TAB is held): reads
    // the classes. 0.5 s is QOL Lock's idle rate for the same TAB handling
    // (ql_minimap_runtime/manifest.js `_determineOptimalRate`).
    var SAFETY_POLL_SEC = 0.5;
    // A missed close event: open by event, but no view class on this many safety
    // ticks in a row. Two, because the class trails the event by up to 33 ms and a
    // single tick can land inside that gap.
    var STALE_OPEN_TICKS = 2;
    var DETAIL_STATE_IDS = [
        "minimap_persp", "minimap_persp_wrapper", "context_action_container", "AbilitiesContainer",
        "cast_failed_box", "CheaterVoteBox", "DamageReportGlobalClassListener"
    ];
    var _ultActive = false;
    var _mapSizeClass = null;    // the bm_mapsize_<px> class last put on #hud_minimap
    var _openByEvent = {};       // event name -> last boolean it carried
    var _holding = false;        // the 0.03 s re-apply loop is scheduled
    var _staleTicks = 0;

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    // The class that selects the generated #CastRange counter-scale (schema
    // minimapSizePx.mapScale). None in the zoomed minimap, where Valve sizes the map.
    // Set on every apply, so a recreated #hud_minimap gets it back with the size.
    function _setMapSizeClass(map, px) {
        var want = px === null ? null : QolLiteMapSchema.byKey("minimapSizePx").mapScale.cls + px;
        if (_mapSizeClass && _mapSizeClass !== want) { map.SetHasClass(_mapSizeClass, false); }
        if (want) { map.SetHasClass(want, true); }
        _mapSizeClass = want;
    }

    function _applyContainerSize(px) {
        var size = px + "px";
        var persp = _panel("minimap_persp");
        if (persp) { persp.style.width = size; persp.style.height = size; }
        var container = _panel("minimap_container");
        if (container) { container.style.width = size; container.style.height = size; }
        var frame = _panel("minimap_frame");
        if (frame) { frame.style.width = size; frame.style.height = size; }

        // The POI/urn overlay must cover exactly the drawn map. In the zoomed
        // minimap mode Valve sizes #hud_minimap itself (HudMinimapSize5..11) and
        // pans it, so we hand the size back to its CSS there.
        var mapSize = Math.round(px * MAP_TO_CONTAINER) + "px";
        var zoomed = QolLiteMapMinimap.hasClassAbove("useZoomedMinimap");
        var map = _panel("hud_minimap");
        if (map) {
            map.style.width = zoomed ? null : mapSize;
            map.style.height = zoomed ? null : mapSize;
            _setMapSizeClass(map, zoomed ? null : px);
        }
        var overlay = _panel("minimap_overlay_root");
        if (overlay) { overlay.style.width = mapSize; overlay.style.height = mapSize; }
    }

    function _sanitizeSize(value) {
        var state = QolLiteMapState.get();
        var min = state.minimapSizeMinPx;
        var max = state.minimapSizeMaxPx;
        var step = state.minimapSizeStepPx;
        var px = Math.round(Number(value) / step) * step;
        return Math.max(min, Math.min(max, px || state.minimapSizePx));
    }

    function apply() {
        _applyContainerSize(_ultActive ? QolLiteMapState.get().minimapUltLargePx : _sanitizeSize(QolLiteMapState.get().minimapSizePx));
        // A larger map shrinks how far the position offset can go before the map
        // runs off screen; re-clamp the placement against the new size.
        QolLiteMapPosition.apply();
    }

    function applyCurrentSize() {
        _applyContainerSize(_sanitizeSize(QolLiteMapState.get().minimapSizePx));
    }

    // Since build 6722 the only vanilla cap on the minimap's clamp_width container
    // is Valve's own ultrawide option (`.AspectRatio21x9_clampwidth .clamp_width`
    // max-width 1920px). Full-Width HUD lifts it; off hands control back to
    // Valve's CSS (null clears the inline value - Valve idiom, dota play.js).
    function applyClampWidth() {
        var clamp = _panel("minimap_ui_clamp_container");
        if (!clamp) { return; }
        clamp.style.maxWidth = QolLiteMapState.get().hudFullWidth ? (FULL_WIDTH_PX + "px") : null;
    }

    // Opacity of the map image layer only; markers sit in #minimap_overlay_root.
    function applyMapOpacity() {
        var layer = _panel("HudMinimapContainer");
        if (layer) { layer.style.opacity = String(QolLiteMapState.get().mapOpacity); }
    }

    // True while a map-targeted ability is being aimed (engine class
    // `map_targeting` on the minimap).
    function _isMapTargeting() { return QolLiteMapMinimap.hasClassAbove("map_targeting"); }

    function _pollMapTargeting() {
        var on = !!QolLiteMapState.get().ultLargeMapEnabled && _isMapTargeting();
        if (on !== _ultActive) {
            _ultActive = on;
            QolLiteMapLog.log("size: map_targeting -> " + (on ? "enlarge" : "restore"));
            // TAB / Alt held keeps the normal size. The retired 0.03 s poll undid an
            // enlargement within a frame; the safety poll is too slow for that.
            if (on && !_isViewOpen()) { _applyContainerSize(QolLiteMapState.get().minimapUltLargePx); } else { applyCurrentSize(); }
        }
        $.Schedule(MT_POLL_SEC, _pollMapTargeting);
    }

    function _isDetailViewVisible() {
        var ancestor = _panel("minimap_persp");
        while (ancestor) {
            if (ancestor.BHasClass && (ancestor.BHasClass("gDetailView") || ancestor.BHasClass("gScoreboardOpen"))) { return true; }
            if (!ancestor.GetParent) { break; }
            ancestor = ancestor.GetParent();
        }
        for (var i = 0; i < DETAIL_STATE_IDS.length; i++) {
            var panel = _panel(DETAIL_STATE_IDS[i]);
            if (panel && (panel.BHasClass("gDetailView") || panel.BHasClass("gScoreboardOpen"))) { return true; }
        }
        var ctx = $.GetContextPanel();
        return !!(ctx && (ctx.BHasClass("gDetailView") || ctx.BHasClass("gScoreboardOpen")));
    }

    // Idempotent: every value it sets is the same on each call.
    function _keepNormalSize() {
        var persp = _panel("minimap_persp");
        if (persp) {
            persp.SetHasClass("DisableBigMapScaleOnTab", true);
            persp.style.opacity = "1";
        }
        applyCurrentSize();
    }

    function _openByAnyEvent() {
        for (var name in _openByEvent) {
            if (_openByEvent.hasOwnProperty(name) && _openByEvent[name]) { return true; }
        }
        return false;
    }

    // The event leads the class by up to 33 ms, the class can outlive a missed
    // close event; either one counts as open.
    function _isViewOpen() { return _openByAnyEvent() || _isDetailViewVisible(); }

    function _holdTick() {
        if (!_isViewOpen()) { _holding = false; return; }
        _keepNormalSize();
        $.Schedule(HOLD_REAPPLY_SEC, _holdTick);
    }

    function _startHold() {
        if (_holding) { return; }
        _holding = true;
        _holdTick();
    }

    // Closing does nothing at once: the hold loop ends by itself once neither the
    // events nor the classes say open, as the class poll did while closed.
    function _onDetailEvent(name) {
        return function (open) {
            QolLiteMapLog.log("size: " + name + "(" + open + ")");
            _openByEvent[name] = !!open;
            _staleTicks = 0;
            if (open) { _startHold(); }
        };
    }

    function _pollDetailView() {
        if (_isDetailViewVisible()) {
            _staleTicks = 0;
            _startHold();
        } else if (_openByAnyEvent() && ++_staleTicks >= STALE_OPEN_TICKS) {
            QolLiteMapLog.log("size: open by event but no view class - close event missed, releasing");
            _openByEvent = {};
            _staleTicks = 0;
        }
        $.Schedule(SAFETY_POLL_SEC, _pollDetailView);
    }

    function init() {
        apply();
        applyClampWidth();
        applyMapOpacity();
        _pollMapTargeting();
        _pollDetailView();
        for (var i = 0; i < DETAIL_EVENTS.length; i++) {
            $.RegisterForUnhandledEvent(DETAIL_EVENTS[i], _onDetailEvent(DETAIL_EVENTS[i]));
        }
    }

    return {
        init: init, apply: apply,
        applyClampWidth: applyClampWidth, applyMapOpacity: applyMapOpacity
    };
})();
