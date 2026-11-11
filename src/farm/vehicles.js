import { AdditiveBlending, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { M } from './kit.js'
import { makeNPC } from './npc.js'
import { arc, bakeStatic, bx, compact, cy, darkGlass, decal, extrude, glass, lathe, lens, metal, paint, panel, plastic, plate, rbox, ring, rubber, sph, tube, tyre } from './detail.js'
import { makeRig } from './rig.js'

// Detailed vehicles (front = +Z, origin on the ground between the wheels).
// Each returns { g, rig (farm/rig.js), ... } with its moving parts: steered
// wheels, a sprung body, switchable lamps, an exhaust with a rain cap, cargo
// that shows how full it is, a seated driver, and parts that appear as the
// player upgrades it (setLevel).

const chromeM = () => metal('#e3e7ea', 0.15)
const blackM = () => plastic('#1f2124')

function seatedDriver(look) {
  const n = makeNPC({ ...look, item: null, scale: 0.84 })
  n.legL.rotation.x = n.legR.rotation.x = -1.45
  n.armL.rotation.x = n.armR.rotation.x = -1.05
  return n
}
// A wheel that can steer and spin: group (steer, spin) holding one or two tyres.
function wheelAt(parent, x, y, z, r, w, opts = {}) {
  const g = new Group() // steers (rotation.y)
  g.position.set(x, y, z)
  const spin = new Group() // rolls (rotation.x)
  g.add(spin)
  const side = x < 0 ? -1 : 1
  spin.add(tyre(r, w, { ...opts, side }))
  if (opts.dual) {
    const t2 = tyre(r, w, { ...opts, side })
    t2.position.x = -side * (w + 0.04)
    spin.add(t2)
  }
  if (opts.cap) g.userData.cap = rimCap(spin, r, w, side, opts.spokes ?? 6, opts.cap)
  parent.add(g)
  g.userData.spin = spin
  return g
}
// Head / tail lamp: a housing with a lens.
function lamp(parent, mat, w, h, x, y, z, d = 0.08, housing = blackM()) {
  rbox(parent, w + 0.06, h + 0.06, d, 0.03, housing, x, y, z - Math.sign(z) * 0.01)
  return rbox(parent, w, h, d + 0.02, 0.025, mat, x, y, z)
}

// --- Looks: paint, rims and a roof light bar (setLook) ------------------------------------------------------
// A material of this vehicle's own (cloned from the shared cache, never merged
// by bake with a look-alike) so repainting one vehicle leaves every other alone.
const own = (m) => {
  const c = m.clone()
  c.userData = { ...m.userData, k: Math.random() }
  return c
}
// The tyres' rims are baked into the tyre's vertex colours, so a custom rim colour
// is a painted shell (barrel, spokes, hub cap) of the vehicle's own rim material
// laid over the baked rim; hidden until setLook({ rims }) asks for a colour.
function rimCap(spin, r, w, side, spokes, mat) {
  const c = new Group()
  cy(c, r * 0.615, r * 0.615, w * 0.8, mat, 0, 0, 0, 24, 'x')
  const face = side * w * 0.41
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    const sp = bx(c, 0.035, r * 0.44, r * 0.12, mat, face + side * 0.016, Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27)
    sp.rotation.x = a
  }
  cy(c, r * 0.21, r * 0.23, w * 0.86 + 0.05, mat, 0, 0, 0, 14, 'x')
  c.visible = false
  spin.add(c)
  return c
}
// A roof light bar: base, amber end domes with spinning reflectors (rig spinners)
// and a row of white LEDs that light with the headlamps (`led` goes in lights.head).
function roofBar(parent, w, x, y, z) {
  const g = new Group()
  g.position.set(x, y, z)
  const led = lens('#fffbe8', 0.15)
  rbox(g, w, 0.1, 0.28, 0.04, blackM(), 0, 0.05, 0)
  for (const s of [-1, 1]) bx(g, 0.1, 0.12, 0.22, blackM(), s * (w / 2 - 0.18), -0.04, 0)
  const dome = M('#ffb347', { roughness: 0.1, transparent: true, opacity: 0.55, emissive: '#ff8a00', emissiveIntensity: 0.35 })
  const dw = w * 0.26
  for (const s of [-1, 1]) rbox(g, dw, 0.16, 0.26, 0.07, dome, s * (w / 2 - dw / 2 - 0.02), 0.18, 0)
  rbox(g, w - dw * 2 - 0.08, 0.12, 0.24, 0.05, M('#dfe6ea', { roughness: 0.1, transparent: true, opacity: 0.45 }), 0, 0.16, 0)
  const n = Math.max(3, Math.round((w - dw * 2) / 0.22))
  for (let i = 0; i < n; i++) rbox(g, 0.1, 0.06, 0.03, 0.01, led, (i - (n - 1) / 2) * ((w - dw * 2 - 0.2) / Math.max(1, n - 1)), 0.16, 0.12)
  const spin = []
  const strobe = lens('#ffa020', 3)
  for (const s of [-1, 1]) {
    const r = new Group()
    r.position.set(s * (w / 2 - dw / 2 - 0.02), 0.18, 0)
    bx(r, dw * 0.55, 0.08, 0.02, strobe, 0, 0, 0.05)
    bx(r, dw * 0.55, 0.08, 0.02, metal('#e3e7ea', 0.1), 0, 0, -0.05)
    g.add(r)
    spin.push({ obj: r, speed: 9 * s, axis: 'y' })
  }
  g.visible = false
  parent.add(g)
  return { g, led, spin }
}
// setLook({ paint, rims, lightBar, horn }): only the given fields change. paint
// recolours the body paint materials, rims shows the rim shells in that colour,
// lightBar calls bar(on). horn is for the sound code (kept in `look` only).
function lookFor({ paints = [], rimMat = null, caps = [], bar = null }) {
  const look = { paint: null, rims: null, lightBar: false, horn: null }
  const setLook = (o = {}) => {
    if (o.paint != null) {
      look.paint = o.paint
      for (const m of paints) m.color.set(o.paint)
    }
    if (o.rims != null && rimMat) {
      look.rims = o.rims
      rimMat.color.set(o.rims)
      for (const c of caps) if (c) c.visible = true
    }
    if (o.lightBar != null) {
      look.lightBar = !!o.lightBar
      bar?.(look.lightBar)
    }
    if (o.horn !== undefined) look.horn = o.horn
    return look
  }
  return { look, setLook }
}
const rimMetal = (color) => own(M(color, { roughness: 0.3, metalness: 0.6 }))

