import { Group } from 'three'
import { M } from './kit.js'
import { aimTube, arc, bakeStatic, bx, compact, cy, decal, extrude, lathe, lens, metal, paint, panel, rbox, ring, sph, tube } from './detail.js'

// A full-size beam pump ("nodding donkey"), about 9 m to the top of the beam
// and 15 m long, the beam along X with the horse head over the well at -X.
// It works like the real thing: the gearbox turns the cranks, the cranks'
// pins drive the pitman arms, the pitman arms rock the walking beam about the
// saddle bearing on the samson post (a four-bar linkage solved every frame),
// and the bridle's wire ropes, wrapping on a horse head whose face is an arc
// round the pivot, lift the carrier bar and the polished rod straight up and
// down through the stuffing box of the wellhead.
// Upgrades show on it: the Motor level grows the electric motor and, from
// level 3, swaps it for a gas engine with a radiator and a smoking exhaust;
// the Drill Bit level adds wellhead gear (a pressure gauge, more valves, a
// separator, a heater-treater, a flare stack); the Counterweights level bolts
// more weight plates to the cranks.

const O = { x: 0, y: 8.2 } // saddle bearing (beam pivot)
const LF = 6.2 // pivot -> horse head face (arc radius)
const LB = 4.6 // pivot -> equalizer (beam tail)
const C = { x: 4.6, y: 3.0 } // crank shaft
const RC = 1.2 // crank pin radius
const LP = Math.hypot(LB - 0 + O.x - C.x, O.y - C.y) // pitman length: beam level with the pin at 3 o'clock
const ROD = 5.4 // polished rod length
export const WELL_X = O.x - LF

