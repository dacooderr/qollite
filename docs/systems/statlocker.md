# Statlocker button

> A button that opens the player's Statlocker page — originally a separate mod, now effectively
> provided by Friends Rank.
>
> **Origin:** Statlocker · **Runs in:** nowhere — its script is not loaded · **Off switch:** ❌ none
> **Last verified:** 2026-09-30 against commit `eb80c34`.

> ### ⚠️ The script described here does not run
> No layout includes `qollite_profile.js`. Its include was dropped from `citadel_db_page_profile.xml`
> in `9935d0c`, when that layout was rewritten. The Statlocker buttons users see now come from
> **Friends Rank** (below). This page records what the original script does, for whoever decides
> whether to delete it ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).

---

## What it does today

Friends Rank (added in `27087ae`; no page of its own yet, origin unrecorded —
[`../BUNDLE.md`](../BUNDLE.md) §5) puts **"View Statlocker Profile"** buttons in:

| Where | Panel | Layout |
|---|---|---|
| Profile page | `#FriendsRankStatlockerProfileButton` | `citadel_db_page_profile.xml` |
| Profile card popup | `#FriendsRankStatlockerPopupButton` | `profile_card.xml` |
| Post-game scoreboard | `.FriendsRankStatlockerSlot` / `#FriendsRankScoreboardStatlockerButton` | `post_game/citadel_db_post_game_scoreboard_new.xml`, `post_game/citadel_db_post_game_team.xml` |

Each opens `https://statlocker.gg/profile/<account id>` when clicked. The icon is
`panorama/images/friends_rank/statlocker_logo_green.*`.

At the 6722 rebase the post-game team row was restructured by Valve (`#ViewProfileButton`,
`#AddToFriendsButton`, `#ReportButton` in a hover-revealed row); the mod's 36 px Statlocker button was
placed first in that row. **Unverified in game.** Valve's snippet root has `hittestChildren="false"`,
so the button may not be clickable there (**inferred**). The maintainer saw a crash on the post-game MVP
screen with this layout and stopped it by shipping Valve's file instead; the layout is back, the cause
is unknown, and the bisect order if it returns is in [`../TECH_DEBT.md`](../TECH_DEBT.md) D17.

---

## Files

| Path | Role |
|---|---|
| `panorama/scripts/qollite_profile.js` | The original button script — **included by no layout** |
| `panorama/images/statlocker/statlocker.png` / `.vtex` | Its icon — referenced only by that script |
| `panorama/styles/citadel_db_page_profile.css` | Overlay — `@import`s `base/citadel_db_page_profile.vcss_c`, adds the Statlocker button rules, `#AllStats` / `#CoreRating`, `#AccountID` and 4×3 fixes |
| `panorama/styles/base/citadel_db_page_profile.css` | Pristine Valve baseline (6722) |

`profile_card.css` is **not** part of this feature and not a `base/` override: it is an unmodified
copy of Valve's file ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4). The `base/profile_card.css` this page
used to list was deleted in `ecdacbb`.

Several selectors in the overlay match nothing in the 6722 profile layout — `#AllStats`,
`#CoreRating`, `#TabsContainer`, `#ViewLeaderboardContainer`; `#AccountID` exists only in
`profile_card.xml`. The same was true at 6701. Zero runtime cost when unmatched.

---

## How the original script works

Recorded from the minified source; none of it runs today.

- **When it applies.** Walks up to 24 ancestors looking for `.isShowingProfilePage`, then falls back
  to any of the first 10 ancestors carrying both `.DashboardPage` and `.active`.
- **Account id.** Four strategies in order, each guarded: an `.AccountID`-classed label's text;
  `accountid` / `account_id` / `accountID` as panel properties, then attributes; a breadth-first walk
  of the panel tree capped at 3,000 nodes repeating that; `Game.GetLocalPlayerInfo()`, then
  `Players.GetLocalPlayer()` → `GetPlayerData` / `GetPlayerInfo`. Each result is validated as 5–12
  digits.
- **The button.** Injected next to a `coreRating`-classed element. **That class exists nowhere** —
  not in any layout, stylesheet or script of build 6701 or 6722, nor in `client_strings.txt` — so
  even if the script were loaded, the button could probably never be created (**inferred**).
- **Scheduling.** A loop at 1 s while the profile page is hidden and 0.35 s while it shows, plus the
  3,000-node walk every 1.5 s — forever, with no stop condition.

---

## Settings

**None.** Neither this script nor Friends Rank registers with UMM.

---

## Known issues

- **Dead file.** `qollite_profile.js` and its icon ship but never run. Delete, or re-include and fix
  the `coreRating` target — the owner's call ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).
- **Links to a third-party service.** The live Friends Rank buttons are user-initiated and visible,
  so the concern is small, but it is still an undisclosed outbound link. Friends Rank also requests
  rank images from `api.deadlock-api.com` automatically ([`../BUNDLE.md`](../BUNDLE.md) § Third-party
  services).
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) §5.

---

## See also

- [Show Rank](show-rank.md) — removed; the other rank/profile integration this pack used to carry