// --- Farm truck -----------------------------------------------------------------------------------------
// A medium cab-over flatbed with stake sides: chassis rails, fuel tank, steps,
// framed glass, a dashboard and seat, roof lights and air horns, a vertical
// exhaust with a flapping rain cap, a ladder rack, dual rear tyres on a
// tandem, full light clusters and crates on the bed.
export function farmTruck(color = '#2f6fd0', label = 'FARM 1') {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const S = new Group() // static parts, baked
  const pnt = own(paint(color, 0.3)) // this truck's own paint (setLook)
  const pntDark = own(paint(color, 0.55))
  const rimM = rimMetal('#d9dde1')
  const grey = metal('#6f767d', 0.5)
  const wood = M('#a8723f', { roughness: 0.85 })
  const woodDark = M('#8a5a2c', { roughness: 0.9 })
  const head = lens('#fffbe8', 0.5)
  const brake = lens('#ff2a1a', 0.35)
  const indL = lens('#ffa020', 0.1)
  const indR = lens('#ffa020', 0.1)
  const rev = lens('#ffffff', 0.05)
  const marker = lens('#ffb020', 1.2)

  // Chassis: rails, cross members, tanks, battery box, driveshaft.
  for (const s of [-1, 1]) bx(S, 0.16, 0.3, 6.9, grey, s * 0.55, 0.78, -0.35)
  for (const z of [2.2, 0.8, -0.6, -2.0, -3.4]) bx(S, 1.1, 0.18, 0.16, grey, 0, 0.78, z)
  const tank = cy(S, 0.32, 0.32, 1.3, metal('#c7ccd1', 0.25), 0.95, 0.85, 0.35, 20, 'z')
  void tank
  for (const z of [-0.1, 0.8]) ring(S, 0.33, 0.025, grey, 0.95, 0.85, z, 'z')
  bx(S, 0.5, 0.45, 0.6, blackM(), -0.95, 0.85, 0.35) // battery box
  bx(S, 0.6, 0.06, 0.6, metal('#9aa0a6'), -0.95, 1.1, 0.35)
  cy(S, 0.08, 0.08, 4.2, grey, 0, 0.62, -1.0, 8, 'z') // driveshaft
  for (const z of [-1.9, -3.1]) cy(S, 0.12, 0.12, 2.0, grey, 0, 0.52, z, 10, 'x') // rear axles
  cy(S, 0.1, 0.1, 2.0, grey, 0, 0.52, 2.6, 10, 'x')
  for (const z of [-1.9, -3.1]) cy(S, 0.3, 0.3, 0.5, grey, 0, 0.52, z, 14, 'x') // diff housings
  // Leaf springs.
  for (const s of [-1, 1]) for (const z of [-2.5, 2.6]) for (let i = 0; i < 3; i++) bx(S, 0.1, 0.04, 1.4 - i * 0.3, grey, s * 0.55, 0.62 - i * 0.05, z)

  // Cab.
  rbox(S, 2.44, 1.3, 2.1, 0.12, pnt, 0, 1.45, 2.35)
  rbox(S, 2.4, 1.25, 2.02, 0.2, pnt, 0, 2.6, 2.3)
  rbox(S, 2.3, 0.18, 1.9, 0.08, M('#f4f1e8', { roughness: 0.4 }), 0, 3.28, 2.25) // roof cap
  // Air deflector on the roof.
  const defl = extrude(S, [[0, 0], [1.4, 0], [1.4, 0.18], [0, 0.85]], 2.1, pnt, 0, 3.36, 1.45, 0.04)
  defl.rotation.y = -Math.PI / 2
  // Windscreen with a rubber surround, wipers, sun visor.
  bx(S, 2.22, 1.08, 0.04, blackM(), 0, 2.58, 3.33)
  bx(S, 2.1, 0.98, 0.05, darkGlass(), 0, 2.6, 3.345)
  for (const s of [-0.5, 0.45]) {
    const w = bx(S, 0.9, 0.03, 0.03, blackM(), s, 2.15, 3.38)
    w.rotation.z = 0.25
  }
  bx(S, 2.3, 0.16, 0.5, pntDark, 0, 3.18, 3.45)
  // Side windows, door seams, handles, steps, grab handles.
  for (const s of [-1, 1]) {
    bx(S, 0.05, 0.8, 1.15, blackM(), s * 1.205, 2.62, 2.45)
    bx(S, 0.06, 0.72, 1.06, darkGlass(), s * 1.21, 2.64, 2.45)
    bx(S, 0.05, 1.9, 0.03, M('#20232a'), s * 1.215, 1.95, 1.75) // door seam back
    bx(S, 0.05, 1.9, 0.03, M('#20232a'), s * 1.215, 1.95, 3.2) // door seam front
    bx(S, 0.06, 0.06, 0.25, chromeM(), s * 1.23, 2.0, 2.0) // handle
    tube(S, [s * 1.24, 1.4, 3.15], [s * 1.24, 2.4, 3.15], 0.025, chromeM()) // grab handle
    for (const [y, d] of [[0.55, 0.45], [0.95, 0.4]]) bx(S, 0.5, 0.05, d, metal('#b8bec4', 0.3), s * 1.05, y, 2.75) // steps
    // Mirror on arms.
    tube(S, [s * 1.2, 2.9, 3.0], [s * 1.55, 2.9, 3.2], 0.025, blackM())
    tube(S, [s * 1.2, 2.2, 3.0], [s * 1.55, 2.4, 3.2], 0.025, blackM())
    rbox(S, 0.1, 0.55, 0.28, 0.04, blackM(), s * 1.58, 2.65, 3.22)
    bx(S, 0.02, 0.48, 0.22, metal('#cfd8dc', 0.05), s * 1.58 - s * 0.05, 2.65, 3.22)
    // Side marker on the cab.
    rbox(S, 0.04, 0.08, 0.16, 0.02, marker, s * 1.225, 1.1, 3.1)
  }
  // Wheel arches on the cab and fenders over the rear tandem.
  for (const sd of [-1, 1]) {
    const ar = extrude(S, [...arc(0, 0, 0.66, 0, Math.PI, 14), ...arc(0, 0, 0.58, Math.PI, 0, 14)], 0.4, M('#1f2124'), sd * 1.1, 0.55, 2.6, 0.02)
    ar.rotation.y = Math.PI / 2
    rbox(S, 0.75, 0.06, 2.6, 0.03, M('#1f2124'), sd * 0.98, 1.12, -2.5)
  }
  // Grille, badge, bumper, plate, horns.
  rbox(S, 1.75, 0.95, 0.08, 0.06, chromeM(), 0, 1.45, 3.42)
  bx(S, 1.6, 0.82, 0.06, blackM(), 0, 1.45, 3.45)
  for (let i = 0; i < 9; i++) bx(S, 0.05, 0.78, 0.04, chromeM(), -0.72 + i * 0.18, 1.45, 3.48)
  cy(S, 0.12, 0.12, 0.04, chromeM(), 0, 2.0, 3.43, 16, 'z')
  rbox(S, 2.56, 0.36, 0.34, 0.08, metal('#9aa0a6', 0.3), 0, 0.7, 3.42)
  panel(S, 0.55, 0.2, plate(label), 0, 0.72, 3.6)
  for (const s of [-0.18, 0.18]) {
    const h = cy(S, 0.03, 0.09, 0.45, chromeM(), s * 1.6, 3.42, 2.2, 10, 'z')
    void h
  }
  // Lamps: headlights, indicators, fog lights, roof markers.
  for (const s of [-1, 1]) {
    lamp(S, head, 0.42, 0.24, s * 0.98, 1.2, 3.44)
    lamp(S, s > 0 ? indL : indR, 0.16, 0.16, s * 1.1, 1.62, 3.42)
    lamp(S, head, 0.16, 0.12, s * 0.8, 0.62, 3.6, 0.06)
  }
  for (let i = 0; i < 5; i++) rbox(S, 0.14, 0.08, 0.1, 0.03, marker, -0.5 + i * 0.25, 3.42, 3.25)
  // Interior seen through the glass: seat, wheel, dash.
  rbox(S, 0.6, 0.7, 0.55, 0.08, plastic('#3a3d42'), -0.5, 1.95, 2.0)
  rbox(S, 0.6, 0.12, 0.6, 0.05, plastic('#3a3d42'), -0.5, 1.75, 2.3)
  rbox(S, 2.1, 0.35, 0.4, 0.06, plastic('#26282c'), 0, 2.15, 3.1)
  const wheelS = ring(S, 0.22, 0.03, blackM(), -0.5, 2.35, 2.8, 'z')
  wheelS.rotation.x = -0.6

  // Exhaust stack with heat shield; the rain cap flaps (rig.flap).
  cy(S, 0.09, 0.09, 2.8, chromeM(), -1.05, 2.0, 1.15, 12)
  rbox(S, 0.24, 1.1, 0.24, 0.05, metal('#c7ccd1', 0.4), -1.05, 1.9, 1.15)
  for (let i = 0; i < 5; i++) bx(S, 0.26, 0.03, 0.26, M('#3a3d42'), -1.05, 1.5 + i * 0.2, 1.15)
  const flap = new Group()
  flap.position.set(-1.05, 3.4, 1.06)
  bx(flap, 0.2, 0.02, 0.2, chromeM(), 0, 0, 0.09)
  body.add(flap)

  // Bed: steel frame, plank deck, stake sides, headboard + ladder rack.
  bx(S, 2.5, 0.16, 4.7, grey, 0, 1.0, -1.25)
  for (let i = 0; i < 10; i++) bx(S, 0.24, 0.06, 4.6, i % 2 ? wood : woodDark, -1.12 + i * 0.25, 1.11, -1.25)
  rbox(S, 2.5, 1.4, 0.12, 0.03, grey, 0, 1.85, 1.1) // headboard
  for (let i = 0; i < 6; i++) bx(S, 2.3, 0.04, 0.04, metal('#9aa0a6'), 0, 1.3 + i * 0.25, 1.18)
  tube(S, [-1.2, 2.55, 1.1], [-1.2, 3.3, 1.5], 0.04, grey) // ladder rack
  tube(S, [1.2, 2.55, 1.1], [1.2, 3.3, 1.5], 0.04, grey)
  tube(S, [-1.2, 3.3, 1.5], [1.2, 3.3, 1.5], 0.04, grey)
  const rails = []
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      bx(S, 0.12, 0.2, 0.12, grey, s * 1.22, 1.05, -3.4 + i * 0.85) // stake pockets
      bx(S, 0.1, 1.0, 0.1, woodDark, s * 1.22, 1.6, -3.4 + i * 0.85)
    }
    for (const y of [1.45, 1.85]) bx(S, 0.06, 0.16, 4.5, wood, s * 1.25, y, -1.25)
    // Taller rails, added with the Truck Bed upgrade.
    for (let l = 0; l < 3; l++) {
      const r = new Group()
      for (let i = 0; i < 6; i++) bx(r, 0.08, 0.36, 0.08, woodDark, s * 1.22, 2.25 + l * 0.36, -3.4 + i * 0.85)
      bx(r, 0.06, 0.14, 4.5, wood, s * 1.25, 2.35 + l * 0.36, -1.25)
      r.visible = false
      body.add(r)
      rails.push({ r, l })
    }
    rbox(S, 0.05, 0.08, 0.14, 0.02, marker, s * 1.29, 1.05, -1.25)
  }
  bx(S, 2.5, 0.9, 0.1, wood, 0, 1.55, -3.58) // tailgate
  for (const s of [-1, 1]) {
    // Rear light cluster: indicator, brake, reverse.
    rbox(S, 0.62, 0.22, 0.1, 0.03, blackM(), s * 0.88, 0.75, -3.7)
    rbox(S, 0.18, 0.16, 0.06, 0.02, s > 0 ? indL : indR, s * 1.08, 0.75, -3.76)
    rbox(S, 0.18, 0.16, 0.06, 0.02, brake, s * 0.88, 0.75, -3.76)
    rbox(S, 0.14, 0.14, 0.06, 0.02, rev, s * 0.69, 0.75, -3.76)
    bx(S, 0.5, 0.6, 0.02, rubber(), s * 1.0, 0.45, -3.5) // mudflaps
  }
  bx(S, 2.1, 0.12, 0.12, grey, 0, 0.42, -3.72) // underride bar
  panel(S, 0.55, 0.2, plate(label), 0, 1.0, -3.77, Math.PI)
  bakeStatic(body, S)

  // Upgrade parts: a bull bar, twin stacks, a roof light bar.
  const bull = new Group()
  for (const s of [-1, 1]) tube(bull, [s * 0.9, 0.5, 3.65], [s * 0.9, 1.7, 3.65], 0.05, chromeM())
  tube(bull, [-0.9, 1.7, 3.65], [0.9, 1.7, 3.65], 0.05, chromeM())
  tube(bull, [-1.0, 1.1, 3.7], [1.0, 1.1, 3.7], 0.05, chromeM())
  body.add(bull)
  const stack2 = new Group()
  cy(stack2, 0.09, 0.09, 2.8, chromeM(), 1.05, 2.0, 1.15, 12)
  rbox(stack2, 0.24, 1.1, 0.24, 0.05, metal('#c7ccd1', 0.4), 1.05, 1.9, 1.15)
  body.add(stack2)
  const bar = new Group()
  rbox(bar, 1.8, 0.14, 0.22, 0.05, blackM(), 0, 3.95, 2.0)
  for (let i = 0; i < 6; i++) rbox(bar, 0.2, 0.1, 0.06, 0.02, head, -0.75 + i * 0.3, 3.95, 2.12)
  body.add(bar)
  for (const p of [bull, stack2, bar]) p.visible = false

  // Cargo: 12 crate slots (crates, sacks, milk cans) shown by how full the bed is.
  const crates = []
  const fills = ['#fff3dc', '#f1c75a', '#f08a24', '#f4d03a', '#4f9a3a']
  for (let i = 0; i < 12; i++) {
    const c = new Group()
    const col = i % 2
    const row = Math.floor(i / 2) % 3
    const layer = Math.floor(i / 6)
    c.position.set(col ? 0.58 : -0.58, 1.14 + layer * 0.64, 0.5 - row * 1.35)
    const kind = i % 4
    if (kind === 3) {
      for (let k = 0; k < 4; k++) {
        cy(c, 0.2, 0.22, 0.55, metal('#c9ced3', 0.25), -0.22 + (k % 2) * 0.44, 0.28, -0.22 + Math.floor(k / 2) * 0.44, 12)
        cy(c, 0.12, 0.12, 0.12, metal('#c9ced3', 0.25), -0.22 + (k % 2) * 0.44, 0.6, -0.22 + Math.floor(k / 2) * 0.44, 10)
      }
    } else if (kind === 2) {
      for (let k = 0; k < 2; k++) rbox(c, 0.95, 0.32, 0.55, 0.14, M('#e2cfa0', { roughness: 1 }), 0, 0.16 + k * 0.3, -0.2 + k * 0.4)
    } else {
      rbox(c, 1.0, 0.6, 1.0, 0.04, M('#c79a5c', { roughness: 0.85 }), 0, 0.3, 0)
      for (const y of [0.12, 0.48]) bx(c, 1.02, 0.07, 1.02, M('#8a5a2c'), 0, y, 0)
      for (let k = 0; k < 6; k++) sph(c, 0.13, M(fills[(i + k) % fills.length], { roughness: 0.6 }), -0.3 + (k % 3) * 0.3, 0.64, -0.2 + Math.floor(k / 3) * 0.4)
    }
    c.visible = false
    body.add(c)
    crates.push(c)
  }
  // Ratchet straps over the load.
  const straps = new Group()
  for (const z of [0.3, -1.1, -2.4]) tube(straps, [-1.25, 1.2, z], [-1.0, 2.5, z], 0.02, M('#f2a03a')), tube(straps, [-1.0, 2.5, z], [1.0, 2.5, z], 0.02, M('#f2a03a')), tube(straps, [1.0, 2.5, z], [1.25, 1.2, z], 0.02, M('#f2a03a'))
  straps.visible = false
  body.add(straps)

  // Wheels: steered fronts, dual rears on a tandem.
  const wheels = []
  for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 1.1, 0.52, 2.6, 0.52, 0.32, { lugs: 20, rim: '#d9dde1', cap: rimM }), r: 0.52, steer: true })
  for (const z of [-1.9, -3.1]) for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 0.96, 0.52, z, 0.52, 0.3, { lugs: 20, rim: '#d9dde1', dual: true, cap: rimM }), r: 0.52 })
  // Driver (shown while a hired driver drives).
  const drv = seatedDriver({ shirt: '#2f6fd0', pants: '#2b2b2b', hat: 'beanie', hatColor: '#2b2b2b' })
  drv.group.position.set(-0.5, 1.55, 2.0)
  drv.group.visible = false
  body.add(drv.group)
  // The customisable roof light bar (setLook lightBar), over the windscreen.
  const lb = roofBar(body, 2.0, 0, 3.47, 3.1)

  compact(g)
  const rig = makeRig({ g, body, wheels, wheelbase: 5.1, rear: -2.5, track: 1.0, exhaust: [[-1.05, 3.45, 1.15]], flap, spinners: lb.spin, lights: { head: [head, lb.led], brake: [brake], ind: [[indL], [indR]], reverse: [rev] } })
  const { look, setLook } = lookFor({ paints: [pnt, pntDark], rimMat: rimM, caps: wheels.map((w) => w.g.userData.cap), bar: (on) => (lb.g.visible = on) })
  return {
    look,
    setLook,
    g,
    body,
    rig,
    crates,
    driver: drv,
    // Cargo fill 0..1: crates appear front to back, straps once loaded.
    setLoad(f) {
      const k = Math.ceil(Math.min(1, f) * crates.length)
      crates.forEach((c, i) => (c.visible = i < k))
      straps.visible = k > 0
    },
    // Garage upgrades: bed level (taller rails), engine level (bull bar, twin stacks, light bar).
    setLevel({ bed = 0, engine = 0 } = {}) {
      for (const { r, l } of rails) r.visible = l < Math.min(3, bed)
      bull.visible = engine >= 1
      stack2.visible = engine >= 2
      bar.visible = engine >= 3
      rig.exhaust = engine >= 2 ? [[-1.05, 3.45, 1.15], [1.05, 3.45, 1.15]] : [[-1.05, 3.45, 1.15]]
    },
  }
}

