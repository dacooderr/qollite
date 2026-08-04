# Bundle manifest

> What is inside the pack, who wrote it, where it came from, and whether we can rebuild it.
>
> **Audience:** maintainers, contributors, and anyone auditing what ships to users.
> **Status:** partially filled — authors and licenses traced via the GameBanana API (§7); every `TBD`
> and every *Probable* is still a question only the maintainers can close.
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
- **GameBanana:** [664456 — Better Map / Customize](https://gamebanana.com/mods/664456), v1.01
- **Upstream repo:** `github.com/gfkm-gpt/deadlockmapmod` *(the working copy has no live `origin`;
  confirm the canonical remote before relying on this)*
- **Bundled version:** TBD — nothing in the pack records which build is in it
- **License:** CC BY-NC-ND 4.0 on GameBanana; the source repo declares **none** — see [§6](#6-licensing)
- **Rebuildable:** yes, from the upstream project
- **Files:** `panorama/scripts/qollite_map_*.js` (12), `panorama/layout/hud.xml` (shared),
  `panorama/styles/hud_minimap.css`, `panorama/images/minimap/**`, `materials/minimap/**`
- **Docs:** [`systems/minimap.md`](systems/minimap.md)

> Upstream module names map one-to-one onto the bundled files (`bettermap_*` → `qollite_map_*`). The
> `[BetterMap]` log prefix and `bm_`/`Bm` class names in the shipped build are upstream names that
> survived the rename — they are load-bearing, not leftovers.

### Event reminders (Map Event Reminders)

- **Author:** gfkm
- **GameBanana:** [697050 — Map Event Reminders](https://gamebanana.com/mods/697050)
- **Upstream repo:** `github.com/gfkm/MapEventReminders`
- **Bundled version:** TBD
- **License:** CC BY-NC-ND 4.0 on GameBanana; the source repo declares **none** — see [§6](#6-licensing)
- **Rebuildable:** yes, from the upstream project
- **Files:** `panorama/scripts/qollite_notifications_*.js` (11),
  `panorama/layout/base_hud_and_db_overlay.xml`, `panorama/styles/notif.css`
- **Docs:** [`systems/event-reminders.md`](systems/event-reminders.md)

---

## 4. Vendored — third-party mods

Everything below ships as a **build artifact only**. The readable source is not in this repo and, in
most cases, we do not know where it is. Treat these as read-only: report bugs upstream, do not patch
the minified output.

| Feature | Credited author(s) | GameBanana | Version | Confidence |
|---|---|---|---|---|
| Top Bar Plus | **bonclide** (tweaks, objective HUD) + Waltee (objective damage + base) + NA-45 (team-fight HUD) + bytenode (recent purchases); timers by BreadRollius (icons) + Hanturaya (base) | [623518](https://gamebanana.com/mods/623518) | 4.0d | Probable |
| Show Rank | **Hanturaya**; image logic by bytenode; rank API by deadlock.api (manuelhexe) | [681028](https://gamebanana.com/mods/681028) | — | Probable |
| Enhanced Quickbuy | **Aminsx** | [664041](https://gamebanana.com/mods/664041) | 1.6 | Confirmed |
| Recent Purchases | **Unresolved** — two candidates, see below | [607703](https://gamebanana.com/mods/607703) or [679055](https://gamebanana.com/mods/679055) | — | **Unresolved** |
| Always Show Passives & Actives | TBD — no GameBanana match under this name | TBD | TBD | **Not found** |
| Advanced Testing Tools In Hideout | **bonclide** | [616749](https://gamebanana.com/mods/616749) | 3.0 | Probable |
| Optimized McGinnis Wall | **Aminsx** (creator); dacooderr listed as redistributor | [690514](https://gamebanana.com/mods/690514) | — | Confirmed |
| Sinner's Light Fix | TBD — no GameBanana match under this name | TBD | TBD | **Not found** |

**All of the above are licensed CC BY-NC-ND 4.0** on GameBanana. See [§6](#6-licensing) — the terms
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

**Courtesy:** this is someone else's free service. The script throttles to two requests a second;
keep it that way, and do not poll it on a schedule tighter than daily.

---

## 8. Maintaining this file

**Adding a feature to the pack** — add its entry here before it ships, with author, upstream,
version, and license filled in, plus a row in [`sources.json`](../sources.json). An entry that cannot
be filled in is a reason to pause, not a formality to skip.

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
