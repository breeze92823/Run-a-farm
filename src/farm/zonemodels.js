import {
  BufferAttribute,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import { E, M, block, box, cyl, gableRoof, prism, signCanvas, signMaterial, signPanel } from './kit.js'
import { compact, cy, mergeGeometries, rbox, sph, tube } from './detail.js'
import { paintBurlap, paintCorrugated, paintSiding, paintStripes, tex } from './textures.js'
import { mulberry32, paintWaterNormal, toTexture } from '../textures.js'

// Models for the new zones: the sheep shed (shearing station, wool bales), the
// goat barn with its climbing tower, bee hives with an instanced swarm, orchard
// apple trees, the tomato greenhouse, the fishing dock, a pond, the trophy
// shelf, festival stalls and bunting. Every builder returns { g, ... } with the
// origin at ground centre and its FRONT facing -Z (unless noted). No colliders
// and no gating here (the caller does both); moving / toggled parts live in
// their own groups (flagged noCompact where their children must stay apart).

const TAU = Math.PI * 2

// --- Shared materials -----------------------------------------------------------------------------------
const texMats = new Map()
const cachedMat = (key, make) => {
  let m = texMats.get(key)
  if (!m) texMats.set(key, (m = make()))
  return m
}
const sidingMat = (color, rx = 4, ry = 1) => cachedMat(`s${color}${rx}${ry}`, () => new MeshStandardMaterial({ color, map: tex(paintSiding(256, 8, 991), rx, ry), roughness: 0.85 }))
const tinMat = (color, rx = 6, ry = 2) => cachedMat(`t${color}${rx}${ry}`, () => new MeshStandardMaterial({ color, map: tex(paintCorrugated(128, 8), rx, ry), roughness: 0.45, metalness: 0.35 }))
const burlapMat = () => cachedMat('burlap', () => new MeshStandardMaterial({ color: '#f4ecd8', map: tex(paintBurlap(128), 1, 1), roughness: 1 }))
const awningMat = (color) => cachedMat(`aw${color}`, () => new MeshStandardMaterial({ map: tex(paintStripes(color, '#fbf6ee', 8), 1, 1), roughness: 0.8, side: DoubleSide }))
const signCache = new Map()
// A painted sign material (cached by text + colours).
function signMat(text, { w = 512, h = 128, bg = '#f7f4ec', fg = '#6e3a1e', border = fg, size = 80 } = {}) {
  const key = [text, w, h, bg, fg, border, size].join('|')
  let m = signCache.get(key)
  if (!m) signCache.set(key, (m = signMaterial(signCanvas(w, h, { bg, border, borderWidth: 10, radius: 14, lines: [{ text, size, color: fg }] }))))
  return m
}
// A sign facing -Z (signPanel faces +Z).
const frontSign = (g, w, h, mat, x, y, z) => signPanel(g, w, h, mat, x, y, z, Math.PI)

const WOOD = () => M('#a8743f', { roughness: 0.85 })
const DARK_WOOD = () => M('#6e4528', { roughness: 0.85 })
const CREAM = () => M('#f7f4ec', { roughness: 0.6 })
const STRAW = () => M('#e3c063', { roughness: 1 })
const METAL = () => M('#9aa3ab', { roughness: 0.35, metalness: 0.75 })

function shadowsOn(g) {
  g.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) {
      o.castShadow = o.userData.noShadow ? false : true
      o.receiveShadow = true
    }
  })
}

// A wooden crate with darker edge slats (2 materials).
function crate(g, s, x, y, z, ry = 0) {
  block(g, s, s, s, M('#c08a4e', { roughness: 0.85 }), x, y, z, ry)
  for (const k of [0.15, 0.5, 0.85]) block(g, s + 0.02, 0.06, s + 0.02, DARK_WOOD(), x, y + s * k - 0.03, z, ry, false)
}
// A ribbed pumpkin straight into g (no group, so it merges with the rest).
function pump(g, x, z, r = 0.3, color = '#ee7a1f', y = 0) {
  const mat = M(color, { roughness: 0.55 })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU
    sph(g, 1, mat, x + Math.cos(a) * r * 0.36, y + r * 0.74, z + Math.sin(a) * r * 0.36, r * 0.62, r * 0.78, r * 0.62, 10)
  }
  cyl(g, 0.15 * r, 0.21 * r, r * 0.4, M('#5d7a2a'), x, y + r * 1.52, z, 6)
}

