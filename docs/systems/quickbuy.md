# Enhanced quickbuy

> Shows the queued item list on the HUD and cumulative costs in the shop.
>
> **Origin:** Enhanced Quickbuy · **Runs in:** every match · **Off switch:** ✅ UMM `enhanced_quickbuy`
> **Last verified:** 2026-09-30 against working tree on fix/patch-6711-rebase (uncommitted).

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
| `panorama/layout/hud_quickbuy.xml` | Adds `#QuickbuyUpcomingPreview2…5` slots and `#QuickbuyShopTotalSummary` |
| `panorama/layout/hud_quickbuy_entry.xml` | Single queue entry |
| `panorama/scripts/qollite_quickbuy.js` | All logic + UMM manifest |
| `panorama/styles/hud_quickbuy.css` | Override — imports `base/hud_quickbuy.vcss_c`, adds the preview, total and 4×3 rules |
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

### Layout since 6711

Valve wrapped its `#QuickbuyShopSummary` in a new `.QuickbuyShopSummaryContainer`
(`flow-children: right`, `margin-left: 90px`, `margin-top: 32px`). The mod's
`#QuickbuyShopTotalSummary` used to be a root-level sibling placed with absolute margins, which would
now overlap Valve's summary; it is now a **flow child inside the container, after
`#QuickbuyShopSummary`** (`hud_quickbuy.xml:117`), with `margin-left: 10px`. Valve's own button stays
where 6722 puts it, and hiding the total does not move it. The alternative — total before summary —
would reproduce the pre-patch on-screen order; that is a product choice.

Other rule changes carried at the rebase, all **inferred from CSS geometry, unverified in game**:

- `#QuickbuyNextSoulsNeeded` `margin-left` 454 → 394 px and `#QuickbuyUpcomingPreviewContainer`
  534 → 474 px, following Valve's move of the mini box (`.HudQuickbuyElement` 454 → 390 px, `#HudMini`
  now 74×94).
- `#HudMini` keeps the mod's `opacity: 0.35` (Valve: 0.2) with Valve's new size.
- `.item_draft_enabled #QuickbuyShopTotalSummary` → `.gStreetBrawl #QuickbuyShopTotalSummary`,
  mirroring Valve's own rename.
- The 4×3 shift now targets `.QuickbuyShopSummaryContainer` (see [4×3](aspect-ratio-4x3.md)).

### Reading the queue

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

- **The loop never stops.** `C()` re-arms every 0.1 s unconditionally; UMM `enabled` only affects
  what is displayed. Per tick it does ~12–15 `FindChildTraverse`, walks both queues, and searches for
  `CurrentGoldAmount` at every ancestor level — [`../TECH_DEBT.md`](../TECH_DEBT.md) §2. Not listed
  in the polling budget before 2026-09-30.
- **Defaults to on**, unlike most of the mod — a deliberate exception to the default-off rule, not an
  oversight to copy. With the loop above it is not "low-cost".
- `world-blur` on `#QuickbuyNextSoulsNeeded` and every visible `.QuickbuyUpcomingPreviewSoulsNeeded`
  — three blurred panels in normal play at the default preview count
  ([`../TECH_DEBT.md`](../TECH_DEBT.md) D14).
- Valve's 6722 `#KeyboardHints` (`margin-left: 365px`, shown in the shop zone when items are ready)
  may overlap the mod's preview container. Unverified.
- The three item tables are hand-maintained and patch-fragile.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) §5.

---

## See also

- [recent purchases](recent-purchases.md) — the other shop feature, with the same
  name-table fragility
