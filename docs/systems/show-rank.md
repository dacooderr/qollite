# Rank badges (Show Rank) — removed

> Showed each player's predicted rank badge across the HUD, scoreboard, and menus.
>
> **Origin:** Show Rank · **Status:** ❌ **removed** in `ecdacbb` (2026-08-06) · **Runs in:** nowhere
> **Last verified:** 2026-09-30 against commit `fa59528`.

> ### This feature is no longer in the pack
> `qollite_showrank.js` and its stylesheets were deleted and its includes removed from all six
> layouts in `ecdacbb`, "remove Show Ranks to address performance reports". A grep of the working
> tree on 2026-09-30 finds no `qollite_showrank` file or include and no `ShowRank` id or class outside
> Valve's own `ShowRanked*` names ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §4). The page is kept so
> the reasons, and the traps hit while removing it, stay findable.

---

## What it was

A rank-badge image next to player names in six layouts — `citadel_hud_top_bar.xml`,
`citadel_hud_top_bar_player.xml`, `citadel_ui_context_menu_player.xml`, `hud_escape_menu.xml`,
`players_list_entry.xml`, `profile_card.xml` — plus a team-average badge pair in the top bar and a
"Retry ranks" button in the escape menu. Badges were images loaded from `api.deadlock-api.com`
(`/v1/players/{account_id}/rank-predict/image`, and a batched six-id form for the team average), for
every player in every match, with no setting to turn it off.

## Why it was removed

The script was 87 KB of minified logic (277 functions, 118 `try` blocks) and was included by
**per-instance** layouts, so a full lobby loaded and ran roughly a dozen isolated copies of it
([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §5). A UMM toggle could not have fixed that — hiding the
badges would have left every copy loading and running. Performance complaints had risen after it was
added; no frame-time measurement was taken.

## What the removal did

- Deleted `qollite_showrank.js`, `topbar_rank_player_list.css`, `topbar_rank_escape_menu.css`, and the
  then `profile_card.css` with its `base/` copy.
- Restored the six layouts' Show Rank panels, classes and handlers to Valve's markup.
  `citadel_ui_context_menu_player.xml` and `players_list_entry.xml` still ship as overrides with no
  known mod change.
- Cut Show Rank's rules out of `topbar_rank_topbar.css` but **kept the file** — it is Top Bar Plus's
  stylesheet and a fork of Valve's top bar sheet ([`../FIELD_NOTES.md`](../FIELD_NOTES.md) §2).
- Removed the "StatLocker Profile" / "Deadlock Profile" context-menu and profile-card entries, which
  had come from Show Rank.

## What came after

A separate feature, **Friends Rank** ("Show Player/Friends Ranks", `27087ae`), later added rank badges
to the profile page and profile cards, also from `api.deadlock-api.com`, plus Statlocker buttons on
the post-game scoreboard. It too loads a script into `profile_card.xml` per instance. It has no page
yet and its origin is not recorded — [`../BUNDLE.md`](../BUNDLE.md) §5, [`../TECH_DEBT.md`](../TECH_DEBT.md) D13.

---

## See also

- [`../FIELD_NOTES.md`](../FIELD_NOTES.md) §2–§5 — the traps found while removing it
- [top bar](top-bar.md) — owns `topbar_rank_topbar.css` despite the name