// --- 1. Sheep shed ---------------------------------------------------------------------------------------
// 10 x 7 m open-fronted timber shed (mono-pitch tin roof falling to the back),
// a raised shearing board with an overhead shearing machine and hanging
// handpiece, a skirting table with a fleece, stacked wool bales and a hay rack.
export function sheepShed() {
  const g = new Group()
  const W = 10
  const D = 7
  const HF = 3.3 // front eave
  const HB = 2.4 // back eave
  const wall = sidingMat('#7fa070', 6, 1)
  const trim = CREAM()
  const post = DARK_WOOD()
  // Straw-bedded floor and a concrete lip at the front.
  block(g, W, 0.08, D, M('#cfc3a0', { roughness: 1 }), 0, 0, 0, 0, false)
  block(g, W, 0.12, 0.4, M('#b9b6ae', { roughness: 0.9 }), 0, 0, -D / 2 + 0.2, 0, false)
  // Back and side walls (the gable triangles stay open for air), corner posts.
  block(g, W, HB, 0.15, wall, 0, 0, D / 2 - 0.075)
  for (const s of [-1, 1]) block(g, 0.15, HB, D - 0.15, wall, s * (W / 2 - 0.075), 0, -0.075)
  for (const x of [-W / 2 + 0.12, -W / 6, W / 6, W / 2 - 0.12]) block(g, 0.22, HF, 0.22, post, x, 0, -D / 2 + 0.12)
  block(g, W + 0.2, 0.3, 0.24, post, 0, HF - 0.3, -D / 2 + 0.12) // front header
  for (const s of [-1, 1]) {
    // Diagonal rafter closing each side above the wall.
    const len = Math.hypot(D, HF - HB)
    const r = box(g, 0.14, 0.14, len, post, s * (W / 2 - 0.075), (HF + HB) / 2 - 0.08, 0)
    r.rotation.x = Math.atan2(HF - HB, D)
    block(g, 0.18, 0.12, D, trim, s * (W / 2 - 0.075), HB - 0.06, 0, 0, false)
  }
  // Roof: one tin panel sloping to the back, rafters under it.
  const pitch = Math.atan2(HF - HB, D)
  const L = Math.hypot(D, HF - HB) + 0.9
  const roof = box(g, W + 0.8, 0.12, L, tinMat('#6f7d86', 8, 3), 0, (HF + HB) / 2 + 0.1, -0.15)
  roof.rotation.x = pitch
  for (let i = 0; i < 6; i++) {
    const r = box(g, 0.12, 0.16, L - 0.6, post, -W / 2 + 1 + i * 1.6, (HF + HB) / 2 - 0.05, -0.15)
    r.rotation.x = pitch
  }
  // A sign hanging from the front header on two chains.
  frontSign(g, 3.0, 0.62, signMat('SHEARING SHED', { fg: '#3f6a34', border: '#3f6a34', size: 66 }), 0, HF - 0.75, -D / 2 + 0.1)
  for (const s of [-1, 1]) block(g, 0.03, 0.15, 0.03, M('#3a3a3a'), s * 1.3, HF - 0.45, -D / 2 + 0.1, 0, false)
  const roofY = (z) => HF - ((z + D / 2) / D) * (HF - HB) // underside height at z

  // Shearing board: a raised timber platform with a rubber mat and a step.
  const sx = -2.6
  const sz = 0.4
  block(g, 2.4, 0.36, 2.4, WOOD(), sx, 0, sz)
  block(g, 2.1, 0.03, 2.1, M('#2f3236', { roughness: 0.95 }), sx, 0.36, sz, 0, false)
  block(g, 0.8, 0.18, 0.5, WOOD(), sx, 0, sz - 1.45)
  for (const s of [-1, 1]) block(g, 2.44, 0.06, 0.06, DARK_WOOD(), sx, 0.33, sz + s * 1.2, 0, false)
  // Overhead shearing machine: a beam between the side wall and a post, the motor, the down tube and the handpiece.
  const beamY = roofY(sz) - 0.35
  block(g, 0.18, beamY, 0.18, post, sx + 1.3, 0, sz + 1.3)
  block(g, sx + 1.3 + W / 2, 0.16, 0.16, post, (sx + 1.3 - W / 2) / 2, beamY, sz + 1.3) // wall to post
  const mx = sx + 0.2
  const mz = sz + 1.3
  rbox(g, 0.34, 0.28, 0.42, 0.06, M('#c8302a', { roughness: 0.4, metalness: 0.3 }), mx, beamY - 0.12, mz, 2) // motor
  cy(g, 0.1, 0.1, 0.12, METAL(), mx, beamY - 0.12, mz - 0.27, 12, 'z')
  // Drive arm (two jointed tubes) and the hanging handpiece with its comb.
  const j1 = [mx, beamY - 0.3, mz]
  const j2 = [mx + 0.15, beamY - 0.95, mz - 0.55]
  const hp = [mx + 0.25, 1.35, mz - 0.7]
  tube(g, j1, j2, 0.035, METAL(), 8)
  sph(g, 0.06, M('#2a2c30'), ...j2, 1, 1, 1, 8)
  tube(g, j2, hp, 0.022, M('#2a2c30', { roughness: 0.6 }), 8)
  const hand = rbox(g, 0.09, 0.26, 0.09, 0.035, METAL(), hp[0], hp[1] - 0.14, hp[2], 2)
  void hand
  block(g, 0.11, 0.06, 0.03, M('#d9dde1', { roughness: 0.2, metalness: 0.9 }), hp[0], hp[1] - 0.33, hp[2])
  // Skirting table with a spread fleece.
  const tx = 0.6
  const tz = 1.9
  for (const [x, z] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) block(g, 0.08, 0.85, 0.08, DARK_WOOD(), tx + x, 0, tz + z, 0, false)
  block(g, 2.0, 0.06, 1.2, WOOD(), tx, 0.85, tz)
  const fleece = cy(g, 0.75, 0.7, 0.1, M('#f2ecdc', { roughness: 1 }), tx, 0.96, tz, 10)
  fleece.scale.set(1.15, 1, 0.65)
  // Wool bales: burlap-wrapped cubes, two rows and one on top, with straps.
  const bale = burlapMat()
  const strap = M('#3a3a3a', { roughness: 0.6 })
  const bales = [[2.8, 0, 2.6], [3.9, 0, 2.6], [2.8, 0, 1.5], [3.9, 0, 1.5], [3.35, 0.95, 2.6], [3.9, 0, 0.4]]
  for (const [x, y, z] of bales) {
    block(g, 1.0, 0.95, 1.0, bale, x, y, z)
    for (const k of [0.3, 0.7]) block(g, 1.02, 0.95 * 1.01, 0.05, strap, x, y - 0.005, z - 0.5 + k, 0, false)
  }
  // A fleece sack in a wool-pack frame.
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) block(g, 0.07, 1.7, 0.07, DARK_WOOD(), 1.6 + x, 0, -0.4 + z, 0, false)
  block(g, 0.86, 1.3, 0.86, bale, 1.6, 0.05, -0.4)
  for (const s of [-1, 1]) block(g, 0.9, 0.07, 0.07, DARK_WOOD(), 1.6, 1.62, -0.4 + s * 0.4, 0, false)
  // Hay rack along the back wall behind the shearing board, straw in it.
  block(g, 2.6, 0.12, 0.6, WOOD(), -3.0, 1.0, D / 2 - 0.5)
  for (let i = 0; i < 9; i++) block(g, 0.04, 0.6, 0.04, DARK_WOOD(), -4.2 + i * 0.3, 1.1, D / 2 - 0.75, 0, false)
  block(g, 2.4, 0.4, 0.45, STRAW(), -3.0, 1.12, D / 2 - 0.45, 0, false)
  // Water trough at the front-right, a broom against the wall.
  block(g, 1.6, 0.5, 0.6, METAL(), 3.6, 0, -2.4)
  block(g, 1.5, 0.04, 0.5, M('#6fb0d6', { roughness: 0.05 }), 3.6, 0.47, -2.4, 0, false)
  const broom = tube(g, [-4.75, 0.1, -1.6], [-4.85, 1.5, -1.5], 0.025, WOOD())
  void broom
  block(g, 0.3, 0.25, 0.08, STRAW(), -4.74, 0, -1.6, 0, false)
  // A warm lamp under the header.
  block(g, 0.03, 0.3, 0.03, M('#3a3a3a'), sx, HF - 0.6, -D / 2 + 0.12, 0, false)
  box(g, 0.3, 0.2, 0.3, E('#ffcf7a', 1.4), sx, HF - 0.7, -D / 2 + 0.12, 0, false)
  shadowsOn(g)
  compact(g)
  return { g }
}

