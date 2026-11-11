import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three'
import { E, M, block, box, cyl, gableRoof, prism, signCanvas, signMaterial, signPanel } from './kit.js'
import { paintCorrugated, paintSiding, tex } from './textures.js'
import { lathe, lens, metal, rbox, ring, tube } from './detail.js'

// Textured building materials: board-and-batten siding, corrugated tin.
const texMats = new Map()
function sidingMat(color, rx = 4, ry = 1) {
  const key = `s${color}${rx}${ry}`
  if (!texMats.has(key)) texMats.set(key, new MeshStandardMaterial({ color, map: tex(paintSiding(256, 8, 991), rx, ry), roughness: 0.85 }))
  return texMats.get(key)
}
function tinMat(color, rx = 6, ry = 2) {
  const key = `t${color}${rx}${ry}`
  if (!texMats.has(key)) texMats.set(key, new MeshStandardMaterial({ color, map: tex(paintCorrugated(128, 8), rx, ry), roughness: 0.45, metalness: 0.35 }))
  return texMats.get(key)
}
// A wall lantern: bracket, cage and a warm lens.
function lantern(g, x, y, z, ry = 0) {
  const l = new Group()
  l.position.set(x, y, z)
  l.rotation.y = ry
  box(l, 0.06, 0.06, 0.35, M('#2a2c30'), 0, 0.2, 0.15)
  box(l, 0.24, 0.32, 0.24, M('#2a2c30', { roughness: 0.4 }), 0, 0, 0.32)
  box(l, 0.18, 0.24, 0.18, lens('#ffcf7a', 1.6), 0, 0, 0.32)
  g.add(l)
}

// Detailed procedural models for the progression: the bicycle, the egg van,
// the farm truck, drones and their base, the oil pump jack, tank and rail
// loading station, the ranch barns (stables, cow barn + silo, pig house, duck
// house), the animals (cow, pig, horse, duck), the carton packer and the town's
// market and vehicle dealer. Every model's front faces +Z, origin on the ground.
// Moving parts are returned so the world can animate them.

const TAU = Math.PI * 2
const tyreMat = () => M('#1d1d1f', { roughness: 0.9 })
const chrome = () => M('#e8ecef', { roughness: 0.15, metalness: 0.9 })
const glass = () => M('#2c3e4e', { roughness: 0.08, metalness: 0.4 })

// A road wheel: tyre + rim + hub nut, axle along X. Spin the group's rotation.x.
function painted(w, h, opts) {
  return signMaterial(signCanvas(w, h, opts))
}

export function droneBase() {
  const g = new Group()
  const concrete = M('#b9b6ae', { roughness: 0.9 })
  block(g, 18, 0.3, 14, concrete, 0, 0, 0)
  block(g, 18.2, 0.06, 14.2, M('#f2c230'), 0, 0.28, 0, 0, false)
  block(g, 17.6, 0.08, 13.6, concrete, 0, 0.28, 0, 0, false)
  // Four landing pads: yellow rings with numbers.
  const pads = [[-4, -3], [4, -3], [-4, 4], [4, 4]]
  pads.forEach(([x, z], i) => {
    const mat = painted(256, 256, { bg: '#2f3338', radius: 128, border: '#f2c230', borderWidth: 18, lines: [{ text: `${i + 1}`, size: 150, color: '#f2c230' }] })
    const p = signPanel(g, 3.4, 3.4, mat, x, 0.38, z)
    p.rotation.x = -Math.PI / 2
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU
      block(g, 0.12, 0.06, 0.12, E('#3aa8ff', 2), x + Math.cos(a) * 1.9, 0.36, z + Math.sin(a) * 1.9, 0, false)
    }
  })
  // Control hut at the back with a window, an antenna and a dish.
  const hut = new Group()
  hut.position.set(-6.5, 0.3, -5.6)
  block(hut, 3.6, 2.6, 2.4, M('#e8e4da'), 0, 0, 0)
  block(hut, 4, 0.2, 2.8, M('#5e6168'), 0, 2.6, 0)
  block(hut, 2.4, 0.9, 0.05, E('#9fd8ff', 0.8), 0, 1.3, 1.22)
  block(hut, 0.9, 1.8, 0.05, M('#3a5a8a'), 1.2, 0, 1.22)
  cyl(hut, 0.05, 0.05, 2.5, chrome(), -1.4, 4.0, -0.6, 6)
  block(hut, 0.12, 0.12, 0.12, E('#ff3a2a', 3), -1.4, 5.2, -0.6)
  const dish = new Group()
  dish.position.set(1.0, 3.2, -0.3)
  const bowl = new Mesh(new SphereGeometry(0.7, 16, 8, 0, TAU, 0, Math.PI * 0.35), M('#f4f1e8', { side: 2 }))
  bowl.rotation.x = -Math.PI / 2 - 0.5
  dish.add(bowl)
  cyl(dish, 0.04, 0.04, 0.6, chrome(), 0, -0.3, 0, 6)
  hut.add(dish)
  const sign = painted(512, 128, { bg: '#2f3338', border: '#f2c230', borderWidth: 8, radius: 10, lines: [{ text: 'DRONE BASE', size: 74, color: '#f2c230' }] })
  signPanel(hut, 3.4, 0.85, sign, 0, 2.35, 1.23)
  g.add(hut)
  // Windsock on a pole.
  const sock = new Group()
  sock.position.set(8, 5, -6)
  cyl(g, 0.06, 0.06, 5, M('#9aa0a6', { metalness: 0.6 }), 8, 2.5, -6, 8)
  const cone = cyl(sock, 0.32, 0.12, 1.8, M('#f07a24', { roughness: 0.6 }), 0, 0, 0.9, 12)
  cone.rotation.x = Math.PI / 2
  for (const z of [0.5, 1.3]) {
    const band = cyl(sock, 0.3 - z * 0.1, 0.3 - z * 0.1, 0.25, M('#f4f1e8'), 0, 0, z, 12)
    band.rotation.x = Math.PI / 2
  }
  g.add(sock)
  // Edge lights.
  for (let i = 0; i < 10; i++) {
    for (const s of [-1, 1]) block(g, 0.18, 0.2, 0.18, E('#3aff6a', 1.8), -8.6 + i * 1.9, 0.3, s * 6.8, 0, false)
  }
  return { g, sock, dish, pads }
}

