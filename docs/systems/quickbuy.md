# Enhanced quickbuy

> Shows the queued item list on the HUD and cumulative costs in the shop.
>
> **Origin:** Enhanced Quickbuy · **Runs in:** every match · **Off switch:** ✅ UMM `enhanced_quickbuy`
> **Last verified:** 2026-08-05 against commit `ac57b17`.

---

## What it does

- Extends the quickbuy preview from one upcoming item to up to **five**, on the HUD during normal
  play — not just in the shop.
- Shows each queued item's **cumulative** soul cost beside it in the shop.
- Shows the **total** cost of the whole queue.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/hud_quickbuy.xml` | Adds `#QuickbuyUpcomingPreview2…5` slots |
| `panorama/layout/hud_quickbuy_entry.xml` | Single queue entry |
| `panorama/scripts/qollite_quickbuy.js` | All logic + UMM manifest |
| `panorama/styles/hud_quickbuy.css` | Override — imports `base/hud_quickbuy.vcss_c`, adds 4×3 rules |
| `panorama/styles/base/hud_quickbuy.css` | Pristine Valve baseline |
| `panorama/styles/hud_quickbuy_entry.css` | Entry styling |

---

## How it works

Each extra preview slot is a fixed triple of panel ids bound to a queue index:

| Root | Entry | Souls label | Queue index |
|---|---|---|---:|
| `#QuickbuyUpcomingPreview2` | `#QuickbuyPreview2Entry` | `#QuickbuyUpcomingPreview2SoulsNeededLabel` | 1 |
| `#QuickbuyUpcomingPreview3` | `#QuickbuyPreview3Entry` | `#QuickbuyUpcomingPreview3SoulsNeededLabel` | 2 |
| `#QuickbuyUpcomingPreview4` | `#QuickbuyPreview4Entry` | `#QuickbuyUpcomingPreview4SoulsNeededLabel` | 3 |
| `#QuickbuyUpcomingPreview5` | `#QuickbuyPreview5Entry` | `#QuickbuyUpcomingPreview5SoulsNeededLabel` | 4 |

The queue itself is read out of Valve's own panels — there is no items API — so the script carries
three hard-coded tables to survive the game's naming:

1. **Rename aliases** for items Valve has renamed, e.g. `basic magazine` → `extended magazine`,
   `improved cooldown` → `compress cooldown`, `spellslinger headshots` → `spirit rend`.
2. **Icon overrides** where the renamed item's texture path did not follow the rename.
3. **A component map**, item → its prerequisite components (`Alchemical Seal` → `Mystic Reach`,
   `Leech` → `Bullet Lifesteal` + `Spirit Lifesteal`, …), used to compute cumulative cost.

> ⚠️ **These tables go stale on every balance patch.** New items are invisible to the cost maths and
> renamed items lose their icons. There is no generator — re-verify them after each item change.

---

## Settings

UMM id `enhanced_quickbuy`:

| Key | Default | Widget | Description |
|---|---|---|---|
| `enabled` | `true` | toggle | Enable all Enhanced Quickbuy features |
| *(group)* | | | **Display** |
| `show_hud_items` | `true` | toggle | Show queued items during normal gameplay |
| `preview_count` | `3` | slider 1–5 | Items shown on the HUD, including the next one |
| *(group)* | | | **Shop** |
| `show_queue_costs` | `true` | toggle | Cumulative cost beside each queued item |
| `show_shop_total` | `true` | toggle | Total cost of the queue |

---

## Known issues

- **Defaults to on**, unlike most of the mod. Reasonable for a low-cost shop feature, but it is a
  deliberate exception to the default-off rule, not an oversight to copy.
- The three item tables are hand-maintained and patch-fragile.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) D5.

---

## See also

- [recent purchases](recent-purchases.md) — the other shop feature, with the same
  name-table fragility
