import { CircleGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { E, M, block, gableRoof, prism, signCanvas, signMaterial } from './kit.js'
import { paintConcrete, paintCorrugated, tex } from './textures.js'
import { bx, cy, decal, glass, lens, metal, panel, rbox, ring, sph, tube, tyre } from './detail.js'

// Service buildings for the farm: the vehicle workshop, the fuel station, the
// drive-through car wash, the town's contract board and the helipad. Origin on
// the ground at the footprint's centre, the front faces -Z. No colliders and
// no gating here (the caller does both and runs compact() on the result), so
// moving parts live in their own groups and every static part uses cached
// materials so compaction folds each building to a few draw calls.

const TAU = Math.PI * 2
const FACE = Math.PI // a panel()/plane facing -Z

// --- Shared materials -----------------------------------------------------------------------------------
const mats = new Map()
const once = (key, make) => {
  let m = mats.get(key)
  if (!m) mats.set(key, (m = make()))
  return m
}
const concreteM = () => once('concrete', () => new MeshStandardMaterial({ color: '#ffffff', map: tex(paintConcrete(512, 2), 3, 3), roughness: 0.92 }))
const tinM = (color, rx = 8, ry = 1) => once(`tin${color}${rx}${ry}`, () => new MeshStandardMaterial({ color, map: tex(paintCorrugated(128, 8), rx, ry), roughness: 0.45, metalness: 0.35 }))
const wetM = () => once('wet', () => new MeshStandardMaterial({ color: '#56626c', roughness: 0.06, metalness: 0.35 }))
const puddleM = () => once('puddle', () => new MeshStandardMaterial({ color: '#7fa6c4', roughness: 0.02, metalness: 0.5, transparent: true, opacity: 0.55, depthWrite: false }))
const dark = () => M('#2a2c30', { roughness: 0.6 })
const steel = () => metal('#b8bec4', 0.3)
const yellow = () => M('#f2c230', { roughness: 0.45 })

// A sign face from kit.signCanvas (repaints once Fredoka loads).
const sign = (w, h, opts, emissive = 0) => signMaterial(signCanvas(w, h, opts), { emissive })

// An open-end / ring spanner silhouette (canvas), holes painted in `hole`.
function spanner(ctx, x, y, len, ang, color, hole) {
  const w = len * 0.13
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(-len / 2, -w / 2, len, w, w / 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(len / 2, 0, w * 1.35, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-len / 2, 0, w * 1.15, 0, TAU)
  ctx.fill()
  ctx.fillStyle = hole
  ctx.fillRect(len / 2 + w * 0.15, -w * 0.5, w * 1.4, w)
  ctx.beginPath()
  ctx.arc(-len / 2, 0, w * 0.6, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// --- Workshop ---------------------------------------------------------------------------------------------
// 16 x 12 m: a tin-clad shed (15 x 10.5 m) behind a 1.5 m front apron. A big
// roll-up door (rolled up: drum box, the bottom slats and guide rails) on the
// front, a WORKSHOP sign with a spanner over it, a side door and window, wall
// lamps; inside a two-post car lift, pegboard tool walls, a workbench with a
// vice, a red tool chest, a compressor, ceiling lights and the bay markings;
// outside stacked tyres and oil drums. The door opening is 8 m wide x 4.6 m
// high, centred at x = -1.5 (x -5.5 .. 2.5).
export function workshop() {
  const g = new Group()
  const W = 15
  const D = 10.5
  const Z0 = -4.5 // front wall
  const ZC = Z0 + D / 2 // 0.75
  const H = 6.2
  const DX = -1.5 // door centre
  const DW = 8
  const DH = 4.6
  const wall = tinM('#8ea3b4', 10, 1)
  const trim = M('#f4f1e8', { roughness: 0.6 })
  const red = M('#c8302a', { roughness: 0.45 })
  const wood = M('#a8723f', { roughness: 0.85 })
  // Slab and apron.
  block(g, 16, 0.12, 12, concreteM(), 0, 0, 0)
  for (const x of [DX - DW / 2 + 0.6, DX + DW / 2 - 0.6]) block(g, 0.12, 0.02, 9.5, yellow(), x, 0.12, ZC + 0.2, 0, false)
  block(g, DW - 1.2, 0.02, 0.12, yellow(), DX, 0.12, 4.8, 0, false)
  // Walls: sides, back, and the front around the door.
  for (const s of [-1, 1]) block(g, 0.3, H, D, wall, s * (W / 2 - 0.15), 0.12, ZC)
  block(g, W, H, 0.3, wall, 0, 0.12, Z0 + D - 0.15)
  block(g, DX - DW / 2 + W / 2, H, 0.3, wall, (-W / 2 + DX - DW / 2) / 2, 0.12, Z0 + 0.15)
  block(g, W / 2 - (DX + DW / 2), H, 0.3, wall, (W / 2 + DX + DW / 2) / 2, 0.12, Z0 + 0.15)
  block(g, DW, H - DH, 0.3, wall, DX, 0.12 + DH, Z0 + 0.15)
  // Gable ends and the roof (ridge along X).
  const rise = (D / 2) * Math.tan((12 * Math.PI) / 180)
  for (const s of [-1, 1]) prism(g, D, rise, 0.3, wall, s * (W / 2 - 0.15), 0.12 + H, ZC, Math.PI / 2)
  gableRoof(g, W, D, 0.12 + H, 12, tinM('#b5432f', 12, 2), { overhang: 0.45, thick: 0.14, axis: 'x', cz: ZC, trim })
  // Corner trims and the door surround.
  for (const s of [-1, 1]) for (const z of [Z0, Z0 + D]) block(g, 0.36, H, 0.36, trim, s * (W / 2 - 0.15), 0.12, z + (z === Z0 ? 0.15 : -0.15))
  for (const x of [DX - DW / 2, DX + DW / 2]) block(g, 0.3, DH, 0.4, trim, x, 0.12, Z0 + 0.1)
  block(g, DW + 0.6, 0.3, 0.4, trim, DX, 0.12 + DH, Z0 + 0.1)
  // Roll-up door: drum box, the bottom of the curtain with its yellow edge, guide rails.
  block(g, DW + 0.2, 0.7, 0.7, dark(), DX, 0.12 + DH - 0.05, Z0 + 0.6)
  block(g, DW - 0.1, 0.9, 0.06, tinM('#d9dde1', 1, 6), DX, 0.12 + DH - 0.9, Z0 + 0.42)
  block(g, DW - 0.1, 0.12, 0.08, yellow(), DX, 0.12 + DH - 0.98, Z0 + 0.42)
  for (const x of [DX - DW / 2 + 0.1, DX + DW / 2 - 0.1]) block(g, 0.14, DH, 0.18, steel(), x, 0.12, Z0 + 0.42)
  // Sign over the door: WORKSHOP with a spanner.
  const signM = decal(1024, 208, (ctx, w, h) => {
    ctx.fillStyle = '#1d3a6a'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 24)
    ctx.fill()
    ctx.lineWidth = 10
    ctx.strokeStyle = '#f2c230'
    ctx.beginPath()
    ctx.roundRect(8, 8, w - 16, h - 16, 18)
    ctx.stroke()
    spanner(ctx, 150, h / 2, 170, -0.6, '#f2c230', '#1d3a6a')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 128px Fredoka, Arial, sans-serif'
    ctx.lineWidth = 14
    ctx.strokeStyle = '#0d1f3a'
    ctx.strokeText('WORKSHOP', 600, h / 2 + 6)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('WORKSHOP', 600, h / 2 + 6)
  })
  signM.transparent = false
  panel(g, 6.5, 1.32, signM, DX, 0.12 + DH + 0.8, Z0 - 0.02, FACE)
  // Side door, window, lamps.
  block(g, 1.0, 2.2, 0.06, M('#3a5a7a', { roughness: 0.5 }), 5.8, 0.12, Z0 - 0.03)
  block(g, 0.06, 0.06, 0.2, steel(), 5.45, 1.15, Z0 - 0.1)
  block(g, 1.7, 1.1, 0.06, E('#ffe2a0', 0.4), 3.9, 1.5, Z0 - 0.03)
  block(g, 1.9, 0.12, 0.16, trim, 3.9, 1.44, Z0 - 0.06)
  block(g, 0.08, 1.1, 0.08, trim, 3.9, 1.5, Z0 - 0.07)
  block(g, 1.7, 0.08, 0.08, trim, 3.9, 2.0, Z0 - 0.07)
  block(g, 1.9, 0.08, 0.1, trim, 3.9, 2.6, Z0 - 0.06)
  const warm = lens('#ffcf7a', 1.6)
  for (const x of [DX - DW / 2 - 0.7, DX + DW / 2 + 0.7, 5.8]) {
    block(g, 0.08, 0.08, 0.35, dark(), x, 0.12 + (x === 5.8 ? 2.6 : DH - 0.4), Z0 - 0.15)
    rbox(g, 0.3, 0.24, 0.22, 0.04, dark(), x, 0.12 + (x === 5.8 ? 2.55 : DH - 0.45), Z0 - 0.38)
    rbox(g, 0.24, 0.06, 0.18, 0.02, warm, x, 0.12 + (x === 5.8 ? 2.42 : DH - 0.58), Z0 - 0.38)
  }
  // Ceiling lights.
  const ceil = E('#fff6e0', 1.4)
  for (const x of [-5, -1.5, 2, 5.2]) for (const z of [-1.5, 3]) block(g, 0.3, 0.06, 2.4, ceil, x, 0.12 + H - 0.4, z, 0, false)
  for (const x of [-5, -1.5, 2, 5.2]) for (const z of [-1.5, 3]) block(g, 0.04, 0.4, 0.04, dark(), x, 0.12 + H - 0.36, z, 0, false)
  // Two-post car lift in the bay (lane along Z at x = DX).
  const LZ = 1.6
  for (const s of [-1, 1]) {
    const px = DX + s * 2.9
    block(g, 0.7, 0.04, 0.7, steel(), px, 0.12, LZ)
    block(g, 0.36, 4.3, 0.36, yellow(), px, 0.12, LZ)
    block(g, 0.5, 0.4, 0.5, dark(), px, 0.95, LZ) // carriage
    for (const dz of [-1, 1]) {
      const arm = bx(g, 1.6, 0.1, 0.16, yellow(), px - s * 0.8, 1.27, LZ + dz * 0.45)
      arm.rotation.y = s * dz * 0.35
      cy(g, 0.12, 0.12, 0.08, M('#1c1c1e', { roughness: 0.9 }), px - s * 1.5, 1.36, LZ + dz * 0.75, 12)
    }
    block(g, 0.3, 0.5, 0.2, red, px + s * 0.28, 1.6, LZ) // control box (one each side)
  }
  block(g, 6.2, 0.2, 0.3, yellow(), DX, 0.12 + 4.3, LZ)
  tube(g, [DX - 2.9, 4.2, LZ + 0.2], [DX + 2.9, 4.2, LZ + 0.2], 0.025, dark())
  // Tool walls (pegboards with tool silhouettes).
  const peg = decal(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#c9a678'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(80,50,20,0.45)'
    for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) ctx.fillRect(x - 2, y - 2, 4, 4)
    const c = '#3a3d42'
    for (let i = 0; i < 6; i++) spanner(ctx, 90 + i * 34, 130 + i * 6, 120 + i * 18, Math.PI / 2, c, '#c9a678')
    // Hammer, screwdrivers, saw, pliers.
    ctx.fillStyle = '#7a4a26'
    ctx.fillRect(390, 80, 18, 200)
    ctx.fillStyle = c
    ctx.fillRect(355, 60, 90, 36)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = ['#d6322c', '#f2c230', '#2f6fd0', '#3f8a4a', '#f07a24'][i]
      ctx.beginPath()
      ctx.roundRect(500 + i * 38, 70, 24, 80, 8)
      ctx.fill()
      ctx.fillStyle = '#9aa0a6'
      ctx.fillRect(508 + i * 38, 150, 8, 90 + i * 8)
    }
    ctx.fillStyle = '#9aa0a6'
    ctx.beginPath()
    ctx.moveTo(720, 90)
    ctx.lineTo(960, 110)
    ctx.lineTo(960, 160)
    ctx.lineTo(720, 140)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#7a4a26'
    ctx.beginPath()
    ctx.roundRect(680, 80, 60, 70, 14)
    ctx.fill()
    ctx.strokeStyle = c
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    for (const x of [760, 860]) {
      ctx.beginPath()
      ctx.moveTo(x, 330)
      ctx.lineTo(x + 30, 230)
      ctx.lineTo(x + 40, 200)
      ctx.moveTo(x + 60, 330)
      ctx.lineTo(x + 30, 230)
      ctx.lineTo(x + 20, 200)
      ctx.stroke()
    }
  })
  peg.transparent = false
  panel(g, 4.2, 1.6, peg, 4.0, 2.4, Z0 + D - 0.31, FACE)
  panel(g, 5.0, 1.9, peg, -W / 2 + 0.31, 2.5, 1.8, Math.PI / 2)
  // Workbench with a vice and a drill, the tool chest, a compressor, a hose reel.
  block(g, 4.2, 0.08, 0.8, wood, 4.0, 0.95, Z0 + D - 0.75)
  for (const x of [2.05, 5.95]) for (const dz of [-0.3, 0.3]) block(g, 0.08, 0.95, 0.08, dark(), x, 0.12, Z0 + D - 0.75 + dz)
  block(g, 4.0, 0.05, 0.7, wood, 4.0, 0.35, Z0 + D - 0.75)
  block(g, 0.3, 0.2, 0.25, metal('#5a6068', 0.4), 2.6, 1.03, Z0 + D - 0.55)
  block(g, 0.08, 0.12, 0.3, metal('#5a6068', 0.4), 2.6, 1.23, Z0 + D - 0.45)
  rbox(g, 0.18, 0.28, 0.3, 0.03, M('#2f6fd0', { roughness: 0.5, metalness: 0.3 }), 3.4, 1.17, Z0 + D - 0.8)
  rbox(g, 0.8, 1.15, 0.55, 0.04, red, 6.6, 0.7, 3.4)
  for (let i = 0; i < 5; i++) block(g, 0.7, 0.025, 0.02, metal('#d9dde1', 0.2), 6.6, 0.32 + i * 0.2, 3.4 - 0.29, 0, false)
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.2, 0.2]) sph(g, 0.06, dark(), 6.6 + dx, 0.17, 3.4 + dz)
  cy(g, 0.35, 0.35, 1.3, red, -6.5, 0.6, 4.7, 16).rotation.x = Math.PI / 2
  block(g, 0.5, 0.35, 0.4, dark(), -6.5, 0.95, 4.7)
  ring(g, 0.3, 0.06, red, -W / 2 + 0.36, 2.0, -0.8, 'x')
  // Outside: stacked tyres and oil drums on the apron.
  const stacks = [[-6.6, -5.3, 4], [-5.7, -5.55, 3], [3.4, -5.4, 2]]
  for (const [x, z, n] of stacks) {
    for (let i = 0; i < n; i++) {
      const t = tyre(0.42, 0.26, { lugs: 18 })
      t.rotation.z = Math.PI / 2
      t.rotation.y = i * 0.7
      t.position.set(x, 0.12 + 0.13 + i * 0.27, z)
      g.add(t)
    }
  }
  const lean = tyre(0.42, 0.26, { lugs: 18 })
  lean.position.set(-7.0, 0.53, -4.78)
  lean.rotation.set(0.25, Math.PI / 2, 0)
  g.add(lean)
  const drum = (x, z, col) => {
    cy(g, 0.3, 0.3, 0.88, M(col, { roughness: 0.5, metalness: 0.3 }), x, 0.56, z, 18)
    for (const y of [0.34, 0.78]) ring(g, 0.305, 0.022, M(col, { roughness: 0.5, metalness: 0.3 }), x, y, z, 'y')
    cy(g, 0.05, 0.05, 0.04, dark(), x + 0.14, 1.02, z, 8)
  }
  drum(4.4, -5.4, '#2f6fd0')
  drum(5.05, -5.25, '#c8302a')
  drum(4.7, -5.95 + 0.25, '#2f6fd0')
  for (const x of [DX - DW / 2 - 0.35, DX + DW / 2 + 0.35]) {
    cy(g, 0.12, 0.12, 1.0, yellow(), x, 0.62, Z0 - 0.4, 12)
    cy(g, 0.125, 0.125, 0.12, dark(), x, 0.85, Z0 - 0.4, 12)
  }
  return { g }
}

