# Event reminders

> Timed on-screen notices before and when map objectives spawn.
>
> **Origin:** Map Event Reminders · **Runs in:** every match · **Off switch:** UMM `eventnotifier` (partial)
> **Last verified:** 2026-08-05 against commit `ac57b17`.

The most architecturally interesting feature in the mod: it spans **three Panorama contexts** and is
the only one that had to build its own message protocol to do so.

---

## What it does

Shows a centred announcement 15 seconds before an objective spawns, then again on spawn, with an
optional sound. Localised English / Russian.

| Event | First spawn | Repeats | Notes |
|---|---:|---|---|
| Weak camps | 2:00 | — | |
| Crates & statues | 3:00 | — | |
| Medium camps | 5:00 | — | |
| Bridge buffs | 5:00 | every 5:00 | |
| Strong camps | 8:00 | — | |
| Sinner's Sacrifice | 8:00 | — | |
| Soul Urn | 10:00 | per appearance | Warning only from the schedule; **actual spawns are detected live** |

> **Provenance of these timings.** They were cross-checked against a shipped timer mod's decompiled
> constants rather than guessed. Re-verify against patch notes when Valve changes map timings.
> Known but **out of scope**: Rejuvenator/mid-boss (first 10:00, phases 410/350/290 s), Rift/KOTH
> (~12:00, repeats 7:00), and urn re-spawns every 5:00 after the first.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/base_hud_and_db_overlay.xml` | Hosts `#NotificationRoot` and loads the 9 core scripts |
| `panorama/styles/notif.css` | `#NotificationRoot` + `.GenericAnnouncement` fade/scale transitions |
| `panorama/layout/citadel_hud_top_bar.xml` | Loads the two bridge scripts (see below) |

**Scripts — overlay context** (`base_hud_and_db_overlay.xml`), load order matters:

| Script | Global | Role |
|---|---|---|
| `qollite_notifications_log.js` | `QolLiteNotificationsLog` | `$.Msg` wrapper, `[NOTIF]` prefix |
| `qollite_notifications_config.js` | `QolLiteNotificationsConfig` | Plain settings object |
| `qollite_notifications_strings.js` | `…Strings` | EN/RU strings, language detection |
| `qollite_notifications_event_schedule.js` | `…EventSchedule` | The table above, as data |
| `qollite_notifications_clock.js` | `…Clock` | Receives match time off the bus |
| `qollite_notifications_scheduler.js` | `…Scheduler` | Decides what fires when |
| `qollite_notifications_manager.js` | `…Manager` | Builds, updates, and expires the notice panel |
| `qollite_notifications_umm_adapter.js` | `…UmmAdapter` | UMM registration, id `eventnotifier` |
| `qollite_notifications_bootstrap.js` | — | Dependency wait, init, and the master tick |

**Scripts — top bar context** (`citadel_hud_top_bar.xml`):

| Script | Role |
|---|---|
| `qollite_notifications_clock_bridge.js` | Reads `#GameTime`, broadcasts it; also broadcasts the detected language |
| `qollite_notifications_urn_detector.js` | Watches the minimap for `idol_*` markers, broadcasts a spawn edge |

---

## How it works

### The context problem

The notification panel must live in the always-on overlay (`base_hud_and_db_overlay.xml`) so it
renders above everything. But the match clock is a `#GameTime` label in the **top bar** context, and
Panorama contexts share nothing ([`../PANORAMA.md`](../PANORAMA.md) §3).

The solution is two small scripts in the top-bar context that publish what the overlay needs:

```
citadel_hud_top_bar.xml                       base_hud_and_db_overlay.xml
┌──────────────────────────┐                  ┌──────────────────────────┐
│ clock_bridge   4 Hz      │                  │ Clock  ← cached, 3 s TTL │
│   reads #GameTime        │─ {notif:1,       │   ▲                      │
│                          │    type:"clock", │   │                      │
│                          │    t:<seconds>}─▶│ Scheduler  4 Hz tick     │
│                          │                  │   │                      │
│                          │─ {type:"lang"}──▶│ Strings                  │
│ urn_detector   5 Hz      │                  │   │                      │
│   watches idol_* classes │─ {type:"urn"}───▶│ Manager → #NotificationRoot
└──────────────────────────┘   ClientUI_      └──────────────────────────┘
                               FireOutput
```

