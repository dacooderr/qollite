// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_umm.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Universal Mod Manager (UMM) adapter.
//
// When a UMM core is present it hosts BetterMap's settings as a tab in its shared
// window AND owns persistence: our standalone store and our subsection in Valve's
// settings window step aside (spec docs/specs/2026-10-01-native-settings.md D5).
// Standalone is unaffected: without UMM this module never hears back.
//
// Protocol, verified against the decompiled core
// (references/mods/Mod Manager/panorama/scripts/umm_core.js):
//   bus         = "ClientUI_FireOutput"; JSON payloads namespaced by {umm:1}
//   mod  -> core  {umm:1, t:"register", id, name, settings, values}
//   core -> mod   {umm:1, t:"hello"}              (re-announce -> resend register)
//   core -> mod   {umm:1, t:"set", id, key, value}
// Right after a register the core replays its session values as `set`; a returning
// player's saved values arrive later, in its restore, as `set` too - only for mods
// registered by then (umm_core.js:1365-1389). We just apply what we're told. With
// UMM installed the first register waits up to SEED_WAIT_SEC for our stored values
// (one-time migration, spec §8.1).
// The manifest is built from QolLiteMapSchema; widget values are in shown units.
var QolLiteMapUmmAdapter = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var PROTOCOL = 1;
    var MOD_ID = "bettermap";
    var MOD_NAME = "BetterMap";
    var UMM_ROOT_ID = "UmmRoot";   // UMM's base_hud.xml / base_dashboard.xml (qollite_map_store.js checks it too)
    // A seed needs two page loads: `ready` (~1 s after HUD init, run 3) plus one
    // reload per request for the get - so ~1-2 s, not measured as a pair. The risk
    // is asymmetric: a missed seed is harmless (retried next launch from our
    // untouched record), but a register that lands after UMM's restore misses UMM's
    // saved values for that session (restore skips unregistered mods,
    // umm_core.js:1370), and a Save would then overwrite them. So the bound is kept
    // short on purpose; in-game run 2 logs the order (spec §8.1).
    var SEED_WAIT_SEC = 2;

    var _present = false;
    var _waitingSeed = false;

    function _root() { var r = $.GetContextPanel(); while (r && r.GetParent()) { r = r.GetParent(); } return r; }

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
            // Standalone settings (the colours) are not UMM's (spec C4, owner): no widget, no
            // value, and no group header for them.
            if (e.standalone) { continue; }
            // UMM's widgets are toggle / slider / select / checks (docs/knowledge/umm_integration.md):
            // any other type would go out without a range, so it is refused, not guessed.
            if (e.type !== "toggle" && e.type !== "slider") {
                QolLiteMapLog.error("umm: no UMM widget for type \"" + e.type + "\" (" + e.key + ") - not registered");
                continue;
            }
            if (e.group !== group) { group = e.group; settings.push({ type: "group", label: group }); }
            var w = { id: e.umm, type: e.type, label: e.label };
            if (e.type === "slider") { w.min = e.min; w.max = e.max; w.step = e.step; w.unit = e.unit; }
            // UMM's reset button restores `default` (umm_core.js createToggle/
            // createSlider/createSelect), so it must be the factory value - the
            // live value would make a re-register (on `hello`) redefine "reset".
            w["default"] = QolLiteMapSchema.toShown(e, defaults[e.key]);
            settings.push(w);
            values[e.umm] = QolLiteMapSchema.toShown(e, state[e.key]);
        }
        _send({ umm: PROTOCOL, t: "register", id: MOD_ID, name: MOD_NAME, settings: settings, values: values });
    }

    function _onSet(id, value) {
        var e = QolLiteMapSchema.byUmmId(id);
        if (!e) { return; }   // e.g. "poiLevelAuto" from an older manifest: retired 2026-10-01
        var stored = QolLiteMapSchema.sanitize(e.key, QolLiteMapSchema.isRanged(e) ? Number(value) / e.scale : value);
        if (stored === undefined) { QolLiteMapLog.log("umm: ignored invalid " + id + " = " + value); return; }
        var patch = {};
        patch[e.key] = stored;
        QolLiteMapState.patch(patch);
        // Only what this key affects: a UMM slider drag sends a set per step.
        QolLiteMapApply.key(e.key);
        QolLiteMapLog.log("umm: set " + id + " = " + value);
    }

    function _markPresent() {
        if (_present) { return; }
        _present = true;
        QolLiteMapLog.info("umm: core present - settings and saving go through UMM");
        // While the seed read runs, the store turns itself off when it answers.
        if (!_waitingSeed) { QolLiteMapStore.disable("UMM core answered", true); }
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

    // No seed in time: register with what we have, and stop the store's read -
    // nobody would use its answer.
    function _seedTimeout() {
        if (!_waitingSeed) { return; }
        QolLiteMapStore.disable("UMM registered without a seed", true);
        _endSeed("no stored values within " + SEED_WAIT_SEC + " s");
    }

    // Spec §8.1 (one-time migration): the standalone values become the first
    // register's `values`. UMM still prefers what it saved itself: its restore
    // overrides them, and a value already in its session beats a register
    // (umm_core.js:1810-1811). values: sanitised stored values, or null.
    // The seed runs on every HUD init while UMM is installed, not once. For the colours
    // (standalone, spec C4: not in UMM's manifest) it is the every-session source: a
    // "seed only once" change would silently reset the colours under UMM to defaults.
    function seed(values) {
        if (!_waitingSeed) {
            QolLiteMapLog.info("umm: seed ignored - already registered (a late store read is logged as store: off - UMM registered without a seed)");
            return;
        }
        var n = 0;
        if (values) {
            for (var k in values) { if (Object.prototype.hasOwnProperty.call(values, k)) { n++; } }
            QolLiteMapState.patch(values);
            // A throwing feature must not skip the register.
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
