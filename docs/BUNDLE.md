# Bundle manifest

> What is inside the pack, who wrote it, where it came from, and whether we can rebuild it.
>
> **Audience:** maintainers, contributors, and anyone auditing what ships to users.
> **Status:** incomplete — every `TBD` is a question only the maintainers can answer.
> **Last verified:** 2026-08-05 against commit `ac57b17`.

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
7. [Maintaining this file](#7-maintaining-this-file)

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
| The merged top bar | `panorama/layout/citadel_hud_top_bar.xml` — hosts three features' scripts |
| The `base/` pattern | `panorama/styles/base/**`, `topbar_rank_base/**` and the overrides that import them ([`ARCHITECTURE.md`](ARCHITECTURE.md) § The `base/` pattern) |
| Path arbitration | Deciding which feature owns which Valve path ([`systems/README.md`](systems/README.md) § Ownership map) |
| 4×3 support | [`systems/aspect-ratio-4x3.md`](systems/aspect-ratio-4x3.md) — spans ten stylesheets |

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

Developed separately, bundled here. These are the only script files we can meaningfully rebuild.

### Minimap (BetterMap)

- **Author:** gfkm
- **Upstream:** `github.com/gfkm-gpt/deadlockmapmod` *(the working copy currently has no live
  `origin`; confirm the canonical remote before relying on this)*
- **Bundled version:** TBD — no version is recorded anywhere in the pack
- **License:** **none declared** — see [§6](#6-licensing)
- **Rebuildable:** yes, from the upstream project
- **Files:** `panorama/scripts/qollite_map_*.js` (12), `panorama/layout/hud.xml` (shared),
  `panorama/styles/hud_minimap.css`, `panorama/images/minimap/**`, `materials/minimap/**`
- **Docs:** [`systems/minimap.md`](systems/minimap.md)

> Upstream module names map one-to-one onto the bundled files (`bettermap_*` → `qollite_map_*`). The
> `[BetterMap]` log prefix and `bm_`/`Bm` class names in the shipped build are upstream names that
> survived the rename — they are load-bearing, not leftovers.

### Event reminders (Map Event Reminders)

- **Author:** gfkm
- **Upstream:** `github.com/gfkm/MapEventReminders`
- **Bundled version:** TBD
- **License:** **none declared** — see [§6](#6-licensing)
- **Rebuildable:** yes, from the upstream project
- **Files:** `panorama/scripts/qollite_notifications_*.js` (11),
  `panorama/layout/base_hud_and_db_overlay.xml`, `panorama/styles/notif.css`
- **Docs:** [`systems/event-reminders.md`](systems/event-reminders.md)

---

## 4. Vendored — third-party mods

Everything below ships as a **build artifact only**. The readable source is not in this repo and, in
most cases, we do not know where it is. Treat these as read-only: report bugs upstream, do not patch
the minified output.

| Feature | Author | Upstream | Version | License | Docs |
|---|---|---|---|---|---|
| Top Bar Plus | TBD | TBD | TBD | TBD | [top-bar](systems/top-bar.md) |
| Show Rank | TBD | TBD | TBD | TBD | [show-rank](systems/show-rank.md) |
| Statlocker | TBD | TBD | TBD | TBD | [statlocker](systems/statlocker.md) |
| Enhanced Quickbuy | TBD | TBD | TBD | TBD | [quickbuy](systems/quickbuy.md) |
| Recent Purchases | TBD | TBD | TBD | TBD | [recent-purchases](systems/recent-purchases.md) |
| Always Show Passives & Actives | TBD | TBD | TBD | TBD | [passives](systems/passives.md) |
| Advanced Testing Tools In Hideout | TBD | TBD | TBD | TBD | [hero-testing](systems/hero-testing.md) |
| Optimized McGinnis Wall | TBD | TBD | TBD | TBD | [assets](systems/assets.md) |
| Sinner's Light Fix | TBD | TBD | TBD | TBD | [assets](systems/assets.md) |

**Internal identifiers that may help trace an upstream.** Three of these register with Universal Mod
Manager under stable ids, which are likely to match their original project names
([`UMM.md`](UMM.md) §4):

| Feature | UMM id | Display name |
|---|---|---|
| Enhanced Quickbuy | `enhanced_quickbuy` | Enhanced Quickbuy |
| Recent Purchases | `recent_purchases` | Recent Purchases |
| Always Show Passives & Actives | `always_show_passives` | Always Show Passives & Actives |

Show Rank additionally brands its shared state as `$.__QolLiteShowRankWebMediaBridge` with
`version: 236` — that `236` is the closest thing to a version stamp anywhere in the pack, though what
it refers to is unknown.

### Third-party services

Two bundled features reach outside the game. Users are not currently told about either:

| Feature | Service | When | Data sent |
|---|---|---|---|
| [Show Rank](systems/show-rank.md) | `api.deadlock-api.com` | **Automatically, every match** | Player account ids, for every player in the match |
| [Statlocker](systems/statlocker.md) | `statlocker.gg` | Only when the user clicks the button | The profile's account id |

The first one needs a disclosure in the README and an opt-out — see
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
| Minimap texture replacements | Compact minimap, neutral vault, tunnels — possibly part of BetterMap upstream |
| **Vindicta Scope Downscale** | **Listed in the README but not found in the repo at all.** Either it ships elsewhere, was removed without a README update, or is implemented somewhere not yet identified — see [`systems/assets.md`](systems/assets.md) |

---

## 6. Licensing

**This section records an open question, not a legal opinion.**

The repository carries **GPL-3.0** (`LICENSE`, 674 lines) and contains **no attribution of any
kind** — no per-feature authors, no upstream links, no per-mod license files, and no credits in the
README.

Two things follow that the maintainers should resolve:

1. **A repo-wide license cannot cover work we do not own.** GPL-3.0 at the root reads as a claim over
   everything in the tree, including a dozen features written by other people. Whatever the intent,
   the file as it stands does not describe the actual situation.
2. **If any bundled mod is itself GPL-licensed, redistributing it carries obligations** — notably
   providing corresponding source for that component. The pack currently ships only minified and
   compiled artifacts, so it would not satisfy that.

Also worth noting: **our own two mods declare no license at all** upstream. Under default copyright
that is "all rights reserved", which sits awkwardly under a GPL-3.0 root. Adding an explicit license
to BetterMap and Map Event Reminders is a cheap fix entirely within our control, and worth doing
regardless of how the wider question lands.

None of this is unusual for a game-mod collection, and none of it is urgent in the sense of anything
being broken. But it is exactly the kind of thing that becomes expensive later, and filling in
[§4](#4-vendored--third-party-mods) is most of the work either way — you cannot ask an author's
permission if you do not know who they are.

**Suggested order:** contact the authors of the bundled mods → record author, upstream, and license
per entry above → add a credits section to the README → revisit the root `LICENSE` once the picture
is clear.

---

## 7. Maintaining this file

**Adding a feature to the pack** — add its entry here before it ships, with author, upstream,
version, and license filled in. An entry that cannot be filled in is a reason to pause, not a
formality to skip.

**Updating a vendored mod** — bump its **Bundled version** in the same commit that updates its files,
so the manifest never describes a build that is no longer shipping.

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