All three payloads carry `{"notif":1}` so receivers can filter cheaply before parsing, and so they do
not collide with the UMM protocol on the same channel.

### Clock

The bridge parses `#GameTime`, tolerating `h:mm:ss` and `mm:ss` and stripping HTML, and broadcasts
every 0.25 s. `Clock.getMatchTime()` returns `null` if the last message is **older than 3 seconds** —
so a broken bridge degrades to "no notifications" rather than to a stuck clock.

The bridge also suppresses itself in the hideout, checking `connectedToHideout` in three casings
because the class name is inconsistent across builds.

### Scheduler

Expands the schedule table into concrete trigger times (repeating events unrolled to 3600 s), groups
events that share a trigger so "Weak Camps & Medium Camps" appears once, and:

- **Primes on first tick** — everything already past is marked fired, so joining a match in progress
  does not dump a backlog on screen.
- **Detects clock resets** — a backward jump of more than 30 s is a restart and clears state; smaller
  jumps are treated as jitter and ignored.

### Manager

Creates a single `.GenericAnnouncement` panel under `#NotificationRoot`, then reuses it. Entries are
keyed, merged into one title, and expired on a **self-limiting** tick that stops when nothing is on
screen — the pattern the rest of the mod should follow
([`../TECH_DEBT.md`](../TECH_DEBT.md) §2). Removal adds `.NotifExpired`, waits for the CSS fade, then
`DeleteAsync(0)`.

Spawn sounds are rate-limited to one per 300 ms.

### Urn

Detection beats scheduling here. The urn's real timing shifts, but the engine paints an `idol_spawn`
class onto its own minimap marker — one of the few readable pieces of world state
([`../PANORAMA.md`](../PANORAMA.md) §3). The detector watches for a **rising edge** (armed only after
all `idol_*` markers have gone), then the overlay runs a 12-second landing countdown driven by the
bridged clock, falling back to wall time if the clock is unavailable.

---

## Settings

`QolLiteNotificationsConfig`, all registered with UMM as `eventnotifier`:

| Key | Default | Widget |
|---|---|---|
| `enabled` | `true` | toggle |
| `showSpawn` | `true` | toggle |
| `showWarning` | `true` | toggle |
| `warnSecs` | `15` | select — 5 / 10 / 15 / 30 s |
| `soundEnabled` | `true` | toggle |
| `soundEvent` | `"UI.RevealVote"` | not exposed |
| `durationSecs` | `6` | not exposed |
| `graceSecs` | `5` | not exposed |
| `debugSchedule` | `false` | not exposed — compresses the schedule for testing |
| `events.*` | all `true` | 7 toggles under an `Events` group |

---

## Known issues

- **The two bridge scripts never check `enabled`** — [`../TECH_DEBT.md`](../TECH_DEBT.md) D2. A user
  who disables this feature still pays a 4 Hz bus broadcast and a 5 Hz full-tree class search, every
  match, forever. This is the clearest violation of the "off means free" rule in the codebase, and it
  is awkward to fix because the bridges live in a different context from the config — the enabled
  state has to be pushed to them over the bus.
- `qollite_notifications_log.js` logs unconditionally despite its `DEBUG` flag —
  [`../TECH_DEBT.md`](../TECH_DEBT.md) D6.
- Timings are hard-coded and will drift when Valve changes map pacing. There is no extraction
  pipeline; re-verify against patch notes.
- Only English and Russian exist. Any other client language falls back to English.

---

## See also

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) § Cross-context communication — the bus protocols
- [`../PANORAMA.md`](../PANORAMA.md) §3 — why the bridges are necessary at all
- [minimap](minimap.md) — its urn tracker reads the same `idol_*` signal, independently
