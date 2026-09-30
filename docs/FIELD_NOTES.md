# Field notes

> Things that cost someone real time to discover, and that reading the code does not reveal.
>
> **Audience:** anyone about to edit, rebuild, or remove something in this pack.
> **Status:** living document — add to it whenever something surprises you.
> **Last verified:** 2026-09-30 against commit `78bbf2a`.

This is deliberately not [`TECH_DEBT.md`](TECH_DEBT.md), which tracks problems that should be fixed.
Most of what follows cannot be fixed; it is how the project *is*, and the cost of not knowing it is
paid in confusing bugs. Nor is it [`PANORAMA.md`](PANORAMA.md), which documents the UI engine — some
of these are about the asset pipeline, the file layout, or other people's naming habits.

Every entry states how it was verified. Where something is inference rather than observation, it says
so.

**Contents**

1. [Rebuilding decompiled assets loses their original settings](#1-rebuilding-decompiled-assets-loses-their-original-settings)
2. [A file named after one feature can belong to another](#2-a-file-named-after-one-feature-can-belong-to-another)
3. [One mod can ship two naming generations at once](#3-one-mod-can-ship-two-naming-generations-at-once)
4. [Valve's own names collide with mod names](#4-valves-own-names-collide-with-mod-names)
5. [Per-instance layouts multiply script cost](#5-per-instance-layouts-multiply-script-cost)
6. [A game patch stales every full-copy override, silently](#6-a-game-patch-stales-every-full-copy-override-silently)
7. [A layout's panels are styled only by the sheets that layout includes](#7-a-layouts-panels-are-styled-only-by-the-sheets-that-layout-includes)
8. [Polling for a panel that no longer exists walks the whole tree](#8-polling-for-a-panel-that-no-longer-exists-walks-the-whole-tree)
9. [A minified build hides its own build flags](#9-a-minified-build-hides-its-own-build-flags)
10. [A layout the engine reads by id must keep every id it reads](#10-a-layout-the-engine-reads-by-id-must-keep-every-id-it-reads)

---

## 1. Rebuilding decompiled assets loses their original settings

**The most expensive trap in this repo.** [`ARCHITECTURE.md`](ARCHITECTURE.md) §1 warns that
recompiled output "is not guaranteed byte-identical" — this is what that actually costs in practice.

Source 2 Viewer reconstructs `.vtex` and `.vmat` files well enough to read and diff, but it does
**not** recover the settings the original author compiled with. It emits plausible defaults instead.
Rebuild from those and the asset compiles cleanly, ships, and looks wrong.

### Textures: the mip chain

The minimap tunnel overlay came out visibly blurred in every rebuild, at every `mip_bias` in
`video.txt`, while QOL Lock's equivalent stayed sharp.

Cause: `qollite_tunnels.vtex` carried `m_bNoLod 0`, so the compiler generated a full mip chain. The
overlay panel is 1024×1024 (`hud_minimap.css`) while the minimap defaults to 400 px, so the texture
is drawn at roughly a third of native size and the engine samples a lower mip level. Setting
`m_bNoLod 1` pins sampling to the top mip.

> **Verified.** The fix was applied and confirmed in game by the maintainer. It also explains the
> `mip_bias` observation: a NoLod texture ignores mip bias entirely, which is why the comparison mod
> looked identical at every setting.
>
> Since the 6722 update nothing references `qollite_tunnels.vtex` any more — Valve removed the
> `shop_tunnel` minimap class its rule targeted ([`TECH_DEBT.md`](TECH_DEBT.md) §4). The lesson
> stands for every other rebuilt texture.

The evidence that these are decompiler defaults rather than authored settings: **QOL Lock's 22
`.vtex` files are identical to ours in every field** — same `m_bNoLod 0`, same `Box` mip algorithm,
same `BGRA8888`. Two independently authored mods do not coincidentally agree on every texture
setting.

### Materials: renamed and repacked shader parameters

The same class of loss hits `.vmat`. The decompiler writes the parameter names as they exist at
runtime; the shader source expects different ones — indexed, and unpacked:

| Decompiled (does not rebuild correctly) | What the shader wants |
|---|---|
| `TextureAmbientOcclusion` | `TextureAmbientOcclusion1` |
| `TextureNormalRoughness` *(one packed texture)* | `TextureNormal1` **and** `TextureRoughness1` *(two)* |
| `TextureSelfIllumMask` | `TextureSelfIllumMask1` |
| `TextureTintMask` | `TextureTintMask1` |

A decompiler-generated texture filename also appears (`..._vmat_g_tcolor_<hash>.png`) where the
original referenced something else.

> **Verified** by commit `fb74e00`, which corrected the McGinnis wall and Sinner's Sacrifice
> materials on exactly these lines.

### What to do about it

- **Treat every rebuilt asset as unverified until someone looks at it in game.** Compiling without
  errors proves nothing here; the failure mode is silent and visual.
- **When an asset looks wrong after a rebuild, suspect the settings before suspecting the source
  art.** The png or mesh is usually fine.
- **A mod that ships its original compiled artifacts will not show these problems**, which makes
  "but the other mod works" a misleading comparison rather than a useful one.
- Fixing the reconstructed file in this repo *is* the right fix — there is no upstream to go back to
  for these.

---

## 2. A file named after one feature can belong to another

`panorama/styles/topbar_rank_topbar.css` reads like Show Rank's stylesheet. It is not. Show Rank's
rules were only a sliver of it (16 references when it was removed); deleting the file while removing
Show Rank would have taken the top bar with it.

What the file actually is was misjudged twice, so both readings are recorded:

- **At the Show Rank removal (`ecdacbb`)** it was described as Top Bar Plus's stylesheet on the
  strength of "350 references to `Buff` / `Rejuv` / `Urn` / `Koth`". That count was real but did not
  measure what it was quoted for: **220 of the 350 matches were `Koth`**, almost all of them inside
  Valve's own `#KothCashInMeter` block, which the file carried because it is a full copy of Valve's
  `citadel_hud_top_bar.css`. Build 6711 moved that block into Valve's `citadel_hud_koth.css`; after
  the 6722 rebase the file has 156 matches and 8 `Koth`. The rebase review attributed 97 of the
  matches to lines the mod itself added, before and after — that, not 350, is Top Bar Plus's share.
- **What it is:** a full fork of Valve's `citadel_hud_top_bar.css` (closest Valve revision
  `dad12d7f`, 2026-06-30) with Top Bar Plus's rules appended — and the stylesheet the per-player
  top-bar rows depend on (§7).

The same applies to the directory `panorama/styles/topbar_rank_base/`, which despite the name is a
[`base/` pattern](ARCHITECTURE.md) copy of Valve's own baseline, imported by `objectives_map.css`.

> **Verified.** The 350 and 156 totals and the 220 → 8 `Koth` share were re-measured on 2026-09-30
> with `grep -oE 'Buff|Rejuv|Urn|Koth'` against `HEAD` and the rebased file. The 97 comes from the
> line-by-line review done during the rebase and was not re-measured separately.

**What to do:** before deleting any file during a feature removal, count whose selectors are actually
in it — and check whether the matches sit on the mod's lines or on inlined Valve text. Names in this
pack record where a file was *introduced*, not what it now contains — a consequence of merging several
mods into shared paths.

---

## 3. One mod can ship two naming generations at once

Show Rank shipped the same rules twice, under `ShowRank*` (current) and `TopbarRank*` (older), with
the older set left in place. Removing only the obvious generation leaves dead CSS behind.

Worse, the older prefix is **shared with a different feature**: Top Bar Plus owns
`TopbarRankObjective*`, `TopbarRankRejuv*`, `TopbarRankTimer*` and `TopbarRankPowerupHud`. Cutting by
prefix would have broken it.

> **Verified** by checking each class for live references in layouts and scripts: eleven were dead,
> the rest resolved to Top Bar Plus. A control check on the Top Bar Plus classes returned the
> opposite result, which is what made the test trustworthy.

**What to do:** when removing a feature, grep for its *concepts* rather than its current prefix, and
decide class by class on live references. Then run the same check against a feature you are keeping —
if it reports everything dead, the check is broken, not the code.

---

## 4. Valve's own names collide with mod names

`ShowRanked*` is Valve's, not Show Rank's:

- `.ShowRankedBadges` in `post_game/citadel_db_post_game_scoreboard_new.css`
- `CitadelShowRankedInfo()` in `citadel_db_page_training.xml` (the `#RankedInfo` card)

A `grep ShowRank` catches all of them. Removing `.ShowRankedBadges` breaks the post-game scoreboard.

**Correction (2026-09-30).** This entry used to place `CitadelShowRankedInfo()` in
`citadel_db_page_profile.xml` as well and call it Valve's. Neither holds up: it is not in this repo's
profile layout, it appears in **no** Valve layout at build 6701 or 6722, and the name is absent from
`client_strings.txt` of both builds (GameTracking-Deadlock `33e0801209`, `245f2952f9`). The
`#RankedInfo` card that calls it is therefore probably dead already — **inferred**: a C++ global that
the strings dump does not list cannot be ruled out. Left in place, recorded in
[`TECH_DEBT.md`](TECH_DEBT.md) §7.

**What to do:** search with `ShowRank(?!ed)`, and check anything a match sits on against the vanilla
decompile before touching it — and check the vanilla decompile before calling a name Valve's.

---

## 5. Per-instance layouts multiply script cost

`players_list_entry.xml`, `profile_card.xml`, `citadel_hud_top_bar_player.xml` and
`citadel_ui_context_menu_player.xml` are instantiated **once per player**, not once per match. A
`<scripts><include>` in one of them therefore loads the entire script once per row, each in its own
isolated JS context.

Show Rank was included by all four. In a full lobby that is roughly a dozen copies of an 87 KB
script — 277 functions and 118 `try` blocks, only 2% of the file being string data — parsed and run
independently. Its internal caching could not help, because contexts cannot see each other.

> **Verified** by reading the four layouts against the vanilla decompile and measuring the script's
> composition. The performance complaints that prompted its removal are consistent with this, though
> no frame-time measurement was taken.

Show Rank is gone, but the pattern is not. As of 2026-09-30 (read from the layouts' `<scripts>`):
`citadel_hud_top_bar_player.xml` loads `qollite_topbar.js` into every player row, each copy running
its own 0.5 s loop; `profile_card.xml` loads `friends_rank_config.js` and `friends_rank.js` (992
lines) per instance. Neither has been measured.

**What to do:** before adding a script include, check whether the layout is a singleton or a
template. For anything per-instance, do the work once in a singleton context and have the instances
read the result. This is also why a UMM toggle could not solve the problem: hiding panels with CSS
leaves every copy loaded and running.

---

## 6. A game patch stales every full-copy override, silently

Most files under Valve paths here are **full copies** of Valve's file with the mod's edits mixed in.
A game patch changes Valve's file underneath; ours keeps shipping the old one, and nothing reports it.
The new build's panels get no rule, renamed classes stop matching, and removed rules keep applying.

What that looked like at the 6722 update (tracker revisions `33e0801209` → `245f2952f9`):

- Valve added "+0" and "Undo" panels (`#AbilityLevelContainer`, `#KeyboardHint`) to every ability
  icon and hid them in its own `hud_ability_icon.css`. Our copy predated that rule, so the panels
  would have rendered at default visibility on every icon. The copy had also missed an earlier,
  unrelated Valve change from July (`10bc3fa`).
- Valve replaced the hero-testing checkboxes' panel events and console commands with convars. The
  mod's buttons kept dispatching events that no longer exist — no error, no effect. (The mod's
  layout was rebound to the convars, then removed from the pack for a worse problem — §10.)
- `hud_damage_report.css` and `profile_card.css` carry **no mod change at all** yet still override
  Valve; before the patch `hud_damage_report.css` was already reverting a Valve change from February
  (`c878d67`).
- Mod-named forks were missed entirely by the first pass (§7).

The rebase tool reports 80 files to check and 22 that needed a human at this update. **Every merged
result is unverified until someone looks at it in game** — a clean merge proves the text combined,
not that the UI is right.

> **Verified** by reading the merged files against the 6722 Valve files (`diff` of each result
> against Valve's shows only mod lines) and against `client_strings.txt` of both builds. Nothing in
> this section was observed in game; the "+0"/"Undo" symptom was raised during the update and matches
> the stale rule set.

**What to do:** after every patch, run the procedure in
[`ARCHITECTURE.md`](ARCHITECTURE.md) §9 — do not wait for a player report. And prefer the `base/`
overlay shape for new overrides: an overlay with no inlined Valve copy picks up Valve's changes from
its refreshed baseline instead of going stale.

---

## 7. A layout's panels are styled only by the sheets that layout includes

Panorama assembles a panel's cascade from the stylesheets of the layout that owns it
([`PANORAMA.md`](PANORAMA.md) §2). A rule in a stylesheet the parent layout loads does not reach a child
layout's panels.

The case that mattered: `citadel_hud_top_bar_player.xml` — one instance per player row — includes
`citadel_base_styles`, `hud_common`, and **`topbar_rank_topbar.css`**, not Valve's
`citadel_hud_top_bar.css` (the mod swapped the include when it was first imported). So every rule the
player rows need, including Valve's own, has to exist in `topbar_rank_topbar.css`. At the 6722 update
Valve's new `.PlayerHeroReleaseVote` / `.VotedLabel` rules landed in `citadel_hud_top_bar.css` and
would not have applied to the rows — the "Voted!" label would have had no rule hiding it — until
`topbar_rank_topbar.css` was rebased too.

> **Verified** by reading the two layouts' `<styles>` blocks. The scoping itself is **inferred** from
> `PANORAMA.md` §2 and from Valve doing the same (its player and team layouts re-include
> `citadel_hud_top_bar.vcss` although their parent already loads it); it was not tested in game.

**What to do:** before assuming a rule applies, open the layout that owns the panel and read its
`<styles>`. A fork stored under a mod name is invisible to the rebase tool unless it is listed in
`ALIASES` in `scripts/rebase_overrides.py`.

---

## 8. Polling for a panel that no longer exists walks the whole tree

`FindChildTraverse(id)` searches the subtree under its start panel until it finds the id. When the id
exists, the search can stop part-way; when it does not, it has to visit **every** panel under the start
point before it can return `null`. A polling loop whose target was deleted therefore turns into a full-tree walk per
tick — and nothing logs it, because "not found" is a normal return.

6711 deleted Valve's `#map_render`. Four scripts anchored on it; two polled for it from the HUD root,
at ~17 Hz (`qollite_map_size.js`, whose feature defaults on) and 4 Hz (`qollite_map_poi.js`, running
with every POI layer off). Both broke their feature *and* became more expensive. Upstream BetterMap
re-anchored on `#MinimapBackgroundTest`, and the bundle was rebuilt from it.

> **Inferred** from the call pattern — no frame-time measurement exists. The deletion itself is
> verified: the id is gone from Valve's 6711 `hud_minimap.xml` and from `client_strings.txt`.

**What to do:** after a patch, check every id a polling loop looks up against the new layouts
([`ARCHITECTURE.md`](ARCHITECTURE.md) §9 step 7). In new code, cache a found panel (checking
`IsValid()`) and stop polling when the lookup keeps failing, instead of searching again every tick.

---

## 9. A minified build hides its own build flags

Both first-party mods shipped **with their DEBUG flag on** until 2026-09-30, and nobody could tell
from the bundle. Closure Compiler had constant-folded `DEBUG = true` into the code: in
`qollite_notifications_log.js` the logging call became unconditional, which read as "the flag is
decorative"; in `qollite_map_log.js` it survived as `var b=!0`. In BetterMap's case DEBUG also enabled
extra tree scans in the urn tracker, so every match paid for diagnostics.

> **Verified** by matching the old bundles against upstream commits (`60fa437` for BetterMap, where
> upstream had DEBUG on at the time, and `b8907bc` for Map Event Reminders) during the re-bundle. The
> current bundles ship DEBUG off and are readable, so the flag is visible
> ([`BUNDLE.md`](BUNDLE.md) §3).

**What to do:** do not infer behaviour from minified output alone — find the build it came from.
When bundling, set release flags explicitly and record the value as a delta.

---

## 10. A layout the engine reads by id must keep every id it reads

Some Valve layouts are not just markup the C++ instantiates: the C++ class behind the root panel
looks children up by id and **aborts the game** when one is missing. On 2026-09-30 the pack failed
at start-up with:

```
FATAL ERROR: Unable to find child 'BotsSpawnBotCard' in layout file 'panorama\layout\hud_hero_testing.xml'
```

**Cause.** The pack shipped Advanced Testing Tools' own `hud_hero_testing.xml`, a full replacement of
Valve's layout. Valve's 6722 layout (tracker `245f2952f9`) is its native testing menu and declares
53 ids; the mod's layout lacked 50 of them, and 32 of those 50 appear as names in
`game/citadel/bin/win64/client_strings.txt` of the same build — `BotsSpawnBotCard` among them. An
earlier reading held that the C++ tolerates missing ids, citing `hero_testing_tabs` (one of the 32)
as a precedent; the crash disproves that. A missing panel here is not a styling gap — it is a crash.

> **Verified:** the crash is observed (the maintainer's crash dialog, 2026-09-30). The id
> cross-check is measured: every id in Valve's 6722 layout, minus the ids in the pack's layout at
> `1f0fe0f` (and `eb80c34`), intersected with the whitespace-split words of `client_strings.txt` —
> 32 ids. **Inferred:** that the engine reads *these specific* ids. A name in the strings is evidence
> of a lookup, not proof; only `BotsSpawnBotCard` is proven, by the dialog. Which of the other 31
> are fatal, merely logged, or unused was not tested. The removal that followed
> ([hero testing](systems/hero-testing.md)) was not checked in game.

**What to do:**

- Prefer no override. With no file at the path the game loads Valve's own, current layout, and the
  question never arises.
- An override of a Valve layout keeps **every** Valve id that `client_strings.txt` names, even where
  the mod hides or restyles the panel. Hide it in CSS; do not delete it.
- A full replacement of a Valve layout is safe only if it carries all of those ids — re-check at
  every patch, because Valve adds ids with new features (6711 added the whole native menu).
- `scripts/rebase_overrides.py` reports them as `engine-ids` and counts them in its exit code
  ([`ARCHITECTURE.md`](ARCHITECTURE.md) §9 step 3). Treat the list as "must keep unless proven
  otherwise".

---

## See also

- [`ARCHITECTURE.md`](ARCHITECTURE.md) §1 — what each kind of file in this repo actually is
- [`TECH_DEBT.md`](TECH_DEBT.md) — open problems, as opposed to permanent hazards
- [`PANORAMA.md`](PANORAMA.md) — the UI engine's own quirks
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — the working rules these notes inform
