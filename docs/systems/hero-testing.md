# Hero testing tools

> An expanded testing panel in the hideout: item spawning, world controls, and a movable window.
>
> **Origin:** Advanced Testing Tools In Hideout (+ a local delta) · **Runs in:** the hideout; **loaded in every match** · **Off switch:** ❌ none
> **Last verified:** 2026-09-30 against branch `fix/remerge-6722` (uncommitted).

---

## What it does

Replaces Valve's hero-testing panel with a tabbed, repositionable tool window offering bulk item
granting and world manipulation. It is *used* only in the hideout, but it is not *loaded* only
there — see [Scheduling](#scheduling).

Build 6711 gave Valve's own panel a large native menu (tabs for general controls, map, misc and bots,
amount entries, dummy stats, pin / free-cursor). The mod still replaces the panel wholesale, so that
native menu is **not shown**; many of its controls duplicate the mod's.

---

## Files

| Path | Lines | Role |
|---|---:|---|
| `panorama/layout/hud_hero_testing.xml` | 1,409 | The whole panel tree |
| `panorama/scripts/qollite_hero_testing.js` | 55 | Logic + the item catalogue |
| `panorama/styles/hero_testing_menu.css` | 1,448 | Panel styling |
| `panorama/styles/ability_hud_elements/hero_testing_menu.css` | 439 | Ability-element styling — **referenced by no layout** since the `959f80e` import |

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
patched in `fa59528` — five lines, recorded as an explicit delta in [`../BUNDLE.md`](../BUNDLE.md) §4 — to use
Valve's 6722 mechanism: Change Team runs `Cmd( 'changeteam' )`, and No Death / Unlimited Ammo /
No Cooldown / Fast Stamina became `CitadelSettingsCheckbox` bound to the convars `buddha`,
`sv_infinite_ammo`, `citadel_ability_cooldown_max`, `citadel_rapid_stamina_regen`. Ids and classes are
unchanged, so the script still finds them. **Unverified in game.**

The automatic rebase was discarded for both files: the mod is a wholesale replacement, and merging
against any Valve revision replays Valve's whole history into it
([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9).

### Scheduling

Six loops — four at 0.2 s and two at 0.5 s — all bounded: two stop once their panels are found, one
runs 120 ticks (60 s) after `InitializeTestingToolsLayout`.

**Not hideout-only.** `hud.xml` instantiates `<CitadelHudHeroTesting id="hud_hero_testing" />`
unconditionally (as Valve's does), so the layout and its script load with every HUD unless the C++
defers it — which is unknown ([`../TECH_DEBT.md`](../TECH_DEBT.md) D12). This page used to say
"hideout only"; that was never verified. Do not copy this cadence into match-time code.

---

## Settings

**None.** Not registered with UMM. Whether its cost reaches live matches is the open question in
[`../TECH_DEBT.md`](../TECH_DEBT.md) D12.

---

## Known issues

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
