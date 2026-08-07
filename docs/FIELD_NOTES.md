# Field notes

> Things that cost someone real time to discover, and that reading the code does not reveal.
>
> **Audience:** anyone about to edit, rebuild, or remove something in this pack.
> **Status:** living document — add to it whenever something surprises you.

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

`panorama/styles/topbar_rank_topbar.css` reads like Show Rank's stylesheet. It is not. It contains
**350 references to Top Bar Plus panels** (`Buff`, `Rejuv`, `Urn`, `Koth`) against **16** for Show
Rank. Deleting the file while removing Show Rank would have taken the top bar with it.

The same applies to the directory `panorama/styles/topbar_rank_base/`, which despite the name is a
[`base/` pattern](ARCHITECTURE.md) copy of Valve's own baseline, imported by `objectives_map.css`.

> **Verified** while removing Show Rank; the reference counts above were measured before and after,
> and Top Bar Plus's count was unchanged at 350.

**What to do:** before deleting any file during a feature removal, count whose selectors are actually
in it. Names in this pack record where a file was *introduced*, not what it now contains — a
consequence of merging several mods into shared paths.

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
- `CitadelShowRankedInfo()` in `citadel_db_page_profile.xml` and `citadel_db_page_training.xml`

A `grep ShowRank` catches all of them. Removing them breaks the post-game scoreboard and the profile
page's ranked-info button.

**What to do:** search with `ShowRank(?!ed)`, and check anything a match sits on against the vanilla
decompile before touching it.

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

**What to do:** before adding a script include, check whether the layout is a singleton or a
template. For anything per-instance, do the work once in a singleton context and have the instances
read the result. This is also why a UMM toggle could not solve the problem: hiding panels with CSS
leaves every copy loaded and running.

---

## See also

- [`ARCHITECTURE.md`](ARCHITECTURE.md) §1 — what each kind of file in this repo actually is
- [`TECH_DEBT.md`](TECH_DEBT.md) — open problems, as opposed to permanent hazards
- [`PANORAMA.md`](PANORAMA.md) — the UI engine's own quirks
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — the working rules these notes inform
