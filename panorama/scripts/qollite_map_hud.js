// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ a9f121a, mod/panorama/scripts/bettermap_hud.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// The HUD structure BetterMap used to declare in its hud.vxml override, built at runtime instead
// (spec docs/specs/2026-10-07-hud-runtime-entry.md H4-H6, H10-H14). Our scripts load from
// hud_data_feed.vxml, whose context panel is HudDataFeed#DataFeed, so every module finds HUD panels
// from root() - the one top-root walk (it was copied in four modules).
//   - #minimap_persp_wrapper: #minimap_persp moved into a new panel at its own index in its own parent.
//     The placement margins go on the wrapper, never on Valve's #minimap_persp (panorama_notes). Moving it
//     within its parent keeps the location labels' dialog variables (probe E2; QOL moved it under
//     another parent and the labels read "INVALID").
//   - #minimap_overlay_root > #minimap_markers, #minimap_urn_host, created inside #hud_minimap so the rules
//     of our hud_minimap.vcss reach them (E3: inside, layoutfile hud_minimap.xml; outside they do not, E4).
//   - The inline styles our override CSS gave the panels outside the minimap (§4, H14).
// The minimap's panels exist from HUD load, also in the hideout where they are not shown, and survive
// map changes (Task 0 runs, §5.1): init builds at once. A HUD rebuild (never seen) is caught by the
// game-state event and a slow safety poll; the panels are cached, so a built HUD costs a few
// IsValid / GetParent checks per tick, never a tree search.
var QolLiteMapHud = (function () {
    var PERSP_ID = "minimap_persp";
    var MAP_ID = "hud_minimap";
    var CONTAINER_ID = "minimap_container";
    var WRAPPER_ID = "minimap_persp_wrapper";
    var OVERLAY_ID = "minimap_overlay_root";
    var MARKERS_ID = "minimap_markers";
    var URN_HOST_ID = "minimap_urn_host";
    var OVERLAY_CLASS = "bm_overlay";              // styled in pipeline/minimap_styles/bettermap.vcss
    var REBUILD_EVENT = "CitadelGameStateChanged";  // fires on every game-state change (§5.1)
    // Recovers a HUD rebuild the event missed; 2 s per spec H11 (no rebuild was ever seen).
    var SAFETY_POLL_SEC = 2;

    var _persp = null;
    var _map = null;
    var _overlayPanel = null;
    var _ready = [];
    var _builds = 0;
    var _lastError = null;

    function _msg(e) { return e && e.message ? e.message : String(e); }

    function root() {
        var r = $.GetContextPanel();
        while (r && r.GetParent()) { r = r.GetParent(); }
        return r;
    }

    function find(id) { var r = root(); return r ? r.FindChildTraverse(id) : null; }

    function _alive(p) { return !!p && p.IsValid(); }

    function _wrapper(persp) {
        var parent = persp.GetParent();
        var w = $.CreatePanel("Panel", parent, WRAPPER_ID);
        parent.MoveChildBefore(w, persp);
        persp.SetParent(w);
        w.hittest = false;
        w.hittestchildren = true;
        // The persp is wrapped now and is never wrapped again, so a style that threw is logged, not
        // retried (every value below was accepted by the strict setter, E5).
        try { _styleWrapped(parent, w, persp); }
        catch (e) { QolLiteMapLog.error("hud: styling the wrapped minimap threw: " + _msg(e)); }
        return w;
    }

    function _styleWrapped(parent, w, persp) {
        // What #minimap_persp_wrapper had in our hud_minimap.vcss. Its margin-bottom and flow-children
        // are not carried: qollite_map_position.js writes all four margins and the wrapper holds one child (H14).
        w.style.width = "fit-children";
        w.style.height = "fit-children";
        w.style.verticalAlign = "bottom";
        w.style.horizontalAlign = "right";
        w.style.overflow = "noclip";
        parent.style.overflow = "noclip";          // was #minimap_ui_clamp_container (our id) in hud.vcss
        persp.style.overflow = "noclip";           // was #minimap_persp in hud.vcss
        // Valve's #minimap_persp is 440 x 520 with margin-bottom 15px, bottom / right aligned, and
        // its container has margin-top 80px (room for the hints); qollite_map_size.js makes the persp the
        // container's size, so the persp hugs the wrapper's top-left and the container its top (H14).
        persp.style.verticalAlign = "top";
        persp.style.horizontalAlign = "left";
        persp.style.marginBottom = "0px";
        persp.style.marginRight = "0px";
        var container = persp.FindChildTraverse(CONTAINER_ID);
        if (container) { container.style.marginTop = "0px"; }
        else { QolLiteMapLog.error("hud: no #" + CONTAINER_ID + " in #" + PERSP_ID + " - the map may sit low"); }
    }

    // All or nothing: a throw half-way deletes the half-built overlay, so the next check builds a whole
    // one instead of keeping one without its hosts or stacking duplicates (review 2026-10-10).
    function _overlay(map) {
        var o = $.CreatePanel("Panel", map, OVERLAY_ID, { class: OVERLAY_CLASS });
        try {
            o.hittest = false;
            o.hittestchildren = false;
            var markers = $.CreatePanel("Panel", o, MARKERS_ID);
            var urn = $.CreatePanel("Panel", o, URN_HOST_ID);
            markers.hittest = false; markers.hittestchildren = false;
            urn.hittest = false; urn.hittestchildren = false;
        } catch (e) {
            o.DeleteAsync(0);
            throw e;
        }
        _overlayPanel = o;
        return o;
    }

    // True when this check built anything (the first build, a rebuilt HUD, a vanished overlay).
    function _build() {
        if (!_alive(_persp) || !_alive(_map)) {
            _persp = find(PERSP_ID);
            _map = find(MAP_ID);
            if (!_persp || !_map) { return false; }  // no minimap in this HUD: not an error (H10)
        }
        var built = false;
        var parent = _persp.GetParent();
        if (!parent || parent.id !== WRAPPER_ID) { _wrapper(_persp); built = true; }
        if (!_alive(_overlayPanel) || _overlayPanel.GetParent() !== _map) { _overlay(_map); built = true; }
        return built;
    }

    function _check() {
        try {
            if (!_build()) { return; }
            _builds++;
            QolLiteMapLog.log("hud: built the minimap structure (#" + _builds + ")");
            for (var i = 0; i < _ready.length; i++) {
                try { _ready[i](_builds); }
                catch (e) { QolLiteMapLog.error("hud: ready callback threw: " + _msg(e)); }
            }
        } catch (e2) {
            var m = "hud: build threw: " + _msg(e2);
            if (m !== _lastError) { _lastError = m; QolLiteMapLog.error(m); }
        }
    }

    function _poll() {
        _check();
        $.Schedule(SAFETY_POLL_SEC, _poll);
    }

    // fn(build) runs after every build; the bootstrap re-applies all features there.
    function onReady(fn) { _ready.push(fn); }

    // Valve's clamp panel (id-less in hud.xml): the wrapper's parent, the space the placement travels in.
    // Looked up, not cached: it is called on a setting change only.
    function clamp() {
        var w = find(WRAPPER_ID);
        return w ? w.GetParent() : null;
    }

    function init() {
        // On the next frame: C++ has then made whatever the new game state needs.
        try { $.RegisterForUnhandledEvent(REBUILD_EVENT, function () { $.Schedule(0, _check); }); }
        catch (e) { QolLiteMapLog.error("hud: " + REBUILD_EVENT + " not registered (" + _msg(e) + ") - the safety poll covers it"); }
        _poll();
    }

    return { init: init, root: root, find: find, clamp: clamp, onReady: onReady };
})();
