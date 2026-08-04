# Minimap

> Resizable, repositionable minimap with an objective overlay and a settings panel.
>
> **Origin:** BetterMap · **Runs in:** every match · **Off switch:** UMM `bettermap` (partial)
> **Last verified:** 2026-08-05 against commit `ac57b17`.

The largest feature in the mod: twelve scripts, a full `hud.xml` override, and about 170 lines of
custom CSS.

---

## What it does

| Capability | Default |
|---|---|
| Resize the minimap, 200–800 px in 20 px steps | 400 px |
| Move it to any screen corner with fine X/Y offsets | bottom-right |
| Adjust map opacity | 0.95 |
| "Minimalist" mode — strips decoration, custom tunnel texture, separate opacity | off |
| Enlarge to 750 px while an ultimate is being aimed | **on** |
| Widen the HUD clamp so the map can sit further out | off |
| Overlay markers for crates and golden statues | off |
| Urn spawn-location tracker with countdown | off |
| In-HUD settings panel, two tabs, shown during ALT / TAB | — |

Everything except the ultimate-enlarge defaults to off, which is what the opt-in model asks for —
though the loops still run regardless, see [Known issues](#known-issues).

---

## Files

**Layout** — `panorama/layout/hud.xml` (568 lines)

A **full override of Valve's HUD**. It carries the entire vanilla tree plus:

- `#minimap_settings_actions` → `#minimap_settings_toggle` — the Settings button
- `#minimap_overlay_root` → `#minimap_markers`, `#minimap_urn_host` — overlay hosts, siblings of the
  C++ map, never children of it
- `#minimap_settings` — the settings window, two tabs (`Overlay`, `Minimap`), built from Valve's own
  `CitadelSettingsToggle` / `CitadelSettingsSlider` markup

> ⚠️ **Owning `hud.xml` means owning it forever.** New Valve HUD elements only reach our users after
> the override is rebased onto the current build. A missing C++ panel renders nothing and reports
> nothing ([`../PANORAMA.md`](../PANORAMA.md) §1). **Re-check after every significant game patch.**

**Styles** — `panorama/styles/hud_minimap.css` (2,049 lines: Valve's sheet, with our ~170 lines of
additions starting at line 1879), `panorama/styles/hud.css` (minimap sizing under `gDetailView` / `gScoreboardOpen`)

**Textures** — `panorama/images/minimap/qollite_tunnels.png` (1024², 780 KB),
`panorama/images/minimap/base/neutral_{large,medium,vault}_custom_png.*`,
`materials/minimap/neutral_vault.png`

**Scripts** — loaded by `hud.xml` in this order:

| Script | Global | Role |
|---|---|---|
| `qollite_map_log.js` | `QolLiteMapLog` | `$.Msg` wrapper, `[BetterMap]` prefix. **First**, so everything else can log. |
| `qollite_map_poi_data.js` | `QolLiteMapPoiData` | Generated crate/statue coordinates for `dl_midtown` |
| `qollite_map_urn_data.js` | `QolLiteMapUrnData` | Urn spawn `u`/`v` coordinates, left/right × mid/top/bottom |
| `qollite_map_state.js` | `QolLiteMapState` | `DEFAULTS` + the single in-memory settings object |
| `qollite_map_settings.js` | `QolLiteMapSettings` | Settings window: open/close, tabs, map opacity, detail-view visibility |
| `qollite_map_size.js` | `QolLiteMapSize` | Size slider, HUD clamp width, ultimate-targeting enlarge |
| `qollite_map_position.js` | `QolLiteMapPosition` | Corner preset + offset sliders → margins |
| `qollite_map_poi.js` | `QolLiteMapPoi` | Builds and filters the crate/statue markers |
| `qollite_map_umm_adapter.js` | `QolLiteMapUmmAdapter` | UMM registration, id `bettermap` |
| `qollite_map_minimal.js` | `QolLiteMapMinimal` | Minimalist mode |
| `qollite_map_urn.js` | `QolLiteMapUrn` | Urn spawn tracker |
| `qollite_map_bootstrap.js` | — | Waits for all modules, then `init()`s each in isolation |

---

## How it works

### Bootstrap

`qollite_map_bootstrap.js` polls every 0.05 s until the eight modules it initialises are all present
(`State`, `Settings`, `Size`, `Position`, `Poi`, `Minimal`, `Urn`, `UmmAdapter`), then calls each
module's `init()` inside its **own** `try`/`catch`. The other three files — the logger and the two
data tables — are not waited on; they define plain objects at load time. One module throwing cannot take the others down —
the discipline [`../PANORAMA.md`](../PANORAMA.md) §7 explains the need for.

### Wrap, never integrate

`HudMinimap` is compiled C++. Everything here works on the panels *around* it:

```
#minimap_persp_wrapper          ← position: corner + offsets (margins)
└── #minimap_persp              ← size: width/height in px
    └── #minimap_container
        ├── #minimap_blur
        ├── #HudMinimapContainer   ← opacity
        │   └── HudMinimap#hud_minimap    ◀── C++, untouchable
        ├── #minimap_frame
        └── #minimap_overlay_root         ← our markers live here
            ├── #minimap_markers          ← crates and statues
            └── #minimap_urn_host         ← urn marker
```

Sizing writes `style.width` / `style.height` on `#minimap_persp`, `#minimap_container`, and
`#minimap_frame` together — the Valve-proven way to resize a C++ map.

### Positioning

Corner choice sets `horizontalAlign` / `verticalAlign`; the offset sliders (0–1 fractions) become a
pixel margin clamped so the map cannot leave the screen. Viewport size is read from the parent's
`actuallayoutwidth` / `actuallayoutheight`, falling back to 1920×1080 before layout has settled.

> There is **no cursor drag** — see [`../PANORAMA.md`](../PANORAMA.md) §9. Discrete controls are the
> only option, not a design preference.

### POI overlay

`qollite_map_poi.js` creates one `Panel` per entry in `QolLiteMapPoiData.dl_midtown`, positioned by
percentage (`style.x = "12.3456%"`), sized and coloured inline — crates `rgba(74,158,255,a)`, statues
`rgba(255,207,74,a)` — and centred with a translate transform. Visibility is then filtered by type,
size, level, and spawn gate.

Two live signals, both polled at 4 Hz because the engine offers nothing better:

- **Underground** — walks ancestors of `#map_render` looking for `.is_underground`
- **Spawn gate** — regex-parses `#GameTime`; markers stay hidden before 3:00

> The data is **static spawn knowledge**. Live breakable state is not observable
> ([`../PANORAMA.md`](../PANORAMA.md) §3) and would be a cheat if it were.

### Urn tracker

Alternates predicted spawn side from `QolLiteMapUrnData`, drives a countdown ring via
`style.clip = "radial(50% 50%, 0deg, Ndeg)"`, and colour-shifts the ring as the timer runs down.
Detects the live `idol_*` marker classes the engine paints onto the map — the one piece of world
state that *is* readable.

### Settings window

Imitates Valve's settings markup and wires the composite controls to JavaScript rather than convars
(a mod cannot register into the C++ settings tree — [`../PANORAMA.md`](../PANORAMA.md) §8). The
Settings button is only shown under `gDetailView` / `gScoreboardOpen`, because the cursor is captured
during normal play.

When a UMM core answers, `QolLiteMapSettings.setUmmActive(true)` retires the in-HUD panel so the user
never sees two competing UIs.

---

## Settings

`QolLiteMapState.DEFAULTS`:

| Key | Default | UMM id | Widget |
|---|---|---|---|
| `poiCratesEnabled` | `false` | `poiCratesEnabled` | toggle |
| `poiStatuesEnabled` | `false` | `poiStatuesEnabled` | toggle |
| `poiShowSmall` | `false` | `poiShowSmall` | toggle |
| `poiFrom3Min` | `true` | `poiFrom3Min` | toggle |
| `poiLevelMode` | `"auto"` | `poiLevelAuto` | toggle (`auto` ↔ `both`) |
| `poiMarkerSizePx` | `3` | `poiMarkerSizePx` | slider 1–8 |
| `poiOpacity` | `0.8` | `poiOpacityPct` | slider 10–100 % |
| `minimapSizePx` | `400` | `minimapSizePx` | slider 200–800, step 20 |
| `mapOpacity` | `0.95` | `mapOpacityPct` | slider 10–100 % |
| `minimalMapOpacity` | `0.9` | ✅ | slider |
| `minimalMap` | `false` | ✅ | toggle |
| `minimapCorner` | `"bottom-right"` | — | in-HUD dropdown only |
| `minimapOffsetX` / `Y` | `0` | — | in-HUD sliders only |
| `hudFullWidth` | `false` | — | in-HUD toggle only |
| `ultLargeMapEnabled` | `true` | — | in-HUD toggle only |
| `urnTrackerEnabled` | `false` | — | in-HUD toggle only |

**Gap:** corner, offsets, full-width, ultimate-enlarge, and the urn tracker exist only in the in-HUD
panel. Because that panel *retires itself* when UMM is present, a UMM user **cannot reach those five
settings at all**. Worth closing.

---

## Known issues

- **Four loops run regardless of settings** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D1. The 33 Hz
  detail-view poll in `qollite_map_settings.js` is the most expensive thing in the mod.
- **Five settings unreachable under UMM** — see the table above.
- `hud.xml` needs a rebase check after every significant patch.
- `[BetterMap]` log prefix and `bm_`/`Bm` class names are load-bearing upstream names, not leftovers —
  [`../TECH_DEBT.md`](../TECH_DEBT.md) D8.
- Corner markers can be clipped by the circular mask ([`../PANORAMA.md`](../PANORAMA.md) §8).

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §1 — why the C++ map can only be wrapped
- [`../UMM.md`](../UMM.md) — the `bettermap` manifest
- [event reminders](event-reminders.md) — shares the urn signal via the bus
