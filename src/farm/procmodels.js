import { Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, LatheGeometry, Matrix4, MeshStandardMaterial, Vector2 } from 'three'
import { E, M, block, box, cyl, gableRoof, prism, signCanvas, signMaterial, signPanel } from './kit.js'
import { arc, bx, cy, extrude, lathe, metal, paint, rbox, ring, sph, tube } from './detail.js'
import { paintCorrugated, paintSiding, tex } from './textures.js'
import { mulberry32 } from '../textures.js'

// The processing buildings: the flour mill (a tower windmill), the bakery, the
// dairy, the juice press and the oil refinery. Each builder returns
//   { g, update(dt, t, running, fx), setLevel(n), crate: [lx, lz] }
// g: origin on the ground at the footprint centre, the front (doors, signs, the
// machine on show) facing -Z. Static parts use the cached kit materials so the
// gate's compact() merges them per material; every moving part is its own
// group (animated only through its transform), and the few glowing parts that
// change brightness have their own material instances. setLevel(0..4) shows
// pre-built extras (more stock, a second machine, lights, a brighter sign).
// fx: { puff, burst, wx, wz } (particles.js) or null; positions are world.

const PI = Math.PI
const TAU = PI * 2
const _m = new Matrix4()

// --- Materials ----------------------------------------------------------------------------------------
const texMats = new Map()
const texMat = (key, make) => {
  let m = texMats.get(key)
  if (!m) texMats.set(key, (m = make()))
  return m
}
const sidingMat = (color, rx = 4, ry = 1) =>
  texMat(`s${color}|${rx}|${ry}`, () => new MeshStandardMaterial({ color, map: tex(paintSiding(256, 8, 991), rx, ry), roughness: 0.85 }))
const tinMat = (color, rx = 6, ry = 2) =>
  texMat(`t${color}|${rx}|${ry}`, () => new MeshStandardMaterial({ color, map: tex(paintCorrugated(128, 8), rx, ry), roughness: 0.45, metalness: 0.35 }))

// Red brick with cream mortar: 8 courses of running bond per tile (a tile ~2 x 2 m at rx = width / 2).
let brickCanvas = null
function paintBrick() {
  if (brickCanvas) return brickCanvas
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#d9cdb6'
  ctx.fillRect(0, 0, s, s)
  const rand = mulberry32(4242)
  const rows = 8
  const per = 4
  const bh = s / rows
  const bw = s / per
  for (let r = 0; r < rows; r++) {
    for (let i = -1; i <= per; i++) {
      const x = i * bw + (r % 2 ? bw / 2 : 0)
      const k = 0.82 + rand() * 0.3
      ctx.fillStyle = `rgb(${Math.min(255, 178 * k) | 0},${(86 * k) | 0},${(60 * k) | 0})`
      ctx.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6)
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(x + 3, r * bh + bh - 7, bw - 6, 4)
    }
  }
  return (brickCanvas = c)
}
const brickMat = (rx, ry, tint = '#ffffff') =>
  texMat(`b${rx}|${ry}|${tint}`, () => new MeshStandardMaterial({ color: tint, map: tex(paintBrick(), rx, ry), roughness: 0.9 }))

// Yellow / black hazard stripes.
let hazardM = null
function hazardMat() {
  if (hazardM) return hazardM
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 32
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f2c230'
  ctx.fillRect(0, 0, 128, 32)
  ctx.fillStyle = '#1f2124'
  for (let i = -1; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 32, 32)
    ctx.lineTo(i * 32 + 16, 32)
    ctx.lineTo(i * 32 + 48, 0)
    ctx.lineTo(i * 32 + 32, 0)
    ctx.fill()
  }
  return (hazardM = new MeshStandardMaterial({ map: tex(c, 3, 1), roughness: 0.6 }))
}

// --- Shared bits --------------------------------------------------------------------------------------
// A canvas sign (own material, faint emissive so setLevel can brighten it).
function signMat(text, { bg = '#5a3a22', fg = '#fff3d6', border = '#f5e6c0', w = 640, h = 160, size = 104, stroke = null } = {}) {
  return signMaterial(signCanvas(w, h, { bg, border, borderWidth: 10, radius: 18, lines: [{ text, size, color: fg, stroke, strokeWidth: 10 }] }), { emissive: 0.12 })
}
// A sign panel facing -Z (the front).
const front = (p, w, h, mat, x, y, z) => signPanel(p, w, h, mat, x, y, z, PI)

// Gable: wall prism + roof; ridge along `axis`. Returns the roof rise.
function gable(p, w, d, y, pitch, wall, roof, { axis = 'z', cx = 0, cz = 0, overhang = 0.4, trim = null } = {}) {
  const half = (axis === 'z' ? w : d) / 2
  const H = (half + overhang) * Math.tan((pitch * PI) / 180) - 0.03
  if (axis === 'z') prism(p, w, H, d, wall, cx, y, cz)
  else prism(p, d, H, w, wall, cx, y, cz, PI / 2)
  return gableRoof(p, w, d, y, pitch, roof, { overhang, axis, cx, cz, trim })
}

// Four hidden level groups (levels 1..4) plus extra groups living elsewhere [[group, level]].
function tiers(g) {
  return [1, 2, 3, 4].map((n) => {
    const t = new Group()
    t.name = `level${n}`
    t.visible = false
    g.add(t)
    return t
  })
}
function leveler(lv, signM, extra = []) {
  return (n) => {
    n = Math.max(0, Math.min(4, n | 0))
    lv.forEach((t, i) => (t.visible = n > i))
    for (const [grp, l] of extra) grp.visible = n >= l
    if (signM) signM.emissiveIntensity = 0.12 + n * 0.13
  }
}

// Sacks: standing (tied top) and lying.
function sack(p, x, y, z, mat, tie, ry = 0) {
  rbox(p, 0.6, 0.78, 0.42, 0.16, mat, x, y + 0.39, z).rotation.y = ry
  box(p, 0.26, 0.12, 0.2, tie, x, y + 0.8, z, ry, false)
}
function sackFlat(p, x, y, z, mat, ry = 0) {
  rbox(p, 0.85, 0.34, 0.55, 0.15, mat, x, y + 0.17, z).rotation.y = ry
}
// Loaves: a round boule or a long baguette.
function loaf(p, x, y, z, mat, long = false) {
  if (long) sph(p, 0.2, mat, x, y + 0.07, z, 2.2, 0.42, 0.5, 10)
  else sph(p, 0.2, mat, x, y + 0.09, z, 1.15, 0.6, 0.85, 10)
}
// A wire cooling rack (1.4 x 0.6, three shelves) with loaves.
function coolingRack(p, x, z, steel, crust, crust2) {
  for (const sx of [-0.66, 0.66]) for (const sz of [-0.27, 0.27]) cy(p, 0.025, 0.025, 1.85, steel, x + sx, 0.925, z + sz, 6)
  for (const [k, y] of [0.45, 0.95, 1.45].entries()) {
    for (const sz of [-0.27, 0.27]) bx(p, 1.36, 0.03, 0.03, steel, x, y, z + sz)
    for (let j = 0; j < 7; j++) bx(p, 0.02, 0.02, 0.56, steel, x - 0.6 + j * 0.2, y, z)
    if (k === 1) {
      for (let i = 0; i < 3; i++) loaf(p, x - 0.42 + i * 0.42, y, z + (i % 2 ? 0.06 : -0.06), crust2, true)
    } else {
      for (let i = 0; i < 3; i++) loaf(p, x - 0.42 + i * 0.42, y, z, i === 1 ? crust2 : crust)
    }
  }
}
// Wooden crate (open top shown full) with a plank seam.
function crate(p, x, y, z, w, d, h, wood, seam, fill) {
  block(p, w, h, d, wood, x, y, z)
  block(p, w + 0.02, 0.05, d + 0.02, seam, x, y + h * 0.5, z, 0, false)
  if (fill) block(p, w - 0.1, 0.04, d - 0.1, fill, x, y + h - 0.02, z, 0, false)
}
function carrotCrate(p, x, y, z, wood, seam, carrot, leaf) {
  crate(p, x, y, z, 1.0, 0.7, 0.5, wood, seam, carrot)
  for (let i = 0; i < 5; i++) {
    const s = i % 2 ? 1 : -1
    const cz = z - 0.24 + i * 0.12
    const c = cy(p, 0.06, 0.012, 0.42, carrot, x + s * 0.05, y + 0.54, cz, 6, 'x')
    c.rotation.z = s * (PI / 2)
    box(p, 0.12, 0.06, 0.1, leaf, x + s * 0.05 + s * 0.26, y + 0.55, cz, 0, false)
  }
}
function pumpkin(p, x, y, z, s, mat, stem) {
  sph(p, 0.34 * s, mat, x, y + 0.26 * s, z, 1.2, 0.78, 1.2, 12)
  cy(p, 0.04 * s, 0.05 * s, 0.18 * s, stem, x, y + 0.56 * s, z, 6)
}
function milkCan(p, x, z, steel, lid) {
  cy(p, 0.22, 0.25, 0.7, steel, x, 0.35, z, 12)
  cy(p, 0.12, 0.22, 0.15, steel, x, 0.775, z, 12)
  cy(p, 0.13, 0.13, 0.15, steel, x, 0.92, z, 10)
  cy(p, 0.16, 0.16, 0.05, lid, x, 1.02, z, 10)
}
function cheeseWheel(p, x, y, z, mat) {
  cy(p, 0.28, 0.28, 0.2, mat, x, y + 0.1, z, 14)
}
// A string of festoon bulbs between two points, sagging.
function festoon(p, a, b, n, bulb, wire) {
  let prev = a
  for (let i = 1; i <= n; i++) {
    const k = i / n
    const sag = Math.sin(k * PI) * 0.25
    const pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - sag, a[2] + (b[2] - a[2]) * k]
    tube(p, prev, pt, 0.012, wire, 4)
    if (i < n) sph(p, 0.07, bulb, pt[0], pt[1] - 0.08, pt[2], 1, 1.2, 1, 8)
    prev = pt
  }
}
const ease = (v, target, rate, dt) => v + (target - v) * Math.min(1, dt * rate)