// --- 2. Goat barn ---------------------------------------------------------------------------------------------
// 10 x 8 m: a cream barn with green trim and a red gable roof (gable to the front)
// on the west 6.4 m, and on the east strip a goat playground: a stack of crates,
// a cable spool, a ramp up to a little roofed tower.
export function goatBarn() {
  const g = new Group()
  const wall = sidingMat('#e6d6ae', 4, 1)
  const green = M('#3f6e4a', { roughness: 0.6 })
  const red = tinMat('#b23a2e', 4, 3)
  const BW = 6.4
  const BD = 7.2
  const BX = -5 + BW / 2 // barn centre x (-1.8)
  const BZ = 0.3
  const H = 3.0
  const body = new Group()
  body.position.set(BX, 0, BZ)
  g.add(body)
  block(body, BW, H, BD, wall, 0, 0, 0)
  prism(body, BW, 2.2, BD, wall, 0, H, 0)
  gableRoof(body, BW, BD, H, 34, red, { overhang: 0.4, axis: 'z', trim: green })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(body, 0.2, H, 0.2, green, sx * BW / 2, 0, sz * BD / 2, 0, false)
  // Front (-Z): a Dutch door (top half open, dark inside), loft door, sign.
  const fz = -BD / 2
  block(body, 1.8, 1.15, 0.08, M('#4f8a5a'), 0, 0, fz - 0.03)
  block(body, 1.8, 1.05, 0.04, M('#2a1a10'), 0, 1.15, fz - 0.02, 0, false)
  for (const s of [-1, 1]) block(body, 0.14, 2.35, 0.12, CREAM(), s * 0.97, 0, fz - 0.05, 0, false)
  block(body, 2.08, 0.14, 0.12, CREAM(), 0, 2.3, fz - 0.05, 0, false)
  for (const s of [-1, 1]) {
    const b = box(body, 0.09, 1.3, 0.04, CREAM(), 0, 0.58, fz - 0.09)
    b.rotation.z = s * 0.66
  }
  block(body, 1.1, 1.0, 0.08, M('#4f8a5a'), 0, H + 0.35, fz - 0.03)
  for (const s of [-1, 1]) {
    const b = box(body, 0.07, 1.25, 0.04, CREAM(), 0, H + 0.85, fz - 0.08)
    b.rotation.z = s * 0.83
  }
  frontSign(body, 2.2, 0.6, signMat('GOATS', { fg: '#3f6e4a', border: '#3f6e4a', size: 88 }), 0, 2.75, fz - 0.07)
  // Side windows and a feed rack by the door.
  for (const z of [-1.6, 1.6]) {
    block(body, 0.08, 0.9, 1.1, CREAM(), -BW / 2 - 0.02, 1.4, z, 0, false)
    block(body, 0.1, 0.7, 0.9, M('#2c3e4e', { roughness: 0.1, metalness: 0.4 }), -BW / 2 - 0.03, 1.5, z, 0, false)
  }
  block(body, 1.2, 0.5, 0.45, WOOD(), -2.2, 0.45, fz - 0.3)
  block(body, 1.1, 0.3, 0.38, STRAW(), -2.2, 0.85, fz - 0.3, 0, false)
  for (const x of [-2.75, -1.65]) block(body, 0.08, 0.45, 0.08, DARK_WOOD(), x, 0, fz - 0.3, 0, false)
  box(body, 0.26, 0.2, 0.26, E('#ffcf7a', 1.4), 1.3, 2.45, fz - 0.2, 0, false)

  // Goat playground on the east strip (x 1.6 .. 5).
  // Stack of crates: three, two, one.
  const cs = 0.8
  for (let i = 0; i < 3; i++) crate(g, cs, 2.0 + i * 0.85, 0, -2.9)
  for (let i = 0; i < 2; i++) crate(g, cs, 2.42 + i * 0.85, cs, -2.9, 0.1)
  crate(g, cs, 2.85, cs * 2, -2.9, -0.08)
  // Tower: four posts, a deck at 1.6 m with rails, and a tiny gable roof.
  const tx = 3.9
  const tz = 1.6
  const TH = 1.6
  for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) block(g, 0.14, TH + 1.5, 0.14, DARK_WOOD(), tx + x, 0, tz + z)
  block(g, 1.7, 0.12, 1.7, WOOD(), tx, TH, tz)
  for (const s of [-1, 1]) block(g, 1.6, 0.08, 0.06, DARK_WOOD(), tx, TH + 0.6, tz + s * 0.78, 0, false)
  block(g, 0.06, 0.08, 1.6, DARK_WOOD(), tx + 0.78, TH + 0.6, tz, 0, false)
  block(g, 1.7, 0.06, 1.7, green, tx, TH + 1.47, tz) // ceiling board
  gableRoof(g, 1.7, 1.7, TH + 1.5, 32, red, { overhang: 0.2, axis: 'x', cx: tx, cz: tz, thick: 0.08 })
  // Ramp from the ground (south of the tower) up to the deck, with cleats.
  const r0 = [tx - 0.15, 0, tz - 3.6]
  const r1 = [tx - 0.15, TH + 0.06, tz - 0.8]
  const rl = Math.hypot(r1[2] - r0[2], r1[1] - r0[1])
  const ramp = box(g, 0.8, 0.08, rl, WOOD(), r0[0], (r0[1] + r1[1]) / 2 + 0.04, (r0[2] + r1[2]) / 2)
  ramp.rotation.x = -Math.atan2(r1[1] - r0[1], r1[2] - r0[2])
  for (let i = 1; i < 7; i++) {
    const k = i / 7
    box(g, 0.8, 0.05, 0.05, DARK_WOOD(), r0[0], r0[1] + (r1[1] - r0[1]) * k + 0.1, r0[2] + (r1[2] - r0[2]) * k, 0, false)
  }
  // A cable spool to hop on and a straw patch.
  const spool = new Group()
  spool.position.set(2.2, 0, 0.6)
  cyl(spool, 0.7, 0.7, 0.08, WOOD(), 0, 0.04, 0, 16)
  cyl(spool, 0.35, 0.35, 0.5, M('#c08a4e'), 0, 0.33, 0, 12)
  cyl(spool, 0.7, 0.7, 0.08, WOOD(), 0, 0.62, 0, 16)
  g.add(spool)
  const straw = cyl(g, 1, 1, 0.04, STRAW(), 3.4, 0.02, 3.3, 12, false)
  straw.scale.set(1.3, 1, 0.6)
  // Water bucket by the tower.
  cyl(g, 0.22, 0.18, 0.36, METAL(), 4.7, 0.18, -0.6, 12)
  cyl(g, 0.2, 0.2, 0.02, M('#6fb0d6', { roughness: 0.05 }), 4.7, 0.33, -0.6, 12, false)
  shadowsOn(g)
  compact(g)
  return { g }
}

// --- 3. Bee hives ---------------------------------------------------------------------------------------------
// A row of n painted hive boxes on stands over ~14 x 4 m, a HONEY sign with a
// jar table, wildflowers, and a swarm of bees (one InstancedMesh) looping round
// the hives. update(dt, t, active): fewer, slower bees when inactive.
const HIVE_COLORS = ['#ffd23a', '#7fc8e8', '#ff9ab8', '#9ee0a8', '#ffa64a', '#c4a8f0']
let beeGeo = null
let beeMat = null
// One small geometry with vertex colours: yellow body, black bands, white wings.
function makeBeeGeo() {
  const parts = []
  const add = (geo, color, m) => {
    const x = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m)
    for (const n of Object.keys(x.attributes)) if (n !== 'position' && n !== 'normal') x.deleteAttribute(n)
    const c = new Color(color)
    const col = new Float32Array(x.attributes.position.count * 3)
    for (let i = 0; i < col.length; i += 3) {
      col[i] = c.r
      col[i + 1] = c.g
      col[i + 2] = c.b
    }
    x.setAttribute('color', new BufferAttribute(col, 3))
    parts.push(x)
  }
  const m = new Matrix4()
  add(new SphereGeometry(0.035, 8, 6), '#ffc21a', m.makeScale(1, 1, 1.5))
  for (const z of [-0.012, 0.016]) add(new CylinderGeometry(0.036, 0.036, 0.012, 8), '#1a1410', new Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, z))
  add(new SphereGeometry(0.025, 6, 4), '#1a1410', new Matrix4().makeTranslation(0, 0.005, 0.055))
  for (const s of [-1, 1]) add(new BoxGeometry(0.06, 0.004, 0.035), '#f4f8ff', new Matrix4().makeRotationZ(s * 0.35).setPosition(s * 0.035, 0.035, -0.005))
  return mergeGeometries(parts)
}
export function beeHives(n = 6) {
  const g = new Group()
  const span = 12
  const hives = []
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? -span / 2 + (i * span) / (n - 1) + 0.6 : 0.6
    const z = (i % 2 ? 0.4 : -0.3)
    hives.push([x, z])
    const h = g
    const blockAt = (w, hh, dd, mat, lx, y, lz, shadow = true) => block(h, w, hh, dd, mat, x + lx, y, z + lz, 0, shadow)
    // Stand: four legs and a slatted top.
    for (const [lx, lz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) blockAt(0.06, 0.42, 0.06, DARK_WOOD(), lx, 0, lz, false)
    blockAt(0.7, 0.06, 0.7, WOOD(), 0, 0.42, 0)
    // Brood box + 1-2 supers in pastel colours, the lid with a little tin gable.
    const c1 = HIVE_COLORS[i % HIVE_COLORS.length]
    const c2 = HIVE_COLORS[(i + 3) % HIVE_COLORS.length]
    blockAt(0.55, 0.34, 0.55, M(c1, { roughness: 0.7 }), 0, 0.48, 0)
    let y = 0.82
    const supers = 1 + (i % 2)
    for (let k = 0; k < supers; k++) {
      blockAt(0.56, 0.02, 0.56, CREAM(), 0, y, 0, false)
      blockAt(0.55, 0.2, 0.55, M(k % 2 ? c1 : c2, { roughness: 0.7 }), 0, y + 0.02, 0)
      y += 0.22
    }
    blockAt(0.64, 0.06, 0.64, CREAM(), 0, y, 0)
    prism(h, 0.66, 0.14, 0.66, M('#9aa3ab', { roughness: 0.4, metalness: 0.5 }), x, y + 0.06, z, Math.PI / 2)
    // Entrance slot and landing board on the front (-Z).
    blockAt(0.3, 0.035, 0.02, M('#1a1410'), 0, 0.5, -0.28, false)
    const lb = box(h, 0.36, 0.025, 0.14, WOOD(), x, 0.49, z - 0.33, 0, false)
    lb.rotation.x = -0.25
  }
  // Wildflowers among the hives (a few colours, merged by material).
  const r = mulberry32(777)
  const petals = ['#ff6a8a', '#ffd23a', '#ffffff', '#b07aff', '#ff9a3a']
  const stem = M('#5a8a34', { roughness: 0.9 })
  for (let i = 0; i < 46; i++) {
    const x = -7 + r() * 14
    const z = -1.8 + r() * 3.6
    if (hives.some(([hx, hz]) => Math.abs(hx - x) < 0.5 && Math.abs(hz - z) < 0.5)) continue
    const hgt = 0.2 + r() * 0.25
    block(g, 0.02, hgt, 0.02, stem, x, 0, z, 0, false)
    block(g, 0.09, 0.05, 0.09, M(petals[i % petals.length], { roughness: 0.6 }), x, hgt, z, r() * 3, false)
  }
  // HONEY sign on two posts at the west end, a jar table beside it.
  const sx = -6.8
  for (const s of [-1, 1]) block(g, 0.1, 1.6, 0.1, DARK_WOOD(), sx + s * 0.75, 0, -1.4)
  frontSign(g, 1.7, 0.6, signMat('HONEY', { bg: '#ffd23a', fg: '#7a4a10', border: '#7a4a10', size: 88 }), sx, 1.3, -1.46)
  block(g, 1.7, 0.08, 0.12, DARK_WOOD(), sx, 1.0, -1.4, 0, false)
  crate(g, 0.6, sx + 1.4, 0, -1.2)
  const jar = M('#e89a1a', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 })
  for (let k = 0; k < 4; k++) {
    const jx = sx + 1.22 + (k % 2) * 0.22
    const jz = -1.3 + Math.floor(k / 2) * 0.2
    cyl(g, 0.07, 0.07, 0.16, jar, jx, 0.68, jz, 10)
    cyl(g, 0.075, 0.075, 0.04, M('#f7f4ec'), jx, 0.78, jz, 10, false)
  }
  shadowsOn(g)

  // The swarm.
  beeGeo ??= makeBeeGeo()
  beeMat ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })
  const N = 48
  const MIN = 12
  const swarm = new InstancedMesh(beeGeo, beeMat, N)
  swarm.frustumCulled = false // they move; the swarm is tiny
  swarm.castShadow = false
  const sw = new Group()
  sw.userData.noCompact = true
  sw.add(swarm)
  g.add(sw)
  const rb = mulberry32(4242)
  const bees = Array.from({ length: N }, (_, i) => {
    const [hx, hz] = hives[i % hives.length] ?? [0, 0]
    return { hx, hz, ph: rb() * TAU, f1: 0.8 + rb() * 0.9, f2: 1.3 + rb() * 1.2, f3: 0.7 + rb() * 0.8, rx: 0.4 + rb() * 0.9, rz: 0.3 + rb() * 0.7, h: 0.9 + rb() * 0.8, dir: rb() < 0.5 ? -1 : 1 }
  })
  const dummy = new Object3D()
  let clock = 0
  let act = 1
  function update(dt, t, active = true) {
    act += ((active ? 1 : 0) - act) * Math.min(1, dt * 1.5)
    clock += dt * (0.35 + 0.65 * act)
    const count = Math.round(MIN + (N - MIN) * act)
    swarm.count = count
    for (let i = 0; i < count; i++) {
      const b = bees[i]
      const u = clock * b.f1 * b.dir + b.ph
      const x = b.hx + Math.sin(u) * b.rx + Math.sin(clock * b.f2 + b.ph) * 0.15
      const z = b.hz + Math.cos(u) * b.rz
      const y = b.h + Math.sin(clock * b.f3 * 2 + b.ph) * 0.25 + Math.sin(t * 40 + i) * 0.012
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, Math.atan2(Math.cos(u) * b.rx * b.dir, -Math.sin(u) * b.rz * b.dir), Math.sin(t * 9 + i) * 0.3)
      dummy.updateMatrix()
      swarm.setMatrixAt(i, dummy.matrix)
    }
    swarm.instanceMatrix.needsUpdate = true
  }
  compact(g)
  update(0, 0, true)
  return { g, update, swarm }
}

