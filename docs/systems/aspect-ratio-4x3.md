# 4×3 aspect ratio support

> Adds 4:3 to the video settings and fixes the UI that breaks at that ratio.
>
> **Runs in:** everywhere · **Off switch:** ❌ none (it *is* a setting)
> **Last verified:** 2026-09-30 against commit `60b6645`.

Pure CSS plus one radio button. No script, no timers, no runtime cost.

---

## What it does

The README lists this as two entries — "4x3 Option in Video Settings" and "4x3 Fix". They are the two
halves of one feature:

1. **The option** — a 4:3 choice in Settings → Video, which the game does not offer.
2. **The fix** — layout corrections for the panels that break at that ratio.

---

## Files

**The option** — `panorama/layout/popups/popup_settings.xml` (`#AspectRatioPanel`, line 745 on the 6759 rebase,
after BetterMap left the file at the runtime settings mount; the same file also carries the Experimental Extended FOV slider, `#BetterFOVAspectRatio`,
which 6711's new `citadel_settings_camera` subsection forced to be re-placed after `#CameraFOV`):

```xml
<Panel id="AspectRatioPanel" class="LeftRightFlow">
    <RadioButton group="AspectRatioButtons" id="16x9Button"  onactivate="CitadelSetAspectRatio(0);" text="#citadel_settings_aspectratio169" />
    <RadioButton group="AspectRatioButtons" id="16x10Button" onactivate="CitadelSetAspectRatio(1);" text="#citadel_settings_aspectratio1610" />
    <RadioButton group="AspectRatioButtons" id="21x9Button"  onactivate="CitadelSetAspectRatio(2);" text="#citadel_settings_aspectratio219" />
    <RadioButton group="AspectRatioButtons" id="4x3Button"   onactivate="CitadelSetAspectRatio(3);" text="4x3" />
</Panel>
```

`CitadelSetAspectRatio(3)` is a **C++-registered global that already exists** — the mod is exposing an
option the engine supports but the UI does not surface. Mode `3` makes the client add
`.AspectRatio4x3` to the HUD root, alongside the existing `.AspectRatio16x10` / `.AspectRatio21x9`
([`../PANORAMA.md`](../PANORAMA.md) §5).

> The three Valve buttons use `#token` localization; **the 4×3 button is hard-coded `"4x3"`** because
> no token exists for it. Acceptable — the string is language-neutral.

**The fix** — `.AspectRatio4x3` rules across nine stylesheets (grepped 2026-09-30):

| Stylesheet | Fixes |
|---|---|
| `hud.css` | `#health_and_abilities_container` centring; `#StatsAndModsContainer.gShopOpen #LowerLeft` |
| `citadel_hud_hero_shop.css` | `#Shop`, `#MainPanel`, `#HeroScenePanel` |
| `hud_quickbuy.css` | Queue outer panel (`.gShopOpen .QuickbuyQueueOuter`), `.QuickbuyShopSummaryContainer` |
| `citadel_hud_hero_builds.css` | Build edit section, `#AbilityBuildContainer` |
| `citadel_ui_ability_order.css` | `#AbilityBuildContainer` — `ui-scale: 88%` |
| `citadel_db_page_profile.css` | Main contents, stats, match history, tabs, hero scene |
| `citadel_db_page_watch.css` | Active match container |
| `citadel_item_draft_panel.css` | `#LogoContainer` |
| `post_game/citadel_db_post_game_scoreboard_new.css` | Victory label |

---

## How it works

Each of those stylesheets except `hud.css` is the `base/` pattern in its purest form — import the
pristine Valve baseline, then append the 4×3 corrections. `citadel_ui_ability_order.css` is one
`@import` and one rule:

```css
@import url("s2r://panorama/styles/base/citadel_ui_ability_order.vcss_c");
.AspectRatio4x3 .gEditingBuilds #AbilityBuildContainer { ui-scale: 88%; }
```

`ui-scale` is Panorama's subtree scaler — the right tool here, since it shrinks a whole panel and its
children proportionally rather than fighting individual dimensions.

> Until `4bb5c0e` (and, for `hud_quickbuy.css`, the re-merge after it) most of these files also
> held the decompiler's flattened copy of their base, which made them confusing to read; only
> `hud.css` still does. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) § The `base/` pattern.

---

## Settings

The setting **is** the feature. It persists through the game's own convar system, because
`CitadelSetAspectRatio` is Valve's — one of the very few settings in this mod that survives a restart
without UMM.

---

## Known issues

- **Coverage is unverified.** Nine stylesheets are patched; whether that is every panel that breaks at
  4:3 has not been checked systematically. Any newly added Valve screen will be unpatched by default.
- Each patched stylesheet is another Valve file this mod owns, and therefore another rebase surface
  after a patch.
- **Three rules were tuned against pre-6711 geometry** and are unverified at 4:3 on 6722:
  - `hud_quickbuy.css` — was `.AspectRatio4x3 #QuickbuyShopSummary { margin-left: 210px }`; Valve
    moved the summary into `.QuickbuyShopSummaryContainer`, so the rule now shifts the container to
    `17px` (queue and summary share x = 90 px since 6711; the old rules moved both by −110 px).
    **Inferred.**
  - `hud.css` — `.AspectRatio4x3 #StatsAndModsContainer.gShopOpen #LowerLeft` offsets were tuned
    against Valve's old `translateY(-36px)`, which 6711 removed; the shop layout may be off by ~26 px.
  - `citadel_hud_hero_shop.css` — `.AspectRatio4x3 #MainPanel` (`scale3d(0.9,…)`, `translate3d(60px,
    -50px, 0)`) was tuned for a 1150 px panel; 6711 widened `#MainPanel` to 1200 px.

---

## See also

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) § The `base/` pattern
- [`../PANORAMA.md`](../PANORAMA.md) §5 — root state classes