// --- The egg van ------------------------------------------------------------------------------------------
// A delivery van with a proper silhouette (bonnet, raked windscreen, high
// roof), a sliding side door, hinged rear doors, a roof ladder and rack,
// wipers, mirrors, the FARM FRESH livery, light clusters and its driver.
export function eggVan() {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const S = new Group()
  const white = paint('#f7f6f2', 0.28)
  const yellow = paint('#f2c230', 0.35)
  const grey = metal('#7a8088', 0.45)
  const head = lens('#fffbe8', 0.5)
  const brake = lens('#ff2a1a', 0.35)
  const indL = lens('#ffa020', 0.1)
  const indR = lens('#ffa020', 0.1)
  const rev = lens('#ffffff', 0.05)
  // Side profile (u along the length, y up), extruded across the width.
  const prof = [[-2.75, 0.42], [2.5, 0.42], [2.78, 0.6], [2.8, 1.12], [2.3, 1.32], [1.62, 2.28], [1.3, 2.72], [-2.75, 2.72]]
  const shell = extrude(S, prof, 2.0, white, 0, 0, 0, 0.06)
  shell.rotation.y = -Math.PI / 2
  // Wheel arches (dark), sills, the yellow stripe.
  for (const s of [-1, 1]) {
    for (const z of [1.75, -1.8]) {
      const a = extrude(S, [...arc(0, 0, 0.58, 0, Math.PI, 12), [-0.58, -0.02], [0.58, -0.02]], 0.06, M('#2a2c30'), s * 1.04, 0.45, z, 0)
      a.rotation.y = Math.PI / 2
    }
    bx(S, 0.04, 0.2, 5.0, yellow, s * 1.045, 1.0, -0.1)
    bx(S, 0.06, 0.14, 4.6, M('#3a3d42'), s * 1.04, 0.5, -0.1)
  }
  // Windscreen, side windows, wipers.
  const wsLen = Math.hypot(0.68, 0.96)
  const ws = bx(S, 1.9, wsLen, 0.04, darkGlass(), 0, 1.8, 1.96)
  ws.rotation.x = -Math.atan2(0.68, 0.96)
  for (const s of [-0.45, 0.45]) {
    const w = bx(S, 0.8, 0.03, 0.03, M('#1f2124'), s, 1.42, 2.3)
    w.rotation.z = s > 0 ? 0.2 : -0.2
  }
  for (const s of [-1, 1]) {
    bx(S, 0.05, 0.7, 0.85, darkGlass(), s * 1.04, 1.85, 1.15)
    bx(S, 0.05, 0.06, 0.9, M('#1f2124'), s * 1.045, 1.5, 1.15)
    // Mirrors.
    tube(S, [s * 1.0, 1.6, 1.6], [s * 1.25, 1.65, 1.75], 0.025, M('#1f2124'))
    rbox(S, 0.1, 0.34, 0.22, 0.04, M('#1f2124'), s * 1.3, 1.75, 1.78)
    // Door handle and seams.
    bx(S, 0.05, 0.05, 0.22, metal('#cfd4d8', 0.2), s * 1.06, 1.35, 0.85)
    bx(S, 0.05, 2.2, 0.03, M('#c9c6bf'), s * 1.045, 1.55, 0.55)
  }
  // Sliding side door track and a step, on the kerb side (+X).
  bx(S, 0.05, 0.05, 2.2, M('#3a3d42'), 1.05, 2.45, -0.6)
  bx(S, 0.3, 0.06, 1.2, metal('#b8bec4', 0.3), 1.05, 0.42, -0.4)
  // Livery panels.
  const logo = decal(1024, 400, (ctx, w, h) => {
    ctx.fillStyle = '#f7f6f2'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#2f6fd0'
    ctx.beginPath()
    ctx.ellipse(170, 200, 130, 160, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff6e3'
    ctx.beginPath()
    ctx.ellipse(170, 210, 80, 105, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '700 110px Fredoka, Arial, sans-serif'
    ctx.lineWidth = 12
    ctx.strokeStyle = '#7a1410'
    ctx.strokeText('FARM FRESH', 330, 140)
    ctx.fillStyle = '#d6322c'
    ctx.fillText('FARM FRESH', 330, 140)
    ctx.font = '700 84px Fredoka, Arial, sans-serif'
    ctx.fillStyle = '#2f6fd0'
    ctx.fillText('EGG CARTONS', 335, 260)
    ctx.font = '600 44px Fredoka, Arial, sans-serif'
    ctx.fillStyle = '#6a6f78'
    ctx.fillText('from the farm to your door', 338, 340)
  })
  panel(S, 3.4, 1.33, logo, 1.04, 1.9, -1.0, Math.PI / 2)
  panel(S, 3.4, 1.33, logo, -1.04, 1.9, -1.0, -Math.PI / 2)
  // Front: grille, badge, bumper, lamps, plate.
  rbox(S, 1.3, 0.34, 0.06, 0.05, M('#1f2124'), 0, 0.88, 2.79)
  for (let i = 0; i < 4; i++) bx(S, 1.2, 0.03, 0.03, metal('#cfd4d8', 0.2), 0, 0.78 + i * 0.07, 2.82)
  rbox(S, 2.1, 0.26, 0.24, 0.08, M('#8a8f96', { roughness: 0.5 }), 0, 0.42, 2.82)
  panel(S, 0.5, 0.18, plate('EGGS 1'), 0, 0.44, 2.95)
  for (const s of [-1, 1]) {
    lamp(S, head, 0.36, 0.2, s * 0.74, 1.0, 2.79, 0.06)
    lamp(S, s > 0 ? indL : indR, 0.14, 0.12, s * 0.98, 0.98, 2.76, 0.06)
  }
  // Back: lamps, bumper, plate, ladder.
  for (const s of [-1, 1]) {
    rbox(S, 0.2, 0.7, 0.08, 0.03, M('#1f2124'), s * 0.92, 1.0, -2.77)
    rbox(S, 0.16, 0.2, 0.06, 0.02, brake, s * 0.92, 1.2, -2.8)
    rbox(S, 0.16, 0.16, 0.06, 0.02, s > 0 ? indL : indR, s * 0.92, 0.96, -2.8)
    rbox(S, 0.16, 0.14, 0.06, 0.02, rev, s * 0.92, 0.76, -2.8)
  }
  rbox(S, 2.1, 0.24, 0.26, 0.08, M('#8a8f96', { roughness: 0.5 }), 0, 0.42, -2.8)
  for (const x of [0.62, 0.92]) tube(S, [x, 0.6, -2.85], [x, 2.75, -2.85], 0.025, metal('#b8bec4', 0.3))
  for (let i = 0; i < 7; i++) tube(S, [0.62, 0.8 + i * 0.3, -2.85], [0.92, 0.8 + i * 0.3, -2.85], 0.02, metal('#b8bec4', 0.3))
  // Roof: rack, vent, the egg-carton sign, an amber beacon.
  for (const s of [-0.9, 0.9]) bx(S, 0.05, 0.08, 3.6, metal('#b8bec4', 0.3), s, 2.8, -0.9)
  for (let i = 0; i < 5; i++) bx(S, 1.85, 0.05, 0.05, metal('#b8bec4', 0.3), 0, 2.84, -2.5 + i * 0.8)
  rbox(S, 0.6, 0.14, 0.6, 0.05, M('#d9dde1'), 0, 2.8, 0.7)
  const sign = new Group()
  sign.position.set(0, 2.88, -1.0)
  rbox(sign, 1.6, 0.38, 0.85, 0.06, M('#c9a06a', { roughness: 0.9 }), 0, 0.19, 0)
  for (let i = 0; i < 6; i++) sph(sign, 0.17, M('#fff6e3', { roughness: 0.3 }), -0.55 + (i % 3) * 0.55, 0.48, i < 3 ? -0.2 : 0.2, 1, 1.3, 1)
  S.add(sign)
  // Cab interior.
  rbox(S, 0.55, 0.6, 0.5, 0.08, plastic('#3a3d42'), -0.45, 1.25, 0.9)
  rbox(S, 1.8, 0.3, 0.35, 0.06, plastic('#26282c'), 0, 1.4, 1.75)
  const sw = ring(S, 0.19, 0.025, M('#1f2124'), -0.45, 1.65, 1.5, 'z')
  sw.rotation.x = -0.7
  // Inside the cargo box: shelves of cartons (seen when the doors open).
  for (let i = 0; i < 3; i++) bx(S, 1.8, 0.04, 3.0, M('#8a8f96'), 0, 0.9 + i * 0.55, -1.2)
  for (let i = 0; i < 9; i++) rbox(S, 0.55, 0.2, 0.3, 0.03, M('#c9a06a', { roughness: 0.9 }), -0.6 + (i % 3) * 0.6, 1.05 + Math.floor(i / 3) * 0.55, -2.3)
  bakeStatic(body, S)
  const beacon = new Group()
  beacon.position.set(0, 2.96, 0.95)
  cy(beacon, 0.1, 0.12, 0.16, lens('#ffa020', 2), 0, 0.08, 0, 12)
  bx(beacon, 0.02, 0.12, 0.2, lens('#fff0a0', 4), 0.1, 0.08, 0)
  body.add(beacon)

  // Rear doors on hinges.
  const doors = []
  for (const s of [-1, 1]) {
    const hinge = new Group()
    hinge.position.set(s * 1.0, 0.5, -2.76)
    rbox(hinge, 0.98, 2.15, 0.06, 0.03, white, -s * 0.49, 1.08, -0.03)
    bx(hinge, 0.7, 0.6, 0.03, darkGlass(), -s * 0.49, 1.6, -0.07)
    bx(hinge, 0.04, 0.3, 0.06, metal('#cfd4d8', 0.2), -s * 0.9, 1.0, -0.08)
    body.add(hinge)
    doors.push({ hinge, s })
  }
  const wheels = []
  for (const z of [1.75, -1.8]) for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 0.92, 0.44, z, 0.44, 0.3, { lugs: 20, rim: '#cfd4d8' }), r: 0.44, steer: z > 0 })
  const drv = seatedDriver({ shirt: '#2f6fd0', pants: '#2c3e66', hat: 'cap', hatColor: '#d6322c' })
  drv.group.position.set(-0.45, 0.85, 0.9)
  body.add(drv.group)
  compact(g)
  const rig = makeRig({ g, body, wheels, wheelbase: 3.55, rear: -1.8, track: 0.9, exhaust: [[-0.7, 0.35, -2.85]], beacon, lights: { head: [head], brake: [brake], ind: [[indL], [indR]], reverse: [rev] } })
  return { g, body, rig, doors, driver: drv }
}

