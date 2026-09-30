# Escape menu

> Adds queueing and navigation to the in-game escape menu.
>
> **Runs in:** every match · **Off switch:** ❌ none (nothing to switch off)
> **Last verified:** 2026-09-30 against working tree on fix/patch-6711-rebase (uncommitted).

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
| `#news` — News | `CitadelShowNewsPage()` |

It also groups `#Unstick` and a second `#Reconnect` button into a mod-added `.HelpOptions` panel, and
opens with the **Players** tab selected (vanilla selects Friends).

The "Retry ranks" button (`#ShowRankRetryMissingRanks`) and the `qollite_showrank` include that used
to live here were removed with [Show Rank](show-rank.md) in `ecdacbb`.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/hud_escape_menu.xml` | The menu tree; styles only (`citadel_base_styles`, `hud_escape_menu`), no script |
| `panorama/styles/hud_escape_menu.css` | Menu styling — Valve's sheet plus the mod's `#ContextualMenu` size, `.HelpOptions`, `#Reconnect`, button placement |

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

Rebased onto 6722 against Valve revision `5372faa` — not the tool's automatic pick, which was older
and wrong ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9). That carried in two Valve changes the
override had missed: `#EscapeButton` is now a `CitadelBindingButton` with `text="#menu_resume"`
(since `f3ac323`, January), and `#matchmakingLeaveQueue` has class `leavequeue` (6711).

Labels use `#token` localization, so the added buttons appear in the player's language for free.

---

## Settings

**None**, and none needed.

---

## Known issues

- `hud_escape_menu.xml` is a **full override**. Like `hud.xml`, it must be rebased when Valve changes
  the escape menu, or new options will silently disappear
  ([`../PANORAMA.md`](../PANORAMA.md) §1). Worth checking after any patch that touches the menu.
- `.FeedbackRow #Unstick` in Valve's own sheet no longer matches anything (Unstick left `FeedbackRow` in
  Valve's layout too). Valve's, left as is.

---

## See also

- [Show Rank](show-rank.md) — removed; it used to add a "Retry ranks" button here
