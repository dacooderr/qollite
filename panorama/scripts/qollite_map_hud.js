// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_hud.js
"use strict";

var QolLiteMapHud = (function () {
    var PERSP_ID = "minimap_persp";
    var MAP_ID = "hud_minimap";
    var CONTAINER_ID = "minimap_container";
    var VALVE_CONTAINER_MARGIN_TOP = "80px";
    var WRAPPER_ID = "minimap_persp_wrapper";
    var OVERLAY_ID = "minimap_overlay_root";
    var MARKERS_ID = "minimap_markers";
    var URN_HOST_ID = "minimap_urn_host";
    var OVERLAY_CLASS = "bm_overlay";
    var REBUILD_EVENT = "CitadelGameStateChanged";
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

    function _under(p, r) {
        if (!p.IsValid()) { return false; }
        while (p && p !== r) { p = p.GetParent(); }
        return p === r;
    }

    function finder(top) {
        var found = {};
        return function (id) {
            var r = top();
            var p = found[id];
            if (p && r && _under(p, r)) { return p; }
            p = r ? r.FindChildTraverse(id) : null;
            if (p) { found[id] = p; } else { delete found[id]; }
            return p;
        };
    }

    var find = finder(root);

    function _alive(p) { return !!p && p.IsValid(); }

    function _wrapper(persp) {
        var parent = persp.GetParent();
        var w = $.CreatePanel("Panel", parent, WRAPPER_ID);
        parent.MoveChildBefore(w, persp);
        persp.SetParent(w);
        w.hittest = false;
        w.hittestchildren = true;
        try { _styleWrapped(parent, w, persp); }
        catch (e) { QolLiteMapLog.error("hud: styling the wrapped minimap threw: " + _msg(e)); }
        return w;
    }

    function _containerMargin(container) {
        var targeting = typeof QolLiteMapView !== "undefined" && QolLiteMapView.targeting();
        container.style.marginTop = targeting ? VALVE_CONTAINER_MARGIN_TOP : "0px";
    }

    function _styleWrapped(parent, w, persp) {
        w.style.width = "fit-children";
        w.style.height = "fit-children";
        w.style.verticalAlign = "bottom";
        w.style.horizontalAlign = "right";
        w.style.overflow = "noclip";
        parent.style.overflow = "noclip";
        persp.style.overflow = "noclip";
        persp.style.verticalAlign = "top";
        persp.style.horizontalAlign = "left";
        persp.style.marginBottom = "0px";
        persp.style.marginRight = "0px";
        var container = persp.FindChildTraverse(CONTAINER_ID);
        if (container) { _containerMargin(container); }
        else { QolLiteMapLog.error("hud: no #" + CONTAINER_ID + " in #" + PERSP_ID + " - the map may sit low"); }
    }

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

    function _build() {
        if (!_alive(_persp) || !_alive(_map)) {
            _persp = find(PERSP_ID);
            _map = find(MAP_ID);
            if (!_persp || !_map) { return false; }
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

    function onReady(fn) { _ready.push(fn); }

    function clamp() {
        var w = find(WRAPPER_ID);
        return w ? w.GetParent() : null;
    }

    function _onView() {
        var container = find(CONTAINER_ID);
        if (container) { _containerMargin(container); }
    }

    function init() {
        try { $.RegisterForUnhandledEvent(REBUILD_EVENT, function () { $.Schedule(0, _check); }); }
        catch (e) { QolLiteMapLog.error("hud: " + REBUILD_EVENT + " not registered (" + _msg(e) + ") - the safety poll covers it"); }
        _poll();
        try { QolLiteMapView.onChange(_onView); }
        catch (e3) { QolLiteMapLog.error("hud: QolLiteMapView.onChange failed (" + _msg(e3) + ") - the container margin follows targeting only at a build"); }
    }

    return { init: init, root: root, find: find, finder: finder, clamp: clamp, onReady: onReady };
})();
