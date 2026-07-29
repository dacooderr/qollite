# QOL Lite v2.1

`pak01_dir.vpk` is a compiled QOL Lite build. Place it at the highest mod-load priority. Do not load another QOL Lite or QOL Lock VPK beside it.

## Fixed

- Restored the engine-owned King of the Hill meter. The old hand-built substitute could not receive native progress, capture-state, or participant updates.
- Collapsed the KOTH meter outside active matches, including the hideout, so stale capture classes cannot leave it visible.
- Replaced the stale ShowRank bridge with the current shared bridge and connected the profile, player-context, top-bar, Escape, and player-list surfaces to it.
- Removed the minimalist-only underground vignette opacity mask while retaining the normal underground minimap opacity.
- Recompiled all Panorama layouts and styles. All 46 Panorama scripts were rebuilt through Closure Compiler ADVANCED before Source 2 compilation.

## Not included

- This VPK contains no `scripts/abilities.vdata_c` override. It cannot cause outdated hero descriptions. If a tooltip remains stale, remove an older ability-data VPK or another conflicting addon.
- This release does not contain QOL Lock. QOL Lock and QOL Lite must not be loaded together.
- Live Deadlock rendering has not been tested from this build environment. Confirm the HUD, KOTH meter, minimap, and ShowRank surfaces in-game before distributing it more broadly.