// --- Tractor ------------------------------------------------------------------------------------------------
// A row-crop tractor: lugged tyres (big rears), a vented bonnet and grille
// with lights, a glass cab on pillars with seat, wheel and dash, roof work
// lights and a rotating beacon, a vertical exhaust with a rain cap, an air
// pre-cleaner, rear fenders and turning front fenders, a front weight pack, a
// three-point hitch, steps and mirrors. The Harvester Header upgrade bolts a
// spinning reel header to the front.
export function tractor(color = '#3f9a3a') {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const S = new Group()
  const pnt = own(paint(color, 0.3)) // this tractor's own paint (setLook)
  const rimM = rimMetal('#f2c230')
  const yellow = paint('#f2c230', 0.4)
  const dark = M('#26282c', { roughness: 0.7 })
  const grey = metal('#6f767d', 0.5)
  const head = lens('#fffbe8', 0.5)
  const work = lens('#fffbe8', 0.3)
  const brake = lens('#ff2a1a', 0.35)
  const indL = lens('#ffa020', 0.1)
  const indR = lens('#ffa020', 0.1)
  // Frame and engine block.
  rbox(S, 0.9, 0.55, 2.6, 0.06, dark, 0, 0.75, 0.75)
  rbox(S, 0.8, 0.5, 0.9, 0.05, grey, 0, 1.0, 0.95) // engine block peeking under the bonnet
  // Bonnet with vents and a grille.
  rbox(S, 1.12, 0.9, 2.1, 0.16, pnt, 0, 1.55, 1.15)
  rbox(S, 1.0, 0.12, 2.0, 0.05, pnt, 0, 2.02, 1.12)
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) bx(S, 0.03, 0.06, 0.6, dark, s * 0.565, 1.4 + i * 0.09, 1.55)
  bx(S, 1.0, 0.8, 0.05, dark, 0, 1.52, 2.2)
  for (let i = 0; i < 7; i++) bx(S, 0.92, 0.03, 0.04, metal('#9aa0a6', 0.3), 0, 1.2 + i * 0.1, 2.23)
  for (const s of [-1, 1]) lamp(S, head, 0.22, 0.14, s * 0.32, 1.85, 2.23, 0.05)
  bx(S, 0.6, 0.12, 0.02, decal(256, 48, (ctx, w, h) => {
    ctx.fillStyle = '#f2c230'
    ctx.font = '700 38px Fredoka, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('FARMPOWER', w / 2, h / 2)
  }), 0, 1.98, 2.21)
  // Front weight pack and the front axle.
  for (let i = 0; i < 6; i++) rbox(S, 0.95, 0.42, 0.13, 0.04, dark, 0, 0.88, 2.3 + i * 0.14)
  rbox(S, 0.95, 0.12, 0.85, 0.04, yellow, 0, 1.12, 2.65)
  cy(S, 0.1, 0.1, 1.5, grey, 0, 0.55, 1.45, 10, 'x')
  // Air pre-cleaner and the exhaust stack.
  cy(S, 0.06, 0.06, 0.9, dark, -0.38, 2.45, 1.55, 8)
  lathe(S, [[0.001, 0], [0.13, 0], [0.16, 0.08], [0.16, 0.3], [0.12, 0.36], [0.001, 0.36]], M('#c9ced3', { roughness: 0.2, transparent: true, opacity: 0.8 }), -0.38, 2.85, 1.55, 16)
  cy(S, 0.07, 0.07, 1.7, metal('#2a2c30', 0.5), 0.38, 2.6, 1.4, 12)
  rbox(S, 0.2, 0.7, 0.2, 0.04, metal('#c7ccd1', 0.4), 0.38, 2.5, 1.4)
  const flap = new Group()
  flap.position.set(0.38, 3.46, 1.32)
  bx(flap, 0.15, 0.02, 0.16, metal('#2a2c30', 0.4), 0, 0, 0.07)
  body.add(flap)
  // Cab: floor, pillars, glass, roof, seat, wheel, dash.
  rbox(S, 1.5, 0.12, 1.8, 0.04, dark, 0, 1.55, -0.55)
  for (const [x, z] of [[-0.72, 0.3], [0.72, 0.3], [-0.72, -1.4], [0.72, -1.4]]) bx(S, 0.08, 1.75, 0.08, dark, x, 2.5, z)
  for (const s of [-1, 1]) bx(S, 0.03, 1.65, 1.62, glass(), s * 0.72, 2.45, -0.55)
  bx(S, 1.36, 1.6, 0.03, glass(), 0, 2.48, 0.32)
  bx(S, 1.36, 1.5, 0.03, glass(), 0, 2.5, -1.42)
  rbox(S, 1.75, 0.18, 2.05, 0.08, M('#f4f1e8', { roughness: 0.4 }), 0, 3.43, -0.55)
  rbox(S, 1.5, 0.08, 1.8, 0.04, pnt, 0, 3.54, -0.55)
  for (const s of [-1, 1]) for (const z of [0.42, -1.5]) lamp(S, work, 0.16, 0.12, s * 0.55, 3.38, z, 0.06)
  rbox(S, 0.55, 0.12, 0.55, 0.05, M('#3a3d42'), 0, 1.95, -0.85) // seat
  rbox(S, 0.55, 0.6, 0.12, 0.05, M('#3a3d42'), 0, 2.25, -1.12)
  tube(S, [0, 1.65, -0.05], [0, 2.35, -0.25], 0.04, dark) // steering column
  const sw = ring(S, 0.2, 0.025, dark, 0, 2.38, -0.28, 'z')
  sw.rotation.x = -0.8
  rbox(S, 0.7, 0.25, 0.2, 0.04, dark, 0, 2.05, 0.12)
  // Steps, mirrors, fuel tank.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) bx(S, 0.3, 0.04, 0.3, metal('#b8bec4', 0.3), s * 0.82, 0.55 + i * 0.35, -0.0)
    tube(S, [s * 0.75, 3.1, 0.3], [s * 1.05, 3.0, 0.45], 0.02, dark)
    rbox(S, 0.08, 0.3, 0.2, 0.03, dark, s * 1.08, 2.85, 0.48)
  }
  rbox(S, 0.5, 0.55, 0.7, 0.1, dark, 0.55, 1.05, 0.15)
  // Rear fenders over the big wheels (arched) with lights.
  for (const s of [-1, 1]) {
    const f = extrude(S, [...arc(0, 0, 1.12, 0, Math.PI, 16), ...arc(0, 0, 1.02, Math.PI, 0, 16)], 0.62, pnt, s * 1.05, 0.95, -0.8, 0.02)
    f.rotation.y = Math.PI / 2
    lamp(S, s > 0 ? indL : indR, 0.1, 0.1, s * 1.05, 2.0, -1.55, 0.05)
    lamp(S, brake, 0.12, 0.1, s * 1.05, 1.88, -1.55, 0.05)
  }
  // Three-point hitch and PTO.
  for (const s of [-1, 1]) tube(S, [s * 0.35, 0.85, -1.3], [s * 0.42, 0.55, -2.0], 0.05, yellow)
  tube(S, [0, 1.35, -1.3], [0, 1.1, -1.95], 0.05, yellow)
  cy(S, 0.06, 0.06, 0.3, grey, 0, 0.75, -1.5, 8, 'z')
  bakeStatic(body, S)
  // Beacon on the roof.
  const beacon = new Group()
  beacon.position.set(0.45, 3.58, -1.2)
  cy(beacon, 0.08, 0.1, 0.14, lens('#ffa020', 2), 0, 0.07, 0, 12)
  bx(beacon, 0.02, 0.1, 0.16, lens('#fff0a0', 4), 0.08, 0.07, 0)
  body.add(beacon)

  // Wheels: lugged chevron tyres, yellow rims; the front fenders steer with the fronts.
  const wheels = []
  for (const s of [-1, 1]) {
    const w = wheelAt(g, s * 0.82, 0.56, 1.45, 0.56, 0.36, { lugs: 18, chevron: true, rim: '#f2c230', spokes: 5, cap: rimM })
    const ff = extrude(w, [...arc(0, 0, 0.68, 0.2, Math.PI - 0.2, 12), ...arc(0, 0, 0.62, Math.PI - 0.2, 0.2, 12)], 0.4, pnt, 0, 0, 0, 0.01)
    ff.rotation.y = Math.PI / 2
    ff.userData.noSpin = true
    wheels.push({ g: w, r: 0.56, steer: true, fender: ff })
  }
  for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 1.05, 0.95, -0.8, 0.95, 0.58, { lugs: 22, chevron: true, rim: '#f2c230', spokes: 8, cap: rimM }), r: 0.95 })

  // The harvester header (upgrade): a wide grain head with a spinning reel.
  const header = new Group()
  header.position.set(0, 0, 3.4)
  const H = new Group()
  rbox(H, 4.4, 0.5, 1.2, 0.08, M('#d6322c', { roughness: 0.4 }), 0, 0.45, 0)
  rbox(H, 4.5, 0.9, 0.12, 0.04, M('#d6322c', { roughness: 0.4 }), 0, 0.85, -0.55)
  for (const s of [-1, 1]) rbox(H, 0.1, 1.0, 1.3, 0.03, M('#b8261a'), s * 2.25, 0.75, 0)
  for (let i = 0; i < 22; i++) bx(H, 0.06, 0.04, 0.35, metal('#cfd4d8', 0.2), -2.1 + i * 0.2, 0.25, 0.7) // cutter teeth
  cy(H, 0.18, 0.18, 4.2, M('#f2c230'), 0, 0.55, -0.1, 12, 'x') // auger
  tube(H, [-0.4, 0.7, -0.6], [-0.4, 1.0, -1.8], 0.06, dark)
  tube(H, [0.4, 0.7, -0.6], [0.4, 1.0, -1.8], 0.06, dark)
  bakeStatic(header, H)
  const reel = new Group()
  reel.position.set(0, 1.35, 0.25)
  cy(reel, 0.06, 0.06, 4.3, grey, 0, 0, 0, 8, 'x')
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    bx(reel, 4.2, 0.04, 0.04, M('#f2c230'), 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5)
    for (const x of [-1.8, 0, 1.8]) tube(reel, [x, 0, 0], [x, Math.cos(a) * 0.5, Math.sin(a) * 0.5], 0.02, grey)
  }
  header.add(reel)
  header.visible = false
  g.add(header)

  const drv = seatedDriver({ shirt: '#3f8a4a', pants: '#2c3e66', hat: 'cap', hatColor: '#f2c230' })
  drv.group.position.set(0, 1.75, -0.75)
  drv.group.visible = false
  body.add(drv.group)
  // The customisable roof light bar (setLook lightBar), at the front of the roof.
  const lb = roofBar(body, 1.3, 0, 3.64, 0.05)
  compact(g)
  const rig = makeRig({
    g,
    body,
    wheels,
    wheelbase: 2.25,
    rear: -0.8,
    track: 1.05,
    exhaust: [[0.38, 3.5, 1.4]],
    flap,
    beacon,
    lights: { head: [head, work, lb.led], brake: [brake], ind: [[indL], [indR]] },
    spinners: [{ obj: reel, speed: 0, axis: 'x' }, ...lb.spin],
  })
  const { look, setLook } = lookFor({ paints: [pnt], rimMat: rimM, caps: wheels.map((w) => w.g.userData.cap), bar: (on) => (lb.g.visible = on) })
  return {
    look,
    setLook,
    g,
    body,
    rig,
    driver: drv,
    header,
    reel,
    setLevel({ header: h = 0, engine = 0 } = {}) {
      header.visible = h > 0
      rig.exhaust = [[0.38, 3.5, 1.4]]
      void engine
    },
  }
}

// --- Bicycle ----------------------------------------------------------------------------------------------
// A city bike: 28 spokes a wheel, tyres, mudguards, a steerable fork with
// handlebar, brake levers and cables, a chainring with crank arms and pedals,
// the chain, a sprung saddle, a wicker basket (eggs show when the bag has
// some), a rear rack with a crate, a dynamo lamp and a bell. It leans into turns.
export function bicycle(color = '#d6322c') {
  const g = new Group()
  const frameG = new Group() // leans
  g.add(frameG)
  const S = new Group()
  const frame = own(paint(color, 0.3)) // this bike's own paint (setColor / setLook)
  const chrome = chromeM()
  const rimM = own(chrome) // rims + hubs (setLook rims)
  const dark = M('#2a2a2e', { roughness: 0.6 })
  const bikeWheel = (z) => {
    const w = new Group()
    w.position.set(0, 0.36, z)
    const W = new Group()
    ring(W, 0.33, 0.035, rubber(), 0, 0, 0, 'x')
    ring(W, 0.31, 0.012, rimM, 0, 0, 0, 'x')
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      const off = (i % 2 ? 1 : -1) * 0.025
      tube(W, [off, 0, 0], [0, Math.cos(a) * 0.3, Math.sin(a) * 0.3], 0.004, chrome, 3)
    }
    cy(W, 0.035, 0.035, 0.11, rimM, 0, 0, 0, 10, 'x')
    bakeStatic(w, W)
    frameG.add(w)
    return w
  }
  const rear = bikeWheel(-0.56)
  // Fork group (steers): fork legs, front wheel, head tube top, bar, lamp, basket.
  const fork = new Group()
  fork.position.set(0, 0.95, 0.42)
  fork.rotation.order = 'YXZ'
  frameG.add(fork)
  const front = bikeWheel(0)
  frameG.remove(front)
  front.position.set(0, 0.36 - 0.95, 0.14)
  fork.add(front)
  const F = new Group()
  for (const x of [-0.05, 0.05]) tube(F, [x, -0.59, 0.14], [x, 0.05, 0], 0.016, chrome)
  tube(F, [0, 0.05, 0], [0, 0.22, -0.02], 0.02, chrome) // stem
  tube(F, [-0.32, 0.22, -0.08], [0.32, 0.22, -0.08], 0.017, chrome) // bar
  for (const s of [-1, 1]) {
    cy(F, 0.024, 0.024, 0.12, dark, s * 0.3, 0.22, -0.08, 8, 'x')
    tube(F, [s * 0.22, 0.23, -0.06], [s * 0.3, 0.19, 0.04], 0.008, dark) // brake lever
  }
  tube(F, [0.22, 0.23, -0.06], [0.05, -0.3, 0.06], 0.005, dark) // cable
  cy(F, 0.032, 0.032, 0.025, metal('#f2c230', 0.2), 0.16, 0.25, -0.08, 12) // bell
  lathe(F, [[0.001, 0], [0.05, 0], [0.06, 0.06], [0.001, 0.07]], chrome, 0, 0.0, 0.08, 12).rotation.x = Math.PI / 2 // lamp
  const mud = ring(F, 0.39, 0.025, M('#f4f1e8', { roughness: 0.4 }), 0, -0.59, 0.14, 'x', Math.PI * 0.6)
  mud.rotation.z = Math.PI * 0.2
  bakeStatic(fork, F)
  const lampLens = lens('#fffbe8', 0.6)
  rbox(fork, 0.07, 0.07, 0.02, 0.02, lampLens, 0, 0.0, 0.15)
  // Basket on the fork.
  const basket = new Group()
  basket.position.set(0, 0.06, 0.18)
  const B = new Group()
  const wick = M('#c48a4a', { roughness: 0.95 })
  bx(B, 0.46, 0.03, 0.36, wick, 0, 0, 0)
  for (const s of [-1, 1]) {
    bx(B, 0.03, 0.26, 0.36, wick, s * 0.22, 0.13, 0)
    bx(B, 0.46, 0.26, 0.03, wick, 0, 0.13, s * 0.17)
  }
  for (let i = 0; i < 4; i++) bx(B, 0.48, 0.02, 0.38, M('#a06a34'), 0, 0.04 + i * 0.07, 0)
  bakeStatic(basket, B)
  const eggs = new Group()
  for (let i = 0; i < 9; i++) sph(eggs, 0.055, M(i % 3 ? '#fff6e3' : '#e9c9a0', { roughness: 0.35 }), -0.13 + (i % 3) * 0.13, 0.1 + Math.floor(i / 3) * 0.03, -0.1 + Math.floor(i / 3) * 0.1, 1, 1.25, 1, 8)
  basket.add(eggs)
  fork.add(basket)
  // The frame.
  tube(S, [0, 0.42, -0.06], [0, 0.86, 0.42], 0.028, frame)
  tube(S, [0, 0.9, -0.12], [0, 0.95, 0.42], 0.025, frame)
  tube(S, [0, 0.42, -0.06], [0, 0.98, -0.16], 0.028, frame)
  for (const x of [-0.06, 0.06]) {
    tube(S, [x, 0.36, -0.56], [0, 0.42, -0.06], 0.014, frame)
    tube(S, [x, 0.36, -0.56], [0, 0.9, -0.12], 0.014, frame)
  }
  cy(S, 0.035, 0.035, 0.22, frame, 0, 0.95, 0.42, 10)
  // Saddle with springs, post.
  tube(S, [0, 0.98, -0.16], [0, 1.08, -0.18], 0.016, chrome)
  rbox(S, 0.18, 0.07, 0.3, 0.03, M('#5a3a24', { roughness: 0.7 }), 0, 1.13, -0.19)
  for (const x of [-0.05, 0.05]) cy(S, 0.018, 0.018, 0.05, chrome, x, 1.08, -0.27, 8)
  // Chainring, chain loop, rear cog, derailleur.
  ring(S, 0.1, 0.012, chrome, 0.07, 0.42, -0.06, 'x')
  cy(S, 0.1, 0.1, 0.008, chrome, 0.07, 0.42, -0.06, 20, 'x')
  ring(S, 0.05, 0.01, chrome, 0.07, 0.36, -0.56, 'x')
  tube(S, [0.07, 0.52, -0.06], [0.07, 0.41, -0.56], 0.007, dark)
  tube(S, [0.07, 0.32, -0.06], [0.07, 0.31, -0.56], 0.007, dark)
  rbox(S, 0.03, 0.1, 0.05, 0.01, dark, 0.09, 0.27, -0.55)
  // Rear mudguard, rack with a crate, reflector, kickstand.
  const rmud = ring(S, 0.39, 0.025, M('#f4f1e8', { roughness: 0.4 }), 0, 0.36, -0.56, 'x', Math.PI * 0.7)
  rmud.rotation.z = Math.PI * 0.45
  bx(S, 0.3, 0.02, 0.4, chrome, 0, 0.86, -0.5)
  for (const x of [-0.14, 0.14]) tube(S, [x, 0.86, -0.32], [0.05 * Math.sign(x), 0.36, -0.56], 0.01, chrome)
  rbox(S, 0.32, 0.22, 0.3, 0.02, M('#c79a5c'), 0, 0.98, -0.5)
  rbox(S, 0.08, 0.05, 0.02, 0.01, lens('#ff2a1a', 0.8), 0, 0.85, -0.72)
  bakeStatic(frameG, S)
  const crank = new Group()
  crank.position.set(0, 0.42, -0.06)
  for (const s of [-1, 1]) {
    const arm = new Group()
    arm.position.x = s * 0.1
    arm.rotation.x = s > 0 ? 0 : Math.PI
    bx(arm, 0.02, 0.17, 0.03, chrome, 0, -0.085, 0)
    rbox(arm, 0.1, 0.03, 0.06, 0.01, dark, s * 0.05, -0.17, 0)
    crank.add(arm)
  }
  frameG.add(crank)
  const stand = tube(frameG, [0.12, 0.42, -0.1], [0.2, 0.02, -0.28], 0.012, dark)
  // Safety flag on a whip pole off the rear rack (setLook lightBar).
  const flag = new Group()
  tube(flag, [-0.13, 0.88, -0.66], [-0.16, 2.05, -0.7], 0.006, M('#f4f1e8', { roughness: 0.5 }), 4)
  const pennant = extrude(flag, [[0, 0], [0, 0.26], [0.42, 0.13]], 0.01, M('#f07a24', { roughness: 0.6, side: 2 }), -0.16, 1.76, -0.7, 0)
  pennant.rotation.y = Math.PI / 2
  sph(flag, 0.02, M('#f2c230'), -0.16, 2.06, -0.7)
  flag.visible = false
  frameG.add(flag)
  frameG.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  compact(g)
  const rig = makeRig({ g, body: frameG, wheels: [{ g: front, r: 0.36 }, { g: rear, r: 0.36 }], wheelbase: 1.12, rear: -0.56, track: 0, lean: 1, fork, crank })
  rig.engineOn = false
  const { look, setLook } = lookFor({ paints: [frame], rimMat: rimM, bar: (on) => (flag.visible = on) })
  return { g, rig, eggs, stand, frame: frameG, look, setLook, setColor: (c) => frame.color.set(c) }
}

