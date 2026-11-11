// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_umm.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsUmmAdapter = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var PROTOCOL = 1;
    var MOD_ID = "eventnotifier";
    var MOD_NAME = "Map Event Reminders";

    var SCHEMA = [
        { id: "enabled",     type: "toggle", label: "Enable Notifications", key: "enabled" },
        { id: "showSpawn",   type: "toggle", label: "Notify On Spawn",      key: "showSpawn" },
        { id: "showWarning", type: "toggle", label: "Notify Before Spawn",  key: "showWarning" },
        {
            id: "warnSecs", type: "select", label: "Warn Ahead", key: "warnSecs",
            options: [
                { label: "5 seconds",  value: 5 },
                { label: "10 seconds", value: 10 },
                { label: "15 seconds", value: 15 },
                { label: "30 seconds", value: 30 }
            ],
            coerce: function (v) { return Number(v); }
        },
        { id: "soundEnabled", type: "toggle", label: "Sound", key: "soundEnabled" }
    ];

    (function () {
        var EVENTS = [
            ["weak_camps", "Weak Camps"], ["breakables", "Crates & Statues"],
            ["medium_camps", "Medium Camps"], ["bridge_buffs", "Bridge Buffs"],
            ["strong_camps", "Strong Camps"], ["sinners_sacrifice", "Sinner's Sacrifice"],
            ["soul_urn", "Soul Urn"]
        ];
        SCHEMA.push({ id: "ev_group", type: "group", label: "Events" });
        for (var i = 0; i < EVENTS.length; i++) {
            (function (id, label) {
                SCHEMA.push({
                    id: "ev_" + id, type: "toggle", label: label,
                    get: function () { return !QolLiteNotificationsConfig.events || QolLiteNotificationsConfig.events[id] !== false; },
                    set: function (v) { if (!QolLiteNotificationsConfig.events) { QolLiteNotificationsConfig.events = {}; } QolLiteNotificationsConfig.events[id] = !!v; }
                });
            })(EVENTS[i][0], EVENTS[i][1]);
        }
    })();

    var _present = false;

    function _value(entry) { return entry.get ? entry.get() : QolLiteNotificationsConfig[entry.key]; }

    function _send(payload) { try { $.DispatchEvent(CHANNEL, JSON.stringify(payload)); } catch (e) {} }

    function _register() {
        var settings = [], values = {};
        for (var i = 0; i < SCHEMA.length; i++) {
            var e = SCHEMA[i];
            var w = { id: e.id, type: e.type, label: e.label };
            if (e.type === "group") { settings.push(w); continue; }
            if (e.type === "select") { w.options = e.options; }
            var v = _value(e);
            w["default"] = v;
            settings.push(w);
            values[e.id] = v;
        }
        _send({ umm: PROTOCOL, t: "register", id: MOD_ID, name: MOD_NAME, settings: settings, values: values });
    }

    function _entry(id) {
        for (var i = 0; i < SCHEMA.length; i++) { if (SCHEMA[i].id === id) { return SCHEMA[i]; } }
        return null;
    }

    function _onSet(key, value) {
        var e = _entry(key);
        if (!e) { return; }
        var v = e.coerce ? e.coerce(value) : value;
        if (e.set) { e.set(v); } else { QolLiteNotificationsConfig[e.key] = v; }
        if (!QolLiteNotificationsConfig.enabled && typeof QolLiteNotificationsManager !== "undefined") { QolLiteNotificationsManager.clearAll(); }
        QolLiteNotificationsLog.log("umm: set " + key + " = " + v);
    }

    function _markPresent() {
        if (_present) { return; }
        _present = true;
        QolLiteNotificationsLog.info("umm: core present - settings hosted in UMM");
    }

    function _onMessage(payload) {
        if (typeof payload !== "string" || payload.indexOf("\"umm\"") === -1) { return; }
        var msg;
        try { msg = JSON.parse(payload); } catch (e) { return; }
        if (!msg || msg.umm !== PROTOCOL) { return; }

        if (msg.t === "hello") { _markPresent(); _register(); }
        else if (msg.t === "set" && msg.id === MOD_ID) { _markPresent(); _onSet(msg.key, msg.value); }
    }

    function init() {
        try { $.RegisterForUnhandledEvent(CHANNEL, _onMessage); } catch (e) {}
        _register();
    }

    return { init: init };
})();
