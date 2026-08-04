# Leaderboard search

> Live name filter on the global leaderboard popup.
>
> **Runs in:** the leaderboard popup · **Off switch:** ❌ none (nothing to switch off)
> **Last verified:** 2026-08-05 against commit `ac57b17`.

The smallest feature in the mod — one function, no timers, runs only on keystrokes.

---

## What it does

Adds a search box to the global leaderboard. Typing hides every row whose player name does not
contain the query; clearing it shows everything again.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/popups/citadel_popup_global_leaderboard.xml` | Adds `#PlayerSearchInput`, loads the script |
| `panorama/scripts/qollite_leaderboard.js` | The filter function |
| `panorama/styles/leaderboard_search.css` | Search box styling |

---

## How it works

The layout wires the text entry's change event to a global function by name — the standard Panorama
HUD pattern ([`../PANORAMA.md`](../PANORAMA.md) §4):

```js
function QolLiteLeaderboardFilterPlayers() {
    // read #PlayerSearchInput, lowercase it
    // for each child of #PlayersContainer:
    //     name = first .playerRatingName descendant
    //           ?? row.GetChild(0).GetChild(2)        ← positional fallback
    //     row.visible = query === "" || name.toLowerCase().indexOf(query) !== -1
}
```

Two things worth noting:

- **The positional fallback.** If no `.playerRatingName` descendant exists, it takes the third child
  of the row's first child. That keeps the filter working through a class rename but will silently
  match the wrong label if Valve reorders the row.
- **`row.visible`, not `visibility: collapse`.** Setting the panel property is enough here and avoids
  touching the stylesheet cascade.

**No timers.** Work happens only on input.

---

## Settings

**None**, and none needed — the feature is inert until the leaderboard is open and the user types.

---

## Known issues

- The positional fallback is fragile in a way that fails *quietly and wrongly* rather than visibly.
  Worth a log line if it ever triggers.
- Matches a raw substring: no case-folding beyond `toLowerCase`, no accent normalisation.

---

## See also

- [`../PANORAMA.md`](../PANORAMA.md) §4 — inline handlers calling global functions