// --- Combine harvester ------------------------------------------------------------------------------------
// A drivable combine: big lugged drive tyres at the front, small rear tyres that
// steer the other way (they sit in a mirrored group so the rig's steer angle is
// flipped), the threshing body with louvres and a turning rotary screen, the
// glass cab up high with seat, wheel, work lights and a beacon, a grain tank with
// yellow extensions (grain shows with setLoad), the folding unloading auger, the
// feeder house and a wide header with crop dividers, cutter bar, cross auger and
// the reel (its own group; rotation.x increasing = bats sweep the crop back),
// a straw / chaff spreader at the back, a ladder, mirrors and a driver.
export function combineHarvester(color = '#3f9a3a') {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const S = new Group()
  const pnt = own(paint(color, 0.35))
  const rimM = rimMetal('#f2c230')
  const yellow = paint('#f2c230', 0.4)
  const dark = M('#26282c', { roughness: 0.7 })
  const grey = metal('#6f767d', 0.5)
  const steel = metal('#b8bec4', 0.3)
  const white = M('#f4f1e8', { roughness: 0.4 })
  const head = lens('#fffbe8', 0.5)
  const work = lens('#fffbe8', 0.3)
  const brake = lens('#ff2a1a', 0.35)
  const indL = lens('#ffa020', 0.1)
  const indR = lens('#ffa020', 0.1)

  // Chassis, front drive axle, rear axle beam.
  rbox(S, 2.2, 0.5, 6.0, 0.06, dark, 0, 1.1, -0.5)
  cy(S, 0.16, 0.16, 3.2, grey, 0, 1.0, 1.4, 12, 'x')
  rbox(S, 2.6, 0.3, 0.45, 0.06, dark, 0, 0.95, -2.6)
  for (const s of [-1, 1]) cy(S, 0.3, 0.3, 0.3, grey, s * 1.15, 1.0, 1.4, 14, 'x') // final drives
  // Threshing body: louvres, panel seams, the stripe.
  rbox(S, 2.7, 2.2, 5.2, 0.14, pnt, 0, 2.3, -0.6)
  for (const s of [-1, 1]) {
    bx(S, 0.04, 0.16, 5.0, yellow, s * 1.355, 3.0, -0.6)
    for (let i = 0; i < 8; i++) bx(S, 0.04, 0.05, 1.4, dark, s * 1.36, 1.55 + i * 0.12, -2.2)
    for (const z of [-1.5, 0.3]) bx(S, 0.03, 1.8, 0.03, dark, s * 1.365, 2.2, z)
    bx(S, 0.05, 0.05, 0.3, steel, s * 1.38, 2.3, -0.6) // panel handle
  }
  // Rotary radiator screen on the right of the engine bay (turns: rig spinner).
  cy(S, 0.62, 0.62, 0.12, dark, 1.38, 3.05, -2.45, 22, 'x')
  const screen = new Group()
  screen.position.set(1.46, 3.05, -2.45)
  ring(screen, 0.55, 0.03, steel, 0, 0, 0, 'x')
  for (let i = 0; i < 6; i++) {
    const sp = bx(screen, 0.03, 1.08, 0.05, steel, 0, 0, 0)
    sp.rotation.x = (i / 6) * Math.PI
  }
  body.add(screen)
  // Engine deck, grille and the exhaust stack with its rain cap.
  rbox(S, 2.4, 0.6, 1.6, 0.12, pnt, 0, 3.65, -2.4)
  for (let i = 0; i < 6; i++) bx(S, 2.0, 0.03, 0.06, dark, 0, 3.96, -3.0 + i * 0.22)
  cy(S, 0.1, 0.1, 1.3, metal('#2a2c30', 0.5), 0.85, 4.55, -2.9, 12)
  const flap = new Group()
  flap.position.set(0.85, 5.21, -2.99)
  bx(flap, 0.2, 0.02, 0.2, metal('#2a2c30', 0.4), 0, 0, 0.09)
  body.add(flap)
  // Grain tank with yellow extensions and a dark hopper floor.
  rbox(S, 2.8, 1.3, 2.9, 0.1, pnt, 0, 4.05, -0.5)
  bx(S, 2.6, 0.04, 2.7, dark, 0, 4.68, -0.5)
  for (const s of [-1, 1]) {
    bx(S, 2.92, 0.22, 0.06, yellow, 0, 4.82, -0.5 + s * 1.46)
    bx(S, 0.06, 0.22, 2.96, yellow, s * 1.43, 4.82, -0.5)
  }
  const grain = new Group()
  grain.position.set(0, 3.55, -0.5)
  bx(grain, 2.6, 1.2, 2.7, M('#e0b24a', { roughness: 1 }), 0, 0.6, 0)
  sph(grain, 1.0, M('#e8bf58', { roughness: 1 }), 0, 1.2, 0, 1.25, 0.3, 1.3)
  grain.visible = false
  body.add(grain)
  // Cab platform, pillars, glass, roof, lights; seat, wheel and console inside.
  rbox(S, 2.4, 0.2, 2.3, 0.05, dark, 0, 3.45, 1.9)
  for (const [x, z] of [[-1, 1.08], [1, 1.08], [-1, 2.72], [1, 2.72]]) bx(S, 0.08, 1.8, 0.08, dark, x, 4.45, z)
  for (const s of [-1, 1]) bx(S, 0.03, 1.7, 1.56, glass(), s * 1.0, 4.45, 1.9)
  bx(S, 1.92, 1.72, 0.03, glass(), 0, 4.45, 2.72)
  bx(S, 1.92, 1.7, 0.03, darkGlass(), 0, 4.45, 1.08)
  rbox(S, 2.3, 0.22, 2.1, 0.08, white, 0, 5.45, 1.9)
  rbox(S, 2.0, 0.08, 1.8, 0.04, pnt, 0, 5.58, 1.9)
  for (let i = 0; i < 4; i++) lamp(S, work, 0.18, 0.12, -0.75 + i * 0.5, 5.4, 2.97, 0.06)
  for (const s of [-1, 1]) lamp(S, work, 0.16, 0.12, s * 0.8, 5.4, 0.83, 0.06)
  rbox(S, 0.55, 0.12, 0.55, 0.05, M('#3a3d42'), 0, 3.85, 1.55)
  rbox(S, 0.55, 0.6, 0.12, 0.05, M('#3a3d42'), 0, 4.15, 1.28)
  tube(S, [0, 3.55, 2.45], [0, 4.25, 2.2], 0.04, dark)
  const sw = ring(S, 0.2, 0.025, dark, 0, 4.28, 2.17, 'z')
  sw.rotation.x = -0.8
  rbox(S, 0.25, 0.35, 0.7, 0.05, dark, 0.45, 3.75, 1.6) // armrest console
  // Ladder up the left to the platform, hand rail, mirrors.
  for (const z of [2.45, 2.85]) tube(S, [-1.3, 0.45, z], [-1.3, 3.45, z], 0.03, steel)
  for (let i = 0; i < 8; i++) bx(S, 0.06, 0.04, 0.44, steel, -1.3, 0.6 + i * 0.38, 2.65)
  tube(S, [-1.2, 3.55, 3.0], [-1.2, 4.4, 3.0], 0.025, steel)
  tube(S, [-1.2, 4.4, 3.0], [1.2, 4.4, 3.0], 0.025, steel)
  for (const s of [-1, 1]) {
    tube(S, [s * 1.0, 5.2, 2.6], [s * 1.5, 5.15, 2.8], 0.025, dark)
    rbox(S, 0.08, 0.42, 0.24, 0.03, dark, s * 1.54, 4.95, 2.82)
  }
  // Headlights on the body front under the cab, rear light clusters.
  for (const s of [-1, 1]) {
    lamp(S, head, 0.32, 0.18, s * 0.95, 3.0, 2.08, 0.06)
    lamp(S, s > 0 ? indL : indR, 0.12, 0.12, s * 1.2, 2.4, -3.22, 0.05)
    lamp(S, brake, 0.16, 0.14, s * 1.2, 2.2, -3.22, 0.05)
  }
  // Feeder house down to the header.
  const feeder = rbox(S, 1.5, 0.95, 2.1, 0.08, pnt, 0, 1.25, 2.85)
  feeder.rotation.x = 0.3
  for (const s of [-1, 1]) tube(S, [s * 0.55, 1.05, 1.8], [s * 0.6, 1.0, 3.3], 0.07, steel) // lift rams
  // Chaff spreader housing at the back.
  rbox(S, 1.9, 0.6, 0.5, 0.06, dark, 0, 1.5, -3.4)
  rbox(S, 2.0, 0.7, 0.2, 0.04, pnt, 0, 2.1, -3.2)
  // The unloading auger rest on the cab side.
  bx(S, 0.3, 0.06, 0.3, dark, 1.5, 4.35, 2.4)
  tube(S, [1.05, 3.6, 2.4], [1.5, 4.32, 2.4], 0.04, dark)
  bakeStatic(body, S)

  // Unloading auger: pivots at the back of the tank (rotation.y 0 = folded along
  // the right side, ~1.4 = swung out to the right to unload).
  const auger = new Group()
  auger.position.set(1.2, 4.0, -1.85)
  tube(auger, [0, 0, 0], [0.3, 0.45, 4.2], 0.17, pnt, 12)
  cy(auger, 0.22, 0.22, 0.4, pnt, 0, 0, 0, 12)
  const spout = cy(auger, 0.17, 0.12, 0.5, dark, 0.3, 0.25, 4.3, 10)
  spout.rotation.x = 0.4
  body.add(auger)
  // Spreader discs (see setHarvest).
  const spreader = []
  for (const s of [-1, 1]) {
    const d = new Group()
    d.position.set(s * 0.45, 1.18, -3.5)
    cy(d, 0.4, 0.4, 0.04, steel, 0, 0, 0, 16)
    for (let i = 0; i < 4; i++) bx(d, 0.76, 0.1, 0.03, dark, 0, 0.06, 0).rotation.y = (i / 4) * Math.PI
    body.add(d)
    spreader.push(d)
  }

  // Header: pan, back wall, end sheets, crop dividers, cutter bar, cross auger, reel arms.
  const header = new Group()
  header.position.set(0, 0, 4.4)
  const H = new Group()
  rbox(H, 6.4, 0.18, 1.5, 0.04, yellow, 0, 0.35, 0)
  rbox(H, 6.4, 1.1, 0.14, 0.04, yellow, 0, 0.95, -0.7)
  rbox(H, 6.5, 0.24, 0.42, 0.06, yellow, 0, 1.55, -0.62)
  for (const s of [-1, 1]) {
    rbox(H, 0.08, 1.0, 1.6, 0.03, yellow, s * 3.2, 0.8, -0.05)
    cy(H, 0.02, 0.2, 0.9, yellow, s * 3.2, 0.42, 1.15, 10, 'z')
    tube(H, [s * 3.0, 1.62, -0.55], [s * 3.0, 1.72, 0.45], 0.07, yellow) // reel arms
    tube(H, [s * 2.85, 1.0, -0.65], [s * 2.85, 1.62, 0.2], 0.035, steel) // reel lift rams
    bx(H, 0.3, 0.08, 1.2, steel, s * 2.0, 0.24, 0.05) // skid shoes
  }
  bx(H, 6.2, 0.06, 0.12, grey, 0, 0.32, 0.76)
  for (let i = 0; i < 31; i++) bx(H, 0.06, 0.04, 0.22, steel, -3.0 + i * 0.2, 0.32, 0.88)
  cy(H, 0.24, 0.24, 6.0, yellow, 0, 0.62, -0.28, 14, 'x')
  for (let i = 0; i < 20; i++) ring(H, 0.29, 0.03, grey, -2.85 + i * 0.3, 0.62, -0.28, 'x')
  for (const s of [-1, 1]) lamp(H, work, 0.14, 0.1, s * 3.1, 1.6, -0.4, 0.05)
  bakeStatic(header, H)
  const reel = new Group()
  reel.position.set(0, 1.72, 0.45)
  cy(reel, 0.07, 0.07, 6.0, grey, 0, 0, 0, 8, 'x')
  for (const x of [-2.9, 0, 2.9]) ring(reel, 0.65, 0.03, grey, x, 0, 0, 'x')
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const yy = Math.cos(a) * 0.65
    const zz = Math.sin(a) * 0.65
    bx(reel, 5.9, 0.05, 0.1, M('#e04a2a', { roughness: 0.5 }), 0, yy, zz)
    for (const x of [-2.9, 0, 2.9]) tube(reel, [x, 0, 0], [x, yy, zz], 0.025, grey)
    for (let k = 0; k < 12; k++) {
      const x = -2.75 + k * 0.5
      tube(reel, [x, yy, zz], [x, yy * 1.35, zz * 1.35], 0.012, dark, 4)
    }
  }
  header.add(reel)
  body.add(header)

  // Wheels: big drive tyres at the front; small rear tyres steer the other way
  // (a group mirrored in X flips the rig's steer angle, the roll is unchanged).
  const wheels = []
  for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 1.75, 1.0, 1.4, 1.0, 0.7, { lugs: 24, chevron: true, rim: '#f2c230', spokes: 8, cap: rimM }), r: 1.0 })
  const rearM = new Group()
  rearM.scale.x = -1
  g.add(rearM)
  for (const s of [-1, 1]) wheels.push({ g: wheelAt(rearM, s * 1.45, 0.6, -2.6, 0.6, 0.42, { lugs: 18, chevron: true, rim: '#f2c230', spokes: 6, cap: rimM }), r: 0.6, steer: true })
  for (const s of [-1, 1]) {
    const f = extrude(body, [...arc(0, 0, 1.18, 0.15, Math.PI - 0.15, 16), ...arc(0, 0, 1.08, Math.PI - 0.15, 0.15, 16)], 0.8, pnt, s * 1.75, 1.0, 1.4, 0.02)
    f.rotation.y = Math.PI / 2
  }
  // Beacon on the cab roof.
  const beacon = new Group()
  beacon.position.set(0.75, 5.62, 1.3)
  cy(beacon, 0.09, 0.11, 0.16, lens('#ffa020', 2), 0, 0.08, 0, 12)
  bx(beacon, 0.02, 0.12, 0.18, lens('#fff0a0', 4), 0.09, 0.08, 0)
  body.add(beacon)
  const lb = roofBar(body, 1.6, 0, 5.64, 2.5)
  const drv = seatedDriver({ shirt: '#3f8a4a', pants: '#2c3e66', hat: 'cap', hatColor: '#f2c230' })
  drv.group.position.set(0, 3.65, 1.75)
  drv.group.visible = false
  body.add(drv.group)
  compact(g)
  const rig = makeRig({
    g,
    body,
    wheels,
    wheelbase: 4.0,
    rear: -2.6,
    track: 1.6,
    exhaust: [[0.85, 5.25, -2.9]],
    flap,
    beacon,
    lights: { head: [head, work, lb.led], brake: [brake], ind: [[indL], [indR]] },
    spinners: [{ obj: reel, speed: 0, axis: 'x' }, { obj: screen, speed: 2.5, axis: 'x' }, { obj: spreader[0], speed: 0, axis: 'y' }, { obj: spreader[1], speed: 0, axis: 'y' }, ...lb.spin],
  })
  const { look, setLook } = lookFor({ paints: [pnt], rimMat: rimM, caps: wheels.map((w) => w.g.userData.cap), bar: (on) => (lb.g.visible = on) })
  return {
    g,
    body,
    rig,
    reel,
    header,
    auger,
    spreader,
    driver: drv,
    chute: [0, 1.2, -3.75],
    look,
    setLook,
    // Grain in the tank 0..1.
    setLoad(f) {
      grain.visible = f > 0.02
      grain.scale.y = Math.max(0.05, Math.min(1, f))
    },
    // Harvest mode: reel + spreader speeds through the rig's spinners (0 = off).
    setHarvest(on, speed = 2.6) {
      rig.spinners[0].speed = on ? speed : 0
      rig.spinners[2].speed = on ? 14 : 0
      rig.spinners[3].speed = on ? -14 : 0
    },
  }
}

