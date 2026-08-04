# Tech debt and known traps

> Real problems in shipped code, with evidence. Not a wishlist — every entry names a file and a
> concrete harm.
>
> **Audience:** anyone planning work, and anyone reviewing a change.
> **Status:** open ledger.
> **Last verified:** 2026-08-05 against commit `ac57b17`.

Severity reflects impact on the project's two design goals — *small footprint* and *low runtime
cost* ([`README.md`](README.md) § Design goals).

**Contents**

1. [At a glance](#1-at-a-glance)
2. [Polling budget](#2-polling-budget)
3. [Features with no off switch](#3-features-with-no-off-switch)
4. [Dead files](#4-dead-files)
5. [Source provenance](#5-source-provenance)
6. [No attribution for bundled work](#6-no-attribution-for-bundled-work)
7. [Smaller items](#7-smaller-items)
8. [Recording a new entry](#8-recording-a-new-entry)

---

## 1. At a glance

| # | Item | Severity | Goal at risk |
|---|---|---|---|
| [D1](#d1-loops-run-while-their-feature-is-off) | Loops run while their feature is off | **High** | Runtime cost |
| [D2](#d2-two-loops-ignore-their-config-entirely) | Two loops never check config at all | **High** | Runtime cost |
| [D3](#3-features-with-no-off-switch) | Three always-on features with no UMM entry | **High** | Runtime cost |
| [D4](#4-dead-files) | ~6,700 lines of unreachable CSS | Medium | Footprint |
| [D5](#5-source-provenance) | Readable script source is not in this repo | **High** | Maintainability |
| [D6](#d6-debug-logging-is-on-by-default) | Debug logging on by default | Low | Runtime cost |
| [D7](#d7-duplicate-import) | Duplicate `@import` | Low | Footprint |
| [D9](#6-no-attribution-for-bundled-work) | No attribution for bundled third-party work | **High** | Licensing |

---

## 2. Polling budget

`$.Schedule` self-recursion is the only timer Panorama offers
([`PANORAMA.md`](PANORAMA.md) §4), so it is also the only way this mod can waste frames. This table is
the standing cost **with every optional feature at its default**.

Keep it current: **any change that adds, removes, or re-times a loop updates this table in the same
commit.**

### `hud.xml` — runs in every match

| Loop | Interval | Rate | Work per tick | Gated by a setting? |
|---|---:|---:|---|---|
| `qollite_map_settings.js` → `r()` | 0.03 s | ~33 Hz | Walks ancestors and a 7-name panel list checking `gDetailView`/`gScoreboardOpen`; calls `QolLiteMapSize.applyCurrentSize()` while open | **No** |
| `qollite_map_size.js` → `l()` | 0.06 s | ~17 Hz | Walks ancestors of `#map_render` looking for `.map_targeting` | Reads the flag inside; **the loop itself always runs** |
| `qollite_map_urn.js` → `O()` | 0.15 s | ~7 Hz | Parses `#GameTime`, class-searches for `idol_*` markers, updates marker geometry | Reads the flag inside; **the loop itself always runs** |
| `qollite_map_poi.js` → `v()` | 0.25 s | 4 Hz | Ancestor walk for `.is_underground`; regex-parses `#GameTime` | **No** |

### `base_hud_and_db_overlay.xml`

| Loop | Interval | Rate | Work per tick | Gated? |
|---|---:|---:|---|---|
| `qollite_notifications_bootstrap.js` → `k()` | 0.25 s | 4 Hz | Reads cached clock, calls `Scheduler.tick()` | Loop unconditional; `tick()` returns early when disabled |
| `qollite_notifications_manager.js` → `z()` | 0.25 s | 4 Hz | Expires visible notices | ✅ **Self-limiting** — only re-arms while a notice is on screen. *This is the pattern to copy — annotated source in [`PANORAMA.md`](PANORAMA.md) §4.* |

### `citadel_hud_top_bar.xml`

| Loop | Interval | Rate | Work per tick | Gated? |
|---|---:|---:|---|---|
| `qollite_notifications_clock_bridge.js` → `g()` | 0.25 s | 4 Hz | Hideout check, `#GameTime` parse, **broadcasts on the bus** — every listener in every context wakes | **No — the file never references config** |
| `qollite_notifications_urn_detector.js` → `h()` | 0.2 s | 5 Hz | `FindChildrenWithClassTraverse` across the HUD root for **5 class names** | **No — the file never references config** |
| `qollite_topbar.js` | variable | — | Generation-guarded re-checks | Partially |
| `qollite_showrank.js` | variable, 0.15 s → 1 s → 20 s | — | Retry/backoff after events | ✅ Event-driven with backoff |

### `hud_hero_testing.xml` — hideout only

Four loops at 0.2 s and two at 0.5 s. Bounded to the hideout, so not a match-time cost.

### D1. Loops run while their feature is off

**Severity: High. Files:** `qollite_map_size.js`, `qollite_map_urn.js`, `qollite_map_poi.js`,
`qollite_map_settings.js`.

The POI overlay and urn tracker both default to **off** (`qollite_map_state.js`:
`poiCratesEnabled: false`, `poiStatuesEnabled: false`, `urnTrackerEnabled: false`). Their loops run
anyway — the flag is checked *inside* the tick, after the wakeup and often after the DOM walk.

A user who enables nothing still pays roughly **60 wakeups per second** in the HUD context, several of
them doing ancestor walks and regex work.

**Fix:** check the flag before re-arming, and re-start the loop from the setting's change handler.

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

### D2. Two loops ignore their config entirely

**Severity: High. Files:** `qollite_notifications_clock_bridge.js`,
`qollite_notifications_urn_detector.js`.

Neither file contains a single reference to `QolLiteNotificationsConfig`. Both start unconditionally
at load (`e.start()` at the end of the file) and never stop:

- The bridge **broadcasts on `ClientUI_FireOutput` four times a second**, which wakes every listener
  in every Panorama context — including the UMM cores and any other mod on the bus.
- The urn detector runs `FindChildrenWithClassTraverse` over the entire HUD root for five class names,
  five times a second.

A user who has disabled Map Event Reminders in UMM pays the full cost of both, forever.

**Fix:** gate both on `QolLiteNotificationsConfig.enabled` (and the urn detector additionally on
`events.soul_urn`), stopping the loop rather than skipping the body. The bridge is the harder case
because it lives in a different context from the config — it needs the enabled state pushed to it over
the bus, or a local mirror updated by the UMM adapter.

---

## 3. Features with no off switch

**Severity: High.** See [`UMM.md`](UMM.md) §4 for the full table.

[show-rank](systems/show-rank.md), the [top bar](systems/top-bar.md) additions, and the
[Statlocker button](systems/statlocker.md) have **no UMM registration and no setting anywhere**. They
run in every match and the user cannot decline them.

show-rank is the most significant: it is the mod's largest body of logic (87 KB of minified
JavaScript in 170 lines), it is loaded into **six** separate layout contexts, and it issues **HTTP
image requests to `api.deadlock-api.com`** — a third-party service — for every player in the match. There is no way to turn that off, and no in-repo documentation of the privacy or
availability implications.

**Fix:** register all three with UMM. Whether they default on or off is a product decision; *having
the switch* is not optional if opt-in is what keeps the runtime cost defensible.

---

## 4. Dead files

**Severity: Medium (footprint).** Three stylesheets are referenced by **nothing** — no layout `<include>`,
no `@import`, anywhere in the repo:

| File | Lines |
|---|---:|
| `panorama/styles/topbar_rank_base/citadel_hud_top_bar.css` | 3,707 |
| `panorama/styles/base/citadel_hud_top_bar.css` | 2,702 |
| `panorama/styles/base/citadel_hud_top_bar_chat.css` | 313 |
| **Total** | **6,722** |

These live under mod-invented directories (`base/`, `topbar_rank_base/`), so unlike a Valve path they
are not loaded implicitly — nothing can reach them. They are almost certainly leftovers from an
earlier merge of the top-bar mods, when the override still `@import`ed its baseline.

**Before deleting:** confirm against the compiled VPK that no `.vcss_c` references them, since this
repo holds decompiled output and an import could in principle have been flattened away
([`ARCHITECTURE.md`](ARCHITECTURE.md) § The `base/` pattern). If confirmed, deleting them removes
~6,700 lines of shipped weight for zero behaviour change.

---

## 5. Source provenance

**Severity: High (maintainability).** Every file in `panorama/scripts/` is **minified Closure Compiler
output**, and the readable source is not in this repository. Layouts and stylesheets are Source 2
Viewer decompiles. Full detail in [`ARCHITECTURE.md`](ARCHITECTURE.md) § Provenance.

Practical consequences:

- Script changes cannot be reviewed meaningfully, and any hand-edit is silently discarded the next
  time real source is compiled.
- There is no way to tell, from this repo alone, whether a given file is current with its upstream.

**Fix:** document where each script's source lives and what regenerates it. For the minimap and
event-reminder modules the upstream is known (the standalone BetterMap and Map Event Reminders
projects, whose module structure maps one-to-one onto `qollite_map_*` and `qollite_notifications_*`).
For the rest — `qollite_showrank`, `qollite_topbar`, `qollite_quickbuy`,
`qollite_recent_purchase_icons`, `qollite_hero_testing` — it is **unknown**, and that is the single
biggest obstacle to working on this codebase.

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

## 7. Smaller items

### D6. Debug logging is on by default

- `qollite_notifications_log.js` declares `DEBUG: true`, and its `log()` writes to `$.Msg`
  **unconditionally** — the flag is decorative.
- `qollite_map_log.js` defaults its debug flag to `true`, so `QolLiteMapLog.log()` also prints.

Every tick of several loops therefore writes console lines in a shipped build. Low impact, trivially
fixed, and it makes the log unusable for actually diagnosing anything.

### D7. Duplicate import

`panorama/styles/citadel_db_page_profile.css` imports
`base/citadel_db_page_profile.vcss_c` **twice** (lines 3 and 48). Harmless but a sign that the file
has been merged more than once without review.

### D8. Upstream naming leaked into shipped identifiers

`qollite_map_*.js` logs with a `[BetterMap]` prefix, and the urn marker uses `bm_urn*` classes and a
`BmMinimalMap` state class. This is not dead code and must not be "cleaned up" casually — the CSS in
`hud_minimap.css` matches those exact names. Recorded so nobody mistakes it for a leftover.

---

## 8. Recording a new entry

Add an entry when you find a real problem in shipped code. Each one states:

1. **Where** — `file:line` or file plus symbol.
2. **Why it's bad** — the concrete harm, ideally measured, and which design goal it puts at risk.
3. **How it should be** — the correct pattern, with a snippet if it is not obvious.
4. **Status** — open, or resolved with the commit that fixed it.

Then add a row to [§1 At a glance](#1-at-a-glance). Resolved entries stay in the file with their
resolution — the history is why the rule exists.
