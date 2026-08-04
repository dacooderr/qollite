# Panorama UI — engine reference

> How Deadlock's UI framework actually behaves, and what a mod can and cannot do with it.
>
> **Audience:** anyone editing a layout, stylesheet, or script in this repo.
> **Status:** living document — extend it whenever a new quirk is found.
> **Last verified:** 2026-08-05 against commit `ac57b17`.

Deadlock's UI is **Source 2 Panorama**: layouts in XML, styles in a CSS dialect, logic in JavaScript.
Most of the game's UI logic is compiled C++; a mod's leverage is layout, CSS, and a small JavaScript
surface. This page is the map of that surface.

Findings marked **✅ verified here** were read out of this repository. Findings marked
**⚠️ inherited** come from work on the standalone mods that were merged into QOL Lite; they are
believed correct but were not re-confirmed against this tree.

**Contents**

1. [The one thing to understand first](#1-the-one-thing-to-understand-first)
2. [File taxonomy and wiring](#2-file-taxonomy-and-wiring)
3. [Runtime facts](#3-runtime-facts)
4. [The JavaScript surface](#4-the-javascript-surface)
5. [Reacting to game state](#5-reacting-to-game-state)
6. [The CSS dialect](#6-the-css-dialect)
7. [Strict parsing — how things fail silently](#7-strict-parsing--how-things-fail-silently)
8. [UI control quirks](#8-ui-control-quirks)
9. [What is not possible](#9-what-is-not-possible)
10. [Debugging](#10-debugging)
11. [Neighbouring mods](#11-neighbouring-mods)

---

## 1. The one thing to understand first

**Deadlock's UI logic lives in C++, not in script.** The game ships roughly four JavaScript files;
every `Citadel*` and `Hud*` panel is a compiled class whose layout declares only a skeleton and
styling hooks. Data binding, snippet stamping, event handling, and state-class toggling all happen
C++-side.

So there are two kinds of panel, and the distinction governs every design decision:

| | Capitalised `Citadel*` / `Hud*` / `ActiveAbilitiesMenu` / `ParticleScenePanel` | Generic `Panel` / `Label` / `Image` / `Button` / `RadioButton` / `TextEntry` / `DropDown` |
|---|---|---|
| **What it is** | A compiled C++ element | A container the engine renders but does not own |
| **You can** | Place it, size it, style it, wrap it | Anything — create, delete, reparent, restyle, populate from JS |
| **You cannot** | Reimplement it, hook its internals, or read its private state | — |

The working pattern is therefore **wrap and overlay, never integrate**. `HudMinimap` is the canonical
case: the mod cannot touch how the map renders, so it sizes the wrapper `#minimap_container`, and
paints its own sibling panels on top inside `#minimap_overlay_root`. Every QOL Lite feature follows
this shape.

**Corollary:** a missing or renamed C++ panel type renders **nothing, silently** — there is no load
failure. Since QOL Lite overrides `hud.xml` wholesale, that override must be **rebased onto the
current game build** after significant patches, or newly added Valve HUD elements will simply vanish
for our users with no error anywhere.

---

## 2. File taxonomy and wiring

Three file kinds per UI unit. Sources are `.vxml` / `.vcss` / `.vjs`; the compiled forms shipped in a
VPK are `.vxml_c` / `.vcss_c` / `.vjs_c`. Source 2 Viewer decompiles them to `.xml` / `.css`, which
is what this repo stores — see [`ARCHITECTURE.md`](ARCHITECTURE.md) § Provenance.

One `<root>` per layout, instantiating exactly one top-level panel:

```xml
<root>
    <styles>
        <include src="s2r://panorama/styles/citadel_base_styles.vcss_c" />
        <include src="s2r://panorama/styles/hud.vcss_c" />
    </styles>
    <snippets>  <!-- optional: named subtrees, stamped by C++ at runtime --> </snippets>
    <scripts>
        <include src="s2r://panorama/scripts/qollite_map_log.js" />
    </scripts>
    <CitadelHud class="WindowRoot"> … </CitadelHud>
</root>
```

- **`s2r://`** = Source 2 resource, VPK-relative. Includes reference the **compiled `_c` path** even
  when the source is uncompiled.
- **Styles are per-layout, not global.** Nearly every layout re-includes `citadel_base_styles.vcss_c`
  (the shared design-token and control library) plus its own sheets. The cascade is assembled from
  whichever layout owns the panel; there is no single global stylesheet. **Later includes win.**
- **Scripts run in that layout's context.** Two layouts share no globals — see §3.

**HUD entry chain.** `base_hud.xml` → `<CitadelHud id="Hud">`, whose layout is `hud.xml` — the
override target for any HUD mod. Parallel roots: `base_dashboard.xml` (main menu),
`base_hud_and_db_overlay.xml` (always-on overlay: toasts, tooltips — this is where QOL Lite mounts
its [event reminders](systems/event-reminders.md)), `base_loading_screen.xml`,
`base_splash_screen.xml`.

**Popups, tooltips, and context menus are manager singletons** declared last in `hud.xml`
(`PopupManager`, `CitadelContextMenuManager`, `CitadelTooltipManager`, `ToastManager`). The
individual popups live in separate layout files that the manager instantiates on demand.

---

## 3. Runtime facts

- **No storage, file, network, or convar API.** Nothing a script writes survives a game restart. The
  only channel that outlives the process is a **server-side hero build** — both QOL Lock and
  Universal Mod Manager hide a settings token in one (QOL Lock in a build's category name, UMM in its
  description, both on unreleased "storage heroes"). ✅ QOL Lite contains **no** persistence code of
  its own and does not touch `$.persistentStorage`; where settings persist at all, UMM owns it. See
  [`UMM.md`](UMM.md).
- **Contexts are isolated.** Scripts loaded by different layouts do not share a global scope and
  cannot call each other. `GameUI.CustomUIConfig()` is **per-context** and does not bridge them.
- **`ClientUI_FireOutput` is the only cross-context broadcast channel.** `$.DispatchEvent(ch, json)`
  to send, `$.RegisterForUnhandledEvent(ch, fn)` to receive. **Custom event names are not
  dispatchable** — every mod framework in the ecosystem shares this one channel and namespaces its
  JSON payload. ✅ QOL Lite runs three protocols over it; see
  [`ARCHITECTURE.md`](ARCHITECTURE.md) § Cross-context communication.
- **⚠️ Two VPKs cannot own one file path** — the higher pak number silently wins. This is why QOL Lite
  must be first in load order, why it cannot coexist with the mods it absorbs, and why UMM sidesteps
  the problem entirely by owning only `base_hud.xml` / `base_dashboard.xml` and mounting its UI at
  runtime instead of overriding anyone's layout.
- **⚠️ The cursor is captured during gameplay.** Custom controls render but are unclickable unless a
  cursor-freeing state is active (escape menu, TAB detail view). ✅ This is why the minimap settings
  button only appears under `gDetailView` / `gScoreboardOpen`.
- **Load order is undefined** — between scripts, between panels, between mod contexts. ✅ Both of QOL
  Lite's multi-module features poll for their dependencies before initialising; see
  `qollite_map_bootstrap.js` and `qollite_notifications_bootstrap.js`.
- **Panel operations cannot report failure.** Dispatching an event, setting a style, or activating a
  panel returns nothing meaningful, and a dead panel absorbs it silently. Judge every step by the
  game's observable state and read the result back.
- **⚠️ Duplicate panels exist.** Once the escape menu has been opened, several Valve panels have empty
  duplicates in the tree. `FindChildTraverse` returns the first hit, which may be the wrong one. When
  it matters, collect all matches and pick by content.
- **`Image` can load remote `https://` URLs.** ✅ [show-rank](systems/show-rank.md) depends on this to
  fetch rank badges. It is a real network request per image, to a third-party host.
- **⚠️ No live world-entity state is available.** Breakable break and respawn is not observable: the
  minimap does not render them, no UI event or global class fires, sounds are not exposed to JS, and
  Deadlock has no Dota-style `GameEvents` or entity API. The only readable world state is what the
  engine itself paints into the UI tree — for instance the `.active` class the engine puts on a
  neutral camp's own `.map_button.neutral_*` marker, which is exactly what QOL Lite's
  [urn detection](systems/event-reminders.md) reads. **Consequence:** overlay data is static spawn
  knowledge only. A genuine live tracker is unimplementable, and would be an information-advantage
  cheat if it were not. Settled — do not revisit without new engine evidence.

### The JS runtime is ES2017+, not ES5

Valve's shipped `scripts/async.js` uses `async`/`await`, `class`, arrow functions, `let`/`const`, and
Promises, so the runtime is modern. ✅ QOL Lite's own scripts are a mix — `qollite_topbar.js` and
`qollite_quickbuy.js` use arrow-function IIFEs and `||=`, while the `qollite_map_*` modules are ES5
`var`/IIFE. That is a stylistic inheritance from the merged upstream mods, **not** an engine ceiling.

---

## 4. The JavaScript surface

### Verified in use by QOL Lite

Counted across `panorama/scripts/*.js` at commit `ac57b17`. This is the empirically safe API — every
one of these demonstrably works in Deadlock.

| API | Uses | Notes |
|---|---:|---|
| `$.Schedule(sec, fn)` | 53 | **The only timer.** No `setTimeout`, no per-frame hook. A self-re-arming `$.Schedule` is how every recurring behaviour here works — and the mod's main standing cost. See [`TECH_DEBT.md`](TECH_DEBT.md) § Polling budget. `0` means next frame. |
| `$.GetContextPanel()` | 42 | Root panel of the layout backing this script. The anchor for almost every module. |
| `$.FindChildInContext(sel)` | 38 | Lookup by `#id` within the context. |
| `$.CreatePanel(type, parent, id)` | 31 | ✅ **Confirmed available in Deadlock** — every runtime-built marker, notification, and filter button in this mod uses it. |
| `$.DispatchEvent(name, …)` | 25 | JS → engine bus. Used here for `ClientUI_FireOutput` (cross-context) and `PlaySoundEffect`. |
| `$.Msg(str)` | 13 | The only logging facility. |
| `$.RegisterForUnhandledEvent(name, fn)` | 8 | Global broadcast subscription — the receiving half of the bus. |
| `$.RegisterEventHandler(name, panel, fn)` | 4 | Panel-targeted subscription (used for `Activated` on runtime-created toggles). |
| `$.Language()` | 4 | Returns the client UI language id. Wrapped in `try`/`catch` at every call site, with a `Language_<id>` ancestor-class fallback — treat as **possibly absent**. |
| `$.FrameTime()` | 1 | |

**Mod-defined globals on `$`.** `qollite_showrank.js` attaches
`$.__QolLiteShowRankWebMediaBridge` (a versioned shared-state object, `version: 236`) and
`$.QolLiteShowRankOpenDeadlock`. Because the script is loaded into six different layouts, this is how
its instances find each other **within** a context; it is *not* a cross-context channel — see §3.

**Panel methods in use:** `FindChildTraverse`, `FindChildrenWithClassTraverse`, `FindChild`,
`GetParent`, `GetChild(i)`, `GetChildCount()`, `Children()`, `SetParent`, `AddClass`, `RemoveClass`,
`SetHasClass`, `BHasClass`, `BAscendantHasClass`, `ToggleClass`, `SetPanelEvent(name, fn)`,
`SetSelected`, `SetImage`, `SetDialogVariableInt`, `GetAttributeString`, `DeleteAsync(sec)`,
`RemoveAndDeleteChildren()`, `IsValid()`, and the direct properties `.text`, `.visible`, `.enabled`,
`.checked`, `.hittest`, `.hittestchildren`, `.style.*`.

**Geometry read-back:** `actuallayoutwidth`, `actuallayoutheight`, `actualxoffset`, `actualyoffset`.
An unlaid-out panel reads `0×0` at offset `3.4e38` (FLT_MAX) — the reliable way to tell a *collapsed*
panel from a merely *hidden* one.

### Two patterns worth copying

Both come from the event-reminder modules, and they share a theme: **design the failure, not just
the happy path.** Panorama cannot report failure (§3), so the only thing that saves you is deciding in
advance what breakage looks like.

Source shown is the readable upstream, not the minified form that ships here.

#### Stop the loop, don't skip the body

A tick that re-arms unconditionally costs the same whether its feature is on or off. Re-arm only
while there is something to do, and let the feature's own entry point restart it:

```js
function sweep() {
    _sweeping = false;
    var n = now(), changed = false, has = false, k;
    for (k in items) {
        var it = items[k];
        if (it.expireAt && n >= it.expireAt) { delete items[k]; changed = true; continue; }
        has = true;                    // something is still live
    }
    if (changed) { render(); }
    if (has) { schedule(); }           // re-arm ONLY while work remains
}
function schedule() { if (!_sweeping) { _sweeping = true; $.Schedule(0.25, sweep); } }
```

Two details carry the weight:

- **`if (has) schedule()`** — with nothing on screen the loop stops existing, rather than waking up
  and returning early. Whatever creates an item calls `schedule()` to start it again.
- **The `_sweeping` latch** — five items arriving in one frame schedule one sweep, not five.

Contrast `qollite_map_settings.js`, which re-arms every 0.03 s regardless of state. That difference
is [`TECH_DEBT.md`](TECH_DEBT.md) D1 and D2 in one line.

#### Give bridged state a TTL

State that arrives over the bus can stop arriving — a context rebuilds, a panel gets renamed, a
subscription is lost. A naive receiver keeps serving its last value forever, so the consumer silently
runs on a frozen clock. Expire it instead:

```js
var STALE_MS = 3000;  // no clock for 3s -> inactive

getMatchTime: function () {
    if (last === null) { return null; }
    if (Date.now() - lastAtMs > STALE_MS) { return null; }   // stale
    return last;
}
```

The value of this is entirely in **what the breakage becomes**. Without the TTL a dead bridge means
"the match clock is permanently 7:12" and every downstream decision is quietly wrong. With it, a dead
bridge means "there is no clock", the scheduler simply does not run, and the failure is honest and
greppable.

It also adds no new failure path: `null` is a case the consumer already has to handle.

### Game data APIs — probe, never assume

Deadlock does **not** expose Dota's `Game.*` / `Players.*` surface reliably. ✅ QOL Lite's own code
treats every one of them as possibly-absent, and so should yours:

| Called | Where | How it is guarded |
|---|---|---|
| `Game.GetMapInfo()` | `qollite_topbar.js`, `qollite_recent_purchases.js` | `try`/`catch`, falls back to reading the `connectedToHideout` / `InHideout` class |
| `Game.GetLocalPlayerInfo()`, `Players.GetLocalPlayer/GetPlayerData/GetPlayerInfo` | `qollite_profile.js` | `try`/`catch` per call, last of four fallbacks after scraping the panel tree |
| `Game["GetDOTATime"]`, `Game["GetGameTime"]`, `Game.Time`, `Game.GameTime`, `GameUI["GetGameTime"]` | `qollite_topbar.js` | **String-indexed** and type-checked before calling, precisely because they may not exist; falls back to parsing the `#GameTime` label |

**The pattern to copy:** read the clock from the HUD's own `#GameTime` label and parse `mm:ss`.
That is what every feature in this mod ultimately relies on, because it is the only source that is
always there.

```js
var t = panel.text.replace(/<[^>]+>/g, "").match(/(\d+):(\d{2})/);
var seconds = t ? parseInt(t[1], 10) * 60 + parseInt(t[2], 10) : null;
```

### Not available

`GameEvents.Subscribe` (Dota's gameplay bus), `CustomNetTables`, `AsyncWebRequest`, `$.DefineEvent`,
custom-game APIs. Do not write code against these.

---

## 5. Reacting to game state

**Prefer CSS over polling.** The engine sets state classes on the HUD root and mirrors named global
classes onto `<GlobalClassListener>` panels. Reacting in CSS costs nothing; polling costs frames
forever. This is the single highest-leverage performance rule in the mod.

```xml
<GlobalClassListener id="minimap_persp" classes="gDetailView gScoreboardOpen gAbilityUpgradeMenu">
    <Panel id="minimap_container"> … </Panel>
</GlobalClassListener>
```

```css
.gDetailView #minimap_persp { opacity: 0.5; }
```

### Global classes

These are the **only** cross-panel broadcast state classes. Read them off a `GlobalClassListener` you
own — asking an arbitrary panel returns false.

| Class | Meaning | Used by QOL Lite |
|---|---|---|
| `gDetailView` | Detail/inspection view (hold ALT) | ✅ minimap settings visibility, HUD dimming |
| `gScoreboardOpen` | Scoreboard (TAB) shown | ✅ minimap enlarge, settings visibility |
| `gShopOpen` | Hero shop open | ✅ quickbuy, recent purchases, stats containers |
| `gAbilityUpgradeMenu` | Ability upgrade radial active | ✅ minimap, abilities container |
| `gEditingBuilds` | Editing a shop build | ✅ 4×3 build-editor scaling |
| `gItemDraftOpen` | Item draft panel open | ✅ abilities container |
| `gBrowsingBuilds` | Browsing builds | — |

### Root state classes

Set by C++ on `CitadelHud` and high ancestors; they drive most visibility. Relevant here:
`.alive` / `.dead`, `.joined_team`, `.spec_mode` / `.viewing_as_player`, `.replay_playback`,
`.wants_scoreboard`, `.deathReplayActive`, `.InHideout`, `.connectedToHideout`,
`.connectedToHeroTesting`, `.GameStatePreGame` / `.GameStatePostGame`, `.HudTakeoverEnabled`,
`.ShowEscapeMenu`, `.gamemode_streetbrawl`, and the aspect-ratio classes
`.AspectRatio16x10` / `.AspectRatio21x9` / **`.AspectRatio4x3`** (the last one is added by
[this mod](systems/aspect-ratio-4x3.md)).

### Text binding

`{prefix:name}` inside `text="…"` binds a dialog variable the owning C++ panel populates.
**A plain `<Panel>` a mod injects will not resolve `{s:…}`** unless a C++ parent feeds it.

| Prefix | Type | Example |
|---|---|---|
| `{s:…}` | string | `{s:game_clock}`, `{s:respawn_timer}` |
| `{i:…}` | integer | `{i:friendly_kills}` |
| `{d:…}` | number | `{d:current_ap}` |
| `{g:…}` | glyph / key binding | `{g:citadel_binding:'Mantle'}` — **requires `html="true"`** |
| `{t:…}` | time | `{t:entry_timestamp}` |
| `{f:…}` | float | `{f:health_regen}` |

`#Token` in `text=` or `placeholder=` resolves from `resource/localization/`; literal text without
`#` renders verbatim. ✅ QOL Lite ships **no localization files** — its own strings are hard-coded
English in the layouts, except the event reminders, which carry an in-script EN/RU table.

---

## 6. The CSS dialect

Panorama's stylesheet language looks like CSS and is not. The differences that matter:

**Variables** are `@define name: value;` at file top, referenced by bare name — there is no `--var`
or `var()`. `citadel_base_styles.vcss` is the design-token file (~200 defines: team colours,
`soulColor`, fonts, blur presets). Alpha shorthand is `colorName&HH`, e.g. `offBlack&cc`.

**Selectors:** `#id`, `.class`, type, descendant (space), compound, and grouping (comma).
Pseudo-classes `:hover`, `:active`, `:selected`, `:disabled`, `:enabled`, `:focus`,
`:descendantfocus`, `:not()`, `:nth-child()`, `:first-child`, `:last-child`.
**There is no `::before` / `::after`, no attribute selectors, and no `>` / `~` / `+` combinators.**

**Layout is flexbox-like but bespoke:**

| Concept | Panorama |
|---|---|
| flex-direction | `flow-children: down \| right \| up \| left \| right-wrap \| down-wrap \| none` |
| flex-grow | `width: fill-parent-flow(1.0)` — **the weight argument is mandatory** |
| child-driven size | `fit-children` |
| justify / align | `horizontal-align` / `vertical-align: left\|center\|right\|top\|middle\|bottom` |
| absolute positioning | `ignore-parent-flow: true` then `position: x y z;` (three components) or `x:` / `y:` / `z:` |
| hide | `visibility: collapse` — **removes from layout**; this is the show/hide mechanism, not `display` |

**Non-web properties worth knowing:** `overflow: shrink | noclip | squish scroll | clip | scroll |
ellipsis` (two-axis), `wash-color` (tints a panel or image), `img-shadow`, `box-shadow: fill …`,
`opacity-mask: url(…) 0.7` with `opacity-mask-scale` / `-threshold`, `ui-scale: 88%` (scales a
subtree — ✅ how the 4×3 support rescales panels), `pre-transform-scale2d` / `pre-transform-rotate2d`,
GPU filters `brightness` / `saturation` / `contrast` / `hue-rotation` / `blur` / `world-blur`,
`perspective` on a parent plus child `transform: rotateX(…)`, and **`sound:` / `sound-out:`** which
attach hover and activate sounds with no JS at all.

**Transitions and keyframes** work and are mod-safe. Keyframe names are **quoted**:

```css
@keyframes 'urnPulse' { 0% { opacity: 0; pre-transform-scale2d: 2.35; } 100% { … } }
.bm_urn_ring { animation-name: 'urnPulse'; animation-duration: 1.2s; animation-iteration-count: infinite; }
```

**Inline `panel.style.*` beats stylesheet rules.** Several features rely on this for JS-driven
sizing. Keep the stylesheet values sane anyway — they are what renders before JS init lands.

**One panel, one owner.** Do not leave two style generations targeting the same id across files. A
stale rule combining `min`/`max` sizing with `visibility: collapse` can silently win the cascade over
the live design and collapse the whole panel. When a design is replaced, **delete** its old rules
rather than adding new ones beside them.

---

## 7. Strict parsing — how things fail silently

Recent Deadlock builds tightened Panorama parsing. What older builds tolerated now either throws (JS)
or is silently dropped (CSS). Several "the mod just doesn't appear" bugs trace to this one theme.

### The JS style setter throws on unknown property names

`panel.style.<unknownName> = …` raises
`Property setter for CPanelStyle called with invalid css property name (<name>)` and **aborts the
enclosing function**.

| Trap | Correct form |
|---|---|
| `panel.style.hittest = false` — **throws** | `panel.hittest = false` (it is a panel property, not a style) |
| `panel.style.percentX = 42` — **throws** | `panel.style.x = "42%"` |
| `panel.style.position = "absolute"` | Panorama's `position` is a three-component `x y z`, not a web keyword. ✅ QOL Lite only *reads* `style.position` (to parse a `%` out of Valve's urn markers), never writes a web value. |

✅ Style properties QOL Lite writes inline today, all confirmed working: `width`, `height`,
`transform`, `backgroundColor`, `backgroundImage`, `backgroundSize`, `opacity`, `visibility`,
`zIndex`, `x`, `y`, `horizontalAlign`, `verticalAlign`, `marginLeft`, `marginRight`, `marginTop`,
`marginBottom`, `maxWidth`, `clip`, `align`, `saturation`, `washColor`.
**`borderRadius` has no precedent** — do rounded shapes via a stylesheet class.

### CSS drops declarations without erroring

- **Bare `fill-parent-flow` is rejected.** The weight argument is mandatory. The bare form emits
  `Parsing warning … Invalid value for property 'width'`, the whole declaration is dropped, and the
  panel silently collapses to 0×0. ✅ All 28 uses in this repo are correctly parameterised.
- **Parse warnings are non-fatal but load-bearing.** A dropped declaration does not fail the file, it
  just does not apply. **After any layout or style change, grep the console log for
  `Parsing warning`** — a genuinely broken layout often shows up only there.
- Known no-op declarations Panorama accepts and ignores: `hittest:` in CSS (use the XML attribute —
  ✅ this repo is clean of it), `row-gap`, `: inherit`, `max-width: none`, `!important`.

### Isolate every `init()`

One module's throw must not take the rest down. ✅ Both bootstraps in this mod run each module's
`init()` in its own `try`/`catch` for exactly this reason. Keep that — a silently failing chain is
how these bugs stay invisible for days.

```js
function safeInit(name, fn) {
    try { fn(); Log.log("init ok: " + name); }
    catch (e) { Log.error("init threw in " + name + ": " + (e && e.message ? e.message : e)); }
}
```

---

## 8. UI control quirks

- **⚠️ Raw `<Slider>` is unreliable** — it renders vertical with odd stepping. Use Valve's composite
  controls, **`CitadelSettingsSlider`** and **`CitadelSettingsToggle`**, and bind to their inner
  `Slider` via `FindChildTraverse("Slider")` + `SetPanelEvent("onvaluechanged", …)`. ✅ That is what
  the minimap settings panel does throughout.
- **`Button` is composed, not atomic.** The correct markup is
  `<Button class="InputButton Fill Small"><Panel class="Bottom"/><Panel class="Top"/><Panel class="Content">…</Panel></Button>`.
  Size variants `Large | Small | XSmall`; style variants `Fill | Dark | CTA | Caution | Warning |
  Disabled | IconOnly`.
- **Composite settings controls normally bind to a convar**, which is how the game's own settings
  persist. **A mod cannot register into that C++ settings tree from layout alone** — which is exactly
  why settings here are wired to JS and persisted through UMM. ✅ QOL Lite's minimap panel *imitates*
  Valve's settings markup (`SettingsRow`, `SettingsSectionContainer`) while wiring the controls to
  JavaScript.
- **`RadioButton group="…"`** gives mutual exclusion; `selected="true"` sets the default.
  **`TabButton` / `TabContents`** pair via `group=` and `tabid=` and the engine wires visibility.
- **`hittest="false"`** is the reliable input blocker. Pair it with `visibility: collapse` when
  hiding.
- **⚠️ The circular minimap mask clips corner markers** — valid `u`/`v` near the corners can be
  invisible. Cosmetic, inherent to the round frame.

---

## 9. What is not possible

Settled by in-game testing. Do not spend time re-deriving these.

**Dragging a panel with the cursor.**

- `GameUI.GetCursorPosition()` is **absent** in Deadlock's HUD context (it exists in Dota).
- `SetPanelEvent("onmousedown")` and a continuous `DragMove` event **never fire** on this build.
- The `draggable` + proxy scheme reads an unlaid-out proxy (`actualxoffset` = FLT_MAX).
- The only reliable pointer event is **`onactivate`** — a full click.

Reposition via discrete controls instead. ✅ The minimap uses corner presets plus offset sliders; the
hero-testing panel uses a click-to-toggle "Click to Drag" bar rather than cursor following.

**Live world state.** See §3 — not observable, and would be a cheat.

**Persisting a setting without a mod manager.** See §3 and [`UMM.md`](UMM.md).

---

## 10. Debugging

### Get the console onto disk

Steam → Deadlock → Properties → Launch Options:

```
-condebug -conclearlog -console -dev
```

Without `-condebug`, Source 2 writes **no** log file (Deadlock ships with empty launch options) and
on-screen `$.Msg` output vanishes on exit. With it, everything lands in:

```
…/steamapps/common/Deadlock/game/citadel/console.log
```

`-conclearlog` truncates it on each start. Lines tagged `[PanoramaScript]` are script output.

### Log prefixes in this mod

| Prefix | Source |
|---|---|
| `[BetterMap]`, `[BetterMap] [ERROR]` | `qollite_map_*.js` — upstream name, retained |
| `[NOTIF]`, `[NOTIF] ERROR:` | `qollite_notifications_*.js` |
| `[NOTIF][bridge]` | `qollite_notifications_clock_bridge.js` |
| `[NOTIF][urn]` | `qollite_notifications_urn_detector.js` |

Note that `qollite_notifications_log.js` ships with `DEBUG: true` and its `log()` is unconditional —
see [`TECH_DEBT.md`](TECH_DEBT.md).

### Techniques

- **Probe live geometry** with `actuallayoutwidth` / `actuallayoutheight` / `actualxoffset` /
  `actualyoffset`, plus `visible` and `BHasClass`. Measure again after `$.Schedule(0.35, …)` — layout
  lands a frame or two late.
- **Text-dump a subtree** with a recursive `Children()` walk logging `id`, `paneltype`, and classes.
  There is no inspector in the shipped game; this is the only way to see the live tree.
- **Compare structure before values.** When behaviour differs from expectation, check panel
  hierarchy, `hittest`, clipping, and masks *first*, then tune visual values.

---

## 11. Neighbouring mods

Context that explains several decisions in this repo.

### QOL Lock — the mod QOL Lite replaces

- **No external mod API.** Zero uses of `ClientUI_FireOutput`; no register or handshake protocol. Its
  internal `ql_bridge.js` passes typed channels between its own HUD and settings contexts via **panel
  attributes**, which third parties cannot join at runtime.
- **Its integration model is vendoring** — a feature is compiled *into* their pack as a
  `ql_feat_*.js` module using their `QOL.import()` namespace. There is nothing to write an adapter
  against.
- **It owns `hud.xml`** plus `hud_escape_menu.xml`, the top bar, health, and quickbuy — so it
  collides with any mod that also overrides the HUD. That collision is why several standalone mods
  cannot run alongside it, and part of why merging them into one pack, as QOL Lite does, is the
  workable approach.
- Architecturally a monolith: `ql_core.js` at roughly 16k lines, a ~256-key config, a semver-gated
  migration chain, and per-file self-tests. **The schema-versioned settings migration pattern is
  worth borrowing** if QOL Lite's settings ever multiply.

### Universal Mod Manager

Avoids the path-collision problem by owning only `base_hud.xml` / `base_dashboard.xml` and mounting
its UI at runtime. It supplies the settings UI and persistence layer QOL Lite integrates with — full
protocol in [`UMM.md`](UMM.md).

---

## See also

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how this repository maps onto a shipped VPK
- [`UMM.md`](UMM.md) — the settings and persistence protocol
- [`TECH_DEBT.md`](TECH_DEBT.md) — known traps, dead files, polling budget
- [`systems/README.md`](systems/README.md) — what each feature does
