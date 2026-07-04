# SMB2 binary format notes

Distilled from community reference implementations (all reverse-engineered):
ws2lz (smblevelworkshop2, CraftedCart et al.), smb2cnv (Yoshimaster96),
SMB_LZ_Tool / LZCompressor (Okumura LZSS adapted by camthesaxman/ComplexPlane),
GxUtils (bobjrsenior). All multi-byte values BIG-endian unless noted.

## .lz container (compressed stagedef)

8-byte header, then LZSS stream:

- u32 **little**-endian: compressed size (payload only, header excluded)
- u32 **little**-endian: uncompressed size
- LZSS: Okumura classic with N=4096 ring buffer, F=18 max match, THRESHOLD=2,
  ring buffer initialised to **zeros** (not spaces). Flag byte per 8 units,
  bit=1 literal byte, bit=0 (pos,len) pair:
  byte0 = pos low 8 bits; byte1 = (pos >> 4) & 0xF0 | (len - 3).
  Positions are absolute ring-buffer indices; decoder starts writing at r = N - F.

## Stagedef (uncompressed .lz.raw) — SMB2

Written in this order (ws2lz `SMB2LzExporter::generate`):
file header (2204 B), starts (20 B each), fallout Y (4 B), [fog 36 B, fog anim
header 48 B + keyframes], collision headers (1180 B each), collision triangles
(64 B each), grid tile pointer lists (4 B per tile), grid triangle index lists
(u16 indices, 0xFFFF-terminated per non-empty tile, 4-byte aligned per group),
goals (20 B), bumpers (32 B), jamabars (32 B), bananas (16 B), cones (32 B),
spheres (20 B), cylinders (28 B), switches (24 B), wormholes (28 B),
level model ptr A (12 B), ptr B (4 B), level models (16 B), model names
(NUL-terminated, 4-aligned), backgrounds (56 B) + names, foregrounds (56 B) +
names, bg/fg anim headers (96 B), item-group anim headers (64 B), effect
headers (48 B) per bg/fg, texture scroll (8 B) per bg/fg/group, bg/fg effect
keyframes, bg/fg transform keyframes (with scale + unknowns), group transform
keyframes (rot then pos, no scale), runtime reflective models (12 B), fallout
volumes (32 B), 64 B trailing zero padding.

### File header (offset: field)

```
0x00  u32 0, u32 0x447A0000 (magic)
0x08  u32 collision header count, u32 collision headers offset
0x10  u32 start offset, u32 fallout offset
0x18  u32 goal count, u32 goal list offset
0x20  u32 bumper count/offset      0x28 u32 jamabar count/offset
0x30  u32 banana count/offset      0x38 u32 cone count/offset
0x40  u32 sphere count/offset      0x48 u32 cylinder count/offset
0x50  u32 fallout volume count/offset
0x58  u32 bg count/offset          0x60 u32 fg count/offset
0x68  u32 monkey race header offset (0)
0x6C  u32 stage type flag (main game = 0x1)
0x70  u32 reflective-model count (ws2lz writes reflective count here labelled
      "wormholeCount" var; we write 0), u32 reflective model list offset (0 for wormholes to work)
0x78  u32 golf hole offset (0)
0x7C  8 B null, 8 B null (model instances)
0x8C  u32 level model count, u32 level model ptr A offset
0x94  u32 level model count, u32 level model ptr B offset
0x9C  12 B null
0xA8  u32 switch count, u32 switch offset
0xB0  u32 fog anim header offset
0xB4  u32 wormhole count, u32 wormhole offset
0xBC  u32 fog offset
0xC0  20 B null, 4 B null (mystery 3), 1988 B null  → total 2204
```

### Records

- rotations: 16-bit angle units, `deg/360 * 65536`, stored u16 x,y,z
- start (20): vec3 pos, rot3, 2 B pad
- goal (20): vec3 pos, rot3, u8 type (blue 0, green 1, red 2), u8 castShadow
- bumper/jamabar (32): pos, rot3, 2 pad, vec3 scale
- banana (16): pos, u32 type (single 0, bunch 1)
- cone (32): pos, rot3, 2 pad, f radius, f height, f radius
- sphere (20): pos, f radius, 4 pad
- cylinder (28): pos, f radius, f height, rot3, 2 pad
- switch (24): pos, rot3, u16 playbackState (PLAY 0, PAUSE 1, PLAY_BACKWARDS 2,
  FAST_FORWARD 3, REWIND 4), u16 linked anim group id, 2 pad
- wormhole (28): u32 1, pos, rot3, 2 pad, u32 offset of destination wormhole
- fallout volume (32): pos, vec3 scale, rot3, 2 pad
- level model ptr A (12): u32 bitflag (0 default), u32 1, u32 → level model
- level model ptr B (4): u32 → ptr A entry
- level model (16): 4 null, u32 → name, 8 null
- background (56): u32 meshType (0x1F), u32 → name, 4 null, pos, rot3, 2 pad,
  vec3 scale, 4 null, u32 anim header offset (0 if none), u32 effect header offset
- keyframe (20): u32 easing (CONSTANT 0, LINEAR 1, CUBIC 2), f time, f value,
  f handleA, f handleB. Rotation keyframe values written in degrees.
