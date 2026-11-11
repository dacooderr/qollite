// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_log.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsLog = (function () {
    var DEBUG = false;
    var TAG = "[NOTIF] ";
    return {
        DEBUG: DEBUG,
        info:  function (m) { $.Msg(TAG + m); },
        error: function (m) { $.Msg(TAG + "ERROR: " + m); },
        log:   function (m) { if (DEBUG) { $.Msg(TAG + m); } }
    };
})();