// --- Oil (the pump jack is farm/pumpjack.js) ------------------------------------------------------------
export function oilTank() {
  const g = new Group()
  const shell = M('#e9e6de', { roughness: 0.45, metalness: 0.3 })
  const steel = M('#5a6068', { roughness: 0.4, metalness: 0.6 })
  const R = 4.4
  const H = 7.5
  cyl(g, R + 0.3, R + 0.3, 0.4, M('#9a968c'), 0, 0.2, 0, 28)
  // Containment wall round the tank (low enough to step over) and its floor.
  cyl(g, R + 2.4, R + 2.4, 0.05, M('#a9a59b', { roughness: 0.95 }), 0, 0.03, 0, 36)
  const dike = new Mesh(new TorusGeometry(R + 2.4, 0.2, 4, 40), M('#bdbab3', { roughness: 0.9 }))
  dike.rotation.x = Math.PI / 2
  dike.scale.z = 1.4
  dike.position.y = 0.2
  g.add(dike)
  // Valve manifold at the foot.
  for (let i = 0; i < 3; i++) {
    cyl(g, 0.14, 0.14, 1.6, steel, -R - 0.6, 0.5 + i * 0.45, 0, 10).rotation.z = Math.PI / 2
    const hw = new Mesh(new TorusGeometry(0.2, 0.03, 6, 14), M('#c8302a'))
    hw.position.set(-R - 1.2, 0.5 + i * 0.45, 0.25)
    g.add(hw)
  }
  // Warning placards.
  for (const a of [0.6, 2.4]) {
    const pl = signPanel(g, 0.8, 0.8, signMaterial(signCanvas(128, 128, { bg: '#f7f4ec', border: '#c8302a', borderWidth: 10, lines: [{ text: '3', size: 70, color: '#c8302a' }] })), Math.cos(a) * (R + 0.02), 1.8, Math.sin(a) * (R + 0.02))
    pl.rotation.y = Math.PI / 2 - a
  }
  cyl(g, R, R, H, shell, 0, 0.4 + H / 2, 0, 28)
  for (const y of [1.6, 3.4, 5.2]) cyl(g, R + 0.04, R + 0.04, 0.12, M('#c8302a'), 0, 0.4 + y, 0, 28)
  const top = cyl(g, R, 0.5, 0.9, shell, 0, 0.4 + H + 0.45, 0, 28)
  void top
  // Railing around the roof.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    block(g, 0.05, 1.0, 0.05, M('#f2c230'), Math.cos(a) * (R - 0.15), 0.4 + H, Math.sin(a) * (R - 0.15))
  }
  const rail = new Mesh(new TorusGeometry(R - 0.15, 0.04, 6, 40), M('#f2c230'))
  rail.rotation.x = Math.PI / 2
  rail.position.y = 0.4 + H + 1
  g.add(rail)
  // A stair climbing round the shell to the roof, with a handrail.
  const steps = 26
  for (let i = 0; i < steps; i++) {
    const a = 0.3 + (i / steps) * 1.9
    const y = 0.4 + ((i + 1) / steps) * H
    const st = box(g, 0.9, 0.06, 0.32, M('#7a828a', { roughness: 0.4, metalness: 0.6 }), Math.cos(a) * (R + 0.5), y, Math.sin(a) * (R + 0.5))
    st.rotation.y = -a
    if (i % 3 === 0) {
      const p = cyl(g, 0.025, 0.025, 1.0, M('#f2c230'), Math.cos(a) * (R + 0.95), y + 0.5, Math.sin(a) * (R + 0.95), 6)
      void p
    }
  }
  const rail2 = new Mesh(new TorusGeometry(R + 0.95, 0.03, 4, 40, 1.9), M('#f2c230'))
  rail2.rotation.x = Math.PI / 2
  rail2.rotation.z = -0.3
  rail2.position.y = 0.4 + H * 0.5 + 1
  g.add(rail2)
  // Level gauge: a glass strip with a black fill that rises with the oil.
  block(g, 0.5, H - 1, 0.1, M('#cfd8dc', { roughness: 0.1, metalness: 0.2 }), 1.6, 0.9, R - 0.25)
  const gauge = new Group()
  gauge.position.set(1.6, 0.9, R - 0.18)
  block(gauge, 0.36, 1, 0.08, M('#151515', { roughness: 0.2 }), 0, 0, 0)
  g.add(gauge)
  gauge.userData.h = H - 1
  // Sign and the inlet pipe.
  const sign = painted(512, 160, { bg: '#2f3338', border: '#f2c230', borderWidth: 10, radius: 10, lines: [{ text: 'CRUDE OIL', size: 88, color: '#f2c230' }] })
  const sp = signPanel(g, 3.6, 1.1, sign, -0.8, 4.6, R + 0.02)
  sp.rotation.y = 0
  const pipe = cyl(g, 0.16, 0.16, 6, steel, -R - 2.6, 0.5, 0, 10)
  pipe.rotation.z = Math.PI / 2
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, gauge }
}

