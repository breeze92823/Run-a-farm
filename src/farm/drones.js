import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import * as sfx from '../audio/sfx.js'
import { gated, solid, solidRect } from './kit.js'
import { droneBase } from './models.js'
import { drone3d } from './drone3d.js'
import { makeNPC, idle } from './npc.js'

// The Drone Base (bought on its build pad) on the east lawn, and the drones
// the player buys for it. game.js runs each drone's clock (droneRuns /
// droneLegs: lift, fly to the barn yard, drop down, hook a crate, climb, fly to
// the town market, lower the crate, climb, fly home, land); this file flies
// the models along the same legs with real-feeling motion:
//  - smooth eased legs, banking into acceleration and turns, a gentle hover
//    wobble, yaw turning toward the way it flies
//  - rotors spinning up from the pad (the blur disc fades in), legs folding
//    up in cruise and down for landing
//  - the winch paying out the cable to the ground to hook the crate (and to
//    set it down in town), the crate swinging under it
//  - downwash dust rings near the ground, a puff at take-off, sparkles at the pick

const ease = (k) => k * k * (3 - 2 * k)
const S = 1.4 // model scale

export function buildDrones(root, { particles }) {
  const B = FARM.droneBase
  let base = null
  gated(root, 'droneBase', (G) => {
    base = droneBase()
    base.g.position.set(B.x, 0, B.z)
    G.add(base.g)
    solidRect(B.x - 9, B.x + 9, B.z - 7, B.z + 7, 0.36)
    solid(1.8, 1.4, 1.2, B.x - 6.5, 1.6, B.z - 5.6)
    const op = makeNPC({ shirt: '#f07a24', pants: '#2c2c3a', hat: 'cap', hatColor: '#2f3338' })
    op.group.position.set(B.x - 4.2, 0.38, B.z - 3.6)
    op.group.rotation.y = Math.PI * 0.8
    G.add(op.group)
    base.op = op
  }, 6)

  const pads = game.dronePads()
  const drones = pads.map(([x, z], k) => {
    const d = drone3d()
    d.g.position.set(x, 0.38 + 0.62 * S, z)
    d.g.visible = false
    root.add(d.g)
    return { ...d, k, yaw: Math.PI, vx: 0, vz: 0, px: x, py: 1, pz: z, ax: 0, az: 0, rpm: 0, fold: 0, washT: 0 }
  })
  const levels = (k) => ({ speed: game.droneSpeedLevel(k), cap: game.state.drones.cap[k] ?? 0 })
  const show = () =>
    drones.forEach((d) => {
      d.g.visible = game.built('droneBase') && d.k < game.state.drones.n
      if (d.g.visible) d.setLevel(levels(d.k))
    })
  show()
  game.on('drone', ({ k, why }) => {
    show()
    const [x, z] = pads[k]
    if (why === 'buy') {
      particles?.confetti(x, 2, z, 50)
      particles?.ring(x, z, 2.4, '#d8d6d2', 24)
    } else particles?.burst(x, 1.5, z, { n: 30, colors: ['#3aa8ff', '#ffffff', '#ffe36a'], speed: 3, up: 4, gravity: -6, life: 1.1, size: 0.35 })
  })
  game.on('build', show)
  game.on('reset', show)
  game.on('droneGo', ({ k }) => {
    const [x, z] = pads[k]
    sfx.liftOff(x, z)
    particles?.ring(x, z, 2, '#d8d6d2', 22)
  })
  game.on('dronePick', () => {
    sfx.pickupBeep(game.DRONE_PICK[0], game.DRONE_PICK[1])
    particles?.burst(game.DRONE_PICK[0], 1, game.DRONE_PICK[1], { n: 18, colors: ['#3aa8ff', '#ffffff'], speed: 1.8, up: 3, gravity: -4, life: 0.8, size: 0.3 })
  })
  game.on('droneSold', () => {
    particles?.coins(game.DRONE_SELL[0], 1.5, game.DRONE_SELL[1], 14)
  })

  return {
    console: [B.x - 6.5, B.z - 3.4],
    update(dt, t) {
      if (base) {
        base.sock.rotation.y = Math.sin(t * 0.4) * 0.5 + 0.4
        base.sock.rotation.x = Math.sin(t * 3.1) * 0.05
        base.dish.rotation.y = t * 0.3
        if (base.op && game.built('droneBase')) idle(base.op, t, dt, 0.6)
      }
      if (!(dt > 0)) return
      for (const d of drones) {
        if (!d.g.visible) {
          sfx.rotor(d.k, 0, 0, false, 0)
          continue
        }
        const run = game.droneRuns[d.k]
        const [hx, hz] = pads[d.k]
        let x = hx
        let y = 0.38 + 0.62 * S
        let z = hz
        let name = 'idle'
        let k = 0
        if (run && run.leg >= 0 && run.legs) {
          const leg = run.legs[run.leg]
          name = leg[0]
          const [, len, a, b] = leg
          k = Math.min(1, run.t / len)
          const e = ease(k)
          x = a[0] + (b[0] - a[0]) * e
          y = Math.max(0.38 + 0.62 * S, a[1] + (b[1] - a[1]) * e + 0.65)
          z = a[2] + (b[2] - a[2]) * e
        }
        // Velocity and acceleration from the motion, for banking and yaw.
        const vx = (x - d.px) / dt
        const vz = (z - d.pz) / dt
        d.ax += ((vx - d.vx) / dt - d.ax) * Math.min(1, dt * 4)
        d.az += ((vz - d.vz) / dt - d.az) * Math.min(1, dt * 4)
        d.vx = vx
        d.vz = vz
        d.px = x
        d.py = y
        d.pz = z
        const sp = Math.hypot(vx, vz)
        if (sp > 1.5) {
          const want = Math.atan2(vx, vz)
          d.yaw += Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw)) * Math.min(1, dt * 2.5)
        }
        const flying = name !== 'idle'
        d.rpm += ((flying ? (name === 'land' && k > 0.85 ? 0.3 : 1) : 0) - d.rpm) * Math.min(1, dt * 1.8)
        // Bank: tilt forward into speed + acceleration, roll into turns (in the drone's frame).
        const fwdA = (d.ax * Math.sin(d.yaw) + d.az * Math.cos(d.yaw)) * 0.02 + sp * 0.01
        const sideA = d.ax * Math.cos(d.yaw) - d.az * Math.sin(d.yaw)
        d.tilt.rotation.x += (Math.max(-0.35, Math.min(0.35, fwdA)) - d.tilt.rotation.x) * Math.min(1, dt * 4)
        d.tilt.rotation.z += (Math.max(-0.3, Math.min(0.3, -sideA * 0.02)) - d.tilt.rotation.z) * Math.min(1, dt * 4)
        const hover = flying ? Math.sin(t * 2.3 + d.k) * 0.08 : 0
        d.g.position.set(x, y + hover, z)
        d.g.rotation.y = d.yaw
        // Legs fold up in cruise, down near the ground.
        const high = y > 6 && (name === 'toPick' || name === 'toSell' || name === 'home')
        d.fold += ((high ? 1 : 0) - d.fold) * Math.min(1, dt * 2)
        // Winch: the cable pays out to the ground at the pick and the drop.
        const toGround = (y - 0.3) / S - 0.5
        let cable = 0.35
        if (name === 'pick') cable = toGround * Math.sin(k * Math.PI)
        else if (name === 'sell') cable = toGround * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.6) * 2.5)
        const carrying = !!run?.load && name !== 'lift' && name !== 'toPick' && name !== 'down' && !(name === 'pick' && k < 0.5) && !(name === 'sell' && k > 0.5) && name !== 'rise' && name !== 'home' && name !== 'land'
        const top = run?.load ? Object.keys(run.load).sort((a, b) => run.load[b] - run.load[a])[0] : null
        d.animate(dt, t, { rpm: d.rpm, fold: d.fold, cable: Math.max(0.35, cable), carrying, color: top ? GAME.goods[top].color : null })
        // Downwash dust near the ground.
        if (d.rpm > 0.3 && y < 7) {
          d.washT -= dt
          if (d.washT <= 0) {
            d.washT = 0.12
            const r = 1.2 + (y / 7) * 2.2
            for (let i = 0; i < 4; i++) {
              const a = Math.random() * Math.PI * 2
              particles?.dust(x + Math.cos(a) * r, z + Math.sin(a) * r, '#d8d6d2', 2)
            }
          }
        }
        sfx.rotor(d.k, x, z, d.rpm > 0.05, d.rpm)
      }
    },
  }
}
