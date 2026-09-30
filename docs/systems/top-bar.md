# Top bar

> Objective timers and urn tracking added to the match top bar, plus spent-souls rows per player.
>
> **Origin:** Top Bar Plus · **Runs in:** every match, and the hideout · **Off switch:** ❌ none
> **Last verified:** 2026-09-30 against branch `fix/remerge-6722` (uncommitted).

Rebased onto game build 6722 (layouts and both stylesheets); nothing on this page has been checked in
game since. `4bb5c0e` dropped every Top Bar Plus panel and the `topbar_rank_topbar` include from
`citadel_hud_top_bar.xml` while keeping `qollite_topbar` and its rules, and pasted pre-patch copies
of both sheets; the re-merge restored the `1f0fe0f` layouts and sheets (the pre-patch sheets were the
likely reason for the drop, and also why "Voted!" came back).

---

## What it does

| Element | Panels |
|---|---|
| **Urn tracker card** — networth value and a countdown | `#UrnTracker` → `#UrnNetworthCard`/`#UrnTrackerLabel`, `#UrnHudCard`/`#UrnHUD` |
| **Bridge buff timer pill** | `#BuffHUD` → `#BuffTimeHUD`, `#BuffImgHUD` |
| **Rejuvenator timer pill** with phase number | `#RejuvHUD` → `#RejuvTimeHUD`, `#RejuvImgHUD`, `#RejuvNumHUD` |
| **Rejuvenator buff banner** | `#RejuvBuff` → `#RejuvTimeBuff` |
| **Rejuvenator charge indicators** per team | `#RejuvenatorCharges` → `#RejuvenatorFriendly`, `#RejuvenatorEnemy` |
| **Spent souls** per player row | `#SpentSoulDisplay` in `citadel_hud_top_bar_player.xml` |
| **Hideout clock and net worth** | reuses the same panels while `InHideout` — the mod keeps the top bar visible in the hideout, which Valve collapses |

State is expressed as CSS classes rather than inline styles — `#BuffHUD.yellow`, `#BuffHUD.red`,
`#RejuvImg.rotating.reverse`, `.TopbarRankObjectiveUrnLive`, `.TopbarRankObjectiveRiftWarning`, and so
on, defined in `topbar_rank_topbar.css` (and duplicated in `citadel_hud_top_bar.css`).

The script also computes a **soul-advantage** state and looks up `TopbarRankAdvantage*` panels for it,
but no layout or stylesheet in the repo defines any `TopbarRankAdvantage*` id or class, and none has
since the `959f80e` import — so that readout has nothing to render into (**inferred**; verified by
grep only).

The earlier **team-average rank badges** (`#ShowRankTeamAverageLayer`) were Show Rank's and were
removed with it in `ecdacbb`.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/citadel_hud_top_bar.xml` | The panel tree above; 3 script includes (`qollite_topbar` and the two [event reminder](event-reminders.md) bridges) |
| `panorama/layout/citadel_hud_top_bar_player.xml` | Per-player row, **instantiated once per player**: includes `qollite_topbar` and, for styles, `citadel_base_styles`, `hud_common` and `topbar_rank_topbar` only |
| `panorama/scripts/qollite_topbar.js` | All logic (30 minified lines, dense) |
| `panorama/styles/citadel_hud_top_bar.css` | Valve's sheet (6722) + ~1,070 appended Top Bar Plus lines — 4,270 lines |
| `panorama/styles/topbar_rank_topbar.css` | 4,603 lines — a **full fork of Valve's `citadel_hud_top_bar.css`** (closest Valve revision `dad12d7f`, rebased onto 6722) with Top Bar Plus's rules appended. Despite its name it is not Show Rank's ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §2) |
| `panorama/styles/objectives_map.css` | Imports `topbar_rank_base/objectives_map.vcss_c` |

### Which sheet styles what

The top bar layout loads **both** full sheets, `citadel_hud_top_bar.css` first and
`topbar_rank_topbar.css` after it, so on equal specificity the latter wins. The player rows load
**only** `topbar_rank_topbar.css` ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §7). Consequences:

- Any Valve rule the player rows need must be present in `topbar_rank_topbar.css`. That is why the
  file has to be rebased on every patch like a Valve path — it is listed in `ALIASES` in
  `scripts/rebase_overrides.py`.
- Build 6711 added Valve's hero-release vote to each row (`.PlayerHeroReleaseVote`, the "Voted!"
  `.VotedLabel`, `#HeroReleaseVoteHeroImage`, `#BackgroundTexture`/`2`, keyframes `backgroundPulse`,
  `backgroundPulse2`, `VoteAppear`). Those rules are now in both sheets (`topbar_rank_topbar.css`
  from line 2930). Before `topbar_rank_topbar.css` was rebased, the rows had no rule hiding the
  label. **Unverified in game.**
