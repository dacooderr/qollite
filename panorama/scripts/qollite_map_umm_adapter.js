// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_umm.js
"use strict";

var QolLiteMapUmmAdapter = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var PROTOCOL = 1;
    var MOD_ID = "bettermap";
    var MOD_NAME = "BetterMap";
    var UMM_ROOT_ID = "UmmRoot";
    var SEED_WAIT_SEC = 2;

    var _present = false;
    var _waitingSeed = false;

    function _root() { return QolLiteMapHud.root(); }

    function _send(payload) {
        try { $.DispatchEvent(CHANNEL, JSON.stringify(payload)); } catch (e) {}
    }

    function _register() {
        var state = QolLiteMapState.get();
        var defaults = QolLiteMapState.DEFAULTS;
        var list = QolLiteMapSchema.list();
        var settings = [], values = {}, group = null;
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (e.standalone) { continue; }
            if (e.type !== "toggle" && e.type !== "slider") {
                QolLiteMapLog.error("umm: no UMM widget for type \"" + e.type + "\" (" + e.key + ") - not registered");
                continue;
            }
            if (e.group !== group) { group = e.group; settings.push({ type: "group", label: group }); }
            var w = { id: e.umm, type: e.type, label: e.label };
            if (e.type === "slider") { w.min = e.min; w.max = e.max; w.step = e.step; w.unit = e.unit; }
            w["default"] = QolLiteMapSchema.toShown(e, defaults[e.key]);
            settings.push(w);
            values[e.umm] = QolLiteMapSchema.toShown(e, state[e.key]);
        }
        _send({ umm: PROTOCOL, t: "register", id: MOD_ID, name: MOD_NAME, settings: settings, values: values });
    }

    function _onSet(id, value) {
        var e = QolLiteMapSchema.byUmmId(id);
        if (!e) { return; }
        var stored = QolLiteMapSchema.sanitize(e.key, QolLiteMapSchema.isRanged(e) ? Number(value) / e.scale : value);
        if (stored === undefined) { QolLiteMapLog.log("umm: ignored invalid " + id + " = " + value); return; }
        var patch = {};
        patch[e.key] = stored;
        QolLiteMapState.patch(patch);
        QolLiteMapApply.key(e.key);
        QolLiteMapStore.save([e.key]);
        QolLiteMapLog.log("umm: set " + id + " = " + value);
    }

    function _markPresent() {
        if (_present) { return; }
        _present = true;
        QolLiteMapLog.info("umm: core present - settings and saving go through UMM, mirrored by our store");
        QolLiteMapStore.ummPresent();
    }

    function _onMessage(payload) {
        if (typeof payload !== "string" || payload.indexOf("\"umm\"") === -1) { return; }
        var msg;
        try { msg = JSON.parse(payload); } catch (e) { return; }
        if (!msg || msg.umm !== PROTOCOL) { return; }
        if (msg.t === "hello") {
            _markPresent();
            if (!_waitingSeed) { _register(); }
        } else if (msg.t === "set" && msg.id === MOD_ID) {
            _markPresent();
            _onSet(msg.key, msg.value);
        }
    }

    function _endSeed(reason) {
        if (!_waitingSeed) { return; }
        _waitingSeed = false;
        QolLiteMapLog.info("umm: first register - " + reason);
        _register();
    }

    function _seedTimeout() {
        if (!_waitingSeed) { return; }
        QolLiteMapStore.disable("UMM registered without a seed", true);
        _endSeed("no stored values within " + SEED_WAIT_SEC + " s");
    }

    function seed(values) {
        if (!_waitingSeed) {
            QolLiteMapLog.info("umm: seed ignored - already registered (a late store read is logged as store: off - UMM registered without a seed)");
            return;
        }
        var n = 0;
        if (values) {
            for (var k in values) { if (Object.prototype.hasOwnProperty.call(values, k)) { n++; } }
            QolLiteMapState.patch(values);
            try { QolLiteMapApply.all(); }
            catch (e) { QolLiteMapLog.error("umm: apply after seed threw: " + (e && e.message ? e.message : e)); }
        }
        _endSeed(n ? "seeded with " + n + " stored values" : "nothing stored to seed");
    }

    function init() {
        try { $.RegisterForUnhandledEvent(CHANNEL, _onMessage); } catch (e) {}
        if (_root().FindChildTraverse(UMM_ROOT_ID)) {
            _waitingSeed = true;
            $.Schedule(SEED_WAIT_SEC, _seedTimeout);
            return;
        }
        _register();
    }

    function isPresent() { return _present; }

    return { init: init, isPresent: isPresent, seed: seed };
})();