// The rail station: a raised loading platform along the track with a canopy,
// a swinging loading arm, barrel stacks and a sign. Track side = -Z.
export function railStation(len = 24) {
  const g = new Group()
  const concrete = M('#b9b6ae', { roughness: 0.9 })
  const steel = M('#3a4048', { roughness: 0.5, metalness: 0.5 })
  block(g, len, 1.1, 6, concrete, 0, 0, 0)
  block(g, len, 0.06, 0.4, M('#f2c230'), 0, 1.1, -2.8, 0, false) // edge line
  // Steps up at the south.
  for (let i = 0; i < 4; i++) block(g, 3, 0.28 * (i + 1), 0.5, concrete, -len / 2 + 3, 0, 3 + (3 - i) * 0.5)
  // Canopy on posts.
  for (let i = 0; i < 5; i++) {
    const x = -len / 2 + 2 + i * ((len - 4) / 4)
    for (const z of [-2, 2.4]) block(g, 0.2, 4, 0.2, steel, x, 1.1, z)
  }
  block(g, len, 0.25, 5.6, M('#c8302a'), 0, 5.1, 0.2)
  for (let i = 0; i < 6; i++) box(g, 0.5, 0.08, 0.5, lens('#fff4d0', 1.4), -len / 2 + 2 + i * ((len - 4) / 5), 5.0, 0.2) // canopy lamps
  // Railing along the back (south) edge and the ends.
  for (let i = 0; i <= 12; i++) block(g, 0.06, 1.0, 0.06, M('#f2c230'), -len / 2 + 0.5 + i * ((len - 1) / 12), 1.1, 2.9)
  for (const y of [1.6, 2.1]) box(g, len - 1, 0.05, 0.05, M('#f2c230'), 0, y, 2.9)
  block(g, len + 0.3, 0.12, 5.9, M('#7a1a14'), 0, 5.35, 0.2)
  // The loading arm: a mast with a boom swinging out over the tank cars.
  const mast = new Group()
  mast.position.set(len / 2 - 3, 1.1, -1.6)
  block(mast, 0.5, 6, 0.5, M('#f2c230'), 0, 0, 0)
  const boom = new Group()
  boom.position.y = 5.6
  box(boom, 0.3, 0.3, 5.5, M('#f2c230'), 0, 0, -2.6)
  const spout = cyl(boom, 0.18, 0.12, 1.8, steel, 0, -0.9, -5.2, 10)
  void spout
  const hose = cyl(boom, 0.12, 0.12, 5.4, M('#1d1f22'), 0, 0.25, -2.6, 8)
  hose.rotation.x = Math.PI / 2
  mast.add(boom)
  g.add(mast)
  // Barrels waiting on pallets (shown as the tank fills).
  const barrels = []
  const blue = M('#2f4f9a', { roughness: 0.4, metalness: 0.35 })
  const black = M('#1d1f22', { roughness: 0.3, metalness: 0.3 })
  for (let i = 0; i < 18; i++) {
    const b = new Group()
    b.position.set(-len / 2 + 6 + (i % 9) * 1.05, 1.1, 0.6 + Math.floor(i / 9) * 1.1)
    cyl(b, 0.42, 0.42, 1.2, i % 4 === 0 ? black : blue, 0, 0.6, 0, 12)
    for (const y of [0.3, 0.9]) cyl(b, 0.44, 0.44, 0.05, M('#243f7c'), 0, y, 0, 12)
    b.visible = false
    g.add(b)
    barrels.push(b)
  }
  const sign = painted(768, 160, { bg: '#2f3338', border: '#f2c230', borderWidth: 10, radius: 10, lines: [{ text: 'OIL LOADING STATION', size: 84, color: '#f2c230' }] })
  signPanel(g, 10, 2.1, sign, 0, 4.1, 2.98)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, boom, barrels }
}