// --- 4. Apple tree ---------------------------------------------------------------------------------------------
// ~4.5 m orchard tree: trunk with two limbs, a round low-poly canopy and red
// apples. A template per variant (i % 3) is built and compacted once; every
// tree is a clone sharing its geometry (3 draw calls) plus one InstancedMesh of
// apples in `apples` (show / hide or scale it, or call setRipe(k) for green->red).
const treeTemplates = new Map()
const appleGeo = () => cachedMat('appleGeo', () => {
  const geo = new SphereGeometry(0.1, 8, 6)
  geo.scale(1, 0.9, 1)
  return geo
})
const appleMat = () => cachedMat('appleMat', () => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }))
const leafGeo = () => cachedMat('leafGeo', () => new IcosahedronGeometry(1, 1))
function treeTemplate(v) {
  let t = treeTemplates.get(v)
  if (t) return t
  const r = mulberry32(9100 + v * 57)
  const g = new Group()
  const bark = M('#6b4428', { roughness: 0.9, flatShading: true })
  const leafA = M('#4f9a3a', { roughness: 0.85, flatShading: true })
  const leafB = M('#6db544', { roughness: 0.85, flatShading: true })
  cy(g, 0.13, 0.2, 2.1, bark, 0, 1.05, 0, 8)
  for (const a of [0.4 + v, 2.6 + v, 4.4 + v]) tube(g, [0, 1.8, 0], [Math.cos(a) * 0.7, 2.6, Math.sin(a) * 0.7], 0.07, bark, 6)
  const canopyY = 3.05
  const blobs = [[0, canopyY, 0, 1.45, 0.85, leafA]]
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + r() * 0.6 + v
    blobs.push([Math.cos(a) * 0.95, canopyY - 0.15 + r() * 0.5, Math.sin(a) * 0.95, 0.85 + r() * 0.2, 0.8, k % 2 ? leafA : leafB])
  }
  blobs.push([r() * 0.3 - 0.15, canopyY + 0.75, r() * 0.3 - 0.15, 0.85, 0.85, leafB])
  for (const [x, y, z, s, sy, mat] of blobs) {
    const m = new Mesh(leafGeo(), mat)
    m.position.set(x, y, z)
    m.scale.set(s, s * sy, s)
    m.rotation.y = r() * 3
    g.add(m)
  }
  compact(g)
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  // Apple spots on the canopy's outer shell (mostly the lower, sunny half).
  // Each apple sits where a ray from the canopy centre leaves the outermost blob.
  const spots = []
  for (let k = 0; k < 16; k++) {
    const a = r() * TAU
    const e = -0.45 + r() * 0.9 // elevation
    const dx = Math.cos(a) * Math.cos(e)
    const dy = Math.sin(e)
    const dz = Math.sin(a) * Math.cos(e)
    let best = 0
    for (const [bx0, by0, bz0, bs, bsy] of blobs) {
      const ry = bs * bsy * 0.97 // icosahedron faces sit a little inside the radius
      const rr = bs * 0.97
      const ox = -bx0 / rr
      const oy = (canopyY - by0) / ry
      const oz = -bz0 / rr
      const ex = dx / rr
      const ey = dy / ry
      const ez = dz / rr
      const qa = ex * ex + ey * ey + ez * ez
      const qb = 2 * (ox * ex + oy * ey + oz * ez)
      const qc = ox * ox + oy * oy + oz * oz - 1
      const disc = qb * qb - 4 * qa * qc
      if (disc >= 0) best = Math.max(best, (-qb + Math.sqrt(disc)) / (2 * qa))
    }
    const R = best + 0.02
    spots.push([dx * R, canopyY + dy * R, dz * R])
  }
  t = { g, spots }
  treeTemplates.set(v, t)
  return t
}
const GREEN_APPLE = new Color('#8cc43a')
const RED_APPLE = new Color('#d8282a')
const tmpC = new Color()
export function appleTree(i = 0) {
  const tpl = treeTemplate(i % 3)
  const g = tpl.g.clone()
  g.rotation.y = (i * 1.37) % TAU
  const s = 0.92 + ((i * 7) % 5) * 0.04
  g.scale.setScalar(s)
  const apples = new Group()
  apples.userData.noCompact = true
  const inst = new InstancedMesh(appleGeo(), appleMat(), tpl.spots.length)
  inst.castShadow = true
  apples.add(inst)
  g.add(apples)
  const dummy = new Object3D()
  function setRipe(k) {
    k = Math.max(0, Math.min(1, k))
    tmpC.copy(GREEN_APPLE).lerp(RED_APPLE, k)
    tpl.spots.forEach(([x, y, z], j) => {
      dummy.position.set(x, y, z)
      dummy.scale.setScalar(0.45 + 0.55 * k)
      dummy.updateMatrix()
      inst.setMatrixAt(j, dummy.matrix)
      inst.setColorAt(j, tmpC)
    })
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    inst.computeBoundingSphere()
  }
  setRipe(1)
  return { g, apples, setRipe }
}

