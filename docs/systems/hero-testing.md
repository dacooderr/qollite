# Hero testing tools (Advanced Testing Tools) — removed

> Replaced Valve's hideout testing panel with a tabbed, repositionable tool window.
>
> **Origin:** Advanced Testing Tools In Hideout (+ a local delta) · **Status:** ❌ **removed** on
> 2026-09-30, at the maintainer's request · **Runs in:** nowhere — the game uses Valve's own menu
> **Last verified:** 2026-09-30 against commit `78bbf2a`.

> ### This feature is no longer in the pack
> Its four files are deleted on branch `fix/remerge-6722` (staged, not yet committed on 2026-09-30).
> With no file at `panorama/layout/hud_hero_testing.xml` the game loads Valve's own layout and
> stylesheet. `<CitadelHudHeroTesting id="hud_hero_testing" />` sits in Valve's own `hud.xml` (the pack
> ships no `hud.xml` since 2026-10-14), and the `#hud_hero_testing` rules in `hud.css` /
> `base/hud.css` are Valve's. The page is kept so the reason, and the crash behind it, stay findable.

## Today: Valve's own testing menu, shown in the hideout

Since `d2d43a5` (PR #16, 2026-10-03, "enabled testing tools in hideout") the pack ships
`panorama/styles/hero_testing_menu.css` again — Valve's stylesheet (unchanged by Valve since 6726),
with QOL Lite rules, and **no** `hud_hero_testing.xml`, so the layout and its engine ids stay Valve's:

- Valve collapses `.hud_hero_testing_root` under `.connectedToHeroTesting.connectedToHideout` and
  `.connectedToNewPlayerSandbox`; the pack sets both to `visible`, so the testing menu shows in the
  hideout and the new-player sandbox.
- That `visible` rule has the same specificity as Valve's `.connectedToHeroTesting
  .gShopOpen.hud_hero_testing_root { collapse }` and comes later, so it also showed the menu over the
  shop and its build editor. Since 2026-10-14 a four-class rule hides it again while the shop is open
  (the maintainer confirmed it in a sandbox match, 2026-10-14). It relies on `gShopOpen`, which the
  menu's own `GlobalClassListener` carries. Top Bar Plus over the shop is handled in the top bar's own
  sheet ([top bar](top-bar.md) § Known issues); a first attempt, `.InHideout #TopBar.gShopOpen` in
  `hud.css`, had no effect in game and was removed.
- `#hero_testing_stub` (the menu's panel) has `margin: 120px` since 2026-10-14, at the maintainer's
  request.

---

## What it was

bonclide's Advanced Testing Tools In Hideout ([`../BUNDLE.md`](../BUNDLE.md) §4), shipped as a **full
replacement** of Valve's hero-testing layout:

| Path (deleted) | Lines | Role |
|---|---:|---|
| `panorama/layout/hud_hero_testing.xml` | 1,409 | The whole panel tree |
| `panorama/scripts/qollite_hero_testing.js` | 55 | Minified logic + a catalogue of 224 `upgrade_*` item ids |
| `panorama/styles/hero_testing_menu.css` | 1,448 | Panel styling |
| `panorama/styles/ability_hud_elements/hero_testing_menu.css` | 439 | Referenced by no layout since the `959f80e` import |

It offered bulk item granting from that catalogue, world controls on a "Basic" / "Advanced" tab pair,
and a window moved by a click-to-toggle "Click to Drag" bar. For build 6711+ its Change Team and four
checkboxes were rebound to Valve's convars (`buddha`, `sv_infinite_ammo`,
`citadel_ability_cooldown_max`, `citadel_rapid_stamina_regen`) — a five-line local delta, never
checked in game. It had no UMM switch, and because `hud.xml` instantiates the panel unconditionally it
loaded with every HUD, not only in the hideout (the former [`../TECH_DEBT.md`](../TECH_DEBT.md) D12).

## Why it was removed

It crashed the game at start-up:

```
FATAL ERROR: Unable to find child 'BotsSpawnBotCard' in layout file 'panorama\layout\hud_hero_testing.xml'
```

Build 6711 turned Valve's layout into a large native testing menu, and the C++ behind
`CitadelHudHeroTesting` looks children of it up by id. The mod's layout lacked 50 of the 53 ids in
Valve's 6722 layout; 32 of them are named in `client_strings.txt`. Details and evidence:
[`../FIELD_NOTES.md`](../FIELD_NOTES.md) §10. Keeping the mod would have meant grafting those 32 ids
into its tree and re-checking them at every patch; the maintainer chose to drop it instead, since
Valve's menu now covers most of what the mod did.

## What replaces it

Valve's native 6722 menu, loaded from the game itself (read from tracker `245f2952f9`, not seen in
game): tabs for hero tools, map, misc and bot control; Change Team, No Death, Unlimited Ammo, No
Cooldown, Fast Stamina (the same convars the delta used); gold, buffs, damage / heal / set-health
amounts; dummy stats; bot recording; Legendary Items and Infinite Money toggles; pin and free-cursor.

**Not replaced:** granting individual items from a list — Valve's layout has no `upgrade_*` entries —
and repositioning the window.

## How to bring it back

Only as an override that carries every id Valve's current layout declares and `client_strings.txt`
names — in practice a restyle or extension of Valve's layout, not a replacement of it:

1. Start from Valve's current `hud_hero_testing.xml`, not from the old mod file (`git show
   eb80c34:panorama/layout/hud_hero_testing.xml` has the mod's tree for reference).
2. Add the mod's controls without removing Valve ids; hide unwanted Valve panels in CSS.
3. Run `scripts/rebase_overrides.py` with `--old` and `--new` both at the current build: it must report
   no `engine-ids` for the file ([`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9 step 3).
4. Give it a UMM switch, default off, and make the disabled path load nothing that polls
   ([`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)); restore its `sources.json` and
   [`../BUNDLE.md`](../BUNDLE.md) entries.
5. Check in the hideout **and** in a normal match, with `-condebug`.

---

## See also

- [`../FIELD_NOTES.md`](../FIELD_NOTES.md) §10 — the crash and the id check
- [`../PANORAMA.md`](../PANORAMA.md) §9 — why the old panel used a "Click to Drag" toggle, not real dragging
- [show rank](show-rank.md) — the other removed feature
