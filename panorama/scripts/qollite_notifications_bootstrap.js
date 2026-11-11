// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
(function () {
    function ready() {
        return typeof QolLiteNotificationsLog !== "undefined"
            && typeof QolLiteNotificationsConfig !== "undefined"
            && typeof QolLiteNotificationsStrings !== "undefined"
            && typeof QolLiteNotificationsEventSchedule !== "undefined"
            && typeof QolLiteNotificationsClock !== "undefined"
            && typeof QolLiteNotificationsScheduler !== "undefined"
            && typeof QolLiteNotificationsManager !== "undefined";
    }

    function safe(name, fn) {
        try { fn(); } catch (e) { $.Msg("[NOTIF] ERROR: init " + name + " threw: " + e); }
    }

    var _urnN = 0;
    var DESCENT_SEC = 12;

    function startUrnDescent(n) {
        var key = "urn_live_" + n;
        var t0g = QolLiteNotificationsClock.getMatchTime();
        var t0w = Date.now();
        (function step() {
            if (!QolLiteNotificationsConfig.enabled) { return; }
            var name = QolLiteNotificationsStrings.name("soul_urn");
            var gt = QolLiteNotificationsClock.getMatchTime();
            var elapsed = (gt !== null && t0g !== null) ? (gt - t0g) : ((Date.now() - t0w) / 1000);
            var remaining = Math.ceil(DESCENT_SEC - elapsed);
            if (remaining > 0 && (Date.now() - t0w) < 30000) {
                QolLiteNotificationsManager.descent(key, name, remaining);
                $.Schedule(0.25, step);
            } else {
                QolLiteNotificationsManager.spawn(key, name);
            }
        })();
    }

    function initUrnReceiver() {
        try {
            $.RegisterForUnhandledEvent("ClientUI_FireOutput", function (payload) {
                if (typeof payload !== "string" || payload.indexOf("\"urn\"") === -1) { return; }
                var d; try { d = JSON.parse(payload); } catch (e) { return; }
                if (!d || d.notif !== 1 || d.type !== "urn") { return; }
                if (!QolLiteNotificationsConfig.enabled || !QolLiteNotificationsConfig.showSpawn) { return; }
                if (QolLiteNotificationsConfig.events && QolLiteNotificationsConfig.events.soul_urn === false) { return; }
                _urnN++;
                startUrnDescent(_urnN);
            });
        } catch (e) { QolLiteNotificationsLog.error("urn receiver register failed: " + e); }
    }

    function init() {
        QolLiteNotificationsLog.info("bootstrap: all modules present, initializing");
        safe("strings", function () { QolLiteNotificationsStrings.init(); });
        safe("manager", function () { QolLiteNotificationsManager.init(); });
        safe("scheduler", function () { QolLiteNotificationsScheduler.init(); });
        safe("clock", function () { QolLiteNotificationsClock.init(); });
        safe("urn", function () { initUrnReceiver(); });
        if (typeof QolLiteNotificationsUmmAdapter !== "undefined") { safe("umm", function () { QolLiteNotificationsUmmAdapter.init(); }); }
        tick();
    }

    function tick() {
        try {
            var t = QolLiteNotificationsClock.getMatchTime();
            if (t !== null) { QolLiteNotificationsScheduler.tick(t); }
        } catch (e) { QolLiteNotificationsLog.error("tick threw: " + e); }
        $.Schedule(0.25, tick);
    }

    var tries = 0;
    (function wait() {
        if (ready()) { init(); return; }
        if (tries++ < 200) { $.Schedule(0.1, wait); }
        else { $.Msg("[NOTIF] ERROR: modules never became ready"); }
    })();
})();
