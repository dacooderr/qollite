// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_schema.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// The one list of BetterMap's player settings (spec
// docs/specs/2026-10-01-native-settings.md §3, changed by
// docs/specs/2026-10-01-minimap-icon-sizes.md §3). The order here is the row order
// in Valve's settings window. Everything else derives from this list:
// QolLiteMapState defaults, the UMM manifest, the settings-window subsections and rows
// (qollite_map_settings_mount.js builds them at runtime),
// the icon-size rules in hud_minimap.vcss (pipeline/build_minimap_styles.py), the
// popup bindings, and validation of stored and received values. A setting is
// added or changed here and nowhere else.
//
// Values are kept in stored units (what QolLiteMapState holds and the store saves).
// Ranges are in shown units, the numbers the player and UMM see:
// shown = stored * scale.
var QolLiteMapSchema = (function () {
    // Not player settings: limits that other modules read through QolLiteMapState.DEFAULTS.
    // minimapSizeNativePx: Valve's own minimap size (hud.css #minimap_container 400px).
    // minimapUltLargePx: the minimap size while a map ability is aimed (Mirage Traveler).
    var LIMITS = {
        minimapSizeMinPx: 200, minimapSizeMaxPx: 800, minimapSizeStepPx: 20,
        minimapSizeNativePx: 400, minimapUltLargePx: 750,
        iconScaleMinPct: 50, iconScaleMaxPct: 200, iconScaleStepPct: 10
    };
    var MAP = "Minimap";
    var ICONS = "Minimap Icons";
    // Renamed from "Crates & Statues" when the apples came (spec O1); ids and stored keys did not change.
    var OBJECTS = "Map Objects";

    // One subsection of Valve's settings window per group, in this order (spec I5).
    // C++ titles a subsection "#<id>" (no token exists, D7), so the mount sets `title`;
    // `sfx` names the subsection's show / reset rows (qollite_map_settings_mount.js).
    var GROUPS = [
        { name: MAP, id: "bettermap_minimap", sfx: "minimap", title: "Minimap (BetterMap by gfkm)" },
        { name: ICONS, id: "bettermap_icons", sfx: "icons", title: "Minimap Icons (BetterMap)" },
        { name: OBJECTS, id: "bettermap_objects", sfx: "objects", title: "Map Objects (BetterMap)" }
    ];

    // Our own section in Valve's settings window, after Game (spec
    // docs/specs/2026-10-07-runtime-settings-injection.md R2, R3). C++ does not know it, so the
    // title is set from JS, as the subsections' are.
    var SECTION = { id: "bettermap_section", title: "Minimap" };

    // A per-type icon size (spec §4). `icon` drives qollite_map_icons.js and the generated
    // rules: `cls` + pct is the class on #hud_minimap, `engine` the Valve marker
    // selectors it scales (build 6726 census, research note §5), `own` BetterMap's own
    // markers that take the same class, `always` writes the 100 % class too (the local
    // player also carries .friend, so an ally size would otherwise reach it),
    // `zoomAside` drops the class in the zoomed minimap, where Valve sizes players itself,
    // and `exclude` lists engine markers that keep Valve's base scale under the class.
    function _icon(key, label, umm, tooltip, icon) {
        return { key: key, group: ICONS, type: "slider", label: label, def: 100,
                 min: LIMITS.iconScaleMinPct, max: LIMITS.iconScaleMaxPct, step: LIMITS.iconScaleStepPct,
                 unit: "%", scale: 1, umm: umm, tooltip: tooltip, icon: icon };
    }

    // A marker colour (spec docs/specs/2026-10-01-healing-apples-and-marker-colors.md §5.3):
    // a position on Valve's colour track, stored 0..1 and shown 0..100 (the inner
    // Slider#ColorSlider runs 0..1, research P3). `row` puts it into the settings row of
    // the toggle it names (C3); `standalone` keeps it out of UMM's manifest (C4, owner:
    // no colours in UMM), so it has no UMM id.
    function _color(key, row, label, def, what) {
        return { key: key, group: OBJECTS, type: "color", row: row, label: label, def: def,
                 min: 0, max: 100, step: 1, scale: 100, standalone: true,
                 tooltip: "Drag the palette to choose the color of the " + what + "." };
    }

    // `umm` is the UMM widget id: two characters (spec I6, owner 2026-10-01), so
    // BetterMap's share of UMM's shared 500-character token stays small. Values UMM
    // saved under the old long ids are not carried over (a one-time reset).
    // The corner setting was removed (D18, owner 2026-10-01): the offsets are
    // measured from the bottom-right corner and reach every position.
    var SETTINGS = [
        { key: "minimapSizePx", group: MAP, type: "slider", label: "Minimap Size", def: 400,
          min: LIMITS.minimapSizeMinPx, max: LIMITS.minimapSizeMaxPx, step: LIMITS.minimapSizeStepPx,
          unit: "px", scale: 1, umm: "ms",
          tooltip: "Width and height of the minimap on screen.",
          // C++ sizes an ability's range circle (#CastRange, inline width in % of its
          // marker) from the drawn map's size as if the marker kept Valve's size, so the
          // circle grows with the map twice over (probe run 2, 2026-10-04, build 6745:
          // 21.42 / 42.84 / 59.96 / 85.68 % at 200 / 400 / 560 / 800 px). qollite_map_size.js
          // puts `cls` + the applied size on #hud_minimap; the generated rule scales
          // `engine` back by native / size. `extra` sizes are applied off the slider grid.
          mapScale: { cls: "bm_mapsize_", native: LIMITS.minimapSizeNativePx,
                      extra: [LIMITS.minimapUltLargePx],
                      engine: [".map_button.ability_castrange #CastRange"] } },
        { key: "minimapOffsetX", group: MAP, type: "slider", label: "Horizontal Offset", def: 0,
          min: -100, max: 100, step: 5, unit: "%", scale: 100, umm: "ox",
          tooltip: "Moves the minimap left from the bottom-right corner. 100% reaches the left edge; negative values push it past the right edge, at most halfway." },
        { key: "minimapOffsetY", group: MAP, type: "slider", label: "Vertical Offset", def: 0,
          min: -100, max: 100, step: 5, unit: "%", scale: 100, umm: "oy",
          tooltip: "Moves the minimap up from the bottom-right corner. 100% reaches the top edge; negative values push it past the bottom edge, at most halfway." },
        { key: "mapOpacity", group: MAP, type: "slider", label: "Map Opacity", def: 0.95,
          min: 10, max: 100, step: 5, unit: "%", scale: 100, umm: "mo",
          tooltip: "Opacity of the minimap image. Markers keep their own opacity." },
        { key: "minimalMap", group: MAP, type: "toggle", label: "Minimalist Minimap", def: false,
          umm: "mm",
          tooltip: "Hides the minimap frame and decorations and keeps only the map and its markers." },
        { key: "ultLargeMapEnabled", group: MAP, type: "toggle", label: "Larger Map for Traveler (Mirage)", def: true,
          umm: "ul",
          tooltip: "Enlarges the minimap while you aim an ability on the map, such as Mirage's Traveler." },
        { key: "hudFullWidth", group: MAP, type: "toggle", label: "Full-Width HUD", def: false,
          umm: "fw",
          tooltip: "On ultrawide screens, lets the minimap use the full screen width instead of the game's 21:9 limit." },
        _icon("selfIconScalePct", "Your Icon Size", "is",
              "Size of your own hero's icon on the minimap, relative to the game's size.",
              { cls: "bm_size_self_", engine: [".map_button.player.friend.localplayer"], always: true, zoomAside: true }),
        _icon("allyIconScalePct", "Ally Icon Size", "ia",
              "Size of your allies' hero icons on the minimap, relative to the game's size.",
              { cls: "bm_size_ally_", engine: [".map_button.player.friend"], zoomAside: true }),
        _icon("enemyIconScalePct", "Enemy Icon Size", "ie",
              "Size of the enemy hero icons on the minimap, relative to the game's size.",
              { cls: "bm_size_enemy_", engine: [".map_button.player.enemy"], zoomAside: true }),
        _icon("towerIconScalePct", "Tower Icon Size", "it",
              "Size of the towers and the other lane objectives on the minimap.",
              { cls: "bm_size_tower_", engine: [".map_button.boss_icon_t1", ".map_button.boss_icon_t2",
                ".map_button.boss_icon_t3", ".map_button.boss_barracks_icon", ".map_button.boss_buildingzip"] }),
        // `exclude`: the broker carries .tier1_shop too, but while it is purchasable Valve's
        // `corrupted_available` keyframes animate pre-transform-scale2d and beat our rule
        // (in-game run 1), so it would pulse at the game's size anyway. The owner chose a
        // consistent size (2026-10-01: "Exclude the broker from Shop Icon Size"): it keeps
        // the game's size at every step.
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

    function defaults() {
        var d = {};
        for (var i = 0; i < SETTINGS.length; i++) { d[SETTINGS[i].key] = SETTINGS[i].def; }
        return d;
    }

    function _snapShown(e, shown) {
        var s = Math.round((shown - e.min) / e.step) * e.step + e.min;
        return Math.max(e.min, Math.min(e.max, s));
    }

    // Settings with a numeric range in shown units: sliders and colours.
    function isRanged(e) { return e.type === "slider" || e.type === "color"; }

    // toShown / fromShown trust their input (a finite number for ranged entries: sliders, colours); untrusted
    // values must go through sanitize() first.
    // Stored value -> the number the player / UMM sees (ranged entries only; toggles pass through).
    function toShown(e, stored) {
        return isRanged(e) ? _snapShown(e, Number(stored) * e.scale) : stored;
    }

    // A shown number -> the stored value, snapped and clamped.
    function fromShown(e, shown) {
        return isRanged(e) ? _snapShown(e, Number(shown)) / e.scale : shown;
    }

    // A candidate stored value -> the valid stored value, or undefined when it
    // cannot be one (unknown key, wrong type). Ranged entries (sliders, colours) are
    // clamped and snapped to their step.
    function sanitize(key, value) {
        var e = byKey(key);
        if (!e) { return undefined; }
        if (e.type === "toggle") { return typeof value === "boolean" ? value : undefined; }
        if (typeof value !== "number" || !isFinite(value)) { return undefined; }
        return fromShown(e, value * e.scale);
    }

    return {
        LIMITS: LIMITS, list: list, groups: groups, section: section, iconEntries: iconEntries, byKey: byKey,
        byUmmId: byUmmId, isRanged: isRanged, defaults: defaults, toShown: toShown, fromShown: fromShown,
        sanitize: sanitize
    };
})();