// --- Fuel station -------------------------------------------------------------------------------------------
// 10 x 8 m: a concrete forecourt, a pump island along Z (lanes either side at
// about x = -2.4 and +2.4) with two pumps, hoses and nozzles, a canopy on four
// posts with lit panels under it and a FUEL fascia, a lit price pylon at the
// front-right corner, bollards, a bin and an air / water post.
export function fuelStation() {
  const g = new Group()
  const white = M('#f4f1e8', { roughness: 0.5 })
  const red = M('#d6322c', { roughness: 0.4 })
  block(g, 10, 0.1, 8, concreteM(), 0, 0, 0)
  for (const s of [-1, 1]) block(g, 0.12, 0.02, 7.6, white, s * 1.25, 0.1, 0, 0, false)
  // Island with end bollards.
  rbox(g, 1.3, 0.22, 5.4, 0.05, M('#c9c6bf', { roughness: 0.85 }), 0, 0.2, 0)
  block(g, 1.34, 0.05, 5.44, yellow(), 0, 0.26, 0, 0, false)
  for (const z of [-2.85, 2.85]) {
    cy(g, 0.12, 0.12, 1.0, yellow(), 0, 0.8, z, 12)
    cy(g, 0.125, 0.125, 0.1, dark(), 0, 1.0, z, 12)
  }
  // Pumps (displays and nozzles on both lane sides, ±X).
  const screen = E('#9fe8ff', 1.1)
  const hose = M('#1c1c1e', { roughness: 0.8 })
  for (const z of [-1.35, 1.35]) {
    rbox(g, 0.8, 0.12, 1.1, 0.03, dark(), 0, 0.37, z)
    rbox(g, 0.55, 1.75, 0.95, 0.06, red, 0, 1.3, z)
    rbox(g, 0.6, 0.32, 1.0, 0.06, white, 0, 2.3, z)
    rbox(g, 0.62, 0.12, 1.02, 0.04, E('#ffe08a', 0.9), 0, 2.52, z)
    for (const s of [-1, 1]) {
      block(g, 0.02, 0.32, 0.55, screen, s * 0.285, 1.65, z, 0, false)
      block(g, 0.02, 0.25, 0.4, dark(), s * 0.285, 1.25, z, 0, false)
      rbox(g, 0.12, 0.3, 0.16, 0.03, dark(), s * 0.33, 1.05, z + 0.3) // holster
      rbox(g, 0.1, 0.22, 0.08, 0.02, M('#3f8a4a', { roughness: 0.5 }), s * 0.36, 1.12, z + 0.3) // nozzle
      tube(g, [s * 0.36, 1.0, z + 0.3], [s * 0.36, 0.86, z + 0.38], 0.02, dark())
      // The hose loops down from the top of the pump to the nozzle.
      const pts = [[s * 0.3, 1.95, z - 0.3], [s * 0.45, 1.3, z - 0.32], [s * 0.5, 0.75, z - 0.15], [s * 0.45, 0.7, z + 0.15], [s * 0.38, 0.95, z + 0.3]]
      for (let i = 0; i < pts.length - 1; i++) tube(g, pts[i], pts[i + 1], 0.035, hose, 6)
    }
  }
  // Canopy on four posts, lit panels under it, the FUEL fascia.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      cy(g, 0.14, 0.14, 4.5, white, sx * 3.2, 2.35, sz * 2.4, 12)
      cy(g, 0.2, 0.22, 0.6, red, sx * 3.2, 0.4, sz * 2.4, 12)
    }
  }
  block(g, 8.4, 0.8, 6.4, white, 0, 4.6, 0)
  block(g, 8.46, 0.2, 6.46, red, 0, 4.66, 0)
  block(g, 8.46, 0.08, 6.46, yellow(), 0, 4.88, 0)
  const lit = E('#fffbe8', 2.2)
  for (const x of [-2.4, 0, 2.4]) for (const z of [-1.6, 1.6]) block(g, 1.3, 0.04, 0.7, lit, x, 4.57, z, 0, false)
  const fascia = sign(1024, 128, { bg: '#f4f1e8', lines: [{ text: 'FUEL · DIESEL · PETROL', size: 84, color: '#d6322c' }] })
  panel(g, 4.0, 0.5, fascia, 0, 5.15, -3.24, FACE)
  panel(g, 4.0, 0.5, fascia, 0, 5.15, 3.24)
  // Price pylon (lit) at the front-right corner.
  cy(g, 0.1, 0.1, 2.0, steel(), 4.2, 1.1, -3.45, 10)
  cy(g, 0.1, 0.1, 2.0, steel(), 4.9, 1.1, -3.45, 10)
  rbox(g, 1.3, 2.3, 0.22, 0.05, M('#1d3a6a', { roughness: 0.5 }), 4.55, 3.2, -3.45)
  const board = sign(256, 448, { bg: '#1d3a6a', border: '#f2c230', borderWidth: 10, radius: 18, lines: [{ text: 'FUEL', size: 92, color: '#ffffff', stroke: '#0d1f3a' }, { text: 'DIESEL', size: 40, color: '#9fe8ff', gap: 1.0 }, { text: '1.89', size: 76, color: '#ffd23a' }, { text: 'PETROL', size: 40, color: '#9fe8ff', gap: 1.0 }, { text: '2.09', size: 76, color: '#ffd23a' }] }, 0.7)
  panel(g, 1.16, 2.1, board, 4.55, 3.2, -3.565, FACE)
  block(g, 1.0, 0.1, 0.6, concreteM(), 4.55, 0.1, -3.45)
  // Bin and an air / water post by the island ends.
  cy(g, 0.25, 0.22, 0.85, M('#3f8a4a', { roughness: 0.5 }), 0.0, 0.73, -3.2, 14)
  rbox(g, 0.35, 1.2, 0.3, 0.04, M('#2f6fd0', { roughness: 0.45 }), 0.0, 0.7, 3.35)
  rbox(g, 0.28, 0.2, 0.02, 0.02, screen, 0.0, 1.05, 3.19)
  return { g }
}

