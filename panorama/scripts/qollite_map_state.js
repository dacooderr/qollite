// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_state.js
"use strict";

var QolLiteMapState = (function () {
    var _defaults = null;
    var _state = null;

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

    function _defaultsObj() {
        if (!_defaults) {
            var d = QolLiteMapSchema.defaults();
            var limits = QolLiteMapSchema.LIMITS;
            for (var k in limits) { if (_own(limits, k)) { d[k] = limits[k]; } }
            _defaults = Object.freeze(d);
        }
        return _defaults;
    }

    function reset() {
        var d = _defaultsObj();
        _state = {};
        for (var k in d) { if (_own(d, k)) { _state[k] = d[k]; } }
    }

    function get() {
        if (!_state) { reset(); }
        return _state;
    }

    function patch(obj) {
        var s = get();
        for (var k in obj) { if (_own(obj, k)) { s[k] = obj[k]; } }
    }

    function values() {
        var s = get(), out = {}, list = QolLiteMapSchema.list();
        for (var i = 0; i < list.length; i++) { out[list[i].key] = s[list[i].key]; }
        return out;
    }

    var api = { get: get, patch: patch, reset: reset, values: values };
    Object.defineProperty(api, "DEFAULTS", { get: _defaultsObj, enumerable: true });
    return api;
})();
