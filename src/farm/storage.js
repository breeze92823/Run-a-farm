import { BoxGeometry, CanvasTexture, Color, ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Shape, SRGBColorSpace } from 'three'
import { FARM } from '../config.js'
import { mulberry32 } from '../textures.js'
import { E, M, bakeInto, block, box, cyl, gableRoof, prism, signCanvas, signMaterial, signPanel, solid, solidRect, solidCyl, gated } from './kit.js'
import { fence } from './fence.js'
import { makeNPC, makeWalker, updateWalker } from './npc.js'
import { barrel, cardboard, crateMaterial, pallet, pumpkin, sack } from './props.js'
import { paintHay, paintSiding, tex } from './textures.js'

// The storage side of the farm: the concrete drop-off pad with its painted
// DROP OFF lettering, a long run of pallet racking (blue uprights, orange
// beams, plank decks) loaded with crates, hay and sacks, barrels and boxes,
// a black steel gantry, and the big red STORAGE barn with sliding X-braced
// doors, a cupola and weathervane, a parked green combine harvester, round
// hay bales and an old red fuel pump.

const D = FARM.dropOff

// --- Painted ground lettering ------------------------------------------------------------
function dropOffDecal(root) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 1024, 512)
    ctx.strokeStyle = '#f2c230'
    ctx.lineWidth = 22
    ctx.strokeRect(20, 20, 984, 472)
    ctx.fillStyle = '#f2c230'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 230px Fredoka, "Arial Black", sans-serif'
    ctx.fillText('DROP OFF', 512, 200, 900)
    ctx.font = '600 70px Fredoka, sans-serif'
    ctx.fillText('drive in to store your crops', 512, 390, 900)
    // Worn paint: knock a few speckles out.
    ctx.globalCompositeOperation = 'destination-out'
    const rand = mulberry32(3)
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.2 + rand() * 0.5})`
      ctx.fillRect(rand() * 1024, rand() * 512, 2 + rand() * 4, 2 + rand() * 3)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  draw()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  document.fonts?.ready?.then(() => {
    draw()
    t.needsUpdate = true
  })
  const geo = new PlaneGeometry(16, 8)
  geo.rotateX(-Math.PI / 2)
  const m = new Mesh(geo, new MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
  // Read from the barn side (it faces north, toward drivers heading south out of the barn).
  m.rotation.y = Math.PI
  m.position.set(40, 0.06, -15)
  m.receiveShadow = true
  root.add(m)
}

// --- Racking --------------------------------------------------------------------------------
function racks(root, rand) {
  const R = FARM.racks
  const g = new Group()
  const blue = M('#2f63c4', { roughness: 0.45, metalness: 0.3 })
  const orange = M('#e8812c', { roughness: 0.5 })
  const deck = M('#c99a5e', { roughness: 0.9 })
  const depth = 1.7
  const unit = 3.8
  const levels = [0.2, 1.35, 2.5, 3.65]
  const units = Math.floor((R.maxZ - R.minZ) / unit)
  const x0 = R.x
  const slots = []
  for (let u = 0; u <= units; u++) {
    const z = R.minZ + u * unit
    for (const s of [-1, 1]) block(g, 0.12, 4.0, 0.12, blue, x0 + (s * depth) / 2, 0, z)
    // End-frame bracing.
    for (let k = 0; k < 3; k++) {
      const br = box(g, 0.05, 1.3, 0.05, blue, x0, 0.75 + k * 1.15, z)
      br.rotation.z = (k % 2 ? 1 : -1) * 0.92
      box(g, depth, 0.05, 0.05, blue, x0, 0.15 + k * 1.15, z)
    }
    if (u === units) break
    const zc = z + unit / 2
    for (const y of levels) {
      for (const s of [-1, 1]) block(g, 0.1, 0.16, unit, orange, x0 + (s * depth) / 2, y - 0.16, zc)
      block(g, depth - 0.1, 0.05, unit - 0.1, deck, x0, y - 0.05, zc)
      if (y < 3.6) for (let k = 0; k < 3; k++) slots.push([x0, y, zc - unit / 3 + k * (unit / 3)])
    }
  }
  // What sits on the shelves: mostly crates, some hay bales and sacks.
  const hayMat = new MeshStandardMaterial({ map: tex(paintHay(), 1, 1), roughness: 1 })
  const crateGeo = new BoxGeometry(1.0, 0.78, 1.15)
  crateGeo.translate(0, 0.39, 0)
  const hayGeo = new BoxGeometry(1.2, 0.6, 1.1)
  hayGeo.translate(0, 0.3, 0)
  const crates = []
  const hays = []
  for (const s of slots) {
    const r = rand()
    if (r < 0.12) continue
    if (r < 0.78) crates.push(s)
    else if (r < 0.92) hays.push(s)
    else sack(g, s[0], s[2], '#c9a874', ['#e2b24a', '#8bc34a', '#e8732a'][Math.floor(rand() * 3)], rand() * 3).position.y = s[1]
  }
  const o = new Object3D()
  const crateMesh = new InstancedMesh(crateGeo, crateMaterial(), crates.length)
  crates.forEach(([x, y, z], i) => {
    o.position.set(x + (rand() - 0.5) * 0.1, y, z + (rand() - 0.5) * 0.1)
    o.rotation.set(0, (rand() - 0.5) * 0.12 + (rand() < 0.5 ? 0 : Math.PI / 2), 0)
    o.scale.setScalar(0.95 + rand() * 0.08)
    o.updateMatrix()
    crateMesh.setMatrixAt(i, o.matrix)
    crateMesh.setColorAt(i, new Color().setScalar(0.85 + rand() * 0.2))
  })
  const hayMesh = new InstancedMesh(hayGeo, hayMat, hays.length)
  hays.forEach(([x, y, z], i) => {
    o.position.set(x, y, z)
    o.rotation.set(0, (rand() - 0.5) * 0.1, 0)
    o.scale.setScalar(1)
    o.updateMatrix()
    hayMesh.setMatrixAt(i, o.matrix)
  })
  for (const m of [crateMesh, hayMesh]) {
    m.castShadow = true
    m.receiveShadow = true
    root.add(m)
  }
  bakeInto(root, g)
  solidRect(x0 - depth / 2 - 0.1, x0 + depth / 2 + 0.1, R.minZ, R.minZ + units * unit, 4.2)
}

// --- Barn ------------------------------------------------------------------------------------
function xDoor(g, w, h, x, y, z, ry, red, white) {
  const d = new Group()
  d.position.set(x, y, z)
  d.rotation.y = ry
  block(d, w, h, 0.12, red, 0, 0, 0)
  const t = 0.22
  block(d, w, t, 0.16, white, 0, 0, 0.02)
  block(d, w, t, 0.16, white, 0, h - t, 0.02)
  block(d, w, t, 0.16, white, 0, h / 2 - t / 2, 0.02)
  block(d, t, h, 0.16, white, -w / 2 + t / 2, 0, 0.02)
  block(d, t, h, 0.16, white, w / 2 - t / 2, 0, 0.02)
  const diag = Math.hypot(w, h / 2)
  const a = Math.atan2(h / 2, w)
  for (const [yy, s] of [[h / 4, 1], [h / 4, -1], [(3 * h) / 4, 1], [(3 * h) / 4, -1]]) {
    const b = box(d, diag - 0.1, t * 0.8, 0.16, white, 0, yy, 0.03)
    b.rotation.z = s * a
  }
  g.add(d)
}

function windowFrame(g, x, y, z, ry, w = 1.6, h = 1.6) {
  const white = M('#f7f4ec')
  const f = new Group()
  f.position.set(x, y, z)
  f.rotation.y = ry
  block(f, w, h, 0.06, M('#2b3644', { roughness: 0.15, metalness: 0.3 }), 0, 0, 0)
  block(f, w + 0.2, 0.14, 0.14, white, 0, -0.07, 0.04)
  block(f, w + 0.2, 0.14, 0.14, white, 0, h - 0.07, 0.04)
  block(f, 0.14, h, 0.14, white, -w / 2, 0, 0.04)
  block(f, 0.14, h, 0.14, white, w / 2, 0, 0.04)
  block(f, w, 0.08, 0.1, white, 0, h / 2 - 0.04, 0.05)
  block(f, 0.08, h, 0.1, white, 0, 0, 0.05)
  g.add(f)
}

// Gambrel roof over a w (x) by d (z) footprint, ridge along Z, eaves at y.
// Lower panels are steep, upper ones shallow; returns the half profile [[x, y], ...]
// (eave, knee, ridge) for the gable ends.
const GAMBREL = { lowRun: 0.3, lowRise: 0.32, upRise: 0.26 } // fractions of the half-width
function gambrel(g, w, d, y, mat, trim, cx, cz) {
  const hw = w / 2
  const p = [[hw, 0], [hw * (1 - GAMBREL.lowRun), hw * GAMBREL.lowRise], [0, hw * (GAMBREL.lowRise + GAMBREL.upRise)]]
  const len = d + 1.4
  const over = 0.6 // eave overhang along the lower panel
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const [x0, y0] = p[i]
      const [x1, y1] = p[i + 1]
      const a = Math.atan2(y1 - y0, x0 - x1) // panel slope
      const ext = i === 0 ? over : 0.15
      const segLen = Math.hypot(x0 - x1, y1 - y0) + ext
      // Centre of the segment, pushed out by half the eave extension on the lower panel.
      const mx = (x0 + x1) / 2 + (i === 0 ? (over / 2) * Math.cos(a) : 0)
      const my = (y0 + y1) / 2 - (i === 0 ? (over / 2) * Math.sin(a) : 0)
      const m = box(g, segLen, 0.3, len, mat, cx + s * mx, y + my + 0.15, cz)
      m.rotation.z = -s * a
      for (const e of [-1, 1]) {
        const t = box(g, segLen, 0.22, 0.22, trim, cx + s * mx, y + my + 0.2, cz + e * (len / 2))
        t.rotation.z = -s * a
      }
    }
  }
  box(g, 0.3, 0.3, len + 0.05, trim, cx, y + p[2][1] + 0.3, cz)
  return p
}

// The attic: the gambrel pentagon extruded the barn's length (fills both gable ends).
function gableWall(g, p, y, cz, length, mat, cx) {
  const s = new Shape()
  s.moveTo(-p[0][0], 0)
  s.lineTo(p[0][0], 0)
  s.lineTo(p[1][0], p[1][1])
  s.lineTo(0, p[2][1])
  s.lineTo(-p[1][0], p[1][1])
  s.closePath()
  const geo = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false })
  geo.translate(0, 0, -length / 2)
  const m = new Mesh(geo, mat)
  m.position.set(cx, y, cz)
  m.castShadow = true
  m.receiveShadow = true
  g.add(m)
}

// The STORAGE barn: red board-and-batten walls with white trim, a gambrel roof
// running north-south, the open drop bay on the south gable (hay stacked inside),
// the machine door on the north gable where the combine parks, hayloft doors,
// rows of small windows down the long walls, and the cupola with its weathervane.
function barn(root) {
  const Bn = FARM.barn
  const g = new Group()
  const red = new MeshStandardMaterial({ color: '#c3282c', map: tex(paintSiding(256, 8, 993), 6, 2), roughness: 0.8 })
  const redPlain = M('#b8262a')
  const white = M('#f7f4ec', { roughness: 0.6 })
  const roof = M('#6a6d73', { roughness: 0.55, metalness: 0.25 })
  const dark = M('#24170f', { roughness: 1 })
  const W = Bn.maxX - Bn.minX
  const Dp = Bn.maxZ - Bn.minZ
  const cx = (Bn.minX + Bn.maxX) / 2
  const cz = (Bn.minZ + Bn.maxZ) / 2
  const H = 7.5
  const t = 0.4
  const southBay = { w: 11, h: 6.5 }
  const northDoor = { w: 11, h: 6.8 }
  // Long walls (east and west).
  block(g, t, H, Dp, red, Bn.minX + t / 2, 0, cz)
  block(g, t, H, Dp, red, Bn.maxX - t / 2, 0, cz)
  // Gable walls with their door openings, frames and X-braced sliding doors pushed open.
  for (const [zEdge, door, sgn] of [[Bn.maxZ - t / 2, southBay, 1], [Bn.minZ + t / 2, northDoor, -1]]) {
    const sideW = (W - door.w) / 2
    block(g, sideW, H, t, red, Bn.minX + sideW / 2, 0, zEdge)
    block(g, sideW, H, t, red, Bn.maxX - sideW / 2, 0, zEdge)
    block(g, door.w, H - door.h, t, red, cx, door.h, zEdge)
    block(g, door.w + 0.6, 0.4, 0.5, white, cx, door.h, zEdge + sgn * 0.1)
    for (const e of [-1, 1]) block(g, 0.4, door.h, 0.5, white, cx + e * (door.w / 2 + 0.1), 0, zEdge + sgn * 0.1)
    const ry = sgn > 0 ? 0 : Math.PI
    xDoor(g, 5.4, door.h - 0.3, cx - door.w / 2 - 2.8, 0, zEdge + sgn * 0.35, ry, redPlain, white)
    xDoor(g, 5.4, door.h - 0.3, cx + door.w / 2 + 2.8, 0, zEdge + sgn * 0.35, ry, redPlain, white)
    block(g, W - 2, 0.2, 0.2, M('#3a3a3e', { metalness: 0.5 }), cx, door.h + 0.1, zEdge + sgn * 0.45)
  }
  // Inside: dark liner and ceiling, hay stacked behind the drop bay, a few bales by the machine door.
  block(g, 0.1, H - 0.4, Dp - 1, dark, Bn.minX + 0.5, 0, cz)
  block(g, 0.1, H - 0.4, Dp - 1, dark, Bn.maxX - 0.5, 0, cz)
  block(g, W - 1, 0.1, Dp - 1, dark, cx, H - 0.4, cz)
  const hay = new MeshStandardMaterial({ map: tex(paintHay(), 2, 2), roughness: 1 })
  for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) block(g, 1.3, 0.65, 0.85, hay, cx - 5 + i * 1.6 + (k % 2) * 0.4, k * 0.65, cz + 2, (i * 0.13) % 0.2)
  for (let i = 0; i < 3; i++) block(g, 1.3, 0.65, 0.85, hay, Bn.maxX - 2.2, i * 0.65, Bn.minZ + 3.5, 0.1 * i)
  // Corner trims, eave band, base band.
  for (const sx of [Bn.minX, Bn.maxX]) for (const sz of [Bn.minZ, Bn.maxZ]) block(g, 0.5, H + 0.05, 0.5, white, sx, 0, sz)
  block(g, W + 0.4, 0.35, Dp + 0.4, white, cx, H - 0.15, cz)
  block(g, W + 0.3, 0.3, Dp + 0.3, M('#8f1d20'), cx, 0, cz)
  // Gambrel roof and the attic.
  const prof = gambrel(g, W, Dp, H, roof, white, cx, cz)
  gableWall(g, prof, H, cz, Dp - 0.2, red, cx)
  // Hayloft X doors high on both gables, and the hay hoist beam over the south one.
  xDoor(g, 3.2, 2.8, cx, H + 0.6, Bn.maxZ + 0.12, 0, redPlain, white)
  xDoor(g, 3.2, 2.8, cx, H + 0.6, Bn.minZ - 0.12, Math.PI, redPlain, white)
  box(g, 0.3, 0.3, 1.8, M('#3a3a3e'), cx, H + prof[2][1] - 0.9, Bn.maxZ + 0.6)
  // Rows of small windows along the long walls.
  for (const [x, ry] of [[Bn.minX - 0.05, -Math.PI / 2], [Bn.maxX + 0.05, Math.PI / 2]]) {
    for (let i = 0; i < 4; i++) windowFrame(g, x, 3.2, Bn.minZ + 7 + i * 6, ry, 1.2, 1.6)
  }
  // Cupola with louvres, a little roof and a rooster weathervane.
  const cu = new Group()
  cu.position.set(cx, H + prof[2][1] - 0.4, cz)
  block(cu, 2.4, 1.8, 2.4, white, 0, 0, 0)
  for (const [ax, az, rot] of [[0, 1.21, 0], [0, -1.21, 0], [1.21, 0, Math.PI / 2], [-1.21, 0, Math.PI / 2]]) {
    for (let i = 0; i < 5; i++) {
      const l = box(cu, 1.6, 0.06, 0.12, M('#5b5d61'), ax, 0.45 + i * 0.24, az)
      l.rotation.y = rot
      l.rotation.x = 0.5
    }
  }
  const cr = new Group()
  cr.position.y = 1.8
  gableRoof(cr, 2.4, 2.4, 0, 35, roof, { overhang: 0.3, thick: 0.12, axis: 'z' })
  prism(cr, 2.4, 0.84, 2.4, white, 0, 0, 0)
  cu.add(cr)
  cyl(cu, 0.04, 0.04, 1.4, M('#2b2b2e', { metalness: 0.6 }), 0, 3.1, 0, 6)
  const vane = new Group()
  vane.position.y = 3.6
  box(vane, 1.0, 0.04, 0.04, M('#2b2b2e'), 0, 0, 0)
  box(vane, 0.04, 0.04, 1.0, M('#2b2b2e'), 0, 0, 0)
  box(vane, 0.6, 0.45, 0.04, M('#2b2b2e'), 0.1, 0.45, 0) // rooster silhouette
  box(vane, 0.2, 0.25, 0.04, M('#2b2b2e'), 0.45, 0.75, 0)
  box(vane, 0.25, 0.35, 0.04, M('#2b2b2e'), -0.28, 0.65, 0)
  cu.add(vane)
  g.add(cu)
  // Barrels and bales by the north door.
  barrel(g, cx - 8.5, Bn.minZ - 1.6, 0.3)
  barrel(g, cx - 7.4, Bn.minZ - 2.1, 1.2)
  block(g, 1.3, 0.62, 0.8, hay, cx + 8, 0, Bn.minZ - 1.5, 0.2)
  block(g, 1.3, 0.62, 0.8, hay, cx + 8.2, 0.62, Bn.minZ - 1.5, -0.1)
  bakeInto(root, g)
  // Colliders: long walls, gable walls beside the doors, the inside hay stack, the roof.
  solidRect(Bn.minX, Bn.minX + t, Bn.minZ, Bn.maxZ, H)
  solidRect(Bn.maxX - t, Bn.maxX, Bn.minZ, Bn.maxZ, H)
  for (const [z0, door] of [[Bn.maxZ - t, southBay], [Bn.minZ, northDoor]]) {
    solidRect(Bn.minX, cx - door.w / 2, z0, z0 + t, H)
    solidRect(cx + door.w / 2, Bn.maxX, z0, z0 + t, H)
  }
  solidRect(cx - 6, cx + 6, cz + 1.4, cz + 2.6, 2)
  solidRect(Bn.minX - 0.8, Bn.maxX + 0.8, Bn.minZ - 0.8, Bn.maxZ + 0.8, 1, H)
  return { cx, cz, inside: { minX: Bn.minX, maxX: Bn.maxX, minZ: Bn.minZ, maxZ: Bn.maxZ } }
}

// --- Combine harvester --------------------------------------------------------------------------
function combine(root) {
  const { x, z } = FARM.combine
  const g = new Group()
  const green = M('#2f8a3a', { roughness: 0.45 })
  const greenDark = M('#23692c', { roughness: 0.5 })
  const yellow = M('#f2c230', { roughness: 0.45 })
  const tyre = M('#1d1d1f', { roughness: 0.9 })
  const rim = M('#f2c230', { roughness: 0.4 })
  const glass = M('#33495c', { roughness: 0.08, metalness: 0.3 })
  // Body (front = +Z).
  block(g, 3.0, 2.6, 5.4, green, 0, 1.0, 0)
  block(g, 3.1, 0.3, 5.5, greenDark, 0, 1.0, 0)
  block(g, 2.6, 1.2, 2.6, green, 0, 3.6, -1.2) // grain tank
  block(g, 2.7, 0.15, 2.7, yellow, 0, 4.8, -1.2)
  // Cab.
  block(g, 2.0, 1.9, 1.8, glass, 0, 3.6, 1.6)
  block(g, 2.2, 0.18, 2.0, M('#f7f4ec'), 0, 5.5, 1.6)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.1, 1.9, 0.1, greenDark, sx * 1.0, 3.6, 1.6 + sz * 0.9)
  block(g, 0.16, 0.16, 0.08, E('#fff6d8', 1.5), 0.7, 5.35, 2.62)
  block(g, 0.16, 0.16, 0.08, E('#fff6d8', 1.5), -0.7, 5.35, 2.62)
  // Unloading auger folded along the side, exhaust stack, ladder.
  const auger = cyl(g, 0.18, 0.18, 5, M('#2f8a3a'), 1.75, 4.2, -0.6, 10)
  auger.rotation.x = Math.PI / 2
  auger.rotation.z = 0.05
  cyl(g, 0.1, 0.1, 1.4, M('#2b2b2e', { metalness: 0.5 }), -1.0, 4.4, -2.2, 8)
  for (let i = 0; i < 6; i++) box(g, 0.5, 0.05, 0.05, M('#2b2b2e'), -1.6, 1.2 + i * 0.4, 1.0)
  // Wheels: big drive wheels front, small steering wheels rear.
  for (const s of [-1, 1]) {
    const w = cyl(g, 1.0, 1.0, 0.7, tyre, s * 1.75, 1.0, 1.4, 18)
    w.rotation.z = Math.PI / 2
    const r = cyl(g, 0.5, 0.5, 0.72, rim, s * 1.76, 1.0, 1.4, 12)
    r.rotation.z = Math.PI / 2
    const w2 = cyl(g, 0.6, 0.6, 0.45, tyre, s * 1.5, 0.6, -2.3, 16)
    w2.rotation.z = Math.PI / 2
    const r2 = cyl(g, 0.3, 0.3, 0.47, rim, s * 1.51, 0.6, -2.3, 10)
    r2.rotation.z = Math.PI / 2
  }
  // Feeder house and the wide yellow header with its reel and crop dividers.
  block(g, 1.5, 1.0, 1.4, green, 0, 0.9, 3.2)
  const hd = new Group()
  hd.position.set(0, 0.35, 4.2)
  block(hd, 6.4, 0.7, 1.3, yellow, 0, 0, 0)
  block(hd, 6.4, 0.08, 1.4, M('#c99a1d'), 0, 0.02, 0.15)
  for (const s of [-1, 1]) {
    const tip = box(hd, 0.25, 0.5, 1.1, yellow, s * 3.25, 0.25, 0.7)
    tip.rotation.x = 0.4
  }
  for (const s of [-1, 1]) box(hd, 0.12, 1.4, 0.12, yellow, s * 3.0, 1.2, -0.2)
  const reel = new Group()
  reel.position.set(0, 1.55, 0.35)
  const shaft = cyl(reel, 0.06, 0.06, 6.0, M('#2b2b2e'), 0, 0, 0, 6)
  shaft.rotation.z = Math.PI / 2
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const bat = box(reel, 5.8, 0.06, 0.12, M('#e04a2a'), 0, Math.sin(a) * 0.6, Math.cos(a) * 0.6)
    bat.rotation.x = a
    for (const s of [-2.6, 0, 2.6]) {
      const arm = box(reel, 0.04, 0.6, 0.04, M('#2b2b2e'), s, Math.sin(a) * 0.3, Math.cos(a) * 0.3)
      arm.rotation.x = -a + Math.PI / 2
    }
  }
  hd.add(reel)
  g.add(hd)
  g.position.set(x, 0, z)
  g.rotation.y = Math.PI // nose out of the north door, toward the dirt road
  const baked = bakeInto(root, g)
  const cols = [solid(1.9, 1.8, 3.4, x, 1.8, z), solid(3.4, 0.8, 0.8, x, 0.8, z - 4.3)]
  return { reel, baked, cols }
}

function roundBale(g, x, z, ry, hay, face) {
  const b = cyl(g, 0.85, 0.85, 1.4, hay, x, 0.85, z, 18)
  b.rotation.z = Math.PI / 2
  b.rotation.y = ry
  void face
}

function fuelPump(g, x, z, ry) {
  const p = new Group()
  p.position.set(x, 0, z)
  p.rotation.y = ry
  block(p, 0.9, 0.2, 0.7, M('#5b5d61'), 0, 0, 0)
  block(p, 0.75, 1.6, 0.55, M('#d63a2c', { roughness: 0.35 }), 0, 0.2, 0)
  const top = cyl(p, 0.3, 0.3, 0.2, E('#fff4d8', 0.9), 0, 2.0, 0, 16)
  top.rotation.x = Math.PI / 2
  block(p, 0.5, 0.3, 0.04, M('#f7f4ec'), 0, 1.3, 0.28)
  block(p, 0.12, 0.35, 0.18, M('#2b2b2e'), 0.43, 0.9, 0.05)
  const hose = cyl(p, 0.035, 0.035, 0.9, M('#1d1d1f'), 0.46, 0.55, 0.12, 6)
  hose.rotation.z = 0.2
  g.add(p)
}

// --- Gantry ---------------------------------------------------------------------------------------
function gantry(g) {
  const G = FARM.gantry
  const steel = M('#1f2124', { roughness: 0.5, metalness: 0.5 })
  for (const x of [G.minX, G.maxX]) {
    block(g, 0.5, 6.2, 0.5, steel, x, 0, G.z)
    block(g, 0.9, 0.2, 0.9, steel, x, 0, G.z)
  }
  block(g, G.maxX - G.minX + 0.5, 0.55, 0.5, steel, (G.minX + G.maxX) / 2, 6.0, G.z)
  // The STORAGE banner hangs from the middle of the beam, readable from both sides.
  const p = signCanvas(1024, 300, {
    bg: '#2f5d3a',
    border: '#1d3a24',
    borderWidth: 14,
    lines: [
      { text: 'STORAGE', size: 168, color: '#f5efd6', stroke: '#173020', strokeWidth: 12 },
      { text: 'drop crops here', size: 70, color: '#f5efd6', weight: 600 },
    ],
  })
  const mat = signMaterial(p)
  const mid = (G.minX + G.maxX) / 2
  box(g, 11.2, 3.3, 0.24, M('#2f5d3a'), mid, 4.05, G.z)
  signPanel(g, 11.0, 3.2, mat, mid, 4.05, G.z + 0.125)
  signPanel(g, 11.0, 3.2, mat, mid, 4.05, G.z - 0.125, Math.PI)
  for (const s of [-4.5, 4.5]) block(g, 0.12, 0.6, 0.12, M('#1f2124'), mid + s, 5.6, G.z)
  solidCyl(0.35, 6.2, G.minX, G.z)
  solidCyl(0.35, 6.2, G.maxX, G.z)
}

// The drop-off yard (concrete in terrain.js, its painted decal here), the barn,
// racks, combine, gantry and their props are all bought as the Storage Barn
// (build pad); until then it is lawn.
export function buildStorage(root, ctx) {
  let api = null
  gated(root, 'storage', (G) => {
    dropOffDecal(G)
    api = storageBuild(G, ctx)
  }, 14)
  return api
}

function storageBuild(root, { addLamp }) {
  const rand = mulberry32(8181)
  racks(root, rand)
  const barnInfo = barn(root)
  const parked = combine(root)

  const g = new Group()
  gantry(g)
  // Barrels, boxes and pallets near the bay corner (as in front of the racks).
  barrel(g, 24.5, 29, 0.3)
  barrel(g, 25.5, 30.2, 1.2)
  barrel(g, 23.6, 30.4, 2.0)
  pallet(g, 28.5, 29.5, 0.1, 0.05)
  cardboard(g, 28.2, 0.19, 29.3, 0.8, 0.6, 0.6, 0.1)
  cardboard(g, 28.9, 0.19, 29.8, 0.7, 0.55, 0.6, -0.2)
  cardboard(g, 28.5, 0.79, 29.5, 0.7, 0.5, 0.6, 0.3)
  pallet(g, 50.5, 26, 0.05, 0.05)
  cardboard(g, 50.5, 0.19, 26, 0.9, 0.7, 0.8, 0.1)
  // Round bales and a bale stack by the barn.
  const hay = new MeshStandardMaterial({ map: tex(paintHay(), 2, 1), roughness: 1 })
  roundBale(g, 68.5, -46, 0.2, hay)
  roundBale(g, 68.6, -49.5, -0.1, hay)
  roundBale(g, 31.5, -42.5, 1.4, hay)
  for (let i = 0; i < 4; i++) block(g, 1.3, 0.62, 0.8, hay, 36 + i * 1.4, 0, -37.6, 0.05 * i)
  for (let i = 0; i < 3; i++) block(g, 1.3, 0.62, 0.8, hay, 36.7 + i * 1.4, 0.62, -37.6, -0.04 * i)
  fuelPump(g, 30.8, -45.5, Math.PI / 2)
  pumpkin(g, 33, -38, 0.4)
  pumpkin(g, 33.8, -38.6, 0.28, '#f6b13b')
  // Water trough by the barn's east side.
  block(g, 2.4, 0.7, 0.9, M('#9aa3ab', { metalness: 0.5, roughness: 0.35 }), 69, 0, -56)
  block(g, 2.2, 0.04, 0.7, M('#6fb0d6', { roughness: 0.05 }), 69, 0.62, -56)
  bakeInto(root, g)
  solidCyl(0.9, 1.7, 68.5, -46)
  solidCyl(0.9, 1.7, 68.6, -49.5)
  solidCyl(0.9, 1.7, 31.5, -42.5)
  solidRect(35.2, 41.6, -38.1, -37.1, 1.3)
  solidRect(23, 26.2, 28.4, 31, 1.2)
  solidRect(27.8, 29.3, 28.8, 30.2, 1.3)

  // Fences: along the road side (with a walk-in gap) and down the east edge.
  // The road side is the farm's boundary fence; this one parts the yard from the east lawn.
  fence([[D.maxX + 1, FARM.boundary.maxZ], [D.maxX + 1, -16]]) // open north of here onto the east lawn

  addLamp(barnInfo.cx, 6.6, FARM.barn.maxZ + 1.5)
  addLamp(40, 5.4, -27)

  // A worker shuffling crates along the racks.
  const worker = makeNPC({ shirt: '#f2a03a', pants: '#3a4a6a', hat: 'cap', hatColor: '#2f63c4', item: 'box', skin: '#d9a273' })
  root.add(worker.group)
  const walker = makeWalker(worker, [[52.5, -12], [52.5, 20], [44, 24], [44, -6]], { speed: 1.3, pause: 2.5, y: 0.05 })
  const farmer = makeNPC({ shirt: '#c8302a', pants: '#3d6bb3', hat: 'straw', overalls: '#3d6bb3' })
  root.add(farmer.group)
  const walker2 = makeWalker(farmer, [[28, -48], [28, -36], [36, -32], [44, -34]], { speed: 1.1, pause: 4, y: 0 })

  return {
    barn: barnInfo,
    // The parked combine: hidden (colliders off) once the drivable one is bought (farm/fleet3d.js).
    setCombineParked(on) {
      parked.baked.visible = on
      for (const c of parked.cols) c?.setEnabled?.(on)
    },
    racks: { minX: FARM.racks.x - 1, maxX: FARM.racks.x + 1, minZ: FARM.racks.minZ, maxZ: FARM.racks.maxZ },
    update(dt, t) {
      updateWalker(walker, t, dt)
      updateWalker(walker2, t, dt)
    },
  }
}