// --- 5. Greenhouse -------------------------------------------------------------------------------------------
// 16 x 10 m: white frame, shared glass panels, ridge roof along X, a sliding
// glass door in the front (-Z) gable side, a concrete aisle and six raised
// planters of staked tomato plants. setRipe(0..1) grows the tomatoes and lerps
// their (own, shared) material from green to red.
let ghGlass = null
const greenhouseGlass = () =>
  // Rough enough that the sun's highlight never blooms; faint so the plants read through it.
  (ghGlass ??= new MeshStandardMaterial({ color: '#e4f4ee', roughness: 0.35, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 0.5, depthWrite: false }))
export function greenhouse() {
  const g = new Group()
  const W = 16
  const D = 10
  const H = 2.6
  const RISE = 1.9
  const frame = M('#f4f6f4', { roughness: 0.4, metalness: 0.2 })
  const glassM = greenhouseGlass()
  const f = 0.08
  // Foundation kerb and floor.
  block(g, W + 0.2, 0.25, D + 0.2, M('#b9b6ae', { roughness: 0.9 }), 0, 0, 0)
  block(g, W - 0.2, 0.04, D - 0.2, M('#7a5a3a', { roughness: 1 }), 0, 0.25, 0, 0, false)
  block(g, 1.6, 0.05, D - 0.2, M('#cfccc4', { roughness: 0.9 }), 0, 0.27, 0, 0, false) // aisle
  const y0 = 0.25
  // Long walls (front -Z and back +Z): posts every 2 m, a sill and an eave beam, glass.
  for (const s of [-1, 1]) {
    const z = s * D / 2
    for (let i = 0; i <= 8; i++) if (s > 0 || i !== 4) block(g, f, H, f, frame, -W / 2 + i * 2, y0, z, 0, false)
    if (s > 0) block(g, W, f, f, frame, 0, y0 + 0.9, z, 0, false)
    else for (const k of [-1, 1]) block(g, W / 2 - 1.1, f, f, frame, k * (W / 4 + 0.55), y0 + 0.9, z, 0, false)
    if (s < 0) for (const k of [-1, 1]) block(g, f, 2.2, f, frame, k * 1.1, y0, z, 0, false) // door jambs
    block(g, W, f, f, frame, 0, y0 + H - f, z, 0, false)
    if (s > 0) block(g, W, H, 0.02, glassM, 0, y0, z)
    else {
      // Front: glass either side of the door opening.
      const half = (W - 2.2) / 2
      for (const k of [-1, 1]) block(g, half, H, 0.02, glassM, k * (1.1 + half / 2), y0, z)
      block(g, 2.2, H - 2.2, 0.02, glassM, 0, y0 + 2.2, z)
    }
  }
  // Gable ends (x = +-W/2): posts, glass walls, glass triangles.
  for (const s of [-1, 1]) {
    const x = s * W / 2
    for (let i = 0; i <= 5; i++) block(g, f, H, f, frame, x, y0, -D / 2 + i * 2, 0, false)
    block(g, f, f, D, frame, x, y0 + 0.9, 0, 0, false)
    block(g, 0.02, H, D, glassM, x, y0, 0)
    prism(g, D, RISE, 0.02, glassM, x, y0 + H, 0, Math.PI / 2)
    for (const k of [-1, 1]) {
      const rl = Math.hypot(D / 2, RISE)
      const r = box(g, f, f, rl, frame, x, y0 + H + RISE / 2, (k * D) / 4)
      r.rotation.x = k * Math.atan2(RISE, D / 2)
    }
    block(g, f, RISE, f, frame, x, y0 + H, 0, 0, false)
  }
  // Roof: two glass slopes, rafters every 2 m, ridge beam with a vent strip.
  const pitch = Math.atan2(RISE, D / 2)
  const sl = Math.hypot(D / 2, RISE)
  for (const k of [-1, 1]) {
    const p = box(g, W, 0.02, sl, glassM, 0, y0 + H + RISE / 2, (k * D) / 4)
    p.rotation.x = k * pitch
    for (let i = 1; i < 8; i++) {
      const r = box(g, f, f, sl, frame, -W / 2 + i * 2, y0 + H + RISE / 2 + 0.04, (k * D) / 4)
      r.rotation.x = k * pitch
    }
  }
  block(g, W + 0.1, 0.14, 0.18, frame, 0, y0 + H + RISE - 0.06, 0, 0, false)
  // Sliding door (glass in a frame) slid half open.
  const door = new Group()
  door.position.set(-0.55, y0, -D / 2 - 0.08)
  block(door, 1.1, 2.2, 0.03, glassM, 0, 0, 0)
  for (const x of [-0.53, 0.53]) block(door, 0.06, 2.2, 0.06, frame, x, 0, 0, 0, false)
  for (const y of [0, 1.0, 2.14]) block(door, 1.1, 0.06, 0.06, frame, 0, y, 0, 0, false)
  g.add(door)
  block(g, 2.6, 0.08, 0.08, METAL(), 0, y0 + 2.25, -D / 2 - 0.1, 0, false) // door track
  frontSign(g, 3.2, 0.7, signMat('GREENHOUSE', { fg: '#2f7a3a', border: '#2f7a3a', size: 72 }), 0, y0 + H + 0.55, -D / 2 - 0.03)
  // Planters: six raised beds along Z (three each side of the aisle), staked tomato plants.
  const plantX = [-6.2, -4.1, -2.0, 2.0, 4.1, 6.2]
  const bedL = D - 2.0
  const leafA = M('#3f7f2e', { roughness: 0.85, flatShading: true })
  const leafB = M('#5a9a3a', { roughness: 0.85, flatShading: true })
  const stake = M('#c9a46a', { roughness: 0.9 })
  const tomatoSpots = []
  const r = mulberry32(5150)
  for (const px of plantX) {
    block(g, 1.1, 0.5, bedL, WOOD(), px, y0, 0)
    block(g, 1.0, 0.04, bedL - 0.1, M('#4a3020', { roughness: 1 }), px, y0 + 0.49, 0, 0, false)
    for (let k = 0; k < 6; k++) {
      const z = -bedL / 2 + 0.7 + (k * (bedL - 1.4)) / 5
      const base = y0 + 0.52
      block(g, 0.03, 1.5, 0.03, stake, px, base, z, 0, false)
      for (const [ly, ls, m] of [[0.45, 0.32, leafA], [0.85, 0.3, leafB], [1.2, 0.24, leafA]]) {
        const l = new Mesh(leafGeo(), m)
        l.position.set(px + (r() - 0.5) * 0.1, base + ly, z + (r() - 0.5) * 0.1)
        l.scale.set(ls, ls * 1.15, ls)
        l.rotation.y = r() * 3
        g.add(l)
      }
      for (let j = 0; j < 5; j++) {
        const a = r() * TAU
        tomatoSpots.push([px + Math.cos(a) * 0.27, base + 0.35 + r() * 0.85, z + Math.sin(a) * 0.27])
      }
    }
  }
  // Potting bench and watering can along the back, overhead irrigation line, hanging lamps.
  block(g, 3, 0.9, 0.7, DARK_WOOD(), -5.6, y0, D / 2 - 0.6)
  for (let k = 0; k < 5; k++) cy(g, 0.1, 0.08, 0.16, M('#c8643a', { roughness: 0.8 }), -6.8 + k * 0.6, y0 + 0.98, D / 2 - 0.6, 10)
  cy(g, 0.15, 0.17, 0.3, M('#3f8a4a', { roughness: 0.5, metalness: 0.3 }), 5.8, y0 + 0.15, D / 2 - 0.7, 12)
  for (const px of plantX) block(g, 0.04, 0.04, bedL, M('#2a2c30'), px, y0 + H - 0.3, 0, 0, false)
  for (const x of [-4, 4]) box(g, 0.4, 0.12, 0.4, E('#fff2d0', 1.2), x, y0 + H + 0.4, 0, 0, false)
  shadowsOn(g)
  // The glass casts no shadow.
  g.traverse((o) => {
    if (o.isMesh && o.material === glassM) o.castShadow = false
  })
  // Tomatoes: one InstancedMesh with its own material.
  const tomatoMat = new MeshStandardMaterial({ color: '#d83a22', roughness: 0.35 })
  const tom = new InstancedMesh(cachedMat('tomGeo', () => new SphereGeometry(0.07, 8, 6)), tomatoMat, tomatoSpots.length)
  tom.castShadow = false
  const tg = new Group()
  tg.userData.noCompact = true
  tg.add(tom)
  g.add(tg)
  const dummy = new Object3D()
  const GREEN = new Color('#7ab83a')
  const RED = new Color('#e0321e')
  function setRipe(k) {
    k = Math.max(0, Math.min(1, k))
    tomatoMat.color.copy(GREEN).lerp(RED, k * k)
    tomatoSpots.forEach(([x, y, z], j) => {
      dummy.position.set(x, y, z)
      dummy.scale.setScalar(0.5 + 0.6 * k)
      dummy.updateMatrix()
      tom.setMatrixAt(j, dummy.matrix)
    })
    tom.instanceMatrix.needsUpdate = true
    tom.computeBoundingSphere()
  }
  compact(g)
  setRipe(1)
  return { g, setRipe, door }
}