// --- Crop sprayer ------------------------------------------------------------------------------------------
// A self-propelled high-clearance sprayer: tall narrow row-crop tyres on drop
// legs, a glass cab at the front, the white solution tank with straps and a sight
// gauge, a rinse tank and chemical inducer, the engine at the back with its
// stack, and the boom: a centre frame with two truss arms that fold forward
// along the sides (setBooms(0), the default) or swing out to the sides
// (setBooms(1)), each with a spray pipe and nozzle bodies.
export function cropSprayer(color = '#e8b830') {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const S = new Group()
  const pnt = own(paint(color, 0.35))
  const rimM = rimMetal('#d9dde1')
  const dark = M('#26282c', { roughness: 0.7 })
  const grey = metal('#6f767d', 0.5)
  const steel = metal('#b8bec4', 0.3)
  const white = M('#f4f1e8', { roughness: 0.4 })
  const tankM = M('#eeece4', { roughness: 0.35 })
  const head = lens('#fffbe8', 0.5)
  const work = lens('#fffbe8', 0.3)
  const brake = lens('#ff2a1a', 0.35)
  const indL = lens('#ffa020', 0.1)
  const indR = lens('#ffa020', 0.1)
  const ZF = 1.9
  const ZR = -1.5
  // Spine, axle beams and drop legs.
  rbox(S, 0.7, 0.45, 5.6, 0.06, dark, 0, 1.78, 0.1)
  for (const z of [ZF, ZR]) {
    bx(S, 2.7, 0.25, 0.3, dark, 0, 1.85, z)
    for (const s of [-1, 1]) {
      rbox(S, 0.18, 1.1, 0.32, 0.04, pnt, s * 1.3, 1.35, z)
      cy(S, 0.11, 0.11, 0.3, grey, s * 1.38, 0.85, z, 10, 'x')
    }
  }
  // Cab.
  rbox(S, 1.9, 0.55, 1.8, 0.1, pnt, 0, 2.25, 2.55)
  for (const [x, z] of [[-0.9, 1.72], [0.9, 1.72], [-0.9, 3.38], [0.9, 3.38]]) bx(S, 0.07, 1.4, 0.07, dark, x, 3.2, z)
  for (const s of [-1, 1]) bx(S, 0.03, 1.32, 1.6, glass(), s * 0.9, 3.2, 2.55)
  bx(S, 1.76, 1.34, 0.03, glass(), 0, 3.2, 3.38)
  bx(S, 1.76, 1.3, 0.03, darkGlass(), 0, 3.2, 1.72)
  rbox(S, 2.1, 0.2, 2.0, 0.07, white, 0, 3.98, 2.55)
  rbox(S, 1.8, 0.07, 1.7, 0.03, pnt, 0, 4.1, 2.55)
  for (const s of [-1, 1]) {
    lamp(S, head, 0.3, 0.16, s * 0.6, 2.3, 3.46, 0.06)
    lamp(S, s > 0 ? indL : indR, 0.12, 0.12, s * 0.85, 2.45, 3.46, 0.05)
    lamp(S, work, 0.16, 0.12, s * 0.7, 3.95, 3.56, 0.06)
    tube(S, [s * 0.9, 3.7, 3.3], [s * 1.3, 3.65, 3.45], 0.02, dark)
    rbox(S, 0.07, 0.36, 0.2, 0.03, dark, s * 1.33, 3.5, 3.46)
  }
  rbox(S, 0.5, 0.1, 0.5, 0.04, M('#3a3d42'), 0, 2.65, 2.3)
  rbox(S, 0.5, 0.55, 0.1, 0.04, M('#3a3d42'), 0, 2.95, 2.05)
  const sw = ring(S, 0.18, 0.022, dark, 0, 3.05, 2.85, 'z')
  sw.rotation.x = -0.8
  tube(S, [0, 2.5, 3.15], [0, 3.02, 2.9], 0.035, dark)
  // Steps up the left to the cab door.
  for (let i = 0; i < 4; i++) bx(S, 0.34, 0.04, 0.32, steel, -1.05, 0.7 + i * 0.4, 1.35)
  for (const z of [1.2, 1.5]) tube(S, [-1.2, 0.6, z], [-1.2, 2.1, z], 0.02, steel)
  // Solution tank (horizontal), straps, lid, sight gauge, rinse tank, inducer.
  const tank = lathe(S, [[0.001, -1.45], [0.55, -1.42], [0.82, -1.3], [0.9, -1.1], [0.9, 1.1], [0.82, 1.3], [0.55, 1.42], [0.001, 1.45]], tankM, 0, 2.75, -0.1, 24)
  tank.rotation.x = Math.PI / 2
  for (const z of [-0.7, 0.5]) ring(S, 0.92, 0.04, pnt, 0, 2.75, z, 'z')
  cy(S, 0.3, 0.3, 0.12, pnt, 0, 3.66, 0.2, 16)
  tube(S, [0.6, 2.05, 0.9], [0.6, 3.4, 0.9], 0.03, M('#cfe8f0', { roughness: 0.1, transparent: true, opacity: 0.6 }))
  cy(S, 0.35, 0.35, 0.9, tankM, -0.7, 2.15, 1.25, 14, 'z')
  lathe(S, [[0.08, 0], [0.32, 0.45], [0.34, 0.6], [0.001, 0.62]], pnt, -1.05, 1.95, 0.0, 14)
  // Engine at the back with grille, stack and rain cap.
  rbox(S, 1.6, 1.1, 1.5, 0.15, pnt, 0, 2.45, -2.1)
  for (let i = 0; i < 6; i++) bx(S, 1.3, 0.04, 0.03, dark, 0, 2.15 + i * 0.12, -2.86)
  cy(S, 0.08, 0.08, 1.2, metal('#2a2c30', 0.5), 0.55, 3.4, -1.75, 12)
  const flap = new Group()
  flap.position.set(0.55, 4.0, -1.83)
  bx(flap, 0.17, 0.02, 0.17, metal('#2a2c30', 0.4), 0, 0, 0.08)
  body.add(flap)
  for (const s of [-1, 1]) {
    lamp(S, brake, 0.14, 0.12, s * 0.6, 2.75, -2.87, 0.05)
    lamp(S, s > 0 ? indL : indR, 0.12, 0.1, s * 0.6, 2.58, -2.87, 0.05)
  }
  // Boom lift frame and the transport rests by the cab.
  for (const s of [-1, 1]) {
    bx(S, 0.12, 1.4, 0.12, dark, s * 0.8, 1.7, -2.95)
    tube(S, [s * 0.8, 2.3, -2.95], [s * 0.4, 1.9, -2.0], 0.04, dark)
    tube(S, [s * 1.35, 1.6, 2.3], [s * 1.95, 1.6, 2.3], 0.04, dark)
    bx(S, 0.08, 0.28, 0.12, dark, s * 1.98, 1.72, 2.3)
  }
  bakeStatic(body, S)

  // Booms: centre section + two folding arms.
  const booms = new Group()
  booms.position.set(0, 0, -3.05)
  const BOOM_Y = 1.6
  const SPAN = 5.6
  const nozzleM = M('#2f6fd0', { roughness: 0.5 })
  tube(booms, [-1.95, BOOM_Y + 0.3, 0], [1.95, BOOM_Y + 0.3, 0], 0.05, pnt)
  tube(booms, [-1.95, BOOM_Y - 0.1, 0], [1.95, BOOM_Y - 0.1, 0], 0.05, pnt)
  for (let i = 0; i < 5; i++) tube(booms, [-1.95 + i * 0.78, i % 2 ? BOOM_Y + 0.3 : BOOM_Y - 0.1, 0], [-1.95 + (i + 1) * 0.78, i % 2 ? BOOM_Y - 0.1 : BOOM_Y + 0.3, 0], 0.025, pnt)
  tube(booms, [-1.95, BOOM_Y - 0.28, 0.06], [1.95, BOOM_Y - 0.28, 0.06], 0.018, steel)
  const nozzles = []
  for (let i = 0; i < 8; i++) {
    const x = -1.75 + i * 0.5
    cy(booms, 0.025, 0.02, 0.12, nozzleM, x, BOOM_Y - 0.34, 0.06, 6)
    nozzles.push([x, BOOM_Y - 0.42, -3.05 + 0.06])
  }
  const arms = []
  for (const s of [-1, 1]) {
    const arm = new Group()
    arm.position.set(s * 1.95, BOOM_Y, 0)
    const topY = (u) => 0.3 - 0.18 * u
    const botY = (u) => -0.1 + 0.08 * u
    tube(arm, [0, topY(0), 0], [s * SPAN, topY(1), 0], 0.045, pnt)
    tube(arm, [0, botY(0), 0], [s * SPAN, botY(1), 0], 0.045, pnt)
    for (let i = 0; i < 7; i++) {
      const u0 = i / 7
      const u1 = (i + 1) / 7
      tube(arm, [s * SPAN * u0, i % 2 ? topY(u0) : botY(u0), 0], [s * SPAN * u1, i % 2 ? botY(u1) : topY(u1), 0], 0.022, pnt)
    }
    rbox(arm, 0.14, 0.5, 0.14, 0.03, dark, s * SPAN, 0.05, 0) // breakaway tip
    cy(arm, 0.12, 0.12, 0.5, dark, 0, 0.1, 0, 10) // hinge
    tube(arm, [s * 0.1, -0.28, 0.06], [s * SPAN, -0.24, 0.06], 0.018, steel)
    for (let i = 0; i < 11; i++) {
      const x = s * (0.25 + i * 0.5)
      cy(arm, 0.025, 0.02, 0.12, nozzleM, x, -0.34, 0.06, 6)
      nozzles.push([s * 1.95 + x, BOOM_Y - 0.42, -3.05 + 0.06])
    }
    booms.add(arm)
    arms.push({ arm, s })
  }
  body.add(booms)
  // open 0 (folded forward along the sides) .. 1 (straight out to the sides).
  const setBooms = (open = 1) => {
    const k = Math.max(0, Math.min(1, open))
    for (const { arm, s } of arms) {
      arm.rotation.y = -s * (1 - k) * (Math.PI / 2)
      arm.position.y = BOOM_Y + (1 - k) * 0.25
    }
  }
  setBooms(0)

  const wheels = []
  for (const z of [ZF, ZR]) for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 1.55, 0.85, z, 0.85, 0.3, { lugs: 26, chevron: true, rim: '#d9dde1', spokes: 6, cap: rimM }), r: 0.85, steer: z > 0 })
  const beacon = new Group()
  beacon.position.set(-0.6, 4.13, 2.0)
  cy(beacon, 0.08, 0.1, 0.14, lens('#ffa020', 2), 0, 0.07, 0, 12)
  bx(beacon, 0.02, 0.1, 0.16, lens('#fff0a0', 4), 0.08, 0.07, 0)
  body.add(beacon)
  const lb = roofBar(body, 1.3, 0, 4.17, 3.0)
  const drv = seatedDriver({ shirt: '#d9a21a', pants: '#2c3e66', hat: 'cap', hatColor: '#2f6fd0' })
  drv.group.position.set(0, 2.45, 2.35)
  drv.group.visible = false
  body.add(drv.group)
  compact(g)
  const rig = makeRig({
    g,
    body,
    wheels,
    wheelbase: ZF - ZR,
    rear: ZR,
    track: 1.55,
    exhaust: [[0.55, 4.05, -1.75]],
    flap,
    beacon,
    lights: { head: [head, work, lb.led], brake: [brake], ind: [[indL], [indR]] },
    spinners: lb.spin,
  })
  const { look, setLook } = lookFor({ paints: [pnt], rimMat: rimM, caps: wheels.map((w) => w.g.userData.cap), bar: (on) => (lb.g.visible = on) })
  return { g, body, rig, booms, arms: arms.map((a) => a.arm), nozzles, setBooms, driver: drv, look, setLook }
}

