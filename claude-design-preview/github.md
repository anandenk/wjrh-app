# GitHub association

repo: Jakubantalik/metal-fx
branch: main

Upstream source for the `metal-fx` liquid-metal shader library used as the app's
signature chrome. Nothing is vendored from this repo — the library is loaded at
runtime from `https://esm.sh/metal-fx@2`. The repo was read only to confirm the
package is real, MIT, and dependency-free, and to check the `useMetalBend` API.

Note: the repo tree is the v1 engine and does **not** contain `useMetalBend`. The
hook exists only in the published v2 package, so its signature was read from the
live CDN build rather than from source.

## Last sync

date: 2026-09-20T20:25:50Z
tree: be1bf89c6305

### Updated in this project
- Confirmed `metal-fx` is a public MIT package, loadable in-browser from a CDN.
- Added React import-map shims so the library binds to the page's React instance.
- Wired `useMetalBend` on the play orb via a `MetalOrb` wrapper component.

## Screen map

| Screen | Built from |
|---|---|
| Now / Schedule / Show detail / About | `uploads/FRONTEND_RESTRUCTURE.md` (IA), `uploads/endel_metal_fx_design_system.md` (visual system) |
| Play orb, ON AIR badge, "N min left" | `metal-fx@2` via esm.sh — `MetalFx`, `MetalBadge`, `MetalText`, `useMetalBend` |