// =====================================================================================================
// 1. Flour mill (16 x 16): a tapered octagonal tower mill with a red cap, four lattice sails on the
// front, a gallery, a fantail, a grain shed with sacks at its foot and a FLOUR MILL signboard.
// =====================================================================================================
export function flourMill() {
  const g = new Group()
  const plaster = M('#efe7d6', { roughness: 0.85 })
  const brick = brickMat(11, 0.7)
  const wood = M('#8a5a32', { roughness: 0.8 })
  const dark = M('#4a3322', { roughness: 0.8 })
  const white = M('#f7f4ec', { roughness: 0.6 })
  const capM = paint('#b8392e', 0.5)
  const iron = metal('#3a3f45', 0.5)
  const win = M('#26303a', { roughness: 0.3, metalness: 0.2 })
  const sackM = M('#efe6d2', { roughness: 0.95 })
  const tieM = M('#b08a52', { roughness: 0.9 })
  const siding = sidingMat('#c98a4e', 3, 1)
  const roofM = tinMat('#5e6a72', 5, 2)
  const stone = M('#a8a49a', { roughness: 0.95 })
  const gravel = M('#cdb894', { roughness: 1 })
  const canvasM = M('#f1e6cc', { roughness: 0.95, side: DoubleSide })
  const TZ = 1.5 // tower centre z
  const lv = tiers(g)

  block(g, 15.4, 0.04, 6.2, gravel, 0, 0, -4.6, 0, false) // yard in front

  // --- Tower: brick plinth, tapered plaster octagon (faces at multiples of 45 deg, one facing -Z).
  cyl(g, 3.75, 3.9, 1.4, brick, 0, 0.7, TZ, 8).rotation.y = PI / 8
  cyl(g, 2.3, 3.4, 11, plaster, 0, 1.4 + 5.5, TZ, 8).rotation.y = PI / 8
  cyl(g, 3.5, 3.55, 0.18, white, 0, 1.45, TZ, 8, false).rotation.y = PI / 8
  const ct = Math.cos(PI / 8)
  const lean = Math.atan((1.1 * ct) / 11)
  const onTower = (w, h, d, mat, phi, y, out = 0) => {
    const r = (3.4 - ((y - 1.4) / 11) * 1.1) * ct + out
    const m = box(g, w, h, d, mat, Math.sin(phi) * r, y, TZ + Math.cos(phi) * r, 0, false)
    m.rotation.set(-lean, phi, 0, 'YXZ')
    return m
  }
  for (const [phi, y] of [[PI, 7.0], [PI / 2, 5.6], [-PI / 2, 5.6], [PI / 2, 9.4], [-PI / 2, 9.4], [0, 7.5], [PI * 0.75, 10.4], [-PI * 0.75, 8.2]]) {
    onTower(0.75, 1.0, 0.2, win, phi, y)
    onTower(1.0, 0.12, 0.34, white, phi, y - 0.56, 0.02)
    onTower(0.95, 0.12, 0.26, white, phi, y + 0.56)
  }
  // Door porch under the gallery.
  block(g, 1.9, 2.9, 0.8, brick, 0, 0, TZ - 3.4)
  block(g, 1.1, 2.0, 0.06, dark, 0, 0, TZ - 3.82, 0, false)
  for (const s of [-1, 1]) block(g, 0.14, 2.15, 0.1, white, s * 0.62, 0, TZ - 3.84, 0, false)
  box(g, 1.38, 0.14, 0.12, white, 0, 2.15, TZ - 3.84, 0, false)
  block(g, 1.6, 0.14, 0.6, stone, 0, 0, TZ - 4.05, 0, false)
  sph(g, 0.05, iron, 0.38, 1.0, TZ - 3.88)

  // --- Gallery (stage) at 3 m: octagonal deck, posts, rails, brackets.
  const GY = 3.0
  cyl(g, 4.7, 4.7, 0.2, wood, 0, GY, TZ, 8).rotation.y = PI / 8
  const R = 4.55
  const vtx = (k, r) => [Math.sin(PI / 8 + (k * PI) / 4) * r, TZ + Math.cos(PI / 8 + (k * PI) / 4) * r]
  for (let k = 0; k < 8; k++) {
    const [x0, z0] = vtx(k, R)
    const [x1, z1] = vtx(k + 1, R)
    cyl(g, 0.05, 0.05, 1.0, white, x0, GY + 0.6, z0, 6, false)
    cyl(g, 0.035, 0.035, 1.0, white, (x0 + x1) / 2, GY + 0.6, (z0 + z1) / 2, 6, false)
    tube(g, [x0, GY + 1.08, z0], [x1, GY + 1.08, z1], 0.05, white, 6)
    tube(g, [x0, GY + 0.62, z0], [x1, GY + 0.62, z1], 0.03, white, 6)
    if (k === 4) continue // the porch holds the front
    const fx = Math.sin((k * PI) / 4)
    const fz = Math.cos((k * PI) / 4)
    tube(g, [fx * 3.15, 1.7, TZ + fz * 3.15], [fx * 4.3, GY - 0.08, TZ + fz * 4.3], 0.08, wood, 6)
  }

  // --- Cap: curb, ogee dome, finial; windshaft out of the front.
  cyl(g, 2.55, 2.55, 0.35, dark, 0, 12.55, TZ, 16)
  lathe(g, [[2.6, 0], [2.55, 0.5], [2.2, 1.2], [1.55, 1.75], [0.8, 2.1], [0.001, 2.25]], capM, 0, 12.7, TZ, 20)
  cy(g, 0.05, 0.05, 0.5, iron, 0, 15.1, TZ, 6)
  sph(g, 0.2, M('#f2c230', { roughness: 0.3, metalness: 0.6 }), 0, 15.35, TZ)
  const HY = 13.2
  const HZ = -2.1
  cy(g, 0.3, 0.34, 1.6, iron, 0, HY, HZ + 0.85, 12, 'z')

  // --- Sails: tilt group (static) -> spin group (rotates about its local Z).
  const hub = new Group()
  hub.position.set(0, HY, HZ)
  hub.rotation.x = 0.1
  g.add(hub)
  const spin = new Group()
  hub.add(spin)
  cy(spin, 0.55, 0.55, 0.6, iron, 0, 0, 0, 12, 'z')
  cy(spin, 0.28, 0.45, 0.3, capM, 0, 0, -0.45, 12, 'z')
  box(spin, 14.8, 0.34, 0.34, dark, 0, 0, 0)
  box(spin, 0.34, 14.8, 0.34, dark, 0, 0, 0)
  const onArm = (p, w, h, d, mat, a, u, v, z) => {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const m = box(p, w, h, d, mat, u * c - v * s, u * s + v * c, z, 0, false)
    m.rotation.z = a
    return m
  }
  const fullSails = new Group() // level 3: the canvas spread to the tips
  spin.add(fullSails)
  for (let k = 0; k < 4; k++) {
    const a = (k * PI) / 2
    for (let i = 0; i <= 10; i++) onArm(spin, 0.07, 2.5, 0.07, white, a, 1.7 + i * 0.52, 0.62, -0.22)
    for (const v of [-0.6, 0.62, 1.86]) onArm(spin, 5.5, 0.08, 0.08, white, a, 4.35, v, -0.22)
    onArm(spin, 2.9, 2.4, 0.03, canvasM, a, 3.15, 0.62, -0.13)
    onArm(fullSails, 2.4, 2.4, 0.03, canvasM, a, 5.85, 0.62, -0.13)
  }

  // --- Fantail behind the cap (turns slowly with the sails).
  tube(g, [0, 12.9, TZ + 2.3], [0, 13.45, TZ + 3.2], 0.08, dark, 6)
  tube(g, [0.5, 12.75, TZ + 2.2], [0, 13.45, TZ + 3.2], 0.05, dark, 6)
  tube(g, [-0.5, 12.75, TZ + 2.2], [0, 13.45, TZ + 3.2], 0.05, dark, 6)
  const fan = new Group()
  fan.position.set(0, 13.45, TZ + 3.2)
  g.add(fan)
  cy(fan, 0.12, 0.12, 0.25, iron, 0, 0, 0, 8, 'x')
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6
    const b = box(fan, 0.04, 0.75, 0.3, white, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, false)
    b.rotation.set(a, 0.45, 0)
  }

  // --- Grain shed on the west side: siding, gable roof, open door, hoist, sacks.
  const SX = -5.45
  const SZ = 0.5
  block(g, 4.3, 3.0, 6, siding, SX, 0, SZ)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.18, 3.0, 0.18, white, SX + sx * 2.15, 0, SZ + sz * 3, 0, false)
  gable(g, 4.3, 6, 3.0, 35, siding, roofM, { axis: 'z', cx: SX, cz: SZ, overhang: 0.35, trim: white })
  const opening = M('#2a1d14', { roughness: 1 })
  block(g, 1.7, 2.3, 0.06, opening, SX, 0, SZ - 3.03, 0, false)
  for (const s of [-1, 1]) block(g, 0.14, 2.42, 0.12, white, SX + s * 0.92, 0, SZ - 3.06, 0, false)
  box(g, 2.0, 0.16, 0.14, white, SX, 2.44, SZ - 3.06, 0, false)
  block(g, 0.85, 2.2, 0.08, dark, SX - 1.0, 0, SZ - 3.45, 1.92) // leaf swung open
  // Hoist beam over the door with a sack on the rope.
  box(g, 0.2, 0.2, 1.3, dark, SX, 4.05, SZ - 3.55)
  tube(g, [SX, 3.95, SZ - 4.05], [SX, 3.15, SZ - 4.05], 0.02, tieM, 4)
  rbox(g, 0.5, 0.65, 0.36, 0.14, sackM, SX, 2.8, SZ - 4.05)
  // Sacks: a lying pile at the corner, standing sacks by the door, two by the tower porch.
  for (const [x, z] of [[-7.35, -3.75], [-7.35, -4.35], [-6.75, -3.75]]) sackFlat(g, x, 0.04, z, sackM, PI / 2)
  sackFlat(g, -7.1, 0.38, -4.05, sackM, PI / 2 + 0.2)
  for (const [x, z, r] of [[SX + 1.35, -3.05, 0.2], [SX + 1.4, -3.65, -0.3], [SX + 1.95, -3.3, 0.5]]) sack(g, x, 0.04, z, sackM, tieM, r)
  sack(g, 1.35, 0.04, -2.75, sackM, tieM, 0.4)
  sack(g, 1.85, 0.04, -2.35, sackM, tieM, -0.2)
  // A spare millstone against the plinth.
  const ms = cy(g, 0.85, 0.85, 0.26, stone, 3.0, 0.85, -1.2, 18, 'x')
  ms.rotation.y = 0.9
  // Signboard on posts at the front.
  const signM = signMat('FLOUR MILL', { bg: '#7a4a26', fg: '#fff3d6', border: '#f5e6c0' })
  for (const s of [-1, 1]) block(g, 0.18, 2.95, 0.18, dark, -1.8 + s * 2.35, 0, -6.4)
  block(g, 4.6, 1.3, 0.12, dark, -1.8, 1.55, -6.36)
  box(g, 5.0, 0.1, 0.5, roofM, -1.8, 2.95, -6.38)
  front(g, 4.4, 1.1, signM, -1.8, 2.2, -6.44)

  // --- Levels.
  // 1: a pallet of flour sacks.
  block(lv[0], 1.5, 0.15, 1.15, wood, 3.4, 0.04, -4.4)
  for (const [x, z, y] of [[3.0, -4.65, 0.19], [3.0, -4.1, 0.19], [3.85, -4.65, 0.19], [3.85, -4.1, 0.19], [3.4, -4.4, 0.53]]) sackFlat(lv[0], x, y, z, sackM)
  // 2: a hand cart loaded with sacks.
  block(lv[1], 1.4, 0.12, 0.9, wood, 0.9, 0.55, -4.9)
  for (const s of [-1, 1]) block(lv[1], 1.4, 0.3, 0.06, wood, 0.9, 0.67, -4.9 + s * 0.42, 0, false)
  for (const s of [-1, 1]) cy(lv[1], 0.35, 0.35, 0.08, dark, 0.9, 0.35, -4.9 + s * 0.5, 12, 'z')
  cy(lv[1], 0.04, 0.04, 1.1, iron, 0.9, 0.35, -4.9, 6, 'z')
  for (const s of [-1, 1]) tube(lv[1], [1.6, 0.66, -4.9 + s * 0.3], [2.4, 0.5, -4.9 + s * 0.3], 0.03, wood, 6)
  sackFlat(lv[1], 0.75, 0.67, -4.9, sackM)
  sack(lv[1], 1.3, 0.67, -4.9, sackM, tieM, 0.3)
  // 3: full canvas on the sails, more sacks by the porch.
  sack(lv[2], -1.3, 0.04, -2.6, sackM, tieM, 0.1)
  sack(lv[2], -1.75, 0.04, -2.2, sackM, tieM, -0.4)
  // 4: a grain silo behind, lamps by the doors.
  const silo = metal('#c9ced3', 0.3)
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i * PI) / 2
    block(lv[3], 0.14, 1.2, 0.14, iron, 5.6 + Math.cos(a) * 1.1, 0, 5.2 + Math.sin(a) * 1.1)
  }
  cy(lv[3], 1.5, 0.35, 0.8, silo, 5.6, 1.6, 5.2, 18)
  cy(lv[3], 1.5, 1.5, 4.2, silo, 5.6, 4.1, 5.2, 18)
  cy(lv[3], 0.2, 1.55, 0.9, capM, 5.6, 6.65, 5.2, 18)
  for (const y of [2.9, 4.3, 5.7]) cy(lv[3], 1.53, 1.53, 0.08, iron, 5.6, y, 5.2, 18)
  const lamp = E('#ffcf7a', 1.6)
  for (const [x, z] of [[SX - 1.15, SZ - 3.12], [SX + 1.15, SZ - 3.12], [0.85, TZ - 3.86]]) {
    box(lv[3], 0.06, 0.06, 0.3, iron, x, 2.75, z - 0.12, 0, false)
    box(lv[3], 0.2, 0.28, 0.2, lamp, x, 2.62, z - 0.3, 0, false)
  }

  const setLevel = leveler(lv, signM, [[fullSails, 3]])
  setLevel(0)

  // --- Animation.
  let omega = 0
  let dustT = 0
  const dust = { color: '#f6f1e4', size: 0.35, grow: 3.2, life: 1.6, vy: 0.4, a: 0.32, vx: 0, vz: -0.5 }
  function update(dt, t, running, fx) {
    omega = ease(omega, running ? 1.15 : 0, running ? 0.45 : 0.3, dt)
    spin.rotation.z = (spin.rotation.z + omega * dt) % TAU
    fan.rotation.x = (fan.rotation.x + omega * dt * 0.6) % TAU
    if (running && fx) {
      dustT -= dt
      if (dustT <= 0) {
        dustT = 0.3 + Math.random() * 0.35
        dust.vx = (Math.random() - 0.5) * 0.6
        fx.puff(fx.wx + SX + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.9, fx.wz + SZ - 3.3, dust)
      }
    }
  }
  return { g, update, setLevel, crate: [6.2, -6.6] }
}

