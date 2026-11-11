import { FARM } from '../config.js'
import * as game from '../game.js'
import * as fleet from '../econ/fleet.js'
import { mount } from '../mount.js'
import { player } from '../player.js'
import { combineHarvester, cropSprayer } from './vehicles.js'
import { updateRig } from './rig.js'

// The machines from econ/fleet.js in the world:
//  - the Combine Harvester (it replaces the one parked in the barn's north
//    door) and the Crop Sprayer (on the seed market plaza): rideable once
//    bought; the combine's reel spins and it blows chaff while it harvests,
//    the sprayer's booms mist the field it is over
//  - vehicle looks (paint, rims, light bar) applied to the bike, trucks,
//    tractors and these two
//  - a worn engine puffs dark smoke while driving

const SPAWN = {
  combine: { x: FARM.combine.x, z: FARM.combine.z, ry: Math.PI },
  sprayer: { x: 20, z: -31, ry: 0 },
}

export function buildFleet3d(root, { particles, rideables, parks, storage }) {
  const comb = combineHarvester()
  const spray = cropSprayer()
  const machines = { combine: comb, sprayer: spray }
  for (const id in machines) {
    const m = machines[id]
    const s = SPAWN[id]
    m.g.position.set(s.x, 0.03, s.z)
    m.g.rotation.y = s.ry
    m.g.visible = false
    root.add(m.g)
    rideables.register({
      kind: id,
      k: 0,
      g: m.g,
      rig: m.rig,
      name: id === 'combine' ? 'DRIVE COMBINE' : 'DRIVE SPRAYER',
      sub: () => `Fuel ${Math.round(fleet.fuelOf(id, 0))} L · wear ${Math.round(fleet.wearOf(id, 0) * 100)}%`,
      available: () => fleet.owns(id),
    })
  }
  const place = () => {
    comb.g.visible = fleet.owns('combine')
    spray.g.visible = fleet.owns('sprayer')
    storage?.setCombineParked?.(!fleet.owns('combine'))
  }
  place()
  game.on('fleet', (f) => {
    place()
    const m = machines[f.id]
    if (m) {
      particles?.confetti(m.g.position.x, 4, m.g.position.z, 70)
      particles?.ring(m.g.position.x, m.g.position.z, 5, '#c9a57a', 30)
    }
  })
  game.on('reset', () => {
    for (const id in machines) {
      const s = SPAWN[id]
      machines[id].g.position.set(s.x, 0.03, s.z)
      machines[id].g.rotation.y = s.ry
    }
    place()
  })

  // --- Looks --------------------------------------------------------------------------------------------
  function applyLooks() {
    const set = (v, kind) => {
      const lk = game.state.fleet.looks[kind]
      if (!lk || !v?.setLook) return
      const o = { lightBar: !!lk.lightBar, horn: lk.horn }
      if (lk.paint) o.paint = lk.paint
      if (lk.rims) o.rims = lk.rims
      v.setLook(o)
    }
    for (const t of parks.trucks) set(t, 'truck')
    for (const t of parks.tractors) set(t, 'tractor')
    set(comb, 'combine')
    set(spray, 'sprayer')
    const bl = game.state.fleet.looks.bike
    if (bl?.paint) rideables.bike.setColor?.(bl.paint)
    if (bl) rideables.bike.setLook?.({ rims: bl.rims ?? undefined })
  }
  applyLooks()
  game.on('look', ({ kind }) => {
    applyLooks()
    const v = kind === 'bike' ? rideables.bike : kind === 'combine' ? comb : kind === 'sprayer' ? spray : null
    const at = v?.g.position ?? player.position
    particles?.burst(at.x, 1.5, at.z, { n: 30, colors: ['#ffd23a', '#ffffff', '#7fd0ff'], speed: 2.5, up: 4, gravity: -6, life: 1, size: 0.3 })
  })
  game.on('vehicle', applyLooks)
  game.on('garage', () => setTimeout(applyLooks, 0)) // the racing bike repaints itself first
  game.on('reset', applyLooks)
  game.on('refuel', () => particles?.burst(player.position.x, 1.4, player.position.z, { n: 12, colors: ['#ffd23a', '#e94a3a'], speed: 1.5, up: 3, gravity: -6, life: 0.7, size: 0.24 }))
  game.on('repair', () => particles?.burst(player.position.x, 1.6, player.position.z, { n: 24, colors: ['#ffffff', '#9aa3ab', '#ffd23a'], speed: 2.5, up: 4, gravity: -7, life: 0.9, size: 0.26 }))

  let smokeT = 0
  let boom = 0
  let mistT = 0
  return {
    update(dt, t) {
      const m = mount.active
      for (const id in machines) {
        const v = machines[id]
        if (!v.g.visible) continue
        updateRig(v.rig, dt, t, { particles })
      }
      const speed = Math.hypot(player.velocity.x, player.velocity.z)
      // The combine: the reel turns while driving; chaff blows out the back over a field.
      comb.setHarvest?.(m?.kind === 'combine', 1.5 + speed * 0.4)
      if (m?.kind === 'combine' && !comb.setHarvest && comb.reel) comb.reel.rotation.x += dt * (1.5 + speed * 0.6)
      // The sprayer's booms swing out while someone drives it.
      boom += ((m?.kind === 'sprayer' ? 1 : 0) - boom) * Math.min(1, dt * 1.5)
      spray.setBooms?.(boom)
      if (m?.kind === 'combine') {
        const overCrop = game.PLOTS.some((p) => game.plotOwned(p) && player.position.x > p.crops.minX && player.position.x < p.crops.maxX && player.position.z > p.crops.minZ && player.position.z < p.crops.maxZ)
        if (overCrop && speed > 1 && Math.random() < dt * 30) {
          const f = player.facing
          const bx = player.position.x - Math.sin(f) * 5
          const bz = player.position.z - Math.cos(f) * 5
          particles?.puff(bx, 2.2, bz, { color: '#e8d08a', size: 0.8, grow: 4, life: 2.5, vy: 1.2, a: 0.45, vx: -Math.sin(f) * 2, vz: -Math.cos(f) * 2 })
        }
      }
      // The sprayer mists its booms.
      if (m?.kind === 'sprayer') {
        mistT -= dt
        if (mistT <= 0 && speed > 0.5) {
          mistT = 0.05
          const f = player.facing
          const side = (Math.random() - 0.5) * 9
          particles?.puff(player.position.x + Math.cos(f) * side, 0.9, player.position.z - Math.sin(f) * side, { color: '#cfeaff', size: 0.4, grow: 3, life: 1.2, vy: -0.2, a: 0.35 })
        }
      }
      // A worn engine smokes; an empty tank sputters.
      if (m && fleet.FUELLED.has(m.kind)) {
        const w = fleet.wearOf(m.kind, m.k)
        const empty = fleet.fuelOf(m.kind, m.k) <= 0
        smokeT -= dt
        if ((w > 0.5 || empty) && smokeT <= 0) {
          smokeT = empty ? 0.6 : 0.5 - w * 0.4
          particles?.puff(player.position.x, 2.4, player.position.z, { color: empty ? '#9a9a9a' : '#2a2a2c', size: 0.5, grow: 4, life: 2, vy: 1.4, a: 0.4 + w * 0.2 })
        }
      }
    },
  }
}
