// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_urn.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsUrnDetector = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var LIVE_CLASSES = ["idol_spawn", "idol_dropping", "idol_return", "idol_return_friendly", "idol_return_enemy"];

    function walk(p) { var g = 0; while (p && p.GetParent && p.GetParent() && g < 64) { p = p.GetParent(); g++; } return p; }
    function hudRoot() { return walk($.GetContextPanel()); }

    function isActive(p) {
        if (!p) { return false; }
        try {
            if (p.BHasClass && (p.BHasClass("active") || p.BHasClass("active_map_button"))) { return true; }
            var vis = p.style ? p.style.visibility : "";
            var op = p.style ? p.style.opacity : "";
            return !!(vis && vis !== "collapse" && op !== "0" && op !== "0.0");
        } catch (e) { return false; }
    }

    function anyActive(root, cls) {
        if (!root || !root.FindChildrenWithClassTraverse) { return false; }
        var found;
        try { found = root.FindChildrenWithClassTraverse(cls); } catch (e) { return false; }
        if (found) { for (var i = 0; i < found.length; i++) { if (isActive(found[i])) { return true; } } }
        return false;
    }

    function spawnActive(root) { return anyActive(root, "idol_spawn"); }
    function liveUrn(root) {
        for (var c = 0; c < LIVE_CLASSES.length; c++) { if (anyActive(root, LIVE_CLASSES[c])) { return true; } }
        return false;
    }

    var _wasLive = false;
    var _ready = true;
    var _loggedReach = false;

    function poll() {
        var root = hudRoot();

        if (!_loggedReach) {
            _loggedReach = true;
            var mm = (root && root.FindChildTraverse) ? root.FindChildTraverse("hud_minimap") : null;
            $.Msg("[NOTIF][urn] minimap reachable: hud_minimap=" + (mm ? "yes" : "no"));
        }

        var spawn = spawnActive(root);
        var live = liveUrn(root);

        if (spawn && _ready) {
            _ready = false;
            $.Msg("[NOTIF][urn] fresh urn spawn -> notify");
            try { $.DispatchEvent(CHANNEL, JSON.stringify({ notif: 1, type: "urn" })); } catch (e) {}
        }
        if (!live && _wasLive) { _ready = true; }
        _wasLive = live;

        $.Schedule(0.2, poll);
    }

    return { start: function () { poll(); } };
})();
QolLiteNotificationsUrnDetector.start();
