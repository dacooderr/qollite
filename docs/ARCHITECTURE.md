# Architecture

How QOL Lite is put together: what the repository actually contains, how the game loads it, and the
Panorama facts that shape every design decision here.

---

## 1. Provenance — what this repository is

**Read this before editing anything.** The repository is not a conventional source tree.

Until 2026-08-04 the repo stored release `.vpk` files. Commit `959f80e` ("reformatting for Easy
version control") replaced the packed VPK with its **extracted and decompiled contents**, so that
changes between versions become reviewable diffs instead of a binary blob.

That leaves three different kinds of file, and they are not equally editable:

| Kind | Files | What it is | Editable? |
|---|---|---|---|
| **Decompiled** | `panorama/**/*.xml`, `panorama/**/*.css`, `materials/**/*.vmat`, `models/**/*.vmdl` | Reconstructed by Source 2 Viewer from the compiled `_c` artifacts. Every one carries a `<!-- ... reconstructed by Source 2 Viewer -->` or `/* Prettified by Source 2 Viewer */` header. | Readable and diffable. Recompiling them is possible but the output is not guaranteed byte-identical to what the original author compiled — see [`FIELD_NOTES.md`](FIELD_NOTES.md) §1 for what that has already cost. |
| **Shipped verbatim** | `panorama/scripts/*.js` | Panorama stores JS uncompiled inside the VPK, so these are the exact bytes the game runs. They carry no decompiler header. | Yes — but see below. |
| **Extracted binary** | `*.png`, `*.dmx`, `*.vtex`, `*.vpcf` | Textures, meshes and particle definitions pulled out of the pack. | Only by replacing them. |

### The consequence you cannot ignore

**Every `panorama/scripts/*.js` file in this repo is minified Closure Compiler output.** Identifiers
are single letters, structure is flattened, and there are no comments:

```js
var d=function(){var b=!0;return{info:function(a){try{$.Msg("[BetterMap] "+a)}catch(c){}}, ...
```

That means the readable source for these scripts **is not in this repository**. It lives wherever
each merged mod was originally authored. Consequences:

- Editing minified JS by hand is possible but produces code nobody can review, and the next
  regeneration from real source silently discards it.
- Before changing script behaviour, **find the upstream source**. For the minimap and event-reminder
  modules, upstream is the BetterMap and Map Event Reminders projects; their unminified modules map
  one-to-one onto the `qollite_map_*` and `qollite_notifications_*` files here.
- If upstream cannot be found for a given script, say so explicitly rather than patching the
  minified output as if it were source.

A separate consequence: `[BetterMap]` still appears in log prefixes inside `qollite_map_*.js`, and
markers still use `bm_`/`Bm` prefixes. Those are upstream names that survived the rename to
`QolLite*`; they are not dead code.

---

## 2. Repository layout

```
panorama/
├── layout/        25 .xml files — Valve layouts, overridden (2 under popups/)
├── styles/        55 .css files — Valve stylesheets, overridden
│   ├── base/                 15 pristine Valve copies (see §4)
│   ├── topbar_rank_base/      2 pristine Valve copies for the rank feature
│   └── popups/ post_game/ ability_hud_elements/
├── scripts/       32 .js files — all mod-authored, all minified
└── images/        10 mod-authored textures (minimap, Statlocker icon)

materials/         material overrides + 1×1 stub textures
models/            replacement meshes (McGinnis wall) and material overrides
particles/         replacement particle systems (McGinnis wall)
```

161 files tracked in total.

Every path under `panorama/` that is not prefixed `qollite_` is a **Valve path**. Shipping a file
there replaces Valve's file of the same name. That is the entire override mechanism — there is no
patch or hook system.

---

## 3. Load model

Panorama has no module system and no bundler. A layout `.xml` declares, in order:

1. `<styles>` — stylesheets to load
2. `<scripts>` — scripts to load, executed top to bottom in that layout's context
3. the panel tree

Scripts loaded by a layout run **in that layout's JavaScript context**. Two layouts do not share a
global scope, do not see each other's variables, and cannot call each other's functions. This is the
single most important structural constraint in the mod; §6 covers how features work around it.

### Which layout loads which scripts

| Layout | Scripts | Feature |
|---|---|---|
| `hud.xml` | `qollite_map_*` ×12, `qollite_passive` | [minimap](systems/minimap.md), [passives](systems/passives.md) |
| `base_hud_and_db_overlay.xml` | `qollite_notifications_*` ×9 | [event reminders](systems/event-reminders.md) |
| `citadel_hud_top_bar.xml` | `qollite_topbar`, `qollite_showrank`, `qollite_notifications_clock_bridge`, `qollite_notifications_urn_detector` | [top bar](systems/top-bar.md), [ranks](systems/show-rank.md) |
| `citadel_hud_top_bar_player.xml` | `qollite_topbar`, `qollite_showrank` | [ranks](systems/show-rank.md) |
| `citadel_ui_context_menu_player.xml` | `qollite_showrank` | [ranks](systems/show-rank.md) |
| `hud_escape_menu.xml` | `qollite_showrank` | [ranks](systems/show-rank.md), [escape menu](systems/escape-menu.md) |
| `players_list_entry.xml` | `qollite_showrank` | [ranks](systems/show-rank.md) |
| `profile_card.xml` | `qollite_showrank` | [ranks](systems/show-rank.md) |
| `citadel_db_page_profile.xml` | `qollite_profile` | [Statlocker](systems/statlocker.md) |
| `citadel_hud_hero_shop.xml` | `qollite_recent_purchases`, `qollite_recent_purchase_icons` | [recent purchases](systems/recent-purchases.md) |
| `hud_quickbuy.xml` | `qollite_quickbuy` | [quickbuy](systems/quickbuy.md) |
| `hud_hero_testing.xml` | `qollite_hero_testing` | [hero testing](systems/hero-testing.md) |
| `popups/citadel_popup_global_leaderboard.xml` | `qollite_leaderboard` | [leaderboard search](systems/leaderboard-search.md) |

Layouts overridden for styling only, with no script: `citadel_db_page_learn`, `citadel_db_page_news`,
`citadel_db_page_news_entry`, `citadel_db_page_training`, `citadel_hero_stats_{armor,tech,weapon}_panel`,
`citadel_ui_modified_{abilities,stats}_panel`, `hud_paused`, `hud_quickbuy_entry`,
`popups/popup_settings`.

### The `.js` vs `.vjs_c` split in `<include>`

Some includes name `.js`, others `.vjs_c`:

```xml
<include src="s2r://panorama/scripts/qollite_map_log.js" />       <!-- raw -->
<include src="s2r://panorama/scripts/qollite_passive.vjs_c" />    <!-- compiled -->
```

Both resolve to the same script. The extension records how the file was referenced when the layout
was compiled. Keep whichever form a layout already uses; changing it without reason risks a
resolution failure that Panorama reports only as "the feature silently did nothing".

---

## 4. The `base/` pattern

`panorama/styles/base/` and `panorama/styles/topbar_rank_base/` hold **pristine copies of Valve
stylesheets under mod-invented paths**. Nothing in the game loads them directly; they exist so an
override can `@import` the original and then append to it:

```css
/* panorama/styles/citadel_ui_ability_order.css */
@import url("s2r://panorama/styles/base/citadel_ui_ability_order.vcss_c");
.AspectRatio4x3 .gEditingBuilds #AbilityBuildContainer { ui-scale: 88%; }
```

This is how several merged mods can extend the same Valve stylesheet without each shipping a full
divergent fork of it.

**Reading these files in the repo is confusing, and the reason is decompilation.** Panorama's
compiler flattens `@import` into the compiled `.vcss_c`, so the decompiler emits *both* the original
`@import` line *and* the inlined result. `citadel_ui_ability_order.css` therefore appears to contain
its own base twice. That is a decompiler artifact, **not** duplicated content in the shipped file.

Rules that follow:

- `base/**` is **read-only reference**. Never edit it to change behaviour — edit the override.
- Do not judge a file's real size or content from the decompiled text.
- Two of these baselines are currently loaded by nothing at all — see
  [`TECH_DEBT.md`](TECH_DEBT.md) § Dead files.

### Which stylesheets use it

`citadel_db_page_profile`, `citadel_db_page_watch`, `citadel_hud_hero_builds`,
`citadel_hud_hero_shop`, `citadel_item_draft_panel`, `citadel_ui_ability_order`, `hud`,
`hud_abilities`, `hud_ability_icon`, `hud_ability_icon_passive`, `hud_quickbuy`, `profile_card`,
`post_game/citadel_db_post_game_scoreboard_new`, and `objectives_map` (via `topbar_rank_base/`).

---

## 5. Panorama notes

The engine facts that constrain what can be built here have their own page:
**[`PANORAMA.md`](PANORAMA.md)** — read it before touching any layout, style, or script.

The five that shape the most decisions:

- **No storage, file, or convar API.** Nothing a script writes survives a restart on its own;
  persistence is delegated to Universal Mod Manager (see [`UMM.md`](UMM.md)).
- **No timers other than `$.Schedule`.** Every recurring behaviour in this mod is a self-re-arming
  schedule — and therefore a standing frame cost. See [`TECH_DEBT.md`](TECH_DEBT.md) § Polling budget.
- **Contexts are isolated** (§3). The only bridge is the event bus in §6.
- **Panel operations cannot report failure.** Judge success by reading observable state back.
- **Load order is undefined.** Poll for dependencies; never assume another script's global exists.

---

## 6. Cross-context communication

`$.DispatchEvent("ClientUI_FireOutput", <string>)` is broadcast to **every** Panorama context, and
`$.RegisterForUnhandledEvent("ClientUI_FireOutput", fn)` receives it. It is the only bridge between
layouts, and this mod uses it as a shared message bus with JSON payloads.

Three protocols currently share the bus. Receivers must tolerate messages that are not theirs — the
established idiom is a cheap substring test before parsing:

```js
if (typeof s === "string" && s.indexOf('"umm"') !== -1) { /* try JSON.parse */ }
```

| Discriminator | Protocol | Documented in |
|---|---|---|
| `{"umm":1, ...}` | Universal Mod Manager settings | [`UMM.md`](UMM.md) |
| `{"notif":1,"type":"clock","t":<seconds>}` | match clock, top bar → notification overlay | [event reminders](systems/event-reminders.md) |
| `{"notif":1,"type":"lang","lang":"<id>"}` | detected UI language, top bar → notification overlay | [event reminders](systems/event-reminders.md) |
| `{"notif":1,"type":"urn"}` | urn-spawn edge, top bar → notification overlay | [event reminders](systems/event-reminders.md) |

**Adding a protocol:** pick a new top-level discriminator key, keep the substring guard, and add a
row here.

---

## 7. Non-Panorama assets

Roughly 2.5 MB of the repo is not UI. These are performance and visual fixes that work by
**replacing** a game asset at its own path.

| Path | Purpose |
|---|---|
| `models/abilities/engineer_wall*` | Low-poly replacement mesh for the McGinnis wall (`engineer_wall_low_poly_opaque.dmx`) plus a simplified collision hull |
| `materials/abilities/mcg_wall_fill_*` | Flattened wall materials, `pbr.vfx`, textures reduced to solid tints |
| `models/heroes_staging/engineer/materials/soul_sludge_wall*` | Wall material overrides |
| `particles/abilities/engineer/*.vpcf` | Replacement particle systems for the wall |
| `models/props_gameplay/sinners_sacrifice_vault/materials/*` | Sinner's Sacrifice lighting fix |
| `materials/default/*.png` | **1×1, 86-byte stub textures.** Referenced by the overridden materials in place of real AO / normal / mask maps — the standard trick for removing a texture's cost without breaking the shader's inputs |
| `materials/minimap/`, `panorama/images/minimap/` | Minimap texture replacements (compact minimap, neutral vault, tunnels overlay) |

Documented per feature in [`systems/assets.md`](systems/assets.md).

---

## 8. Build and release

Compilation and packing are **manual and performed outside this repository**; there is no build
script here. The workflow implied by the git history is: edit the tree → compile Panorama and asset
sources → pack into `pak01_dir.vpk` → publish the VPK as the release artifact.

The repo tracks the reviewable tree; release VPKs are not committed.

**Open question for the maintainers:** where does the authored (unminified) JavaScript live, and what
regenerates `panorama/scripts/*.js`? Until that is written down, script changes cannot be made
safely. See §1.
