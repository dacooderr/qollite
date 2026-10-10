# Minimap

> Resizable, movable minimap with per-type icon sizes, an objective overlay, and its own section in
> the game's settings window.
>
> **Origin:** BetterMap 3.2.2 + runtime settings mount (`5ac7816`, upstream branch
> `feat/runtime-settings`) · **Runs in:** every match · **Off switch:** settings window or UMM
> `bettermap` (partial — see [Known issues](#known-issues))
> **Last verified:** 2026-10-07 against the re-bundle at `5ac7816` (branch
> `feat/bettermap-runtime-settings`).

The largest feature in the mod: 25 scripts, a full `hud.xml` override, a section built into Valve's
settings window at runtime (no override of that window for BetterMap), an override of the always-on
overlay for the credit line, and BetterMap's rules in three stylesheets. The scripts are **generated**
from upstream BetterMap by `scripts/bundle_bettermap.py`. Change them upstream and re-bundle, never
the bundled copy ([`../BUNDLE.md`](../BUNDLE.md) §3).

Nothing on this page has been checked in game with the QOL Lite bundle. BetterMap's author checked
the runtime settings mount standalone on game build 6759, in the hideout (upstream spec
`docs/specs/2026-10-07-runtime-settings-injection.md` §6.5; reopening, resets, Show on Screen and UMM
were not exercised there).

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
| Overlay markers for crates, tough crates, golden statues and healing apples (3.1), each shown from its own spawn time | off |
| A colour per marker type, picked on Valve's colour track in the settings window (3.1; not in UMM) | crates blue, statues yellow, tough crates green, apples red |
| Urn spawn-location tracker with countdown | off |
| Live preview of the real minimap: in the escape menu for 4 s after a change, and over the settings window while BetterMap's rows are on screen | — |
| Settings in Valve's settings window: its own section **Minimap** after Game, three subsections, a sidebar entry with three sub-entries; saved automatically | — |
| Credit line "QOL Lite Mod" in a match, bottom right under Valve's match / build line, in Valve's font (3.2; the text is a QOL Lite delta) | always, no switch |
| Ability range circles (Doorman's doorway) keep their true size at any Minimap Size (3.2) | — |

Everything except the ability enlarge defaults to off or to the game's own look. The loops still run
whatever the settings are ([Known issues](#known-issues)).

---

## Where the settings live

Two mutually exclusive front ends, decided at HUD load:

| | Without UMM | With UMM installed |
|---|---|---|
| UI | Settings → **Minimap** (after Game) → **Minimap (BetterMap by gfkm)**, **Minimap Icons (BetterMap)**, **Map Objects (BetterMap)** ("Crates & Statues" before 3.1), each with Preview on Screen and Reset to Defaults, plus Valve's per-row reset. The window's search does not find them: C++ indexes the window before our section exists | UMM's window, id `bettermap`, three groups. Nothing is built into the settings window |
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

- `panorama/layout/hud.xml` (409 lines). A **full override of Valve's HUD**, on build 6759, equal to
  BetterMap's `hud.vxml` apart from the bundled script names and the `qollite_passive` include. On top
  of the vanilla tree:
  - the 24 HUD script includes
  - `#minimap_ui_clamp_container`: Valve's `.clamp_width` panel with a mod id
  - `#minimap_persp_wrapper` inside it
  - `#minimap_overlay_root` → `#minimap_markers`, `#minimap_urn_host`: overlay hosts, siblings of the
    C++ map, never its children
- BetterMap has **nothing** in `panorama/layout/popups/popup_settings.xml` any more (since the
  re-bundle at `5ac7816`). Its section is created in the live window by
  `qollite_map_settings_mount.js` ([The settings window](#the-settings-window)). QOL Lite still
  overrides that file for its own [4×3](aspect-ratio-4x3.md) button and the Extended FOV row, so the
  crash risk below remains for that file until those two move as well.

> ⚠️ **Owning `hud.xml` means owning it forever.** New Valve elements reach our users only after a
> rebase onto the current build ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9). A missing id the
> engine reads aborts the game ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §10). The same holds for
> `popup_settings.xml` while QOL Lite overrides it: 6728, 6753 and 6757 each added such ids there.

**Styles**

- `panorama/styles/hud_minimap.css` (2,827 lines at 3.2.2): Valve's sheet, then BetterMap's appendix
  from line 1878. Upstream's file verbatim. Lines 1976–2827 are generated upstream from the schema
  (`BEGIN GENERATED: bettermap icon sizes`): one rule set per icon-size class and, since 3.2, per
  `bm_mapsize_<px>` class.
- `panorama/styles/qollite_map_overlay.css` (3.2): upstream's `bettermap_overlay.vcss`. Shows
  `#BetterMapCredit` under `.BmCreditShown`, in Valve's font for `#ClientServerDebugStats`, and lifts
  Valve's line by one line meanwhile (21 px, which upstream marks as not measured).
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

- `panorama/layout/citadel_hud_and_db_overlay.xml` (3.2). Valve's always-on overlay — the layer that
  draws the match / build line, toasts and tooltips in every screen — plus `#BetterMapCredit`, our
  stylesheet and our script. Upstream generates it from Valve's file; here it is merged by hand
  ([`../BUNDLE.md`](../BUNDLE.md) §3). The label's text, "QOL Lite Mod" (upstream: "BetterMap by gfkm"),
  is the QOL Lite delta.

**Scripts.** Two JS contexts. The HUD loads 24 scripts through `hud.xml`, in this order, including
the four that build and run the settings section. The overlay loads one, `qollite_map_overlay.js`.

| Script | Context | Global | Role |
|---|---|---|---|
| `qollite_map_log.js` | HUD | `QolLiteMapLog` | `$.Msg` wrapper, `[BetterMap]` prefix, `DEBUG = false`. First, so everything else can log |
| `qollite_map_poi_data.js` | HUD | `QolLiteMapPoiData` | Generated crate / tough crate / statue coordinates and spawn times |
| `qollite_map_urn_data.js` | HUD | `QolLiteMapUrnData` | Urn spawn coordinates |
| `qollite_map_schema.js` | HUD | `QolLiteMapSchema` | **The one list of settings.** Key, type, range, default, label, tooltip, UMM id, group, icon metadata. Defaults, the UMM manifest, the settings section (`section()`: id `bettermap_section`, title "Minimap") and its rows, and validation all derive from it |
| `qollite_map_state.js` | HUD | `QolLiteMapState` | The in-memory settings object; `DEFAULTS` built from the schema |
| `qollite_map_draw.js` | HUD | `QolLiteMapDraw` | Shared drawing rules: margins from the offsets, POI colours |
| `qollite_map_minimap.js` | HUD | `QolLiteMapMinimap` | The anchor (`#MinimapBackgroundTest`), `hasClassAbove()`, DEBUG-only probes |
| `qollite_map_size.js` | HUD | `QolLiteMapSize` | Size, map opacity, HUD clamp width, Traveler enlarge, normal size while TAB or the ability menu is open (by event since 3.2), the `bm_mapsize_<px>` class that keeps range circles to scale |
| `qollite_map_position.js` | HUD | `QolLiteMapPosition` | Offsets → margins on `#minimap_persp_wrapper`, always bottom-right |
| `qollite_map_poi.js` | HUD | `QolLiteMapPoi` | Builds and filters the POI markers |
| `qollite_map_umm_adapter.js` | HUD | `QolLiteMapUmmAdapter` | UMM registration, id `bettermap`, manifest from the schema, the one-time seed |
| `qollite_map_minimal.js` | HUD | `QolLiteMapMinimal` | Minimalist mode: `BmMinimalMap` on `#hud_minimap` and `#minimap_persp` |
| `qollite_map_icons.js` | HUD | `QolLiteMapIcons` | Icon sizes: one `bm_size_<type>_<pct>` class per setting on `#hud_minimap` |
| `qollite_map_preview.js` | HUD | `QolLiteMapPreview` | The real minimap over the escape menu and over the settings window |
| `qollite_map_urn.js` | HUD | `QolLiteMapUrn` | Urn spawn tracker |
| `qollite_map_apply.js` | HUD | `QolLiteMapApply` | Re-applies features from state: everything, or only what one key affects |
| `qollite_map_store_codec.js` | HUD | `QolLiteMapStoreCodec` | The stored record's format and validation (pure) |
| `qollite_map_store.js` | HUD | `QolLiteMapStore` | Standalone saving through the hidden browser panel; off under UMM after one migration read |
| `qollite_map_settings_bus.js` | HUD | `QolLiteMapSettingsBus` | The settings side of the state: `request()` takes `get` / `set` / `reset` / `peek` / `lift` / `flush`; `subscribe()` delivers the `state` answers one frame later |
| `qollite_map_slider.js` | HUD | `QolLiteMapSlider` | Binds a convar-less `CitadelSettingsSlider`; accepts values only during real interaction |
| `qollite_map_popup.js` | HUD | `QolLiteMapPopup` | Per window instance (`start(win)`): binds the controls, purple "new" marks, Show on Screen, Reset, per-row reset, lift heartbeat, flush on close; hides our part if it finds UMM |
| `qollite_map_settings_nav.js` | HUD | `QolLiteMapSettingsNav` | Our sidebar entry and sub-entries, stamped from Valve's snippets; keeps them selected while our section is current; a click scrolls the title to the top |
| `qollite_map_settings_mount.js` | HUD | `QolLiteMapSettingsMount` | Polls for a new settings window; checks UMM, anchors and snippets; builds our section after Game with `$.CreatePanel`; then starts nav and popup. Once per window instance |
| `qollite_map_bootstrap.js` | HUD | — | Waits for all modules, then `init()`s each in isolation |
| `qollite_map_overlay.js` | overlay | `QolLiteMapOverlay` | The credit line: puts `BmCreditShown` on the overlay root while Valve's `#ClientServerDebugStats` shows its match line (not in the hideout, not in Valve's detailed mode). Polls at 1 Hz |

---

## How it works

### Bootstrap

`qollite_map_bootstrap.js` polls every 0.05 s (at most 20 tries) until the 21 modules it needs are
present. It then calls each module's `init()` in its **own** `try`/`catch`: the features first, then
UMM, the store, the popup, and last the settings mount. The two data tables are not waited on. One module
throwing cannot take the others down ([`../PANORAMA.md`](../PANORAMA.md) §7).

### The settings window

Valve's settings window is **not** overridden for BetterMap. C++ builds the window under
`#PopupManager` (in the HUD tree) on every open and destroys it on close.
`qollite_map_settings_mount.js` polls every 0.25 s for a new `PopupSettings` instance, waits until
C++ has filled the sidebar, and then, once per instance:

1. under UMM, builds nothing;
2. checks the anchors (`#SettingsBody`, `#SettingsNavigationButtonsContainer`,
   `#citadel_settings_game`) and that the window has every snippet a created panel needs
   (`BHasLayoutSnippet`). If one is missing it logs one error and builds nothing: a Valve change can
   hide our section but not crash the window. A C++ settings type whose snippet is missing is fatal to
   the game, and so is such a type inside a layout file of our own ("Unable to load snippet
   SettingsSubsection", upstream probe run 1), which is why every panel is made with `$.CreatePanel`;
3. creates `PopupSettingsSettingsSection#bettermap_section` after Game, then one subsection per
   schema group with its rows and controls;
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
| Minimap | `ultLargeMapEnabled` | `true` | `ul` | toggle "Larger Map for Traveler (Mirage)" |
| Minimap | `hudFullWidth` | `false` | `fw` | toggle "Full-Width HUD" |
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

---

## Known issues

- **The loops run regardless of settings** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D1. Since 3.2
  the 33 Hz detail-view poll is gone: TAB and the ability menu are caught by event, with a 2 Hz
  safety poll; the 33 Hz re-apply runs only while one of them is open.
- **The credit line costs a 1 Hz loop in the overlay** in every screen, with no switch (one lookup
  and an ancestor walk a tick). It is a credit, not a feature, so it has no setting.
- **With UMM, every HUD load still opens the storage page once** (read from `_init` in
  `qollite_map_store.js`, not measured). It is a one-off cost at load, not per frame, plus a request
  to GitHub Pages. Most QOL Lite users have UMM. Since 3.1 that read is load-bearing: the marker
  colours are not in UMM, so under UMM it is their only source (`seed()` in
  `qollite_map_umm_adapter.js`). Skipping it would reset them to defaults. Under UMM the colours
  cannot be changed either — they stay as last set without UMM.
- Options are English-only (upstream: the build tools cannot ship translations).
- `hud.xml` needs a rebase after every patch that touches it, and so does `popup_settings.xml` while
  QOL Lite keeps the 4×3 button and FOV row there ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9).
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
