// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/event_schedule.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsEventSchedule = [
    { id: "weak_camps",        initialTime: 120, repeatInterval: null, defaultEnabled: true },
    { id: "breakables",        initialTime: 180, repeatInterval: null, defaultEnabled: true },
    { id: "medium_camps",      initialTime: 300, repeatInterval: null, defaultEnabled: true },
    { id: "bridge_buffs",      initialTime: 300, repeatInterval: 300,  defaultEnabled: true },
    { id: "strong_camps",      initialTime: 480, repeatInterval: null, defaultEnabled: true },
    { id: "sinners_sacrifice", initialTime: 480, repeatInterval: null, defaultEnabled: true },
    { id: "soul_urn",          initialTime: 600, repeatInterval: null, warnOnly: true, defaultEnabled: true }
];