// --- Ranch barns ---------------------------------------------------------------------------------------------
// Horse stables: a long timber barn (ridge along X), Dutch stall doors on the
// front, a hay loft door, a cupola with a weather vane.
export function stables() {
  const g = new Group()
  const wood = sidingMat('#b06a3a', 8, 1)
  const trim = M('#f7f4ec', { roughness: 0.6 })
  const roof = tinMat('#4a5862', 10, 3)
  const W = 22
  const D = 10
  const H = 4
  block(g, W, H, D, wood, 0, 0, 0)
  for (let i = 0; i <= 11; i++) block(g, 0.12, H, D + 0.06, M('#7d4626'), -W / 2 + i * 2, 0, 0, 0, false) // board battens
  prism(g, D, 2.8, W, wood, 0, H, 0, Math.PI / 2)
  gableRoof(g, W, D, H, 30, roof, { overhang: 0.6, axis: 'x', trim })
  // Stall doors: top halves open, a horse may look out.
  for (let i = 0; i < 5; i++) {
    const x = -W / 2 + 2.4 + i * 4.3
    block(g, 2.0, 1.3, 0.1, M('#6e3a1e'), x, 0, D / 2 + 0.03)
    block(g, 2.0, 1.1, 0.04, M('#2a1a10'), x, 1.35, D / 2 + 0.02) // dark open top
    for (const s of [-1, 1]) block(g, 0.14, 2.7, 0.14, trim, x + s * 1.05, 0, D / 2 + 0.06)
    block(g, 2.24, 0.14, 0.14, trim, x, 2.6, D / 2 + 0.06)
    // X brace on the lower door.
    const b1 = box(g, 0.1, 1.5, 0.05, trim, x, 0.65, D / 2 + 0.1)
    b1.rotation.z = 0.98
    const b2 = box(g, 0.1, 1.5, 0.05, trim, x, 0.65, D / 2 + 0.1)
    b2.rotation.z = -0.98
  }
  // Lanterns between the stalls, a horse looking out of two of them.
  for (let i = 0; i < 4; i++) lantern(g, -W / 2 + 4.55 + i * 4.3, 2.9, D / 2 + 0.05)
  for (const i of [1, 3]) {
    const x = -W / 2 + 2.4 + i * 4.3
    const head = new Group()
    head.position.set(x, 1.9, D / 2 + 0.1)
    head.rotation.x = 0.35
    box(head, 0.36, 0.42, 0.9, M(i === 1 ? '#8a5a32' : '#3a2a20'), 0, 0, 0.3)
    box(head, 0.3, 0.26, 0.24, M('#2a2420'), 0, -0.1, 0.78)
    for (const s of [-1, 1]) box(head, 0.08, 0.2, 0.08, M(i === 1 ? '#8a5a32' : '#3a2a20'), s * 0.1, 0.3, 0.0)
    box(head, 0.08, 0.3, 0.6, M('#1e140c'), 0, 0.22, -0.05)
    g.add(head)
  }
  // Saddle rack and hay bales at the west end.
  block(g, 1.6, 0.9, 0.5, M('#7b4a26'), -W / 2 + 1.5, 0, D / 2 + 1.2)
  box(g, 0.8, 0.25, 0.6, M('#6e3a1e', { roughness: 0.5 }), -W / 2 + 1.2, 1.0, D / 2 + 1.2)
  for (let i = 0; i < 3; i++) block(g, 1.2, 0.6, 0.75, M('#e3c063', { roughness: 1 }), -W / 2 - 1.2, i * 0.6, 2 - (i % 2) * 0.2)
  // Hay loft door in the west gable, with a hay bale peeking out.
  block(g, 0.1, 1.4, 1.6, M('#6e3a1e'), -W / 2 - 0.03, H + 0.3, 0)
  // Cupola + weather vane.
  block(g, 1.6, 1.2, 1.6, trim, 0, H + 2.6, 0)
  gableRoof(g, 1.6, 1.6, H + 3.8, 35, roof, { overhang: 0.2 })
  cyl(g, 0.03, 0.03, 1.4, M('#2b2b2b'), 0, H + 5.0, 0, 6)
  const vane = new Group()
  vane.position.set(0, H + 5.6, 0)
  block(vane, 0.9, 0.35, 0.04, M('#2b2b2b'), 0, 0, 0)
  block(vane, 0.25, 0.45, 0.04, M('#2b2b2b'), 0.4, 0.25, 0)
  g.add(vane)
  const sign = painted(512, 128, { bg: '#f7f4ec', border: '#6e3a1e', borderWidth: 10, radius: 12, lines: [{ text: 'STABLES', size: 84, color: '#6e3a1e' }] })
  signPanel(g, 4, 1, sign, 0, H + 0.9, D / 2 + 0.05)
  // Horseshoe over the sign, water trough and hay rack at the front.
  block(g, 2.6, 0.6, 0.8, M('#9aa3ab', { metalness: 0.5, roughness: 0.35 }), W / 2 - 2, 0, D / 2 + 1.6)
  block(g, 2.4, 0.05, 0.6, M('#6fb0d6', { roughness: 0.05 }), W / 2 - 2, 0.55, D / 2 + 1.6)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, vane }
}

