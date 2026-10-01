# Universal Mod Manager integration

> The settings and persistence protocol QOL Lite speaks, and how to add a feature to it.
>
> **Audience:** anyone adding or changing a user-facing setting.
> **Status:** protocol v1, five features integrated, the rest not (§4).
> **Last verified:** 2026-09-30 against commit `78bbf2a`.

**Contents**

1. [Why UMM exists for us](#1-why-umm-exists-for-us)
2. [The protocol](#2-the-protocol)
3. [Widget vocabulary](#3-widget-vocabulary)
4. [What QOL Lite registers today](#4-what-qol-lite-registers-today)
5. [Adding a setting](#5-adding-a-setting)
6. [Rules and gotchas](#6-rules-and-gotchas)

---

## 1. Why UMM exists for us

Panorama gives a mod **no storage API** — see [`PANORAMA.md`](PANORAMA.md) §3. Nothing a script writes
survives a game restart. Universal Mod Manager solves this for the whole ecosystem: it renders a
shared settings window and persists values by hiding them in a server-side hero build, which is the
one channel that outlives the process.

That makes UMM load-bearing for QOL Lite specifically. The way an ambitious feature stays cheap here
is: **ship it default-off, and let the user turn it on in UMM.**
Without UMM there is nowhere to put that switch, and every feature would have to be either always-on
(a performance cost for everyone) or unreachable.

UMM is an optional dependency, not a hard one. A feature must still behave sensibly when no manager
answers — it simply runs on its declared defaults for that session.

---

## 2. The protocol

One channel, `ClientUI_FireOutput` (see [`PANORAMA.md`](PANORAMA.md) §3). Payloads are JSON strings
namespaced by an `umm` field. Everything else on the channel is ignored.

```
     mod                                          UMM core
      │                                               │
      ├──  {umm:1, t:"register", id, name,            │   mod boots first:
      │      settings:[…], values:{…}}  ────────────▶ │   announce manifest
      │                                               │
      │ ◀────────────  {umm:1, t:"hello"}  ───────────┤   core boots later:
      ├──  {umm:1, t:"register", …}  ────────────────▶│   "re-announce"
      │                                               │
      │ ◀───  {umm:1, t:"set", id, key, value}  ──────┤   user changed a value,
      │       (patch state, apply live, do NOT echo)  │   or saved values arrived
```

| Direction | Message | Meaning |
|---|---|---|
| mod → core | `{umm:1, t:"register", id, name, settings, values}` | Full manifest: mod id, tab name, widget list, current values |
| core → mod | `{umm:1, t:"hello"}` | "Re-announce" — the core booted after the mod; send `register` again |
| core → mod | `{umm:1, t:"set", id, key, value}` | A value changed, from user input or from persisted values arriving after load |
| internal | `t:"persist"` / `"repair"` / `"closemenus"` | Core↔core storage routing. **Mods never send these.** |

**Two cores run at once** — one per host layout (`base_hud.xml` in match, `base_dashboard.xml` in the
menu); only the mount-race winner renders. Both absorb every `set`, so a mod that re-registers when
contexts rebuild (dashboard ↔ match) gets its values pushed back.

**Value precedence on (re)register**, resolved core-side: session registry **>** values sent with the
manifest **>** declared defaults.

### The receive idiom

Every message on the channel reaches every listener, including messages belonging to other protocols.
Guard cheaply before parsing — a `JSON.parse` on every bus message is wasted work:

```js
function onBus(s) {
    if (typeof s !== "string" || s.indexOf('"umm"') === -1) return;
    var m; try { m = JSON.parse(s); } catch (e) { return; }
    if (!m || m.umm !== 1) return;
    if (m.t === "hello") { sendRegister(); return; }
    if (m.t === "set" && m.id === MOD_ID) { applySetting(m.key, m.value); }
}
$.RegisterForUnhandledEvent("ClientUI_FireOutput", onBus);
```

---

## 3. Widget vocabulary

Fixed set. **Unknown types are logged and skipped by the core** — a typo means your setting silently
never appears.

| `type` | Fields | Notes |
|---|---|---|
| `group` | `label` | Section header / divider. Carries no value. |
| `toggle` | `id`, `label`, `default` (bool), `description` | |
| `slider` | `id`, `label`, `min`, `max`, `step`, `default`, `unit`, `description` | Integer-friendly — see §6 on fractions |
| `select` | `id`, `label`, `default`, `options: [{value, label, img?}]`, `icons?`, `sort?`, `description` | |
| `checks` | `label`, `options: [{id, label, default}]` | Grouped booleans, each keyed by its own id |
| `export` / `import` | — | **UMM-internal** (settings backup). Do not use. |

There is no custom-panel or HTML widget. A bespoke visual UI inside the UMM window would require a
new widget type co-designed with the UMM author.

---

## 4. What QOL Lite registers today

✅ Verified by reading the manifests in the repo.

| Mod `id` | Display `name` | Adapter | Settings |
|---|---|---|---|
| `bettermap` | BetterMap | `qollite_map_umm_adapter.js` | 3 groups ("Minimap", "Minimap Icons", "Crates & Statues"), 8 toggles, 13 sliders — 21 widgets, built from `qollite_map_schema.js` |
| `eventnotifier` | Map Event Reminders | `qollite_notifications_umm_adapter.js` | 4 toggles, 1 select (`warnSecs`: 5/10/15/30 s), plus an `Events` group (`ev_group`) of 7 per-event toggles `ev_<event>` |
| `enhanced_quickbuy` | Enhanced Quickbuy | `qollite_quickbuy.js` | 3 toggles, 1 slider, 2 groups |
| `always_show_passives` | Always Show Passives & Actives | `qollite_passive.js` | 2 toggles (`enabled`, `compact`) |
| `recent_purchases` | Recent Purchases | `qollite_recent_purchases.js` | 1 toggle (`enabled`) |

### `bettermap` in detail

Since BetterMap 3.0 (`0237ebe`) the manifest is built from `qollite_map_schema.js` by `_register()`
in `qollite_map_umm_adapter.js`. Groups come from each setting's `group`; widget ids are the schema's
two-character `umm` ids. Full list with ranges: [minimap § Settings](systems/minimap.md#settings).

| Group | Widget ids |
|---|---|
| Minimap | sliders `ms` (size, 200–800 px), `ox` / `oy` (offsets, −100..100 %), `mo` (map opacity, 10–100 %); toggles `mm` (Minimalist), `ul` (Traveler enlarge), `fw` (Full-Width HUD) |
| Minimap Icons | sliders `is`, `ia`, `ie`, `it`, `ih`, `ir`, `iu` (you / ally / enemy / tower / shop / rune / urn, 50–200 %) |
| Crates & Statues | toggles `pc`, `ps`, `pt`, `p3`, `ut`; sliders `pz` (marker size, 1–8 px), `po` (marker opacity, 10–100 %) |

**Changed at the 3.0 re-bundle (2026-10-01).** The mod id is still `bettermap`, but **every widget
id changed**, so UMM-saved BetterMap values reset once. Upstream did this on purpose: two-character
ids keep BetterMap's share of UMM's shared 500-character token small. It is recorded in its
CHANGELOG.

- Removed: `minimapCorner`, `poiLevelAuto`, `playerIconScalePct` (split into `is` / `ia` / `ie`).
- Removed: the QOL Lite delta `minimalMapOpacityPct` ([`BUNDLE.md`](BUNDLE.md) §3).
- One-time seed: with UMM installed, the adapter's first register waits up to 2 s for values
  BetterMap's own store had saved without UMM, so a player who adds UMM keeps them. Nothing is
  written to the store while UMM is present.
- With UMM present, BetterMap's subsections in the game's settings window are hidden, so there is
  only one UI.

### Not integrated

These features have **no UMM presence and no user-facing switch at all** — they are always on:

| Feature | Consequence |
|---|---|
| [top bar](systems/top-bar.md) | Cannot be turned off. |
| Friends Rank (no page yet) | Cannot be turned off. Makes third-party image requests to `api.deadlock-api.com`. |
| Ammo-buff notifier (no page yet) | Not shipped since 2026-09-30 **because** it could not be turned off; a UMM toggle is the condition for bringing it back. |
| [Statlocker button](systems/statlocker.md) | Its script is not loaded at all. |
| [leaderboard search](systems/leaderboard-search.md) | Only runs on the leaderboard popup. |
| [4×3 support](systems/aspect-ratio-4x3.md) | Pure CSS; effectively free. |
| [asset optimizations](systems/assets.md) | Not settings — they are replacements. |

The first three are the ones that matter: they run in every match or menu, cost frame time, and the
user has no way to decline. Tracked in [`TECH_DEBT.md`](TECH_DEBT.md) §3.

[Show Rank](systems/show-rank.md), which used to head this table, was removed in `ecdacbb`.

Two integrated features have a switch that does not fully work: `always_show_passives` → `enabled`
is defeated by unconditional CSS ([`TECH_DEBT.md`](TECH_DEBT.md) D10), and `enhanced_quickbuy` →
`enabled` hides the feature while its 10 Hz loop keeps running.

---

## 5. Adding a setting

The established shape is a **declarative schema plus a generic register/apply pair**. Both existing
adapters use it; copy that rather than hand-rolling.

```js
var SCHEMA = [
    { id: "enabled",     type: "toggle", label: "Enabled", key: "enabled",
      description: "Turn the feature off without uninstalling it." },
    { id: "markerSize",  type: "slider", label: "Marker Size",
      min: 1, max: 8, step: 1, unit: "px", key: "markerSizePx" },

    // Derived value: state stores a 0..1 float, UMM shows an integer percentage.
    { id: "opacityPct",  type: "slider", label: "Opacity", min: 10, max: 100, step: 5, unit: "%",
      get: function (s) { return Math.round((Number(s.opacity) || 0.8) * 100); },
      set: function (v) { return { opacity: Math.max(0.01, Math.min(1, v / 100)) }; } }
];
```

- **`key`** — a straight one-to-one mapping onto a state field.
- **`get` / `set`** — use instead of `key` when the stored representation differs from what the user
  should see. `get` reads from state, `set` returns a patch object.

Then:

1. **On boot, send `register`.** Build `settings` from the schema and `values` from current state.
2. **On `hello`, send `register` again.** The core booted after you.
3. **On `set` with your `id`,** patch state, then call the feature's own `apply`/`refresh` so the
   change is visible immediately.
4. **Never self-persist and never echo a `set`.**

Finally, add a row to the table in §4 and to the feature's page under [`systems/`](systems/README.md).

---

## 6. Rules and gotchas

- **Be stateless about persistence.** Declare defaults in the manifest and apply whatever `set`
  arrives. UMM owns storage and re-broadcasts saved values as `set` after load. A mod that also tries
  to persist will fight it.
- **Default-off is the project rule** ([`README.md`](README.md) § Design goals). A new feature
  registers with `default: false` unless there is a stated reason not to, and the disabled path must
  schedule no timers and create no panels — "off" means *not running*, not merely invisible.
- **A `set` can arrive before your feature has initialised.** Ordering across contexts is undefined.
  Patch state unconditionally; make `apply` safe to call when the panels do not exist yet.
- **Sliders want integers.** Both existing adapters expose percentages as integers and convert in
  `set` — `0–100` → `0.0–1.0` for opacities, `−100..100` → `−1..1` for BetterMap's offsets — rather
  than sliding a fraction directly.
- **Keep the substring guard.** `indexOf('"umm"')` before `JSON.parse` — this channel carries three
  protocols and every listener sees all of them.
- **Detect the core, do not assume it.** The idiom here is a latch set on the first `hello` or `set`.
  The minimap adapter uses it (`QolLiteMapUmmAdapter.isPresent()`) to switch off its own store, and
  the settings window hides BetterMap's subsections when it finds `#UmmRoot`, so the user does not get
  two competing UIs.
- **`id` must be stable.** It is the persistence key. Renaming it silently orphans every user's saved
  values.
- **Verify against the live UMM release before relying on protocol details.** This document reflects
  protocol v1 as implemented in the adapters in this repo; the manager is a separate project and can
  move.

---

## See also

- [`PANORAMA.md`](PANORAMA.md) §3 — why there is no storage API, and how the bus works
- [`ARCHITECTURE.md`](ARCHITECTURE.md) § Cross-context communication — the other two protocols
  sharing this channel
- [`TECH_DEBT.md`](TECH_DEBT.md) — the un-integrated features
