import { surfaceAt } from './kit.js'

// One animator for every vehicle (trucks, tractors, the van, the bike), driven
// only by how its group actually moves (whoever moves it: the player, a trip
// route, the van's schedule). From the position and heading each frame it
// works out speed, acceleration and turn rate, then:
//  - rolls the wheels and steers the front ones (Ackermann-ish from turn rate)
//  - springs the body: the nose dips under braking and lifts under power, the
//    body rolls out of a turn (a bike leans into it), the engine shakes it at
//    idle and the road jiggles it at speed
//  - works the lights: brake lights when slowing or stopped, reversing lights,
//    indicators blinking through a turn, headlights brighter at night, a
//    rotating beacon
//  - puffs exhaust (dark and fast under power, a lazy wisp at idle) and flaps
//    the stack's rain cap, kicks up dust from the rear wheels on dirt

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const DIRT = /dirt|sand|gravel|soil|mud/

// rig spec: { g, body, wheels: [{ g, r, steer }], lights: { head, brake, ind: [left[], right[]], reverse },
//   exhaust: [[x, y, z], ...] (local), wheelbase, rear (z of the rear axle), lean (bike), flap, beacon, smoke }
export function makeRig(spec) {
  for (const w of spec.wheels) w.g.rotation.order = 'YXZ'
  return { ...spec, s: null, pitch: 0, pv: 0, roll: 0, rv: 0, steer: 0, spin: 0, smokeT: 0, dustT: 0, throttle: 0, bounce: 0, engineOn: true }
}

// Shared world state the rigs read (farm/index.js sets the night level each frame).
export const env = { night: 0 }

