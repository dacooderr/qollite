# QOL Lite v2.1

`pak01_dir.vpk` is a compiled QOL Lite build. Place it at the highest mod-load priority. Do not load another QOL Lite or QOL Lock VPK beside it.

## Fixed

- Restored the engine-owned King of the Hill meter. The old hand-built substitute could not receive native progress, capture-state, or participant updates.
- Collapsed the KOTH meter outside active matches, including the hideout, so stale capture classes cannot leave it visible.
- Replaced the stale ShowRank bridge with the current shared bridge and connected the profile, player-context, top-bar, Escape, and player-list surfaces to it.
- Showed the engine game clock and team net worth in the hideout while keeping both hidden during new-game HUD loading and preserving backwards-clock state reset.
- Removed the minimalist-only underground vignette opacity mask while retaining the normal underground minimap opacity.
- Added QOL Lock's independent Minimalist Opacity control to Better Map, including 0% base-map opacity without hiding markers or tunnel overlays.
- Restored QOL Lock's fully transparent Minimalist backing and compact pak47-compiled custom tunnel texture.
- Slightly darkened only the surface base map while keeping underground artwork, tunnels, and markers at full brightness for clear level distinction.
- Recompiled all Panorama layouts and styles, including nested assets. All 46 Panorama scripts use Closure Compiler ADVANCED with Panorama APIs, cross-script properties, and XML entrypoints preserved.
- Restored Recent Purchases item and hero icon data after Closure removed the cross-script maps, and added an enabled-by-default UMM toggle with safe disable/re-enable cleanup.
- Updated the Top Bar Plus objective tracker so missing Rift marker evidence no longer leaves the status stuck on `Rift live`.
- Removed unsupported Panorama CSS declarations that produced parsing warnings in the top bar, minimap, and hero-testing menu.

## Not included

- This VPK contains no `scripts/abilities.vdata_c` override. It cannot cause outdated hero descriptions. If a tooltip remains stale, remove an older ability-data VPK or another conflicting addon.
- This release does not contain QOL Lock. QOL Lock and QOL Lite must not be loaded together.
- Live Deadlock rendering has not been tested from this build environment. Confirm the HUD, KOTH meter, minimap, and ShowRank surfaces in-game before distributing it more broadly.
