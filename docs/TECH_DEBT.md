# Tech debt and known traps

> Real problems in shipped code, with evidence. Not a wishlist — every entry names a file and a
> concrete harm.
>
> **Audience:** anyone planning work, and anyone reviewing a change.
> **Status:** open ledger.
> **Last verified:** 2026-09-30 against commit `60b6645` — game build 6722.

Severity reflects impact on the project's two design goals — *small footprint* and *low runtime
cost* ([`README.md`](README.md) § Design goals).

**Evidence labels.** *Verified by reading* means the file and line were read and say what the entry
claims. *Unmeasured* means the cost is inferred from the call pattern — no frame-time measurement
exists for anything in this file. Nothing here was observed in game.

**Contents**

1. [At a glance](#1-at-a-glance)
2. [Polling budget](#2-polling-budget)
3. [Features with no off switch](#3-features-with-no-off-switch)
4. [Dead files](#4-dead-files)
5. [Source provenance](#5-source-provenance)
6. [No attribution for bundled work](#6-no-attribution-for-bundled-work)
7. [Bugs found at the 6722 update](#7-bugs-found-at-the-6722-update)
8. [Smaller items](#8-smaller-items)
9. [Recording a new entry](#9-recording-a-new-entry)

---

## 1. At a glance

| # | Item | Severity | Goal at risk | Status |
|---|---|---|---|---|
| [D1](#d1-loops-run-while-their-feature-is-off) | Loops run while their feature is off | **High** | Runtime cost | Open (upstream BetterMap) |
| [D2](#d2-two-loops-ignore-their-config-entirely) | Two loops never check config at all | **High** | Runtime cost | Open (upstream Map Event Reminders) |
| [D3](#3-features-with-no-off-switch) | Always-on features with no UMM entry | **High** | Runtime cost | Open |
| [D4](#4-dead-files) | Files that ship but nothing loads | Medium | Footprint | Open — grew in `4bb5c0e` |
| [D5](#5-source-provenance) | Readable script source is not in this repo | **High** | Maintainability | Resolved for the two first-party mods; open for the rest |
| [D6](#d6-debug-logging-was-on-by-default) | Debug logging on by default | Low | Runtime cost | **Resolved** 2026-09-30 |
| [D7](#d7-duplicate-import) | Duplicate `@import` | Low | Footprint | Open (2 of 3 files) |
| [D9](#6-no-attribution-for-bundled-work) | No attribution for bundled third-party work | **High** | Licensing | Open |
| [D10](#d10-the-passives-toggle-cannot-turn-passives-off) | Passives UMM toggle cannot turn the feature off | Medium | Opt-in model | Open |
| [D11](#d11-ammo-notifier-looks-up-an-id-with-the-wrong-case) | Ammo notifier looks up `abilitiesContainer`, the id is `AbilitiesContainer` | Low | Correctness | **Resolved by removal** in `4bb5c0e`, pending confirmation |
| [D12](#d12-hero-testing-loads-in-every-match) | Hero testing loads in every match, not only the hideout | Medium | Runtime cost | **Resolved by removal** in `4bb5c0e`, pending confirmation |
| [D13](#d13-friends-rank-popup-watch-polls-at-frame-rate) | Friends Rank popup watch re-arms every 0.016 s | Medium | Runtime cost | Open, unmeasured |
| [D14](#d14-blur-on-always-present-hud-panels) | `world-blur` on HUD panels that are always present | Low | Runtime cost | Open, unmeasured |
| [D15](#d15-damage-number-glow-times-longer-lifetimes) | Damage-number glow × Valve's longer indicator lifetimes | Low | Runtime cost | Open, unmeasured |
| [D16](#d16-calls-and-textures-the-game-no-longer-has) | Calls and textures the game no longer has | Low | Correctness | Open |

---

## 2. Polling budget

`$.Schedule` self-recursion is the only timer Panorama offers
([`PANORAMA.md`](PANORAMA.md) §4), so it is also the only way this mod can waste frames. This table is
the standing cost **with every optional feature at its default**. Rebuilt 2026-09-30 from the scripts
the layouts on branch `fix/remerge-6722` include; *work per tick* is read from the code, **none of it
is measured**.

Keep it current: **any change that adds, removes, or re-times a loop updates this table in the same
commit.**

A lookup that runs from the **root** (`$.GetContextPanel()` walked to the top, or the HUD root)
searches the whole tree; when its target does not exist it visits every panel before returning
([`FIELD_NOTES.md`](FIELD_NOTES.md) §8).

### `hud.xml` — every match

| Loop | Interval | Rate | Work per tick | Stops when off? |
|---|---:|---:|---|---|
| `qollite_map_settings.js` → `_pollDetailView` | 0.03 s | ~33 Hz | 8 `FindChildTraverse` (the `#minimap_persp` ancestor walk plus 7 ids) to decide whether the detail view is open; while TAB is held, also `applyCurrentSize` (6 lookups, 10 style writes) | **No** — keeps running after UMM retires the in-HUD panel |
| `qollite_map_size.js` → `_pollMapTargeting` | 0.06 s | ~17 Hz | One anchor lookup plus an ancestor walk for `.map_targeting`, only if `ultLargeMapEnabled` — which **defaults to on** | Loop always runs; lookup gated |
| `qollite_map_urn.js` → `_poll` | 0.15 s | ~7 Hz | `#GameTime`, then up to 6 `FindChildrenWithClassTraverse` **from the root** (`idol_spawn` + 5 live classes) | **No** — runs with the tracker off (it keeps observing the urn side) |
| `qollite_map_poi.js` → `_pollLevel` | 0.25 s | 4 Hz | 3 anchor lookups (underground, tunnels, inverted) + `#GameTime` | **No** — runs with every POI layer off |
| `qollite_map_preview.js` → `_poll` | 0.25 s | 4 Hz | `JSON.stringify` of the state + 1 lookup + ancestor walk (new in BetterMap 2.1) | **No** |
| `qollite_map_player.js` → `_pollZoom` | 0.5 s | 2 Hz | 1 lookup; anchor walk only when the icon scale is not 100 % (new in BetterMap 2.1) | **No** |
| `qollite_map_minimap.js` → `_probeClasses` | 0.5 s | — | DEBUG-only diagnostics | ✅ Never scheduled while `DEBUG = false` (as bundled) |
| `qollite_map_bootstrap.js` → `tryInit` | 0.05 s | — | `typeof` checks | ✅ Stops after init or 20 tries |
| `qollite_passive.js` | — | — | no loop | ✅ |

Compared with the previous bundle (BetterMap `60fa437`, DEBUG on) the map scripts no longer walk the
whole tree looking for the deleted `#map_render` (17×/s in `size`, 4×/s in `poi`), and the urn
tracker's DEBUG-only scans are gone. On an offline mock of the HUD tree that took total tree searches
from ~385/s to ~352/s — a relative figure, not an engine measurement. What did **not** change is D1:
six loops that run with their feature off (two of them new in 2.1), all upstream design.

### `hud_quickbuy.xml` — every match

| Loop | Interval | Rate | Work per tick | Stops when off? |
|---|---:|---:|---|---|
| `qollite_quickbuy.js` → `C()` | 0.1 s | 10 Hz | ~12–15 `FindChildTraverse`, a recursive walk of `#QuickbuyQueue` + `#QuickbuySellQueue`, and a `FindChildTraverse("CurrentGoldAmount")` **at every ancestor level** until one contains it | **No** — re-arms unconditionally; UMM `enabled` only affects display |

### `base_hud_and_db_overlay.xml` — match and dashboard

| Loop | Interval | Rate | Work per tick | Stops when off? |
|---|---:|---:|---|---|
| `qollite_notifications_bootstrap.js` → `tick()` | 0.25 s | 4 Hz | `getMatchTime()`; `Scheduler.tick` runs only on a fresh clock and returns at once when `enabled` is false | **No** — loop unconditional, also in the dashboard |
| `qollite_notifications_bootstrap.js` → `step()` | 0.25 s | — | urn landing countdown | ✅ Only while a descent runs (12 s game time, 30 s wall cap) |
| `qollite_notifications_manager.js` → `sweep()` | 0.25 s | 4 Hz | Expires visible notices | ✅ **Self-limiting** — re-arms only while a notice is on screen. *The pattern to copy — [`PANORAMA.md`](PANORAMA.md) §4.* |
| `qollite_notifications_bootstrap.js` → `wait()` | 0.1 s | — | dependency wait | ✅ Max 200 tries |

### `citadel_hud_top_bar.xml` — every match, and the hideout

| Loop | Interval | Rate | Work per tick | Stops when off? |
|---|---:|---:|---|---|
| `qollite_notifications_clock_bridge.js` → `loop()` | 0.25 s | 4 Hz | Two ancestor walks and two root walks with `FindChildTraverse("Hud")` (hideout and Street Brawl checks), `#GameTime` parse, **a bus broadcast** that wakes every listener in every context | **No — the file never reads config** (D2) |
| `qollite_notifications_clock_bridge.js` → `announceLang()` | 1 s | — | language broadcast | ✅ 5 times, then stops |
| `qollite_notifications_urn_detector.js` → `poll()` | 0.2 s | 5 Hz | Up to **6** `FindChildrenWithClassTraverse` over the whole HUD (`idol_spawn`, then the 5 live classes, short-circuiting on the first hit) — up to 30 whole-tree class searches a second while no urn is on the map | **No — the file never reads config** (D2) |
| `qollite_topbar.js` → `ba()` | 1 s | 1 Hz | Clock read: its 0.8 s cache always expires between 1 s ticks, so every tick searches the whole UI for `HudGameTime` — an id that exists nowhere — before falling back to `#GameTime` | Generation-guarded; no setting |
| `qollite_topbar.js` → `da()` → `ca()` | 0.5 s | — | Setup retry. It re-arms only when a branch's ids were found (`BuffTime` + `RejuvTime` + `UrnTrackerLabel` for the top bar, `SpentSoulDisplay` + `PlayerModsContainer` for a row) but setup failed. With neither set present it does nothing and does **not** retry | Bounded by the ids, which exist in the layouts on this branch |

### `citadel_hud_top_bar_player.xml` — **once per player row**

| Loop | Interval | Rate | Work per tick | Stops when off? |
|---|---:|---:|---|---|
| `qollite_topbar.js` → `fa()` | 0.5 s | 2 Hz **× 12 rows** | JS walk of the row's whole `#PlayerModsContainer` subtree, `BHasClass` + `GetAttributeString("class")` per node | Generation-guarded; no setting |

The same script is included by the top bar and by each row, so a 12-player match runs 13 copies
([`FIELD_NOTES.md`](FIELD_NOTES.md) §5).

### Menus and popups

| Loop | Interval | Rate | Work per tick | Stops? |
|---|---:|---:|---|---|
| `friends_rank.js` active watch, **popup** (`profile_card.xml`, per instance) | 0.016 s for the first 8 s, then 0.1 s | ~62 Hz, then 10 Hz | `snapshot()` — account, name and presence reads from the card | **Only when the card becomes invalid or its token changes** — no time limit after the first 8 s (D13) |
| `friends_rank.js` active watch, **profile page** | 0.2 s for 2.5 s, then 0.5 s | 5 Hz → 2 Hz | same | ✅ Stops after 8 s |
| `friends_rank_scoreboard.js` | 0.15 s | — | binds the post-game buttons | ✅ 8 tries |
| `qollite_leaderboard.js` | — | — | on keystroke | ✅ |

### Not running

Loops in scripts no layout includes, so they never start (§4):

| Script | Loops it would run | Not included since |
|---|---|---|
| `qollite_profile.js` | 1 s, 0.35 s while the profile page shows | `9935d0c` |
| `qollite_recent_purchases.js` | `ja()` 0.1 s (10 Hz, class searches, in one state over the whole UI) and `na()` 1 s (`FindChildTraverse("Hud")` from the root); both gated on UMM `enabled` | `4bb5c0e` |
| `mercurial_magnum_notifier.js` | 20 Hz / 2 Hz with root-level searches every 0.5 s, no setting | `4bb5c0e` |
| `qollite_hero_testing.js` | four bounded loops at 0.2 s and two at 0.5 s | `4bb5c0e` |

The last three were removed with their features' markup in `4bb5c0e`, pending the maintainer's
confirmation. If a feature comes back, its loop comes back into the tables above.

### D1. Loops run while their feature is off

**Severity: High. Status: open — upstream BetterMap. Files:** `qollite_map_settings.js`,
`qollite_map_size.js`, `qollite_map_urn.js`, `qollite_map_poi.js`, `qollite_map_preview.js`,
`qollite_map_player.js`.

The POI overlay and urn tracker default to **off** (`qollite_map_state.js`: `poiCratesEnabled`,
`poiStatuesEnabled`, `poiToughEnabled`, `urnTrackerEnabled` all `false`). Their loops run anyway — the
flag is checked *inside* the tick, after the wakeup and often after the tree walk. BetterMap 2.1 added
two more always-on loops (`preview`, `player`), cheap but unconditional. Six loops in total run with
every optional feature off.

**Fix (upstream, then re-bundle — the bundle is regenerated, [`BUNDLE.md`](BUNDLE.md) §3):** check the
flag before re-arming, and restart the loop from the setting's change handler.

```js
function tick() {
    if (!State.get().featureEnabled) { running = false; return; }   // stop, don't re-arm
    doWork();
    $.Schedule(0.25, tick);
}
function setEnabled(on) {
    State.patch({ featureEnabled: on });
    if (on && !running) { running = true; tick(); }
}
```

Proposals recorded at the re-bundle, in order of expected win:

1. `settings._pollDetailView` (33 Hz, 8 searches a tick, forever) — cache the panels once
   (`IsValid()`-checked) and/or react to the existing `GlobalClassListener` classes; stop while UMM
   is active, since the panel is retired then.
2. `urn._poll` — do not schedule while `urnTrackerEnabled` is false (re-seed on enable), or search from
   `#hud_minimap` instead of the context root.
3. `poi._pollLevel` — stop with all POI layers off; `QolLiteMapMinimap.anchor()` re-searches the tree
   three times per poi tick and once per size and player tick — cache the anchor.
4. `ultLargeMapEnabled` defaults on, so the 17 Hz targeting poll does real work for everyone.

### D2. Two loops ignore their config entirely

**Severity: High. Status: open — not fixed upstream as of Map Event Reminders `12e6b3b`. Files:**
`qollite_notifications_clock_bridge.js`, `qollite_notifications_urn_detector.js`.

Neither file references `QolLiteNotificationsConfig`. Both start unconditionally at load and never
stop (verified by reading the bundled `12e6b3b` source):

- The bridge **broadcasts on `ClientUI_FireOutput` four times a second**, which wakes every listener
  in every Panorama context — including the UMM cores and any other mod on the bus. Since upstream
  `4a5aa89` it also walks to the root twice a tick for its hideout and Street Brawl checks.
- The urn detector runs up to six `FindChildrenWithClassTraverse` over the whole HUD, five times a
  second.

A user who has disabled Map Event Reminders in UMM pays the full cost of both, forever.

**Fix (upstream, then re-bundle):**

1. **Gate both bridges.** The overlay pushes `{notif:1,type:"cfg",enabled,urn}` on UMM
   `set`/`register`; the bridges stop re-arming when disabled and restart on enable. They live in a
   different context from the config, so the state has to travel over the bus. Largest win.
2. `notif_urn.js`: `idol_spawn` is searched twice per tick (`spawnActive` and the first entry of
   `LIVE_CLASSES`) — reuse the result (6 → 5 searches); search from a cached `#hud_minimap` instead of
   the root.
3. `notif_clock.js` → `onMessage` `JSON.parse`s every bus message with no substring guard — add
   `indexOf('"clock"')` ([`UMM.md`](UMM.md) § The receive idiom).
4. `notif_clock_bridge.js`: cache the `#Hud` panel instead of two root walks per tick.

(The previous bundle's one-time `#map_render` lookup in the urn detector was a first-tick diagnostic,
not a per-tick cost; upstream `12e6b3b` removed it.)

---

## 3. Features with no off switch

**Severity: High.** See [`UMM.md`](UMM.md) §4 for the full table.

These run in every match with **no UMM registration and no setting anywhere** (verified by reading
each script for a `"umm"` register):

| Feature | Script(s) | Standing cost (§2) |
|---|---|---|
| [Top bar](systems/top-bar.md) | `qollite_topbar.js` | 1 Hz + 13 copies of a 2 Hz loop |
| Friends Rank (no page yet) | `friends_rank*.js` | Profile page and per profile card; calls `api.deadlock-api.com` — [`BUNDLE.md`](BUNDLE.md) § Third-party services |

[Show Rank](systems/show-rank.md), previously the largest item here, was removed in `ecdacbb`. The
ammo-buff notifier (20 Hz / 2 Hz, root-level searches) and the mod's [hero testing](systems/hero-testing.md)
panel were on this list until `4bb5c0e` stopped loading them — removed pending the maintainer's
confirmation (§2 Not running).

**Fix:** register each with UMM. Whether they default on or off is a product decision; *having the
switch* is not optional if opt-in is what keeps the runtime cost defensible.

---

## 4. Dead files

**Severity: Medium (footprint).** Measured 2026-09-30.

### Loaded by nothing

No layout `<include>`, no `@import`, no script reference anywhere in the repo:

| File | Size |
|---|---:|
| `panorama/styles/base/citadel_hud_top_bar.css` | 3,135 lines |
| `panorama/styles/topbar_rank_base/citadel_hud_top_bar.css` | 3,135 lines |
| `panorama/styles/base/citadel_hud_top_bar_chat.css` | 561 lines |
| `panorama/scripts/qollite_profile.js` — include dropped from `citadel_db_page_profile.xml` in `9935d0c` | 4.2 KB |
| `panorama/images/statlocker/statlocker.png` + `.vtex` — referenced only by `qollite_profile.js` | |
| `panorama/images/minimap/qollite_tunnels.png` + `.vtex` — its last rule targeted Valve's `shop_tunnel` class, gone since 6711, and was dropped at the rebase | 780 KB |
| `materials/minimap/neutral_vault.png` | 916 B |
| `panorama/styles/ability_hud_elements/hero_testing_menu.css` — referenced by no layout since the `959f80e` import (the testing layout loads `styles/hero_testing_menu`) | 439 lines |
| `panorama/layout/post_game/citadel_db_page_post_game.xml` — added in `4bb5c0e` at a path Valve dropped in 6711 ([`ARCHITECTURE.md`](ARCHITECTURE.md) §4) | 53 lines |

**Not loaded since `4bb5c0e`** — the features' layouts went back to Valve 6722, taking the includes
with them. Removed **pending the maintainer's confirmation**, so the files are kept until then:

| File | Size |
|---|---:|
| `panorama/scripts/qollite_recent_purchases.js` ([recent purchases](systems/recent-purchases.md)) | 10.6 KB |
| `panorama/scripts/qollite_recent_purchase_icons.js` — the 3,018-entry icon table | 385 KB |
| `panorama/scripts/mercurial_magnum_notifier.js` (ammo-buff notifier) | 7.1 KB |
| `panorama/styles/mercurial_magnum_notifier.css` | 124 lines |
| `panorama/images/mercurial_magnum/`, `split_shot/`, `blood_tribute/` — the notifier's three icons (`.png` + `.vtex`) | 57 KB |
| `panorama/scripts/qollite_hero_testing.js` ([hero testing](systems/hero-testing.md)) | 29.7 KB |

Deleting them is the step that makes the removal final ([`BUNDLE.md`](BUNDLE.md) §8); restoring a
feature means restoring its layout markup and includes from `1f0fe0f`.

The three stylesheets live under mod-invented directories, so unlike a Valve path they are not loaded
implicitly — nothing can reach them. They are almost certainly leftovers from an earlier merge of the
top-bar mods, when the override still `@import`ed its baseline. They were nevertheless refreshed to
6722 by the rebase (the tool treats every `base/` copy the same).

`qollite_profile.js` would not work if it were included: the class it injects its button next to,
`coreRating`, exists in no layout, stylesheet or script of build 6701 or 6722 (verified by grep and
against `client_strings.txt`). Its Statlocker button is superseded by Friends Rank's — see
[Statlocker](systems/statlocker.md).

**Before deleting:** confirm against the compiled VPK that no `.vcss_c` references them, since this
repo holds decompiled output and an import could in principle have been flattened away
([`ARCHITECTURE.md`](ARCHITECTURE.md) § The `base/` pattern).

### Referenced, but inert

`panorama/images/minimap/base/neutral_{large,medium,vault}_custom_png.*` are referenced only by
`.dmm_custom_neutral_*_icon` rules in `hud.css`. No script or layout, here or in upstream BetterMap,
ever sets a `dmm_custom_*` class, so the rules never match.

### Overrides with no mod change

These ship at a Valve path but are Valve 6722's content with no mod change (diffed against the 6722
files on 2026-09-30, header line and `.vcss`/`.vcss_c` form ignored). Shipping them only overrides
Valve with Valve — and goes stale on every patch ([`FIELD_NOTES.md`](FIELD_NOTES.md) §6):

| File | Lines | Added in |
|---|---:|---|
| `panorama/styles/hud_damage_report.css` | 1,142 | `959f80e` (import) — no doc or commit explains it |
| `panorama/styles/profile_card.css` | 774 | re-added in `27087ae` after `ecdacbb` removed it |
| `panorama/styles/dashboard.css` | 1,654 | `cb1ea87` "fixed safe to abandon pop-up" |
| `panorama/styles/citadel_hud_koth.css`, `layout/citadel_hud_koth.xml` | 951, 44 | `5adefb4` "potential fix for lingering rift pop-up" |
| `panorama/styles/citadel_base_styles.css` — Valve's global sheet, loaded by almost every layout | 5,733 | `4bb5c0e` |
| `panorama/styles/base.css`, `layout/hud_ability_icon.xml` | 33, 50 | `4bb5c0e` |
| `panorama/layout/ability_hud_elements/element_gun.xml`, `citadel_hud_hero_shop.xml`, `hud_hero_testing.xml`, `post_game/citadel_db_post_game_team.xml`, `styles/hero_testing_menu.css` | 68, 137, 748, 53, 1,100 | older; reset to Valve 6722 in `4bb5c0e` when their features were removed |
| `panorama/layout/citadel_db_page_news_entry.xml`, `citadel_ui_context_menu_player.xml`, `citadel_ui_modified_{abilities,stats}_panel.xml`, `players_list_entry.xml`, `styles/citadel_hero_stats_armor_panel.css`, `styles/popups/citadel_popup_global_leaderboard.css` | small | `959f80e` (import); not listed here before this measurement |

`hud_damage_report.css` and `profile_card.css` are candidates for deletion. `dashboard.css` and the
koth pair were added deliberately as fixes; whether shipping a newer Valve copy was the fix, and
whether it is still needed on 6722, is a question for their author — do not remove them without
asking. The same goes for the `4bb5c0e` additions: `citadel_base_styles.css` pins Valve's global
sheet and will silently hold back the next patch's changes to it, so it needs a reason to stay.

---

## 5. Source provenance

**Severity: High (maintainability). Status: resolved for the two first-party mods on 2026-09-30.**

The map and notification scripts are now readable upstream source, regenerated by
`scripts/bundle_bettermap.py` and `scripts/bundle_mer.py` from recorded commits
([`BUNDLE.md`](BUNDLE.md) §3). Layouts and stylesheets are still Source 2 Viewer decompiles. Full
detail in [`ARCHITECTURE.md`](ARCHITECTURE.md) § Provenance.

Still open: `qollite_topbar`, `qollite_quickbuy`, `qollite_recent_purchases`,
`qollite_recent_purchase_icons`, `qollite_hero_testing`, `qollite_leaderboard`, `qollite_passive`,
`mercurial_magnum_notifier` are minified with **unknown** upstream source, and `friends_rank*.js` is
readable but its origin is not recorded. For these:

- Script changes cannot be reviewed meaningfully, and any hand-edit is silently discarded the next
  time real source is compiled.
- There is no way to tell, from this repo alone, whether a given file is current with its upstream.

**Fix:** record where each script's source lives and what regenerates it.

---

## 6. No attribution for bundled work

**Severity: High (licensing).** The repository is licensed **GPL-3.0** and contains **no attribution
of any kind** — no per-feature authors, no upstream links, no per-mod licenses, no credits in the
README. Roughly nine of the bundled features were written by other people.

This is a problem in two directions at once:

- **Practically**, a vendored mod cannot be updated if nobody recorded which version is bundled or
  where the canonical version lives. Today that is true of every third-party feature in the pack.
- **Legally**, a repo-wide GPL-3.0 reads as a claim over work we do not own, and if any bundled mod
  is itself GPL-licensed, redistributing it carries a corresponding-source obligation that shipping
  minified artifacts does not satisfy.

Our own two bundled mods additionally declare **no license upstream**, which under default copyright
means all rights reserved — an awkward fit under a GPL-3.0 root, and the one part of this that is
entirely within our control to fix.

**Fix:** fill in [`BUNDLE.md`](BUNDLE.md) §4 — author, upstream, version, and license per feature —
then add a credits section to the README and revisit the root `LICENSE` once the picture is clear.
Filling in the manifest is most of the work either way: you cannot ask an author's permission if you
do not know who they are.

---

## 7. Bugs found at the 6722 update

None of these was caused by the patch; each was found while checking the overrides against it. The
patch-caused breakage was fixed in the rebase itself.

### D10. The passives toggle cannot turn passives off

**Severity: Medium. Verified by reading.** `panorama/styles/hud_abilities.css:14-18` — a second
`@import` after the rules, then an **unconditional**
`.items .ability_container.item_passive.Hidden { visibility: visible; }`. The same unconditional rule
is in `panorama/styles/hud_ability_icon_passive.css:15-18`, next to an unconditional
`.ability_container { … opacity: 0.6; }` at `:4-13`. Both arrived with `9935d0c` ("Added new mod from
Han"). They make the `.ASAPOn` / `UMM_ShowPassives` gating in the same files meaningless: passives are
always shown and the UMM `always_show_passives` → `enabled` toggle cannot turn the feature off.

**Fix:** ask the author whether this was intentional; if not, delete the unconditional rules and the
second `@import`, leaving the gated ones.

### D11. Ammo notifier looks up an id with the wrong case

**Status: resolved by removal in `4bb5c0e`, pending the maintainer's confirmation** — no layout
includes the script any more (§4). If the feature comes back, this entry applies again.

**Severity: Low. Verified by reading; effect unknown.** `mercurial_magnum_notifier.js` calls
`FindChildTraverse("abilitiesContainer")`. In `hud.xml` the id is `AbilitiesContainer` and
`abilitiesContainer` is its **class** (`hud.xml:558`), the same before and after the patch. Whether
Panorama's id lookup is case-insensitive is unknown; if it is not, Blood Tribute detection never
worked, and the failed lookup is a whole-tree search every 0.5 s. Vendored — report upstream.

### D12. Hero testing loads in every match

**Status: resolved by removal in `4bb5c0e`, pending the maintainer's confirmation.**
`hud_hero_testing.xml` and `hero_testing_menu.css` are Valve 6722's native testing menu verbatim
(748 and 1,100 lines, no script include), so nothing of the mod loads per match any more; what loads
is what vanilla loads. The entry below describes the mod's panel as it shipped until `1f0fe0f`.

**Severity: Medium. Inferred, unmeasured.** `hud.xml:486` instantiates
`<CitadelHudHeroTesting id="hud_hero_testing" />` unconditionally, as Valve's own `hud.xml` does, so
`hud_hero_testing.xml` (1,409 lines) and `qollite_hero_testing.js` load with every HUD unless the C++
defers loading — which is unknown. On load the script runs a one-time walk of the whole tool tree,
two 0.2 s lookups and a 60-second 0.5 s poll. All bounded — but it contradicts "hideout only", which
the docs used to state as fact. Measure (or read the console for the script's first log line in a
normal match) before deciding whether it matters.

### D13. Friends Rank popup watch polls at frame rate

**Severity: Medium. Verified by reading `friends_rank.js:807-822`; unmeasured.** For a profile card
(`profile_card.xml`, instantiated per card), `startActiveWatch` re-arms every
`popupGuardIntervalSeconds` = **0.016 s** for the first 8 s, then every `popupPollSeconds` = 0.1 s with
no time limit — it stops only when the card is no longer valid or a newer request replaces its token.
Whether hidden cards stay valid (and keep polling) is unknown. The main profile page's watch stops
after 8 s.

**Fix:** end the popup watch after the settle window, as the main-profile branch does. Origin of the
feature is unrecorded, so there is no upstream to send this to yet.

### D14. Blur on always-present HUD panels

**Severity: Low. Unmeasured.** Top Bar Plus sets `world-blur: ingameHudBlur` on `#Buff`, `#Rejuv`,
`#BuffHUD`, `#RejuvHUD` and on `#RejuvBuff`, which is always present at opacity 0 — in
`citadel_hud_top_bar.css:3260-3441` and again in `topbar_rank_topbar.css:3356-3537` (five rules in
each; the top bar layout loads both sheets). Enhanced Quickbuy blurs `#QuickbuyNextSoulsNeeded`
and every visible `.QuickbuyUpcomingPreviewSoulsNeeded` (`hud_quickbuy.css:28`) — three blurred
panels in normal play at the default preview count, where Valve blurs its summary only inside the
shop. Whether Panorama pays for blur on an opacity-0 panel is unknown.

### D15. Damage-number glow times longer lifetimes

**Severity: Low. Unmeasured.** `hud_event_indicator.css:556-558` styles `.batched .HudIndicatorText`
at 80 px with `text-shadow: 0px 0px 20px` (Valve's own shadows use 3 px) on a panel spawned under
fire. Build 6711 lengthened Valve's indicator lifetimes (fountain 0.4 s → 2 s, emphasised → 3 s), so
roughly 3–5× more of those panels are alive at once. Whether 6722 still applies `batched` to any panel
is unknown — it is set from C++. The override's origin is unrecorded ([`BUNDLE.md`](BUNDLE.md) §5).

### D16. Calls and textures the game no longer has

**Severity: Low. Verified against GameTracking `client_strings.txt` and `pak01_dir.txt` for 6701 and
6722.** Each of these fails silently:

- `panorama/layout/citadel_db_page_news.xml:38` — `#Library` calls `CitadelShowBookLibraryPage()`,
  removed in 6711. (The same card in `citadel_db_page_training.xml` was removed at the rebase.)
- `panorama/layout/citadel_db_page_training.xml:90` — `#RankedInfo` calls `CitadelShowRankedInfo()`,
  which is in neither build's strings nor any Valve layout ([`FIELD_NOTES.md`](FIELD_NOTES.md) §4).
- `panorama/styles/citadel_db_page_training.css` — background textures removed from the game in 6711:
  `main_menu/dl_v1_png` (`:144`), `seasonal/2026/vote_apollo_sm_png` (`:212`),
  `main_menu/background_nyc_cityscape_bw_psd` (`:222`), `main_menu/background_gothic_jpg` (`:231`);
  plus `book_images/geist/geist_book_cover_vertical_png` (`:240`, and `citadel_db_page_shared.css:164`),
  already missing in 6701. Those cards render without that art; replacements are a design choice.
- `panorama/scripts/qollite_recent_purchase_icons.js` — `images/heroes/tokamak_sm_psd`, removed in
  6711; that hero's purchases showed no portrait. Moot while the script is not loaded (§4).
- `panorama/layout/citadel_hud_top_bar.xml:68,72,80,84` — Top Bar Plus's `<Image>`s use
  `icon_powerup.svg` / `icon_rejuvenator.svg`, not the `.vsvg` form Valve uses. **Unverified** whether
  they resolve.

---

## 8. Smaller items

### D6. Debug logging was on by default

**Status: resolved 2026-09-30** by the re-bundle ([`BUNDLE.md`](BUNDLE.md) §3).

Both first-party bundles had shipped with DEBUG on. `qollite_notifications_log.js` logged
unconditionally — not a decorative flag, but Closure constant-folding upstream's `DEBUG = true` into
the code ([`FIELD_NOTES.md`](FIELD_NOTES.md) §9). `qollite_map_log.js` had it on as well, which in
BetterMap also enabled the urn tracker's extra tree scans. Both now ship `var DEBUG = false;` —
for Map Event Reminders that is a recorded QOL Lite delta (upstream ships `true`), for BetterMap it is
upstream's own value.

### D7. Duplicate import

`@import` of the same `base/` copy twice, a sign of files merged more than once without review:
`hud_abilities.css` (3 and 14), `hud_ability_icon_passive.css` (3 and 118). Harmless on its own; the
second copy arrived with the rules in D10. `citadel_db_page_profile.css` had one too (lines 3 and 48)
until `4bb5c0e` cut it to a single `@import` plus its 4×3 rules.

### D8. Upstream naming leaked into shipped identifiers

`qollite_map_*.js` logs with a `[BetterMap]` prefix, and the urn marker uses `bm_urn*` classes and a
`BmMinimalMap` state class. This is not dead code and must not be "cleaned up" casually — the CSS in
`hud_minimap.css` matches those exact names, and the bundler keeps them on purpose. Recorded so nobody
mistakes it for a leftover.

---

## 9. Recording a new entry

Add an entry when you find a real problem in shipped code. Each one states:

1. **Where** — `file:line` or file plus symbol.
2. **Why it's bad** — the concrete harm, ideally measured, and which design goal it puts at risk.
3. **How it should be** — the correct pattern, with a snippet if it is not obvious.
4. **Status** — open, or resolved with the commit that fixed it.

Then add a row to [§1 At a glance](#1-at-a-glance). Resolved entries stay in the file with their
resolution — the history is why the rule exists.
