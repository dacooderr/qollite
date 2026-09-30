# Recent purchases

> Filterable feed of what every player has bought, with icons, plus per-hero purchase badges.
>
> **Origin:** Recent Purchases · **Runs in:** nowhere since `4bb5c0e` — not loaded, pending confirmation · **Off switch:** ✅ UMM `recent_purchases` (while loaded)
> **Last verified:** 2026-09-30 against branch `fix/remerge-6722` (uncommitted).

> ### ⚠️ Not loaded since `4bb5c0e` — pending the maintainer's confirmation
> `4bb5c0e` replaced `citadel_hud_hero_shop.xml` with Valve's 6722 file verbatim: both script
> includes, the `RecentPurchaseHeroImage` class and the `.recentModPurchaserHero` label are gone, and
> no other layout includes the scripts. `citadel_hud_hero_shop.css` was cut to an `@import` plus its
> 4×3 rules, dropping this feature's rules (lines 2385–2457 of the `1f0fe0f` copy). The removal is
> consistent across files, so the re-merge kept it, but it has not been confirmed. The scripts still
> ship and cost only weight ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4). To restore: take the layout's
> includes and snippet additions and those stylesheet rules back from `1f0fe0f`. The rest of this
> page describes the feature as it shipped until then.

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
| `panorama/layout/citadel_hud_hero_shop.xml` | Until `1f0fe0f`: loaded both scripts; added `class="RecentPurchaseHeroImage"` and a `.recentModPurchaserHero` label (`{s:recent_hero_name}`) to Valve's `RecentPurchase` snippet. **Now Valve 6722 verbatim** |
| `panorama/layout/citadel_hud_top_bar_player.xml` | Carries the mod-authored `.HeroNameHidden` label the per-hero badges walk up from — owned by the [top bar](top-bar.md) override; kept at the re-merge so the feature can come back |
| `panorama/scripts/qollite_recent_purchases.js` | Logic + UMM manifest — **included by no layout** |
| `panorama/scripts/qollite_recent_purchase_icons.js` | **~3,000-entry name → icon lookup table** (385 KB — the largest file in `panorama/scripts/`) — **included by no layout** |
| `panorama/styles/citadel_hud_hero_shop.css` | Override — imports `base/citadel_hud_hero_shop.vcss_c`; since `4bb5c0e` holds only the 4×3 rules, none of this feature's |
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

### Scheduling

While loaded: two loops, both stopped when UMM `enabled` is false (default **true**): 0.1 s (10 Hz)
for the feed and badges, and 1 s for a `FindChildTraverse("Hud")` from the root. In one of its states the 10 Hz loop
also searches the **whole UI** for `.HeroNameHidden` ([`../TECH_DEBT.md`](../TECH_DEBT.md) §2).

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

- **Not loaded since `4bb5c0e`**, pending confirmation (banner above). The rest of this list applies
  if it comes back.
- **The 3,018-entry icon table is unmaintainable by hand** and will rot with every patch. At 385 KB
  it is also the single heaviest script in the pack.
- Only reacts to what Valve paints into the shop panel; a class rename breaks it silently.
- One hero portrait the icon script uses, `images/heroes/tokamak_sm_psd`, was removed from the game in
  6711 — that hero's purchases show no portrait ([`../TECH_DEBT.md`](../TECH_DEBT.md) D16).
- A 10 Hz loop at default settings, in every match — cheap per tick but not free.
- Pre-existing: the mod's `.gShopOpen #RecentPurchasesPanel { visibility: visible }` out-specifies
  Valve's `CitadelTrainingPage #RecentPurchasesPanel { visibility: collapse }`.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) §5.

---

## See also

- [quickbuy](quickbuy.md) — same class of item-name fragility