// --- Milk tanker -------------------------------------------------------------------------------------------
// A cab-over truck with a polished stainless milk tank: domed ends, bands,
// manholes and a catwalk with a rail on top, a ladder, the rear valve cabinet
// with a hose, mudflaps, light clusters and the FRESH MILK livery wrapped round
// both sides of the tank.
function wrapDecal(parent, mat, len, h, r, side, yc, zc) {
  // A decal bent round a horizontal (Z-axis) cylinder of radius r on side +1 / -1 (X).
  const geo = new PlaneGeometry(len, h, 1, 8)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i)
    const a = p.getY(i) / r
    p.setXYZ(i, side * r * Math.cos(a), yc + r * Math.sin(a), zc - side * px)
  }
  geo.computeVertexNormals()
  const m = new Mesh(geo, mat)
  parent.add(m)
  return m
}
export function milkTanker() {
  const g = new Group()
  const body = new Group()
  g.add(body)
  const S = new Group()
  const cabM = paint('#f7f6f2', 0.28)
  const blue = paint('#2f6fd0', 0.35)
  const grey = metal('#6f767d', 0.5)
  const steelM = metal('#dfe3e6', 0.16)
  const rail = metal('#c7ccd1', 0.3)
  const head = lens('#fffbe8', 0.5)
  const brake = lens('#ff2a1a', 0.35)
  const indL = lens('#ffa020', 0.1)
  const indR = lens('#ffa020', 0.1)
  const rev = lens('#ffffff', 0.05)
  const marker = lens('#ffb020', 1.2)
  // Chassis.
  for (const s of [-1, 1]) bx(S, 0.16, 0.3, 6.9, grey, s * 0.55, 0.78, -0.35)
  for (const z of [2.2, 0.8, -0.6, -2.0, -3.4]) bx(S, 1.1, 0.18, 0.16, grey, 0, 0.78, z)
  for (const z of [-1.9, -3.1]) cy(S, 0.12, 0.12, 2.0, grey, 0, 0.52, z, 10, 'x')
  cy(S, 0.1, 0.1, 2.0, grey, 0, 0.52, 2.6, 10, 'x')
  cy(S, 0.3, 0.3, 1.0, metal('#c7ccd1', 0.25), 0.95, 0.85, 1.05, 18, 'z') // fuel tank
  // Cab: lower + upper, roof, stripe, glass, doors, steps, mirrors, arches.
  rbox(S, 2.44, 1.3, 2.1, 0.12, cabM, 0, 1.45, 2.35)
  rbox(S, 2.4, 1.25, 2.02, 0.2, cabM, 0, 2.6, 2.3)
  rbox(S, 2.3, 0.18, 1.9, 0.08, blue, 0, 3.28, 2.25)
  for (const s of [-1, 1]) bx(S, 0.04, 0.22, 2.0, blue, s * 1.225, 1.75, 2.35)
  bx(S, 2.22, 1.08, 0.04, blackM(), 0, 2.58, 3.33)
  bx(S, 2.1, 0.98, 0.05, darkGlass(), 0, 2.6, 3.345)
  for (const s of [-0.5, 0.45]) bx(S, 0.9, 0.03, 0.03, blackM(), s, 2.15, 3.38).rotation.z = 0.25
  for (const s of [-1, 1]) {
    bx(S, 0.06, 0.72, 1.06, darkGlass(), s * 1.21, 2.64, 2.45)
    bx(S, 0.05, 1.9, 0.03, M('#9aa0a6'), s * 1.215, 1.95, 1.75)
    bx(S, 0.06, 0.06, 0.25, chromeM(), s * 1.23, 2.0, 2.0)
    for (const [y, d] of [[0.55, 0.45], [0.95, 0.4]]) bx(S, 0.5, 0.05, d, metal('#b8bec4', 0.3), s * 1.05, y, 2.75)
    tube(S, [s * 1.2, 2.9, 3.0], [s * 1.55, 2.9, 3.2], 0.025, blackM())
    tube(S, [s * 1.2, 2.2, 3.0], [s * 1.55, 2.4, 3.2], 0.025, blackM())
    rbox(S, 0.1, 0.55, 0.28, 0.04, blackM(), s * 1.58, 2.65, 3.22)
    const ar = extrude(S, [...arc(0, 0, 0.66, 0, Math.PI, 14), ...arc(0, 0, 0.58, Math.PI, 0, 14)], 0.4, M('#1f2124'), s * 1.1, 0.55, 2.6, 0.02)
    ar.rotation.y = Math.PI / 2
    rbox(S, 0.75, 0.06, 2.6, 0.03, M('#1f2124'), s * 0.98, 1.12, -2.5)
  }
  // Grille, bumper, plate, lamps, roof markers, cab interior.
  rbox(S, 1.75, 0.95, 0.08, 0.06, chromeM(), 0, 1.45, 3.42)
  bx(S, 1.6, 0.82, 0.06, blackM(), 0, 1.45, 3.45)
  for (let i = 0; i < 9; i++) bx(S, 0.05, 0.78, 0.04, chromeM(), -0.72 + i * 0.18, 1.45, 3.48)
  rbox(S, 2.56, 0.36, 0.34, 0.08, metal('#9aa0a6', 0.3), 0, 0.7, 3.42)
  panel(S, 0.55, 0.2, plate('MILK 1'), 0, 0.72, 3.6)
  for (const s of [-1, 1]) {
    lamp(S, head, 0.42, 0.24, s * 0.98, 1.2, 3.44)
    lamp(S, s > 0 ? indL : indR, 0.16, 0.16, s * 1.1, 1.62, 3.42)
  }
  for (let i = 0; i < 5; i++) rbox(S, 0.14, 0.08, 0.1, 0.03, marker, -0.5 + i * 0.25, 3.42, 3.25)
  rbox(S, 0.6, 0.7, 0.55, 0.08, plastic('#3a3d42'), -0.5, 1.95, 2.0)
  rbox(S, 2.1, 0.35, 0.4, 0.06, plastic('#26282c'), 0, 2.15, 3.1)
  ring(S, 0.22, 0.03, blackM(), -0.5, 2.35, 2.8, 'z').rotation.x = -0.6
  // Exhaust stack behind the cab.
  cy(S, 0.09, 0.09, 2.8, chromeM(), -1.05, 2.0, 1.15, 12)
  rbox(S, 0.24, 1.1, 0.24, 0.05, metal('#c7ccd1', 0.4), -1.05, 1.9, 1.15)
  const flap = new Group()
  flap.position.set(-1.05, 3.4, 1.06)
  bx(flap, 0.2, 0.02, 0.2, chromeM(), 0, 0, 0.09)
  body.add(flap)
  // The tank: cradles, the shell with domed ends, bands, manholes, catwalk, ladder.
  const TY = 2.2
  const R = 1.0
  for (const z of [0.6, -1.2, -3.0]) rbox(S, 1.7, 0.4, 0.3, 0.04, grey, 0, 1.1, z)
  const tank = lathe(S, [[0.001, -2.6], [0.45, -2.56], [0.8, -2.45], [0.97, -2.28], [R, -2.15], [R, 2.15], [0.97, 2.28], [0.8, 2.45], [0.45, 2.56], [0.001, 2.6]], steelM, 0, TY, -1.25, 32)
  tank.rotation.x = Math.PI / 2
  for (const z of [-3.2, -1.25, 0.7]) ring(S, R + 0.015, 0.03, metal('#b8bec4', 0.3), 0, TY, z, 'z')
  for (const z of [-2.6, -1.25, 0.1]) {
    cy(S, 0.3, 0.32, 0.16, steelM, 0, TY + R + 0.02, z, 18)
    cy(S, 0.26, 0.26, 0.06, metal('#b8bec4', 0.25), 0, TY + R + 0.12, z, 18)
  }
  bx(S, 0.5, 0.04, 4.0, metal('#9aa0a6', 0.5), 0.5, TY + R - 0.02, -1.25) // catwalk
  for (let i = 0; i < 5; i++) tube(S, [0.72, TY + R - 0.02, -3.0 + i * 0.9], [0.72, TY + R + 0.65, -3.0 + i * 0.9], 0.02, rail)
  tube(S, [0.72, TY + R + 0.65, -3.0], [0.72, TY + R + 0.65, 0.6], 0.02, rail)
  for (const x of [0.35, 0.75]) tube(S, [x, 0.55, -3.92], [x, TY + R - 0.05, -3.65], 0.025, rail)
  for (let i = 0; i < 7; i++) tube(S, [0.35, 0.85 + i * 0.33, -3.9 + i * 0.035], [0.75, 0.85 + i * 0.33, -3.9 + i * 0.035], 0.018, rail)
  // Rear valve cabinet, outlet and hose, lamps, plate, mudflaps, under-run bar.
  rbox(S, 0.9, 0.7, 0.5, 0.05, steelM, -0.55, 1.05, -3.75)
  cy(S, 0.1, 0.1, 0.35, metal('#9aa0a6', 0.3), -0.55, 1.0, -4.05, 12, 'z')
  ring(S, 0.24, 0.05, rubber(), -0.55, 1.05, -3.45, 'x')
  for (const s of [-1, 1]) {
    rbox(S, 0.62, 0.22, 0.1, 0.03, blackM(), s * 0.88, 0.75, -3.7)
    rbox(S, 0.18, 0.16, 0.06, 0.02, s > 0 ? indL : indR, s * 1.08, 0.75, -3.76)
    rbox(S, 0.18, 0.16, 0.06, 0.02, brake, s * 0.88, 0.75, -3.76)
    rbox(S, 0.14, 0.14, 0.06, 0.02, rev, s * 0.69, 0.75, -3.76)
    bx(S, 0.5, 0.6, 0.02, rubber(), s * 1.0, 0.45, -3.5)
    rbox(S, 0.05, 0.08, 0.14, 0.02, marker, s * 1.02, 1.3, -1.25)
  }
  bx(S, 2.1, 0.12, 0.12, grey, 0, 0.42, -3.72)
  panel(S, 0.55, 0.2, plate('MILK 1'), 0.1, 0.58, -3.79, Math.PI)
  // FRESH MILK livery round both sides of the tank.
  const livery = decal(1024, 288, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(6, 6, w - 12, h - 12, 60)
    ctx.fill()
    ctx.lineWidth = 12
    ctx.strokeStyle = '#2f6fd0'
    ctx.stroke()
    ctx.fillStyle = '#1d1f22' // cow spots
    for (const [x, y, rx, ry] of [[70, 70, 44, 30], [120, 215, 34, 24], [965, 78, 38, 28], [915, 212, 48, 32]]) {
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#2f6fd0' // milk drop
    ctx.beginPath()
    ctx.moveTo(250, 46)
    ctx.bezierCurveTo(290, 110, 318, 150, 318, 185)
    ctx.arc(250, 185, 68, 0, Math.PI)
    ctx.bezierCurveTo(182, 150, 210, 110, 250, 46)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '700 120px Fredoka, Arial, sans-serif'
    ctx.lineWidth = 14
    ctx.strokeStyle = '#13305e'
    ctx.strokeText('FRESH MILK', 345, 122)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('FRESH MILK', 345, 122)
    ctx.font = '600 50px Fredoka, Arial, sans-serif'
    ctx.fillStyle = '#2f6fd0'
    ctx.fillText('from our farm dairy', 352, 222)
  })
  for (const s of [-1, 1]) wrapDecal(S, livery, 3.4, 0.95, R + 0.012, s, TY, -1.25)
  bakeStatic(body, S)

  const wheels = []
  for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 1.1, 0.52, 2.6, 0.52, 0.32, { lugs: 20, rim: '#d9dde1' }), r: 0.52, steer: true })
  for (const z of [-1.9, -3.1]) for (const s of [-1, 1]) wheels.push({ g: wheelAt(g, s * 0.96, 0.52, z, 0.52, 0.3, { lugs: 20, rim: '#d9dde1', dual: true }), r: 0.52 })
  const drv = seatedDriver({ shirt: '#f4f1e8', pants: '#2c3e66', hat: 'cap', hatColor: '#2f6fd0' })
  drv.group.position.set(-0.5, 1.55, 2.0)
  body.add(drv.group)
  compact(g)
  const rig = makeRig({ g, body, wheels, wheelbase: 5.1, rear: -2.5, track: 1.0, exhaust: [[-1.05, 3.45, 1.15]], flap, lights: { head: [head], brake: [brake], ind: [[indL], [indR]], reverse: [rev] } })
  return { g, body, rig, driver: drv }
}