// --- 6. Fishing dock -----------------------------------------------------------------------------------------
// A 3 m wide jetty running 10 m out along +X (land end at the origin, deck top
// at y = 0.5), posts down into the water, a bench, a bait bucket, a rod rack,
// a life ring and a ladder at the end. tip = where the angler stands.
export function fishingDock() {
  const g = new Group()
  const L = 10
  const Wd = 3
  const deckY = 0.5
  const plank = M('#a7774a', { roughness: 0.85 })
  const plank2 = M('#9a6a3e', { roughness: 0.85 })
  const postM = M('#6e4122', { roughness: 0.9 })
  // Deck planks across the jetty (along Z), with gaps; two stringers under them.
  const pw = 0.28
  const n = Math.floor(L / (pw + 0.04))
  for (let i = 0; i < n; i++) block(g, pw, 0.06, Wd, i % 3 === 1 ? plank2 : plank, 0.2 + i * (pw + 0.04), deckY - 0.06, 0, 0, false)
  for (const s of [-1, 1]) block(g, L, 0.18, 0.14, postM, L / 2, deckY - 0.24, s * (Wd / 2 - 0.2), 0, false)
  block(g, L, 0.18, 0.14, postM, L / 2, deckY - 0.24, 0, 0, false)
  // A step up from the bank at the land end.
  block(g, 0.4, 0.22, 2.2, plank2, -0.25, 0, 0)
  // Posts every 2.5 m on both sides, from the lake bed up past the deck (the end ones as bollards).
  for (let i = 0; i <= 4; i++) {
    const x = 0.2 + i * 2.45
    for (const s of [-1, 1]) {
      const top = i === 4 || i === 0 ? deckY + 0.45 : deckY + 0.05
      cyl(g, 0.12, 0.13, top + 1.6, postM, x, (top - 1.6) / 2, s * (Wd / 2 + 0.05), 8)
    }
  }
  // Bench (facing +Z, the water side), midway out.
  const bx = 5
  const bz = 0.9
  for (const s of [-1, 1]) block(g, 0.08, 0.42, 0.4, postM, bx + s * 0.7, deckY, bz)
  block(g, 1.6, 0.06, 0.45, plank, bx, deckY + 0.42, bz)
  block(g, 1.6, 0.35, 0.05, plank, bx, deckY + 0.55, bz - 0.24)
  // Bait bucket near the end, with a handle.
  cyl(g, 0.17, 0.14, 0.32, M('#3a7ac8', { roughness: 0.5 }), 8.6, deckY + 0.16, 0.9, 12)
  cyl(g, 0.15, 0.15, 0.02, M('#5a4a3a', { roughness: 1 }), 8.6, deckY + 0.29, 0.9, 12)
  tube(g, [8.43, deckY + 0.32, 0.9], [8.6, deckY + 0.5, 0.9], 0.008, METAL(), 4)
  tube(g, [8.6, deckY + 0.5, 0.9], [8.77, deckY + 0.32, 0.9], 0.008, METAL(), 4)
  // Tackle box.
  rbox(g, 0.42, 0.2, 0.24, 0.03, M('#2f7a3a', { roughness: 0.4 }), 8.0, deckY + 0.1, 1.05, 2)
  // Rod rack at the land end: a frame with three rods leaning on it.
  const rx = 1.0
  const rz = -1.05
  for (const s of [-1, 1]) block(g, 0.08, 1.4, 0.08, postM, rx + s * 0.6, deckY, rz)
  block(g, 1.3, 0.08, 0.12, plank2, rx, deckY + 1.2, rz)
  block(g, 1.3, 0.1, 0.25, plank2, rx, deckY, rz + 0.05)
  const rod = M('#2a2c30', { roughness: 0.4 })
  for (let k = 0; k < 3; k++) {
    const x = rx - 0.4 + k * 0.4
    tube(g, [x, deckY + 0.08, rz + 0.08], [x + 0.05, deckY + 2.3, rz - 0.1], 0.015, rod, 5)
    cy(g, 0.03, 0.03, 0.06, METAL(), x + 0.04, deckY + 0.5, rz + 0.1, 8, 'x') // reel
    cy(g, 0.025, 0.025, 0.3, M('#c8302a'), x + 0.005, deckY + 0.25, rz + 0.07, 6) // grip
  }
  // Life ring on the end post, a ladder down the end.
  const lr = new Mesh(cachedMat('lifeRing', () => new TorusGeometry(0.28, 0.07, 8, 20)), M('#ff6a2a', { roughness: 0.5 }))
  lr.position.set(L - 0.15, deckY + 0.25, -Wd / 2 - 0.2)
  g.add(lr)
  for (const s of [-1, 1]) block(g, 0.05, 1.4, 0.05, METAL(), L + 0.05, deckY - 1.3, s * 0.25, 0, false)
  for (let k = 0; k < 4; k++) block(g, 0.05, 0.04, 0.5, METAL(), L + 0.05, deckY - 1.1 + k * 0.35, 0, 0, false)
  shadowsOn(g)
  compact(g)
  return { g, tip: [L - 0.6, deckY, 0] }
}

