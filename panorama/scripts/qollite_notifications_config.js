// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders) @ 12e6b3b, mod/panorama/scripts/notif_config.js.
// Our own mod: edit upstream and re-bundle; changes made only here are lost.
"use strict";
var QolLiteNotificationsConfig = {
    enabled: true,
    showSpawn: true,
    showWarning: true,
    warnSecs: 15,

    soundEnabled: true,
    soundEvent: "UI.RevealVote",

    events: {
        weak_camps: true,
        breakables: true,
        medium_camps: true,
        bridge_buffs: true,
        strong_camps: true,
        sinners_sacrifice: true,
        soul_urn: true
    },

    durationSecs: 6,
    graceSecs: 5,
    debugSchedule: false
};
