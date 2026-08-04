# Contributing to QOL Lite

QOL Lite is a **distribution**: a curated bundle of Deadlock mods packed into one VPK so they can
share Valve's HUD files instead of colliding over them. That makes contributing here a little
different from a normal project, and this page covers the differences.

Full reference documentation lives in [`docs/`](docs/README.md). Start with
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — it explains what the files in this repo actually
are, which is not what you would assume.

---

## Before you edit: whose file is this?

**The single most important question.** This repo holds three kinds of content and they have
different rules. [`docs/BUNDLE.md`](docs/BUNDLE.md) is the authoritative list.

| Tier | What it covers | What you may do |
|---|---|---|
| **Merge layer** | `hud.xml`, `citadel_hud_top_bar.xml`, the `base/` stylesheet pattern, 4×3 support, path arbitration | Ours, no upstream. Change it. |
| **First-party mods** | `qollite_map_*`, `qollite_notifications_*` | Change **upstream**, then rebuild into this repo. Editing the bundled copy is lost on the next build. |
| **Vendored** | Everything else under `panorama/scripts/` | Read-only. Report bugs to the original author. |

> ### ⚠️ `panorama/scripts/*.js` is minified build output
>
> Every script in this repo is minified Closure Compiler output, and for most features the readable
> source is not here at all. Hand-editing them produces changes nobody can review, which vanish the
> next time the real source is compiled.
>
> If you want to change script behaviour, find the upstream project. If you cannot find it, say so
> in your PR rather than patching the minified file.

Likewise, `panorama/**/*.xml` and `*.css` are Source 2 Viewer **decompiles**, not hand-written
source. They are readable and diffable, which is why they are committed — but treat them as a
faithful record of what ships, not as pristine authored code.

---

## What is safe to change

| Risk | Work | Notes |
|---|---|---|
| 🟢 Low | Documentation, stylesheet additions in override files, removing dead files | Additive and easy to revert |
| 🟡 Medium | Layout edits in the merge layer | `hud.xml` and `hud_escape_menu.xml` are **full overrides of Valve's layouts**. After a significant game patch they must be rebased onto the new markup, or newly added Valve HUD elements silently disappear for our users. |
| 🔴 High | Anything under `panorama/scripts/` | See above |

**Adding a file under a Valve path?** Check the ownership map in
[`docs/systems/README.md`](docs/systems/README.md) first. Two features cannot both ship the same
path — that constraint is the entire reason this project exists.

---

## Design goals

Two properties are treated as requirements, not preferences
([`docs/README.md`](docs/README.md) § Design goals):

1. **Small footprint.** Every file ships to every user. Prefer extending something that already loads
   over adding a new layout, stylesheet, or script.
2. **Low runtime cost.** This project exists because a heavier collection measurably hurt frame
   pacing.

Neither caps what you can build, because both are satisfied by making features **opt-in**: register
the setting with Universal Mod Manager and default it to off
([`docs/UMM.md`](docs/UMM.md)).

**"Off" has to mean *not running*.** A `$.Schedule` loop that keeps ticking while its feature is
disabled costs exactly as much as an enabled one. Two worked examples of doing this correctly are in
[`docs/PANORAMA.md`](docs/PANORAMA.md) §4 "Two patterns worth copying"; the loops that get it wrong
are listed in [`docs/TECH_DEBT.md`](docs/TECH_DEBT.md) §2.

---

## Making a change

```
identify the tier  →  smallest targeted edit  →  check the layers line up
                   →  build  →  verify in-game  →  update docs  →  commit
```

### Check the layers line up

After any edit, confirm that ids, classes, and script references still match across
layout ↔ style ↔ script. A renamed `id` breaks nothing loudly — it just stops being found.

```
python scripts/check_consistency.py
```

### Verify in the game

**There is no test runner, and Panorama cannot report failure.** A dispatched event, a style write, or
a panel activation returns nothing useful, and a broken layout often produces only a warning. The
running game is the only real green.

Launch with logging enabled — Steam → Deadlock → Properties → Launch Options:

```
-condebug -conclearlog -console -dev
```

Then check `…/steamapps/common/Deadlock/game/citadel/console.log` for:

- **`Parsing warning`** — a dropped CSS declaration. Non-fatal, but it means your rule did not apply.
- **`[BetterMap]` / `[NOTIF]`** — script output from the bundled features.

If you could not test in-game, **say so explicitly in the PR**. Do not claim it works.

More debugging technique in [`docs/PANORAMA.md`](docs/PANORAMA.md) §10.

### Update the docs

Documentation is part of the change, not a follow-up:

| You changed | Update |
|---|---|
| A feature's behaviour | its page under [`docs/systems/`](docs/systems/README.md) |
| Which files a feature owns | the ownership map in `docs/systems/README.md` |
| Added, updated, or removed a bundled mod | [`docs/BUNDLE.md`](docs/BUNDLE.md), in the same commit |
| Added, removed, or re-timed a `$.Schedule` loop | the polling budget in [`docs/TECH_DEBT.md`](docs/TECH_DEBT.md) §2 |
| Found an engine quirk or a working pattern | [`docs/PANORAMA.md`](docs/PANORAMA.md) |
| How the pack is assembled | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |

**All documentation is written in English**, along with code comments and commit messages.

---

## Git conventions

- **Never commit to `main`.** Branch, then open a pull request.
- Branch names: `fix/…`, `feat/…`, `perf/…`, `docs/…`, `chore/…`
- [Conventional Commits](https://www.conventionalcommits.org/), scope `qol-lite`:
  `fix(qol-lite): restore underground map state`
- **One logical change per commit.** Stage files by name — never `git add .` or `git add -A`. Review
  `git diff --cached --name-only` before committing.
- The commit body explains **why**; the subject already says what.
- Do not commit build artifacts: no `.vpk`, no packaged builds, no raw game dumps. The repo is the
  reviewable tree; the VPK is a release artifact.

### Line endings

The repo stores **LF**, but `.gitattributes` (`* text=auto`) checks files out as **CRLF** on Windows.
With `core.safecrlf` enabled, adding an LF-only file fails with:

```
fatal: LF would be replaced by CRLF in <file>
```

Write new files with CRLF in your working tree. Git normalises them to LF in the object store, which
is what the rest of the repo already has.

---

## Reporting a problem

- **A bundled mod misbehaves** → check [`docs/BUNDLE.md`](docs/BUNDLE.md). If it is vendored, the
  original author is the right person to tell. If the upstream is listed as `TBD`, open an issue here
  and say so — knowing which mods we cannot trace is itself useful.
- **A feature conflicts with another mod** → QOL Lite must be **first in load order**, and it cannot
  coexist with standalone copies of the mods it already contains. Two VPKs cannot own one file path;
  the higher-priority pack silently wins.
- **Something broke after a game patch** → likely a full-override layout that needs rebasing. See
  [`docs/PANORAMA.md`](docs/PANORAMA.md) §1.

---

## Adding a mod to the bundle

1. Check the ownership map for path collisions with what is already bundled. A collision means the
   two features have to be merged into one override, not shipped side by side.
2. Add its entry to [`docs/BUNDLE.md`](docs/BUNDLE.md) — author, upstream, version, license.
   **An entry that cannot be filled in is a reason to pause and ask, not a blank to skip.**
3. Add a page under [`docs/systems/`](docs/systems/README.md) following the template there.
4. Register its settings with UMM, defaulting to off.
5. Add it to the README's feature list.

All in the same pull request.