// --- Car wash ---------------------------------------------------------------------------------------------
// Drive-through, 10 m wide (X) x 14 m long (Z), open at both ends; vehicles
// drive through along Z (lane centre x = 0, about 4 m clear between the side
// brushes). Low side walls with glass above, a flat roof with coloured CAR WASH
// signs over both openings, the wash gantries: two big vertical brushes
// (x = ±2.4, z = -1.2, spinning about Y) and a top brush (y = 3.9, z = 1.6,
// spinning about X), a spray arch with nozzles near the entrance, a dryer arch
// near the exit, soap tanks, a pay post and a traffic light at the -Z entrance,
// and a wet, shiny floor with puddles and a drain.
export function carWash() {
  const g = new Group()
  const W = 10
  const L = 14
  const H = 5.2
  const white = M('#f4f1e8', { roughness: 0.5 })
  const blue = M('#2f6fd0', { roughness: 0.4 })
  const frameM = metal('#4a7fb8', 0.35)
  // Floor, drain, puddles.
  block(g, W, 0.1, L, wetM(), 0, 0, 0)
  block(g, 0.4, 0.02, L - 1, M('#1f2226', { roughness: 0.5, metalness: 0.4 }), 0, 0.1, 0, 0, false)
  const puddleGeo = new CircleGeometry(1, 20)
  for (let i = 0; i < 6; i++) {
    const p = new Mesh(puddleGeo, puddleM())
    p.rotation.x = -Math.PI / 2
    p.position.set([-1.3, 1.6, -0.6, 1.1, -1.9, 0.4][i], 0.105, [-4.8, -3.0, 0.8, 2.9, 4.6, 5.8][i])
    const r = 0.6 + (i % 3) * 0.35
    p.scale.set(r, r * (0.6 + (i % 2) * 0.3), 1)
    g.add(p)
  }
  // Side walls: a low wall, glass panels between posts, a top band.
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.15)
    block(g, 0.3, 1.2, L, white, x, 0.1, 0)
    block(g, 0.08, H - 1.6, L, glass(), x, 1.3, 0, 0, false)
    for (let i = 0; i <= 5; i++) block(g, 0.34, H - 1.2, 0.2, frameM, x, 1.3, -L / 2 + 0.1 + i * ((L - 0.2) / 5))
    block(g, 0.34, 0.4, L, blue, x, 0.1 + H - 0.4, 0)
  }
  // Roof and fascias over both openings with the signs.
  block(g, W + 0.4, 0.4, L + 0.4, white, 0, 0.1 + H, 0)
  for (const s of [-1, 1]) {
    block(g, W + 0.4, 1.3, 0.3, blue, 0, 0.1 + H + 0.2, s * (L / 2 + 0.05))
    block(g, W + 0.4, 0.12, 0.34, yellow(), 0, 0.1 + H + 0.12, s * (L / 2 + 0.05))
    block(g, 0.4, H, 0.4, frameM, -W / 2 + 0.2, 0.1, s * (L / 2 - 0.2))
    block(g, 0.4, H, 0.4, frameM, W / 2 - 0.2, 0.1, s * (L / 2 - 0.2))
  }
  const washSign = decal(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#1d58b0'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 30)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    for (const [x, y, r] of [[60, 40, 22], [110, 110, 30], [930, 50, 26], [980, 115, 18], [880, 120, 14], [170, 45, 12]]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
    }
    ctx.font = '700 118px Fredoka, Arial, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.lineJoin = 'round'
    const text = 'CAR WASH'
    const cols = ['#ff5a5a', '#ffb02e', '#ffe14a', '#ffffff', '#5ce07a', '#4fd2ff', '#b48cff', '#ff7ac8']
    let total = 0
    for (const ch of text) total += ctx.measureText(ch).width
    let x = (w - total) / 2
    text.split('').forEach((ch, i) => {
      ctx.lineWidth = 14
      ctx.strokeStyle = '#0d2a5a'
      ctx.strokeText(ch, x, h / 2 + 6)
      ctx.fillStyle = cols[i]
      ctx.fillText(ch, x, h / 2 + 6)
      x += ctx.measureText(ch).width
    })
  })
  washSign.transparent = false
  panel(g, 8.2, 1.1, washSign, 0, 0.1 + H + 0.85, -L / 2 - 0.22, FACE)
  panel(g, 8.2, 1.1, washSign, 0, 0.1 + H + 0.85, L / 2 + 0.22)
  // Gantries: one carrying the side brushes, one the top brush.
  const ZB = -1.2
  const ZT = 1.6
  for (const z of [ZB, ZT]) {
    for (const s of [-1, 1]) block(g, 0.3, 4.6, 0.3, frameM, s * 3.6, 0.1, z)
    block(g, 7.5, 0.35, 0.35, frameM, 0, 4.7, z)
  }
  for (const s of [-1, 1]) {
    block(g, 0.5, 0.45, 0.5, steel(), s * 2.4, 4.25, ZB) // brush motors
    block(g, 0.12, 0.6, 0.12, steel(), s * 2.4, 3.7, ZB)
    block(g, 0.2, 1.0, 0.2, steel(), s * 2.4, 3.7, ZT) // top brush hangers
  }
  // Spray arch (entrance) and dryer arch (exit).
  const pipe = metal('#c7ccd1', 0.25)
  for (const s of [-1, 1]) tube(g, [s * 3.4, 0.2, -4.6], [s * 3.4, 4.3, -4.6], 0.06, pipe)
  tube(g, [-3.4, 4.3, -4.6], [3.4, 4.3, -4.6], 0.06, pipe)
  for (let i = 0; i < 9; i++) {
    cy(g, 0.04, 0.03, 0.12, blue, -3.2 + i * 0.8, 4.18, -4.6, 6)
    for (const s of [-1, 1]) {
      const n = cy(g, 0.04, 0.03, 0.12, blue, s * 3.3, 0.6 + i * 0.42, -4.6, 6)
      n.rotation.z = s * Math.PI / 2
    }
  }
  for (const s of [-1, 1]) block(g, 0.25, 4.4, 0.25, frameM, s * 3.6, 0.1, 4.8)
  rbox(g, 7.4, 0.5, 0.9, 0.12, white, 0, 4.4, 4.8)
  for (const s of [-1, 1]) rbox(g, 0.7, 2.6, 0.9, 0.15, white, s * 3.3, 2.2, 4.8)
  for (let i = 0; i < 6; i++) block(g, 0.9, 0.04, 0.5, dark(), -2.5 + i * 1.0, 4.13, 4.8, 0, false)
  // Soap tanks and pipes on the right wall.
  for (const [i, col] of ['#ff7ac8', '#4fd2ff', '#ffe14a'].entries()) {
    cy(g, 0.28, 0.28, 1.1, M(col, { roughness: 0.25, transparent: true, opacity: 0.85 }), W / 2 - 0.6, 1.9, 3.6 + i * 0.75, 14)
    tube(g, [W / 2 - 0.6, 2.45, 3.6 + i * 0.75], [W / 2 - 0.6, 4.3, 3.6 + i * 0.75], 0.03, pipe)
  }
  tube(g, [W / 2 - 0.6, 4.3, 3.6], [W / 2 - 0.6, 4.3, ZT], 0.04, pipe)
  // Pay post and the traffic light at the entrance.
  rbox(g, 0.5, 1.4, 0.4, 0.06, dark(), 3.0, 0.8, -L / 2 - 0.4)
  rbox(g, 0.36, 0.28, 0.02, 0.02, E('#9fe8ff', 1.1), 3.0, 1.2, -L / 2 - 0.61)
  block(g, 1.2, 0.12, 0.6, yellow(), 3.0, 0.1, -L / 2 - 0.4)
  const stop = lens('#ff2a1a', 0.2)
  const go = lens('#3aff6a', 2.5)
  rbox(g, 0.36, 0.8, 0.25, 0.05, dark(), W / 2 - 0.2, 3.2, -L / 2 - 0.12)
  sph(g, 0.11, stop, W / 2 - 0.2, 3.4, -L / 2 - 0.25)
  sph(g, 0.11, go, W / 2 - 0.2, 3.0, -L / 2 - 0.25)

  // Brushes: soft fins round an axle, two colours.
  const finA = M('#2f8be0', { roughness: 0.9 })
  const finB = M('#ff6aa8', { roughness: 0.9 })
  const brushes = []
  for (const s of [-1, 1]) {
    const b = new Group()
    b.position.set(s * 2.4, 0, ZB)
    cy(b, 0.06, 0.06, 3.5, dark(), 0, 1.95, 0, 8)
    for (const y of [0.32, 3.42]) cy(b, 0.2, 0.2, 0.08, dark(), 0, y, 0, 12)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU
      const f = bx(b, 0.07, 3.0, 0.42, i % 2 ? finA : finB, Math.sin(a) * 0.32, 1.87, Math.cos(a) * 0.32)
      f.rotation.y = a
    }
    g.add(b)
    brushes.push(b)
  }
  const top = new Group()
  top.position.set(0, 3.9, ZT)
  cy(top, 0.06, 0.06, 4.6, dark(), 0, 0, 0, 8).rotation.z = Math.PI / 2
  for (const x of [-2.2, 2.2]) {
    const c = cy(top, 0.2, 0.2, 0.08, dark(), x, 0, 0, 12)
    c.rotation.z = Math.PI / 2
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    const f = bx(top, 4.2, 0.07, 0.4, i % 2 ? finA : finB, 0, Math.sin(a) * 0.3, Math.cos(a) * 0.3)
    f.rotation.x = -a
  }
  g.add(top)
  brushes.push(top)

  return {
    g,
    brushes,
    // on: washing (fast brushes, red light); otherwise idling slowly (green).
    update(dt, t, on) {
      const v = on ? 9 : 0.4
      brushes[0].rotation.y += dt * v
      brushes[1].rotation.y -= dt * v
      top.rotation.x += dt * (on ? 7 : 0.3)
      stop.emissiveIntensity = on ? 3 : 0.2
      go.emissiveIntensity = on ? 0.2 : 2.5 + Math.sin(t * 2) * 0.3
    },
  }
}

