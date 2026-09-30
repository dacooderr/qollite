# Asset optimizations

> Replacement models, materials, particles, and textures that cut rendering cost or fix visual bugs.
>
> **Runs in:** everywhere · **Off switch:** ❌ n/a — these are replacements, not features
> **Last verified:** 2026-09-30 against working tree on fix/patch-6711-rebase (uncommitted) — only the Vindicta scope and minimap-texture facts were re-checked; the rest is as recorded on 2026-08-05 (`ac57b17`).

The only part of the mod with **negative** cost. Everything else adds work; this removes it.

---

## What it does

| README entry | What it replaces |
|---|---|
| Optimized McGinnis Wall | The wall's mesh, materials, and particle systems |
| Sinner's Light Fix | Sinner's Sacrifice vault lighting materials |
| Vindicta Scope Downscale | `panorama/images/hud/crosshair/scope_common_psd.png`, compiled via `panorama/image_compiler.vdata` (re-added in `fb74e00`) |
| — | Minimap textures (neutral-camp icons, tunnels) — **unused since the 6722 update**, see below |

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
├── qollite_tunnels.png / .vtex                    1024², 780 KB — referenced by nothing
└── base/neutral_{large,medium,vault}_custom_png.*  rules match nothing

panorama/images/hud/crosshair/scope_common_psd.png   Vindicta scope
panorama/image_compiler.vdata                        lists it for compilation
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

`panorama/images/minimap/base/neutral_{large,medium,vault}_custom_png.*` were meant to restyle
neutral-camp markers, but they are referenced only by `.dmm_custom_neutral_*_icon` rules in `hud.css`,
and nothing sets a `dmm_custom_*` class. `materials/minimap/neutral_vault.png` is referenced by nothing.
`qollite_tunnels.png` was the tunnel overlay for the minimap's minimalist mode; its rule targeted
Valve's `.map_button.shop_tunnel`, a class 6711 removed, and was dropped at the 6722 rebase — so the
single largest file in `panorama/` (1024², 780 KB) now ships unused
([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).

---

## Settings

**None**, and none possible. An asset is either shipped or it is not; there is no runtime switch.

---

## Known issues

- **Vindicta Scope Downscale** was listed in the README but could not be located when this page was
  first written; `fb74e00` re-added it (the scope texture above). How it downscales — a smaller
  texture at Valve's path — was not re-examined.
- **No before/after measurements exist.** For a mod that treats runtime cost as a requirement, the
  optimizations are undocumented in effect. Frame-time numbers for the McGinnis wall would be worth
  having — both to justify the work and to catch a regression when Valve reships the asset.
- **These files go stale silently.** If Valve updates the wall model or the vault materials, our
  replacements keep overriding with the old version and users see outdated art with no error. Add an
  after-patch check.
- `qollite_tunnels.png` (780 KB) and the neutral-icon textures ship unused — delete, or restore a
  6722 equivalent for the tunnels overlay ([`../TECH_DEBT.md`](../TECH_DEBT.md) §4).

---

## See also

- [minimap](minimap.md) — formerly consumed the tunnel and neutral-camp textures
- [`../PANORAMA.md`](../PANORAMA.md) §3 — path ownership and pak priority
