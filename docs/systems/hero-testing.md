# Hero testing tools

> An expanded testing panel in the hideout: item spawning, world controls, and a movable window.
>
> **Origin:** Advanced Testing Tools In Hideout · **Runs in:** nowhere since `4bb5c0e` — Valve's native menu ships instead, pending confirmation · **Off switch:** ❌ none (n/a while not loaded)
> **Last verified:** 2026-09-30 against branch `fix/remerge-6722` (uncommitted).

> ### ⚠️ The mod's panel is not shipped since `4bb5c0e` — pending the maintainer's confirmation
> `4bb5c0e` replaced `hud_hero_testing.xml` with Valve's 6722 file verbatim (748 lines, no script
> include; tabs General / Bot / Map / Misc driven by `HeroTestingSelectTab(...)`), and
> `hero_testing_menu.css` is Valve 6722's file too. The `qollite_hero_testing.vjs_c` include went with
> the markup, so the removal reads as deliberate and the re-merge kept it; it has not been confirmed.
> The five-line convar delta that ported the mod's buttons to 6711+ ([`../BUNDLE.md`](../BUNDLE.md) §4)
> no longer exists. The rest of this page, from [How it works](#how-it-works) on, records the mod's
> panel as it shipped until `1f0fe0f`.

---

## What it does

**Today:** nothing of the mod runs. The hideout shows Valve's own 6722 testing menu (general controls,
bots, map, misc, amount entries, dummy stats, pin / free-cursor). Both override files are unmodified
Valve copies, so they add weight and go stale at the next patch without changing behaviour
([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).

**Until `1f0fe0f`:** the mod replaced Valve's panel with a tabbed, repositionable tool window offering
bulk item granting and world manipulation, and Valve's native menu was not shown.

---

## Files

| Path | Lines | Role |
|---|---:|---|
| `panorama/layout/hud_hero_testing.xml` | 748 | Valve 6722's native menu, verbatim (the mod's tree was 1,409 lines) |
| `panorama/styles/hero_testing_menu.css` | 1,100 | Valve 6722's file, verbatim (the mod's was 1,448 lines) |
| `panorama/scripts/qollite_hero_testing.js` | 55 | The mod's logic + item catalogue — **included by no layout** |
| `panorama/styles/ability_hud_elements/hero_testing_menu.css` | 439 | Ability-element styling — **referenced by no layout** since the `959f80e` import |

To restore the mod's panel: take `hud_hero_testing.xml` and `hero_testing_menu.css` back from
`1f0fe0f` (that copy already carries the convar delta).

---

## How it works

### Structure

```
CitadelHudHeroTesting.hud_hero_testing_root
├── #hero_testing_stub          ← collapsed state, "Press Tab" hint, lane challenge readout
└── #hero_testing_container     ← onload="InitializeTestingToolsLayout();"
    ├── #htpp_drag_bar          ← "Click to Drag"
    └── #htpp_tab_group
        └── #htpp_primary_tab_buttons_container
            ├── #htpp_primary_tab_button_Core    → PrimaryTabSelect('Core')   "Basic"
            └── #htpp_primary_tab_button_World   → PrimaryTabSelect('World')  "Advanced"
                                                    (class hide_in_coop)
```

Entry points are **global functions called from inline `onactivate` / `onload` attributes** —
`InitializeTestingToolsLayout()`, `PrimaryTabSelect(tab)`. That is the dominant Panorama HUD pattern
([`../PANORAMA.md`](../PANORAMA.md) §4), not a shortcut.

### The item catalogue

The script opens with a single semicolon-delimited string of **224 distinct** `upgrade_*` identifiers —
`upgrade_clip_size;upgrade_chain_lightning;upgrade_headshot_booster;…` — including tiered entries with
a level suffix (`upgrade_magic_reach 0` … `3`). This is the catalogue the panel can grant.

> ⚠️ Hand-maintained. New items do not appear until the string is updated, and removed items presumably
> fail silently.

### "Click to Drag"

Not cursor dragging — that is impossible here ([`../PANORAMA.md`](../PANORAMA.md) §9). The bar is a
`Button` whose `onactivate` toggles a repositioning mode. Any future movable panel in this mod should
use the same approach.

### 6711 changes and the local delta

6711 removed C++ panel events and console commands the mod's buttons relied on
(`HeroTestingChangeTeam`, `HeroTestingUpdateDisableDeath`, `HeroTestingUpdateDisableCooldowns`,
`HeroTestingUpdateEnableUnlimitedAmmo`, `HeroTestingUpdateEnableFastStamina`,
`citadel_{enable,disable}_no_hero_death`, …). Those buttons would dispatch nothing. The layout was
patched — five lines, recorded as an explicit delta in [`../BUNDLE.md`](../BUNDLE.md) §4 — to use
Valve's 6722 mechanism: Change Team runs `Cmd( 'changeteam' )`, and No Death / Unlimited Ammo /
No Cooldown / Fast Stamina became `CitadelSettingsCheckbox` bound to the convars `buddha`,
`sv_infinite_ammo`, `citadel_ability_cooldown_max`, `citadel_rapid_stamina_regen`. Ids and classes are
unchanged, so the script still finds them. **Unverified in game.**

The automatic rebase was discarded for both files: the mod is a wholesale replacement, and merging
against any Valve revision replays Valve's whole history into it
([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9).

### Scheduling

While it shipped: six loops — four at 0.2 s and two at 0.5 s — all bounded: two stop once their panels are found, one
runs 120 ticks (60 s) after `InitializeTestingToolsLayout`.

**Not hideout-only.** `hud.xml` instantiates `<CitadelHudHeroTesting id="hud_hero_testing" />`
unconditionally (as Valve's does), so the layout and its script loaded with every HUD unless the C++
defers it — which is unknown ([`../TECH_DEBT.md`](../TECH_DEBT.md) D12, resolved by removal). Do not
copy this cadence into match-time code.

---

## Settings

**None.** The mod's panel was never registered with UMM. Valve's native menu has its own controls.

---

## Known issues

- **Not shipped since `4bb5c0e`**, pending confirmation (banner above); the two override files are now
  pure Valve copies. The items below describe the mod's panel.
- Item catalogue is a hand-maintained string; goes stale on item changes.
- Six polling loops, ungated but bounded; loaded per match — D12.
- Lost with the delta: the No Death button's `Stinger.LevelUp` sound. The script still exports
  `UpdateNoDeathToggle`, which only sends removed commands and is no longer called.
- Entities → Team Select buttons set a global `TeamNumber` the script never reads; `SpawnTeamEntity`
  hard-codes team 4. Pre-existing.
- The Lane Challenge markup and rules are dead since 6711 (the C++ no longer references them).
- The stylesheet uses `>` combinators, which [`../PANORAMA.md`](../PANORAMA.md) §6 says Panorama does
  not support.
- The largest layout in the repo at 1,409 lines; there is no documentation of what the "Advanced" tab
  exposes. **Unverified** — someone should enumerate it in the hideout and fill in this section.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) §5. Whether the author
  has published a 6711+ update was not checked.

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §9 — why there is no real drag