// =====================================================================================================
// 2. Bakery (16 x 14): brick shop with a tile roof, a wood-fired oven built out of the front (its
// mouth glows), a tall chimney, a striped awning over the shop window, cooling racks and a cake.
// =====================================================================================================
export function bakery() {
  const g = new Group()
  const brick = brickMat(7, 2.4)
  const ovenBrick = brickMat(1.8, 1.4, '#e8d8cc')
  const chimBrick = brickMat(0.8, 5)
  const cream = M('#f5ecd6', { roughness: 0.7 })
  const roofM = tinMat('#b4553a', 14, 2)
  const wood = M('#7a4a2a', { roughness: 0.8 })
  const doorM = paint('#2f6f8a', 0.5)
  const warm = E('#ffd9a0', 0.55)
  const steel = metal('#b9c0c6', 0.3)
  const crust = M('#c9873e', { roughness: 0.7 })
  const crust2 = M('#a8652a', { roughness: 0.7 })
  const red = M('#d6493a', { roughness: 0.7 })
  const white = M('#fbf6ee', { roughness: 0.7 })
  const pink = M('#f4b6c6', { roughness: 0.5 })
  const iron = M('#2a2c30', { roughness: 0.6 })
  const pave = M('#cbbfa8', { roughness: 0.95 })
  const lv = tiers(g)

  const BW = 14
  const BD = 9
  const BH = 4.6
  const BZ = -2.5 // front wall
  const cz = BZ + BD / 2
  block(g, 15.6, 0.04, 4.6, pave, 0, 0, -4.7, 0, false)
  block(g, BW, BH, BD, brick, 0, 0, cz)
  block(g, BW + 0.12, 0.4, BD + 0.12, cream, 0, 0, cz, 0, false)
  box(g, BW + 0.3, 0.3, BD + 0.3, cream, 0, BH - 0.1, cz)
  gable(g, BW, BD, BH, 30, brick, roofM, { axis: 'x', cx: 0, cz, overhang: 0.42, trim: cream })
  // Side windows.
  for (const s of [-1, 1]) for (const z of [0.5, 4.5]) {
    block(g, 0.1, 1.4, 1.3, cream, s * (BW / 2 + 0.02), 1.3, z, 0, false)
    block(g, 0.12, 1.1, 1.0, warm, s * (BW / 2 + 0.03), 1.45, z, 0, false)
  }

  // --- Oven out of the front: rounded brick body + dome, arched glowing mouth, stone voussoirs.
  const OX = -3.6
  rbox(g, 3.4, 2.6, 2.6, 0.45, ovenBrick, OX, 1.3, -3.6)
  lathe(g, [[1.4, 0], [1.3, 0.45], [0.95, 0.85], [0.001, 1.05]], ovenBrick, OX, 2.45, -3.7, 16)
  const glowM = new MeshStandardMaterial({ color: '#3a1606', emissive: '#ff7a1a', emissiveIntensity: 0.3, roughness: 0.9 })
  const mouth = [[-0.6, 0], [0.6, 0], ...arc(0, 0.5, 0.6, 0, PI, 10)]
  extrude(g, mouth, 0.06, glowM, OX, 0.75, -4.91, 0)
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * PI
    const v = box(g, 0.24, 0.3, 0.14, cream, OX + Math.cos(a) * 0.74, 1.25 + Math.sin(a) * 0.74, -4.96, 0, false)
    v.rotation.z = a - PI / 2
  }
  for (const s of [-1, 1]) block(g, 0.24, 0.5, 0.14, cream, OX + s * 0.74, 0.75, -4.96, 0, false)
  box(g, 1.9, 0.12, 0.4, cream, OX, 0.7, -5.02)
  // Peel leaning on the oven, a stack of logs.
  tube(g, [OX + 1.2, 0.02, -5.25], [OX + 1.32, 2.0, -4.97], 0.03, wood, 6)
  box(g, 0.34, 0.42, 0.03, wood, OX + 1.33, 2.2, -4.96, 0, false).rotation.x = -0.14
  for (const [i, [x, y]] of [[-0.3, 0.12], [0, 0.12], [0.3, 0.12], [-0.15, 0.36], [0.15, 0.36], [0, 0.6]].entries()) {
    cy(g, 0.12, 0.12, 0.7, i % 2 ? crust2 : wood, OX - 1.0 + x, y, -5.25, 8, 'z')
  }
  // Chimney.
  block(g, 1.5, 10, 1.5, chimBrick, OX, 0, -1.3)
  block(g, 1.8, 0.3, 1.8, cream, OX, 10, -1.3)
  for (const s of [-1, 1]) cy(g, 0.2, 0.26, 0.6, M('#b4553a', { roughness: 0.8 }), OX + s * 0.35, 10.6, -1.3, 10)

  // --- Door, shop window, awning, sign, lamps.
  const DX = 0.9
  block(g, 1.6, 2.55, 0.12, cream, DX, 0, BZ - 0.05)
  block(g, 1.2, 2.3, 0.08, doorM, DX, 0, BZ - 0.13)
  box(g, 0.7, 0.6, 0.04, warm, DX, 1.65, BZ - 0.18, 0, false)
  sph(g, 0.06, steel, DX + 0.42, 1.1, BZ - 0.2)
  block(g, 1.9, 0.15, 0.7, pave, DX, 0, BZ - 0.4, 0, false)
  const WX = 4.4
  block(g, 3.6, 2.2, 0.12, cream, WX, 0.6, BZ - 0.05)
  block(g, 3.2, 1.8, 0.06, warm, WX, 0.8, BZ - 0.12, 0, false)
  box(g, 0.08, 1.8, 0.08, cream, WX, 1.7, BZ - 0.15, 0, false)
  box(g, 3.8, 0.12, 0.4, cream, WX, 0.6, BZ - 0.25)
  for (let i = 0; i < 8; i++) {
    const x = -0.4 + 0.45 + i * 0.9
    const mat = i % 2 ? white : red
    box(g, 0.9, 0.06, 1.7, mat, x, 3.0, -3.3).rotation.x = -0.38
    box(g, 0.9, 0.3, 0.04, mat, x, 2.55, -4.11, 0, false)
  }
  for (const x of [-0.35, 6.75]) tube(g, [x, 2.2, BZ - 0.02], [x, 2.66, -4.06], 0.03, iron, 6)
  const signM = signMat('BAKERY', { bg: '#5a3a22', fg: '#ffe6b0', border: '#f5e6c0' })
  block(g, 5.3, 1.1, 0.1, wood, 3.2, 3.4, BZ - 0.03)
  front(g, 5.0, 0.95, signM, 3.2, 3.95, BZ - 0.1)
  for (const x of [-0.6, 6.9]) {
    box(g, 0.06, 0.06, 0.3, iron, x, 3.9, BZ - 0.15, 0, false)
    box(g, 0.2, 0.28, 0.2, E('#ffcf7a', 1.4), x, 3.75, BZ - 0.32, 0, false)
  }

  // --- Cooling rack and the cake table.
  coolingRack(g, -6.7, -4.0, steel, crust, crust2)
  const TX = -0.9
  const TZ = -5.2
  cy(g, 0.62, 0.7, 0.8, red, TX, 0.4, TZ, 16)
  cy(g, 0.64, 0.64, 0.06, white, TX, 0.82, TZ, 16)
  cy(g, 0.07, 0.12, 0.2, steel, TX, 0.95, TZ, 10)
  cy(g, 0.4, 0.4, 0.03, steel, TX, 1.06, TZ, 16)
  cy(g, 0.33, 0.33, 0.32, pink, TX, 1.24, TZ, 18)
  ring(g, 0.33, 0.04, white, TX, 1.4, TZ, 'y')
  cy(g, 0.22, 0.22, 0.22, pink, TX, 1.51, TZ, 16)
  ring(g, 0.22, 0.035, white, TX, 1.62, TZ, 'y')
  for (let i = 0; i < 5; i++) sph(g, 0.04, red, TX + Math.cos((i * TAU) / 5) * 0.14, 1.66, TZ + Math.sin((i * TAU) / 5) * 0.14, 1, 1, 1, 8)

  // --- Levels.
  // 1: a second cooling rack.
  coolingRack(lv[0], -6.7, -5.75, steel, crust2, crust)
  // 2: bread baskets on a bench under the window.
  block(lv[1], 3.2, 0.12, 0.6, wood, WX, 0.55, -3.3)
  for (const s of [-1, 1]) block(lv[1], 0.12, 0.55, 0.5, wood, WX + s * 1.45, 0, -3.3)
  const wicker = M('#c49a5a', { roughness: 0.9 })
  for (let i = 0; i < 3; i++) {
    const x = WX - 1.0 + i * 1.0
    cy(lv[1], 0.34, 0.27, 0.22, wicker, x, 0.78, -3.3, 12)
    loaf(lv[1], x - 0.1, 0.85, -3.3, crust)
    loaf(lv[1], x + 0.12, 0.88, -3.25, crust2, true)
  }
  // 3: flour sacks by the door and a cart of bread crates.
  const sackM = M('#efe6d2', { roughness: 0.95 })
  const tieM = M('#b08a52', { roughness: 0.9 })
  sack(lv[2], 2.1, 0, -2.95, sackM, tieM, 0.2)
  sack(lv[2], 2.2, 0, -3.5, sackM, tieM, -0.3)
  block(lv[2], 1.6, 0.1, 1.0, wood, 3.6, 0.5, -5.6)
  for (const s of [-1, 1]) cy(lv[2], 0.3, 0.3, 0.08, iron, 3.6 + s * 0.5, 0.3, -5.06, 12, 'z')
  for (const s of [-1, 1]) cy(lv[2], 0.3, 0.3, 0.08, iron, 3.6 + s * 0.5, 0.3, -6.14, 12, 'z')
  for (const s of [-1, 1]) {
    crate(lv[2], 3.6 + s * 0.4, 0.6, -5.6, 0.7, 0.8, 0.35, wood, crust2, null)
    for (let i = 0; i < 2; i++) loaf(lv[2], 3.6 + s * 0.4, 0.95, -5.8 + i * 0.4, crust, true)
  }
  // 4: festoon lights along the awning, a third tier on the cake.
  festoon(lv[3], [-0.4, 2.45, -4.15], [6.8, 2.45, -4.15], 12, E('#ffd98a', 1.8), iron)
  cy(lv[3], 0.13, 0.13, 0.18, white, TX, 1.71, TZ, 14)
  sph(lv[3], 0.05, red, TX, 1.84, TZ, 1, 1, 1, 8)

  const setLevel = leveler(lv, signM)
  setLevel(0)

  // --- Animation: oven glow flicker, chimney smoke.
  let heat = 0
  let smokeT = 0
  const smoke = { color: '#cfcac2', size: 0.6, grow: 4, life: 4.5, vy: 1.0, a: 0.26, vx: 0.15, vz: 0 }
  function update(dt, t, running, fx) {
    heat = ease(heat, running ? 1 : 0, 0.7, dt)
    const flick = Math.sin(t * 13.1) * 0.28 + Math.sin(t * 7.7 + 1.3) * 0.22 + Math.sin(t * 23.3) * 0.12
    glowM.emissiveIntensity = 0.25 + heat * (2.0 + flick)
    if (running && fx) {
      smokeT -= dt
      if (smokeT <= 0) {
        smokeT = 0.45 + Math.random() * 0.35
        const s = Math.random() < 0.5 ? -0.35 : 0.35
        fx.puff(fx.wx + OX + s, 11.0, fx.wz - 1.3, smoke)
      }
    }
  }
  return { g, update, setLevel, crate: [6.4, -5.9] }
}

