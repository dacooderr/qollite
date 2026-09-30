# Always-show passives

> Keeps passive and active item icons visible instead of hiding them during play.
>
> **Origin:** Always Show Passives & Actives · **Runs in:** every match · **Off switch:** ⚠️ UMM `always_show_passives` — defeated by unconditional rules
> **Last verified:** 2026-09-30 against commit `fa59528`.

**The cheapest feature in the mod, and the model the others should follow** — in its design. It costs
one class toggle and zero timers: all behaviour is CSS. In its current files the off switch does not
work (see [Known issues](#known-issues)).

---

## What it does

- Reveals item passive and active icons that Valve hides during normal gameplay.
- Optional **compact** mode with smaller icons.

---

## Files

| Path | Role |
|---|---|
| `panorama/scripts/qollite_passive.js` | 2 lines minified — UMM manifest and two class toggles |
| `panorama/styles/hud_ability_icon_passive.css` | **231 lines** — imports the baseline, adds our rules; since `9935d0c` a second, ungated copy of the rules sits at the top of the file |
| `panorama/styles/base/hud_ability_icon_passive.css` | 1,322 lines, pristine Valve baseline |
| `panorama/styles/hud_abilities.css` / `base/hud_abilities.css` | Same pattern — the override is only the `@import` plus rules (17 lines), so Valve's changes arrive through `base/` |
| `panorama/styles/hud_ability_icon.css` / `base/hud_ability_icon.css` | Same pattern |

> `hud_abilities.css` is the cleanest example of the `base/` pattern in the repo: 17 lines over a
> full Valve baseline. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) § The `base/` pattern.
> At the 6722 rebase the tool's automatic merge wrongly grafted a whole Valve sheet into it; it was
> kept unchanged instead ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9).

`hud_ability_icon.css` is a full copy of Valve's sheet; it was rebased onto 6722, which also brought in
Valve's rules hiding the new "+0" (`#AbilityLevelContainer`) and "Undo" (`#KeyboardHint`) panels on
every ability icon. Its only mod rule is the `UMM_ShowPassives` one (`hud_ability_icon.css:583`).

---

## How it works

The script climbs to the root panel, then sets two classes:

| Setting | Class on root |
|---|---|
| `enabled` | `.ASAPOn` |
| `compact` | `.ASAPCompact` |

The stylesheet does everything else:

```css
.ASAPOn .ability_container { opacity: 0.6; }
.ASAPOn .items .ability_container.item_passive.Hidden { visibility: visible; }
#gameplay_hud.UMM_ShowPassives .items .ability_container.item_passive.Hidden { visibility: visible; }
```

The third rule honours a `UMM_ShowPassives` class that Universal Mod Manager may set directly, so the
behaviour works whether it is driven by this mod or by the manager.

**No timers.** The script registers on the bus, applies its defaults once, and sends `register`. When
disabled it genuinely does nothing — the definition of "off means free"
([`../TECH_DEBT.md`](../TECH_DEBT.md) §2).

---

## Settings

UMM id `always_show_passives`:

| Key | Default | Widget | Description |
|---|---|---|---|
| `enabled` | `true` | toggle | Turn the mod off without uninstalling it |
| `compact` | `false` | toggle | Smaller icons |

---

## Known issues

- **The UMM toggle cannot turn the feature off** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D10.
  `hud_abilities.css:15-18` and `hud_ability_icon_passive.css:15-18` show hidden passives
  unconditionally, and `hud_ability_icon_passive.css:4-13` dims every `.ability_container`
  unconditionally, so the `.ASAPOn` gating is bypassed. Arrived with `9935d0c`; whether intended is
  a question for its author.
- Defaults to on, which is a deliberate exception justified by the zero runtime cost.
- `hud_abilities.css` and `hud_ability_icon_passive.css` each `@import` their baseline twice
  ([`../TECH_DEBT.md`](../TECH_DEBT.md) D7).

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §5 — why CSS-driven state beats polling
- [`../TECH_DEBT.md`](../TECH_DEBT.md) §2 — the loops that should have been written this way