// The cow barn: a red barn (ridge along Z) with a white X door, and a tall silo.
export function cowBarn() {
  const g = new Group()
  const red = sidingMat('#c0392b', 5, 1)
  const white = M('#f7f4ec', { roughness: 0.6 })
  const roof = tinMat('#5e6168', 6, 3)
  const W = 12
  const D = 10
  const H = 4.2
  block(g, W, H, D, red, 0, 0, 0)
  prism(g, W, 3.4, D, red, 0, H, 0)
  gableRoof(g, W, D, H, 30, roof, { overhang: 0.5, axis: 'z', trim: white })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.25, H, 0.25, white, sx * W / 2, 0, sz * D / 2)
  // Big sliding door with a white X.
  block(g, 4.2, 3.4, 0.1, M('#9a2620'), 0, 0, D / 2 + 0.05)
  block(g, 4.4, 0.18, 0.12, white, 0, 3.4, D / 2 + 0.08)
  for (const s of [-1, 1]) block(g, 0.18, 3.5, 0.12, white, s * 2.1, 0, D / 2 + 0.08)
  for (const s of [-1, 1]) {
    const b = box(g, 0.16, 5.2, 0.06, white, 0, 1.7, D / 2 + 0.11)
    b.rotation.z = s * 0.89
  }
  block(g, 4.6, 0.12, 0.2, M('#3a3a3a'), 0, 3.55, D / 2 + 0.15) // door rail
  // Loft window.
  block(g, 1.4, 1.2, 0.1, white, 0, H + 0.8, D / 2 + 0.03)
  block(g, 1.1, 0.9, 0.12, M('#2a1a10'), 0, H + 0.95, D / 2 + 0.05)
  block(g, 0.9, 0.4, 0.5, M('#e3c063', { roughness: 1 }), 0, H + 0.95, D / 2 - 0.1) // hay in the loft
  lantern(g, 0, 3.75, D / 2 + 0.15)
  // Side windows with white frames.
  for (const sx of [-1, 1]) for (const z of [-2.5, 2.5]) {
    block(g, 0.08, 1.0, 1.2, M('#f7f4ec'), sx * (W / 2 + 0.02), 1.6, z)
    block(g, 0.1, 0.8, 1.0, lens('#ffe2a0', 0.35), sx * (W / 2 + 0.03), 1.7, z)
    box(g, 0.12, 0.06, 1.0, M('#f7f4ec'), sx * (W / 2 + 0.04), 2.1, z)
  }
  // Stainless milk cooling tank on legs by the west wall.
  const cool = new Group()
  cool.position.set(-W / 2 - 1.8, 0, 2)
  for (const [x, z] of [[-0.5, -0.9], [0.5, -0.9], [-0.5, 0.9], [0.5, 0.9]]) block(cool, 0.08, 0.6, 0.08, metal('#c9ced3', 0.2), x, 0, z)
  const tankM = metal('#d9dde1', 0.18)
  cyl(cool, 0.7, 0.7, 2.2, tankM, 0, 1.3, 0, 20).rotation.x = Math.PI / 2
  lathe(cool, [[0.7, 0], [0.5, 0.2], [0.001, 0.25]], tankM, 0, 1.3, 1.1, 20).rotation.x = Math.PI / 2
  cyl(cool, 0.2, 0.2, 0.15, tankM, 0, 2.05, 0, 12)
  g.add(cool)
  // Feed bunk along the east wall.
  block(g, 0.9, 0.55, 7, M('#8a5a2c', { roughness: 0.9 }), W / 2 + 0.9, 0, 0)
  block(g, 0.7, 0.08, 6.8, M('#c9a14a', { roughness: 1 }), W / 2 + 0.9, 0.5, 0)
  const sign = painted(512, 128, { bg: '#f7f4ec', border: '#7a1a14', borderWidth: 10, radius: 12, lines: [{ text: 'DAIRY', size: 84, color: '#b8302a' }] })
  signPanel(g, 3, 0.75, sign, 0, H + 2.4, D / 2 + 0.16)
  // Silo beside it.
  const silo = new Group()
  silo.position.set(W / 2 + 2.6, 0, -1.5)
  cyl(silo, 2.1, 2.1, 10, M('#d9d4c8', { roughness: 0.6, metalness: 0.2 }), 0, 5, 0, 22)
  for (let i = 1; i < 6; i++) cyl(silo, 2.13, 2.13, 0.1, M('#a8a296', { metalness: 0.4 }), 0, i * 1.7, 0, 22)
  const dome = new Mesh(new SphereGeometry(2.15, 22, 10, 0, TAU, 0, Math.PI / 2), M('#c8302a', { roughness: 0.45, metalness: 0.2 }))
  dome.position.y = 10
  silo.add(dome)
  for (let i = 0; i < 18; i++) block(silo, 0.5, 0.04, 0.04, M('#4a4a4a'), 0, 0.5 + i * 0.52, 2.15)
  g.add(silo)
  // Milk cans by the door.
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 1 + i * 0.6
    cyl(g, 0.22, 0.25, 0.7, M('#c9ced3', { metalness: 0.7, roughness: 0.25 }), x, 0.35, D / 2 + 0.7, 12)
    cyl(g, 0.13, 0.13, 0.18, M('#c9ced3', { metalness: 0.7, roughness: 0.25 }), x, 0.79, D / 2 + 0.7, 10)
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g }
}

