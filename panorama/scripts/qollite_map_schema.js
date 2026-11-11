// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_schema.js
"use strict";

var QolLiteMapSchema = (function () {
    var LIMITS = {
        minimapSizeMinPx: 200, minimapSizeMaxPx: 800, minimapSizeStepPx: 20,
        minimapSizeNativePx: 400,
        tabMapSizeMinPx: 400, tabMapSizeMaxPx: 1000,
        iconScaleMinPct: 50, iconScaleMaxPct: 200, iconScaleStepPct: 10,
        rotateMapMaxDrawnPx: 720,
        mapDrawnNativePx: 360,
        iconFitStepPct: 2
    };

    function _fitGrid(lo, hi) {
        var step = LIMITS.iconFitStepPct;
        return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step: step };
    }
    var _DRAWN_TO_SIZE = LIMITS.mapDrawnNativePx / LIMITS.minimapSizeNativePx;
    var _DRAWN_MIN = LIMITS.minimapSizeMinPx * _DRAWN_TO_SIZE;
    var _DRAWN_MAX = LIMITS.tabMapSizeMaxPx * _DRAWN_TO_SIZE;
    var ICON_FIT = _fitGrid(LIMITS.iconScaleMinPct * LIMITS.mapDrawnNativePx / _DRAWN_MAX,
                            LIMITS.iconScaleMaxPct * LIMITS.mapDrawnNativePx / _DRAWN_MIN);
    var MAP_FIT = _fitGrid(100 * LIMITS.mapDrawnNativePx / _DRAWN_MAX, 100 * LIMITS.mapDrawnNativePx / _DRAWN_MIN);
    var MAP = "Minimap";
    var ICONS = "Minimap Icons";
    var OBJECTS = "Map Objects";

    var GROUPS = [
        { name: MAP, id: "bettermap_minimap", sfx: "minimap", title: "Minimap" },
        { name: ICONS, id: "bettermap_icons", sfx: "icons", title: "Minimap Icons" },
        { name: OBJECTS, id: "bettermap_objects", sfx: "objects", title: "Map Objects" }
    ];

    var SECTION = { id: "bettermap_section", title: "Minimap" };

    function _icon(key, label, umm, tooltip, icon) {
        return { key: key, group: ICONS, type: "slider", label: label, def: 100,
                 min: LIMITS.iconScaleMinPct, max: LIMITS.iconScaleMaxPct, step: LIMITS.iconScaleStepPct,
                 unit: "%", scale: 1, umm: umm, tooltip: tooltip, icon: icon };
    }

    function _color(key, row, label, def, what) {
        return { key: key, group: OBJECTS, type: "color", row: row, label: label, def: def,
                 min: 0, max: 100, step: 1, scale: 100, standalone: true,
                 tooltip: "Drag the palette to choose the color of the " + what + "." };
    }

    function _sizes(lo, hi, step) {
        var out = [];
        for (var px = lo; px <= hi; px += step) { out.push(px); }
        return out;
    }

    var SETTINGS = [
        { key: "minimapSizePx", group: MAP, type: "slider", label: "Minimap Size", def: 400,
          min: LIMITS.minimapSizeMinPx, max: LIMITS.minimapSizeMaxPx, step: LIMITS.minimapSizeStepPx,
          unit: "px", scale: 1, umm: "ms",
          tooltip: "Width and height of the minimap on screen.",
          mapScale: { cls: "bm_mapsize_", native: LIMITS.minimapSizeNativePx,
                      extra: _sizes(LIMITS.minimapSizeMaxPx + LIMITS.minimapSizeStepPx, LIMITS.tabMapSizeMaxPx, LIMITS.minimapSizeStepPx),
                      engine: [".map_button.ability_castrange #CastRange"] },
          mapFit: { cls: "bm_fit_", engine: [".map_button.gold_dropping"],
                    min: MAP_FIT.min, max: MAP_FIT.max, step: MAP_FIT.step } },
        { key: "minimapOffsetX", group: MAP, type: "slider", label: "Horizontal Offset", def: 0,
          min: -100, max: 100, step: 5, unit: "%", scale: 100, umm: "ox",
          tooltip: "Moves the minimap left from the bottom-right corner. 100% reaches the left edge; negative values push it past the right edge, at most halfway." },
        { key: "minimapOffsetY", group: MAP, type: "slider", label: "Vertical Offset", def: 0,
          min: -100, max: 100, step: 5, unit: "%", scale: 100, umm: "oy",
          tooltip: "Moves the minimap up from the bottom-right corner. 100% reaches the top edge; negative values push it past the bottom edge, at most halfway." },
        { key: "mapOpacity", group: MAP, type: "slider", label: "Map Opacity", def: 0.95,
          min: 10, max: 100, step: 5, unit: "%", scale: 100, umm: "mo",
          tooltip: "Opacity of the minimap, its markers and backdrop included." },
        { key: "minimalMap", group: MAP, type: "toggle", label: "Minimalist Minimap", def: false,
          umm: "mm",
          tooltip: "Hides the minimap frame and decorations and keeps only the map and its markers." },
        { key: "hudFullWidth", group: MAP, type: "toggle", label: "Full-Width HUD", def: false,
          umm: "fw",
          tooltip: "On ultrawide screens, lets the minimap use the full screen width instead of the game's 21:9 limit." },
        { key: "locationLabelScalePct", group: MAP, type: "slider", label: "Location Label Size", def: 100,
          min: LIMITS.iconScaleMinPct, max: LIMITS.iconScaleMaxPct, step: LIMITS.iconScaleStepPct,
          unit: "%", scale: 1, umm: "ll",
          tooltip: "Size of the district name shown next to the minimap." },
        { key: "tabMapEnabled", group: MAP, type: "toggle", label: "Larger Map on TAB", def: false,
          umm: "tz",
          tooltip: "While TAB is held, shows the minimap in the center of the screen at its own size and opacity." },
        { key: "tabMapSizePx", group: MAP, type: "slider", label: "TAB Map Size", def: 800,
          min: LIMITS.tabMapSizeMinPx, max: LIMITS.tabMapSizeMaxPx, step: LIMITS.minimapSizeStepPx,
          unit: "px", scale: 1, umm: "ts",
          tooltip: "Width and height of the minimap while TAB is held." },
        { key: "tabMapOpacity", group: MAP, type: "slider", label: "TAB Map Opacity", def: 1,
          min: 10, max: 100, step: 5, unit: "%", scale: 100, umm: "to",
          tooltip: "Opacity of the minimap while TAB is held, its markers and backdrop included." },
        { key: "rotateMapEnabled", group: MAP, type: "toggle", label: "Rotating Minimap", def: false,
          umm: "rm",
          tooltip: "Turns the minimap with your view: your icon stays in the center pointing up. TAB, Alt and map-aimed abilities show the normal map.",
          turn: { cls: "bm_rot_", stepDeg: 5, engine: [".map_button", ".bm_urn"],
                  exclude: [".map_button.localplayer", ".client_cone_fov", ".map_button.guided_arrow"] } },
        { key: "rotateMapZoomPct", group: MAP, type: "slider", label: "Rotating Minimap Zoom", def: 200,
          min: 100, max: 200, step: 25, unit: "%", scale: 1, umm: "rz",
          tooltip: "How close the rotating minimap is zoomed in. 100% shows the whole map; a larger Minimap Size allows less zoom." },
        _icon("selfIconScalePct", "Your Icon Size", "is",
              "Size of your own hero's icon on the minimap, relative to the game's size.",
              { cls: "bm_size_self_", engine: [".map_button.player.friend.localplayer"], always: true, zoomAside: true,
                fit: ICON_FIT }),
        _icon("allyIconScalePct", "Ally Icon Size", "ia",
              "Size of your allies' hero icons on the minimap, relative to the game's size.",
              { cls: "bm_size_ally_", engine: [".map_button.player.friend"], zoomAside: true, fit: ICON_FIT }),
        _icon("enemyIconScalePct", "Enemy Icon Size", "ie",
              "Size of the enemy hero icons on the minimap, relative to the game's size.",
              { cls: "bm_size_enemy_", engine: [".map_button.player.enemy"], zoomAside: true, fit: ICON_FIT }),
        _icon("towerIconScalePct", "Tower Icon Size", "it",
              "Size of the towers and the other lane objectives on the minimap.",
              { cls: "bm_size_tower_", engine: [".map_button.boss_icon_t1", ".map_button.boss_icon_t2",
                ".map_button.boss_icon_t3", ".map_button.boss_barracks_icon", ".map_button.boss_buildingzip"] }),
        _icon("shopIconScalePct", "Shop Icon Size", "ih",
              "Size of the shop icons on the minimap. The broker keeps the game's size.",
              { cls: "bm_size_shop_", engine: [".map_button.tier1_shop"],
                exclude: [".map_button.tier1_shop.corrupted_item_shop"] }),
        _icon("runeIconScalePct", "Rune Icon Size", "ir",
              "Size of the rune (power-up) icons on the minimap.",
              { cls: "bm_size_rune_", engine: [".map_button.powerup_spawn"] }),
        _icon("urnIconScalePct", "Urn Icon Size", "iu",
              "Size of the urn icon on the minimap, and of the Urn Spawn Tracker's marker.",
              { cls: "bm_size_urn_", engine: [".map_button.idol_spawn", ".map_button.idol_dropping"], own: [".bm_urn"] }),
        { key: "poiCratesEnabled", group: OBJECTS, type: "toggle", label: "Show Crates", def: false,
          umm: "pc",
          tooltip: "Shows breakable crates on the minimap." },
        _color("poiCrateColor", "poiCratesEnabled", "Crate Color", 0.57, "crates"),
        { key: "poiStatuesEnabled", group: OBJECTS, type: "toggle", label: "Show Golden Statues", def: false,
          umm: "ps",
          tooltip: "Shows golden statues on the minimap." },
        _color("poiStatueColor", "poiStatuesEnabled", "Golden Statue Color", 0.2, "golden statues"),
        { key: "poiToughEnabled", group: OBJECTS, type: "toggle", label: "Show Tough Crates", def: false,
          umm: "pt",
          tooltip: "Shows tough crates, which need heavy melee and drop extra gold." },
        _color("poiToughColor", "poiToughEnabled", "Tough Crate Color", 0.36, "tough crates"),
        { key: "poiApplesEnabled", group: OBJECTS, type: "toggle", label: "Show Healing Apples", def: false,
          umm: "pa",
          tooltip: "Shows the floating healing apples on the minimap." },
        _color("poiAppleColor", "poiApplesEnabled", "Healing Apple Color", 0.08, "healing apples"),
        { key: "poiFrom3Min", group: OBJECTS, type: "toggle", label: "Show Only Spawned Objects", def: true,
          umm: "p3",
          tooltip: "Hides each object until its spawn time (3:00, 5:00 or 10:00)." },
        { key: "poiMarkerSizePx", group: OBJECTS, type: "slider", label: "Marker Size", def: 3,
          min: 1, max: 8, step: 1, unit: "px", scale: 1, umm: "pz",
          tooltip: "Size of the object markers." },
        { key: "poiOpacity", group: OBJECTS, type: "slider", label: "Marker Opacity", def: 0.8,
          min: 10, max: 100, step: 5, unit: "%", scale: 100, umm: "po",
          tooltip: "Opacity of the object markers." },
        { key: "urnTrackerEnabled", group: OBJECTS, type: "toggle", label: "Urn Spawn Tracker", def: false,
          umm: "ut",
          tooltip: "Predicts where the urn spawns and shows it on the minimap. Off by default." }
    ];

    var _byKey = null;
    var _byUmm = null;
    var _icons = null;

    function _index() {
        if (_byKey) { return; }
        _byKey = {};
        _byUmm = {};
        _icons = [];
        for (var i = 0; i < SETTINGS.length; i++) {
            _byKey[SETTINGS[i].key] = SETTINGS[i];
            if (SETTINGS[i].umm) { _byUmm[SETTINGS[i].umm] = SETTINGS[i]; }
            if (SETTINGS[i].icon) { _icons.push(SETTINGS[i]); }
        }
    }

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

    function list() { return SETTINGS; }
    function groups() { return GROUPS; }
    function section() { return SECTION; }
    function iconEntries() { _index(); return _icons; }
    function byKey(key) { _index(); return _own(_byKey, key) ? _byKey[key] : null; }
    function byUmmId(id) { _index(); return _own(_byUmm, id) ? _byUmm[id] : null; }

    function fitSnap(fit, value) {
        var v = fit.min + Math.round((value - fit.min) / fit.step) * fit.step;
        return Math.max(fit.min, Math.min(fit.max, v));
    }

    function defaults() {
        var d = {};
        for (var i = 0; i < SETTINGS.length; i++) { d[SETTINGS[i].key] = SETTINGS[i].def; }
        return d;
    }

    function _snapShown(e, shown) {
        var s = Math.round((shown - e.min) / e.step) * e.step + e.min;
        return Math.max(e.min, Math.min(e.max, s));
    }

    function isRanged(e) { return e.type === "slider" || e.type === "color"; }

    function toShown(e, stored) {
        return isRanged(e) ? _snapShown(e, Number(stored) * e.scale) : stored;
    }

    function fromShown(e, shown) {
        return isRanged(e) ? _snapShown(e, Number(shown)) / e.scale : shown;
    }

    function sanitize(key, value) {
        var e = byKey(key);
        if (!e) { return undefined; }
        if (e.type === "toggle") { return typeof value === "boolean" ? value : undefined; }
        if (typeof value !== "number" || !isFinite(value)) { return undefined; }
        return fromShown(e, value * e.scale);
    }

    return {
        LIMITS: LIMITS, list: list, groups: groups, section: section, iconEntries: iconEntries, byKey: byKey, fitSnap: fitSnap,
        byUmmId: byUmmId, isRanged: isRanged, defaults: defaults, toShown: toShown, fromShown: fromShown,
        sanitize: sanitize
    };
})();
