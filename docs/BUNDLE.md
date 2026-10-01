# Bundle manifest

> What is inside the pack, who wrote it, where it came from, and whether we can rebuild it.
>
> **Audience:** maintainers, contributors, and anyone auditing what ships to users.
> **Status:** partially filled — authors and licenses traced via the GameBanana API (§7); every `TBD`
> and every *Probable* is still a question only the maintainers can close.
> **Last verified:** 2026-09-30 against commit `78bbf2a`.

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
- **GameBanana:** [664456 — Better Map / Customize](https://gamebanana.com/mods/664456), version there not
  re-checked on 2026-10-01
- **Upstream repo:** `github.com/gfkm/BetterMap` — the checkout's `origin`. Its `old-origin`,
  `github.com/gfkm-gpt/deadlockmapmod`, is the address this file used to give.
- **Bundled version:** BetterMap **3.1** (upstream CHANGELOG, 2026-10-02) at commit **`8d87d86`**
  (`8d87d86647134886ba660f431008397c9e67c082`, "docs(release): 3.1 GameBanana update text and
  changelog"). The mod files are those of `4dca39d` ("Merge feat/healing-apples"); `8d87d86` changes
  only upstream docs. Bundled 2026-10-02.
  - What 3.1 adds over 3.0:
    - **Show Healing Apples** (36 markers, from 3:00, off by default).
    - A colour slider for crates, statues, tough crates and apples, in each toggle's row. The colours
      are not in UMM.
    - New default colours.
    - "Crates & Statues" renamed "Map Objects". Subsection ids and stored keys are unchanged.
    - Only the scripts and the generated `popup_settings.vxml` changed upstream; `hud.vxml` and both
      stylesheets are byte-equal to 3.0's.
  - Previously bundled: **`0237ebe`** (BetterMap 3.0, 2026-10-01), **`ca29290`** (BetterMap 2.1,
    2026-09-30), and before that the closest
    upstream commit **`60fa437`** (2026-07-26) — **inferred** by comparing the old minified bundle's
    string literals against every upstream commit. That build had DEBUG on
    ([`FIELD_NOTES.md`](FIELD_NOTES.md) §9).
  - What 3.0 changes for QOL Lite: the settings move from the in-HUD panel into Valve's settings
    window (three subsections under Game), standalone saving without UMM, per-type icon sizes, the
    corner setting and "Auto Level" are gone, and every UMM widget id is now two characters — so
    **UMM-saved BetterMap values reset once** (upstream's own decision, recorded in its CHANGELOG).
  - Upstream's author checked the 3.0 release candidate in game on build 6728 (upstream
    `docs/specs`, "in-game run 3"). This bundle of it was not checked in game.
- **License:** CC BY-NC-ND 4.0 on GameBanana; the source repo declares **none** — see [§6](#6-licensing)
- **Rebuildable:** yes — `scripts/bundle_bettermap.py`
- **Files:** `panorama/scripts/qollite_map_*.js` (22, readable source: 20 loaded by the HUD, 4 by
  the settings window, `log` and `schema` by both), `panorama/layout/hud.xml` (shared),
  `panorama/layout/popups/popup_settings.xml` (shared with [4×3](systems/aspect-ratio-4x3.md) and the
  FOV slider), `panorama/styles/hud_minimap.css`, BetterMap's rules in `panorama/styles/hud.css`,
  `panorama/images/minimap/base/bm_vignette_png.*`
- **Merge-layer files, compared by hand at `0237ebe`** (at 3.1 only `popup_settings.xml`
  changed upstream; it was merged again the same way, base upstream's `0237ebe` file, zero conflicts):
  - `hud.xml` is upstream's `hud.vxml` with the bundled script names and the `qollite_passive`
    include, nothing else.
  - `popup_settings.xml` is a 3-way merge: base Valve 6730, ours (4×3 button, FOV row), theirs
    upstream's generated `popup_settings.vxml` with its four script names renamed. Zero conflicts. The
    result differs from upstream's only by our two hunks, and from ours only by upstream's `<scripts>`
    block and three subsections. Upstream generated it from Valve's 6728 file, which is byte-equal to
    6730's apart from the decompiler header.
  - `hud_minimap.css` is upstream's file verbatim. The previous copy differed from upstream's 2.1
    only in decompiler formatting (comments dropped, selector lists joined), checked by comparing both
    with comments and whitespace removed.
  - `hud.css` takes upstream's 3.0 changes by 3-way merge: the removed Settings-button rules, two
    `hittest` lines, and the `#hudActivePlayerStats` lines the 6730 rebase had already brought in. It
    still carries QOL Lite's own rules (4×3, passives, `#objectives_health_friendly`).
- **Re-bundling 3.0 or later:** run the bundler, then redo the three merges above against upstream's
  files at the new commit. `popup_settings.xml` is generated upstream from `bettermap_schema.js`, so
  any schema change upstream means it has to be merged again.
- **Docs:** [`systems/minimap.md`](systems/minimap.md)

**Transformation** (the bundler's `FILES` table is the rule): `bettermap_<x>.js` →
`qollite_map_<x>.js`, except `bettermap.js` → `qollite_map_bootstrap.js`, `bettermap_umm.js` →
`qollite_map_umm_adapter.js`, `poi_data.js` / `urn_data.js` → `qollite_map_poi_data.js` /
`qollite_map_urn_data.js`. Globals `Bettermap<X>` → `QolLiteMap<X>`, `BettermapUmm` →
`QolLiteMapUmmAdapter`, `POI_DATA` / `URN_DATA` → `QolLiteMapPoiData` / `QolLiteMapUrnData`. Kept
verbatim, because CSS, layouts and saved settings match them: the `[BetterMap]` log prefix, UMM id
`bettermap` and name `BetterMap`, `bm_*` / `Bm*` classes and ids, the `bettermap_*` subsection ids in
`popup_settings.xml`, the `"bm"` bus payloads. Not minified. The bundler fails if upstream has a
script `FILES` does not list, or `FILES` lists one upstream no longer has.

**QOL Lite local deltas: none since 3.0.** The one delta, "Minimalist Map Opacity" (state key
`minimalMapOpacity`, UMM slider `minimalMapOpacityPct`, in-HUD slider
`#minimap_minimal_opacity_slider`), was dropped at the 3.0 re-bundle. Its only stated reason was to
keep users' saved values applying, and 3.0 resets every UMM-saved BetterMap value anyway. The
in-HUD panel that held its slider is gone upstream too. Dropped at the maintainers' decision
(2026-10-01), knowing what is lost: the delta faded only `#MinimapBackgroundTest` (the map image,
canvas and effects) and only in Minimalist mode, so the heroes and objectives stayed solid.
Upstream's **Map Opacity** fades `#HudMinimapContainer`, which holds Valve's hero and objective
markers too (`applyMapOpacity` in `qollite_map_size.js`). "Faint map, solid icons" is no longer
possible. The way back is a BetterMap setting upstream, not a new local delta.

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
| ~~Advanced Testing Tools In Hideout~~ — **removed** 2026-09-30 at the maintainer's request: its full replacement of `hud_hero_testing.xml` lacked ids the 6722 engine reads and crashed the game at start-up ([page](systems/hero-testing.md), [`FIELD_NOTES.md`](FIELD_NOTES.md) §10) | **bonclide** | [616749](https://gamebanana.com/mods/616749) | — | Probable |
| Optimized McGinnis Wall | **Aminsx** (creator); dacooderr listed as redistributor | [690514](https://gamebanana.com/mods/690514) | — | Confirmed |
| Sinner's Light Fix | TBD — no GameBanana match under this name | TBD | TBD | **Not found** |
| Ammo Buff Notifier (`mercurial_magnum_notifier.*`, images) — **not shipped since 2026-09-30, at the maintainer's request, until it has an off switch (UMM)**; the `element_gun.xml` override that loaded it is deleted, the script, stylesheet and images stay for that work | "Han", per the message of `9935d0c`, which calls it part of "his updated Always Show Passive Items & Actives Icons Mod" | TBD | TBD | **Unverified** — only a commit message |
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

### Third-party services

Bundled code that reaches outside the game (read from the scripts' URLs, 2026-09-30; the minimap
row 2026-10-01). Since 2026-10-01 the README's "Network use" section tells users about the Friends Rank and minimap
rows; the Statlocker buttons send nothing until clicked:

| Feature | Service | When | Data sent |
|---|---|---|---|
| Friends Rank ([§5](#5-unattributed)) | `api.deadlock-api.com/v1/players` | Automatically, as rank-badge image requests when the profile page or a profile card resolves a player (`friends_rank.js`; the post-game scripts only link to Statlocker) — the exact triggers were not audited | The resolved account id |
| Friends Rank's Statlocker buttons ([Statlocker](systems/statlocker.md)) | `statlocker.gg/profile` | Only when the user clicks | The profile's account id |
| Minimap's standalone saving ([minimap](systems/minimap.md); BetterMap's own page, repo `gfkm/bettermap-storage`) | `gfkm.github.io/bettermap-storage/` | **Without UMM:** a hidden `CitadelHTMLPanel` loads the page at every HUD load, and again for each save. Saves happen when the settings window closes or 3 s after the last change. Retries at 5 / 15 / 45 s while the page is unreachable, then every 45 s. **With UMM:** at every HUD load, one page load and one read for a one-time migration into UMM; the panel is deleted when that read answers or the adapter stops waiting (`SEED_WAIT_SEC`, 2 s), and nothing is written (`qollite_map_store.js`, `qollite_map_umm_adapter.js`) | Nothing is sent as a request body: the settings record travels in the URL fragment and stays in the embedded browser's `localStorage` for that origin. The page load itself is an ordinary request to GitHub Pages |

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
| Testing Tools in Hideout (removed 2026-09-30) | ✅ yes | ✅ yes | ❌ no |
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
