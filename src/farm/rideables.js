import { FARM } from '../config.js'
import * as game from '../game.js'
import { mount } from '../mount.js'
import { player, resetPlayer } from '../player.js'
import { syncYawToPlayer } from '../camera.js'
import * as sfx from '../audio/sfx.js'
import { bicycle } from './vehicles.js'
import { updateRig } from './rig.js'

// Everything the player can ride: the free bicycle by the farm stand, and the
// tractors and trucks once they are bought (farm/parks.js owns those). Walk up
// and press E (or tap the prompt) to get on; E again gets off and leaves the
// vehicle where it stands. While riding, the vehicle follows the player's body
// (player.js steers it like a car); its rig (farm/rig.js) does the rest: the
// wheels roll and steer, the body springs and leans, lights and exhaust work.
//  - bike: carries the bag (eggs in the basket), quicker than running; Racing
//    Bike upgrades repaint it
//  - tractor: drive into a ripe field to harvest it, with a bonus
//  - truck: drive into the storage yard to load it, into the town market to sell

const REACH = { bike: 2.4, tractor: 3.6, truck: 4.4, horse: 2.8, combine: 5.5, sprayer: 4.2 }
const SIDE = { bike: 1.0, tractor: 2.0, truck: 2.2, horse: 1.4, combine: 3.4, sprayer: 2.6 } // m from the player to the vehicle on getting off
const PARKED = new Set(['tractor', 'truck']) // parks.js owns these
const BIKE_COLORS = ['#d6322c', '#2f6fd0', '#3f9a3a', '#f2a03a', '#1f2124']

