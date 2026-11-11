// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_clock.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsClock = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var last = null;
    var lastAtMs = 0;
    var STALE_MS = 3000;

    function onMessage(payload) {
        var d = null;
        try { d = JSON.parse(payload); } catch (e) { return; }
        if (!d || d.notif !== 1 || d.type !== "clock") { return; }
        last = d.t;
        lastAtMs = Date.now();
    }

    return {
        init: function () {
            try { $.RegisterForUnhandledEvent(CHANNEL, onMessage); }
            catch (e) { QolLiteNotificationsLog.error("clock: bus register failed: " + e); }
            QolLiteNotificationsLog.info("clock: receiver registered on bus");
        },
        getMatchTime: function () {
            if (last === null) { return null; }
            if (Date.now() - lastAtMs > STALE_MS) { return null; }
            return last;
        }
    };
})();
