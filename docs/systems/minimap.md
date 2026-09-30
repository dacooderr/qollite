# Minimap

> Resizable, repositionable minimap with an objective overlay and a settings panel.
>
> **Origin:** BetterMap 2.1 (`ca29290`) · **Runs in:** every match · **Off switch:** UMM `bettermap` (partial)
> **Last verified:** 2026-09-30 against commit `fa59528`.

The largest feature in the mod: fifteen scripts, a full `hud.xml` override, and about 280 lines of
custom CSS. The scripts are **generated** from upstream BetterMap by `scripts/bundle_bettermap.py` —
change upstream and re-bundle, never the bundled copy ([`../BUNDLE.md`](../BUNDLE.md) §3).

Nothing on this page has been checked in game since the 6722 update.

---

## What it does

| Capability | Default |
|---|---|
| Resize the minimap, 200–800 px in 20 px steps | 400 px |
| Move it to any screen corner, with X/Y offsets that can push it up to half off-screen | bottom-right |
| Adjust map opacity | 0.95 |
| Scale the player icons on the map, 50–200 % | 100 % |
| "Minimalist" mode — strips decoration, with its own map opacity (QOL Lite-only slider) | off |
| Enlarge to 750 px while a map-targeted ability is aimed (Mirage's Traveler) | **on** |
| Lift Valve's HUD clamp width so the map can sit further out | off |
| Overlay markers for crates, tough crates and golden statues, each hidden until its own spawn time | off |
| Urn spawn-location tracker with countdown | off |
| Live preview of the real minimap in the escape menu for 4 s after any setting changes | — |
| In-HUD settings panel, two tabs, shown during ALT / TAB (retired when UMM is present) | — |

Everything except the ability-enlarge defaults to off, which is what the opt-in model asks for —
though the loops still run regardless, see [Known issues](#known-issues).

---

## Files

**Layout** — `panorama/layout/hud.xml` (619 lines)

A **full override of Valve's HUD**, rebased onto 6722. It carries the entire vanilla tree plus:

- the 15 map script includes (and `qollite_passive`)
- `#minimap_ui_clamp_container` — Valve's `.clamp_width` panel with a mod id; `#minimap_persp_wrapper`
  inside it
- `#minimap_settings_actions` → `#minimap_settings_toggle` — the Settings button
- `#minimap_overlay_root` → `#minimap_markers`, `#minimap_urn_host` — overlay hosts, siblings of the
  C++ map, never children of it
- `#minimap_settings` — the settings window, two tabs (`Overlay`, `Minimap`), built from Valve's own
  `CitadelSettingsToggle` / `CitadelSettingsSlider` markup; BetterMap 2.1's rows plus one QOL Lite row
  (`#minimap_minimal_opacity_slider`)

> ⚠️ **Owning `hud.xml` means owning it forever.** New Valve HUD elements only reach our users after
> the override is rebased onto the current build ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9). A
> missing C++ panel renders nothing and reports nothing ([`../PANORAMA.md`](../PANORAMA.md) §1).

**Styles** — `panorama/styles/hud_minimap.css` (2,169 lines: Valve's 6722 sheet, with BetterMap's
appendix from line 1890 — equal to BetterMap's own file apart from the decompiler header),
`panorama/styles/hud.css` (BetterMap's rules: `#minimap_persp` noclip and sizing under
`gDetailView` / `gScoreboardOpen`, `#HudMinimapContainer` z-order, hit-testing, the neutral-icon rules,
and `.bm_preview_live` at the end of the file, which must stay after Valve's `.ShowEscapeMenu .HudCore`)

**Textures** — `panorama/images/minimap/base/bm_vignette_png.png` / `.vtex` (the underground vignette
mask for Minimalist mode; without it the underground minimap vanishes in that mode, per upstream). Not
used by anything: `panorama/images/minimap/qollite_tunnels.*`, and — inert —
`panorama/images/minimap/base/neutral_{large,medium,vault}_custom_png.*`
([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).

**Scripts** — loaded by `hud.xml` in this order:

| Script | Global | Role |
|---|---|---|
| `qollite_map_log.js` | `QolLiteMapLog` | `$.Msg` wrapper, `[BetterMap]` prefix, `DEBUG = false`. **First**, so everything else can log. |
| `qollite_map_poi_data.js` | `QolLiteMapPoiData` | Generated crate / tough crate / statue coordinates (662 POIs) |
| `qollite_map_urn_data.js` | `QolLiteMapUrnData` | Urn spawn `u`/`v` coordinates |
| `qollite_map_state.js` | `QolLiteMapState` | `DEFAULTS` + the single in-memory settings object |
| `qollite_map_minimap.js` | `QolLiteMapMinimap` | **New in 2.1.** The anchor (`#MinimapBackgroundTest`), `hasClassAbove()`, map inversion, DEBUG-only probes |
| `qollite_map_settings.js` | `QolLiteMapSettings` | Settings window: open/close, tabs, map opacity, detail-view visibility |
| `qollite_map_size.js` | `QolLiteMapSize` | Size slider, HUD clamp width, ability-targeting enlarge |
| `qollite_map_position.js` | `QolLiteMapPosition` | Corner preset + offset sliders → margins |
| `qollite_map_poi.js` | `QolLiteMapPoi` | Builds and filters the POI markers |
| `qollite_map_umm_adapter.js` | `QolLiteMapUmmAdapter` | UMM registration, id `bettermap` |
| `qollite_map_minimal.js` | `QolLiteMapMinimal` | Minimalist mode (+ the QOL Lite opacity delta) |
| `qollite_map_player.js` | `QolLiteMapPlayer` | **New in 2.1.** Player icon scale via `bm_player_scale_*` classes |
| `qollite_map_preview.js` | `QolLiteMapPreview` | **New in 2.1.** Escape-menu live preview |
| `qollite_map_urn.js` | `QolLiteMapUrn` | Urn spawn tracker |
| `qollite_map_bootstrap.js` | — | Waits for all modules, then `init()`s each in isolation |

---

## How it works

### Bootstrap

`qollite_map_bootstrap.js` polls every 0.05 s (at most 20 tries) until the eleven modules it needs are
present (`State`, `Minimap`, `Settings`, `Size`, `Position`, `Poi`, `Minimal`, `Player`, `Preview`,
`Urn`, `UmmAdapter`), then calls each module's `init()` inside its **own** `try`/`catch`. The logger and
the two data tables are not waited on; they define plain objects at load time. One module throwing
cannot take the others down — the discipline [`../PANORAMA.md`](../PANORAMA.md) §7 explains the need
for.

### Wrap, never integrate

`HudMinimap` is compiled C++. Everything here works on the panels *around* it. Children of
`#minimap_container` are in Valve's 6722 order, with the overlay appended:

```
#minimap_ui_clamp_container (.clamp_width)
├── CitadelHudDamageSummary#hud_damage_summary   (Valve's; moved here in 6711)
├── #minimap_persp_wrapper              ← position: corner + offsets (margins)
│   ├── GlobalClassListener (gDetailView gScoreboardOpen)
│   ├── #minimap_settings_actions
│   └── #minimap_persp                  ← size: width/height in px (a GlobalClassListener)
│       ├── #minimap_hints
│       ├── #minimap_container
│       │   ├── #minimap_blur
│       │   ├── #minimap_frame               ← 6722: a blurred compass backdrop, under the map
│       │   ├── #HudMinimapContainer         ← opacity
│       │   │   └── HudMinimap#hud_minimap   ◀── C++, untouchable; 6722 draws it at a fixed 360 px
│       │   └── #minimap_overlay_root        ← our markers live here
│       │       ├── #minimap_markers         ← POIs
│       │       └── #minimap_urn_host        ← urn marker
│       ├── #minimap_location
│       └── #MinimapRevealNotif
└── CitadelHudModifiers#hud_aura_modifiers
```

Sizing writes `style.width` / `style.height` on `#minimap_persp`, `#minimap_container` and
`#minimap_frame` together, and scales `#hud_minimap` to 360/400 of the container
(`MAP_TO_CONTAINER` in `qollite_map_size.js`), because 6722 fixed the map's own size at 360 px.

### The anchor

Build 6711 deleted `#map_render`, which the previous bundle anchored its level and targeting checks
on ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §8). BetterMap 2.1 anchors on Valve's
`#MinimapBackgroundTest` instead: `QolLiteMapMinimap.hasClassAbove(cls)` walks up from it looking for
engine classes (`map_targeting`, `is_underground`, `in_tunnels`, `invert_map`). The map itself is now
`Image.backgroundImage1..3` inside that panel, one per level, switched by Valve's CSS.

### Positioning

Corner choice sets `horizontalAlign` / `verticalAlign`; the offset sliders (−1..1 fractions) become a
pixel margin — positive values move inward from the anchored edge, negative values past it, at most
half off-screen. Viewport size is read from the parent's `actuallayoutwidth` / `actuallayoutheight`.

> There is **no cursor drag** — see [`../PANORAMA.md`](../PANORAMA.md) §9. Discrete controls are the
> only option, not a design preference.

### POI overlay

`qollite_map_poi.js` creates one `Panel` per entry in `QolLiteMapPoiData`, positioned by percentage and
mirrored when the map is inverted (team 2 sees it rotated 180°). Visibility is filtered by type, level
and spawn gate:

- **Level** — surface, `is_underground` (mid tunnels) or `in_tunnels` (the rat-tunnel layer, where
  only small props show), polled at 4 Hz via the anchor.
- **Spawn gate** — regex-parses `#GameTime`; each POI stays hidden until its own spawn time
  (3:00 / 5:00 / 10:00 on 6722) while "Hide Objects Until Spawned" is on.

> The data is **static spawn knowledge**. Live breakable state is not observable
> ([`../PANORAMA.md`](../PANORAMA.md) §3) and would be a cheat if it were.

### Urn tracker

Predicts the spawn side from `QolLiteMapUrnData`, drives a countdown ring via
`style.clip = "radial(50% 50%, 0deg, Ndeg)"`, and draws a landing countdown for the first ~12 s after
a real urn appears. Detects the live `idol_*` marker classes the engine paints onto the map — the one
piece of world state that *is* readable — and hides its prediction whenever a real urn is in play.

### Escape-menu preview

While the escape menu is open Valve hides the HUD. For 4 s after any BetterMap setting changes,
`qollite_map_preview.js` sets `bm_preview_live` on the root, whose CSS in `hud.css` un-hides `.HudCore`,
and makes every HUD panel not on the path to `#minimap_persp_wrapper` transparent — so a UMM change
shows on the real minimap.

### Settings window

Imitates Valve's settings markup and wires the composite controls to JavaScript rather than convars
(a mod cannot register into the C++ settings tree — [`../PANORAMA.md`](../PANORAMA.md) §8). The
Settings button is only shown under `gDetailView` / `gScoreboardOpen`, because the cursor is captured
during normal play.

When a UMM core answers, `QolLiteMapSettings.setUmmActive(true)` retires the in-HUD panel so the user
never sees two competing UIs. Every setting is in the UMM schema, so nothing becomes unreachable.

---

## Settings

`QolLiteMapState.DEFAULTS` and the UMM schema in `qollite_map_umm_adapter.js`:

| Key | Default | UMM id | Widget |
|---|---|---|---|
| `poiCratesEnabled` | `false` | `poiCratesEnabled` | toggle |
| `poiStatuesEnabled` | `false` | `poiStatuesEnabled` | toggle |
| `poiToughEnabled` | `false` | `poiToughEnabled` | toggle — **new in 2.1** |
| `poiFrom3Min` | `true` | `poiFrom3Min` | toggle, now "Hide Objects Until Spawned" (per-POI spawn time); key kept for saved values |
| `poiLevelMode` | `"auto"` | `poiLevelAuto` | toggle (`auto` ↔ `both`) |
| `poiMarkerSizePx` | `3` | `poiMarkerSizePx` | slider 1–8 px |
| `poiOpacity` | `0.8` | `poiOpacityPct` | slider 10–100 % |
| `urnTrackerEnabled` | `false` | `urnTrackerEnabled` | toggle |
| `minimapSizePx` | `400` | `minimapSizePx` | slider 200–800, step 20 |
| `playerIconScalePct` | `100` | `playerIconScalePct` | slider 50–200 %, step 10 — **new in 2.1** |
| `mapOpacity` | `0.95` | `mapOpacityPct` | slider 10–100 % |
| `minimapCorner` | `"bottom-right"` | `minimapCorner` | select, 4 corners |
| `minimapOffsetX` / `Y` | `0` | `minimapOffsetXPct` / `YPct` | slider **−100..100 %** (was 0..100; old values stay valid) |
| `hudFullWidth` | `false` | `hudFullWidth` | toggle; off now clears the inline max-width and leaves the width to Valve's 6722 CSS |
| `minimalMap` | `false` | `minimalMap` | toggle |
| `minimalMapOpacity` | `0.9` | `minimalMapOpacityPct` | slider 0–100 % — **QOL Lite local delta**, not upstream |
| `ultLargeMapEnabled` | `true` | `ultLargeMapEnabled` | toggle, now "Larger Map for Traveler (Mirage)" |

**Removed in 2.1:** `poiShowSmall` / UMM `poiShowSmall`. A saved value for it is ignored without error;
small props now show only in the rat-tunnel view.

---

## Known issues

- **Six loops run regardless of settings** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D1. The 33 Hz
  detail-view poll in `qollite_map_settings.js` is the most expensive thing in the mod, and it keeps
  running after UMM retires the panel. Fix belongs upstream.
- **The Minimalist Map Opacity port is unverified** — it fades `#MinimapBackgroundTest`, which may
  hold C++ content too ([`../BUNDLE.md`](../BUNDLE.md) §3).
- `qollite_map_size.js` looks up `"TextEntry"` inside the size slider to sync its text; Valve's
  `settings_slider.xml` names it `#Value`, so that sync is a silent no-op (upstream bug, harmless).
- The settings window grew (tough crates, player icon size, the QOL Lite row); upstream sized it
  480×580 with scrolling. Whether the extra row needs scrolling is unverified.
- `hud.xml` needs a rebase after every significant patch ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9).
- `[BetterMap]` log prefix and `bm_`/`Bm` class names are load-bearing upstream names, not leftovers —
  [`../TECH_DEBT.md`](../TECH_DEBT.md) D8.
- Corner markers can be clipped by the circular mask ([`../PANORAMA.md`](../PANORAMA.md) §8).

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §1 — why the C++ map can only be wrapped
- [`../UMM.md`](../UMM.md) — the `bettermap` manifest
- [event reminders](event-reminders.md) — shares the urn signal via the bus
