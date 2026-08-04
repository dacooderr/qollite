# Recent purchases

> Filterable feed of what every player has bought, with icons, plus per-hero purchase badges.
>
> **Origin:** Recent Purchases · **Runs in:** the shop · **Off switch:** ✅ UMM `recent_purchases`
> **Last verified:** 2026-08-05 against commit `ac57b17`.

---

## What it does

- Adds a collapsible **filter bar** to the shop's recent-purchases panel, with grouped toggles.
- Renders an **item icon** next to each purchase instead of bare text.
- Attaches a **`.QuickPurchasesPanel`** to each hero badge, so recent buys are visible per player.
- Suppresses itself in the hideout.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/citadel_hud_hero_shop.xml` | Loads both scripts |
| `panorama/scripts/qollite_recent_purchases.js` | Logic + UMM manifest |
| `panorama/scripts/qollite_recent_purchase_icons.js` | **~3,000-entry name → icon lookup table** (385 KB — the largest file in `panorama/scripts/`) |
| `panorama/styles/citadel_hud_hero_shop.css` | Override — imports `base/citadel_hud_hero_shop.vcss_c` |
| `panorama/styles/base/citadel_hud_hero_shop.css` | Pristine Valve baseline |

---

## How it works

### Reading the feed

There is no purchases API. The script scrapes Valve's own panels by class:

| Class | Yields |
|---|---|
| `.recentPurchase` | one purchase row |
| `.recentModPurchaseName` | item name, **as localized text** |
| `.recentTimePurchased` | timestamp |
| `.recentModPurchaserHero` | buyer |

Rows are deduplicated on `name + "|" + time`.

### The icon table

Because the name arrives localized, mapping it back to an asset requires a **name → texture URL
table in every supported language**. `qollite_recent_purchase_icons.js` is exactly that: **3,018
entries** covering English, Spanish, Italian, German, French and more.

```js
"A Bocajarro":  'url("s2r://panorama/images/items/weapon/close_quarters_psd.vtex")',
Abklingzeitraffer: 'url("s2r://panorama/images/items/spirit/improved_cooldown_psd.vtex")',
```

> ⚠️ **This is the mod's largest maintenance liability.** Every new item needs a row per language, and
> any Valve retranslation silently drops an icon. There is no generator — the table is hand-written.
> If this feature is ever reworked, generating the table from the game's own localization files should
> be the first thing on the list.

### Filter bar

Built at runtime with `$.CreatePanel`: a `#FiltersCollapseToggle`, a `#PurchaseFiltersContainer`, and
one `.PurchaseFilterToggle` per filter, grouped into `#FilterGroup_<name>` panels. Handlers are
attached with `$.RegisterEventHandler("Activated", …)` — the panel-targeted form.

### Per-hero badges

Walks up from each `.HeroNameHidden` label to find its `#HeroBadge`, reads `heroid`, calls
`SetDialogVariableInt("hero_id", …)`, and creates a `.QuickPurchasesPanel` child. A generation counter
guards against a rebuild landing after the tree has changed.

### Hideout suppression

`Game.GetMapInfo().map_display_name` against `hero_testing_hideout` / `hideout` / `dl_hideout`,
falling back to `connectedToHideout` / `InHideout` classes.

---

## Settings

UMM id `recent_purchases`:

| Key | Default | Widget |
|---|---|---|
| `enabled` | `true` | toggle |

---

## Known issues

- **The 3,018-entry icon table is unmaintainable by hand** and will rot with every patch. At 385 KB
  it is also the single heaviest script in the pack.
- Only reacts to what Valve paints into the shop panel; a class rename breaks it silently.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) D5.

---

## See also

- [quickbuy](quickbuy.md) — same class of item-name fragility
