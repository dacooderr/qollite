# Systems catalogue

> Every feature QOL Lite currently ships, what it owns, and whether the user can turn it off.
>
> **Audience:** anyone looking for "which files do I touch to change X".
> **Last verified:** 2026-08-05 against commit `ac57b17`.

QOL Lite is a **collection**. Most features arrived as independent mods and were merged into one pack
so they could share Valve's HUD files rather than fight over them
([`../PANORAMA.md`](../PANORAMA.md) §3 — two VPKs cannot own one path).

The **Origin** column below says where a feature came from; [`../BUNDLE.md`](../BUNDLE.md) says who
wrote it, whether we can rebuild it, and whether we may change it at all.

---

## Catalogue

| Feature | Origin | Runs in | Off switch | Cost |
|---|---|---|---|---|
| [Minimap](minimap.md) | BetterMap | Match | ✅ UMM `bettermap` | 4 loops, 33–4 Hz |
| [Event reminders](event-reminders.md) | Map Event Reminders | Match | ⚠️ UMM `eventnotifier`, but two loops ignore it | 4 loops, 5–4 Hz |
| [Top bar](top-bar.md) | Top Bar Plus | Match | ❌ none | variable-interval loop |
| [Rank badges](show-rank.md) | Show Rank | Match, menu, escape menu | ❌ none | 6 contexts + network |
| [Statlocker button](statlocker.md) | Statlocker | Profile page | ❌ none | 2 loops, menu only |
| [Enhanced quickbuy](quickbuy.md) | Enhanced Quickbuy | Match | ✅ UMM `enhanced_quickbuy` | event-driven |
| [Recent purchases](recent-purchases.md) | Recent Purchases | Shop | ✅ UMM `recent_purchases` | event-driven |
| [Always-show passives](passives.md) | Always Show Passives | Match | ✅ UMM `always_show_passives` | none — CSS only |
| [Hero testing tools](hero-testing.md) | Advanced Testing Tools | Hideout | ❌ none | 6 loops, hideout only |
| [Leaderboard search](leaderboard-search.md) | — | Leaderboard popup | ❌ none | on keystroke |
| [Escape menu](escape-menu.md) | — | Match | ❌ none | none — layout only |
| [4×3 aspect ratio](aspect-ratio-4x3.md) | — | Everywhere | ❌ none | none — CSS only |
| [Asset optimizations](assets.md) | Several | Everywhere | ❌ n/a | negative — saves cost |

**Off-switch legend:** ✅ registered with Universal Mod Manager · ⚠️ partially · ❌ always on, user
cannot decline. The ❌ rows in the *match* column are the open problem — see
[`../TECH_DEBT.md`](../TECH_DEBT.md) §3.

---

## Ownership map

Which feature owns which Valve file. **Before adding a file under an existing Valve path, check this
table** — two features cannot both ship the same path.

| Valve path | Owned by |
|---|---|
| `layout/hud.xml` | [Minimap](minimap.md) (+ [passives](passives.md) script include) |
| `layout/base_hud_and_db_overlay.xml` | [Event reminders](event-reminders.md) |
| `layout/citadel_hud_top_bar.xml` | [Top bar](top-bar.md), [rank badges](show-rank.md), [event reminders](event-reminders.md) bridges |
| `layout/citadel_hud_top_bar_player.xml`, `citadel_ui_context_menu_player.xml`, `players_list_entry.xml`, `profile_card.xml` | [Rank badges](show-rank.md) |
| `layout/hud_escape_menu.xml` | [Escape menu](escape-menu.md) + [rank badges](show-rank.md) |
| `layout/citadel_db_page_profile.xml` | [Statlocker](statlocker.md) |
| `layout/citadel_hud_hero_shop.xml` | [Recent purchases](recent-purchases.md) |
| `layout/hud_quickbuy.xml`, `hud_quickbuy_entry.xml` | [Quickbuy](quickbuy.md) |
| `layout/hud_hero_testing.xml` | [Hero testing](hero-testing.md) |
| `layout/popups/citadel_popup_global_leaderboard.xml` | [Leaderboard search](leaderboard-search.md) |
| `layout/popups/popup_settings.xml` | [4×3](aspect-ratio-4x3.md) |
| `styles/hud_minimap.css` | [Minimap](minimap.md) |
| `styles/notif.css` | [Event reminders](event-reminders.md) |
| `styles/topbar_rank_*.css` | [Rank badges](show-rank.md) |
| `models/`, `materials/`, `particles/` | [Asset optimizations](assets.md) |

---

## Page template

Each feature page follows the same shape, so you can skim to the section you need:

```markdown
# <Feature>

> One-line description. Origin · Runs in · Off switch · Last verified.

## What it does          user-visible behaviour
## Files                 exhaustive, grouped by kind
## How it works          the mechanism, with the panel ids and classes involved
## Settings              state fields, defaults, UMM mapping
## Known issues          links into ../TECH_DEBT.md
## See also
```

When you add a feature, add its page, add a catalogue row, and add its Valve paths to the ownership
map — in the same commit.
