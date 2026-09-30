# Bundle manifest

> What is inside the pack, who wrote it, where it came from, and whether we can rebuild it.
>
> **Audience:** maintainers, contributors, and anyone auditing what ships to users.
> **Status:** partially filled — authors and licenses traced via the GameBanana API (§7); every `TBD`
> and every *Probable* is still a question only the maintainers can close.
> **Last verified:** 2026-09-30 against branch `fix/remerge-6722` (uncommitted).

QOL Lite is a **distribution**, not a single codebase. It bundles roughly a dozen features, most of
them originally written by other people, into one pack so they can share Valve's HUD files instead of
colliding over them ([`PANORAMA.md`](PANORAMA.md) §3).

A distribution has to answer three questions that a normal repo does not: *what is in it*, *whose
work is it*, and *how do we update it*. This file is where those answers live.

**Contents**

1. [How to read this](#1-how-to-read-this)
2. [First-party — the merge layer](#2-first-party--the-merge-layer)
3. [First-party — our own mods](#3-first-party--our-own-mods)
4. [Vendored — third-party mods](#4-vendored--third-party-mods)
5. [Unattributed](#5-unattributed)
6. [Licensing](#6-licensing)
7. [Staying current with upstream](#7-staying-current-with-upstream)
8. [Maintaining this file](#8-maintaining-this-file)

---

## 1. How to read this

Each entry carries the same fields:

| Field | Meaning |
|---|---|
| **Author** | Who wrote it. `TBD` means nobody has recorded it. |
| **Upstream** | Where the canonical version lives. |
| **Bundled version** | Which version of it is in this pack. |
| **License** | The terms it is distributed under. |
| **Rebuildable** | Can we regenerate the shipped files from source? |
| **Files** | What it owns in this repo. |

**Tiers.** The distinction governs what you are allowed to do with an entry:

- **First-party** — we own the source and can change it freely.
- **Vendored** — someone else's work, shipped as a build artifact. Changes go **upstream first**; a
  local patch is a last resort and must be recorded as an explicit delta, never as a silent edit to a
  minified file.

---

## 2. First-party — the merge layer

**The collection's own code.** Even though most individual features came from elsewhere, the thing
that combines them exists only here and has no upstream:

| What | Files |
|---|---|
| The merged HUD | `panorama/layout/hud.xml` — carries Valve's tree plus panels from several features at once |
| The merged top bar | `panorama/layout/citadel_hud_top_bar.xml` — hosts Top Bar Plus and the two Map Event Reminders bridges |
| The `base/` pattern | `panorama/styles/base/**`, `topbar_rank_base/**` and the overrides that import them ([`ARCHITECTURE.md`](ARCHITECTURE.md) § The `base/` pattern) |
| Path arbitration | Deciding which feature owns which Valve path ([`systems/README.md`](systems/README.md) § Ownership map) |
| 4×3 support | [`systems/aspect-ratio-4x3.md`](systems/aspect-ratio-4x3.md) — spans nine stylesheets and `popup_settings.xml` |
| Game-patch rebases | Carrying every Valve-path override onto a new build ([`ARCHITECTURE.md`](ARCHITECTURE.md) §9) — the resolutions are ours, whoever owns the file |

- **Author:** QOL Lite maintainers
- **Upstream:** this repository
- **License:** see [§6](#6-licensing)
- **Rebuildable:** the tree here *is* the source of record, though it is stored as decompiler output —
  see [`ARCHITECTURE.md`](ARCHITECTURE.md) § Provenance

This layer is why merging was worth doing at all: individually, several of these mods cannot coexist,
because two packs cannot own one file path. **It deserves to be maintained as real source**, and it is
the part of the repo where changes are unambiguously ours to make.

---

## 3. First-party — our own mods

Developed separately, bundled here. Their scripts are **regenerated** from an upstream commit by a
bundler under `scripts/`; the bundled copies are never edited by hand. Each bundled file opens with a
provenance header naming the upstream repo, commit and original file.

**Re-bundling, in general:**

```
python scripts/bundle_bettermap.py --upstream <BetterMap checkout> --rev <commit>
python scripts/bundle_mer.py       --upstream <MapEventReminders checkout> --rev <commit>
# add --check to compare without writing (exit 1 = differs)
```

The bundlers read the commit through `git show`, never the upstream working tree. They regenerate
**scripts only**; the merge-layer files each mod also needs (listed per mod below) are brought in line
with upstream's copies by hand — [`ARCHITECTURE.md`](ARCHITECTURE.md) §8.

### Minimap (BetterMap)

- **Author:** gfkm
- **GameBanana:** [664456 — Better Map / Customize](https://gamebanana.com/mods/664456), v1.01 (not
  re-checked on 2026-09-30)
- **Upstream repo:** `github.com/gfkm/BetterMap` — the checkout's `origin`. Its `old-origin`,
  `github.com/gfkm-gpt/deadlockmapmod`, is the address this file used to give.
- **Bundled version:** BetterMap **2.1** (upstream CHANGELOG, 2026-09-30) at commit **`ca29290`**
  (`ca29290306cbadb0b6bce7ba7bd789c26a95599f`, 2026-09-30, "minimap: fix Minimap Corner dropdown in
  the in-HUD panel"). Bundled 2026-09-30.
  - Previously bundled: closest upstream commit **`60fa437`** (2026-07-26) — **inferred** by comparing
    the old minified bundle's string literals against every upstream commit; the residual differences
    were all explained as minifier artifacts. That build had DEBUG on
    ([`FIELD_NOTES.md`](FIELD_NOTES.md) §9).
  - `ca29290` is newer than the release build of BetterMap its author had checked in game (that build
    differs only in DEBUG on, and in how the corner dropdown is bound).
- **License:** CC BY-NC-ND 4.0 on GameBanana; the source repo declares **none** — see [§6](#6-licensing)
- **Rebuildable:** yes — `scripts/bundle_bettermap.py`
- **Files:** `panorama/scripts/qollite_map_*.js` (15, readable source), `panorama/layout/hud.xml`
  (shared), `panorama/styles/hud_minimap.css`, BetterMap's rules in `panorama/styles/hud.css`,
  `panorama/images/minimap/base/bm_vignette_png.*`
- **Merge-layer files, compared by hand at `ca29290`:** `hud.xml` differs from BetterMap's own only by
  the bundled script names, the `qollite_passive` include, and the local-delta slider row below;
  `hud_minimap.css`'s appendix equals BetterMap's; `hud.css` carries BetterMap's rules plus QOL Lite's
  own (4×3, passives, `#objectives_health_friendly`).
- **Docs:** [`systems/minimap.md`](systems/minimap.md)

**Transformation** (the bundler's `FILES` table is the rule): `bettermap_<x>.js` →
`qollite_map_<x>.js`, except `bettermap.js` → `qollite_map_bootstrap.js`, `bettermap_umm.js` →
`qollite_map_umm_adapter.js`, `poi_data.js` / `urn_data.js` → `qollite_map_poi_data.js` /
`qollite_map_urn_data.js`. Globals `Bettermap<X>` → `QolLiteMap<X>`, `BettermapUmm` →
`QolLiteMapUmmAdapter`, `POI_DATA` / `URN_DATA` → `QolLiteMapPoiData` / `QolLiteMapUrnData`. Kept
verbatim, because CSS and saved settings match them: the `[BetterMap]` log prefix, UMM id `bettermap`
and name `BetterMap`, `bm_*` / `Bm*` classes. Not minified.

**QOL Lite local delta — "Minimalist Map Opacity".** Not in any upstream commit on any branch, and
not recorded here until 2026-09-30, although the previous bundle already carried it. Pieces: state key
`minimalMapOpacity` (default `0.9`), UMM slider `minimalMapOpacityPct` (0–100 %), in-HUD slider
`#minimap_minimal_opacity_slider`. Kept so users' saved values keep applying; the bundler applies it
as labelled patches ("QOL Lite local delta (not in upstream BetterMap)") in
`qollite_map_state.js`, `qollite_map_umm_adapter.js` and `qollite_map_minimal.js`, and the slider row
is in `hud.xml`.
It had to be **ported, not copied**: the old code set an inline opacity on `#canvas` and every
`.backgroundImage`, but 6722 draws the map as `backgroundImage1..3`, whose opacity Valve's CSS
switches per level — an inline opacity there would show all levels at once. The port fades their
common parent `#MinimapBackgroundTest` instead and clears it when off. **Unverified in game** — in
particular whether any C++ marker lives under `#MinimapBackgroundTest` and would fade too. Offered
upstream: not yet. Options: upstream it into BetterMap, or drop it.

> Upstream module names map one-to-one onto the bundled files. The `[BetterMap]` log prefix and
> `bm_`/`Bm` class names in the shipped build are upstream names kept by the bundler — they are
> load-bearing, not leftovers.

### Event reminders (Map Event Reminders)

- **Author:** gfkm
- **GameBanana:** [697050 — Map Event Reminders](https://gamebanana.com/mods/697050)
- **Upstream repo:** `github.com/gfkm/MapEventReminders`
- **Bundled version:** commit **`12e6b3b`** (2026-09-30, "rebase top bar onto game build 6722").
  Bundled 2026-09-30.
  - Previously bundled: **`b8907bc`** — inferred from the old minified bundle (string literals and
    globals match it; it lacks the Street Brawl code of `4a5aa89` and still has the `map_render`
    diagnostic removed in `12e6b3b`).
  - Functional changes since then, all upstream: Street Brawl suppression (`4a5aa89` — the top-bar
    bridge stops broadcasting the clock in Street Brawl) and removal of the `map_render` diagnostic
    (`12e6b3b`). Module set unchanged (11 files).
- **License:** CC BY-NC-ND 4.0 on GameBanana; the source repo declares **none** — see [§6](#6-licensing)
- **Rebuildable:** yes — `scripts/bundle_mer.py`
- **Files:** `panorama/scripts/qollite_notifications_*.js` (11, readable source),
  `panorama/layout/base_hud_and_db_overlay.xml`, `panorama/styles/notif.css`, and two includes in
  `panorama/layout/citadel_hud_top_bar.xml`
- **Merge-layer files, compared by hand at `12e6b3b`:** the overlay layout's include list equals
  upstream's, in the same order; `notif.css` is rule-for-rule upstream's `notif.vcss`; upstream's two
  top-bar hunks for 6722 are present in `citadel_hud_top_bar.xml`.
- **Docs:** [`systems/event-reminders.md`](systems/event-reminders.md)

**Transformation** (the bundler's `FILES` / `GLOBALS` tables are the rule): `notif_<x>.js` /
`event_schedule.js` / `notif.js` → `qollite_notifications_<y>.js` (`notif_umm.js` → `_umm_adapter`,
`notif_urn.js` → `_urn_detector`, `notif.js` → `_bootstrap`); globals `NotifLog`, `NOTIF_CONFIG`,
`NOTIF_STRINGS`, `EVENT_SCHEDULE`, `NotifClock`, `NotifScheduler`, `NotifManager`, `NotifUmm`,
`NotifClockBridge`, `NotifUrn` → `QolLiteNotifications*`. Kept verbatim: log prefixes `[NOTIF]`,
`[NOTIF][bridge]`, `[NOTIF][urn]`; bus payloads `{notif:1,…}`; UMM id `eventnotifier` and every
setting key; `NotifVisible` / `NotifExpired` classes; `#NotificationRoot`.

**QOL Lite local deltas:**

1. `qollite_notifications_log.js`: `var DEBUG = false;` — upstream ships `true` on purpose (upstream
   `35d60a3`, "keep DEBUG on, console-only"). Upstream `log()` is event-driven (a few lines a match
   minute), so the cost either way is small; off was chosen for a performance-first pack, and
   `info` / `error` plus the bridges' own `$.Msg` lines still print. One line to flip.
2. Non-ASCII in string literals is written as `\uXXXX` escapes (the Russian strings in
   `qollite_notifications_strings.js`), and in comments as ASCII punctuation. The previous bundle was
   pure ASCII and is known to render Russian; whether Panorama decodes raw UTF-8 in JS is not verified.
   Cost: the Russian strings are not human-readable in this repo (they are upstream).
3. The provenance header. No logic change of our own.

---

## 4. Vendored — third-party mods

Everything below ships as a **build artifact only**. The readable source is not in this repo and, in
most cases, we do not know where it is. Treat these as read-only: report bugs upstream, do not patch
the minified output.

| Feature | Credited author(s) | GameBanana | Version | Confidence |
|---|---|---|---|---|
| Top Bar Plus | **bonclide** (tweaks, objective HUD) + Waltee (objective damage + base) + NA-45 (team-fight HUD) + bytenode (recent purchases); timers by BreadRollius (icons) + Hanturaya (base) | [623518](https://gamebanana.com/mods/623518) | 4.0d | Probable |
| ~~Show Rank~~ — **removed** in `ecdacbb` ([page](systems/show-rank.md)) | **Hanturaya**; image logic by bytenode; rank API by deadlock.api (manuelhexe) | [681028](https://gamebanana.com/mods/681028) | — | Probable |
| Enhanced Quickbuy | **Aminsx** | [664041](https://gamebanana.com/mods/664041) | 1.6 | Confirmed |
| Recent Purchases | **Unresolved** — two candidates, see below | [607703](https://gamebanana.com/mods/607703) or [679055](https://gamebanana.com/mods/679055) | — | **Unresolved** |
| Always Show Passives & Actives | TBD — no GameBanana match under this name | TBD | TBD | **Not found** |
| Advanced Testing Tools In Hideout | **bonclide** | [616749](https://gamebanana.com/mods/616749) | 3.0 + local delta (below) | Probable |
| Optimized McGinnis Wall | **Aminsx** (creator); dacooderr listed as redistributor | [690514](https://gamebanana.com/mods/690514) | — | Confirmed |
| Sinner's Light Fix | TBD — no GameBanana match under this name | TBD | TBD | **Not found** |
| Ammo Buff Notifier (`mercurial_magnum_notifier.*`, `element_gun.xml` images) | "Han", per the message of `9935d0c`, which calls it part of "his updated Always Show Passive Items & Actives Icons Mod" | TBD | TBD | **Unverified** — only a commit message |
| Experimental Extended FOV Slider (`#BetterFOVAspectRatio` in `popups/popup_settings.xml`) | **Maffinz**, per the message of `ac24ca8` | TBD | TBD | **Unverified** — only a commit message |

**Every row above with a GameBanana entry is licensed CC BY-NC-ND 4.0** there; the last two rows have
no traced source or license yet. See [§6](#6-licensing) — the terms
matter, and they are not what the repository's `LICENSE` file says.

**Confidence levels.** *Confirmed* means a single unambiguous match whose credits name one author.
*Probable* means the name matches a single plausible Deadlock mod, but **the bundled files were not
byte-compared against the upstream download** — nobody has verified that the version in the pack is
that mod. Only the maintainers can close that gap.

**The Recent Purchases ambiguity.** Two Deadlock mods share the concept:
[607703 "Overhaul Recent Purchases Revived"](https://gamebanana.com/mods/607703) by Hanturaya, whose
description highlights *"with old icons too on the list"*, and
[679055 "Byte's Recent Purchases Overhaul"](https://gamebanana.com/mods/679055) by bytenode. The
bundled build carries a ~3,000-entry localized icon table, which points at the former — but that is
inference, not evidence. Complicating it further, Top Bar Plus credits *"bytenode (Recent Purchases
mod)"*, so a recent-purchases implementation may also arrive bundled inside Top Bar Plus.
**Ask before recording either as fact.**

**Internal identifiers that may help trace an upstream.** Three of these register with Universal Mod
Manager under stable ids, which are likely to match their original project names
([`UMM.md`](UMM.md) §4):

| Feature | UMM id | Display name |
|---|---|---|
| Enhanced Quickbuy | `enhanced_quickbuy` | Enhanced Quickbuy |
| Recent Purchases | `recent_purchases` | Recent Purchases |
| Always Show Passives & Actives | `always_show_passives` | Always Show Passives & Actives |

Show Rank, while it shipped, branded its shared state `$.__QolLiteShowRankWebMediaBridge` with
`version: 236`. The Friends Rank scripts ([§5](#5-unattributed)) carry `version: 16` in their config.

### Advanced Testing Tools — local delta

Recorded 2026-09-30. Build 6711 removed the C++ panel events and console commands several of the
mod's buttons dispatch (`HeroTestingChangeTeam`, `HeroTestingUpdateDisableDeath`,
`HeroTestingUpdateDisableCooldowns`, `HeroTestingUpdateEnableUnlimitedAmmo`,
`HeroTestingUpdateEnableFastStamina`, `citadel_{enable,disable}_no_hero_death`, … — gone from
`client_strings.txt` / `commands.txt` of 6722). Valve's own 6722 menu binds the same rules to convars.
The mod's layout was patched to do the same — **five lines** in `panorama/layout/hud_hero_testing.xml`,
ids, classes and labels unchanged:

| Control | Was | Now |
|---|---|---|
| Change Team | `onactivate="HeroTestingChangeTeam();"` | `onactivate="Cmd( 'changeteam' );"` |
| `#DisableDeathCheckbox` | `ToggleButton` → `UpdateNoDeathToggle()` | `CitadelSettingsCheckbox convar="buddha"` |
| `#EnableUnlimitedAmmoCheckbox` | `ToggleButton` → `HeroTestingUpdateEnableUnlimitedAmmo()` | `CitadelSettingsCheckbox convar="sv_infinite_ammo"` |
| `#DisableCooldownCheckbox` | `ToggleButton` → `HeroTestingUpdateDisableCooldowns()` | `CitadelSettingsCheckbox convar="citadel_ability_cooldown_max"` |
| `#EnableFastStaminaCheckbox` | `ToggleButton` → `HeroTestingUpdateEnableFastStamina()` | `CitadelSettingsCheckbox convar="citadel_rapid_stamina_regen"` |

`hero_testing_menu.css` and `qollite_hero_testing.js` are unchanged. Side effects: the No Death
button no longer plays its `Stinger.LevelUp` sound; the script's `UpdateNoDeathToggle` is still
exported but no longer called (it only sends removed commands). Valve's own new testing menu is not
shown — the mod still replaces the panel. **Unverified in game.** Offered upstream: not yet —
whether the author has a 6711+ update was not checked.

### Third-party services

Bundled code that reaches outside the game (read from the scripts' URLs, 2026-09-30). Users are not
currently told about any of it:

| Feature | Service | When | Data sent |
|---|---|---|---|
| Friends Rank ([§5](#5-unattributed)) | `api.deadlock-api.com/v1/players` | Automatically, as rank-badge image requests when the profile page or a profile card resolves a player (`friends_rank.js`; the post-game scripts only link to Statlocker) — the exact triggers were not audited | The resolved account id |
| Friends Rank's Statlocker buttons ([Statlocker](systems/statlocker.md)) | `statlocker.gg/profile` | Only when the user clicks | The profile's account id |

Show Rank, which requested badges for every player in every match, was removed in `ecdacbb`. The
Friends Rank requests need the same disclosure in the README and an opt-out — see
[`TECH_DEBT.md`](TECH_DEBT.md) §3.

---

## 5. Unattributed

Features present in the build whose origin is not recorded and could not be determined from the
files:

| Feature | Notes |
|---|---|
| [Leaderboard search](systems/leaderboard-search.md) | Not listed in the README either |
| [Escape menu queuing](systems/escape-menu.md) | README: "Menu (for queuing while in Custom Servers or Hideout)" |
| 4×3 option and fix | Plausibly first-party; treated as merge-layer in [§2](#2-first-party--the-merge-layer) pending confirmation |
| Minimap texture replacements | Neutral-camp icons and the tunnels overlay. The tunnels overlay is QOL Lite-only (not in upstream BetterMap) and has been referenced by nothing since the 6722 update; the neutral icons' `dmm_custom_*` rules match nothing, here or upstream ([`TECH_DEBT.md`](TECH_DEBT.md) §4). BetterMap's own texture, `base/bm_vignette_png`, is recorded in [§3](#3-first-party--our-own-mods) |
| Vindicta Scope Downscale | `panorama/images/hud/crosshair/scope_common_psd.png` plus its entry in `panorama/image_compiler.vdata`, re-added in `fb74e00` ("re-added Vindicta Scope Downscale"). Author not recorded |
| **Friends Rank** ("Show Player/Friends Ranks") | Added in `27087ae`, updated in `ac24ca8`. `friends_rank*.js` (readable, `version: 16`), `friends_rank*.css`, `images/friends_rank/`, and edits to `citadel_db_page_profile.xml`, `profile_card.xml` and both post-game layouts. Its `post_game/citadel_db_post_game_team.xml` edits (the MVP-card button) carry an open crash risk, cause unknown ([`TECH_DEBT.md`](TECH_DEBT.md) D17). Calls `api.deadlock-api.com` (§4 Third-party services). **No author, upstream or license recorded, and no page under `systems/` yet** |
| `panorama/styles/hud_event_indicator.css` | Damage-number / floating-indicator restyle: `.WindowRoot` offset (`margin-left: 50px; margin-top: -100px`), `.batched` numbers at 80 px red with a 20 px yellow glow, fountain keyframes rising straight up (every `translateX` → 0), `pop` dropped from the cumulative animation. Present since the `959f80e` import; no doc, README entry or commit message names it, no script references its classes. Rebased onto 6722 edit by edit (Valve's longer lifetimes kept) |

---

## 6. Licensing

**This section records verified facts and an open question. It is not legal advice.**

### What the bundled mods actually say

Every bundled mod traced so far is published on GameBanana under **CC BY-NC-ND 4.0**, and each one
carries a machine-readable permission checklist. Those checklists are **not uniform**, and the
distinction matters because QOL Lite is a derivative bundle distributed on GameBanana:

| Mod | "Use parts in another Mod, distribute on GameBanana" | "…on another site" | "Redistribute as-is elsewhere" |
|---|---|---|---|
| Top Bar Plus | ✅ yes | ✅ yes | ❌ no |
| Testing Tools in Hideout | ✅ yes | ✅ yes | ❌ no |
| Optimized McGinnis Wall | ⚠️ ask | ❌ no | ❌ no |
| Show Rank, Enhanced Quickbuy, Statlocker, Recent Purchases | ⚠️ ask | ⚠️ ask | ⚠️ ask |
| **QOL Lite itself** | ❌ no | ❌ no | ❌ no |

So bundling is **explicitly permitted** for some, **requires asking** for most, and QOL Lite's own
pack is locked down entirely. Given that dacooderr already redistributes Aminsx's wall with proper
credit on GameBanana, permissions plausibly exist for several of these — they are simply **not
written down anywhere in this repository**, which is the actual gap.

### The concrete problem

**The repository's `LICENSE` (GPL-3.0) contradicts the terms the bundled work is published under.**

GPL-3.0 grants exactly what CC BY-NC-ND withholds: commercial use, derivative works, and
redistribution by anyone. Applying it repo-wide asserts permissions over other people's mods that
they have not granted — and it also contradicts dacooderr's own GameBanana listing for QOL Lite,
which says no to every reuse option.

This is very likely an accident of `git init` rather than intent. It is also cheap to fix.

### Our own two mods

BetterMap and Map Event Reminders are published on GameBanana under CC BY-NC-ND like everything else,
but their **upstream repositories declare no license at all**, which under default copyright means all
rights reserved. That is the one piece entirely within our control, and worth aligning regardless of
how the wider question lands.

### Suggested order

1. Confirm with each author that bundling is permitted, and **record the answer per entry in
   [§4](#4-vendored--third-party-mods)**. Where the checklist already says yes, record that instead.
2. Add a credits section to the README naming every author above.
3. Replace the repo-wide `LICENSE` with something that describes reality: our own merge-layer terms,
   plus a pointer to each bundled mod's own license.

Nothing here is unusual for a mod collection, and nothing is on fire. But the manifest is the fix for
both this and the update problem, which is why it is worth doing once, properly.

---

## 7. Staying current with upstream

The bundled mods keep being developed by their authors. Without a way to notice that, the pack
silently keeps shipping an old build until a user reports it — which is the failure mode a
distribution has to avoid above all others.

**GameBanana has a public API, and it exposes everything needed for this.** Both of these work
without a key:

```
https://gamebanana.com/apiv11/Mod/<id>/ProfilePage
https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=<id>&fields=...
```

Useful fields on `ProfilePage`:

| Field | Use |
|---|---|
| `_sVersion` | The author's own version string |
| `_tsDateUpdated` | When they last shipped |
| `_aFiles[]._sMd5Checksum` | Per-file checksums — detects a re-upload that did not bump the version |
| `_sLicense`, `_aLicenseChecklist` | Terms, including a machine-readable permissions list |
| `_aCredits` | Credited authors **with roles** — not the same as the uploader |
| `_aSubmitter._sName` | Who uploaded it |

Search within Deadlock (game id **20948**):

```
https://gamebanana.com/apiv11/Game/20948/Subfeed?_nPage=1&_sName=<query>
```

### The tooling

[`sources.json`](../sources.json) records one entry per bundled mod: its GameBanana id, its tier, and
a `pinned` block describing the version that is actually bundled.

```
python scripts/check_upstream.py            # report drift
python scripts/check_upstream.py --update   # re-pin after rebundling
python scripts/check_upstream.py --json     # for CI
```

**A `pinned` block is a claim about what ships**, not a snapshot of upstream. Running `--update` on a
checkout you have not rebundled records upstream's current state as though it were ours, producing
exactly the false "we are up to date" the tool exists to prevent. Pin only what you have verified.

Entries with no `gamebanana_id` cannot be tracked at all — that is why the unresolved rows in
[§4](#4-vendored--third-party-mods) matter beyond bookkeeping.

**First-party entries also carry a `bundled` block** — the upstream repo commit the scripts were
generated from (`commit`, `date`, `version`). It is separate from `pinned` on purpose:
`pinned` holds GameBanana fields and is overwritten wholesale by `--update`, while `bundled` is a git
fact the checker does not read. Update it in the same commit as a re-bundle. The GameBanana `pinned`
blocks for the two first-party mods stay empty until the bundle has been checked in game, since
pinning is a claim about what ships.

**Courtesy:** this is someone else's free service. The script throttles to two requests a second;
keep it that way, and do not poll it on a schedule tighter than daily.

---

## 8. Maintaining this file

**Adding a feature to the pack** — add its entry here before it ships, with author, upstream,
version, and license filled in, plus a row in [`sources.json`](../sources.json). An entry that cannot
be filled in is a reason to pause, not a formality to skip.

**Updating a vendored mod** — bump its **Bundled version** in the same commit that updates its files,
so the manifest never describes a build that is no longer shipping. For a first-party mod, also
update the `bundled` block in `sources.json`.

**Patching a vendored mod locally** — record the patch as an explicit entry under that feature: what
changed, why, and whether it was offered upstream. A local change nobody wrote down becomes
indistinguishable from upstream behaviour within one release.

**Removing a feature** — delete its files, its entry here, its page under
[`systems/`](systems/README.md), its row in the ownership map, and its README line. All in one
commit.

---

## See also

- [`systems/README.md`](systems/README.md) — what each feature does, and which Valve paths it owns
- [`ARCHITECTURE.md`](ARCHITECTURE.md) § Provenance — why the shipped files are decompiler output
- [`TECH_DEBT.md`](TECH_DEBT.md) — the open problems, including the missing attribution
