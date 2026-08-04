# QOL Lite — documentation

Reference documentation for the QOL Lite mod: what it contains, how it is assembled, and how each
feature works today.

QOL Lite is a **collection**: several previously independent Deadlock mods merged into one VPK so
they can share Valve's HUD files instead of fighting over them. It exists as a lighter replacement
for QOL Lock, and performance is a design constraint rather than an afterthought.

Because it is a distribution rather than a single codebase, **most of what ships here was written by
other people**. [`BUNDLE.md`](BUNDLE.md) records which parts are ours to change and which are
vendored — read it before editing anything under `panorama/scripts/`.

## Where to start

| You want to… | Read |
|---|---|
| Understand how the repo maps to a shipped VPK, and what is source vs. decompiler output | [`ARCHITECTURE.md`](ARCHITECTURE.md) — **read this first** |
| Know what is in the pack, who wrote it, and what we may change | [`BUNDLE.md`](BUNDLE.md) |
| Write or debug any layout, stylesheet, or script | [`PANORAMA.md`](PANORAMA.md) — the engine reference |
| Know what a specific feature does and which files it owns | [`systems/README.md`](systems/README.md) → the feature's page |
| Add or change a setting exposed through Universal Mod Manager | [`UMM.md`](UMM.md) |
| Know what is already broken, dead, or expensive | [`TECH_DEBT.md`](TECH_DEBT.md) |

## Document map

```
docs/
├── README.md          you are here
├── ARCHITECTURE.md    repo layout, provenance, load model, override rules
├── BUNDLE.md          manifest: what is bundled, whose it is, what we may change
├── PANORAMA.md        the UI engine: what it can do, how it fails, how to debug it
├── UMM.md             the Universal Mod Manager settings protocol as this mod implements it
├── TECH_DEBT.md       known traps, dead files, the polling budget
└── systems/
    ├── README.md      catalogue of every feature, plus the Valve-path ownership map
    └── <feature>.md   one page per feature — 13 of them
```

## Design goals

QOL Lite is positioned as a lighter alternative to QOL Lock, so two properties are treated as
requirements rather than preferences:

**Small footprint.** Every file in the pack ships to every user. Added weight is a regression, not a
neutral cost — extending something that already loads is preferred over introducing a new layout,
stylesheet, or script.

**Low runtime cost.** The mod's reason to exist is that a heavier collection measurably hurt frame
pacing. A feature that costs frame time in a match has failed at the thing this project is for.

Neither goal caps what can be built, because both are satisfied by making features **opt-in**:
register the setting with [Universal Mod Manager](UMM.md) and default it to off. A feature nobody
enabled should cost nothing.

That last point is stronger than it looks. **"Off" has to mean *not running*.** A `$.Schedule` loop
that keeps ticking while its feature is disabled costs exactly as much as an enabled one, even though
nothing is on screen. Several loops in the codebase currently get this wrong — see
[`TECH_DEBT.md`](TECH_DEBT.md) §2.

## Conventions used in these documents

- **Verified** — read out of the files in this repo and stated as fact.
- **Unverified** — inferred from the code but not confirmed in-game. Marked inline; treat as a
  question, not a claim.
- Panel identifiers are written as they appear in the layout (`#minimap_persp`), CSS classes with a
  leading dot (`.BmMinimalMap`), and script globals in code font (`QolLiteMapState`).
- File paths are relative to the repository root.
