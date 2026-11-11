// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_clock_bridge.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsClockBridge = (function () {
    var CHANNEL = "ClientUI_FireOutput";

    function label() {
        var c = $.GetContextPanel();
        return (c && c.FindChildTraverse) ? c.FindChildTraverse("GameTime") : null;
    }
    function parse(text) {
        if (!text) { return null; }
        text = String(text).replace(/<[^>]+>/g, "");
        var m = text.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
        if (!m) { return null; }
        var h = m[1] ? parseInt(m[1], 10) : 0;
        return h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    }

    function walk(p) { var g = 0; while (p && p.GetParent && p.GetParent() && g < 64) { p = p.GetParent(); g++; } return p; }

    function inHideout() {
        var ctx = $.GetContextPanel();
        var names = ["connectedToHideout", "connectedtohideout", "connectedToHideOut"];
        var i;
        try {
            if (ctx && ctx.BAscendantHasClass) {
                for (i = 0; i < names.length; i++) { if (ctx.BAscendantHasClass(names[i])) { return true; } }
            }
        } catch (e) {}
        try {
            var hud = walk(ctx);
            hud = hud && hud.FindChildTraverse ? (hud.FindChildTraverse("Hud") || hud) : hud;
            if (hud && hud.BHasClass) {
                for (i = 0; i < names.length; i++) { if (hud.BHasClass(names[i])) { return true; } }
            }
        } catch (e) {}
        return false;
    }

    function isStreetBrawl() {
        var ctx = $.GetContextPanel();
        try { if (ctx && ctx.BAscendantHasClass && ctx.BAscendantHasClass("gamemode_streetbrawl")) { return true; } } catch (e) {}
        try {
            var hud = walk(ctx);
            hud = hud && hud.FindChildTraverse ? (hud.FindChildTraverse("Hud") || hud) : hud;
            if (hud && hud.BHasClass && hud.BHasClass("gamemode_streetbrawl")) { return true; }
        } catch (e) {}
        return false;
    }

    function suppressReason() {
        if (inHideout()) { return "hideout"; }
        if (isStreetBrawl()) { return "streetbrawl"; }
        return "";
    }

    var _wasSuppress = null;
    function loop() {
        var reason = suppressReason();
        if (reason !== _wasSuppress) { _wasSuppress = reason; $.Msg("[NOTIF][bridge] suppress=" + (reason || "none")); }

        if (!reason) {
            var l = label();
            if (l) {
                var t = parse(l.text);
                if (t !== null) {
                    try { $.DispatchEvent(CHANNEL, JSON.stringify({ notif: 1, type: "clock", t: t })); } catch (e) {}
                }
            }
        }
        $.Schedule(0.25, loop);
    }

    function detectLang() {
        try { if (typeof $ !== "undefined" && $.Language) { var v = $.Language(); if (v) { return String(v); } } } catch (e) {}
        var ctx = null;
        try { ctx = $.GetContextPanel(); } catch (e) {}
        var langs = ["russian", "schinese", "tchinese", "koreana", "japanese", "spanish", "latam",
                     "german", "french", "italian", "polish", "portuguese", "brazilian", "ukrainian", "turkish"];
        for (var i = 0; i < langs.length; i++) {
            try { if (ctx && ctx.BAscendantHasClass && ctx.BAscendantHasClass("Language_" + langs[i])) { return langs[i]; } } catch (e) {}
        }
        return "english";
    }

    function announceLang(times) {
        var lang = detectLang();
        try { $.DispatchEvent(CHANNEL, JSON.stringify({ notif: 1, type: "lang", lang: lang })); } catch (e) {}
        if (times > 0) { $.Schedule(1.0, function () { announceLang(times - 1); }); }
    }

    return { start: function () { loop(); announceLang(4); } };
})();
QolLiteNotificationsClockBridge.start();