- The rebase kept the mod's own differences from Valve: team-networth / score widths, rejuvenator
  charges, objective-damage rules, the hideout visibility (`CitadelHudTopBar .connectedToHideout
  CitadelHudTopBar { visibility: visible }`), and the `#PauseIndicator` rules.

> `citadel_hud_top_bar.xml` is shared with the [event reminder](event-reminders.md) bridges.
> Coordinate before changing it.

---

## How it works

**Clock.** Probes `Game["GetDOTATime"]`, `Game["GetGameTime"]`, `Game.Time`, `Game.GameTime`, and
`GameUI["GetGameTime"]` by **string index** with type checks — precisely because none of them is
guaranteed to exist in Deadlock ([`../PANORAMA.md`](../PANORAMA.md) §4). If all fail it looks for the
clock label by id — `HudGameTime` and `MainGameTime` first, which exist nowhere, then `#GameTime` —
and caches the result for 800 ms.

**Hideout detection.** Tries `Game.GetMapInfo().map_display_name` against
`hero_testing_hideout` / `hideout` / `dl_hideout`, then falls back to the `connectedToHideout` /
`InHideout` classes in several casings.

**Numbers.** Team net worth is scraped from `.ScoreLabel` text, parsing `k` / `m` / `b` suffixes back
into integers.

**Scheduling.** `$.Schedule` loops guarded by a generation counter, so a stale callback from a
previous match cannot write into the current one: 1 Hz in the top bar context, 2 Hz in **each** player
row (a walk of that row's `#PlayerModsContainer`). A 0.5 s setup retry re-arms only when a context's
ids were found but setup failed; a context with neither the top-bar ids (`BuffTime`, `RejuvTime`,
`UrnTrackerLabel`) nor the row ids (`SpentSoulDisplay`, `PlayerModsContainer`) gets no loop and no
retry. With the top-bar panels missing, the top-bar copy falls through to the row branch and may
run the row loop on the first row it finds (**inferred**, read from the minified `da()`). A 12-player
match runs 13 copies of the script ([`../TECH_DEBT.md`](../TECH_DEBT.md) §2).

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
- **Per-row script copies** — one copy of `qollite_topbar.js` per player row
  ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §5). Unmeasured.
- **Every clock read searches for an id that does not exist** (`HudGameTime`) from the UI root before
  finding `#GameTime`, because the 0.8 s cache always expires between 1 s ticks.
- **Duplicate weight** — the Top Bar Plus rules exist in both full sheets, and the top bar layout
  loads both (~8,900 lines together).
- `world-blur` on `#Buff`, `#Rejuv`, `#BuffHUD`, `#RejuvHUD` and on `#RejuvBuff`, which is always
  present at opacity 0 — [`../TECH_DEBT.md`](../TECH_DEBT.md) D14.
- The timer `<Image>`s reference `icon_powerup.svg` / `icon_rejuvenator.svg` rather than Valve's
  `.vsvg` form — **unverified** whether they resolve ([`../TECH_DEBT.md`](../TECH_DEBT.md) D16).
- Build 6711 added Valve's own midboss / rejuvenator timer (`#MidbossTimerLabel`,
  `citadel_hud_top_bar.xml:99`). It may duplicate Top Bar Plus's rejuvenator pill — a product question,
  not checked in game.
- **Silent failure by design.** The blanket `try`/`catch` means a Valve rename degrades to "the
  feature quietly does nothing" with no diagnostic. Consider logging once per distinct failure.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) §5.

---

## See also

- [event reminders](event-reminders.md) — its two bridge scripts also load here
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9 — the rebase procedure, including mod-named forks
