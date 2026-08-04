# Rank badges

> Shows each player's predicted rank badge across the HUD, scoreboard, and menus.
>
> **Origin:** Show Rank · **Runs in:** 6 contexts · **Off switch:** ❌ none
> **Last verified:** 2026-08-05 against commit `ac57b17`.

> ### ⚠️ Read before changing anything here
> This feature makes **outbound HTTP requests to a third-party service** for every player in the
> match, and the user has **no way to disable it**. That combination is the most significant open
> issue in the mod — see [Known issues](#known-issues).

---

## What it does

Renders a rank badge image next to player names in:

| Context | Layout |
|---|---|
| Top bar | `citadel_hud_top_bar.xml` |
| Top bar player rows | `citadel_hud_top_bar_player.xml` |
| Player context menu | `citadel_ui_context_menu_player.xml` |
| Escape menu player list | `hud_escape_menu.xml` |
| Player list entries | `players_list_entry.xml` |
| Profile card | `profile_card.xml` |

Plus a **team average** badge pair in the top bar (`#ShowRankAverageFriendlyImage`,
`#ShowRankAverageEnemyImage`), and a **"Retry ranks"** button in the escape menu
(`#ShowRankRetryMissingRanks`) that re-runs the lookup for players whose badge failed to load.

---

## Files

| Path | Notes |
|---|---|
| `panorama/scripts/qollite_showrank.js` | **The largest logic script in the mod** — 87 KB in 170 minified lines, extremely dense. (`qollite_recent_purchase_icons.js` is larger at 385 KB, but it is a data table.) |
| `panorama/styles/topbar_rank_topbar.css` | 5,377 lines — badge styling for the top bar |
| `panorama/styles/topbar_rank_player_list.css` | Player list |
| `panorama/styles/topbar_rank_escape_menu.css` | Escape menu |
| `panorama/styles/topbar_rank_base/objectives_map.css` | Baseline, imported by `objectives_map.css` |
| `panorama/styles/topbar_rank_base/citadel_hud_top_bar.css` | ⚠️ **Dead** — [`../TECH_DEBT.md`](../TECH_DEBT.md) §4 |

---

## How it works

### Rank source

Badges come from **`api.deadlock-api.com`**, a community service, loaded as images:

```
https://api.deadlock-api.com/v1/players/{account_id}/rank-predict/image?format=webp
https://api.deadlock-api.com/v1/players/rank-predict/image?account_ids={id×6}&format=webp
```

The second, batched form is used for the team average and requires exactly six deduplicated ids.
Panorama's `Image` accepts remote `https://` URLs ([`../PANORAMA.md`](../PANORAMA.md) §3), so this is
`SetImage(url)` — no JSON parsing, no visible request layer, and no error surface if the service is
slow or down.

### Finding account ids

There is no clean API. The script derives ids by, in order: reading an `AccountID`-classed label,
reading `accountid` / `account_id` / `accountID` panel properties and attributes, walking the panel
tree, and finally probing `Game.GetLocalPlayerInfo()` / `Players.*` — all wrapped in `try`/`catch`
because none of them is guaranteed to exist. It also converts to `[U:1:…]` Steam3 and 64-bit forms.

### Working across six contexts

The script is loaded into six separate layouts, which share no globals
([`../PANORAMA.md`](../PANORAMA.md) §3). Its instances coordinate through a versioned object parked on
`$`:

```js
$.__QolLiteShowRankWebMediaBridge = { version: 236, state: { … } }
```

The `version: 236` guard means an older or newer copy of the script will not corrupt the shared state.
Note this shares state **within** a context, not across them.

### Matching players to rows

The hard part. The script maintains candidate rows, matches by normalised player name, requires all
twelve slots and both team sides to be known before committing a team-average lookup, and retries with
backoff (0.15 s → 1 s, and a 20 s long retry). `$.Schedule` intervals adapt to how the lookup was
triggered — a mouse activation gets 1.25 s, other paths 6.25 s.

---

## Settings

**None.** Not registered with UMM.

---

## Known issues

- **No off switch** — [`../TECH_DEBT.md`](../TECH_DEBT.md) §3. This is the priority fix for the
  feature.
- **Third-party network dependency, undisclosed.** Every match sends player account ids to
  `api.deadlock-api.com`. Users are not told, cannot opt out, and there is no documented behaviour for
  the service being unavailable. At minimum this needs a UMM toggle and a line in the README.
- **Loaded into six contexts**, so its cost multiplies by context count rather than being paid once.
- **Effectively unmaintainable in its current form.** The densest logic in the repo — 87 KB of
  minified JavaScript — with no upstream source here ([`../TECH_DEBT.md`](../TECH_DEBT.md) D5).
- One of its baseline stylesheets is dead — [`../TECH_DEBT.md`](../TECH_DEBT.md) §4.

---

## See also

- [top bar](top-bar.md) — shares `citadel_hud_top_bar.xml`
- [Statlocker](statlocker.md) — the other feature that links out to a third-party service
