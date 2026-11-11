import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { E, M, addSurface, bakeInto, block, box, cyl, gated, inRect, signCanvas, signMaterial, signPanel } from './kit.js'
import { farmTruck, tractor } from './vehicles.js'
import { env, updateRig } from './rig.js'
import { paintDirt, tex } from './textures.js'

// The Tractor Park (gravel strip by the west plots) and the Vehicle Park (the
// drop-off's south-east corner): a slot per vehicle the farm can own, the
// vehicles it does own parked in them, a sign, and a pad that buys the next
// one. When a driver takes a job (game.js 'dispatch') its vehicle drives the
// route in the trip's time:
//  - a tractor backs out onto the path, takes the plot's track, sweeps up and
//    down the crop (dust behind it; the harvest lands as it finishes) and
//    comes home, its driver in the seat
//  - a truck (crates of eggs in the bed) backs out, takes the driveway to the
//    road and drives off east to the market, then comes back along the other
//    lane and noses into its slot

const TP = FARM.tractorPark
const VP = FARM.vehiclePark
const tractorDef = GAME.vehicles.find((v) => v.id === 'tractors')
const truckDef = GAME.vehicles.find((v) => v.id === 'trucks')
const slotX = (P, n, i) => P.minX + ((P.maxX - P.minX) / n) * (i + 0.5)

// --- Routes ---------------------------------------------------------------------------------------------------------
// A mover drives an object through [x, z, cost] points in a set time; `cost`
// weights how slowly a segment is driven (yard = slow, road = fast). The first
// segment can be driven in reverse (backing out of a slot).
function mover(obj, yAt) {
  return { obj, yAt, all: null, seg: 0, speeds: null, rev: false, onEnd: null, moving: false, spin: 0 }
}
function drive(m, pts, time, { reverseFirst = false, onEnd = null } = {}) {
  const p = m.obj.position
  const all = [[p.x, p.z], ...pts]
  const lens = []
  let cost = 0
  for (let i = 1; i < all.length; i++) {
    const l = Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1])
    lens.push(l)
    cost += l * (all[i][2] ?? 1)
  }
  const per = Math.max(0.1, time) / Math.max(0.01, cost) // seconds per unit of cost
  m.speeds = lens.map((l, i) => 1 / (per * (all[i + 1][2] ?? 1)))
  m.all = all
  m.seg = 0
  m.rev = reverseFirst
  m.onEnd = onEnd
  m.moving = true
}
function step(m, dt) {
  if (!m.all) {
    m.moving = false
    return
  }
  const o = m.obj
  let left = dt
  let yaw = null
  while (left > 0 && m.seg < m.all.length - 1) {
    const [tx, tz] = m.all[m.seg + 1]
    const dx = tx - o.position.x
    const dz = tz - o.position.z
    const d = Math.hypot(dx, dz)
    const v = m.speeds[m.seg]
    if (d > 1e-4) yaw = Math.atan2(dx, dz) + (m.rev && m.seg === 0 ? Math.PI : 0)
    if (d <= v * left) {
      o.position.x = tx
      o.position.z = tz
      left -= d / v
      m.seg++
    } else {
      o.position.x += (dx / d) * v * left
      o.position.z += (dz / d) * v * left
      m.spin += v * left * (m.rev && m.seg === 0 ? -1 : 1)
      left = 0
    }
  }
  if (yaw != null) {
    const diff = Math.atan2(Math.sin(yaw - o.rotation.y), Math.cos(yaw - o.rotation.y))
    o.rotation.y += diff * Math.min(1, dt * 6)
  }
  o.position.y = m.yAt(o.position.x, o.position.z)
  if (m.seg >= m.all.length - 1) {
    m.all = null
    m.moving = false
    const cb = m.onEnd
    m.onEnd = null
    cb?.()
  }
}

// Ground heights the vehicles ride on (the driveway and sidewalk sit at the curb).
const DRIVE = { minX: FARM.driveway.minX, maxX: FARM.driveway.maxX, minZ: FARM.truckBay.maxZ, maxZ: FARM.sidewalkN.maxZ }
const truckY = (x, z) => (inRect(x, z, DRIVE) ? FARM.curbHeight + 0.015 : inRect(x, z, FARM.dropOff) ? 0.06 : 0.03)
const tractorY = () => 0.02