// --- 7. Lake ---------------------------------------------------------------------------------------------------
// A pond of about w x d (along X x Z) with a wobbly organic outline: a sandy
// bank, a dark bed seen through glossy, slightly transparent water with
// scrolling ripples, reeds / cattails round the edge, rocks and lily pads that
// bob. update(dt, t) animates. Water top at y = waterY.
function wobblyShape(rx, rz, seed, n = 56) {
  const r = mulberry32(seed)
  const p1 = r() * TAU
  const p2 = r() * TAU
  const p3 = r() * TAU
  const shape = new Shape()
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const k = 1 + Math.sin(a * 3 + p1) * 0.07 + Math.sin(a * 5 + p2) * 0.04 + Math.sin(a * 2 + p3) * 0.05
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k])
  }
  shape.moveTo(pts[0][0], pts[0][1])
  for (const p of pts.slice(1)) shape.lineTo(p[0], p[1])
  shape.closePath()
  return { shape, pts }
}
export function lake(w = 20, d = 14, seed = 11) {
  const g = new Group()
  const rx = w / 2
  const rz = d / 2
  const flat = (geo, mat, y) => {
    const m = new Mesh(geo, mat)
    m.rotation.x = -Math.PI / 2
    m.position.y = y
    m.receiveShadow = true
    g.add(m)
    return m
  }
  // Sandy bank 1.6 m wider, then a dark bed, then the water.
  flat(new ShapeGeometry(wobblyShape(rx + 1.6, rz + 1.6, seed).shape, 2), M('#d6c08a', { roughness: 1 }), 0.03)
  const { shape, pts } = wobblyShape(rx, rz, seed)
  flat(new ShapeGeometry(wobblyShape(rx * 0.8, rz * 0.8, seed).shape, 2), M('#2e5a5e', { roughness: 1 }), 0.05)
  const normal = toTexture(paintWaterNormal(), { repeat: 1 })
  normal.repeat.set(0.18, 0.18) // ShapeGeometry uvs are in metres
  const waterY = 0.1
  const waterMat = new MeshPhysicalMaterial({ color: '#3f8fbf', roughness: 0.12, metalness: 0, normalMap: normal, normalScale: new Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.82 })
  const water = flat(new ShapeGeometry(shape, 2), waterMat, waterY)
  water.castShadow = false
  // Reeds and cattails in clumps round the edge (the -X side stays open for a dock).
  const r = mulberry32(seed * 7 + 3)
  const reed = M('#5a8a34', { roughness: 0.9 })
  const reed2 = M('#7a9a3a', { roughness: 0.9 })
  const cattail = M('#6b4024', { roughness: 0.9 })
  const nClumps = Math.max(6, Math.round((w + d) / 3))
  for (let c = 0; c < nClumps; c++) {
    const [px, pz] = pts[Math.floor(r() * pts.length)]
    if (px < -rx * 0.6 && Math.abs(pz) < rz * 0.5) continue
    for (let k = 0; k < 7; k++) {
      const x = px * (0.96 + r() * 0.1) + (r() - 0.5) * 0.6
      const z = -pz * (0.96 + r() * 0.1) + (r() - 0.5) * 0.6
      const h = 0.6 + r() * 0.9
      const b = box(g, 0.04, h, 0.04, k % 2 ? reed : reed2, x, h / 2, z, 0, false)
      b.rotation.z = (r() - 0.5) * 0.3
      b.rotation.x = (r() - 0.5) * 0.2
      if (r() < 0.4) box(g, 0.08, 0.22, 0.08, cattail, x - Math.sin(b.rotation.z) * h * 0.5, h * 0.95, z, 0, false)
    }
  }
  // Rocks on the bank.
  for (let i = 0; i < Math.round((w + d) / 5); i++) {
    const [px, pz] = pts[Math.floor(r() * pts.length)]
    const rock = cyl(g, 0.25 + r() * 0.35, 0.4 + r() * 0.35, 0.35, M('#8f8a80', { flatShading: true }), px * 1.08, 0.12, -pz * 1.08, 6)
    rock.rotation.y = r() * 3
  }
  // Lily pads (a notched disc) with a few flowers, bobbing as one group.
  const pads = new Group()
  pads.position.y = waterY + 0.015
  const padGeo = cachedMat('padGeo', () => new CircleGeometry(1, 12, 0.3, TAU - 0.6))
  const padMat = M('#4f9a3a', { roughness: 0.6, side: DoubleSide })
  const nPads = Math.max(5, Math.round((w * d) / 25))
  for (let i = 0; i < nPads; i++) {
    const a = r() * TAU
    const k = 0.25 + r() * 0.5
    const s = 0.3 + r() * 0.3
    const p = new Mesh(padGeo, padMat)
    p.rotation.set(-Math.PI / 2, 0, r() * TAU)
    p.scale.setScalar(s)
    p.position.set(Math.cos(a) * rx * k, 0, Math.sin(a) * rz * k)
    p.receiveShadow = true
    pads.add(p)
    if (r() < 0.35) sph(pads, 0.08, M('#ff9ac8', { roughness: 0.5 }), p.position.x, 0.04, p.position.z, 1, 0.6, 1, 8)
  }
  g.add(pads)
  compact(g)
  g.traverse((o) => {
    if (o.isMesh && o.parent === g && o.geometry.type !== 'ShapeGeometry') o.castShadow = true
  })
  const padY = pads.position.y
  function update(dt, t) {
    normal.offset.set(t * 0.012, t * 0.017)
    pads.position.y = padY + Math.sin(t * 0.9) * 0.012
    pads.rotation.y = Math.sin(t * 0.07) * 0.02
  }
  return { g, update, waterY, rx, rz }
}

// --- 8. Trophy shelf -------------------------------------------------------------------------------------------
// A wooden display cabinet 3 m wide, 2.2 m tall, 0.6 m deep (open front -Z):
// three shelves of four slots each, a brass plaque under every slot. All twelve
// cups are pre-built (one merged mesh each); setTrophies(list) toggles them and
// swaps their metal (gold / silver / bronze / null = empty).
let cupGeo = null
function makeCupGeo() {
  const bowl = new LatheGeometry([[0.001, 0], [0.09, 0], [0.09, 0.03], [0.03, 0.05], [0.025, 0.14], [0.05, 0.17], [0.11, 0.24], [0.13, 0.36], [0.12, 0.36], [0.1, 0.25], [0.001, 0.2]].map(([x, y]) => new Vector2(x, y)), 18)
  const parts = [bowl]
  for (const s of [-1, 1]) {
    const h = new TorusGeometry(0.06, 0.012, 6, 12, Math.PI)
    h.rotateZ(-Math.PI / 2)
    h.translate(0.12, 0.29, 0)
    if (s < 0) h.rotateY(Math.PI)
    parts.push(h)
  }
  const base = new BoxGeometry(0.2, 0.06, 0.2)
  base.translate(0, -0.03, 0)
  parts.push(base)
  for (const p of parts) {
    for (const n of Object.keys(p.attributes)) if (n !== 'position' && n !== 'normal') p.deleteAttribute(n)
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))
}
const TROPHY_MATS = {
  gold: () => M('#e8b830', { roughness: 0.22, metalness: 0.9 }),
  silver: () => M('#d8dde2', { roughness: 0.2, metalness: 0.9 }),
  bronze: () => M('#c07a40', { roughness: 0.3, metalness: 0.85 }),
}
export function trophyShelf() {
  const g = new Group()
  const W = 3
  const H = 2.2
  const D = 0.6
  const wood = M('#8a5530', { roughness: 0.7 })
  const dark = M('#5a3420', { roughness: 0.7 })
  const back = M('#3a2a3a', { roughness: 0.9 }) // velvet backing
  // Carcass: sides, back, plinth, crown, shelves, two mullions.
  for (const s of [-1, 1]) block(g, 0.08, H, D, wood, s * (W / 2 - 0.04), 0, 0)
  block(g, W - 0.16, H - 0.25, 0.04, back, 0, 0.15, D / 2 - 0.04)
  block(g, W, 0.15, D, dark, 0, 0, 0)
  block(g, W + 0.14, 0.12, D + 0.1, dark, 0, H - 0.04, -0.03)
  block(g, W, 0.06, D + 0.04, wood, 0, H - 0.1, 0)
  const shelfY = [0.15, 0.82, 1.49] // surfaces the cups stand on
  for (const y of shelfY) block(g, W - 0.16, 0.05, D - 0.06, wood, 0, y - 0.05, 0.0)
  for (const x of [-0.75, 0, 0.75]) block(g, 0.04, H - 0.25, 0.04, dark, x, 0.15, -D / 2 + 0.04, 0, false)
  frontSign(g, 1.3, 0.24, signMat('TROPHIES', { w: 512, h: 96, bg: '#5a3420', fg: '#f2c230', border: '#f2c230', size: 64 }), 0, H - 0.05, -D / 2 - 0.09)
  // Plaques under each slot.
  const plaque = M('#c9a14a', { roughness: 0.3, metalness: 0.7 })
  const slots = []
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < 4; c++) {
      const x = W / 2 - 0.08 - (W - 0.16) * ((c + 0.5) / 4) // slot 0 = the viewer's left (front faces -Z)
      const y = shelfY[2 - row]
      block(g, 0.3, 0.06, 0.01, plaque, x, y - 0.05, -D / 2 + 0.015, 0, false)
      slots.push([x, y, 0.02])
    }
  }
  shadowsOn(g)
  // The cups (top row first, left to right as seen from the front): one mesh each, own group so compaction leaves them.
  cupGeo ??= makeCupGeo()
  const cups = new Group()
  cups.userData.noCompact = true
  const meshes = slots.map(([x, y, z]) => {
    const m = new Mesh(cupGeo, TROPHY_MATS.gold())
    m.position.set(x, y + 0.06, z)
    m.scale.setScalar(1.15)
    m.castShadow = true
    m.userData.keep = true
    m.visible = false
    cups.add(m)
    return m
  })
  compact(g)
  g.add(cups)
  function setTrophies(list = []) {
    meshes.forEach((m, i) => {
      const kind = list[i]
      const mk = kind && TROPHY_MATS[kind]
      m.visible = !!mk
      if (mk) m.material = mk()
    })
  }
  return { g, setTrophies, slots: slots.length }
}

