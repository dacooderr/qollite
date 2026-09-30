// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_strings.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost. Transformation
// (renames, ASCII escaping, deltas) is recorded in docs/BUNDLE.md. docs/ paths in comments
// below refer to the upstream repo.
"use strict";
// Localized text, separated from logic. Event titles come from name(id); the status
// sub-line from sub(). The player's language is detected via $.Language (a context-
// independent global) with a Language_<lang> ancestor-class fallback; the HUD-context
// bridge also broadcasts the language over the bus in case the overlay can't see it.
// Unknown languages fall back to English. Add a table below to support a new language.
var QolLiteNotificationsStrings = (function () {
    var CHANNEL = "ClientUI_FireOutput";

    var TABLES = {
        english: {
            available: "Available now",
            warning:   "Spawning in {seconds}s",
            landing:   "Landing in {seconds}s",
            names: {
                weak_camps: "Weak Camps", breakables: "Crates & Statues",
                medium_camps: "Medium Camps", bridge_buffs: "Bridge Buffs",
                strong_camps: "Strong Camps", sinners_sacrifice: "Sinner's Sacrifice",
                soul_urn: "Soul Urn"
            }
        },
        russian: {
            available: "\u0423\u0436\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e",
            warning:   "\u041f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0447\u0435\u0440\u0435\u0437 {seconds}\u0441",
            landing:   "\u041f\u0440\u0438\u0437\u0435\u043c\u043b\u0435\u043d\u0438\u0435 \u0447\u0435\u0440\u0435\u0437 {seconds}\u0441",
            names: {
                weak_camps: "\u0421\u043b\u0430\u0431\u044b\u0435 \u043b\u0430\u0433\u0435\u0440\u044f",
                breakables: "\u042f\u0449\u0438\u043a\u0438 \u0438 \u0441\u0442\u0430\u0442\u0443\u0438",
                medium_camps: "\u0421\u0440\u0435\u0434\u043d\u0438\u0435 \u043b\u0430\u0433\u0435\u0440\u044f",
                bridge_buffs: "\u0411\u0430\u0444\u044b \u043c\u043e\u0441\u0442\u0430",
                strong_camps: "\u0421\u0438\u043b\u044c\u043d\u044b\u0435 \u043b\u0430\u0433\u0435\u0440\u044f",
                sinners_sacrifice: "\u0416\u0435\u0440\u0442\u0432\u0430 \u0433\u0440\u0435\u0448\u043d\u0438\u043a\u0430",
                soul_urn: "\u0423\u0440\u043d\u0430 \u0434\u0443\u0448"
            }
        }
    };

    var _lang = "english";

    function _table() { return TABLES[_lang] || TABLES.english; }

    function _set(l) {
        l = String(l || "").toLowerCase();
        if (TABLES[l] && l !== _lang) {
            _lang = l;
            if (typeof QolLiteNotificationsLog !== "undefined") { QolLiteNotificationsLog.info("strings: language = " + l); }
        }
    }

    // Best-effort local detection (overlay context). $.Language is a global, so it works
    // even though the overlay can't walk up to the Language_<lang> ancestor class.
    function _detectLocal() {
        try { if (typeof $ !== "undefined" && $.Language) { var v = $.Language(); if (v) { return String(v); } } } catch (e) {}
        var ctx = null;
        try { ctx = $.GetContextPanel(); } catch (e) {}
        for (var k in TABLES) {
            if (TABLES.hasOwnProperty(k) && k !== "english") {
                try { if (ctx && ctx.BAscendantHasClass && ctx.BAscendantHasClass("Language_" + k)) { return k; } } catch (e) {}
            }
        }
        return null;
    }

    return {
        init: function () {
            var local = _detectLocal();
            if (local) { _set(local); }
            // The HUD bridge may broadcast a more authoritative language; apply it.
            try {
                $.RegisterForUnhandledEvent(CHANNEL, function (payload) {
                    if (typeof payload !== "string" || payload.indexOf("\"lang\"") === -1) { return; }
                    var d; try { d = JSON.parse(payload); } catch (e) { return; }
                    if (d && d.notif === 1 && d.type === "lang") { _set(d.lang); }
                });
            } catch (e) {}
        },
        setLang: function (l) { _set(l); },
        // localized event title for a schedule id
        name: function (id) {
            var t = _table();
            return (t.names && t.names[id]) || TABLES.english.names[id] || id;
        },
        // status line; phase "warn" | "descent" | "spawn"
        sub: function (phase, seconds) {
            var t = _table();
            if (phase === "warn")    { return String(t.warning).replace("{seconds}", String(seconds)); }
            if (phase === "descent") { return String(t.landing).replace("{seconds}", String(seconds)); }
            return t.available;
        }
    };
})();