// The pig house: a low timber shed with a corrugated lean-to roof, a mud wallow and a trough.
export function pigHouse() {
  const g = new Group()
  const wood = sidingMat('#c48a52', 5, 1)
  block(g, 9, 2.6, 6, wood, 0, 0, 0)
  for (let i = 0; i < 10; i++) block(g, 0.08, 2.6, 6.04, M('#9a6a3a'), -4.5 + i, 0, 0, 0, false)
  const roof = box(g, 10, 0.16, 7.2, tinMat('#9aa3ab', 8, 3), 0, 3.0, 0.2)
  lantern(g, 0, 2.3, 3.05)
  // Straw spilling out of the doorways and a feed sack.
  for (const x of [-2.2, 2.2]) block(g, 1.6, 0.06, 0.9, M('#e3c063', { roughness: 1 }), x, 0, 3.4)
  block(g, 0.6, 0.8, 0.4, M('#e8dcc0', { roughness: 0.95 }), 4.3, 0, 3.5)
  roof.rotation.x = -0.14
  for (let i = 0; i < 12; i++) box(g, 0.06, 0.06, 7.2, M('#7d858c'), -4.8 + i * 0.86, 3.1, 0.2, 0, false)
  // Low doorways the pigs trot in and out of.
  for (const x of [-2.2, 2.2]) {
    block(g, 1.4, 1.3, 0.08, M('#2a1a10'), x, 0, 3.02)
    block(g, 1.6, 0.14, 0.12, M('#7b4a26'), x, 1.3, 3.04)
  }
  const sign = painted(512, 128, { bg: '#ffb6c8', border: '#b04a6a', borderWidth: 10, radius: 12, lines: [{ text: 'PIG PEN', size: 84, color: '#8a2a4a' }] })
  signPanel(g, 3, 0.75, sign, 0, 1.95, 3.05)
  // Mud wallow and trough in front.
  const mud = cyl(g, 1, 1, 0.06, M('#5a3a22', { roughness: 0.2 }), -1, 0.03, 8, 20, false)
  mud.scale.set(4.2, 1, 2.6)
  block(g, 3, 0.4, 0.7, M('#7b4a26'), 4, 0, 5.5)
  block(g, 2.8, 0.06, 0.5, M('#c9a14a'), 4, 0.36, 5.5)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o !== mud
  })
  return { g, mud: { x: -1, z: 8, rx: 4.2, rz: 2.6 } }
}

// The duck house: a little A-frame on stilts with a ramp down to a pool.
export function duckHouse() {
  const g = new Group()
  const blue = sidingMat('#5aa0c8', 2, 1)
  const white = M('#f7f4ec')
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.2, 0.8, 0.2, M('#7b4a26'), sx * 1.4, 0, sz * 1.1)
  block(g, 3.2, 0.14, 2.6, M('#a8693a'), 0, 0.8, 0)
  block(g, 3, 1.4, 2.4, blue, 0, 0.94, 0)
  prism(g, 3, 1.3, 2.4, blue, 0, 2.34, 0)
  gableRoof(g, 3, 2.4, 2.32, 40, M('#d6322c'), { overhang: 0.25, axis: 'z', trim: white })
  block(g, 0.8, 0.9, 0.06, M('#2a1a10'), -0.6, 0.94, 1.22)
  const ramp = box(g, 0.8, 0.06, 1.8, M('#c18a52'), -0.6, 0.45, 2.0)
  ramp.rotation.x = 0.5
  const win = cyl(g, 0.3, 0.3, 0.06, white, 0.7, 1.7, 1.22, 14)
  win.rotation.x = Math.PI / 2
  // Flower box under the window and a little nest of straw by the door.
  block(g, 1.0, 0.2, 0.2, M('#7b4a26'), 0.7, 1.25, 1.32)
  for (let i = 0; i < 5; i++) block(g, 0.12, 0.12, 0.12, M(['#ff6a8a', '#ffd23a', '#ffffff'][i % 3]), 0.35 + i * 0.18, 1.45, 1.32)
  block(g, 0.9, 0.08, 0.5, M('#e3c063', { roughness: 1 }), -0.6, 0.94, 0.7)
  const sign = painted(384, 112, { bg: '#f7f4ec', border: '#2f6fd0', borderWidth: 8, radius: 10, lines: [{ text: 'DUCKS', size: 70, color: '#2f6fd0' }] })
  signPanel(g, 1.5, 0.45, sign, 0.6, 2.6, 1.26)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g }
}

