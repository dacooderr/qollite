# Hero testing tools

> An expanded testing panel in the hideout: item spawning, world controls, and a movable window.
>
> **Origin:** Advanced Testing Tools In Hideout · **Runs in:** hideout only · **Off switch:** ❌ none
> **Last verified:** 2026-08-05 against commit `ac57b17`.

---

## What it does

Replaces Valve's minimal hero-testing stub with a tabbed, repositionable tool window offering bulk
item granting and world manipulation. Because it is confined to the hideout, its cost never reaches a
real match.

---

## Files

| Path | Lines | Role |
|---|---:|---|
| `panorama/layout/hud_hero_testing.xml` | 1,409 | The whole panel tree |
| `panorama/scripts/qollite_hero_testing.js` | 55 | Logic + the item catalogue |
| `panorama/styles/hero_testing_menu.css` | 1,448 | Panel styling |
| `panorama/styles/ability_hud_elements/hero_testing_menu.css` | 439 | Ability-element styling |

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

### Scheduling

Six loops — four at 0.2 s and two at 0.5 s. Acceptable **only** because the panel exists solely in the
hideout. Do not copy this cadence into match-time code.

---

## Settings

**None.** Not registered with UMM. Lower priority than the other always-on features because the cost
does not reach live matches.

---

## Known issues

- Item catalogue is a hand-maintained string; goes stale on item changes.
- Six polling loops, ungated — bounded to the hideout, so tracked but not urgent.
- The largest layout in the repo at 1,409 lines; there is no documentation of what the "Advanced" tab
  exposes. **Unverified** — someone should enumerate it in the hideout and fill in this section.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) D5.

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §9 — why there is no real drag
