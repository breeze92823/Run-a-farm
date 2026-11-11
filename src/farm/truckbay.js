import { Group, MeshStandardMaterial } from 'three'
import { FARM } from '../config.js'
import { E, M, bakeInto, block, box, cyl, signCanvas, signMaterial, signPanel, solid, solidRect, gated } from './kit.js'
import { built } from '../game.js'
import { crate } from './props.js'
import { paintConcrete, paintHay, tex } from './textures.js'

// The truck bay: a concrete drive-through shed facing the road, with a thick
// flat roof, a green TRUCK BAY fascia sign, bright ceiling light panels, a
// back doorway out to the market plaza, and the farm's light-blue pickup with
// a trailer of hay bales and crates idling inside (it shudders on its springs
// and puffs exhaust). Out front: a parked bike and a mailbox.

const B = FARM.truckBay

export function pickup() {
  const g = new Group()
  const paint = M('#9fd3ea', { roughness: 0.35, metalness: 0.15 })
  const paintDark = M('#7fb6cf', { roughness: 0.4 })
  const glass = M('#2c3e4e', { roughness: 0.08, metalness: 0.4 })
  const chrome = M('#e8ecef', { roughness: 0.15, metalness: 0.9 })
  const tyre = M('#1d1d1f', { roughness: 0.9 })
  const rim = M('#cfd4d8', { roughness: 0.3, metalness: 0.7 })
  // Body: front of the truck faces +Z (out of the bay toward the road).
  block(g, 2.3, 0.8, 5.4, paint, 0, 0.55, 0) // lower body
  block(g, 2.2, 0.45, 1.9, paint, 0, 1.35, 1.6) // hood
  block(g, 2.26, 1.05, 1.9, paint, 0, 1.35, -0.2) // cab
  block(g, 2.1, 0.08, 1.75, paintDark, 0, 2.4, -0.2) // roof cap
  // Windows.
  block(g, 2.0, 0.8, 0.05, glass, 0, 1.5, 0.76) // windscreen
  for (const s of [-1, 1]) block(g, 0.05, 0.7, 1.4, glass, s * 1.135, 1.55, -0.2)
  block(g, 1.9, 0.6, 0.05, glass, 0, 1.6, -1.16)
  // Bed walls.
  for (const s of [-1, 1]) block(g, 0.1, 0.55, 2.3, paint, s * 1.1, 1.35, -2.25)
  block(g, 2.3, 0.55, 0.1, paint, 0, 1.35, -3.38)
  // Grille, bumpers, lights.
  block(g, 1.7, 0.4, 0.06, chrome, 0, 0.95, 2.73)
  for (let i = 0; i < 5; i++) block(g, 1.6, 0.03, 0.03, M('#5b6066'), 0, 1.0 + i * 0.07, 2.77, 0, false)
  block(g, 2.45, 0.24, 0.24, chrome, 0, 0.5, 2.75)
  block(g, 2.45, 0.24, 0.24, chrome, 0, 0.5, -2.75)
  for (const s of [-1, 1]) {
    block(g, 0.34, 0.24, 0.06, E('#fffbe8', 1.6), s * 0.95, 1.0, 2.73) // headlights
    block(g, 0.2, 0.3, 0.06, E('#ff3a2a', 1.2), s * 1.0, 1.05, -2.73) // tail lights
    block(g, 0.1, 0.18, 0.3, M('#2a2a2a'), s * 1.18, 1.75, 0.65) // mirrors
    block(g, 0.06, 0.06, 0.06, chrome, s * 0.55, 1.2, 2.74)
  }
  // Wheels with arches.
  for (const sx of [-1, 1]) {
    for (const sz of [1.7, -1.9]) {
      const w = cyl(g, 0.5, 0.5, 0.36, tyre, sx * 1.05, 0.5, sz, 16)
      w.rotation.z = Math.PI / 2
      const r = cyl(g, 0.28, 0.28, 0.38, rim, sx * 1.06, 0.5, sz, 10)
      r.rotation.z = Math.PI / 2
      block(g, 0.12, 0.12, 1.25, paintDark, sx * 1.12, 1.0, sz)
    }
  }
  return g
}

