# Systems catalogue

> Every feature QOL Lite currently ships, what it owns, and whether the user can turn it off.
>
> **Audience:** anyone looking for "which files do I touch to change X".
> **Last verified:** 2026-09-30 against commit `78bbf2a`.

QOL Lite is a **collection**. Most features arrived as independent mods and were merged into one pack
so they could share Valve's HUD files rather than fight over them
([`../PANORAMA.md`](../PANORAMA.md) §3 — two VPKs cannot own one path).

The **Origin** column below says where a feature came from; [`../BUNDLE.md`](../BUNDLE.md) says who
wrote it, whether we can rebuild it, and whether we may change it at all.

---

## Catalogue

| Feature | Origin | Runs in | Off switch | Cost |
|---|---|---|---|---|
| [Minimap](minimap.md) | BetterMap | Match | ✅ UMM `bettermap`, but six loops ignore it | 6 loops, 33–2 Hz |
| [Event reminders](event-reminders.md) | Map Event Reminders | Match (overlay also in the dashboard) | ⚠️ UMM `eventnotifier`, but two loops ignore it | 3 standing loops, 5–4 Hz |
| [Top bar](top-bar.md) | Top Bar Plus | Match, hideout | ❌ none | 1 Hz + a 2 Hz loop per player row |
| [Statlocker button](statlocker.md) | Statlocker | — | — | **not loaded** — its script is included by no layout; the live Statlocker buttons are Friends Rank's |
| [Enhanced quickbuy](quickbuy.md) | Enhanced Quickbuy | Match | ⚠️ UMM `enhanced_quickbuy` hides it; the loop keeps running | 10 Hz, never stops |
| [Recent purchases](recent-purchases.md) | Recent Purchases | Shop | ✅ UMM `recent_purchases` | 10 Hz + 1 Hz, stop when off |
| [Always-show passives](passives.md) | Always Show Passives | Match | ⚠️ UMM `always_show_passives`, but unconditional rules defeat it | none — CSS only |
| [Leaderboard search](leaderboard-search.md) | — | Leaderboard popup | ❌ none | on keystroke |
| [Escape menu](escape-menu.md) | — | Match | ❌ none | none — layout only |
| [4×3 aspect ratio](aspect-ratio-4x3.md) | — | Everywhere | ❌ none | none — CSS only |
| [Asset optimizations](assets.md) | Several | Everywhere | ❌ n/a | negative — saves cost |
| Friends Rank — *no page yet* | unrecorded ([`../BUNDLE.md`](../BUNDLE.md) §5) | Profile page, profile cards, post-game | ❌ none | per-card watch, up to ~62 Hz ([`../TECH_DEBT.md`](../TECH_DEBT.md) D13); network |
| Ammo-buff notifier — *no page yet* | "Han" (commit message only) | — | — | **not shipped** since 2026-09-30, until it has a UMM off switch |
| ~~[Rank badges](show-rank.md)~~ | Show Rank | — | — | **removed** in `ecdacbb` |
| ~~[Hero testing tools](hero-testing.md)~~ | Advanced Testing Tools | — (the hideout uses Valve's own menu) | — | **removed** 2026-09-30 — crashed the game at 6722 |

**Off-switch legend:** ✅ registered with Universal Mod Manager · ⚠️ partially · ❌ always on, user
cannot decline. The ❌ rows in the *match* column are the open problem — see
[`../TECH_DEBT.md`](../TECH_DEBT.md) §3. Costs are the standing loops at default settings, from
[`../TECH_DEBT.md`](../TECH_DEBT.md) §2.

Two features in the pack have **no page** — Friends Rank (added in `27087ae`) and the ammo-buff
notifier (added in `9935d0c`, not shipped since 2026-09-30). Both predate the 6722 update; writing
their pages is open work.

---

## Ownership map

Which feature owns which Valve file. **Before adding a file under an existing Valve path, check this
table** — two features cannot both ship the same path.

| Valve path | Owned by |
|---|---|
| `layout/hud.xml` | [Minimap](minimap.md) (+ [passives](passives.md) script include; Valve's `CitadelHudHeroTesting` instance) |
| `layout/base_hud_and_db_overlay.xml` | [Event reminders](event-reminders.md) |
| `layout/citadel_hud_top_bar.xml` | [Top bar](top-bar.md), [event reminders](event-reminders.md) bridges |
| `layout/citadel_hud_top_bar_player.xml` | [Top bar](top-bar.md) (per-player row: script, `SpentSoulDisplay`, `.HeroNameHidden` label used by [recent purchases](recent-purchases.md)) |
| `layout/citadel_db_page_profile.xml`, `profile_card.xml`, `post_game/citadel_db_post_game_scoreboard_new.xml`, `post_game/citadel_db_post_game_team.xml` | Friends Rank (the MVP-card layout carries an open crash risk, [`../TECH_DEBT.md`](../TECH_DEBT.md) D17) |
| `layout/citadel_ui_context_menu_player.xml`, `players_list_entry.xml` | none — restored to Valve's markup when [Show Rank](show-rank.md) was removed; still overridden |
| `layout/hud_escape_menu.xml` | [Escape menu](escape-menu.md) |
| `layout/citadel_hud_hero_shop.xml`, `styles/citadel_hud_hero_shop.css` | [Recent purchases](recent-purchases.md) (the stylesheet also carries [4×3](aspect-ratio-4x3.md) rules) |
| `layout/hud_quickbuy.xml`, `hud_quickbuy_entry.xml` | [Quickbuy](quickbuy.md) |
| `layout/hud_hero_testing.xml`, `styles/hero_testing_menu.css` | **not shipped** — Valve's own files load since [hero testing](hero-testing.md) was removed; an override here must keep every id the engine reads ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §10) |
| `layout/citadel_db_page_training.xml` | unattributed — the Resources-page grid |
| `layout/citadel_hud_koth.xml` | added in `5adefb4` ("potential fix for lingering rift pop-up"); no feature page |
| `layout/popups/citadel_popup_global_leaderboard.xml` | [Leaderboard search](leaderboard-search.md) |
| `layout/popups/popup_settings.xml` | [4×3](aspect-ratio-4x3.md) + the Experimental Extended FOV slider (Maffinz, [`../BUNDLE.md`](../BUNDLE.md) §4; restored at the re-merge after `4bb5c0e` dropped it without its other parts) |
| `styles/hud_minimap.css` | [Minimap](minimap.md) |
| `styles/notif.css` | [Event reminders](event-reminders.md) |
| `styles/citadel_hud_top_bar.css`, `styles/topbar_rank_topbar.css` | [Top bar](top-bar.md). `topbar_rank_topbar.css` is a full fork of Valve's `citadel_hud_top_bar.css` plus Top Bar Plus's rules, and **the only top-bar sheet the player rows load** ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §2, §7) |
| `styles/hud_abilities.css`, `hud_ability_icon.css`, `hud_ability_icon_passive.css` | [Passives](passives.md), including the unconditional rules `9935d0c` added ([`../TECH_DEBT.md`](../TECH_DEBT.md) D10) |
| `styles/hud_event_indicator.css` | **unattributed** — damage-number restyle ([`../BUNDLE.md`](../BUNDLE.md) §5) |
| `styles/dashboard.css`, `styles/citadel_hud_koth.css`, `styles/hud_damage_report.css`, `styles/profile_card.css`, `styles/base.css`, `styles/citadel_base_styles.css`, `layout/hud_ability_icon.xml` | nobody — unmodified Valve 6722 copies ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4 lists all 15) |
| `layout/post_game/citadel_db_page_post_game.xml` | nobody — an old Valve page at a path the game no longer loads ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §4) |
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