// =====================================================================================================
// 3. Dairy (16 x 14): white board-and-batten dairy with a blue roof and trim, a DAIRY sign in the
// gable, a cheese shelf under a striped awning, milk cans, a butter churn whose plunger bobs, and a
// stainless milk tank with a ladder.
// =====================================================================================================
export function dairy() {
  const g = new Group()
  const wall = sidingMat('#f7f6f2', 5, 1)
  const blue = paint('#2f6fd0', 0.45)
  const roofM = tinMat('#3f74c4', 6, 3)
  const white = M('#fbfaf6', { roughness: 0.6 })
  const steel = metal('#d9dde1', 0.18)
  const steelDark = metal('#8f989f', 0.35)
  const wood = M('#9a6a3a', { roughness: 0.85 })
  const woodDark = M('#6e4424', { roughness: 0.85 })
  const cheese = M('#f2c230', { roughness: 0.55 })
  const win = M('#2b3640', { roughness: 0.12, metalness: 0.3 })
  const black = M('#2a2c30', { roughness: 0.7 })
  const pave = M('#c9c6bf', { roughness: 0.95 })
  const lv = tiers(g)

  const BX = -2
  const BW = 11
  const BZ = -2
  const BD = 8.5
  const BH = 4.2
  const cz = BZ + BD / 2
  block(g, 15.6, 0.04, 4.8, pave, 0, 0, -4.6, 0, false)
  block(g, BW, BH, BD, wall, BX, 0, cz)
  block(g, BW + 0.06, 0.6, BD + 0.06, blue, BX, 0, cz, 0, false)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.25, BH, 0.25, blue, BX + (sx * BW) / 2, 0, cz + (sz * BD) / 2, 0, false)
  const rise = gable(g, BW, BD, BH, 28, wall, roofM, { axis: 'z', cx: BX, cz, overhang: 0.45, trim: white })
  // Big blue door with white X braces.
  block(g, 2.9, 3.2, 0.12, white, BX, 0, BZ - 0.04)
  block(g, 2.6, 3.0, 0.1, blue, BX, 0, BZ - 0.1)
  for (const s of [-1, 1]) box(g, 0.14, 3.6, 0.05, white, BX, 1.5, BZ - 0.17, 0, false).rotation.z = s * 0.71
  box(g, 0.06, 3.0, 0.06, white, BX, 1.5, BZ - 0.17, 0, false)
  // Window with shutters (right), cheese hatch (left).
  const WX = BX + 3.6
  block(g, 1.5, 1.35, 0.1, white, WX, 1.3, BZ - 0.04)
  block(g, 1.2, 1.05, 0.06, win, WX, 1.45, BZ - 0.08, 0, false)
  for (const s of [-1, 1]) block(g, 0.55, 1.35, 0.06, blue, WX + s * 1.05, 1.3, BZ - 0.06, 0, false)
  block(g, 2.7, 2.3, 0.05, M('#3a2c22', { roughness: 1 }), -5.6, 0.2, BZ - 0.03, 0, false)
  // Sign in the gable and a cow weather vane on the ridge.
  const signM = signMat('DAIRY', { bg: '#2f6fd0', fg: '#ffffff', border: '#ffffff' })
  front(g, 4.2, 1.0, signM, BX, BH + 0.95, BZ - 0.06)
  cy(g, 0.03, 0.03, 1.3, black, BX, BH + rise + 0.6, BZ + 1.2, 6)
  box(g, 0.7, 0.06, 0.06, black, BX, BH + rise + 1.0, BZ + 1.2, 0, false)
  const cow = [[0.6, 0.3, 0.1, 0, 0], [0.24, 0.2, 0.1, 0.36, 0.08], [0.06, 0.18, 0.1, -0.22, -0.22], [0.06, 0.18, 0.1, 0.22, -0.22]]
  for (const [w, h, d, x, y] of cow) box(g, w, h, d, black, BX + x, BH + rise + 1.4 + y, BZ + 1.2, 0, false)
  box(g, 0.22, 0.14, 0.11, white, BX - 0.1, BH + rise + 1.45, BZ + 1.2, 0, false)

  // --- Cheese shelf under a striped awning, against the hatch.
  const shelf = (p, x, z, depthBack = true) => {
    for (const s of [-1, 1]) block(p, 0.08, 2.0, 0.6, wood, x + s * 1.2, 0, z)
    for (const y of [0.3, 0.9, 1.5, 1.96]) block(p, 2.4, 0.06, 0.6, wood, x, y, z, 0, false)
    if (depthBack) block(p, 2.4, 2.0, 0.04, woodDark, x, 0, z + 0.3, 0, false)
    for (const [k, y] of [0.36, 0.96, 1.56].entries()) {
      for (let i = 0; i < 3; i++) cheeseWheel(p, x - 0.75 + i * 0.75, y, z, cheese)
      if (k !== 1) cheeseWheel(p, x - 0.75 + k * 0.75, y + 0.2, z, cheese)
    }
  }
  shelf(g, -5.6, BZ - 0.36)
  for (let i = 0; i < 4; i++) {
    const x = -7.1 + 0.375 + i * 0.75
    const mat = i % 2 ? white : blue
    box(g, 0.75, 0.06, 1.25, mat, x, 2.75, BZ - 0.6).rotation.x = -0.38
    box(g, 0.75, 0.26, 0.04, mat, x, 2.4, BZ - 1.2, 0, false)
  }

  // --- Milk cans by the door, butter churn, a little bench with butter.
  for (const [x, z] of [[-0.25, BZ - 0.45], [0.33, BZ - 0.4], [0.05, BZ - 0.95]]) milkCan(g, x, z, steel, blue)
  const churn = (p, x, z) => {
    lathe(p, [[0.001, 0], [0.42, 0], [0.47, 0.25], [0.47, 0.75], [0.4, 1.15], [0.37, 1.2], [0.001, 1.2]], wood, x, 0, z, 16)
    ring(p, 0.465, 0.025, black, x, 0.22, z, 'y')
    ring(p, 0.445, 0.025, black, x, 0.95, z, 'y')
    cy(p, 0.39, 0.39, 0.06, woodDark, x, 1.23, z, 16)
    const dasher = new Group()
    dasher.position.set(x, 0, z)
    p.add(dasher)
    cy(dasher, 0.035, 0.035, 1.5, M('#c9a06a', { roughness: 0.8 }), 0, 1.25, 0, 8)
    sph(dasher, 0.075, woodDark, 0, 2.03, 0, 1, 1, 1, 8)
    return dasher
  }
  const d1 = churn(g, 2.0, -3.9)
  block(g, 1.2, 0.5, 0.45, wood, 2.0, 0, -4.85)
  block(g, 0.5, 0.22, 0.32, M('#f7e08a', { roughness: 0.5 }), 1.75, 0.5, -4.85)

  // --- Milk tank (stainless, on legs) with a ladder and a pipe into the dairy.
  const TX = 5.6
  const TZ = 2.6
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i * PI) / 2
    block(g, 0.15, 1.2, 0.15, steelDark, TX + Math.cos(a) * 1.15, 0, TZ + Math.sin(a) * 1.15)
  }
  cy(g, 1.6, 0.5, 0.5, steel, TX, 0.95, TZ, 24)
  cy(g, 1.6, 1.6, 4.6, steel, TX, 3.5, TZ, 24)
  lathe(g, [[1.6, 0], [1.45, 0.45], [1.0, 0.8], [0.001, 0.95]], steel, TX, 5.8, TZ, 24)
  cy(g, 0.3, 0.3, 0.25, steelDark, TX, 6.8, TZ, 12)
  cy(g, 1.63, 1.63, 0.5, blue, TX, 4.4, TZ, 24)
  for (const y of [2.0, 5.5]) cy(g, 1.63, 1.63, 0.08, steelDark, TX, y, TZ, 24)
  tube(g, [TX - 1.0, 0.9, TZ], [BX + BW / 2, 0.9, TZ], 0.1, steelDark, 8)
  const LZ = TZ - 1.85
  for (const s of [-1, 1]) tube(g, [TX + s * 0.25, 0.02, LZ], [TX + s * 0.25, 6.5, LZ], 0.03, steelDark, 6)
  for (let y = 0.35; y < 6.4; y += 0.35) bx(g, 0.5, 0.03, 0.03, steelDark, TX, y, LZ)

  // --- Levels.
  // 1: a cheese table in front of the shelf.
  block(lv[0], 2.0, 0.08, 0.9, wood, -5.6, 0.75, -5.0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(lv[0], 0.08, 0.75, 0.08, wood, -5.6 + sx * 0.9, 0, -5.0 + sz * 0.38)
  for (let i = 0; i < 3; i++) cheeseWheel(lv[0], -6.2 + i * 0.6, 0.83, -5.0, cheese)
  cheeseWheel(lv[0], -5.9, 1.03, -5.0, cheese)
  cheeseWheel(lv[0], -5.3, 1.03, -5.0, cheese)
  // 2: a second butter churn (animated too).
  const d2 = churn(lv[1], 3.15, -4.55)
  // 3: a second, smaller milk tank and more cans.
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i * PI) / 2
    block(lv[2], 0.12, 0.9, 0.12, steelDark, TX + Math.cos(a) * 0.7, 0, 5.85 + Math.sin(a) * 0.7)
  }
  cy(lv[2], 1.0, 1.0, 3.0, steel, TX, 2.4, 5.85, 20)
  lathe(lv[2], [[1.0, 0], [0.9, 0.3], [0.6, 0.55], [0.001, 0.62]], steel, TX, 3.9, 5.85, 20)
  cy(lv[2], 1.02, 1.02, 0.35, blue, TX, 2.8, 5.85, 20)
  for (const [x, z] of [[-0.7, -3.2], [-0.15, -3.35]]) milkCan(lv[2], x, z, steel, blue)
  // 4: a crate of milk bottles and bunting under the gable.
  crate(lv[3], 0.3, 0, -5.2, 1.0, 0.7, 0.35, wood, woodDark, null)
  for (let i = 0; i < 8; i++) {
    const x = 0.3 - 0.36 + (i % 4) * 0.24
    const z = -5.2 - 0.14 + Math.floor(i / 4) * 0.28
    cy(lv[3], 0.09, 0.09, 0.3, white, x, 0.5, z, 8)
    cy(lv[3], 0.05, 0.05, 0.06, blue, x, 0.68, z, 8)
  }
  const flags = [blue, white, cheese]
  for (let i = 0; i < 9; i++) {
    const k = (i + 0.5) / 9
    const x = BX - 3.6 + k * 7.2
    const y = BH + 0.25 - Math.sin(k * PI) * 0.35
    const f = prism(lv[3], 0.4, 0.45, 0.02, flags[i % 3], x, y - 0.45, BZ - 0.12, 0)
    f.rotation.z = PI
    f.position.y = y
  }
  tube(lv[3], [BX - 3.7, BH + 0.25, BZ - 0.12], [BX + 3.7, BH + 0.25, BZ - 0.12], 0.012, black, 4)

  const setLevel = leveler(lv, signM)
  setLevel(0)

  // --- Animation: the churn plungers bob; a drop of cream splashes now and then.
  let k = 0
  let ph = 0
  let splashT = 0
  const splash = { n: 5, colors: ['#fffdf5', '#fff3c8'], speed: 0.8, up: 2.0, gravity: -9, life: 0.5, size: 0.1, additive: false }
  function update(dt, t, running, fx) {
    k = ease(k, running ? 1 : 0, running ? 1.5 : 1.0, dt)
    ph = (ph + dt * k * TAU * 0.85) % (TAU * 100)
    d1.position.y = 0.32 * (0.5 + 0.5 * Math.sin(ph))
    d2.position.y = 0.32 * (0.5 + 0.5 * Math.sin(ph + 2.1))
    if (running && fx) {
      splashT -= dt
      if (splashT <= 0 && Math.sin(ph) < -0.9) {
        splashT = 1.4 + Math.random()
        fx.burst(fx.wx + 2.0, 1.3, fx.wz - 3.9, splash)
      }
    }
  }
  return { g, update, setLevel, crate: [6.4, -5.7] }
}

