# Always-show passives

> Keeps passive and active item icons visible instead of hiding them during play.
>
> **Origin:** Always Show Passives & Actives · **Runs in:** every match · **Off switch:** ✅ UMM `always_show_passives`
> **Last verified:** 2026-08-05 against commit `ac57b17`.

**The cheapest feature in the mod, and the model the others should follow.** It costs one class
toggle and zero timers: all behaviour is CSS.

---

## What it does

- Reveals item passive and active icons that Valve hides during normal gameplay.
- Optional **compact** mode with smaller icons.

---

## Files

| Path | Role |
|---|---|
| `panorama/scripts/qollite_passive.js` | 2 lines minified — UMM manifest and two class toggles |
| `panorama/styles/hud_ability_icon_passive.css` | **116 lines** — imports the baseline, adds our rules |
| `panorama/styles/base/hud_ability_icon_passive.css` | 1,322 lines, pristine Valve baseline |
| `panorama/styles/hud_abilities.css` / `base/hud_abilities.css` | Same pattern |
| `panorama/styles/hud_ability_icon.css` / `base/hud_ability_icon.css` | Same pattern |

> This is the cleanest example of the `base/` pattern in the repo: a 116-line override over a
> 1,322-line baseline. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) § The `base/` pattern.

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

None known. Defaults to on, which is a deliberate exception justified by the zero runtime cost.

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §5 — why CSS-driven state beats polling
- [`../TECH_DEBT.md`](../TECH_DEBT.md) §2 — the loops that should have been written this way
