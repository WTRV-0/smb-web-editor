# 🐒 Monkey Ball Workshop

**Live: https://wtrv-0.github.io/smb-web-editor/**

A browser-based **Super Monkey Ball 2 (GameCube) level editor**. Build stages
in a live 3D viewport, organize them into level sets, and export game-ready
files — or patch them straight into your legally-dumped SMB2 ISO for Dolphin.

Everything runs client-side: levels live in your browser (IndexedDB), and all
binary formats (stagedef, LZSS, GMA, TPL, GC ISO filesystem) are implemented
in TypeScript. No backend, no uploads.

## Running

```sh
npm install
npm run dev        # dev server
npm run build      # production build to dist/
npm test           # vitest unit tests for the binary formats
```

Use a Chromium-based browser; the ISO patcher needs the File System Access API.

Deploy: `./scripts/deploy-pages.sh` builds and force-pushes `dist/` to the
`gh-pages` branch (GitHub Pages serves from there). The site is fully static —
levels stay in your browser's IndexedDB and the ISO patcher streams your own
locally-dumped ISO through the browser; nothing is ever uploaded anywhere.

## Features

- **3D editor** — parametric primitives (box, ramp, cylinder, wedge, banked
  arc ramp, stairs, half-pipe/tube, funnel, cone, torus — all with segment
  sliders and live triangle counts), OBJ/glTF import, move/rotate/scale gizmos
  with snapping, undo/redo, autosave.
- **Blender-style mesh edit mode** — Tab into any mesh: vertex/edge/face
  selection, translate with the gizmo, extrude, subdivide (crack-free), merge
  vertices, delete faces, flip normals. Pure-function mesh ops in
  `src/editor/editableMesh.ts` with manifold/volume invariant tests.
- **Gameplay objects** — start, blue/green/red goals, bananas & bunches,
  bumpers, jamabars, cone/sphere/cylinder colliders, switches, wormhole pairs,
  fallout plane.
- **Item groups** — keyframe animation (per-axis position/rotation channels,
  loop / play-once, constant/linear/ease easing) with in-viewport playback
  preview, seesaws, switch wiring, texture scroll.
- **Textures** — upload images per level; encoded to GameCube CMPR on export.
  Untextured meshes get their editor color baked as a texture.
- **Library** — level sets, reordering into slots, thumbnails, search,
  duplicate, `.smbproj` JSON import/export for sharing/backup.
- **Export** — per level or per set: `STAGENNN.lz` (stagedef, LZSS),
  `stNNN.gma` (models), `stNNN.tpl` (textures) in a zip.
- **ISO patcher** — pick your SMB2 ISO, choose a set and starting slot, and a
  patched copy is written via streaming (original untouched). Slots 201+ are
  Challenge Beginner 1+.

## Code layout

```
src/formats/    pure-TS binary formats (unit-tested, no DOM):
  stagedef/       SMB2 stagedef writer + collision triangle/grid encoding
  lz/             SMB LZSS codec (cross-validated against SMB_LZ_Tool)
  gma/, tpl/      GameCube model + texture writers (CMPR encoder)
  gciso/          GC disc FST parse/patch, streaming ISO patcher
src/model/      stage document schema (JSON, versioned)
src/editor/     react-three-fiber viewport, gizmos, animation preview
src/panels/     palette, outliner, inspector, top bar, help, ISO patcher
src/library/    Dexie (IndexedDB) persistence, level set browser, .smbproj
src/export/     stage document -> stagedef+GMA+TPL assembly
docs/FORMATS.md reverse-engineered format notes with sources
```

Format knowledge derives from the SMB modding community's reverse engineering:
[smblevelworkshop2](https://gitlab.com/CraftedCart/smblevelworkshop2) (ws2lz),
[smb2cnv](https://github.com/Yoshimaster96/smb2cnv),
[SMB_LZ_Tool](https://github.com/bobjrsenior/SMB_LZ_Tool),
[GxUtils](https://github.com/bobjrsenior/GxUtils), and
[BlendToSMBStage2](https://github.com/TheBombSquad/BlendToSMBStage2). ❤️

## Status / caveats

- Stage files are written per the community specs and internally validated,
  but **not yet booted in-game** (pending an ISO to test with). First
  validation step: patch a simple one-floor level and boot it in Dolphin.
- Backgrounds export as "none" (the game shows an empty skybox); importing
  stock background models from a donor stage is a planned follow-up.
- Per-stage music and stage names in menus are game-code patches (see
  SMB2WorkshopMod), out of scope for stage files.