// --- Cargo helicopter --------------------------------------------------------------------------------------
// Not a rig (it flies): origin on the ground under the skids, nose +Z. A red
// pod fuselage with a tinted canopy, side windows and a sliding door, the engine
// cowling and mast, a white tail boom with fin, stabiliser and the tail rotor on
// the right, skids on arched cross tubes, nav lights, a beacon and a strobe,
// and a crate in a cargo net slung on a line under the belly hook (`cargo`,
// hidden at first: it hangs to about 3.7 m below the skids, so show it only in
// the air). update(dt, rpm 0..1) spins the rotors; blur discs fade in at high rpm.
export function helicopter() {
  const g = new Group()
  const S = new Group()
  const red = paint('#d6322c', 0.3)
  const white = paint('#f4f1e8', 0.3)
  const dark = M('#26282c', { roughness: 0.6 })
  const grey = metal('#8a9199', 0.4)
  const steel = metal('#b8bec4', 0.3)
  // Fuselage pod (a lathe along Z, a bit taller than wide) and canopy.
  const pod = lathe(S, [[0.001, -2.4], [0.4, -2.3], [0.78, -1.9], [1.0, -1.1], [1.05, -0.2], [1.0, 0.7], [0.85, 1.5], [0.55, 2.05], [0.001, 2.3]], red, 0, 1.75, 0.2, 24)
  pod.rotation.x = Math.PI / 2
  pod.scale.set(1, 1, 1.12)
  sph(S, 0.95, darkGlass(), 0, 2.05, 1.35, 0.98, 0.82, 1.05, 20)
  bx(S, 0.06, 0.9, 0.06, dark, 0, 2.55, 2.2).rotation.x = 0.6 // canopy centre frame
  for (const s of [-1, 1]) {
    bx(S, 0.03, 0.62, 0.95, darkGlass(), s * 1.04, 2.0, 0.25)
    bx(S, 0.03, 0.62, 0.6, darkGlass(), s * 1.0, 2.0, -0.85)
    bx(S, 0.03, 1.3, 0.04, dark, s * 1.05, 1.75, -0.35) // door seams
    bx(S, 0.03, 1.3, 0.04, dark, s * 1.05, 1.75, 0.82)
    bx(S, 0.04, 0.04, 1.4, steel, s * 1.06, 2.45, 0.1) // door rail
    rbox(S, 0.05, 0.05, 0.24, 0.02, steel, s * 1.07, 1.6, 0.0) // handle
  }
  // Engine cowling, intakes, exhausts, the mast.
  rbox(S, 1.1, 0.55, 2.3, 0.2, white, 0, 3.0, -0.35)
  for (const s of [-1, 1]) {
    rbox(S, 0.08, 0.3, 0.4, 0.04, dark, s * 0.55, 3.05, 0.45)
    cy(S, 0.1, 0.12, 0.45, metal('#3a3d42', 0.4), s * 0.42, 3.05, -1.55, 10, 'z').rotation.y = s * 0.3
  }
  cy(S, 0.12, 0.15, 0.6, grey, 0, 3.5, 0, 12)
  // Tail boom, fins, stabiliser, tail rotor gearbox.
  cy(S, 0.42, 0.16, 4.8, white, 0, 2.2, -3.8, 16, 'z')
  const fin = extrude(S, [[0, 0], [0.9, 0], [1.35, 1.5], [0.95, 1.55], [0.2, 0.35]], 0.08, red, 0, 2.2, -5.9, 0.02)
  fin.rotation.y = Math.PI / 2
  const finLow = extrude(S, [[0, 0], [0.6, 0], [0.9, -0.5], [0.6, -0.55]], 0.06, red, 0, 2.2, -6.0, 0.02)
  finLow.rotation.y = Math.PI / 2
  rbox(S, 1.9, 0.06, 0.45, 0.02, red, 0, 2.25, -5.3)
  for (const s of [-1, 1]) rbox(S, 0.05, 0.3, 0.4, 0.02, red, s * 0.95, 2.3, -5.3)
  cy(S, 0.1, 0.1, 0.25, grey, 0.14, 3.15, -6.85, 10, 'x')
  // Skids on arched cross tubes, the belly hook.
  for (const s of [-1, 1]) {
    tube(S, [s * 0.95, 0.07, -1.6], [s * 0.95, 0.07, 1.4], 0.06, grey)
    tube(S, [s * 0.95, 0.07, 1.4], [s * 0.95, 0.35, 1.85], 0.06, grey)
    for (const z of [-0.9, 0.8]) tube(S, [s * 0.95, 0.07, z], [s * 0.62, 0.78, z], 0.05, grey)
  }
  for (const z of [-0.9, 0.8]) tube(S, [-0.62, 0.78, z], [0.62, 0.78, z], 0.05, grey)
  cy(S, 0.08, 0.06, 0.25, dark, 0, 0.62, 0.0, 10)
  // Tail livery.
  const lv = decal(512, 128, (ctx, w, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 84px Fredoka, Arial, sans-serif'
    ctx.lineWidth = 10
    ctx.strokeStyle = '#7a1410'
    ctx.strokeText('FARM AIR', w / 2, h / 2)
    ctx.fillStyle = '#d6322c'
    ctx.fillText('FARM AIR', w / 2, h / 2)
  })
  for (const s of [-1, 1]) panel(S, 1.4, 0.35, lv, s * 0.305, 2.2, -4.0, s * (Math.PI / 2 + 0.054))
  // Nav lights (red left, green right), a white tail light.
  sph(S, 0.05, lens('#ff2a1a', 2), -1.0, 2.3, -5.3)
  sph(S, 0.05, lens('#3aff6a', 2), 1.0, 2.3, -5.3)
  sph(S, 0.05, lens('#ffffff', 1), 0, 2.15, -6.3)
  bakeStatic(g, S)
  const beacon = lens('#ff2a1a', 0)
  sph(g, 0.08, beacon, 0, 3.3, -1.2)
  const strobe = lens('#ffffff', 0)
  sph(g, 0.07, strobe, 0, 0.62, -0.8)

  // Main rotor: hub, swashplate, four blades (hidden at full speed), blur disc.
  const blurMat = new MeshBasicMaterial({ color: '#d8d8d8', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  const rotor = new Group()
  rotor.position.set(0, 3.82, 0)
  cy(rotor, 0.25, 0.2, 0.18, grey, 0, 0, 0, 14)
  cy(rotor, 0.12, 0.12, 0.3, dark, 0, 0.18, 0, 10)
  cy(rotor, 0.3, 0.3, 0.05, steel, 0, -0.14, 0, 16)
  const blades = new Group()
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const b = bx(blades, 0.34, 0.05, 5.0, dark, Math.sin(a) * 2.7, 0.02, Math.cos(a) * 2.7)
    b.rotation.y = a
    const tip = bx(blades, 0.35, 0.052, 0.4, M('#f2c230', { roughness: 0.4 }), Math.sin(a) * 5.2, 0.02, Math.cos(a) * 5.2)
    tip.rotation.y = a
  }
  rotor.add(blades)
  g.add(rotor)
  const disc = new Mesh(new CircleGeometry(5.45, 40), blurMat)
  disc.rotation.x = -Math.PI / 2
  disc.position.set(0, 3.85, 0)
  disc.userData.keep = true
  g.add(disc)
  // Tail rotor on the right of the fin (spins about X).
  const tail = new Group()
  tail.position.set(0.3, 3.15, -6.85)
  cy(tail, 0.08, 0.08, 0.12, grey, 0, 0, 0, 10, 'x')
  const tblades = new Group()
  for (const a of [0, Math.PI / 2]) bx(tblades, 0.03, 1.5, 0.13, dark, 0.04, 0, 0).rotation.x = a
  tail.add(tblades)
  g.add(tail)
  const tdisc = new Mesh(new CircleGeometry(0.76, 24), blurMat)
  tdisc.rotation.y = Math.PI / 2
  tdisc.position.set(0.36, 3.15, -6.85)
  tdisc.userData.keep = true
  g.add(tdisc)
  // Slung cargo: line, net straps, a crate.
  const cargo = new Group()
  cargo.position.set(0, 0.5, 0)
  const C = new Group()
  tube(C, [0, 0, 0], [0, -2.6, 0], 0.025, dark, 4)
  ring(C, 0.12, 0.025, steel, 0, -2.65, 0, 'z')
  rbox(C, 1.4, 1.0, 1.4, 0.06, M('#c79a5c', { roughness: 0.85 }), 0, -3.65, 0)
  for (const y of [-3.95, -3.35]) bx(C, 1.43, 0.07, 1.43, M('#8a5a2c'), 0, y, 0)
  const net = M('#f2a03a', { roughness: 0.8 })
  for (const [x, z] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) tube(C, [0, -2.7, 0], [x, -3.15, z], 0.02, net, 4)
  for (const k of [-0.35, 0.35]) {
    tube(C, [k, -3.13, -0.72], [k, -4.16, -0.72], 0.018, net, 4)
    tube(C, [k, -3.13, 0.72], [k, -4.16, 0.72], 0.018, net, 4)
    tube(C, [-0.72, -3.13, k], [-0.72, -4.16, k], 0.018, net, 4)
    tube(C, [0.72, -3.13, k], [0.72, -4.16, k], 0.018, net, 4)
    tube(C, [k, -3.13, -0.72], [k, -3.13, 0.72], 0.018, net, 4)
    tube(C, [-0.72, -3.13, k], [0.72, -3.13, k], 0.018, net, 4)
  }
  bakeStatic(cargo, C)
  cargo.visible = false
  g.add(cargo)
  g.traverse((o) => {
    if (o.isMesh && o.material !== blurMat) o.castShadow = true
  })
  compact(g)

  let spin = 0
  let time = 0
  return {
    g,
    rotor,
    tail,
    cargo,
    update(dt, rpm = 1) {
      time += dt
      spin += dt * rpm * 30
      rotor.rotation.y = spin
      tail.rotation.x = spin * 4.6
      blades.visible = rpm < 0.85
      tblades.visible = rpm < 0.7
      blurMat.opacity = Math.max(0, rpm - 0.35) * 0.32
      beacon.emissiveIntensity = rpm > 0.05 && time % 1.0 < 0.12 ? 5 : 0.2
      strobe.emissiveIntensity = rpm > 0.05 && (time + 0.5) % 1.4 < 0.06 ? 6 : 0
      cargo.rotation.z = Math.sin(time * 1.3) * 0.05 * rpm
      cargo.rotation.x = Math.sin(time * 0.9 + 1) * 0.04 * rpm
    },
  }
}