function trailer(hay) {
  const g = new Group()
  const wood = M('#b98b55')
  const frame = M('#3a3d42', { roughness: 0.5, metalness: 0.4 })
  block(g, 2.2, 0.15, 3.4, frame, 0, 0.55, 0)
  block(g, 2.2, 0.08, 3.4, wood, 0, 0.7, 0)
  for (const s of [-1, 1]) {
    block(g, 0.08, 0.45, 3.4, wood, s * 1.08, 0.78, 0)
    const w = cyl(g, 0.4, 0.4, 0.3, M('#1d1d1f'), s * 1.2, 0.4, -0.2, 14)
    w.rotation.z = Math.PI / 2
  }
  block(g, 0.12, 0.12, 1.4, frame, 0, 0.5, 2.2) // tow bar
  // Load: square bales and two crates.
  for (const [x, y, z] of [[-0.5, 0.78, 0.9], [0.5, 0.78, 0.9], [-0.5, 0.78, -0.2], [0.5, 1.4, 0.4]]) block(g, 0.95, 0.6, 1.0, hay, x, y, z, 0.05)
  crate(g, 0.45, 0.78, -1.1, 0.95, 0.1)
  crate(g, -0.45, 0.78, -1.15, 0.95, -0.1)
  return g
}

function bicycle(g, x, z, ry) {
  const b = new Group()
  b.position.set(x, 0, z)
  b.rotation.y = ry
  const frame = M('#3fae4a', { roughness: 0.4 })
  const tyre = M('#1d1d1f')
  for (const s of [-0.55, 0.55]) {
    const w = cyl(b, 0.36, 0.36, 0.06, tyre, 0, 0.38, s, 18)
    w.rotation.x = Math.PI / 2
    w.rotation.z = Math.PI / 2
    const hub = cyl(b, 0.05, 0.05, 0.1, M('#999'), 0, 0.38, s, 6)
    hub.rotation.z = Math.PI / 2
  }
  const top = box(b, 0.05, 0.05, 0.9, frame, 0, 0.78, 0.02)
  top.rotation.x = 0.08
  const down = box(b, 0.05, 0.05, 0.75, frame, 0, 0.58, 0.15)
  down.rotation.x = -0.75
  box(b, 0.05, 0.5, 0.05, frame, 0, 0.62, -0.25)
  box(b, 0.05, 0.05, 0.55, frame, 0, 0.4, -0.3)
  box(b, 0.24, 0.06, 0.12, M('#2a2a2a'), 0, 0.9, -0.28) // saddle
  box(b, 0.05, 0.5, 0.05, M('#888'), 0, 0.7, 0.5)
  box(b, 0.55, 0.04, 0.04, M('#888'), 0, 0.96, 0.48) // bars
  g.add(b)
}

function mailbox(g, x, z) {
  block(g, 0.12, 1.1, 0.12, M('#7b4a26'), x, 0, z)
  block(g, 0.4, 0.38, 0.6, M('#d63a2c', { roughness: 0.4 }), x, 1.1, z)
  const top = cyl(g, 0.2, 0.2, 0.6, M('#d63a2c', { roughness: 0.4 }), x, 1.48, z, 12)
  top.rotation.x = Math.PI / 2
  block(g, 0.04, 0.3, 0.08, M('#f2c230'), x + 0.22, 1.35, z)
}

// The bay is bought (build pad); until then it is hidden and silent.
export function buildTruckBay(root, ctx) {
  let api = null
  gated(root, 'truckBay', (G) => (api = bay(G, ctx)), 8)
  api.exhaust.enabled = () => built('truckBay')
  return api
}