export function pumpJack(n = 1) {
  const g = new Group()
  const S = new Group()
  const steel = metal('#4a525a', 0.5)
  const yellow = paint('#f2b81f', 0.4)
  const red = paint('#c8302a', 0.4)
  const green = paint('#2f6f4a', 0.45)
  const concrete = M('#b4b0a6', { roughness: 0.95 })
  const black = M('#1f2124', { roughness: 0.6 })
  const stripe = decal(256, 64, (ctx, w, h) => {
    for (let i = -2; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#1f2124' : '#f2c230'
      ctx.beginPath()
      ctx.moveTo(i * 28, 0)
      ctx.lineTo(i * 28 + 28, 0)
      ctx.lineTo(i * 28 - 4, h)
      ctx.lineTo(i * 28 - 32, h)
      ctx.fill()
    }
  })

  // --- Foundation, skid --------------------------------------------------------------------------------
  rbox(S, 16.2, 0.45, 4.6, 0.08, concrete, 0.6, 0.22, 0)
  rbox(S, 2.6, 0.5, 2.6, 0.08, concrete, WELL_X, 0.25, 0) // well cellar slab
  for (const z of [-1.25, 1.25]) {
    bx(S, 13.4, 0.06, 0.42, steel, 0.9, 0.48, z)
    bx(S, 13.4, 0.3, 0.06, steel, 0.9, 0.66, z)
    bx(S, 13.4, 0.06, 0.42, steel, 0.9, 0.84, z)
  }
  for (const x of [-4.5, -1.5, 1.5, 4.5, 7]) bx(S, 0.3, 0.36, 2.5, steel, x, 0.66, 0)

  // --- Samson post: four legs, braces, a ladder and a railed platform -------------------------------------
  const legs = [
    [[-1.7, 0.87, -1.3], [-0.2, O.y - 0.5, -0.38]],
    [[-1.7, 0.87, 1.3], [-0.2, O.y - 0.5, 0.38]],
    [[1.9, 0.87, -1.3], [0.2, O.y - 0.5, -0.38]],
    [[1.9, 0.87, 1.3], [0.2, O.y - 0.5, 0.38]],
  ]
  for (const [a, b] of legs) {
    tube(S, a, b, 0.14, yellow, 8)
    rbox(S, 0.5, 0.12, 0.5, 0.03, steel, a[0], 0.9, a[2])
  }
  const at = (leg, k) => legs[leg][0].map((v, i) => v + (legs[leg][1][i] - v) * k)
  for (const k of [0.3, 0.62]) {
    tube(S, at(0, k), at(1, k), 0.06, yellow)
    tube(S, at(2, k), at(3, k), 0.06, yellow)
    tube(S, at(0, k), at(2, k), 0.06, yellow)
    tube(S, at(1, k), at(3, k), 0.06, yellow)
  }
  tube(S, at(0, 0.05), at(1, 0.3), 0.05, yellow)
  tube(S, at(2, 0.05), at(3, 0.3), 0.05, yellow)
  tube(S, at(0, 0.3), at(1, 0.62), 0.05, yellow)
  tube(S, at(2, 0.3), at(3, 0.62), 0.05, yellow)
  // Ladder up the back (rear leg pair, centred).
  for (const z of [-0.25, 0.25]) tube(S, [1.75, 0.87, z], [0.5, O.y - 1.1, z], 0.035, steel)
  for (let i = 1; i < 22; i++) {
    const k = i / 22
    const x = 1.75 + (0.5 - 1.75) * k
    const y = 0.87 + (O.y - 1.1 - 0.87) * k
    tube(S, [x, y, -0.25], [x, y, 0.25], 0.02, steel)
  }
  // Platform under the saddle bearing with a railing.
  bx(S, 1.6, 0.06, 1.4, metal('#7a828a', 0.4), 0.2, O.y - 1.05, 0)
  for (const [x, z] of [[-0.6, -0.7], [1.0, -0.7], [-0.6, 0.7], [1.0, 0.7]]) tube(S, [x, O.y - 1.05, z], [x, O.y - 0.0, z], 0.025, yellow)
  for (const y of [O.y - 0.5, O.y - 0.02]) {
    tube(S, [-0.6, y, -0.7], [1.0, y, -0.7], 0.022, yellow)
    tube(S, [-0.6, y, 0.7], [1.0, y, 0.7], 0.022, yellow)
    tube(S, [-0.6, y, -0.7], [-0.6, y, 0.7], 0.022, yellow)
  }
  // Saddle bearing on top.
  rbox(S, 0.7, 0.45, 0.95, 0.05, steel, 0, O.y - 0.3, 0)
  cy(S, 0.2, 0.2, 1.05, metal('#9aa3ab', 0.3), 0, O.y, 0, 14, 'z')

  // --- Gear reducer, its pedestal, the brake, the V-belt guard -----------------------------------------
  rbox(S, 2.0, 1.3, 1.5, 0.06, concrete, C.x, 1.1, 0)
  rbox(S, 1.6, 1.5, 1.5, 0.1, green, C.x, 2.45, 0)
  for (let i = 0; i < 6; i++) bx(S, 1.62, 0.04, 1.52, metal('#25523a', 0.5), C.x, 1.9 + i * 0.2, 0)
  cy(S, 0.2, 0.2, 3.1, metal('#9aa3ab', 0.3), C.x, C.y, 0, 14, 'z') // output shaft
  ring(S, 0.75, 0.08, steel, C.x + 1.4, 2.1, 0.8, 'z') // input sheave
  // Belt guard: a frame of bars around the belts.
  const guard = new Group()
  for (const [y, z] of [[1.4, 0.75], [2.8, 0.75], [1.4, 1.15], [2.8, 1.15]]) tube(guard, [C.x + 0.7, y, z], [C.x + 3.4, y - 0.6, z], 0.025, yellow)
  for (let i = 0; i <= 6; i++) {
    const x = C.x + 0.7 + i * 0.45
    tube(guard, [x, 1.4 - i * 0.1, 1.15], [x, 2.8 - i * 0.1, 1.15], 0.015, yellow)
  }
  S.add(guard)
  // Crank brake lever + drum.
  ring(S, 0.35, 0.06, black, C.x - 0.9, 2.2, 0.85, 'z')
  tube(S, [C.x - 1.2, 1.0, 1.0], [C.x - 1.5, 2.4, 1.2], 0.04, red)
  sph(S, 0.08, black, C.x - 1.5, 2.45, 1.2)

  // --- Wellhead: casing head, tubing head, valves, tee, stuffing box ----------------------------------------
  const W = WELL_X
  lathe(S, [[0.001, 0.5], [0.42, 0.5], [0.42, 0.62], [0.3, 0.62], [0.3, 0.9], [0.44, 0.9], [0.44, 1.0], [0.24, 1.0], [0.24, 1.35], [0.34, 1.35], [0.34, 1.43], [0.16, 1.43], [0.16, 1.8], [0.24, 1.8], [0.24, 1.95], [0.1, 1.95], [0.001, 2.05]], metal('#5a636c', 0.35), W, 0, 0, 20)
  cy(S, 0.14, 0.14, 1.2, metal('#5a636c', 0.35), W, 1.18, 0.55, 12, 'z') // flow tee to the flowline
  for (const z of [0.55, -0.55]) {
    cy(S, 0.18, 0.18, 0.2, red, W, 1.18, z, 12, 'z')
    ring(S, 0.2, 0.025, red, W, 1.55, z, 'y')
    cy(S, 0.025, 0.025, 0.35, steel, W, 1.38, z, 6)
  }
  cy(S, 0.12, 0.12, 2.4, steel, W, 1.18, 2.1, 12, 'z') // flowline start
  // A well sign.
  const sign = decal(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2c230'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1f2124'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#1f2124'
    ctx.font = '700 48px Fredoka, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`WELL #${n}`, w / 2, 46)
    ctx.font = '600 28px Fredoka, Arial, sans-serif'
    ctx.fillText('FARM OIL CO.', w / 2, 92)
  })
  tube(S, [W - 0.9, 0.5, -1.4], [W - 0.9, 1.9, -1.4], 0.04, steel)
  panel(S, 0.9, 0.45, sign, W - 0.9, 2.0, -1.37)
  // Safety rail around the crank sweep, with hazard stripes.
  for (const [x, z] of [[C.x - 2.6, -2.1], [C.x + 2.2, -2.1], [C.x - 2.6, 2.1], [C.x + 2.2, 2.1]]) tube(S, [x, 0.45, z], [x, 1.6, z], 0.05, yellow)
  for (const y of [0.9, 1.55]) {
    tube(S, [C.x - 2.6, y, -2.1], [C.x + 2.2, y, -2.1], 0.035, yellow)
    tube(S, [C.x - 2.6, y, 2.1], [C.x + 2.2, y, 2.1], 0.035, yellow)
  }
  for (const z of [-2.12, 2.12]) panel(S, 4.7, 0.22, stripe, C.x - 0.2, 1.22, z, z > 0 ? 0 : Math.PI)
  // Control panel on a post.
  tube(S, [6.8, 0.45, -1.7], [6.8, 1.6, -1.7], 0.05, steel)
  rbox(S, 0.6, 0.8, 0.3, 0.04, M('#d9dde1', { roughness: 0.5 }), 6.8, 1.95, -1.7)
  const run = lens('#3aff6a', 2)
  const stop = lens('#ff2a1a', 0.2)
  sph(S, 0.05, run, 6.68, 2.15, -1.54)
  sph(S, 0.05, stop, 6.92, 2.15, -1.54)
  bakeStatic(g, S)

  // --- Moving parts -----------------------------------------------------------------------------------
  // Walking beam (an I-beam with stiffeners), horse head, equalizer.
  const beam = new Group()
  beam.position.set(O.x, O.y + 0.35, 0)
  const B = new Group()
  bx(B, LF + LB + 0.4, 0.95, 0.07, yellow, (LB - LF) / 2, 0, 0)
  for (const y of [-0.47, 0.47]) bx(B, LF + LB + 0.4, 0.07, 0.6, yellow, (LB - LF) / 2, y, 0)
  for (let x = -LF + 1; x < LB - 0.3; x += 0.9) for (const z of [-0.15, 0.15]) bx(B, 0.04, 0.88, 0.25, yellow, x, 0, z)
  // Horse head: its face is an arc round the pivot so the ropes hang plumb.
  const headPts = [...arc(0, 0, LF, Math.PI - 0.36, Math.PI + 0.36, 18), [-LF + 1.0, -1.6], [-LF + 1.4, -0.5], [-LF + 1.4, 0.5], [-LF + 1.0, 1.7]]
  extrude(B, headPts, 0.85, red, 0, -0.35, 0, 0.05)
  const face = extrude(B, [...arc(0, 0, LF + 0.06, Math.PI - 0.36, Math.PI + 0.36, 18), ...arc(0, 0, LF - 0.02, Math.PI + 0.36, Math.PI - 0.36, 18)], 0.95, metal('#2a2c30', 0.4), 0, -0.35, 0, 0)
  void face
  for (let i = 0; i < 4; i++) cy(B, 0.06, 0.06, 0.95, steel, -LF + 1.15, -1.4 + i * 0.9, 0, 8, 'z') // head bolts
  // Equalizer bar across the tail.
  rbox(B, 0.45, 0.4, 3.4, 0.05, steel, LB, -0.35, 0)
  cy(B, 0.14, 0.14, 3.6, metal('#9aa3ab', 0.3), LB, -0.6, 0, 12, 'z')
  bakeStatic(beam, B)
  g.add(beam)

  // Cranks: two arms on the shaft, pins at RC, counterweights opposite.
  const crank = new Group()
  crank.position.set(C.x, C.y, 0)
  const weights = []
  for (const z of [-1.4, 1.4]) {
    const arm = new Group()
    arm.position.z = z
    rbox(arm, 0.55, RC + 2.2, 0.22, 0.08, red, 0, (RC - 2.2) / 2, 0)
    cy(arm, 0.16, 0.16, 0.45, metal('#9aa3ab', 0.3), 0, RC, z > 0 ? 0.2 : -0.2, 10, 'z') // wrist pin
    // Counterweights: up to six plates bolted on the long end.
    for (let i = 0; i < 6; i++) {
      const w = rbox(arm, 1.3 - i * 0.08, 0.2, 0.36, 0.05, M('#8a2a22', { roughness: 0.55 }), 0, -1.05 - i * 0.22, 0)
      w.visible = i < 2
      weights.push({ w, i })
    }
    crank.add(arm)
  }
  g.add(crank)
  // Pitman arms (tubes re-aimed each frame), carrier bar, polished rod, wire ropes.
  const pitman = [-1.6, 1.6].map((z) => ({ z, m: tube(g, [0, 0, 0], [0, 1, 0], 0.11, yellow, 10) }))
  const ropes = [-0.18, 0.18].map((z) => ({ z, m: tube(g, [0, 0, 0], [0, 1, 0], 0.03, M('#2a2c30', { roughness: 0.4 }), 6) }))
  const carrier = new Group()
  rbox(carrier, 0.3, 0.2, 0.75, 0.04, steel, 0, 0, 0)
  cy(carrier, 0.07, 0.07, 0.25, metal('#cfd4d8', 0.2), 0, 0.2, 0, 8) // rod clamp
  g.add(carrier)
  const rod = tube(g, [0, 0, 0], [0, 1, 0], 0.045, metal('#eef1f3', 0.08), 10)

  // --- Upgrade parts --------------------------------------------------------------------------------------
  // Electric motor (levels 0-2, growing) on its slide base.
  const motor = new Group()
  motor.position.set(C.x + 3.4, 0.9, 0.95)
  const MM = new Group()
  bx(MM, 1.4, 0.15, 1.2, steel, 0, 0, 0)
  lathe(MM, [[0.001, 0], [0.45, 0], [0.5, 0.08], [0.5, 1.0], [0.45, 1.1], [0.001, 1.1]], M('#2f6fd0', { roughness: 0.4, metalness: 0.3 }), 0, 0.62, -0.55, 20).rotation.x = Math.PI / 2
  for (let i = 0; i < 10; i++) bx(MM, 1.02, 0.03, 1.0, M('#25569a'), 0, 0.62, 0, 0).rotation.x = (i / 10) * Math.PI
  rbox(MM, 0.35, 0.3, 0.3, 0.04, M('#2a2c30'), 0, 1.2, 0.2) // junction box
  cy(MM, 0.3, 0.3, 0.18, steel, 0, 0.62, 0.62, 16, 'z') // sheave
  bakeStatic(motor, MM)
  g.add(motor)
  // Gas engine (levels 3+): block, radiator with a spinning fan, muffler and stack.
  const engine = new Group()
  engine.position.set(C.x + 3.5, 0.9, 0.95)
  const EE = new Group()
  bx(EE, 2.0, 0.15, 1.5, steel, 0, 0, 0)
  rbox(EE, 1.3, 1.1, 1.0, 0.08, M('#3a6a3a', { roughness: 0.5 }), -0.1, 0.7, 0)
  rbox(EE, 1.0, 0.3, 0.8, 0.05, M('#2a2c30'), -0.1, 1.35, 0) // valve cover
  rbox(EE, 0.25, 1.4, 1.3, 0.04, M('#2a2c30'), 0.85, 0.85, 0) // radiator
  for (let i = 0; i < 12; i++) bx(EE, 0.27, 0.03, 1.2, metal('#9aa3ab', 0.4), 0.85, 0.25 + i * 0.1, 0)
  cy(EE, 0.18, 0.18, 0.9, metal('#7a828a', 0.4), -0.5, 1.7, -0.45, 12, 'x') // muffler
  cy(EE, 0.07, 0.07, 1.2, metal('#2a2c30', 0.5), -0.95, 2.2, -0.45, 10)
  bakeStatic(engine, EE)
  const fan = new Group()
  fan.position.set(0.98, 0.85, 0)
  for (let i = 0; i < 4; i++) bx(fan, 0.03, 0.55, 0.14, metal('#d9dde1', 0.3), 0, 0, 0).rotation.x = (i / 4) * Math.PI
  engine.add(fan)
  g.add(engine)
  // Wellhead extras (Drill Bit levels): gauge, wing valve, separator, heater-treater, flare.
  const gauge = new Group()
  tube(gauge, [W, 1.95, 0], [W, 2.35, -0.25], 0.025, metal('#9aa3ab'))
  cy(gauge, 0.14, 0.14, 0.06, metal('#cfd4d8', 0.2), W, 2.4, -0.28, 16, 'z')
  panel(gauge, 0.22, 0.22, decal(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(32, 32, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#d6322c'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(32, 32)
    ctx.lineTo(50, 18)
    ctx.stroke()
    ctx.strokeStyle = '#2a2c30'
    ctx.lineWidth = 2
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5
      ctx.beginPath()
      ctx.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22)
      ctx.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28)
      ctx.stroke()
    }
  }), W, 2.4, -0.32, Math.PI)
  g.add(gauge)
  const wing = new Group()
  cy(wing, 0.14, 0.14, 1.0, metal('#5a636c', 0.35), W, 1.6, -0.5, 12, 'z')
  cy(wing, 0.17, 0.17, 0.18, red, W, 1.6, -0.75, 12, 'z')
  ring(wing, 0.2, 0.025, red, W, 1.95, -0.75, 'y')
  g.add(wing)
  const separator = new Group()
  separator.position.set(W - 2.2, 0.45, 2.6)
  lathe(separator, [[0.001, 0], [0.45, 0.05], [0.55, 0.3], [0.55, 2.4], [0.4, 2.7], [0.001, 2.75]], M('#e9e6de', { roughness: 0.45, metalness: 0.3 }), 0, 0, 0, 20)
  for (const a of [0, 2.1, 4.2]) tube(separator, [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], [Math.cos(a) * 0.45, 0.6, Math.sin(a) * 0.45], 0.05, steel)
  tube(separator, [0.5, 1.5, 0], [2.2, 1.2, -1.9], 0.06, steel)
  g.add(separator)
  const treater = new Group()
  treater.position.set(W - 3.6, 0.45, 2.6)
  cy(treater, 0.7, 0.7, 4.2, M('#d8d2c4', { roughness: 0.5, metalness: 0.2 }), 0, 2.1, 0, 22)
  lathe(treater, [[0.7, 0], [0.5, 0.35], [0.001, 0.45]], M('#d8d2c4', { roughness: 0.5, metalness: 0.2 }), 0, 4.2, 0, 22)
  for (let i = 0; i < 10; i++) tube(treater, [0.72, 0.4 + i * 0.38, -0.2], [0.72, 0.4 + i * 0.38, 0.2], 0.02, steel)
  for (const z of [-0.2, 0.2]) tube(treater, [0.75, 0.3, z], [0.75, 4.1, z], 0.025, steel)
  g.add(treater)
  const flare = new Group()
  flare.position.set(W - 5.2, 0.45, -2.4)
  tube(flare, [0, 0, 0], [0, 7.5, 0], 0.12, metal('#7a828a', 0.4))
  for (const a of [0, 2.1, 4.2]) tube(flare, [Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2], [0, 5.5, 0], 0.03, steel)
  cy(flare, 0.2, 0.16, 0.4, metal('#3a3d42'), 0, 7.6, 0, 12)
  const flame = lens('#ff9a2a', 3)
  const flameMesh = sph(flare, 0.35, flame, 0, 8.1, 0, 1, 1.6, 1)
  g.add(flare)

  for (const p of pitman) p.m.userData.keep = true
  for (const r of ropes) r.m.userData.keep = true
  rod.userData.keep = true
  for (const { w } of weights) w.userData.keep = true
  flameMesh.userData.keep = true
  compact(g)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })

  // --- Animation ------------------------------------------------------------------------------------------
  let theta = Math.random() * Math.PI * 2
  let omega = 0
  let level = { motor: 0, drill: 0, weights: 0 }
  const setLevel = (lv) => {
    level = { motor: 0, drill: 0, weights: 0, ...lv }
    const m = level.motor
    motor.visible = m < 3
    motor.scale.setScalar(1 + m * 0.18)
    engine.visible = m >= 3
    engine.scale.setScalar(1 + (m - 3) * 0.12)
    const d = level.drill
    gauge.visible = d >= 1
    wing.visible = d >= 2
    separator.visible = d >= 3
    treater.visible = d >= 4
    flare.visible = d >= 5
    for (const { w, i } of weights) w.visible = i < 2 + level.weights
  }
  setLevel(level)
  const pin = { x: 0, y: 0 }
  // run: is the pump working; speed: strokes a second when it is. Returns events for the caller.
  function update(dt, t, running, speed = 0.12) {
    const target = running ? speed * Math.PI * 2 : 0
    omega += (target - omega) * Math.min(1, dt * (running ? 0.8 : 0.5))
    const prev = theta
    theta += omega * dt
    crank.rotation.z = -theta
    // Crank pin (clockwise seen from +Z).
    pin.x = C.x + Math.sin(theta) * RC
    pin.y = C.y + Math.cos(theta) * RC
    // Four-bar: the equalizer E lies on circle(O, LB) and circle(pin, LP).
    const dx = pin.x - O.x
    const dy = pin.y - O.y
    const d = Math.hypot(dx, dy)
    const a = (LB * LB - LP * LP + d * d) / (2 * d)
    const h = Math.sqrt(Math.max(0, LB * LB - a * a))
    const bxp = O.x + (a * dx) / d
    const byp = O.y + (a * dy) / d
    const e1 = [bxp + (h * dy) / d, byp - (h * dx) / d]
    const e2 = [bxp - (h * dy) / d, byp + (h * dx) / d]
    const E = e1[0] > e2[0] ? e1 : e2
    const phi = Math.atan2(E[1] - O.y, E[0] - O.x)
    beam.rotation.z = phi
    // The equalizer's pitman pin sits below the beam's centre line.
    const ex = O.x + Math.cos(phi) * LB + Math.sin(phi) * 0.6
    const ey = O.y + 0.35 + Math.sin(phi) * LB - Math.cos(phi) * 0.6
    for (const p of pitman) aimTube(p.m, [pin.x, pin.y, p.z], [ex, ey, p.z])
    // Ropes hang plumb from the head face; the carrier rises and falls by the arc length.
    const cy0 = 4.9 - LF * phi
    for (const r of ropes) aimTube(r.m, [WELL_X - 0.06, O.y, r.z], [WELL_X - 0.06, cy0 + 0.1, r.z])
    carrier.position.set(WELL_X - 0.06, cy0, 0)
    aimTube(rod, [WELL_X - 0.06, cy0 - ROD, 0], [WELL_X - 0.06, cy0, 0])
    // Lamps, the engine fan, the flare.
    run.emissiveIntensity = running ? 2 + Math.sin(t * 4) * 0.5 : 0.1
    stop.emissiveIntensity = running ? 0.1 : 2.5
    fan.rotation.x += dt * (running ? 25 : 2)
    flameMesh.scale.set(1 + Math.sin(t * 17) * 0.15, 1.6 + Math.sin(t * 11) * 0.4, 1 + Math.cos(t * 13) * 0.15)
    // Events: a stroke turned over (thump), the bottom of the stroke (splash).
    const turned = Math.floor(prev / (Math.PI * 2)) !== Math.floor(theta / (Math.PI * 2))
    return { turned, phi, carrierY: cy0 }
  }
  // World-space spots for effects, relative to the pump's group.
  const spots = {
    stuffing: [WELL_X, 2.0, 0],
    exhaust: [C.x + 3.5 - 0.95, 2.9, 0.5],
    flare: [W - 5.2, 8.6, -2.4],
    motor: [C.x + 3.4, 1.5, 0.95],
  }
  return { g, update, setLevel, spots, get level() { return level } }
}
