# Asset optimizations

> Replacement models, materials, particles, and textures that cut rendering cost or fix visual bugs.
>
> **Runs in:** everywhere · **Off switch:** ❌ n/a — these are replacements, not features
> **Last verified:** 2026-08-05 against commit `ac57b17`.

The only part of the mod with **negative** cost. Everything else adds work; this removes it.

---

## What it does

| README entry | What it replaces |
|---|---|
| Optimized McGinnis Wall | The wall's mesh, materials, and particle systems |
| Sinner's Light Fix | Sinner's Sacrifice vault lighting materials |
| Vindicta Scope Downscale | *(see [Known issues](#known-issues) — not located in this repo)* |
| — | Minimap textures (compact minimap, neutral vault, tunnels) |

---

## Files

```
materials/
├── abilities/mcg_wall_fill_main00.vmat            McGinnis wall fill
├── abilities/mcg_wall_fill_trim0000000.vmat       McGinnis wall trim
├── default/default_ao_tga_*.png                   1×1 stubs (86 bytes each)
├── default/default_mask_tga_*.png
├── default/default_normal_tga_*.png  ×2
└── minimap/neutral_vault.png

models/
├── abilities/engineer_wall.vmdl                   low-poly wall definition
├── abilities/engineer_wall_..._low_poly_opaque.dmx  the mesh
├── abilities/engineer_wall_hull.dmx               simplified collision hull
├── abilities/materials/engineer_wall_preview_{good,bad}.vmat
├── heroes_staging/engineer/materials/soul_sludge_wall{,_extras}.vmat
└── props_gameplay/sinners_sacrifice_vault/materials/sinners_sacrifice_bulbs.vmat

particles/abilities/engineer/                      7 .vpcf replacements

panorama/images/minimap/
├── qollite_tunnels.png / .vtex                    1024², 780 KB
└── base/neutral_{large,medium,vault}_custom_png.*
```

Total roughly 2.5 MB, dominated by `models/`.

---

## How it works

### Path replacement

There is no patching mechanism — shipping a file at a game asset's own path replaces it. Same rule as
Panorama ([`../PANORAMA.md`](../PANORAMA.md) §3): whoever wins the pak priority wins the file, which is
another reason QOL Lite must load first.

### The 1×1 stub trick

`materials/default/*.png` are **86-byte, 1×1 RGBA PNGs**. They are not placeholders — they are the
optimization. The overridden materials reference them where the original used full AO, normal, and
mask maps:

```
"TextureAmbientOcclusion"  "materials/default/default_ao.tga"
"TextureNormalRoughness"   "materials/default/default_normal.tga"
"TextureSelfIllumMask"     "materials/default/default_mask.tga"
"TextureTintMask"          "materials/default/default_mask.tga"
```

The shader still gets every input it expects, so nothing breaks — but the sampled textures are a
single pixel. This removes the memory and bandwidth cost of those maps without touching the shader.

`mcg_wall_fill_main00.vmat` also flattens the material to `pbr.vfx` with a constant tint
(`g_vColorTint1 [0.075 0.16 0.22 0.0]`) and zero metalness.

### The low-poly wall

`engineer_wall.vmdl` is a minimal ModelDoc: one `RenderMeshFile`
(`engineer_wall_low_poly_opaque.dmx`) and one `PhysicsHullFile` (`engineer_wall_hull.dmx`). No bones,
no LOD chain, no material groups. The McGinnis wall is a frequent, large, screen-filling object, which
is why it was worth targeting.

The seven `.vpcf` files in `particles/abilities/engineer/` replace the wall's particle systems on the
same principle.

### Minimap textures

`panorama/images/minimap/base/neutral_{large,medium,vault}_custom_png.*` and
`materials/minimap/neutral_vault.png` restyle neutral-camp markers.
`qollite_tunnels.png` is the tunnel overlay used by the minimap's minimalist mode
([minimap](minimap.md)) — at 1024² and 780 KB it is the single largest file in `panorama/`.

---

## Settings

**None**, and none possible. An asset is either shipped or it is not; there is no runtime switch.

---

## Known issues

- **"Vindicta Scope Downscale" could not be located.** The README lists it, but nothing in
  `materials/`, `models/`, `particles/`, or the Panorama tree obviously implements it — the only
  scope-related reference is `#scope_screen_effect` in `hud.css`, which is **identical to Valve's
  baseline**. Either the feature ships elsewhere, was removed without a README update, or is
  implemented somewhere not yet found. **Needs a maintainer's answer.**
- **No before/after measurements exist.** For a mod that treats runtime cost as a requirement, the
  optimizations are undocumented in effect. Frame-time numbers for the McGinnis wall would be worth
  having — both to justify the work and to catch a regression when Valve reships the asset.
- **These files go stale silently.** If Valve updates the wall model or the vault materials, our
  replacements keep overriding with the old version and users see outdated art with no error. Add an
  after-patch check.
- `qollite_tunnels.png` at 780 KB is worth a compression pass on footprint grounds.

---

## See also

- [minimap](minimap.md) — consumes the tunnel and neutral-camp textures
- [`../PANORAMA.md`](../PANORAMA.md) §3 — path ownership and pak priority
