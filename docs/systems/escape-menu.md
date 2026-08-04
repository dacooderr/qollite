# Escape menu

> Adds queueing and navigation to the in-game escape menu.
>
> **Runs in:** every match · **Off switch:** ❌ none (nothing to switch off)
> **Last verified:** 2026-08-05 against commit `ac57b17`.

Pure layout. No script of its own, no timers, no runtime cost.

---

## What it does

Lets you queue for a match, browse, and change hero **without leaving** a custom server or the
hideout — the "Menu (for queuing while in Custom Servers or Hideout)" entry in the README.

| Button | Action |
|---|---|
| `#newgame` — Play | `CitadelShowPlayPage()` |
| `#watchgame` — Watch | `CitadelShowWatchPage(true)` |
| `#guides` — Resources | `CitadelShowTrainingPage()` |
| `#changehero` — Change Hero | `CitadelEscapeMenuChangeHero()` |

It also hosts a **"Retry ranks"** tab button (`#ShowRankRetryMissingRanks`) belonging to
[rank badges](show-rank.md).

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/hud_escape_menu.xml` | The menu tree; also loads `qollite_showrank.vjs_c` |
| `panorama/styles/hud_escape_menu.css` | Menu styling |
| `panorama/styles/topbar_rank_escape_menu.css` | Rank badge styling in the player list |

---

## How it works

Every button calls a **C++-registered global** from an inline `onactivate` attribute. Those functions
already exist in the client; the mod is not implementing queueing, it is exposing entry points Valve's
own dashboard uses:

```xml
<Button id="newgame" class="nav_menu_item primary" onactivate="CitadelShowPlayPage()">
    <Label text="#menu_play" class="menuButtonLabel" />
</Button>
```

The rest of the layout is Valve's, carried through unchanged: matchmaking and reconnect option groups,
disconnect and abandon, `#Unstick` (which shells out via `CitadelConCommand('unstick')`), the friends
and players tabs, and `CitadelPrivilegedFeatures`.

Labels use `#token` localization, so the added buttons appear in the player's language for free.

---

## Settings

**None**, and none needed.

---

## Known issues

- `hud_escape_menu.xml` is a **full override**. Like `hud.xml`, it must be rebased when Valve changes
  the escape menu, or new options will silently disappear
  ([`../PANORAMA.md`](../PANORAMA.md) §1). Worth checking after any patch that touches the menu.
- Shared with [rank badges](show-rank.md) — coordinate before editing.

---

## See also

- [rank badges](show-rank.md) — owns the "Retry ranks" button in this layout
