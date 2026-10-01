# Minimap

> Resizable, movable minimap with per-type icon sizes, an objective overlay, and settings inside the
> game's own settings window.
>
> **Origin:** BetterMap 3.0 (`0237ebe`) · **Runs in:** every match · **Off switch:** settings window or
> UMM `bettermap` (partial — see [Known issues](#known-issues))
> **Last verified:** 2026-10-01 against the BetterMap 3.0 re-bundle (branch `feat/bettermap-3.0`).

The largest feature in the mod: 22 scripts, a full `hud.xml` override, three subsections spliced into
Valve's `popup_settings.xml`, and BetterMap's rules in two stylesheets. The scripts are **generated**
from upstream BetterMap by `scripts/bundle_bettermap.py`. Change them upstream and re-bundle, never
the bundled copy ([`../BUNDLE.md`](../BUNDLE.md) §3).

Nothing on this page has been checked in game with the QOL Lite bundle. BetterMap's author checked
the 3.0 release candidate standalone, on game build 6728.

---

## What it does

| Capability | Default |
|---|---|
| Resize the minimap, 200–800 px in 20 px steps | 400 px |
| Move it with two offsets from the bottom-right corner: 100 % reaches the opposite edge, negative values push it past its own edge, at most halfway | 0 / 0 |
| Map opacity, 10–100 % (markers keep their own) | 95 % |
| "Minimalist" mode — strips the frame and decorations, keeps the map and its markers | off |
| Enlarge to 750 px while a map-targeted ability is aimed (Mirage's Traveler) | **on** |
| Full-Width HUD — lift Valve's 21:9 clamp on ultrawide screens | off |
| Separate icon sizes, 50–200 %: you, allies, enemies, towers, shops, runes, urn | 100 % |
| Overlay markers for crates, tough crates and golden statues, each shown from its own spawn time | off |
| Urn spawn-location tracker with countdown | off |
| Live preview of the real minimap: in the escape menu for 4 s after a change, and over the settings window while BetterMap's rows are on screen | — |
| Settings in Valve's settings window, Game → three subsections, saved automatically | — |

Everything except the ability enlarge defaults to off or to the game's own look. The loops still run
whatever the settings are ([Known issues](#known-issues)).

---

## Where the settings live

Two mutually exclusive front ends, decided at HUD load:

| | Without UMM | With UMM installed |
|---|---|---|
| UI | Settings → Game → **Minimap (BetterMap by gfkm)**, **Minimap Icons (BetterMap)**, **Crates & Statues (BetterMap)**, each with Preview on Screen and Reset to Defaults, plus Valve's per-row reset | UMM's window, id `bettermap`, three groups. BetterMap's subsections in the settings window are hidden |
| Saving | `qollite_map_store.js`: a hidden `CitadelHTMLPanel` keeps the settings in the embedded browser's `localStorage` behind `gfkm.github.io/bettermap-storage/` ([`../BUNDLE.md`](../BUNDLE.md) §4, Third-party services) | UMM. The store does one read at HUD load for a one-time migration into UMM, then deletes its panel |

**Upgrading from the 2.1 bundle resets every UMM-saved BetterMap value once.** 3.0 gave every widget
a two-character id ([`../UMM.md`](../UMM.md) §4), so UMM no longer finds the old ones. This is
upstream's decision, in its CHANGELOG. The QOL Lite-only "Minimalist Map Opacity" slider is gone,
and Map Opacity does **not** replace it. Map Opacity fades the whole map, Valve's hero and objective
icons included, so "faint map, solid icons" is no longer possible ([`../BUNDLE.md`](../BUNDLE.md)
§3).

---

## Files

**Layouts**

- `panorama/layout/hud.xml` (406 lines). A **full override of Valve's HUD**, on build 6730, equal to
  BetterMap's `hud.vxml` apart from the bundled script names and the `qollite_passive` include. On top
  of the vanilla tree:
  - the 20 HUD script includes
  - `#minimap_ui_clamp_container`: Valve's `.clamp_width` panel with a mod id
  - `#minimap_persp_wrapper` inside it
  - `#minimap_overlay_root` → `#minimap_markers`, `#minimap_urn_host`: overlay hosts, siblings of the
    C++ map, never its children
- `panorama/layout/popups/popup_settings.xml`. **Shared** with [4×3](aspect-ratio-4x3.md) and the FOV
  slider. BetterMap adds two things:
  - a `<scripts>` block with four includes
  - three `PopupSettingsSettingsSubsection`s at the end of `#citadel_settings_game`
    (`#bettermap_minimap`, `#bettermap_icons`, `#bettermap_objects`), rows `#bm_row_<key>`, controls
    `#bm_ctl_<key>`

  Upstream generates these from `bettermap_schema.js`; here they arrive by a 3-way merge
  ([`../BUNDLE.md`](../BUNDLE.md) §3).

> ⚠️ **Owning `hud.xml` and `popup_settings.xml` means owning them forever.** New Valve elements reach
> our users only after a rebase onto the current build ([`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> §9). A missing id the engine reads aborts the game ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §10).
> 6728 added three such ids to `popup_settings.xml`.

**Styles**

- `panorama/styles/hud_minimap.css` (2,684 lines): Valve's sheet, then BetterMap's appendix from
  line 1890. Upstream's file verbatim. Lines 1988–2684 are generated upstream from the schema
  (`BEGIN GENERATED: bettermap icon sizes`): one rule set per icon-size class.
- `panorama/styles/hud.css`: BetterMap's rules — `#minimap_persp` noclip and sizing under
  `gDetailView` / `gScoreboardOpen`, `#HudMinimapContainer` z-order, hit-testing, the neutral-icon
  rules, and `.bm_preview_live` at the end of the file. That last rule must stay after Valve's
  `.ShowEscapeMenu .HudCore`.

**Textures**

- `panorama/images/minimap/base/bm_vignette_png.png` / `.vtex`: the underground vignette mask for
  Minimalist mode.
- Not used by anything: `panorama/images/minimap/qollite_tunnels.*` and, inert,
  `panorama/images/minimap/base/neutral_{large,medium,vault}_custom_png.*`
  ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).

**Scripts.** Two JS contexts. The HUD loads 20 scripts through `hud.xml`, in this order. The settings
window loads four through `popup_settings.xml`. It is rebuilt on every open and cannot see the HUD's
globals.

| Script | Context | Global | Role |
|---|---|---|---|
| `qollite_map_log.js` | HUD, window | `QolLiteMapLog` | `$.Msg` wrapper, `[BetterMap]` prefix, `DEBUG = false`. First, so everything else can log |
| `qollite_map_poi_data.js` | HUD | `QolLiteMapPoiData` | Generated crate / tough crate / statue coordinates and spawn times |
| `qollite_map_urn_data.js` | HUD | `QolLiteMapUrnData` | Urn spawn coordinates |
| `qollite_map_schema.js` | HUD, window | `QolLiteMapSchema` | **The one list of settings.** Key, type, range, default, label, tooltip, UMM id, group, icon metadata. Defaults, the UMM manifest, the window rows and validation all derive from it |
| `qollite_map_state.js` | HUD | `QolLiteMapState` | The in-memory settings object; `DEFAULTS` built from the schema |
| `qollite_map_draw.js` | HUD | `QolLiteMapDraw` | Shared drawing rules: margins from the offsets, POI colours |
| `qollite_map_minimap.js` | HUD | `QolLiteMapMinimap` | The anchor (`#MinimapBackgroundTest`), `hasClassAbove()`, DEBUG-only probes |
| `qollite_map_size.js` | HUD | `QolLiteMapSize` | Size, map opacity, HUD clamp width, Traveler enlarge, normal size while TAB is held |
| `qollite_map_position.js` | HUD | `QolLiteMapPosition` | Offsets → margins on `#minimap_persp_wrapper`, always bottom-right |
| `qollite_map_poi.js` | HUD | `QolLiteMapPoi` | Builds and filters the POI markers |
| `qollite_map_umm_adapter.js` | HUD | `QolLiteMapUmmAdapter` | UMM registration, id `bettermap`, manifest from the schema, the one-time seed |
| `qollite_map_minimal.js` | HUD | `QolLiteMapMinimal` | Minimalist mode: `BmMinimalMap` on `#hud_minimap` and `#minimap_persp` |
| `qollite_map_icons.js` | HUD | `QolLiteMapIcons` | Icon sizes: one `bm_size_<type>_<pct>` class per setting on `#hud_minimap`. Also hides a stray spawn-shop marker (below) |
| `qollite_map_preview.js` | HUD | `QolLiteMapPreview` | The real minimap over the escape menu and over the settings window |
| `qollite_map_urn.js` | HUD | `QolLiteMapUrn` | Urn spawn tracker |
| `qollite_map_apply.js` | HUD | `QolLiteMapApply` | Re-applies features from state: everything, or only what one key affects |
| `qollite_map_store_codec.js` | HUD | `QolLiteMapStoreCodec` | The stored record's format and validation (pure) |
| `qollite_map_store.js` | HUD | `QolLiteMapStore` | Standalone saving through the hidden browser panel; off under UMM after one migration read |
| `qollite_map_settings_bus.js` | HUD | `QolLiteMapSettingsBus` | The HUD end of the settings window: answers `get`, applies `set` / `reset`, routes `peek` / `lift` / `flush` |
| `qollite_map_bootstrap.js` | HUD | — | Waits for all modules, then `init()`s each in isolation |
| `qollite_map_slider.js` | window | `QolLiteMapSlider` | Binds a convar-less `CitadelSettingsSlider`; accepts values only during real interaction |
| `qollite_map_popup.js` | window | `QolLiteMapPopup` | The three subsections: titles, purple "new" marks, Show on Screen, Reset, per-row reset, lift heartbeat, hides everything under UMM |

---

## How it works

### Bootstrap

`qollite_map_bootstrap.js` polls every 0.05 s (at most 20 tries) until the 17 modules it needs are
present. It then calls each module's `init()` in its **own** `try`/`catch`: the features first, then
UMM, the store, and last the settings bus. The two data tables are not waited on. One module
throwing cannot take the others down ([`../PANORAMA.md`](../PANORAMA.md) §7).

### The settings window

Overriding `popup_settings.xml` puts BetterMap's subsections into the registry the C++ builds when
the window loads. Navigation, search, highlight and hover are therefore Valve's own. This is
upstream's in-game finding (upstream `docs/knowledge/native_settings_injection.md`). The controls
have no convar. `qollite_map_slider.js` and `qollite_map_popup.js` bind them in JS.

The window's context cannot see the HUD. Both ends talk over `ClientUI_FireOutput`, with payloads
namespaced `"bm"` (the same channel UMM, Map Event Reminders and Quick Commend use, each with its own
namespace). A change goes:

1. window `set`
2. HUD `QolLiteMapSettingsBus` patches the state and re-applies only that key
3. the store saves 3 s after the last change, or when the window closes (`flush`)

While BetterMap's rows are on screen, the window sends a `lift` heartbeat every 0.25 s. The HUD then
draws the live minimap on top of the window. The heartbeat stops for good when the window closes.

### Wrap, never integrate

`HudMinimap` is compiled C++. Everything here works on the panels *around* it:

```
#minimap_ui_clamp_container (.clamp_width)
├── CitadelHudDamageSummary#hud_damage_summary
├── #minimap_persp_wrapper              ← position: margins from the offsets
│   ├── GlobalClassListener (gDetailView gScoreboardOpen)
│   └── #minimap_persp                  ← size: width/height in px (a GlobalClassListener)
│       ├── #minimap_hints
│       ├── #minimap_container
│       │   ├── #minimap_blur
│       │   ├── #minimap_frame
│       │   ├── #HudMinimapContainer         ← opacity
│       │   │   └── HudMinimap#hud_minimap   ◀── C++, untouchable; drawn at a fixed 360 px
│       │   └── #minimap_overlay_root        ← our markers live here
│       │       ├── #minimap_markers         ← POIs
│       │       └── #minimap_urn_host        ← urn marker
│       ├── #minimap_location
│       └── #MinimapRevealNotif
└── CitadelHudModifiers#hud_aura_modifiers
```

Sizing writes `style.width` / `style.height` on `#minimap_persp`, `#minimap_container` and
`#minimap_frame` together. It scales `#hud_minimap` to 360/400 of the container
(`MAP_TO_CONTAINER` in `qollite_map_size.js`), because the game fixes the map's own size at 360 px.

### The anchor

`QolLiteMapMinimap.hasClassAbove(cls)` walks up from Valve's `#MinimapBackgroundTest` looking for
engine classes: `map_targeting`, `is_underground`, `in_tunnels`, `invert_map`, `useZoomedMinimap`.
The map itself is `Image.backgroundImage1..3` inside that panel, one per level, switched by Valve's
CSS.

### Icon sizes

Each icon setting puts one class, `bm_size_<type>_<pct>`, on `#hud_minimap`. A generated rule in
`hud_minimap.css` scales the matching Valve markers. Some Valve markers are left alone:

- Player sizes step aside in the game's zoomed minimap mode.
- The broker keeps the game's size, because its own pulse animation would override any other.

`qollite_map_icons.js` also collapses one shop marker at the bottom of `dl_midtown`. BetterMap's
author saw it only with the mod; why it appears is unknown upstream. It is found by its position
(`STRAY_SHOP_POS`), a labelled workaround. If Valve moves it, it simply shows again.

### Positioning

The two offsets (−1..1 fractions) become pixel margins from the bottom-right corner. Viewport size
is read from the parent's `actuallayoutwidth` / `actuallayoutheight`.

> There is **no cursor drag** — see [`../PANORAMA.md`](../PANORAMA.md) §9.

### POI overlay

`qollite_map_poi.js` creates one `Panel` per entry in `QolLiteMapPoiData`, positioned by percentage
and mirrored when the map is inverted (team 2 sees it rotated 180°). Visibility is filtered by type,
level and spawn gate:

- **Level** — surface, `is_underground` or `in_tunnels`, polled at 4 Hz via the anchor. Since 3.0
  it is always automatic.
- **Spawn gate** — regex-parses `#GameTime`. While "Show Only Spawned Objects" is on, each POI stays
  hidden until its own spawn time (3:00 / 5:00 / 10:00). 6728 moved 77 small crates and 4 small
  statues from 3:00 to 5:00, counted per POI between upstream `ca29290` and `0237ebe`; upstream's
  CHANGELOG says "81 small crates".

> The data is **static spawn knowledge**. Live breakable state is not observable
> ([`../PANORAMA.md`](../PANORAMA.md) §3) and would be a cheat if it were.

### Urn tracker

Predicts the spawn side from `QolLiteMapUrnData` and drives a countdown ring through `style.clip`. It
hides its prediction whenever a real `idol_*` marker is on the map. The marker takes the Urn Icon
Size.

---

## Settings

From `qollite_map_schema.js`. The UMM id is the widget id in UMM's window. Sliders show in the units
listed and are stored as fractions where the unit is %.

| Group | Key | Default | UMM id | Widget |
|---|---|---|---|---|
| Minimap | `minimapSizePx` | 400 | `ms` | slider 200–800 px, step 20 |
| Minimap | `minimapOffsetX` / `minimapOffsetY` | 0 | `ox` / `oy` | slider −100..100 %, step 5 |
| Minimap | `mapOpacity` | 0.95 | `mo` | slider 10–100 % |
| Minimap | `minimalMap` | `false` | `mm` | toggle "Minimalist Minimap" |
| Minimap | `ultLargeMapEnabled` | `true` | `ul` | toggle "Larger Map for Traveler (Mirage)" |
| Minimap | `hudFullWidth` | `false` | `fw` | toggle "Full-Width HUD" |
| Minimap Icons | `self` / `ally` / `enemy` / `tower` / `shop` / `rune` / `urn` + `IconScalePct` | 100 | `is` `ia` `ie` `it` `ih` `ir` `iu` | slider 50–200 %, step 10 |
| Crates & Statues | `poiCratesEnabled` / `poiStatuesEnabled` / `poiToughEnabled` | `false` | `pc` / `ps` / `pt` | toggle |
| Crates & Statues | `poiFrom3Min` | `true` | `p3` | toggle "Show Only Spawned Objects" |
| Crates & Statues | `poiMarkerSizePx` | 3 | `pz` | slider 1–8 px |
| Crates & Statues | `poiOpacity` | 0.8 | `po` | slider 10–100 % |
| Crates & Statues | `urnTrackerEnabled` | `false` | `ut` | toggle |

**Removed in 3.0:**

- `minimapCorner`: the offsets now reach every position.
- `poiLevelMode` ("Auto Level"): always automatic.
- `playerIconScalePct`: split into three player icon sizes.
- QOL Lite's `minimalMapOpacity`.

---

## Known issues

- **The loops run regardless of settings** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D1. The 33 Hz
  detail-view poll, now in `qollite_map_size.js`, is still the most expensive thing in the mod. Fix
  belongs upstream.
- **With UMM, every HUD load still opens the storage page once** for the migration read, even after
  UMM already holds BetterMap's values. This is read from `_init` in `qollite_map_store.js`, not
  measured. It is a one-off cost at load, not per frame, plus a request to GitHub Pages. Most QOL Lite users have UMM. Proposal for upstream: skip the seed once UMM has
  answered with BetterMap values.
- Options are English-only (upstream: the build tools cannot ship translations).
- `hud.xml` and `popup_settings.xml` need a rebase after every patch that touches them
  ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9).
- `[BetterMap]` log prefix, `bm_` / `Bm` class names and `bettermap_*` ids are load-bearing upstream
  names, not leftovers — [`../TECH_DEBT.md`](../TECH_DEBT.md) D8.
- Corner markers can be clipped by the circular mask ([`../PANORAMA.md`](../PANORAMA.md) §8).

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §1 — why the C++ map can only be wrapped
- [`../UMM.md`](../UMM.md) — the `bettermap` manifest
- [event reminders](event-reminders.md) — shares the urn signal via the bus
