# Minimap

> Resizable, movable minimap with per-type icon sizes, a larger map on TAB, an optional rotating
> minimap, an objective overlay, and its own section in the game's settings window.
>
> **Origin:** BetterMap 3.5 (`3d4444c`) · **Runs in:** every match · **Off switch:** settings window or
> UMM `bettermap` (partial — see [Known issues](#known-issues))
> **Last verified:** 2026-11-06 against the BetterMap 3.5 re-bundle (branch `feat/bettermap-3.5`).

The largest feature in the mod: 30 scripts, loaded from a small entry layout (`hud_data_feed.xml`),
which build their minimap structure into Valve's own HUD and their section into Valve's own settings
window at runtime — **no override of `hud.xml`, `hud.css` or the settings window for BetterMap**. Its
only stylesheet is `hud_minimap.css`; the always-on overlay is overridden for the credit line. The
scripts are **generated** from upstream BetterMap by `scripts/bundle_bettermap.py`. Change them
upstream and re-bundle, never the bundled copy ([`../BUNDLE.md`](../BUNDLE.md) §3).

Nothing on this page has been checked in game with the QOL Lite bundle. BetterMap's author checked
3.3 standalone on game build 6779 — hideout, bot matches, TAB / Alt, POI markers, death, the Sapphire
side, a release build with DEBUG off (upstream spec `docs/specs/2026-10-07-hud-runtime-entry.md` §9).
For 3.5 the upstream specs record the author's in-game checks of the rotating minimap (team 2,
tunnels) and of the icon sizes (`2026-11-04-rotating-minimap.md`, `2026-11-05-icons-keep-size.md`);
upstream's CHANGELOG says the map objects were checked against game build 6851.

---

## What it does

| Capability | Default |
|---|---|
| Resize the minimap, 200–800 px in 20 px steps | 400 px |
| Move it with two offsets from the bottom-right corner: 100 % reaches the opposite edge, negative values push it past its own edge, at most halfway | 0 / 0 |
| Map opacity, 10–100 % — fades the whole map, BetterMap's markers (3.3) and the frame and backdrop (3.5) included | 95 % |
| "Minimalist" mode — strips the frame and decorations, keeps the map and its markers | off |
| Location Label Size — the district name next to the minimap, 50–200 % (3.4; in UMM since 3.5) | 100 % |
| Larger Map on TAB — while TAB is held, the minimap in the screen centre at its own size (400–1000 px) and opacity, above the TAB screen; shown for a few seconds while one of its settings changes (3.5) | off (800 px, 100 %) |
| Rotating Minimap — the map turns with the view, your icon in the centre pointing up, the other icons upright; zoom 100–200 %. TAB, Alt, an aimed map ability and the game's zoomed minimap show the normal north-up map (3.5) | off (zoom 200 %) |
| Full-Width HUD — lift Valve's 21:9 clamp on ultrawide screens | off |
| Separate icon sizes, 50–200 %: you, allies, enemies, towers, shops, runes, urn. Since 3.5 icons keep their size at any Minimap Size, TAB Map Size and zoom | 100 % |
| Overlay markers for crates, tough crates, golden statues and healing apples (3.1), each shown from its own spawn time | off |
| A colour per marker type, picked on Valve's colour track in the settings window (3.1; not in UMM) | crates blue, statues yellow, tough crates green, apples red |
| Urn spawn-location tracker with countdown | off |
| Live preview of the real minimap: in the escape menu for 4 s after a change, and over the settings window while BetterMap's rows are on screen | — |
| Settings in Valve's settings window: its own section **Minimap** at the bottom, three subsections, a sidebar entry with three sub-entries; saved automatically | — |
| Credit line "QOL Lite Mod" in a match, bottom right under Valve's match / build line, in Valve's font (3.2; the text is a QOL Lite delta) | always, no switch |
| Ability range circles (Doorman's doorway) keep their true size at any Minimap Size (3.2) | — |
| While a map ability is aimed (Mirage's Traveler), the game's own enlarged, centred map shows; BetterMap steps aside (3.5 — it replaced BetterMap's own "Larger Map for Traveler", removed) | — |

Everything defaults to off or to the game's own look. Several loops still run whatever the settings
are ([Known issues](#known-issues)).

---

## Where the settings live

Two mutually exclusive front ends, decided at HUD load:

| | Without UMM | With UMM installed |
|---|---|---|
| UI | Settings → **Minimap** (the last section) → **Minimap**, **Minimap Icons**, **Map Objects** ("Crates & Statues" before 3.1), each with Preview on Screen and Reset to Defaults, plus Valve's per-row reset. The window's search does not find them: C++ indexes the window before our section exists | UMM's window, id `bettermap`, three groups. Nothing is built into the settings window |
| Saving | `qollite_map_store.js`: a hidden `CitadelHTMLPanel` keeps the settings in the embedded browser's `localStorage` behind `gfkm.github.io/bettermap-storage/` ([`../BUNDLE.md`](../BUNDLE.md) §4, Third-party services) | UMM. The store reads once at HUD load to seed UMM, then mirrors every value UMM sends, so the next launch can seed UMM again (since 3.3; if the read fails it stays off and writes nothing) |

**Upgrading from the 2.1 bundle resets every UMM-saved BetterMap value once.** 3.0 gave every widget
a two-character id ([`../UMM.md`](../UMM.md) §4), so UMM no longer finds the old ones. This is
upstream's decision, in its CHANGELOG. The QOL Lite-only "Minimalist Map Opacity" slider is gone,
and Map Opacity does **not** replace it. Map Opacity fades the whole map, Valve's hero and objective
icons included, so "faint map, solid icons" is no longer possible ([`../BUNDLE.md`](../BUNDLE.md)
§3).

---

## Files

**Layouts**

- `panorama/layout/hud_data_feed.xml` — the HUD entry (3.3): Valve's 9-line `hud_data_feed.xml`, kept
  verbatim, plus a `<scripts>` block with BetterMap's 29 HUD scripts and the
  [passives](passives.md) script. Upstream generates it from Valve's file; here it is merged by hand
  ([`../BUNDLE.md`](../BUNDLE.md) §3). Its `HudDataFeed#DataFeed` hangs directly under `CitadelHud`,
  loads once per session and survives hideout → match (upstream probe E1).
- The pack ships **no `hud.xml`** since 3.3. `qollite_map_hud.js` builds into Valve's HUD what the
  override used to declare ([How it works](#wrap-never-integrate)).
- BetterMap has **nothing** in `panorama/layout/popups/popup_settings.xml` (since `5ac7816`). Its
  section is created in the live window by `qollite_map_settings_mount.js`
  ([The settings window](#the-settings-window)). QOL Lite still overrides that file for its own
  [4×3](aspect-ratio-4x3.md) button and the Extended FOV row, so a Valve build that adds an id the
  engine looks up there can still crash Settings until those two move as well.

**Styles**

- `panorama/styles/hud_minimap.css` (7,509 lines, 150 KB at 3.5; 2,869 lines, 62 KB at 3.3):
  upstream's file verbatim, generated in full by upstream from Valve's 6842 sheet (upstream `aab7760`),
  then BetterMap's block (from line 1958: the overlay and urn marker, inside `#hud_minimap`,
  Minimalist layers, the vignette), then lines 2097–7509 generated from the schema
  (`BEGIN GENERATED: bettermap icon sizes`), about 1,050 rules: the icon-size classes
  (`bm_size_<type>_<pct>`, since 3.5 on a 2 % grid for the three player icons so they keep their size
  on any drawn map), `bm_fit_<pct>` for the soul drops, `bm_mapsize_<px>` up to the TAB map's 1000 px,
  and `bm_rot_<n>`, which turns the icons back upright in 5° steps while the rotating minimap turns.
  The growth is 3.5's; what those unmatched rules cost the style system is not measured.
- `panorama/styles/qollite_map_overlay.css` (3.2): upstream's `bettermap_overlay.vcss`. Shows
  `#BetterMapCredit` under `.BmCreditShown`, in Valve's font for `#ClientServerDebugStats`, and lifts
  Valve's line by one line meanwhile (21 px, which upstream marks as not measured).
- `panorama/styles/hud.css`: **nothing of BetterMap's since 3.3.** What those rules did is inline
  (`qollite_map_hud.js`, `qollite_map_minimal.js`, `qollite_map_preview.js`), moved into
  `hud_minimap.css`, or dropped as dead (upstream spec `2026-10-07-hud-runtime-entry.md` §4).

**Textures**

- `panorama/images/minimap/base/bm_vignette_png.png` / `.vtex`: the underground vignette mask for
  Minimalist mode.
- Not used by anything: `panorama/images/minimap/qollite_tunnels.*`
  ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4). The neutral-camp images went with their dead rules at
  the 3.3 re-bundle.

- `panorama/layout/citadel_hud_and_db_overlay.xml` (3.2). Valve's always-on overlay — the layer that
  draws the match / build line, toasts and tooltips in every screen — plus `#BetterMapCredit`, our
  stylesheet and our script. Upstream generates it from Valve's file; here it is merged by hand
  ([`../BUNDLE.md`](../BUNDLE.md) §3). The label's text, "QOL Lite Mod" (upstream: "BetterMap by gfkm"),
  is the QOL Lite delta.

**Scripts.** Two JS contexts. The HUD entry loads 29 scripts through `hud_data_feed.xml`, in this
order, including the four that build and run the settings section. Its context panel is
`HudDataFeed#DataFeed`, not the HUD root, so every module finds panels through `QolLiteMapHud.root()`.
The overlay loads one, `qollite_map_overlay.js`.

| Script | Context | Global | Role |
|---|---|---|---|
| `qollite_map_log.js` | HUD | `QolLiteMapLog` | `$.Msg` wrapper, `[BetterMap]` prefix, `DEBUG = false`. First, so everything else can log |
| `qollite_map_poi_data.js` | HUD | `QolLiteMapPoiData` | Generated crate / tough crate / statue coordinates and spawn times |
| `qollite_map_urn_data.js` | HUD | `QolLiteMapUrnData` | Urn spawn coordinates |
| `qollite_map_schema.js` | HUD | `QolLiteMapSchema` | **The one list of settings.** Key, type, range, default, label, tooltip, UMM id, group, icon metadata. Defaults, the UMM manifest, the settings section (`section()`: id `bettermap_section`, title "Minimap") and its rows, and validation all derive from it |
| `qollite_map_hud.js` | HUD | `QolLiteMapHud` | The HUD structure `hud.vxml` used to declare (3.3): `root()`, the wrapper around Valve's `#minimap_persp`, the overlay inside `#hud_minimap`, the inline styles outside the minimap. Rebuilds on `CitadelGameStateChanged`, with a 2 s safety poll over cached panels |
| `qollite_map_state.js` | HUD | `QolLiteMapState` | The in-memory settings object; `DEFAULTS` built from the schema |
| `qollite_map_draw.js` | HUD | `QolLiteMapDraw` | Shared drawing rules: margins from the offsets, POI colours |
| `qollite_map_minimap.js` | HUD | `QolLiteMapMinimap` | The anchor (`#MinimapBackgroundTest`), `hasClassAbove()`, DEBUG-only probes |
| `qollite_map_view.js` | HUD | `QolLiteMapView` | TAB / Alt state (events, 2 Hz safety poll) and Valve's map targeting (17 Hz poll); tells size, position, the HUD module and the TAB map when it changes (3.5, moved out of `size`) |
| `qollite_map_size.js` | HUD | `QolLiteMapSize` | Size, map and TAB-map opacity, HUD clamp width, our size held while TAB or the ability menu is open, Valve's size while a map ability is aimed, the `bm_mapsize_<px>` and `bm_fit_<pct>` classes that keep range circles and soul drops to scale, `drawnPx()` for the icon sizes, the rotating minimap's zoom; a 2 Hz poll for the game's zoomed minimap (3.5) |
| `qollite_map_position.js` | HUD | `QolLiteMapPosition` | Offsets → margins on `#minimap_persp_wrapper`, always bottom-right; centred and raised above the TAB screen while the TAB map is active (3.5) |
| `qollite_map_tabmap.js` | HUD | `QolLiteMapTabMap` | Larger Map on TAB: owns only the mode (`active()`) and its preview while a TAB setting changes; size and position write their own panels (3.5) |
| `qollite_map_rotate.js` | HUD | `QolLiteMapRotate` | Rotating Minimap: reads the local marker's heading and position each frame, turns `#HudMinimapContainer`, places `#hud_minimap`, masks `#minimap_container` with Valve's `compass_frame_mask_psd`, and puts `bm_rot_<n>` on `#hud_minimap` to keep the icons upright (3.5) |
| `qollite_map_poi.js` | HUD | `QolLiteMapPoi` | Builds and filters the POI markers |
| `qollite_map_umm_adapter.js` | HUD | `QolLiteMapUmmAdapter` | UMM registration, id `bettermap`, manifest from the schema, the one-time seed |
| `qollite_map_minimal.js` | HUD | `QolLiteMapMinimal` | Minimalist mode: `BmMinimalMap` on `#hud_minimap` and `#minimap_persp` |
| `qollite_map_icons.js` | HUD | `QolLiteMapIcons` | Icon sizes: one `bm_size_<type>_<pct>` class per setting on `#hud_minimap`; for the player icons the percentage is divided by the drawn map's scale, so they keep their size (3.5) |
| `qollite_map_location.js` | HUD | `QolLiteMapLocation` | Location Label Size: scales Valve's `#minimap_location` (3.4) |
| `qollite_map_preview.js` | HUD | `QolLiteMapPreview` | The real minimap over the escape menu and over the settings window |
| `qollite_map_urn.js` | HUD | `QolLiteMapUrn` | Urn spawn tracker |
| `qollite_map_apply.js` | HUD | `QolLiteMapApply` | Re-applies features from state: everything, or only what one key affects |
| `qollite_map_store_codec.js` | HUD | `QolLiteMapStoreCodec` | The stored record's format and validation (pure) |
| `qollite_map_store.js` | HUD | `QolLiteMapStore` | Standalone saving through the hidden browser panel; off under UMM after one migration read |
| `qollite_map_settings_bus.js` | HUD | `QolLiteMapSettingsBus` | The settings side of the state: `request()` takes `get` / `set` / `reset` / `peek` / `lift` / `flush`; `subscribe()` delivers the `state` answers one frame later |
| `qollite_map_slider.js` | HUD | `QolLiteMapSlider` | Binds a convar-less `CitadelSettingsSlider`; accepts values only during real interaction |
| `qollite_map_popup.js` | HUD | `QolLiteMapPopup` | Per window instance (`start(win)`): binds the controls, purple "new" marks, Show on Screen, Reset, per-row reset, lift heartbeat, flush on close; hides our part if it finds UMM |
| `qollite_map_settings_nav.js` | HUD | `QolLiteMapSettingsNav` | Our sidebar entry and sub-entries, stamped from Valve's snippets; keeps them selected while our section is current; a click scrolls the title to the top |
| `qollite_map_settings_mount.js` | HUD | `QolLiteMapSettingsMount` | Polls for a new settings window; checks UMM, anchors and snippets; builds our section at the bottom of the window with `$.CreatePanel`; then starts nav and popup. Once per window instance |
| `qollite_map_bootstrap.js` | HUD | — | Waits for all modules, then `init()`s each in isolation |
| `qollite_map_overlay.js` | overlay | `QolLiteMapOverlay` | The credit line: puts `BmCreditShown` on the overlay root while Valve's `#ClientServerDebugStats` shows its match line (not in the hideout, not in Valve's detailed mode). Polls at 1 Hz |

---

## How it works

### Bootstrap

`qollite_map_bootstrap.js` polls every 0.05 s (at most 20 tries) until the 26 modules it needs are
present. It then calls each module's `init()` in its **own** `try`/`catch`: the features first, then
UMM, the store, the popup, and last the settings mount; each time `QolLiteMapHud` reports the minimap
built, it re-applies every feature. The two data tables are not waited on. One module
throwing cannot take the others down ([`../PANORAMA.md`](../PANORAMA.md) §7).

### The settings window

Valve's settings window is **not** overridden for BetterMap. C++ builds the window under
`#PopupManager` (in the HUD tree) on every open and destroys it on close.
`qollite_map_settings_mount.js` polls every 0.25 s for a new `PopupSettings` instance, waits until
C++ has filled the sidebar, and then, once per instance:

1. under UMM, builds nothing;
2. checks the anchors (`#SettingsBody`, `#SettingsNavigationButtonsContainer`) and that the window has every snippet a created panel needs
   (`BHasLayoutSnippet`). If one is missing it logs one error and builds nothing: a Valve change can
   hide our section but not crash the window. A C++ settings type whose snippet is missing is fatal to
   the game, and so is such a type inside a layout file of our own ("Unable to load snippet
   SettingsSubsection", upstream probe run 1), which is why every panel is made with `$.CreatePanel`;
3. creates `PopupSettingsSettingsSection#bettermap_section` at the bottom of the window, before
   Valve's `#SettingsFooter` (3.3; it was after Game), then one subsection per schema group with its
   rows and controls;
4. starts `QolLiteMapSettingsNav` (the sidebar) and `QolLiteMapPopup.start(win)` (the binding).

The controls have no convar; `qollite_map_slider.js` and `qollite_map_popup.js` bind them in JS.
Popup and HUD share one context and talk by direct calls on `QolLiteMapSettingsBus`. A change goes:

1. popup `request({ t: "set" })`
2. `QolLiteMapSettingsBus` patches the state and re-applies only that key
3. the store saves 3 s after the last change, or when the window closes (`flush`)

While BetterMap's rows are on screen, the popup sends a `lift` every 0.25 s and the HUD draws the live
minimap on top of the window. The sidebar sync runs every 0.03 s while our section exists and stops
when the window is gone.

### Wrap, never integrate

`HudMinimap` is compiled C++. Everything here works on the panels *around* it. Valve's own
`hud.xml` declares the tree; `QolLiteMapHud` (3.3) adds the two marked parts at HUD load and again
after a rebuild:

```
Panel.clamp_width                        (Valve's; no id)
├── CitadelHudDamageSummary#hud_damage_summary
├── #minimap_persp_wrapper               ← ours, made around Valve's persp, same index;
│   │                                      position: margins from the offsets
│   └── #minimap_persp                   ← size: width/height in px (a GlobalClassListener)
│       ├── #minimap_hints
│       ├── #minimap_container               ← opacity (frame and backdrop too since 3.5);
│       │   │                                  the rotating minimap's round mask
│       │   ├── #minimap_blur
│       │   ├── #minimap_frame
│       │   └── #HudMinimapContainer          ← the rotating minimap's turn (3.5)
│       │       └── HudMinimap#hud_minimap    ◀── C++, untouchable; drawn at a fixed 360 px
│       │           └── #minimap_overlay_root.bm_overlay   ← ours, inside the map so
│       │               ├── #minimap_markers     hud_minimap.css styles it
│       │               └── #minimap_urn_host
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
`hud_minimap.css` scales the matching Valve markers. Valve sizes the player markers in % of the
drawn map, so they grew with Minimap Size; since 3.5 their class is the setting divided by the drawn
map's scale (snapped to a 2 % grid), and `bm_fit_<pct>` does the same for the soul drops, so icons
keep their size at any Minimap Size, TAB Map Size and zoom. Some Valve markers are left alone:

- Player sizes step aside in the game's zoomed minimap mode.
- The broker keeps the game's size, because its own pulse animation would override any other.

3.0 also collapsed one shop marker at the bottom of `dl_midtown` as a stray; 3.2 shows it again —
it is a real shop (upstream CHANGELOG 3.2).

Ability range circles are sized by the C++ as if the marker kept Valve's size, so on a resized map
they grew twice over. `qollite_map_size.js` puts `bm_mapsize_<px>` on `#hud_minimap`, and a
generated rule in `hud_minimap.css` scales `.map_button.ability_castrange #CastRange` back by
400 / size (3.2).

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
| Minimap | `hudFullWidth` | `false` | `fw` | toggle "Full-Width HUD" |
| Minimap | `locationLabelScalePct` | 100 | `ll` | slider "Location Label Size" 50–200 %, step 10 — 3.4; in UMM since 3.5 |
| Minimap | `tabMapEnabled` | `false` | `tz` | toggle "Larger Map on TAB" — 3.5 |
| Minimap | `tabMapSizePx` | 800 | `ts` | slider "TAB Map Size" 400–1000 px, step 20 — 3.5 |
| Minimap | `tabMapOpacity` | 1 | `to` | slider "TAB Map Opacity" 10–100 % — 3.5 |
| Minimap | `rotateMapEnabled` | `false` | `rm` | toggle "Rotating Minimap" — 3.5 |
| Minimap | `rotateMapZoomPct` | 200 | `rz` | slider "Rotating Minimap Zoom" 100–200 %, step 25 — 3.5 |
| Minimap Icons | `self` / `ally` / `enemy` / `tower` / `shop` / `rune` / `urn` + `IconScalePct` | 100 | `is` `ia` `ie` `it` `ih` `ir` `iu` | slider 50–200 %, step 10 |
| Map Objects | `poiCratesEnabled` / `poiStatuesEnabled` / `poiToughEnabled` | `false` | `pc` / `ps` / `pt` | toggle |
| Map Objects | `poiApplesEnabled` | `false` | `pa` | toggle "Show Healing Apples" — 3.1 |
| Map Objects | `poiCrateColor` / `poiStatueColor` / `poiToughColor` / `poiAppleColor` | 0.57 / 0.2 / 0.36 / 0.08 | — (not in UMM) | colour, a position on Valve's colour track, in its toggle's row — 3.1 |
| Map Objects | `poiFrom3Min` | `true` | `p3` | toggle "Show Only Spawned Objects" |
| Map Objects | `poiMarkerSizePx` | 3 | `pz` | slider 1–8 px |
| Map Objects | `poiOpacity` | 0.8 | `po` | slider 10–100 % |
| Map Objects | `urnTrackerEnabled` | `false` | `ut` | toggle |

**Removed in 3.0:**

- `minimapCorner`: the offsets now reach every position.
- `poiLevelMode` ("Auto Level"): always automatic.
- `playerIconScalePct`: split into three player icon sizes.
- QOL Lite's `minimalMapOpacity`.

**Removed in 3.5:** `ultLargeMapEnabled` (UMM `ul`, "Larger Map for Traveler (Mirage)"): the game
enlarges and centres the map itself while a map ability is aimed. **Removed in 3.4.1:** the Halloween
candy cauldrons (3.4 only). Upstream's CHANGELOG: other saved settings are kept.

---

## Known issues

- **The loops run regardless of settings** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D1. Since 3.2
  the 33 Hz detail-view poll is gone: TAB and the ability menu are caught by event, with a 2 Hz
  safety poll; the 33 Hz re-apply runs only while one of them is open. 3.5 adds a 2 Hz zoom poll
  and makes the 17 Hz map-targeting poll unconditional; the 3.5 features themselves stop when off.
- **Rotating Minimap ticks up to once per frame (0.01 s) while it is on** — upstream measured
  0.05–0.07 ms of JS a tick, not the engine's restyle of the markers on each 5° class swap. Off by
  default. Upstream caps the zoomed map at 720 px because a larger one ran the GPU out of texture
  memory (`DXGI_ERROR_DEVICE_REMOVED`, schema `rotateMapMaxDrawnPx`); for the same reason Minimap
  Size and TAB Map Size apply once the slider settles, not while it is dragged.
- **`hud_minimap.css` grew from 62 KB to 150 KB in 3.5** (about 1,050 generated rules, see Files);
  what the style system pays for unmatched rules is not measured.
- **UMM token.** BetterMap's share of UMM's shared 500-character token is, by upstream's test at
  the longest values in UMM's old text format, 247 characters at 3.5 (it caps itself at 250). UMM's
  current binary token keeps only changed values, so the real share is smaller; QOL Lite's five UMM
  mods together have not been measured ([`../UMM.md`](../UMM.md) §4).
- **The credit line costs a 1 Hz loop in the overlay** in every screen, with no switch (one lookup
  and an ancestor walk a tick). It is a credit, not a feature, so it has no setting.
- **With UMM, every HUD load still opens the storage page** (read from `_init` in
  `qollite_map_store.js`, not measured), and since 3.3 the store writes UMM's values back to it after
  each change (3 s idle). A one-off cost at load plus one write per settled change, not per frame,
  each a request to GitHub Pages. Most QOL Lite users have UMM. Since 3.1 that read is load-bearing: the marker
  colours are not in UMM, so under UMM it is their only source (`seed()` in
  `qollite_map_umm_adapter.js`). Skipping it would reset them to defaults. Under UMM the colours
  cannot be changed either — they stay as last set without UMM.
- Options are English-only (upstream: the build tools cannot ship translations).
- `popup_settings.xml` needs a rebase after every patch that touches it while QOL Lite keeps the 4×3
  button and FOV row there ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9). `hud_data_feed.xml` is
  Valve's 9-line file plus our scripts; it too follows Valve's file when that changes (it last
  changed in 6711).
- **The settings mount polls every 0.25 s for the whole session, under UMM too**, where it never
  builds anything ([`../TECH_DEBT.md`](../TECH_DEBT.md) §2).
- The settings window's search does not find our rows.
- `[BetterMap]` log prefix, `bm_` / `Bm` class names and `bettermap_*` ids are load-bearing upstream
  names, not leftovers — [`../TECH_DEBT.md`](../TECH_DEBT.md) D8.
- Corner markers can be clipped by the circular mask ([`../PANORAMA.md`](../PANORAMA.md) §8).

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §1 — why the C++ map can only be wrapped
- [`../UMM.md`](../UMM.md) — the `bettermap` manifest
- [event reminders](event-reminders.md) — shares the urn signal via the bus
