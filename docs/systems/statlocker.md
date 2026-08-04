# Statlocker button

> Adds a button on the profile page that opens the player's Statlocker page.
>
> **Origin:** Statlocker · **Runs in:** the profile page · **Off switch:** ❌ none
> **Last verified:** 2026-08-05 against commit `ac57b17`.

---

## What it does

Injects a `.StatlockerButton` into the profile card. Activating it opens
`https://statlocker.gg/profile/<account_id>` for the profile being viewed.

---

## Files

| Path | Role |
|---|---|
| `panorama/layout/citadel_db_page_profile.xml` | Loads `qollite_profile.js` |
| `panorama/scripts/qollite_profile.js` | Button creation, account-id resolution |
| `panorama/images/statlocker/statlocker.png` / `.vtex` | Button icon |
| `panorama/styles/citadel_db_page_profile.css` | Override — imports `base/citadel_db_page_profile.vcss_c` |
| `panorama/styles/base/citadel_db_page_profile.css` | Pristine Valve baseline |
| `panorama/styles/profile_card.css` / `base/profile_card.css` | Same pattern |

---

## How it works

### Deciding when it applies

Walks up to 24 ancestors looking for `.isShowingProfilePage`, then falls back to checking whether any
of the first 10 ancestors carries both `.DashboardPage` and `.active`. Two independent checks, because
neither is guaranteed across builds.

### Resolving the account id

There is no clean API, so four strategies are tried in order, each guarded:

1. An `.AccountID`-classed label's text.
2. `accountid` / `account_id` / `accountID` as panel properties, then as attributes via
   `GetAttributeString`.
3. A breadth-first walk of the panel tree (capped at 3,000 nodes) repeating step 2 on every node.
4. `Game.GetLocalPlayerInfo()`, then `Players.GetLocalPlayer()` → `GetPlayerData` / `GetPlayerInfo`.

Each result is validated as 5–12 digits. The winning strategy is recorded as a `source` string
(`label:AccountID`, `ctx_panel`, `panel_tree`, `api_local_player`) — useful when debugging why the
button opens the wrong profile.

### Building the button

Reuses `#StatlockerBtn_<n>` or an existing `.StatlockerButton` if present, otherwise
`$.CreatePanel("Button", …)` with a `.StatlockerImage` child set to the bundled icon. Explicitly sets
`enabled`, `hittest`, and `hittestchildren` — each in its own `try`/`catch`.

### Scheduling

Two loops, at 0.35 s and 1 s. Menu-only, so no match-time cost.

---

## Settings

**None.** Not registered with UMM.

---

## Known issues

- **No off switch** — [`../TECH_DEBT.md`](../TECH_DEBT.md) §3. Low urgency: it costs nothing in a
  match and makes no request until clicked.
- **Links to a third-party service.** Unlike [rank badges](show-rank.md) this is user-initiated and
  visible, so the concern is far smaller — but it is still an undisclosed outbound link.
- The step-3 tree walk is capped at 3,000 nodes. **Unverified** whether that ceiling is ever hit.
- Source is minified; upstream unknown — [`../TECH_DEBT.md`](../TECH_DEBT.md) D5.

---

## See also

- [rank badges](show-rank.md) — the other third-party integration, and the one that needs attention