// =====================================================================================================
// 4. Juice press (14 x 14): an open-fronted timber shed with a hydraulic press (a heavy plate that
// squashes the mash in a basket over a vat), a pipe to a filler over a conveyor across the front
// carrying orange / green bottles, crates of carrots and pumpkins, a JUICE PRESS sign on the fascia.
// =====================================================================================================
const BOTTLES = 12
let bottleGeo = null
let capGeo = null
export function juicePress() {
  const g = new Group()
  const concrete = M('#bdb9b0', { roughness: 0.92 })
  const wallM = sidingMat('#b77a44', 6, 1)
  const post = M('#7a4a2a', { roughness: 0.8 })
  const roofM = tinMat('#7fa86a', 8, 3)
  const green = paint('#3f8a4a', 0.45)
  const orange = paint('#f08a24', 0.4)
  const steel = metal('#a9b1b8', 0.3)
  const chrome = metal('#e3e7ea', 0.15)
  const dark = M('#2a2c30', { roughness: 0.7 })
  const crateM = M('#c4955a', { roughness: 0.9 })
  const carrot = M('#f07a1f', { roughness: 0.6 })
  const leaf = M('#4f9a3a', { roughness: 0.8 })
  const pumpkinM = M('#ee7a1f', { roughness: 0.55 })
  const stem = M('#6b5a2a', { roughness: 0.9 })
  const mash = M('#f59a2a', { roughness: 0.5 })
  const lv = tiers(g)

  // --- Shed: slab, back + side walls, front posts and beam, lean-to roof, fascia with the sign.
  block(g, 13, 0.15, 8, concrete, 0, 0, 2.5)
  block(g, 13, 4.4, 0.25, wallM, 0, 0.15, 6.35)
  for (const s of [-1, 1]) block(g, 0.25, 4.4, 7.75, wallM, s * 6.375, 0.15, 2.5)
  for (const x of [-6.35, -2.2, 2.2, 6.35]) block(g, 0.3, 5.05, 0.3, post, x, 0, -1.4)
  block(g, 13.1, 0.35, 0.35, post, 0, 4.85, -1.4)
  box(g, 14, 0.16, 8.55, roofM, 0, 4.98, 2.625).rotation.x = 0.085
  block(g, 13.9, 0.8, 0.12, green, 0, 4.75, -1.7)
  const signM = signMat('JUICE PRESS', { bg: '#f08a24', fg: '#ffffff', border: '#fff3d6', w: 768, size: 100, stroke: '#9a4a10' })
  front(g, 6.4, 0.68, signM, 0, 5.15, -1.78)

  // --- The press: plinth, two columns, crosshead, hydraulic cylinder, vat, basket of mash.
  const PX = -1
  const PZ = 2.4
  const B = 0.65
  rbox(g, 3.4, 0.5, 2.8, 0.1, concrete, PX, 0.4, PZ)
  for (const s of [-1, 1]) rbox(g, 0.4, 3.9, 0.5, 0.06, green, PX + s * 1.45, B + 1.95, PZ)
  rbox(g, 3.5, 0.45, 0.7, 0.08, green, PX, 4.35, PZ)
  cy(g, 0.28, 0.28, 1.0, orange, PX, 3.62, PZ, 16)
  cy(g, 0.34, 0.34, 0.12, dark, PX, 3.14, PZ, 16)
  tube(g, [PX + 0.28, 3.9, PZ], [PX + 1.25, 3.9, PZ], 0.04, dark, 6) // hydraulic hose
  lathe(g, [[0.001, 0], [1.05, 0], [1.15, 0.1], [1.2, 0.85], [1.1, 0.85], [1.05, 0.12], [0.001, 0.12]], crateM, PX, B, PZ, 20)
  for (const y of [0.3, 0.7]) ring(g, 1.19, 0.03, dark, PX, B + y, PZ, 'y')
  cy(g, 1.07, 1.07, 0.05, mash, PX, B + 0.55, PZ, 20)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU
    const s = bx(g, 0.1, 0.85, 0.05, crateM, PX + Math.cos(a) * 0.85, B + 0.72, PZ + Math.sin(a) * 0.85)
    s.rotation.y = -a + PI / 2
  }
  ring(g, 0.86, 0.035, dark, PX, B + 1.12, PZ, 'y')
  cy(g, 0.8, 0.8, 0.5, mash, PX, B + 0.85, PZ, 18)
  // Plate (moves): disc, ribs, piston rod into the cylinder.
  const plate = new Group()
  plate.position.set(PX, 2.65, PZ)
  g.add(plate)
  cy(plate, 0.95, 0.95, 0.3, steel, 0, 0.15, 0, 20)
  for (const r of [0, PI / 2]) box(plate, 1.8, 0.14, 0.14, orange, 0, 0.36, 0, r)
  cy(plate, 0.13, 0.13, 1.5, chrome, 0, 1.05, 0, 10)
  // Juice line: vat spout -> along the floor -> up to the filler over the belt.
  const CZ = -3.4
  const BT = 1.0
  tube(g, [PX, B + 0.25, PZ - 1.15], [PX, 0.35, PZ - 1.6], 0.07, steel)
  tube(g, [PX, 0.35, PZ - 1.6], [PX, 0.35, CZ + 0.75], 0.07, steel)
  tube(g, [PX, 0.35, CZ + 0.75], [PX, 2.05, CZ + 0.75], 0.07, steel)
  tube(g, [PX, 2.05, CZ + 0.75], [PX, 2.05, CZ], 0.07, steel)
  rbox(g, 0.5, 0.4, 0.5, 0.06, steel, PX, 1.9, CZ)
  cy(g, 0.05, 0.03, 0.3, chrome, PX, 1.58, CZ, 8)
  rbox(g, 0.5, 0.45, 0.4, 0.06, orange, PX + 0.6, 0.38, PZ - 2.5) // pump on the line

  // --- Conveyor across the front.
  const X0 = -5.7
  const LEN = 9.2
  block(g, 10.4, 0.14, 0.82, steel, -1, BT - 0.2, CZ)
  block(g, 10.3, 0.06, 0.7, dark, -1, BT - 0.06, CZ, 0, false)
  for (const s of [-1, 1]) block(g, 10.4, 0.14, 0.05, green, -1, BT - 0.1, CZ + s * 0.43, 0, false)
  for (const x of [-5.8, -3.2, -0.6, 2.0, 3.9]) for (const s of [-1, 1]) block(g, 0.08, BT - 0.2, 0.08, steel, x, 0, CZ + s * 0.36, 0, false)
  for (const x of [-6.1, 4.1]) cy(g, 0.1, 0.1, 0.75, steel, x, BT - 0.1, CZ, 10, 'z')
  block(g, 1.0, 1.5, 1.0, green, -5.9, BT - 0.25, CZ) // bottle feeder
  block(g, 1.1, 0.12, 1.1, dark, -5.9, BT + 1.25, CZ, 0, false)
  block(g, 1.1, 1.0, 1.0, orange, 3.75, BT - 0.25, CZ) // capper / boxer
  block(g, 0.7, 0.3, 0.06, E('#9fd8ff', 0.8), 3.75, BT + 0.3, CZ - 0.52, 0, false)
  // Bottles: two instanced meshes (bodies tinted per bottle, caps) moved along the belt.
  bottleGeo ??= new LatheGeometry([[0.001, 0], [0.11, 0], [0.12, 0.03], [0.12, 0.27], [0.08, 0.35], [0.045, 0.4], [0.045, 0.46], [0.001, 0.46]].map(([x, y]) => new Vector2(x, y)), 10)
  capGeo ??= new CylinderGeometry(0.055, 0.055, 0.06, 8)
  const bottlesG = new Group()
  bottlesG.userData.noCompact = true
  g.add(bottlesG)
  const bodies = new InstancedMesh(bottleGeo, new MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.05 }), BOTTLES)
  const caps = new InstancedMesh(capGeo, M('#f7f4ec', { roughness: 0.5 }), BOTTLES)
  const cOrange = new Color('#ff9a1f')
  const cGreen = new Color('#7bc043')
  for (let i = 0; i < BOTTLES; i++) bodies.setColorAt(i, i % 3 === 2 ? cGreen : cOrange)
  for (const m of [bodies, caps]) {
    m.frustumCulled = false
    m.castShadow = false
    m.receiveShadow = true
    bottlesG.add(m)
  }
  const SP = LEN / BOTTLES
  let off = 0
  const placeBottles = () => {
    for (let i = 0; i < BOTTLES; i++) {
      const x = X0 + ((i * SP + off) % LEN)
      _m.makeTranslation(x, BT, CZ)
      bodies.setMatrixAt(i, _m)
      _m.makeTranslation(x, BT + 0.49, CZ)
      caps.setMatrixAt(i, _m)
    }
    bodies.instanceMatrix.needsUpdate = true
    caps.instanceMatrix.needsUpdate = true
  }
  placeBottles()

  // --- Produce: crates of carrots and pumpkins outside and in the shed.
  carrotCrate(g, -5.6, 0, -5.6, crateM, post, carrot, leaf)
  carrotCrate(g, -5.6, 0.5, -5.6, crateM, post, carrot, leaf)
  carrotCrate(g, -4.4, 0, -5.8, crateM, post, carrot, leaf)
  crate(g, -3.0, 0, -5.6, 1.0, 0.8, 0.45, crateM, post, pumpkinM)
  pumpkin(g, -3.2, 0.45, -5.7, 0.7, pumpkinM, stem)
  pumpkin(g, -2.75, 0.45, -5.45, 0.65, pumpkinM, stem)
  pumpkin(g, -1.9, 0, -5.4, 1.1, pumpkinM, stem)
  pumpkin(g, -1.6, 0, -6.1, 0.9, pumpkinM, stem)
  for (const [x, z, s] of [[-5.2, 4.2, 1.2], [-4.4, 4.9, 1.0], [-5.4, 5.3, 0.9], [-4.7, 3.5, 0.85], [-4.9, 4.6, 0.8]]) pumpkin(g, x, s === 0.8 ? 0.55 : 0.15, z, s, pumpkinM, stem)
  carrotCrate(g, 3.6, 0.15, 5.6, crateM, post, carrot, leaf)
  carrotCrate(g, 4.8, 0.15, 5.6, crateM, post, carrot, leaf)

  // --- Levels.
  // 1: stacked carrot crates inside.
  carrotCrate(lv[0], 3.6, 0.65, 5.6, crateM, post, carrot, leaf)
  carrotCrate(lv[0], 4.8, 0.65, 5.6, crateM, post, carrot, leaf)
  carrotCrate(lv[0], 5.5, 0.15, 4.5, crateM, post, carrot, leaf)
  // 2: a stainless juice tank (second machine) piped to the press.
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3
    block(lv[1], 0.12, 0.8, 0.12, steel, 4.5 + Math.cos(a) * 0.65, 0.15, 2.6 + Math.sin(a) * 0.65)
  }
  cy(lv[1], 0.95, 0.95, 2.4, chrome, 4.5, 2.15, 2.6, 20)
  lathe(lv[1], [[0.95, 0], [0.8, 0.3], [0.45, 0.5], [0.001, 0.55]], chrome, 4.5, 3.35, 2.6, 20)
  cy(lv[1], 0.97, 0.97, 0.4, orange, 4.5, 2.3, 2.6, 20)
  tube(lv[1], [3.55, 1.0, 2.6], [PX + 1.2, 1.0, 2.6], 0.06, steel)
  // 3: a pallet of crated bottles.
  block(lv[2], 1.3, 0.14, 1.0, crateM, 2.6, 0, -5.6)
  const bo = M('#ff9a1f', { roughness: 0.2 })
  const bg = M('#7bc043', { roughness: 0.2 })
  for (const s of [-1, 1]) {
    crate(lv[2], 2.6 + s * 0.32, 0.14, -5.6, 0.6, 0.9, 0.3, crateM, post, null)
    for (let i = 0; i < 6; i++) {
      const x = 2.6 + s * 0.32 - 0.13 + (i % 2) * 0.26
      const z = -5.6 - 0.28 + Math.floor(i / 2) * 0.28
      lathe(lv[2], [[0.001, 0], [0.1, 0], [0.1, 0.24], [0.04, 0.34], [0.001, 0.36]], (i + (s > 0 ? 1 : 0)) % 3 === 2 ? bg : bo, x, 0.3, z, 8)
    }
  }
  // 4: a bigger pumpkin pile and festoon lights along the fascia.
  for (const [x, z, s] of [[-0.6, -5.8, 1.0], [-0.1, -5.3, 0.75], [-0.9, -5.2, 0.7]]) pumpkin(lv[3], x, 0, z, s, pumpkinM, stem)
  festoon(lv[3], [-6.3, 4.6, -1.8], [6.3, 4.6, -1.8], 16, E('#ffd98a', 1.8), dark)

  const setLevel = leveler(lv, signM)
  setLevel(0)

  // --- Animation: press cycle (2 s: drop, squeeze, rise), belt, splashes.
  const UP = 2.65
  const DOWN = 1.72
  let ph = 0 // 0 = up at rest
  let belt = 0
  const splash = { n: 14, colors: ['#ff9a2a', '#ffb347', '#ffd23a'], speed: 2.2, up: 3, gravity: -9, life: 0.8, size: 0.16, additive: false }
  function update(dt, t, running, fx) {
    const prev = ph
    if (running || ph > 0) {
      ph += dt / 2
      if (ph >= 1) ph = running ? ph - 1 : 0
    }
    let y
    if (ph < 0.3) {
      const k = ph / 0.3
      y = UP + (DOWN - UP) * k * k
    } else if (ph < 0.45) y = DOWN
    else {
      const k = (ph - 0.45) / 0.55
      y = DOWN + (UP - DOWN) * (k * k * (3 - 2 * k))
    }
    plate.position.y = y
    if (fx && running && prev < 0.3 && ph >= 0.3) fx.burst(fx.wx + PX, B + 1.15, fx.wz + PZ, splash)
    belt = ease(belt, running ? 0.7 : 0, running ? 1.2 : 1.8, dt)
    if (belt > 0.002) {
      off = (off + belt * dt) % LEN
      placeBottles()
    }
  }
  return { g, update, setLevel, crate: [5.6, -5.8] }
}