- item-group anim header (64): u32 count + u32 offset for rotX, rotY, rotZ,
  posX, posY, posZ, then 16 null
- bg/fg anim header (96): 4 null, f loopTime, then count/offset pairs for
  scaleX/Y/Z, rotX/Y/Z, posX/Y/Z, unknown1, unknown2
- effect header (48): u32 fx1 count/offset, u32 fx2 count/offset,
  u32 texture scroll offset, 28 null
- texture scroll (8): f u speed, f v speed

### Collision header (1180)

```
vec3 rotation center, rot3 initial rotation, u16 anim type
   (0 loop, 1 play-once, 2 seesaw), u32 anim header offset
vec3 conveyor speed
u32 collision triangle list offset, u32 grid tile pointer list offset
vec2 grid start (default -256,-256), vec2 grid step (32,32), u32 x2 step count (16,16)
u32 count + u32 offset: goals, bumpers, jamabars, bananas, cones, spheres,
   cylinders, fallout volumes, reflective models
8 null
u32 level model count, u32 level model ptr B offset
8 null
u16 anim group id (0 static; switches reference this), 2 pad
u32 switch count, u32 switch offset
4 null (mystery 5 count), 4 null (mystery 5 offset)
f seesaw sensitivity, f seesaw friction (reset stiffness), f seesaw spring (bounds)
u32 wormhole count, u32 wormhole offset
u32 initial playback state (0 play/pause etc), 4 null
f anim loop time (seconds), u32 texture scroll offset
960 null
```

### Collision triangles (64 each) & grid

Triangle encoding ("the madness", from smb2cnv): stores vertex A pos, face
normal, XYZ rotation (16-bit units) mapping the triangle plane to the XY plane,
u16 flag, then 2D deltas of B and C in rotated space (DX2, DY2, DX3, DY3), then
2D tangent = hat(C-B), bitangent = hat(-C) normalised (hat(v) = (-v.y, v.x)).
See `stagedef/collision.ts` for the exact port.

Grid: per item group, an X×Y (16×16) grid over XZ starting at gridStart.
Each tile lists indices (u16) of triangles whose XZ AABB (padded 0.7) overlaps
the tile; list 0xFFFF-terminated; empty tile → pointer 0. Tile pointer table is
row-major with x fastest (pointer index i = y*xCount + x, written iterating all
tiles; indicesGrid[y][x], outer loop x, inner y when filling — net effect:
offsets assigned in x-major order of (x,y) i.e. for x{ for y{} }, but pointer
table written in tile order 0..n sequentially matching that same fill order).

## GMA / TPL

Per GxUtils LibGxFormat (Gma.cs, Gcmf.cs, GcmfMesh.cs, GcmfMaterial.cs,
GcmfTriangleStrip.cs, GcmfVertex.cs, Tpl.cs, TplTexture.cs). Big-endian.

GMA container: u32 model count, u32 model base (= header size aligned 0x20);
per model u32 model offset + u32 name offset (0-based into name table);
NUL-terminated names + one extra 0x00 byte, pad to 0x20; then GCMFs.

GCMF (non-indexed float variant, sectionFlags 0): magic 'GCMF', u32 flags,
bounding sphere center + radius (f32×4), u16 material count, u16 layer1 mesh
count, u16 layer2 count, u8 matrix count, u8 0, u32 header size
(align32(0x40 + 0x20·materials)), u32 0, u8[8] default matrix idxs (0xFF),
16 zero. Material (0x20): u32 flags (0x7D4 = repeat S/T + filtering), u16 TPL
texture index, u8 unk6, u8 aniso, u32 0, u16 0x2E00, u16 material index,
u32 0x30, 12 zero. Mesh header (0x60): u32 renderFlags (0x02 = two-sided),
u32 0xFFFFFFFF, u32 0x7F7F7FFF, u32 0, u16 0x00FF, u8 used-material count,
u8 section flags (0x01 = CCW strips present), u16 0xFF00, u16×3 material idxs
(unused = 0xFFFF), u32 vertex flags (0x200 pos | 0x400 normal | 0x2000 uv),
u8[8] 0xFF, u32 chunk1 size (CCW strip bytes), u32 chunk2 size (CW), mesh
bounding center f32×3, f32 0, u32 0x14, 28 zero. Strip: u8 0x98 (float,
0x99=u16), u16 vertex count, vertices (pos3f, normal3f, uv2f per flags).

TPL: u32 texture count; per texture u32 GX format (CMPR=14), u32 data offset,
u16 w, u16 h, u16 mip levels, u16 0x1234; pad header to 0x20 with bytes
0x00,0x01,0x02…; then raw texture data. CMPR: 8x8 tiles of four 4x4 DXT1
blocks (2x2), colors RGB565 big-endian, 2-bit indices MSB-first.

## GameCube disc (ISO)

Header: game id at 0x0 (SMB2 = GM2x8P), u32 FST offset @0x424, size @0x428.
FST: 12-byte entries (u8 flags 0=file/1=dir, u24 name offset, u32 file offset
or parent, u32 length or subtree end index); entry 0 = root, length = entry
count; string table follows entries. Patch = overwrite file data in place when
it fits, else append (0x8000-aligned) and rewrite the entry.
