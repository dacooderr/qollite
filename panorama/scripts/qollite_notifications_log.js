// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_log.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost. Transformation
// (renames, ASCII escaping, deltas) is recorded in docs/BUNDLE.md. docs/ paths in comments
// below refer to the upstream repo.
"use strict";
// Logging layer (overlay context). info/error always print; log is gated behind
// DEBUG. Mirrors bettermap_log.js. Included first so later modules can use it.
var QolLiteNotificationsLog = (function () {
    var DEBUG = false; // QOL Lite delta: upstream ships true. log() only fires on
                       // state changes; info/error stay on. See docs/BUNDLE.md.
    var TAG = "[NOTIF] ";
    return {
        DEBUG: DEBUG,
        info:  function (m) { $.Msg(TAG + m); },
        error: function (m) { $.Msg(TAG + "ERROR: " + m); },
        log:   function (m) { if (DEBUG) { $.Msg(TAG + m); } }
    };
})();
