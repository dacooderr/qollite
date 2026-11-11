// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_settings_bus.js
"use strict";

var QolLiteMapSettingsBus = (function () {
    var _listeners = [];

    function _log(m) { QolLiteMapLog.log("bus: " + m); }

    function _send(msg) {
        for (var i = 0; i < _listeners.length; i++) {
            (function (fn) {
                $.Schedule(0, function () {
                    try { fn(msg); }
                    catch (e) { QolLiteMapLog.error("bus: listener threw: " + (e && e.message ? e.message : e)); }
                });
            })(_listeners[i]);
        }
    }

    function _sendState() {
        _send({ t: "state", values: QolLiteMapState.values(), umm: QolLiteMapUmmAdapter.isPresent() });
    }

    function _apply(key) {
        try { if (key === undefined) { QolLiteMapApply.all(); } else { QolLiteMapApply.key(key); } }
        catch (e) { QolLiteMapLog.error("bus: apply threw: " + (e && e.message ? e.message : e)); }
    }

    function _onSet(key, value) {
        var v = QolLiteMapSchema.sanitize(key, value);
        if (v === undefined) { _log("ignored set " + key + " = " + JSON.stringify(value)); return false; }
        var patch = {};
        patch[key] = v;
        QolLiteMapState.patch(patch);
        _apply(key);
        QolLiteMapStore.save([key]);
        _log("set " + key + " = " + JSON.stringify(v));
        return true;
    }

    function _onReset(group) {
        var d = QolLiteMapSchema.defaults(), list = QolLiteMapSchema.list(), patch = {}, keys = [];
        for (var i = 0; i < list.length; i++) {
            if (group === undefined || list[i].group === group) {
                patch[list[i].key] = d[list[i].key];
                keys.push(list[i].key);
            }
        }
        if (!keys.length) { _log("ignored reset of unknown group " + JSON.stringify(group)); return false; }
        QolLiteMapState.patch(patch);
        _apply();
        QolLiteMapStore.save(keys);
        return true;
    }

    function request(msg) {
        if (!msg || typeof msg.t !== "string") { return; }
        if (msg.t === "get") {
            _sendState();
        } else if (msg.t === "set" || msg.t === "reset") {
            if (QolLiteMapUmmAdapter.isPresent()) {
                _log("ignored " + msg.t + ": UMM owns the settings");
                _sendState();
                return;
            }
            var changed = msg.t === "set" ? _onSet(msg.key, msg.value) : _onReset(msg.group);
            if (!changed && msg.t === "set") { return; }
            _sendState();
        } else if (msg.t === "flush") {
            QolLiteMapStore.flush();
        } else if (msg.t === "peek") {
            QolLiteMapPreview.hold();
        } else if (msg.t === "lift") {
            QolLiteMapPreview.lift(msg.on === true);
        }
    }

    function subscribe(fn) { _listeners.push(fn); }

    return { request: request, subscribe: subscribe, broadcast: _sendState };
})();