function bay(root, { addLamp }) {
  const g = new Group()
  const W = B.maxX - B.minX
  const D = B.maxZ - B.minZ
  const cx = (B.minX + B.maxX) / 2
  const cz = (B.minZ + B.maxZ) / 2
  const H = B.height
  const concrete = new MeshStandardMaterial({ map: tex(paintConcrete(256, 1, '#a9a8a4', '#959490', 977), 1, 1), roughness: 0.9 })
  const inner = M('#c7c6c2', { roughness: 0.95 })
  const roof = M('#5b5d61', { roughness: 0.7 })
  const trim = M('#46484c')
  const t = 0.6
  // Side walls (concrete outside, pale inside).
  for (const s of [-1, 1]) {
    block(g, t, H, D, concrete, cx + s * (W / 2 - t / 2), 0, cz)
    block(g, 0.05, H - 0.4, D - 0.8, inner, cx + s * (W / 2 - t - 0.02), 0.2, cz)
  }
  // Back wall with a doorway on the east side (out to the plaza).
  const door = { w: 5, h: 4.6, x: cx + 4 }
  const backZ = B.minZ + t / 2
  block(g, door.x - door.w / 2 - B.minX, H, t, concrete, (B.minX + door.x - door.w / 2) / 2, 0, backZ)
  block(g, B.maxX - (door.x + door.w / 2), H, t, concrete, (door.x + door.w / 2 + B.maxX) / 2, 0, backZ)
  block(g, door.w, H - door.h, t, concrete, door.x, door.h, backZ)
  block(g, door.w + 0.4, 0.3, t + 0.1, trim, door.x, door.h - 0.15, backZ)
  // Front: a deep lintel over the opening with the fascia sign.
  block(g, W, 1.6, t, concrete, cx, H - 1.6, B.maxZ - t / 2)
  // Roof slab with overhang and a dark edge band.
  block(g, W + 1.2, 0.6, D + 1.2, roof, cx, H, cz)
  block(g, W + 1.3, 0.2, D + 1.3, trim, cx, H + 0.6, cz)
  // Fascia sign: TRUCK BAY, green with cream letters.
  const p = signCanvas(1024, 160, { bg: '#2f5d3a', border: '#1d3a24', borderWidth: 10, lines: [{ text: 'TRUCK BAY', size: 108, color: '#f3ecd2', stroke: '#173020', strokeWidth: 10 }] })
  box(g, W * 0.72, 1.2, 0.2, M('#2f5d3a'), cx, H - 0.85, B.maxZ + 0.12)
  signPanel(g, W * 0.71, 1.15, signMaterial(p), cx, H - 0.85, B.maxZ + 0.225)
  // Ceiling light panels (glowing).
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) block(g, 1.2, 0.08, 4, E('#f4f8ff', 1.6), cx + s * 3.6, H - 0.1, B.minZ + 5 + i * 8.5, 0, false)
  }
  // Bollards at the mouth, yellow/black.
  for (const s of [-1, 1]) {
    cyl(g, 0.22, 0.22, 1.1, M('#f2c230'), cx + s * (W / 2 + 0.6), 0.55, B.maxZ + 0.6, 10)
    cyl(g, 0.23, 0.23, 0.14, M('#222'), cx + s * (W / 2 + 0.6), 0.7, B.maxZ + 0.6, 10)
  }
  // A hose reel and an oil drum against the west wall inside.
  cyl(g, 0.45, 0.45, 1.0, M('#2f6fd0', { roughness: 0.4 }), B.minX + t + 0.6, 0.5, B.minZ + 3, 14)
  const reel = cyl(g, 0.5, 0.5, 0.2, M('#d63a2c'), B.minX + t + 0.15, 1.6, B.minZ + 6, 14)
  reel.rotation.z = Math.PI / 2
  void bicycle // the rideable bike stands by the stand now (farm/rideables.js)
  mailbox(g, 0.5, 35.6)
  bakeInto(root, g)

  // Colliders: walls, back wall pieces, roof.
  solidRect(B.minX, B.minX + t, B.minZ, B.maxZ, H)
  solidRect(B.maxX - t, B.maxX, B.minZ, B.maxZ, H)
  solidRect(B.minX, door.x - door.w / 2, B.minZ, B.minZ + t, H)
  solidRect(door.x + door.w / 2, B.maxX, B.minZ, B.minZ + t, H)
  solidRect(B.minX - 0.6, B.maxX + 0.6, B.minZ - 0.6, B.maxZ + 0.6, 0.8, H)

  // The pickup and trailer (live group: it idles).
  const hay = new MeshStandardMaterial({ map: tex(paintHay(), 1, 1), roughness: 1 })
  const rig = new Group()
  const truckSrc = pickup()
  truckSrc.position.set(0, 0, 3.4)
  const trSrc = trailer(hay)
  trSrc.position.set(0, 0, -2.6)
  const truck = bakeInto(rig, truckSrc)
  const tr = bakeInto(rig, trSrc)
  rig.position.set(cx, FARM.curbHeight + 0.015, cz + 2)
  root.add(rig)
  solid(1.2, 1.2, 4.7, cx, 1.2, cz + 1.6)
  addLamp(cx, H - 0.6, cz)
  const exhaust = { x: cx + 0.75, y: 0.45, z: cz + 2 + 3.4 - 2.85 }

  return {
    truck: { x: cx, z: cz + 4 },
    exhaust,
    inside: { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ },
    update(dt, t) {
      // Idle shudder: a fast, tiny jiggle on the springs with a slower rock.
      truck.position.y = Math.sin(t * 37) * 0.006 + Math.sin(t * 23.3) * 0.004
      truck.rotation.z = Math.sin(t * 17) * 0.002 + Math.sin(t * 1.1) * 0.0015
      tr.position.y = Math.sin(t * 29 + 1) * 0.002
    },
  }
}