export function buildRideables(root, { parks, particles }) {
  const b = bicycle()
  b.g.position.set(FARM.bike.x, 0, FARM.bike.z)
  b.g.rotation.y = FARM.bike.ry
  b.frame.rotation.z = 0.12 // leaning on its kickstand
  root.add(b.g)
  const bike = { kind: 'bike', k: 0, ...b }
  const paintBike = () => b.setColor(BIKE_COLORS[Math.min(BIKE_COLORS.length - 1, game.garageLevel('bike'))])
  paintBike()
  game.on('garage', (g) => {
    if (g.id !== 'bike' && g.id !== 'basket') return
    paintBike()
    particles?.burst(b.g.position.x, 1.2, b.g.position.z, { n: 24, colors: ['#ffd23a', '#ffffff'], speed: 2, up: 4, gravity: -7, life: 1, size: 0.3 })
  })

  let current = null
  // Rideables added by other modules (econ/fleet.js, the horse): { kind, k, g, rig, name, sub(),
  // available(), take(), leave() }.
  const extras = []
  const all = () => [bike, ...parks.tractors.filter((v) => v.g.visible), ...parks.trucks.filter((v) => v.g.visible), ...extras.filter((v) => v.g.visible && v.available?.() !== false)]
  function nearest(pos) {
    let best = null
    let bestD = Infinity
    for (const v of all()) {
      if (v === current) continue
      if (PARKED.has(v.kind) && (v.m.moving || game.vehicleBusy(v.kind === 'truck' ? 'driver' : 'tractor', v.k))) continue
      const d = Math.hypot(pos.x - v.g.position.x, pos.z - v.g.position.z)
      if (d < (REACH[v.kind] ?? 4) && d < bestD) {
        best = v
        bestD = d
      }
    }
    return best
  }

  function getOn(v) {
    if (current) getOff()
    current = v
    const h = game.handling(v.kind)
    mount.active = { kind: v.kind, k: v.k, speed: h.speed, turn: h.turn, accel: h.accel, seat: h.seat, jump: h.jump, mul: 1 }
    if (PARKED.has(v.kind)) parks.take(v)
    else v.take?.()
    if (v.kind === 'bike') {
      v.frame.rotation.z = 0
      v.stand.visible = false
    }
    resetPlayer({ x: v.g.position.x, y: v.g.position.y + 0.3, z: v.g.position.z }, v.g.rotation.y)
    syncYawToPlayer()
    sfx.engineStart(v.kind)
    if (v.kind !== 'bike' && v.kind !== 'horse') for (let i = 0; i < 6; i++) particles?.puff(v.g.position.x, 2 + i * 0.2, v.g.position.z, { color: '#3e3f43', size: 0.4, grow: 5, life: 1.6, vy: 2, a: 0.35 })
    particles?.burst(v.g.position.x, 1.2, v.g.position.z, { n: 14, colors: ['#ffffff', '#ffe36a'], speed: 2, up: 3, gravity: -4, life: 0.6, size: 0.3 })
    game.emit('mount', mount.active)
    const tip = { bike: 'Ride to the town market (east along the road) to sell your bag!', tractor: 'Drive into a ripe field to harvest it!', truck: 'Load up in the storage yard, then sell in town!', horse: 'Space to jump! Try the course in the arena', combine: 'Drive into a ripe field: one pass harvests it all!', sprayer: 'Drive over growing fields to speed them up' }
    if (tip[v.kind]) game.emit('toast', { text: tip[v.kind], kind: 'info' })
  }
  function getOff() {
    const v = current
    if (!v) return
    current = null
    mount.active = null
    // The player stays put; the vehicle stands just beside them.
    const f = player.facing
    const s = SIDE[v.kind] ?? 2.4
    v.g.position.x = player.position.x + Math.cos(f) * s
    v.g.position.z = player.position.z - Math.sin(f) * s
    v.g.position.y = v.kind === 'bike' || v.kind === 'horse' ? 0 : 0.03
    if (v.kind === 'bike') {
      v.frame.rotation.z = 0.12
      v.stand.visible = true
    } else if (PARKED.has(v.kind)) parks.leave(v)
    else v.leave?.()
    if (v.rig) v.rig.s = null
    sfx.rideEngine(null, 0, 1, 0)
    game.emit('dismount', v)
  }
  game.on('reset', () => {
    getOff()
    bike.g.position.set(FARM.bike.x, 0, FARM.bike.z)
    bike.g.rotation.y = FARM.bike.ry
  })

  return {
    bike,
    get current() {
      return current
    },
    register(v) {
      extras.push(v)
      return v
    },
    dismount: getOff,
    // The interact prompt: get off what you ride, or get on the nearest vehicle.
    target(pos) {
      if (current) {
        const names = { bike: 'BICYCLE', tractor: 'TRACTOR', truck: 'TRUCK', horse: 'HORSE', combine: 'COMBINE', sprayer: 'SPRAYER' }
        let sub = current.sub?.() ?? 'Leave it here'
        if (current.kind === 'truck') sub = `Cargo ${game.count(game.truckCargo(current.k).items)}/${game.truckCargoMax()}`
        return { text: `GET OFF ${names[current.kind]}`, sub, run: getOff, ride: true, d: 0 }
      }
      const v = nearest(pos)
      if (!v) return null
      const d = Math.hypot(pos.x - v.g.position.x, pos.z - v.g.position.z)
      if (v.kind === 'bike') return { text: 'RIDE BICYCLE', sub: 'Faster, carries your bag', run: () => getOn(v), ride: true, d, obj: v.g }
      if (!PARKED.has(v.kind)) return { text: v.name, sub: v.sub?.() ?? '', run: () => getOn(v), ride: true, d, obj: v.g }
      if (v.kind === 'tractor') return { text: `DRIVE TRACTOR ${v.k + 1}`, sub: 'Harvest ripe fields', run: () => getOn(v), ride: true, d, obj: v.g }
      return { text: `DRIVE TRUCK ${v.k + 1}`, sub: `Cargo ${game.count(game.truckCargo(v.k).items)}/${game.truckCargoMax()}`, run: () => getOn(v), ride: true, d, obj: v.g }
    },
    update(dt, t) {
      // The bike's basket shows eggs while the bag holds any.
      bike.eggs.visible = game.bagCount() > 0
      // Parked trucks show their cargo.
      for (const v of parks.trucks) if (v.g.visible && !v.trip) parks.showCrates(v, game.count(game.truckCargo(v.k).items))
      const v = current
      if (v) {
        const p = player.renderPosition
        v.g.position.set(p.x, p.y, p.z)
        v.g.rotation.y = player.facing
        const speed = Math.hypot(player.velocity.x, player.velocity.z)
        sfx.rideEngine(v.kind, speed, mount.active?.speed ?? 10, dt)
      }
      // The bike's own rig (trucks and tractors are run by parks.js).
      updateRig(bike.rig, dt, t, { particles })
      if (current !== bike) bike.frame.rotation.z = 0.12
    },
  }
}