// --- Contract board -----------------------------------------------------------------------------------------
// A town notice board about 4.3 m wide on two posts with a little shingled
// roof and a lantern; the cork face (3.9 x 2.2 m, facing -Z) is a canvas that
// paint(lines) redraws with up to three pinned contract cards
// ([{ title, sub, color }]; an empty list shows a "no contracts" card).
function wrapText(ctx, text, maxW, maxLines) {
  const out = []
  let line = ''
  for (const w of String(text ?? '').split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w
    if (line && ctx.measureText(t).width > maxW) {
      out.push(line)
      line = w
    } else line = t
  }
  if (line) out.push(line)
  if (out.length > maxLines) {
    out.length = maxLines
    out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'
  }
  return out
}
export function contractBoard() {
  const g = new Group()
  const wood = M('#7a4a26', { roughness: 0.85 })
  const woodLight = M('#a8723f', { roughness: 0.85 })
  // Posts with stone footings, the board, a frame, a ledge, the roof.
  for (const s of [-1, 1]) {
    block(g, 0.18, 3.7, 0.18, wood, s * 2.15, 0, 0)
    rbox(g, 0.42, 0.25, 0.42, 0.06, M('#8f8a80', { roughness: 0.95 }), s * 2.15, 0.12, 0)
  }
  block(g, 4.2, 2.5, 0.12, woodLight, 0, 0.85, 0.02)
  for (const y of [0.85, 3.35]) block(g, 4.34, 0.12, 0.2, wood, 0, y - 0.06, -0.02)
  for (const s of [-1, 1]) block(g, 0.12, 2.6, 0.2, wood, s * 2.11, 0.79, -0.02)
  block(g, 4.0, 0.06, 0.22, wood, 0, 0.84, -0.14)
  gableRoof(g, 4.6, 0.9, 3.7, 28, M('#5a3a2a', { roughness: 0.8 }), { overhang: 0.25, thick: 0.08, axis: 'x', trim: M('#f4f1e8', { roughness: 0.6 }) })
  prism(g, 0.9, 0.24, 4.4, wood, 0, 3.7, 0, Math.PI / 2)
  const warm = lens('#ffcf7a', 1.4)
  tube(g, [0, 3.65, -0.1], [0, 3.55, -0.42], 0.02, dark())
  rbox(g, 0.18, 0.16, 0.18, 0.03, dark(), 0, 3.48, -0.45)
  rbox(g, 0.12, 0.05, 0.12, 0.02, warm, 0, 3.38, -0.45)

  // The canvas face.
  let current = []
  const draw = (ctx, w, h) => {
    ctx.fillStyle = '#c8955a'
    ctx.fillRect(0, 0, w, h)
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(90,50,20,0.25)' : 'rgba(255,230,190,0.18)'
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 3)
    }
    // Header ribbon.
    ctx.fillStyle = '#2f5d34'
    ctx.beginPath()
    ctx.roundRect(w / 2 - 230, 14, 460, 84, 16)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 60px Fredoka, Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('CONTRACTS', w / 2, 58)
    const cards = current.length ? current.slice(0, 3) : [{ title: 'No contracts yet', sub: 'Check back soon!', color: '#9aa0a6' }]
    const cw = 296
    const ch = 430
    const gap = 36
    const x0 = (w - (cards.length * cw + (cards.length - 1) * gap)) / 2
    cards.forEach((c, i) => {
      ctx.save()
      ctx.translate(x0 + i * (cw + gap) + cw / 2, 124 + ch / 2)
      ctx.rotate([-0.025, 0.018, -0.012][i])
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.roundRect(-cw / 2 + 8, -ch / 2 + 10, cw, ch, 14)
      ctx.fill()
      ctx.fillStyle = '#fffaf0'
      ctx.beginPath()
      ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 14)
      ctx.fill()
      ctx.fillStyle = c.color ?? '#3f8a4a'
      ctx.beginPath()
      ctx.roundRect(-cw / 2, -ch / 2, cw, 70, [14, 14, 0, 0])
      ctx.fill()
      // Pin.
      ctx.fillStyle = '#d6322c'
      ctx.beginPath()
      ctx.arc(0, -ch / 2 + 12, 16, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(-5, -ch / 2 + 7, 5, 0, TAU)
      ctx.fill()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#2a2c30'
      ctx.font = '700 44px Fredoka, Arial, sans-serif'
      let y = -ch / 2 + 92
      for (const l of wrapText(ctx, c.title, cw - 36, 3)) {
        ctx.fillText(l, 0, y)
        y += 50
      }
      y += 14
      ctx.fillStyle = '#5a5f66'
      ctx.font = '600 32px Fredoka, Arial, sans-serif'
      for (const l of wrapText(ctx, c.sub, cw - 40, 5)) {
        ctx.fillText(l, 0, y)
        y += 38
      }
      ctx.restore()
    })
  }
  const face = decal(1024, 576, (ctx, w, h) => draw(ctx, w, h))
  face.transparent = false
  const texture = face.map
  panel(g, 3.9, 2.2, face, 0, 2.1, -0.06, FACE)
  return {
    g,
    // lines: [{ title, sub, color }] (up to 3 are shown).
    paint(lines = []) {
      current = Array.isArray(lines) ? lines : []
      const c = texture.image
      const ctx = c.getContext('2d')
      ctx.clearRect(0, 0, c.width, c.height)
      draw(ctx, c.width, c.height)
      texture.needsUpdate = true
    },
  }
}