export function updateRig(rig, dt, t, { particles = null, night = env.night } = {}) {
  if (!(dt > 0)) return
  const g = rig.g
  const p = g.position
  const yaw = g.rotation.y
  let s = rig.s
  if (!s || Math.hypot(p.x - s.x, p.z - s.z) > 40 * dt + 3) {
    // First frame or a teleport: start from rest here.
    s = rig.s = { x: p.x, z: p.z, yaw, v: 0, a: 0, w: 0 }
  }
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const v = ((p.x - s.x) * fx + (p.z - s.z) * fz) / dt
  const dyaw = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw))
  const k = Math.min(1, dt * 8)
  const a = (v - s.v) / dt
  s.a += (a - s.a) * Math.min(1, dt * 5)
  s.v += (v - s.v) * k
  s.w += (dyaw / dt - s.w) * k
  s.x = p.x
  s.z = p.z
  s.yaw = yaw
  const speed = Math.abs(s.v)
  rig.speed = s.v
  rig.throttle = clamp(s.a / 6, 0, 1) * (speed > 0.3 ? 1 : 0.3)

  // Wheels: roll and steer.
  const steer = clamp(Math.atan((s.w * (rig.wheelbase ?? 3)) / Math.max(1.5, speed)) * Math.sign(s.v || 1), -0.6, 0.6)
  rig.steer += (steer - rig.steer) * Math.min(1, dt * 6)
  rig.spin += s.v * dt
  for (const w of rig.wheels) {
    ;(w.g.userData.spin ?? w.g).rotation.x = rig.spin / w.r
    if (w.steer) w.g.rotation.y = rig.steer
  }
  if (rig.fork) rig.fork.rotation.y = rig.steer * 0.8
  if (rig.crank) rig.crank.rotation.x = rig.spin / 0.9

  // Body: springs toward the pitch / roll the motion asks for.
  if (rig.body) {
    const lean = rig.lean ?? 0
    const pitchT = clamp(-s.a * 0.008, -0.05, 0.06)
    const rollT = lean ? clamp(-s.w * speed * 0.05 * lean, -0.5, 0.5) : clamp(s.w * speed * 0.004, -0.06, 0.06)
    rig.pv += ((pitchT - rig.pitch) * 60 - rig.pv * 9) * dt
    rig.rv += ((rollT - rig.roll) * (lean ? 30 : 60) - rig.rv * (lean ? 8 : 9)) * dt
    rig.pitch += rig.pv * dt
    rig.roll += rig.rv * dt
    const idle = rig.engineOn && !lean ? Math.sin(t * 38) * 0.006 * (speed < 1 ? 1 : 0.4) : 0
    const road = speed > 1 ? (Math.sin(t * 13.1 + p.x) * 0.5 + Math.sin(t * 7.3 + p.z)) * 0.006 * Math.min(1, speed / 10) : 0
    rig.body.rotation.x = rig.pitch + road * 0.3
    rig.body.rotation.z = rig.roll + idle * 0.3
    rig.body.position.y = (rig.bodyY ?? 0) + idle + road
  }

  // Lights.
  const L = rig.lights
  if (L) {
    const braking = s.a < -1.2 || speed < 0.2
    for (const m of L.brake ?? []) m.emissiveIntensity = braking ? 3.2 : m.userData.base
    for (const m of L.head ?? []) m.emissiveIntensity = night > 0.3 ? 4 : m.userData.base + (speed > 0.5 ? 0.6 : 0)
    for (const m of L.reverse ?? []) m.emissiveIntensity = s.v < -0.3 ? 3 : 0.05
    const blink = Math.floor(t * 3) % 2 === 0
    const turning = Math.abs(rig.steer) > 0.12 && speed > 0.5
    const [left = [], right = []] = L.ind ?? []
    for (const m of left) m.emissiveIntensity = turning && rig.steer > 0 && blink ? 3.5 : 0.1
    for (const m of right) m.emissiveIntensity = turning && rig.steer < 0 && blink ? 3.5 : 0.1
  }
  if (rig.beacon) {
    rig.beacon.rotation.y = t * 7
    rig.beacon.visible = speed > 0.3 || night > 0.3
  }
  for (const sp of rig.spinners ?? []) sp.obj.rotation[sp.axis ?? 'y'] += dt * sp.speed

  // Exhaust and the rain cap.
  if (rig.flap) rig.flap.rotation.x = -clamp(0.15 + rig.throttle * 1.1 + Math.abs(Math.sin(t * 23)) * 0.15, 0, 1.2)
  if (particles && rig.exhaust && rig.engineOn) {
    rig.smokeT -= dt
    if (rig.smokeT <= 0) {
      rig.smokeT = rig.throttle > 0.2 ? 0.05 : speed > 1 ? 0.12 : 0.3
      const c = Math.cos(yaw)
      for (const [lx, ly, lz] of rig.exhaust) {
        const wx = p.x + c * lx + fx * lz
        const wz = p.z - fx * lx + fz * lz
        const hot = rig.throttle > 0.2
        particles.puff(wx, p.y + ly, wz, { color: hot ? '#3e3f43' : '#8d8f94', size: hot ? 0.35 : 0.22, grow: hot ? 6 : 4, life: hot ? 1.8 : 1.4, vy: hot ? 2.2 : 1.1, a: hot ? 0.38 : 0.22, vx: -fx * s.v * 0.3, vz: -fz * s.v * 0.3 })
      }
    }
  }
  // Dust off the rear wheels on dirt.
  if (particles && speed > 2.5) {
    rig.dustT -= dt
    if (rig.dustT <= 0) {
      rig.dustT = 0.07
      const rz = rig.rear ?? -1.5
      const surf = surfaceAt(p.x + fx * rz, p.z + fz * rz)
      if (DIRT.test(surf) || rig.alwaysDust) {
        const c = Math.cos(yaw)
        const half = rig.track ?? 0.9
        for (const sd of [-1, 1]) particles.dust(p.x + fx * rz + c * half * sd, p.z + fz * rz - fx * half * sd, surf === 'sand' ? '#e3c89a' : surf === 'soil' ? '#8a6446' : '#b8936a', speed > 8 ? 2 : 1)
      }
    }
  }
}