// --- Park ground, lines and signs ------------------------------------------------------------------------------------
function parkGround(root, r, map, tile, y, type) {
  const w = r.maxX - r.minX
  const d = r.maxZ - r.minZ
  const geo = new PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2)
  const t = map.clone()
  t.repeat.set(w / tile, d / tile)
  t.needsUpdate = true
  const m = new Mesh(geo, new MeshStandardMaterial({ map: t, roughness: 1 }))
  m.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2)
  m.receiveShadow = true
  root.add(m)
  addSurface(r, type)
}
function parkSign(g, x, z, text, bg, edge) {
  const p = signCanvas(512, 112, { bg, plank: 2, border: edge, borderWidth: 8, radius: 10, lines: [{ text, size: 66, color: '#fff3d6', stroke: edge, strokeWidth: 10 }] })
  for (const s of [-1, 1]) block(g, 0.14, 2.6, 0.14, M('#6e4122'), x + s * 1.9, 0, z)
  box(g, 4.2, 0.95, 0.12, M(edge), x, 2.25, z)
  signPanel(g, 4.1, 0.88, signMaterial(p), x, 2.25, z + 0.07)
}

export function buildParks(root, { particles }) {
  const nT = tractorDef.max
  const nV = truckDef.max
  // Tractor Bay (bought on its build pad): gravel, white slot lines, a sign at the back.
  gated(root, 'tractorBay', (G) => {
    const gravel = tex(paintDirt(256, '#b9ad98', '#8f8574', 963), 1)
    parkGround(G, TP, gravel, 4, 0.028, 'gravel')
    const tg = new Group()
    for (let i = 0; i <= nT; i++) block(tg, 0.16, 0.02, TP.maxZ - TP.minZ - 1.2, M('#f4f1e8'), TP.minX + ((TP.maxX - TP.minX) / nT) * i, 0.03, (TP.minZ + TP.maxZ) / 2 - 0.3, 0, false)
    parkSign(tg, TP.minX + 2.6, TP.minZ - 0.15, 'TRACTOR BAY', '#3f8a4a', '#1d4a20')
    // A fuel tank on legs at the end of the bay.
    cyl(tg, 0.8, 0.8, 2.4, M('#d6322c', { roughness: 0.4 }), TP.minX - 1.6, 1.4, TP.maxZ - 2, 14).rotation.z = Math.PI / 2
    for (const s of [-1, 1]) block(tg, 0.2, 0.9, 0.2, M('#4a4a4a'), TP.minX - 1.6 + s * 0.9, 0, TP.maxZ - 2)
    bakeInto(G, tg)
  }, 3)

  // Truck Park (part of the Truck Bay): dark tarmac with yellow bays and a sign.
  gated(root, 'truckBay', (G) => {
    const tarmac = tex(paintDirt(256, '#5c5d61', '#46474b', 967), 1)
    parkGround(G, VP, tarmac, 5, 0.062, 'asphalt')
    const vg = new Group()
    for (let i = 0; i <= nV; i++) block(vg, 0.16, 0.02, VP.maxZ - VP.minZ - 1, M('#f2c230', { roughness: 0.6 }), VP.minX + ((VP.maxX - VP.minX) / nV) * i, 0.065, (VP.minZ + VP.maxZ) / 2 + 0.3, 0, false)
    parkSign(vg, (VP.minX + VP.maxX) / 2, VP.minZ - 0.3, 'TRUCK PARK', '#2f5d8a', '#123050')
    bakeInto(G, vg)
  }, 3)

  // One vehicle per slot, shown once owned.
  const tractors = []
  const tractorColors = ['#3f9a3a', '#d6322c', '#2f6fd0', '#f2a03a']
  for (let i = 0; i < nT; i++) {
    const t = tractor(tractorColors[i])
    const home = [slotX(TP, nT, i), TP.slotZ]
    t.g.position.set(home[0], 0.02, home[1])
    t.g.rotation.y = Math.PI // nose to the plots
    root.add(t.g)
    tractors.push({ ...t, home, seat: t.driver, m: mover(t.g, tractorY), chaffT: 0, trip: null })
  }
  const trucks = []
  const truckColors = ['#2f6fd0', '#d6322c', '#3f8a4a', '#f2a03a']
  for (let i = 0; i < nV; i++) {
    const t = farmTruck(truckColors[i], `FARM ${i + 1}`)
    const home = [slotX(VP, nV, i), VP.slotZ]
    t.g.position.set(home[0], truckY(home[0], home[1]), home[1])
    t.g.rotation.y = Math.PI // nose north, into the slot
    root.add(t.g)
    trucks.push({ ...t, home, seat: t.driver, m: mover(t.g, truckY), trip: null, kind: 'truck', k: i })
  }
  tractors.forEach((t, i) => Object.assign(t, { kind: 'tractor', k: i }))

  // Garage upgrades show on every vehicle.
  function garage() {
    for (const t of trucks) t.setLevel({ bed: game.garageLevel('cargo'), engine: game.garageLevel('truckEngine') })
    for (const t of tractors) t.setLevel({ header: game.garageLevel('header'), engine: game.garageLevel('engine') })
  }
  garage()
  game.on('garage', (g) => {
    garage()
    const list = g.id === 'cargo' || g.id === 'truckEngine' ? trucks : g.id === 'header' || g.id === 'engine' ? tractors : []
    for (const t of list) {
      if (!t.g.visible) continue
      particles?.burst(t.g.position.x, 2.5, t.g.position.z, { n: 30, colors: ['#ffd23a', '#ffffff', '#3aa8ff'], speed: 3, up: 5, gravity: -7, life: 1.2, size: 0.35 })
      particles?.ring(t.g.position.x, t.g.position.z, 3.5, '#d9cdb4', 20)
    }
  })
  game.on('reset', garage)
  function refresh() {
    const nt = game.vehicleCount(tractorDef)
    tractors.forEach((t, i) => (t.g.visible = i < nt))
    const nk = game.vehicleCount(truckDef)
    trucks.forEach((t, i) => (t.g.visible = i < nk))
  }
  refresh()
  game.on('vehicle', (v) => {
    refresh()
    // A new vehicle rolls in with a ring of dust and confetti.
    const list = v.id === 'tractors' ? tractors : trucks
    const t = list[game.vehicleCount(v) - 1]
    if (t) {
      particles?.ring(t.g.position.x, t.g.position.z, 3, '#d9cdb4', 24)
      particles?.confetti(t.g.position.x, 3, t.g.position.z, 40)
    }
  })

  // Everything back in its slot (reset, or a trip that is no longer running).
  function park(v, yaw = Math.PI) {
    v.m.all = null
    v.m.moving = false
    v.trip = null
    v.g.position.set(v.home[0], v.m.yAt(v.home[0], v.home[1]), v.home[1])
    v.g.rotation.y = yaw
    v.g.visible = true
    if (v.seat) v.seat.group.visible = false
    v.rig.s = null
  }
  const atHome = (v) => Math.hypot(v.g.position.x - v.home[0], v.g.position.z - v.home[1]) < 0.5
  game.on('reset', () => {
    for (const v of [...tractors, ...trucks]) park(v)
    refresh()
  })

  // --- Trips -------------------------------------------------------------------------------------------------------
  const W = FARM.west
  const pathZ = (FARM.path.minZ + FARM.path.maxZ) / 2
  const rowTrackZ = W.maxZ - (W.maxZ - W.minZ - W.gap) / 2 - W.gap / 2
  function tractorRoute(t, p) {
    const c = p.crops
    const cx = (c.minX + c.maxX) / 2
    // Two passes west of the plot's middle: clear of the upgrade pads on the headland's east half.
    const a = cx - 4.6
    const b = cx - 0.4
    const backRow = Math.floor(p.i / W.cols) > 0
    const gx = p.rect.maxX + W.gap / 2 // the track east of the plot's column
    const toPlot = backRow ? [[gx, pathZ], [gx, rowTrackZ], [a, rowTrackZ]] : [[a, pathZ]]
    const out = [[t.home[0], pathZ], ...toPlot, [a, c.maxZ], [a, c.minZ + 1.2], [b, c.minZ + 1.2], [b, c.maxZ + 1]]
    const home = backRow ? [[b, rowTrackZ], [gx, rowTrackZ], [gx, pathZ]] : [[b, pathZ]]
    const back = [...home, [t.home[0], pathZ], [t.home[0], t.home[1]]]
    return { out, back }
  }
  const lane = VP.laneZ
  const roadIn = FARM.road.z - 3 // westbound lane, back home
  const roadOut = FARM.road.z + 3 // eastbound lane, out to the market
  const gate = (FARM.driveway.minX + FARM.driveway.maxX) / 2
  const far = FARM.townMarket.x - 6 // the town market, east along the road
  const Y = 3 // yard segments are driven 3x slower than the road
  function truckRoute(t) {
    const x = t.home[0]
    return {
      out: [[x, lane, Y], [gate + 2.5, lane, Y], [gate, lane + 2.3, Y], [gate, roadOut - 2.5, Y], [gate + 2.5, roadOut, Y], [far, roadOut, 1]],
      // A U-turn in front of the market, then home along the westbound lane.
      back: [[far + 6, roadOut - 1, Y], [far + 8, FARM.road.z, Y], [far + 5, roadIn, Y], [gate + 2.5, roadIn, 1], [gate, roadIn - 2.5, Y], [gate, lane + 2.3, Y], [gate + 2.5, lane, Y], [x - 3, lane, Y], [x, lane - 2.2, Y], [x, t.home[1], Y]],
    }
  }
  game.on('dispatch', (trip) => {
    if (trip.w.id === 'tractor') {
      const t = tractors[trip.k]
      if (!t || !t.g.visible || t.ridden) return
      if (!atHome(t)) park(t) // left out in a field by the player: back in its slot first
      const r = tractorRoute(t, trip.p)
      t.trip = trip
      t.seat.group.visible = true
      drive(t.m, r.out, trip.out, {
        reverseFirst: true,
        onEnd: () => drive(t.m, r.back, trip.back, { onEnd: () => park(t) }),
      })
    } else if (trip.w.id === 'driver') {
      const t = trucks[trip.k]
      if (!t || !t.g.visible || t.ridden) return
      if (!atHome(t)) park(t)
      const r = truckRoute(t)
      t.trip = trip
      t.seat.group.visible = true
      showCrates(t, game.count(trip.load))
      drive(t.m, r.out, trip.out, {
        reverseFirst: true,
        onEnd: () => {
          // Sold at the market: turn round and come back empty.
          showCrates(t, 0)
          particles?.coins(t.g.position.x, 3.5, t.g.position.z, 12)
          drive(t.m, r.back, trip.back, { onEnd: () => park(t) })
        },
      })
    }
  })

  // Crates on a truck's bed show how full it is (n goods of the truck's cargo).
  function showCrates(t, n) {
    t.setLoad(n / game.truckCargoMax())
  }

  // --- Per frame --------------------------------------------------------------------------------------------------------
  return {
    tractors,
    trucks,
    showCrates,
    // Whether vehicle k of a kind ('tractor' | 'driver') is away from its slot (its driver goes with it).
    out: (kind, k) => {
      const v = kind === 'tractor' ? tractors[k] : trucks[k]
      return !!v && (v.m.moving || !!v.ridden || !atHome(v))
    },
    // The player takes a vehicle (it stops whatever it was doing) / leaves it where it stands.
    take(v) {
      v.m.all = null
      v.m.moving = false
      v.ridden = true
      if (v.seat) v.seat.group.visible = false
    },
    leave(v) {
      v.ridden = false
    },
    update(dt, t) {
      for (const v of tractors) {
        if (!v.g.visible) continue
        if (!v.ridden) step(v.m, dt)
        updateRig(v.rig, dt, t, { particles })
        // The header's reel turns while the tractor rolls; chaff flies when it sweeps a ripe field.
        const sp = Math.abs(v.rig.speed ?? 0)
        if (v.header.visible) v.reel.rotation.x -= dt * (1 + sp * 1.4)
        const inField = sp > 1 && game.PLOTS.some((p) => game.plotOwned(p) && inRect(v.g.position.x, v.g.position.z, p.crops))
        if (inField) {
          v.chaffT -= dt
          if (v.chaffT <= 0) {
            v.chaffT = 0.06
            const s = Math.sin(v.g.rotation.y)
            const c = Math.cos(v.g.rotation.y)
            const off = v.header.visible ? 3.6 : 1.8
            particles?.burst(v.g.position.x + s * off + c * (Math.random() - 0.5) * 3, 1.2, v.g.position.z + c * off - s * (Math.random() - 0.5) * 3, { n: 3, colors: ['#e8c25a', '#f1d27a', '#c9a24a'], speed: 1.6, up: 3, gravity: -6, life: 0.9, size: 0.16, additive: false })
          }
        }
      }
      for (const v of trucks) {
        if (!v.g.visible) continue
        if (!v.ridden) step(v.m, dt)
        updateRig(v.rig, dt, t, { particles })
      }
    },
  }
}