// --- Carton packer (Farm Shop Lv2) ---------------------------------------------------------------------
// A conveyor (eggs ride along it) into a packing box that stacks cartons, with
// a control panel and a little sign. Belt along X.
export function packer() {
  const g = new Group()
  g.userData.noCompact = true // eggs ride the belt one by one, the lamp flashes
  const steel = M('#9aa3ab', { metalness: 0.6, roughness: 0.3 })
  const green = M('#3f8a4a', { roughness: 0.45 })
  // Hopper (eggs go in) on the west end.
  block(g, 1.2, 0.9, 1.2, steel, -2.6, 0.9, 0)
  const hop = cyl(g, 0.8, 0.45, 0.8, M('#c9ced3', { metalness: 0.5, roughness: 0.3 }), -2.6, 2.2, 0, 4)
  hop.rotation.y = Math.PI / 4
  // Conveyor on legs.
  for (const x of [-1.8, 0, 1.8]) for (const z of [-0.35, 0.35]) block(g, 0.1, 0.95, 0.1, steel, x, 0, z)
  block(g, 4.4, 0.1, 0.8, steel, 0, 0.95, 0)
  const belt = box(g, 4.3, 0.04, 0.6, M('#2a2c30', { roughness: 0.8 }), 0, 1.07, 0)
  for (const s of [-1, 1]) block(g, 4.4, 0.12, 0.06, green, 0, 1.0, s * 0.38)
  // Eggs riding the belt.
  const eggs = []
  for (let i = 0; i < 7; i++) {
    const e = new Mesh(new SphereGeometry(0.075, 8, 6), M(i % 3 ? '#fff6e3' : '#e9c9a0', { roughness: 0.35 }))
    e.scale.y = 1.25
    e.position.set(-2 + i * 0.6, 1.18, (i % 2 - 0.5) * 0.2)
    g.add(e)
    eggs.push(e)
  }
  // Packing box with a window and the carton stack coming out.
  block(g, 1.6, 1.9, 1.4, green, 2.8, 0.2, 0)
  block(g, 0.9, 0.5, 0.05, E('#ffe2a0', 0.6), 2.8, 1.3, 0.72)
  block(g, 1.7, 0.12, 1.5, M('#2a5a34'), 2.8, 2.1, 0)
  const lamp = block(g, 0.18, 0.18, 0.18, E('#3aff6a', 2), 2.8, 2.22, 0)
  // Control panel.
  block(g, 0.5, 1.1, 0.3, steel, -1.2, 0, 0.75)
  const panel = block(g, 0.4, 0.3, 0.04, M('#2a2c30'), -1.2, 0.9, 0.92)
  void panel
  const leds = [E('#ff3a2a', 2), E('#ffd23a', 2), E('#3aff6a', 2)].map((m, i) => block(g, 0.06, 0.06, 0.03, m, -1.32 + i * 0.12, 1.08, 0.94, 0, false))
  const sign = painted(512, 128, { bg: '#3f8a4a', border: '#f5efd6', borderWidth: 8, radius: 12, lines: [{ text: 'CARTON PACKER', size: 64, color: '#f5efd6' }] })
  signPanel(g, 2.2, 0.55, sign, 2.8, 2.65, 0.1)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, eggs, belt, lamp, leds }
}
// One egg carton (about 30 x 10 x 12 cm, scaled up so it reads).
export function carton(parent, x, y, z, ry = 0) {
  const c = new Group()
  c.position.set(x, y, z)
  c.rotation.y = ry
  block(c, 0.62, 0.2, 0.3, M('#c9a06a', { roughness: 0.9 }), 0, 0, 0)
  block(c, 0.64, 0.06, 0.32, M('#d6b57e', { roughness: 0.9 }), 0, 0.2, 0)
  block(c, 0.3, 0.02, 0.2, M('#f7f4ec'), 0, 0.27, 0)
  parent.add(c)
  return c
}