// =====================================================================================================
// 5. Refinery (22 x 18): a 16 m distillation column with platforms and a caged ladder, a pipe rack, a
// red / white flare stack with a flickering flame, a squat storage tank with a spiral stair, a pump
// house with a steam vent, pumps, hazard stripes and a REFINERY sign.
// =====================================================================================================
export function refinery() {
  const g = new Group()
  const concrete = M('#b4b0a6', { roughness: 0.95 })
  const steel = metal('#8d959c', 0.4)
  const white = paint('#eceae4', 0.5)
  const red = paint('#c8302a', 0.45)
  const yellow = paint('#f2c230', 0.45)
  const grey = paint('#5a6068', 0.5)
  const green = paint('#4f8a5a', 0.5)
  const blue = paint('#2f6fd0', 0.45)
  const grate = M('#6a7178', { roughness: 0.6, metalness: 0.5 })
  const hazard = hazardMat()
  const tin = tinMat('#d4d8db', 4, 1)
  const dark = M('#2a2c30', { roughness: 0.6 })
  const lv = tiers(g)
  const Y0 = 0.12

  block(g, 21.6, Y0, 17.6, concrete, 0, 0, 0, 0, false)
  for (const x of [-1.5, 2.5, 6.5]) block(g, 2.0, 0.3, 0.3, hazard, x, Y0, -8.5, 0, false) // front kerbs

  // --- Distillation column.
  const CX = -6
  const CZ = 3
  const CR = 1.3
  rbox(g, 3.6, 0.8, 3.6, 0.1, concrete, CX, Y0 + 0.4, CZ)
  box(g, 3.64, 0.28, 3.64, hazard, CX, Y0 + 0.62, CZ, 0, false)
  cy(g, 1.45, 1.6, 1.2, grey, CX, 0.92 + 0.6, CZ, 20)
  cy(g, CR, CR, 14.2, white, CX, 2.12 + 7.1, CZ, 20)
  lathe(g, [[CR, 0], [1.2, 0.35], [0.8, 0.65], [0.001, 0.75]], white, CX, 16.32, CZ, 20)
  for (const y of [4, 6.5, 9, 11.5, 14]) cy(g, CR + 0.04, CR + 0.04, 0.12, grey, CX, y, CZ, 20)
  for (const [y, a] of [[3.2, 0], [7.8, 0.6], [12.4, -0.5]]) {
    // side nozzles with flanges
    cy(g, 0.16, 0.16, 0.6, steel, CX + Math.cos(a) * (CR + 0.25), y, CZ + Math.sin(a) * (CR + 0.25), 10, 'x').rotation.y = -a
  }
  for (const y of [6, 10.5, 15]) {
    cy(g, 2.3, 2.3, 0.1, grate, CX, y, CZ, 24)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU
      block(g, 0.05, 1.0, 0.05, yellow, CX + Math.cos(a) * 2.2, y, CZ + Math.sin(a) * 2.2, 0, false)
    }
    ring(g, 2.2, 0.04, yellow, CX, y + 1.0, CZ, 'y')
    ring(g, 2.2, 0.03, yellow, CX, y + 0.55, CZ, 'y')
    for (const a of [0.4, 2.0, 3.6, 5.2]) tube(g, [CX + Math.cos(a) * CR, y - 1.0, CZ + Math.sin(a) * CR], [CX + Math.cos(a) * 2.1, y - 0.06, CZ + Math.sin(a) * 2.1], 0.06, grey, 6)
  }
  // Caged ladder up the front.
  const LZ = CZ - CR - 0.3
  for (const s of [-1, 1]) tube(g, [CX + s * 0.25, Y0, LZ], [CX + s * 0.25, 16.1, LZ], 0.03, yellow, 6)
  for (let y = 0.45; y < 16; y += 0.35) bx(g, 0.5, 0.03, 0.03, yellow, CX, y, LZ)
  for (let y = 2.6; y < 15.8; y += 1.0) {
    if (Math.abs(y - 6) < 0.3 || Math.abs(y - 10.5) < 0.3 || Math.abs(y - 15) < 0.3) continue
    ring(g, 0.42, 0.022, yellow, CX, y, LZ, 'y', PI).rotation.x = -PI / 2
  }
  for (const a of [PI / 6, PI / 2, (5 * PI) / 6]) tube(g, [CX + Math.cos(a) * 0.42, 2.6, LZ - Math.sin(a) * 0.42], [CX + Math.cos(a) * 0.42, 15.6, LZ - Math.sin(a) * 0.42], 0.02, yellow, 4)
  // Overhead vapour line to the reflux drum.
  const DX = -2.2
  const DZ = 1.9
  for (const [a, b] of [[[CX, 16.9, CZ], [CX, 17.5, CZ]], [[CX, 17.5, CZ], [CX, 17.5, DZ]], [[CX, 17.5, DZ], [DX, 17.5, DZ]], [[DX, 17.5, DZ], [DX, 2.9, DZ]]]) tube(g, a, b, 0.14, steel, 10)
  for (const p of [[CX, 17.5, CZ], [CX, 17.5, DZ], [DX, 17.5, DZ]]) sph(g, 0.18, steel, ...p, 1, 1, 1, 10)
  cy(g, 0.6, 0.6, 2.4, white, DX, 2.3, DZ, 16, 'x')
  for (const s of [-1, 1]) {
    sph(g, 0.6, white, DX + s * 1.2, 2.3, DZ, 0.4, 1, 1, 14)
    block(g, 0.25, 1.7, 1.0, grey, DX + s * 0.8, Y0, DZ)
  }

  // --- Pipe rack between the column and the flare.
  const RZ = 3.0
  for (const x of [-3.6, -0.4, 2.8, 6.0]) {
    for (const s of [-1, 1]) block(g, 0.25, 5.1, 0.25, grey, x, Y0, RZ + s * 0.8)
    box(g, 0.25, 0.3, 2.0, grey, x, 5.15, RZ)
    box(g, 0.2, 0.2, 1.8, grey, x, 3.0, RZ, 0, false)
  }
  for (const s of [-1, 1]) box(g, 9.9, 0.2, 0.2, grey, 1.2, 5.32, RZ + s * 0.8, 0, false)
  const rackPipes = [[RZ - 0.55, 0.18, steel], [RZ - 0.1, 0.22, yellow], [RZ + 0.35, 0.15, green], [RZ + 0.7, 0.12, red]]
  for (const [z, r, mat] of rackPipes) tube(g, [-4.75, 5.42 + r, z], [7.0, 5.42 + r, z], r, mat, 10)
  for (const [z, r] of rackPipes) cy(g, r + 0.05, r + 0.05, 0.08, dark, 1.2, 5.42 + r, z, 10, 'x') // flanges

  // --- Flare stack with a lattice, feed line and the flame.
  const FX = 8.6
  const FZ = 5.6
  rbox(g, 2.4, 0.5, 2.4, 0.08, concrete, FX, Y0 + 0.25, FZ)
  cy(g, 0.32, 0.4, 14, white, FX, Y0 + 0.5 + 7, FZ, 12)
  for (let i = 0; i < 4; i++) cy(g, 0.37 - i * 0.012, 0.38 - i * 0.012, 1.0, red, FX, 3.4 + i * 3.2, FZ, 12)
  const legs = [0, 2.09, 4.19].map((a) => [Math.cos(a), Math.sin(a)])
  const legAt = (l, h) => {
    const r = 1.1 + (0.38 - 1.1) * (h / 13)
    return [FX + legs[l][0] * r, Y0 + 0.5 + h, FZ + legs[l][1] * r]
  }
  for (let l = 0; l < 3; l++) {
    tube(g, legAt(l, 0), legAt(l, 13), 0.07, grey, 6)
    for (let h = 0; h < 12; h += 3) tube(g, legAt(l, h), legAt((l + 1) % 3, h + 3), 0.035, grey, 4)
  }
  cy(g, 0.45, 0.36, 0.6, dark, FX, 14.92, FZ, 12)
  ring(g, 0.5, 0.05, dark, FX, 15.2, FZ, 'y')
  tube(g, [7.0, 5.64, RZ - 0.1], [FX, 5.64, RZ - 0.1], 0.22, yellow, 10)
  tube(g, [FX, 5.64, RZ - 0.1], [FX, 5.64, FZ - 0.3], 0.22, yellow, 10)
  sph(g, 0.24, yellow, FX, 5.64, RZ - 0.1, 1, 1, 1, 10)
  const flameM = new MeshStandardMaterial({ color: '#ff8a2a', emissive: '#ff6a10', emissiveIntensity: 2.4, transparent: true, opacity: 0.88, depthWrite: false, roughness: 1 })
  const coreM = new MeshStandardMaterial({ color: '#fff2a0', emissive: '#ffd23a', emissiveIntensity: 3, transparent: true, opacity: 0.95, depthWrite: false, roughness: 1 })
  const flame = new Group()
  flame.position.set(FX, 15.2, FZ)
  flame.userData.noCompact = true
  g.add(flame)
  const outer = lathe(flame, [[0.001, 0], [0.6, 0.35], [0.78, 1.0], [0.58, 1.9], [0.26, 2.8], [0.001, 3.4]], flameM, 0, 0, 0, 12)
  const inner = lathe(flame, [[0.001, 0], [0.36, 0.3], [0.44, 0.75], [0.3, 1.35], [0.001, 1.9]], coreM, 0, 0.02, 0, 10)
  for (const m of [outer, inner]) {
    m.castShadow = false
    m.receiveShadow = false
  }
  inner.renderOrder = 1

  // --- Storage tank with a spiral stair.
  const TX = 6.0
  const TZ = -2.2
  const TR = 2.6
  const TH = 3.6
  cy(g, TR + 0.4, TR + 0.4, 0.25, concrete, TX, Y0 + 0.125, TZ, 28)
  cy(g, TR, TR, TH, white, TX, Y0 + 0.25 + TH / 2, TZ, 28)
  cy(g, TR + 0.03, TR + 0.03, 0.4, red, TX, Y0 + 0.25 + TH * 0.66, TZ, 28)
  cy(g, 0.3, TR + 0.08, 0.7, grey, TX, Y0 + 0.25 + TH + 0.35, TZ, 28)
  const top = Y0 + 0.25 + TH
  for (let i = 0; i < 12; i++) {
    const a = -0.25 - (i / 12) * 1.7
    const y = Y0 + 0.25 + ((i + 1) / 12) * TH
    const st = box(g, 0.9, 0.06, 0.32, grate, TX + Math.cos(a) * (TR + 0.45), y, TZ + Math.sin(a) * (TR + 0.45), 0, false)
    st.rotation.y = -a
    if (i % 2 === 0) cy(g, 0.025, 0.025, 1.0, yellow, TX + Math.cos(a) * (TR + 0.88), y + 0.5, TZ + Math.sin(a) * (TR + 0.88), 6, false)
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU
    block(g, 0.04, 0.9, 0.04, yellow, TX + Math.cos(a) * (TR - 0.15), top + 0.15, TZ + Math.sin(a) * (TR - 0.15), 0, false)
  }
  ring(g, TR - 0.15, 0.035, yellow, TX, top + 1.05, TZ, 'y')
  tube(g, [TX - TR, 0.6, TZ + 0.8], [2.8, 0.6, RZ - 0.8], 0.12, steel, 8)

  // --- Pump house with a roll-up door, louvres, a steam vent; pumps on a skid by the column.
  const HX = -1.1
  const HZ = -2.7
  const HW = 5
  const HD = 3.8
  const HH = 3.4
  block(g, HW, HH, HD, tin, HX, Y0, HZ)
  block(g, HW + 0.4, 0.25, HD + 0.4, grey, HX, Y0 + HH, HZ)
  const FZH = HZ - HD / 2
  block(g, 2.4, 2.6, 0.06, M('#c9ced3', { roughness: 0.5, metalness: 0.4 }), HX - 0.7, Y0, FZH - 0.03)
  for (let i = 1; i < 9; i++) box(g, 2.4, 0.03, 0.04, grey, HX - 0.7, Y0 + i * 0.29, FZH - 0.07, 0, false)
  box(g, 2.6, 0.25, 0.25, grey, HX - 0.7, Y0 + 2.72, FZH - 0.1)
  block(g, 0.9, 2.1, 0.06, green, HX + 1.5, Y0, FZH - 0.03)
  block(g, 2.6, 0.04, 0.6, hazard, HX - 0.7, Y0, FZH - 0.4, 0, false)
  for (const x of [HX - 2.2, HX + 0.8]) {
    cy(g, 0.12, 0.12, 1.0, yellow, x, Y0 + 0.5, FZH - 0.9, 10)
    cy(g, 0.125, 0.125, 0.15, dark, x, Y0 + 0.7, FZH - 0.9, 10)
  }
  for (const s of [-1, 1]) block(g, 0.06, 0.9, 1.4, grey, HX + s * (HW / 2 + 0.02), Y0 + 1.6, HZ, 0, false)
  cy(g, 0.22, 0.22, 1.5, steel, HX + 1.6, Y0 + HH + 1.0, HZ + 1.0, 10)
  cy(g, 0.36, 0.36, 0.06, dark, HX + 1.6, Y0 + HH + 1.9, HZ + 1.0, 12)
  for (const s of [-1, 1]) block(g, 0.04, 0.2, 0.04, dark, HX + 1.6 + s * 0.2, Y0 + HH + 1.72, HZ + 1.0, 0, false)
  // Pumps.
  block(g, 3.2, 0.2, 1.6, grey, CX, Y0, -2.4)
  for (const x of [CX - 0.8, CX + 0.8]) {
    cy(g, 0.3, 0.3, 0.5, blue, x, Y0 + 0.6, -2.7, 14, 'z')
    cy(g, 0.26, 0.26, 0.7, green, x, Y0 + 0.6, -2.0, 14, 'z')
    tube(g, [x, Y0 + 0.9, -2.7], [x, 2.6, -2.7], 0.1, steel, 8)
    tube(g, [x, 2.6, -2.7], [x, 2.6, CZ - 1.55], 0.1, steel, 8)
    sph(g, 0.12, steel, x, 2.6, -2.7, 1, 1, 1, 8)
    cy(g, 0.22, 0.22, 0.04, red, x, 1.8, -2.82, 12, 'z') // hand wheel
  }

  // --- REFINERY sign on posts at the front left.
  const signM = signMat('REFINERY', { bg: '#2f3338', fg: '#f2c230', border: '#f2c230' })
  for (const s of [-1, 1]) block(g, 0.22, 3.2, 0.22, yellow, -6.6 + s * 3.2, Y0, -7.2)
  block(g, 6.6, 1.7, 0.14, grey, -6.6, 1.55, -7.15)
  front(g, 6.2, 1.5, signM, -6.6, 2.4, -7.24)
  block(g, 6.6, 0.25, 0.25, hazard, -6.6, Y0 + 0.3, -7.2, 0, false)

  // --- Levels.
  // 1: a Horton sphere on legs.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    tube(lv[0], [9.2 + Math.cos(a) * 1.35, Y0, 1.9 + Math.sin(a) * 1.35], [9.2 + Math.cos(a) * 1.35, 3.2, 1.9 + Math.sin(a) * 1.35], 0.08, grey, 6)
  }
  sph(lv[0], 1.5, white, 9.2, 3.2, 1.9, 1, 1, 1, 18)
  ring(lv[0], 1.5, 0.05, red, 9.2, 3.2, 1.9, 'y')
  // 2: barrels on pallets and a valve manifold.
  for (let i = 0; i < 6; i++) {
    const x = 2.3 + (i % 3) * 0.95
    const z = -6.0 - Math.floor(i / 3) * 0.95
    cy(lv[1], 0.42, 0.42, 1.2, i % 2 ? blue : dark, x, Y0 + 0.15 + 0.6, z, 12)
  }
  block(lv[1], 3.0, 0.15, 2.0, M('#a8723f', { roughness: 0.9 }), 3.25, Y0, -6.45)
  for (let i = 0; i < 3; i++) {
    tube(lv[1], [-4.0, 0.5 + i * 0.45, -0.3], [-0.5, 0.5 + i * 0.45, -0.3], 0.1, steel, 8)
    ring(lv[1], 0.18, 0.03, red, -2.2, 0.5 + i * 0.45, -0.55, 'z')
  }
  // 3: a second, shorter column.
  cy(lv[2], 0.85, 0.85, 10, white, -9.4, Y0 + 5, 6.6, 16)
  lathe(lv[2], [[0.85, 0], [0.7, 0.3], [0.001, 0.5]], white, -9.4, Y0 + 10, 6.6, 16)
  cy(lv[2], 1.4, 1.4, 0.1, grate, -9.4, 7.5, 6.6, 18)
  ring(lv[2], 1.3, 0.04, yellow, -9.4, 8.5, 6.6, 'y')
  for (const y of [3, 5.5, 9]) cy(lv[2], 0.89, 0.89, 0.1, grey, -9.4, y, 6.6, 16)
  tube(lv[2], [-9.4, 9.0, 6.6], [-9.4, 9.0, CZ], 0.12, steel, 8)
  tube(lv[2], [-9.4, 9.0, CZ], [CX - CR, 9.0, CZ], 0.12, steel, 8)
  // 4: aviation lights and a fin-fan cooler on the rack.
  const avi = E('#ff3a2a', 2.5)
  for (const p of [[CX, 17.15, CZ], [FX, 14.2, FZ + 0.42], [CX + CR + 0.05, 11, CZ]]) sph(lv[3], 0.13, avi, ...p, 1, 1, 1, 8)
  block(lv[3], 3.0, 0.5, 1.8, grey, 1.2, 6.25, RZ)
  for (const x of [0.45, 1.95]) {
    ring(lv[3], 0.6, 0.06, dark, x, 6.78, RZ, 'y')
    box(lv[3], 1.1, 0.03, 0.12, dark, x, 6.8, RZ, 0.6, false)
  }

  const setLevel = leveler(lv, signM)
  setLevel(0)

  // --- Animation: flame (flicker / pilot), steam from the vent, a little flare smoke.
  let fk = 0
  let steamT = 0
  let smokeT = 0
  const steam = { color: '#f4f4f2', size: 0.45, grow: 4, life: 2.6, vy: 1.6, a: 0.34, vx: 0.2, vz: 0 }
  const smoke = { color: '#6d6f74', size: 0.5, grow: 4, life: 3.5, vy: 1.2, a: 0.18, vx: 0.3, vz: 0 }
  function update(dt, t, running, fx) {
    fk = ease(fk, running ? 1 : 0, running ? 1.2 : 0.8, dt)
    const s = 0.16 + 0.84 * fk
    const w = 1 + (Math.sin(t * 17) * 0.08 + Math.sin(t * 29.3 + 1) * 0.06) * (0.4 + fk)
    flame.scale.set(s * w, s * (1 + Math.sin(t * 11.7) * 0.14 * fk + Math.sin(t * 23) * 0.07), s * w)
    flame.rotation.y = (t * 0.9) % TAU
    flame.rotation.z = Math.sin(t * 1.3) * 0.12 * fk
    flameM.emissiveIntensity = 1.4 + fk * (1.2 + Math.sin(t * 21) * 0.4)
    coreM.emissiveIntensity = 2 + fk * (1.2 + Math.sin(t * 27 + 2) * 0.4)
    if (running && fx) {
      steamT -= dt
      if (steamT <= 0) {
        steamT = 0.25 + Math.random() * 0.2
        fx.puff(fx.wx + HX + 1.6, Y0 + HH + 2.0, fx.wz + HZ + 1.0, steam)
      }
      smokeT -= dt
      if (smokeT <= 0) {
        smokeT = 0.9 + Math.random() * 0.8
        fx.puff(fx.wx + FX, 15.2 + 3.3 * s, fx.wz + FZ, smoke)
      }
    }
  }
  return { g, update, setLevel, crate: [9.4, -7.4] }
}