// --- 9. Festival stall ---------------------------------------------------------------------------------------
// A ~3 x 2 m market stall: counter at the front (-Z), back posts, a sloping
// striped awning in `color` with a scalloped valance, pumpkins, pies and a
// chalkboard price sign.
export function festivalStall(color = '#e23a35') {
  const g = new Group()
  const W = 3
  const D = 2
  const wood = WOOD()
  const post = DARK_WOOD()
  // Counter: a panelled box at the front, a top board.
  block(g, W, 0.95, 0.6, M(color, { roughness: 0.7 }), 0, 0, -D / 2 + 0.3)
  block(g, W + 0.1, 0.06, 0.75, wood, 0, 0.95, -D / 2 + 0.3)
  for (const x of [-1, 0, 1]) block(g, 0.86, 0.6, 0.02, CREAM(), x, 0.18, -D / 2 - 0.005, 0, false)
  // Back table, posts (front ones shorter: the awning slopes to the front).
  block(g, W - 0.2, 0.75, 0.5, wood, 0, 0, D / 2 - 0.35)
  const HF = 2.2
  const HB = 2.6
  for (const s of [-1, 1]) {
    block(g, 0.1, HF, 0.1, post, s * (W / 2 - 0.05), 0, -D / 2 + 0.05)
    block(g, 0.1, HB, 0.1, post, s * (W / 2 - 0.05), 0, D / 2 - 0.05)
  }
  // Awning: one striped panel sloping from the back to the front, and a scalloped valance.
  const aw = awningMat(color)
  const slope = Math.atan2(HB - HF, D)
  const al = Math.hypot(D, HB - HF) + 0.5
  const panel = box(g, W + 0.3, 0.04, al, aw, 0, (HF + HB) / 2 + 0.06, -0.2)
  panel.rotation.x = -slope
  const n = 8
  const scallop = cachedMat('scallop', () => new CircleGeometry(0.19, 10, Math.PI, Math.PI))
  for (let i = 0; i < n; i++) {
    const m = new Mesh(scallop, M(i % 2 ? '#fbf6ee' : color, { roughness: 0.8, side: DoubleSide }))
    m.position.set(-W / 2 - 0.15 + ((i + 0.5) * (W + 0.3)) / n, HF + 0.04, -D / 2 - 0.45)
    m.rotation.y = Math.PI
    m.castShadow = true
    g.add(m)
  }
  // Goods: pumpkins and pies on the counter, more pumpkins on the ground.
  for (const [x, rr, c] of [[-1.15, 0.2, '#ee7a1f'], [-0.75, 0.15, '#f29a2a'], [1.2, 0.18, '#ee7a1f']]) pump(g, x, -D / 2 + 0.3, rr, c, 0.98)
  const crust = M('#d9a05a', { roughness: 0.8 })
  const fill = M('#b85a1e', { roughness: 0.6 })
  for (const [x, z] of [[-0.25, -0.85], [0.2, -0.75], [0.62, -0.85], [0.0, -0.6]]) {
    cy(g, 0.17, 0.14, 0.06, crust, x, 1.01, z, 14)
    cy(g, 0.15, 0.15, 0.02, fill, x, 1.045, z, 14)
  }
  for (const [x, z, rr] of [[-1.7, -1.2, 0.3], [-1.9, -0.6, 0.24], [1.75, -1.15, 0.28]]) pump(g, x, z, rr)
  // Crates of apples on the back table.
  for (const x of [-0.8, 0.4]) {
    crate(g, 0.45, x, 0.75, D / 2 - 0.35)
    for (let k = 0; k < 5; k++) sph(g, 0.07, M('#d8282a', { roughness: 0.45 }), x - 0.12 + (k % 3) * 0.12, 1.24, D / 2 - 0.42 + Math.floor(k / 3) * 0.14, 1, 0.9, 1, 8)
  }
  // Chalkboard price sign on an easel by the front-right corner.
  const board = signMaterial(signCanvas(256, 320, { bg: '#2a2f2a', border: '#8a5530', borderWidth: 14, radius: 8, lines: [{ text: 'PIES', size: 64, color: '#f7f4ec' }, { text: '& PUMPKINS', size: 34, color: '#ffd23a' }, { text: '$5', size: 70, color: '#f7f4ec' }] }))
  const easel = new Group()
  easel.position.set(1.95, 0, -1.4)
  easel.rotation.y = 0.35
  const bp = signPanel(easel, 0.6, 0.75, board, 0, 0.75, -0.02, Math.PI)
  bp.rotation.x = -0.15
  for (const s of [-1, 1]) tube(easel, [s * 0.28, 0, -0.1], [s * 0.25, 1.15, 0.05], 0.02, post, 5)
  tube(easel, [0, 0, 0.45], [0, 1.1, 0.05], 0.02, post, 5)
  g.add(easel)
  shadowsOn(g)
  compact(g)
  return { g }
}

// --- 10. Bunting --------------------------------------------------------------------------------------------
// A string of triangular flags between two posts along +X (posts at x = 0 and
// x = length), the line sagging in the middle. Flags alternate color1 / color2
// with a cream one every third.
let flagGeo = null
export function bunting(length = 10, color2 = '#2f6fd0', color1 = '#e23a35') {
  const g = new Group()
  const H = 3.2
  const sag = Math.min(0.8, length * 0.06)
  const post = DARK_WOOD()
  for (const x of [0, length]) {
    block(g, 0.12, H + 0.1, 0.12, post, x, 0, 0)
    sph(g, 0.09, M('#f2c230', { roughness: 0.4, metalness: 0.4 }), x, H + 0.15, 0, 1, 1, 1, 8)
  }
  const lineY = (x) => H - sag * (1 - ((2 * x) / length - 1) ** 2)
  const segs = Math.max(4, Math.round(length / 1.2))
  const rope = M('#f4f0e6', { roughness: 0.8 })
  for (let i = 0; i < segs; i++) {
    const x0 = (i * length) / segs
    const x1 = ((i + 1) * length) / segs
    tube(g, [x0, lineY(x0), 0], [x1, lineY(x1), 0], 0.012, rope, 4)
  }
  if (!flagGeo) {
    flagGeo = new BufferGeometry()
    flagGeo.setAttribute('position', new Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.4, 0], 3))
    flagGeo.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  }
  const cols = [color1, color2, '#fbf6ee']
  const nf = Math.max(2, Math.floor((length - 0.4) / 0.48))
  for (let i = 0; i < nf; i++) {
    const x = 0.2 + ((i + 0.5) * (length - 0.4)) / nf
    const m = new Mesh(flagGeo, M(cols[i % 3], { roughness: 0.75, side: DoubleSide }))
    m.position.set(x, lineY(x) - 0.01, 0)
    m.rotation.z = Math.atan(((-sag * -2 * ((2 * x) / length - 1) * 2) / length)) * 0.6
    m.castShadow = true
    g.add(m)
  }
  shadowsOn(g)
  compact(g)
  return { g }
}
