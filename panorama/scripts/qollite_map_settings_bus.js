// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ a7b55cf, mod/panorama/scripts/bettermap_settings_bus.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// The HUD end of BetterMap's subsection in Valve's settings window. The popup
// (qollite_map_popup.js) runs in its own context and cannot see QolLiteMapState: it
// asks for the live values (`get` -> `state`), sends each change (`set`/`reset`;
// `reset` may name one group), asks for the on-screen preview (`peek`) and the
// lifted minimap while our subsection is on screen (`lift`), and says when to
// write (`flush`, on close).
// Here a change is sanitised, applied and handed to the store, which writes it
// on a flush or after its idle delay (D17). Protocol: spec docs/specs/2026-10-01-native-settings.md §4.3.
var QolLiteMapSettingsBus = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var PROTOCOL = 1;

    function _log(m) { QolLiteMapLog.log("bus: " + m); }

    function _send(msg) {
        msg.bm = PROTOCOL;
        try { $.DispatchEvent(CHANNEL, JSON.stringify(msg)); }
        catch (e) { QolLiteMapLog.error("bus: dispatch threw: " + (e && e.message ? e.message : e)); }
    }

    function _sendState() {
        _send({ t: "state", values: QolLiteMapState.values(), umm: QolLiteMapUmmAdapter.isPresent() });
    }

    // A feature that throws must not skip the save and the state answer.
    // key: re-apply only what that setting affects; none: re-apply everything.
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

    // group: a schema group name restores only that subsection's settings (spec I5);
    // a message without `group` restores all (spec §5.6). An unknown or wrongly typed
    // group changes nothing and is answered with the unchanged state, so the popup
    // re-syncs.
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

    function _onMessage(payload) {
        if (typeof payload !== "string" || payload.indexOf("\"bm\"") === -1) { return; }
        var msg;
        try { msg = JSON.parse(payload); } catch (e) { return; }
        if (!msg || msg.bm !== PROTOCOL) { return; }
        if (msg.t === "get") {
            _sendState();
        } else if (msg.t === "set" || msg.t === "reset") {
            if (QolLiteMapUmmAdapter.isPresent()) {
                // Answer, so the popup re-syncs its controls and shows the UMM note.
                _log("ignored " + msg.t + ": UMM owns the settings");
                _sendState();
                return;
            }
            var changed = msg.t === "set" ? _onSet(msg.key, msg.value) : _onReset(msg.group);
            // An invalid set stays unanswered; a reset is always answered, so the
            // popup's pending reset clears even when the group was unknown.
            if (!changed && msg.t === "set") { return; }
            _sendState();
        } else if (msg.t === "flush") {
            // The window is closing, or a reset just landed: write now (D17).
            QolLiteMapStore.flush();
        } else if (msg.t === "peek") {
            QolLiteMapPreview.hold();
        } else if (msg.t === "lift") {
            QolLiteMapPreview.lift(msg.on === true);
        }
    }

    function init() { $.RegisterForUnhandledEvent(CHANNEL, _onMessage); }

    // broadcast: push the current state to the popup (the bootstrap calls it after a store load).
    return { init: init, broadcast: _sendState };
})();
