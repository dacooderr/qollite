// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_manager.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsManager = (function () {
    var root = null;
    var toast = null;
    var items = {};
    var done = {};
    var _lastTitle = null, _lastSub = null;
    var _sweeping = false;

    function now() { return Date.now(); }
    function life() { return QolLiteNotificationsConfig.durationSecs * 1000; }

    function getRoot() {
        if (root && root.IsValid && root.IsValid()) { return root; }
        var p = $.GetContextPanel(), guard = 0;
        while (p && p.GetParent && p.GetParent() && guard < 64) { p = p.GetParent(); guard++; }
        root = (p && p.FindChildTraverse) ? p.FindChildTraverse("NotificationRoot") : null;
        return root;
    }

    function ensureToast() {
        if (toast && toast.panel && toast.panel.IsValid && toast.panel.IsValid()) { return toast; }
        var r = getRoot();
        if (!r) { QolLiteNotificationsLog.error("manager: no #NotificationRoot"); return null; }
        var p = $.CreatePanel("Panel", r, "");
        p.AddClass("GenericAnnouncement");
        p.hittest = false;
        var t = $.CreatePanel("Label", p, ""); t.AddClass("AnnouncementTitle");
        var d = $.CreatePanel("Label", p, ""); d.AddClass("AnnouncementDescription");
        toast = { panel: p, titleLabel: t, descLabel: d };
        _lastTitle = _lastSub = null;
        $.Schedule(0.03, function () { if (p.IsValid()) { p.AddClass("NotifVisible"); } });
        return toast;
    }

    function hideToast() {
        if (toast && toast.panel && toast.panel.IsValid()) {
            var p = toast.panel;
            p.AddClass("NotifExpired");
            $.Schedule(0.4, function () { if (p.IsValid()) { p.DeleteAsync(0); } });
        }
        toast = null; _lastTitle = _lastSub = null;
    }

    function render() {
        var keys = [], anySpawn = false, minWarn = null, minDescent = null, k;
        for (k in items) {
            if (!items.hasOwnProperty(k)) { continue; }
            keys.push(k);
            var ph = items[k].phase;
            if (ph === "spawn") { anySpawn = true; }
            else if (ph === "descent") { if (items[k].seconds != null && (minDescent === null || items[k].seconds < minDescent)) { minDescent = items[k].seconds; } }
            else if (items[k].seconds != null && (minWarn === null || items[k].seconds < minWarn)) { minWarn = items[k].seconds; }
        }
        if (!keys.length) { hideToast(); return; }

        var titles = [];
        for (var i = 0; i < keys.length; i++) { titles.push(items[keys[i]].title); }
        var title = titles.length <= 2 ? titles.join(" & ") : titles.join(", ");
        var sub;
        if (minDescent !== null) { sub = QolLiteNotificationsStrings.sub("descent", minDescent); }
        else if (anySpawn) { sub = QolLiteNotificationsStrings.sub("spawn"); }
        else { sub = QolLiteNotificationsStrings.sub("warn", minWarn == null ? 0 : minWarn); }

        var tt = ensureToast();
        if (!tt) { return; }
        if (title !== _lastTitle) { _lastTitle = title; try { tt.titleLabel.text = title; } catch (e) {} }
        if (sub !== _lastSub) { _lastSub = sub; try { tt.descLabel.text = sub; } catch (e) {} }
    }

    function sweep() {
        _sweeping = false;
        var n = now(), changed = false, has = false, k;
        for (k in items) {
            if (!items.hasOwnProperty(k)) { continue; }
            var it = items[k];
            if (it.expireAt && n >= it.expireAt) {
                if (it.phase === "warn") { done[k] = true; QolLiteNotificationsLog.log("warn hidden: " + it.title); }
                delete items[k]; changed = true; continue;
            }
            has = true;
        }
        if (changed) { render(); }
        if (has) { schedule(); }
    }
    function schedule() { if (!_sweeping) { _sweeping = true; $.Schedule(0.25, sweep); } }

    var _lastSoundMs = 0;
    function playSound() {
        if (!QolLiteNotificationsConfig.soundEnabled || !QolLiteNotificationsConfig.soundEvent) { return; }
        var n = now();
        if (n - _lastSoundMs < 300) { return; }
        _lastSoundMs = n;
        try { $.DispatchEvent("PlaySoundEffect", QolLiteNotificationsConfig.soundEvent); } catch (e) {}
    }

    return {
        init: function () {
            var r = getRoot();
            if (r) { r.RemoveAndDeleteChildren(); }
            else { QolLiteNotificationsLog.error("manager: #NotificationRoot not found"); }
            toast = null; items = {}; done = {}; _lastTitle = _lastSub = null;
        },

        clearAll: function () { items = {}; done = {}; hideToast(); },

        countdown: function (key, title, seconds) {
            if (done[key]) { return; }
            var it = items[key];
            if (it && it.phase === "warn") {
                it.title = title; it.seconds = seconds;
            } else if (!it) {
                items[key] = { title: title, phase: "warn", seconds: seconds, expireAt: now() + life() };
                QolLiteNotificationsLog.log("warn shown: " + title + " (hides in " + QolLiteNotificationsConfig.durationSecs + "s)");
            } else {
                return;
            }
            render(); schedule();
        },

        descent: function (key, title, seconds) {
            var it = items[key];
            var fresh = !it || it.phase !== "descent";
            items[key] = { title: title, phase: "descent", seconds: seconds, expireAt: now() + 2000 };
            if (fresh) { QolLiteNotificationsLog.log("descent: " + title + " (" + seconds + "s)"); }
            render(); schedule();
        },

        spawn: function (key, title) {
            var fresh = !items[key] || items[key].phase !== "spawn";
            items[key] = { title: title, phase: "spawn", seconds: null, expireAt: now() + life() };
            if (fresh) { QolLiteNotificationsLog.log("spawn: " + title); playSound(); }
            render(); schedule();
        }
    };
})();