// --- Town ---------------------------------------------------------------------------------------------------
// The town market: a brick hall with a striped awning, produce stalls under it
// and a SELL HERE sign. Front faces +Z (the road is to the -Z side, so it is
// placed rotated to face north).
export function townMarket() {
  const g = new Group()
  const brick = M('#b8573a', { roughness: 0.85 })
  const cream = M('#f5efd6', { roughness: 0.6 })
  const W = 20
  const D = 12
  const H = 6
  block(g, W, H, D, brick, 0, 0, -D / 2)
  block(g, W + 0.4, 0.6, D + 0.4, cream, 0, H, -D / 2)
  // Arched openings along the front.
  for (let i = 0; i < 4; i++) {
    const x = -W / 2 + 2.5 + i * 5
    block(g, 3.4, 3.6, 0.1, M('#3a2418'), x, 0, 0.02)
    block(g, 3.8, 0.3, 0.2, cream, x, 3.6, 0.06)
  }
  // Striped awning.
  for (let i = 0; i < 10; i++) {
    const a = box(g, 2, 0.08, 3.2, M(i % 2 ? '#f5efd6' : '#2f8a57', { roughness: 0.7 }), -W / 2 + 1 + i * 2, 4.3, 1.5)
    a.rotation.x = 0.28
  }
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) block(g, 0.18, 4.2, 0.18, M('#3a2418'), x, 0, 2.9)
  // Produce crates under the awning.
  const fills = ['#f1c75a', '#f08a24', '#fff3dc', '#4f9a3a', '#ee7a1f', '#f4d03a', '#d6322c']
  for (let i = 0; i < 7; i++) {
    const x = -W / 2 + 2 + i * 2.7
    block(g, 1.8, 0.8, 1.1, M('#a8723f', { roughness: 0.9 }), x, 0, 1.3)
    block(g, 1.6, 0.12, 0.9, M(fills[i], { roughness: 0.8 }), x, 0.8, 1.3)
    for (let k = 0; k < 5; k++) {
      const s = new Mesh(new SphereGeometry(0.16, 8, 6), M(fills[i], { roughness: 0.6 }))
      s.position.set(x - 0.6 + k * 0.3, 0.98, 1.2 + (k % 2) * 0.2)
      g.add(s)
    }
  }
  const sign = painted(1024, 220, { bg: '#2f8a57', border: '#f5efd6', borderWidth: 14, radius: 20, lines: [{ text: 'TOWN MARKET', size: 120, color: '#f5efd6', stroke: '#173f28', strokeWidth: 12 }, { text: 'we buy eggs, crops, milk & more', size: 44, color: '#ffe9a0' }] })
  signPanel(g, 12, 2.6, sign, 0, H + 1.6, 0.25)
  block(g, 12.4, 2.9, 0.2, M('#173f28'), 0, H + 0.15, 0.1)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g }
}
// The vehicle dealer: a glass showroom with flags and a tractor on a podium.
export function dealer() {
  const g = new Group()
  const W = 22
  const D = 14
  const H = 6.5
  block(g, W, 0.3, D, M('#c9c6bf', { roughness: 0.8 }), 0, 0, -D / 2)
  block(g, W, H, 0.6, M('#e8e4da'), 0, 0, -D)
  for (const s of [-1, 1]) block(g, 0.6, H, D, M('#e8e4da'), s * (W / 2 - 0.3), 0, -D / 2)
  block(g, W + 1, 0.7, D + 1, M('#2f6fd0'), 0, H, -D / 2)
  // Glass front with mullions.
  block(g, W - 1.2, H - 0.3, 0.08, M('#9fd8ff', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 }), 0, 0.3, -0.1)
  for (let i = 0; i <= 6; i++) block(g, 0.14, H - 0.3, 0.16, M('#3a3d42'), -W / 2 + 0.6 + i * ((W - 1.2) / 6), 0.3, -0.1)
  const sign = painted(1024, 200, { bg: '#2f6fd0', border: '#f5efd6', borderWidth: 12, radius: 16, lines: [{ text: 'VEHICLE DEALER', size: 110, color: '#ffffff', stroke: '#13305e', strokeWidth: 12 }, { text: 'tractors · trucks · bikes', size: 46, color: '#ffe9a0' }] })
  signPanel(g, 12, 2.4, sign, 0, H + 0.35, 0.52)
  // Flags on poles out front.
  const flags = []
  for (let i = 0; i < 4; i++) {
    const x = -W / 2 + 2 + i * 6
    cyl(g, 0.06, 0.06, 7, M('#d9dde1', { metalness: 0.6 }), x, 3.5, 3.5, 8)
    const f = new Group()
    f.position.set(x, 6.4, 3.5)
    block(f, 0.04, 0.9, 1.4, M(['#d6322c', '#f2c230', '#2f6fd0', '#3f8a4a'][i]), 0, -0.45, 0.72)
    g.add(f)
    flags.push(f)
  }
  // Podium with a turning display.
  const podium = new Group()
  podium.position.set(0, 0.3, -6)
  cyl(podium, 4, 4, 0.4, M('#3a3d42', { metalness: 0.4, roughness: 0.3 }), 0, 0.2, 0, 32)
  g.add(podium)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, flags, podium }
}
// A small town house (gable roof, door, windows, a chimney).
export function townHouse(color = '#e8c48a', roofColor = '#7a3a2a', w = 8, d = 7) {
  const g = new Group()
  block(g, w, 4.2, d, M(color, { roughness: 0.8 }), 0, 0, 0)
  prism(g, w, 2.4, d, M(color, { roughness: 0.8 }), 0, 4.2, 0)
  gableRoof(g, w, d, 4.2, 32, M(roofColor), { overhang: 0.4, axis: 'z', trim: M('#f7f4ec') })
  block(g, 1.2, 2.2, 0.08, M('#5a3a24'), 0, 0, d / 2 + 0.03)
  for (const s of [-1, 1]) {
    block(g, 1.3, 1.2, 0.08, E('#ffe2a0', 0.35), s * (w / 2 - 1.6), 1.3, d / 2 + 0.03)
    block(g, 1.5, 0.14, 0.14, M('#f7f4ec'), s * (w / 2 - 1.6), 1.25, d / 2 + 0.08)
  }
  block(g, 0.8, 2.2, 0.8, M('#8a4a32'), w / 2 - 1.5, 5, -1)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return g
}
export { MeshStandardMaterial }