// --- Helipad ----------------------------------------------------------------------------------------------
// 12 x 12 m: a round concrete pad (11.6 m across, 0.3 m high) with the yellow
// circle and white H (readable from -Z), green edge lights, two low
// floodlights at the front corners and a windsock pole at the back-right
// corner (the `sock` group turns about Y to point downwind; it streams +Z).
export function helipad() {
  const g = new Group()
  cy(g, 5.8, 5.9, 0.3, concreteM(), 0, 0.15, 0, 48)
  const marks = decal(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5d6066'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#f2c230'
    ctx.lineWidth = 26
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.41, 0, TAU)
    ctx.stroke()
    ctx.strokeStyle = '#f4f1e8'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.485, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = '#f4f1e8'
    const hw = w * 0.2
    const hh = h * 0.3
    const bar = w * 0.06
    ctx.fillRect(w / 2 - hw, h / 2 - hh, bar, hh * 2)
    ctx.fillRect(w / 2 + hw - bar, h / 2 - hh, bar, hh * 2)
    ctx.fillRect(w / 2 - hw, h / 2 - bar / 2, hw * 2, bar)
  })
  marks.transparent = false
  const top = new Mesh(new CircleGeometry(5.55, 64), marks)
  top.rotation.set(-Math.PI / 2, 0, Math.PI)
  top.position.y = 0.305
  top.receiveShadow = true
  g.add(top)
  const edge = E('#5aff7a', 2.2)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    cy(g, 0.09, 0.11, 0.12, edge, Math.cos(a) * 5.68, 0.36, Math.sin(a) * 5.68, 10)
  }
  // Floodlights at the front corners, aimed at the pad.
  const flood = lens('#fffbe8', 1.2)
  for (const s of [-1, 1]) {
    block(g, 0.4, 0.2, 0.4, concreteM(), s * 5.4, 0, -5.4)
    tube(g, [s * 5.4, 0.2, -5.4], [s * 5.4, 0.9, -5.4], 0.05, steel())
    const head = new Group()
    head.position.set(s * 5.4, 0.95, -5.4)
    head.rotation.y = s > 0 ? -Math.PI / 4 : Math.PI / 4
    rbox(head, 0.36, 0.26, 0.2, 0.04, dark(), 0, 0, 0)
    rbox(head, 0.3, 0.2, 0.03, 0.02, flood, 0, 0, 0.1)
    g.add(head)
  }
  // Windsock pole, cage ring and the sock (turns about Y).
  block(g, 0.6, 0.25, 0.6, concreteM(), 5.3, 0, 5.3)
  cy(g, 0.06, 0.07, 5.2, M('#f4f1e8', { roughness: 0.5 }), 5.3, 2.85, 5.3, 10)
  for (let i = 0; i < 4; i++) cy(g, 0.071, 0.071, 0.4, M('#d6322c', { roughness: 0.5 }), 5.3, 0.6 + i * 1.2, 5.3, 10)
  sph(g, 0.08, lens('#ff2a1a', 2), 5.3, 5.5, 5.3)
  const sock = new Group()
  sock.position.set(5.3, 5.2, 5.3)
  ring(sock, 0.3, 0.025, steel(), 0, 0, 0.15, 'z')
  const bands = ['#f07a24', '#f4f1e8', '#f07a24', '#f4f1e8', '#f07a24']
  bands.forEach((col, i) => {
    const r0 = 0.3 - i * 0.04
    const c = cy(sock, r0 - 0.04, r0, 0.36, M(col, { roughness: 0.7 }), 0, -i * 0.03, 0.33 + i * 0.36, 12, 'z')
    void c
  })
  g.add(sock)
  return { g, sock }
}
