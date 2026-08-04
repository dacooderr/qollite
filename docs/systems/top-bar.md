# Top bar

> Objective timers, urn tracking, and soul-advantage readouts added to the match top bar.
>
> **Origin:** Top Bar Plus · **Runs in:** every match · **Off switch:** ❌ none
> **Last verified:** 2026-08-05 against commit `ac57b17`.

---

## What it does

| Element | Panels |
|---|---|
| **Urn tracker card** — networth value and a countdown | `#UrnTracker` → `#UrnNetworthCard`/`#UrnTrackerLabel`, `#UrnHudCard`/`#UrnHUD` |
| **Bridge buff timer pill** | `#BuffHUD` → `#BuffTimeHUD`, `#BuffImgHUD` |
| **Rejuvenator timer pill** with phase number | `#RejuvHUD` → `#RejuvTimeHUD`, `#RejuvImgHUD`, `#RejuvNumHUD` |
| **Rejuvenator buff banner** | `#RejuvBuff` → `#RejuvTimeBuff` |
| **Rejuvenator charge indicators** per team | `#RejuvenatorCharges` → `#RejuvenatorFriendly`, `#RejuvenatorEnemy` |
| **Soul advantage** readout | `.TopbarRankAdvantage*` classes on the networth labels |
| **Team average rank badges** | `#ShowRankTeamAverageLayer` — populated by [rank badges](show-rank.md) |
| **Hideout clock and net worth** | reuses the same panels while `InHideout` |

State is expressed as CSS classes rather than inline styles — `#BuffHUD.yellow`, `#BuffHUD.red`,
`#RejuvImg.rotating.reverse`, `.TopbarRankObjectiveUrnLive`, `.TopbarRankObjectiveRiftWarning`, and so
on. All of them are defined in `topbar_rank_topbar.css`.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/citadel_hud_top_bar.xml` | The panel tree above, plus 4 script includes |
| `panorama/layout/citadel_hud_top_bar_player.xml` | Per-player row |
| `panorama/scripts/qollite_topbar.js` | All logic (30 minified lines, dense) |
| `panorama/styles/citadel_hud_top_bar.css` | Valve's sheet, extended |
| `panorama/styles/topbar_rank_topbar.css` | 5,377 lines — timer pills, urn card, advantage, rank badges |
| `panorama/styles/objectives_map.css` | Imports `topbar_rank_base/objectives_map.vcss_c` |

> `citadel_hud_top_bar.xml` is shared with [rank badges](show-rank.md) and the
> [event reminder](event-reminders.md) bridges. Coordinate before changing it.

---

## How it works

**Clock.** Probes `Game["GetDOTATime"]`, `Game["GetGameTime"]`, `Game.Time`, `Game.GameTime`, and
`GameUI["GetGameTime"]` by **string index** with type checks — precisely because none of them is
guaranteed to exist in Deadlock ([`../PANORAMA.md`](../PANORAMA.md) §4). If all fail it parses the
`#GameTime` label, cached for 800 ms. That fallback is the only path that always works.

**Hideout detection.** Tries `Game.GetMapInfo().map_display_name` against
`hero_testing_hideout` / `hideout` / `dl_hideout`, then falls back to the `connectedToHideout` /
`InHideout` classes in several casings.

**Numbers.** Team net worth is scraped from `.ScoreLabel` text, parsing `k` / `m` / `b` suffixes back
into integers, and the advantage classes are applied from the difference.

**Scheduling.** A variable-interval `$.Schedule` guarded by a generation counter, so a stale callback
from a previous match cannot write into the current one.

**Defensive style.** Almost every panel access goes through `IsValid()`-checked helpers wrapped in
`try`/`catch`. That is the right instinct for a mod that must survive Valve renaming a panel, but it
also means **failures are invisible** — if the top bar goes blank after a patch, nothing will be in
the log.

---

## Settings

**None.** Not registered with UMM; there is no way to turn any of this off.

---

## Known issues

- **No off switch** — [`../TECH_DEBT.md`](../TECH_DEBT.md) §3. Always-on, always costing.
- **Silent failure by design.** The blanket `try`/`catch` means a Valve rename degrades to "the
  feature quietly does nothing" with no diagnostic. Consider logging once per distinct failure.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) D5.
- Git history shows an unspent-souls readout was removed in `3ee1110`; `#SpentSoulDisplay` is still
  referenced in the script. **Unverified** whether that path is now dead.

---

## See also

- [rank badges](show-rank.md) — shares this layout, fills `#ShowRankTeamAverageLayer`
- [event reminders](event-reminders.md) — its two bridge scripts also load here
