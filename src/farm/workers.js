import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { idle, makeNPC, makeWalker, updateWalker } from './npc.js'

// The people hired at the Farm Office, walking their jobs (their actual work
// runs on timers in game.js; these are what the player sees):
//  - stockers walk the coop nests and carry trays to the farm stand
//  - field hands walk up and down the rows of the field they work
//  - tractor drivers wait by their tractor in the Tractor Park, delivery
//    drivers by their truck in the Vehicle Park; while the vehicle is out on a
//    trip (parks.js) they are in it, so they leave their spot
// They are added and removed as the hire counts change.

// Stocker trip points: the stand counter, the yard walk, and a stop by each built coop's nest
// (nearest coop first). Waypoints carry a 0 pause so the stocker walks straight past them.
const standSpot = (j) => [-17 + j, 23.8]
const yardWay = (j) => [[-11.5 + j, 19, 0], [-11.5 + j, 8, 0]]
const nestStops = (j) =>
  FARM.coops
    .filter((c) => game.built(`coop${c.n}`))
    .sort((a, b) => b.x - a.x)
    .map((c) => ({ n: c.n, p: [c.x + 1.3 + j, c.z + 1.6 + j] }))

function route(w, k) {
  const j = (k % 3) * 0.7 // side by side, not on top of each other
  if (w.id === 'stocker') return { path: [standSpot(j)], opts: { speed: 2.6, pause: 1.4 }, stocker: j }
  if (w.id === 'hand') {
    const p = game.PLOTS.find((q) => q.n === game.state.plots.owned[k])
    if (!p) return null
    const c = p.crops
    const x = c.minX + 2 + ((c.maxX - c.minX - 4) * ((k * 0.37) % 1))
    return { path: [[x, c.maxZ + 1.5], [x, c.minZ + 1.2], [x + FARM.fieldRow, c.minZ + 1.2], [x + FARM.fieldRow, c.maxZ + 1.5]], opts: { speed: 1.8, pause: 2.5 } }
  }
  if (w.id === 'rancher') {
    // Back and forth between its barn's crate and the barn.
    const r = game.ranchBuilt()[k]
    if (!r) return null
    const [cx, cz] = FARM.ranchCrates[r.id]
    const b = r.id === 'stables' ? FARM.stables : FARM[r.id]
    const bz = b.z + (r.id === 'stables' ? 6.5 : r.id === 'duckHouse' ? 3 : 6)
    return { path: [[cx + 1.6, cz - 1.2], [cx + 1.6, cz - 6], [b.x + 2, bz]], opts: { speed: 1.6, pause: 3, pingPong: true }, key: r.id }
  }
  if (w.id === 'oiler') {
    const [x, z] = FARM.oil.pumps[k] ?? [0, 0]
    return { spot: [x - 4.2, z + 2.8], opts: {}, key: `pump${k}` }
  }
  // Drivers: beside their vehicle's slot, facing the way out.
  const P = w.id === 'tractor' ? FARM.tractorPark : FARM.vehiclePark
  const n = GAME.vehicles.find((v) => v.id === w.cap).max
  const sx = P.minX + ((P.maxX - P.minX) / n) * (k + 1) // on the line between slot k and the next
  return { spot: [sx, P.slotZ + (w.id === 'tractor' ? 0.8 : 1.2)], opts: {} }
}

export function buildWorkers(root, { parks } = {}) {
  const crews = new Map(GAME.workers.map((w) => [w.id, []])) // id -> [{ n, walker, spot, plot }]

  function sync() {
    for (const w of GAME.workers) {
      const list = crews.get(w.id)
      const want = game.hired(w)
      // Field hands follow their plot: rebuild them if the plot they work changed.
      for (const [k, m] of list.entries()) {
        if (m && w.id === 'rancher' && m.key !== game.ranchBuilt()[k]?.id) {
          root.remove(m.n.group)
          list[k] = null
        }
        if (m && w.id === 'hand' && m.plot !== game.state.plots.owned[k]) {
          root.remove(m.n.group)
          list[k] = null
        }
      }
      for (let k = list.length - 1; k >= 0; k--) {
        if (k >= want) {
          if (list[k]) root.remove(list[k].n.group)
          list.splice(k, 1)
        }
      }
      for (let k = 0; k < want; k++) {
        if (list[k]) continue
        const r = route(w, k)
        if (!r) {
          list[k] = null
          continue
        }
        const n = makeNPC({ ...w.look, scale: 0.84 })
        root.add(n.group)
        const m = { n, plot: game.state.plots.owned[k], kind: w.id, k, key: r.key }
        if (r.path) m.walker = makeWalker(n, r.path, r.opts)
        else {
          m.spot = r.spot
          n.group.position.set(r.spot[0], 0, r.spot[1])
          n.group.rotation.y = w.id === 'oiler' ? Math.PI * 0.75 : 0 // drivers face south, the way the vehicles drive out
        }
        m.base = r.opts.speed ?? 0
        if (r.stocker != null) Object.assign(m, { j: r.stocker, leg: 'home', carry: 0, stops: [], s: 0 })
        list[k] = m
      }
    }
  }
  sync()
  for (const e of ['hire', 'plot', 'reset', 'build', 'pump']) game.on(e, sync)
  game.on('reset', () => {
    for (const m of crews.get('stocker')) if (m) m.carry = 0
  })

  // A stocker has finished the pause at the end of its leg: act there, then set off on the next leg.
  // Eggs leave a nest only when the stocker stands at it and reach the stand only when it is back.
  const stocker = game.workerById('stocker')
  function stockerNext(m) {
    const wk = m.walker
    const here = wk.pts[wk.i]
    const cap = game.workerCarry(stocker)
    const go = (pts) => {
      wk.pts = [[here[0], here[1]], ...pts]
      wk.i = 0
    }
    if (m.leg === 'home') {
      if (m.carry > 0) m.carry -= game.stockerDrop(stocker, m.k, m.carry)
      m.stops = nestStops(m.j)
      if (m.carry >= cap || !m.stops.length) {
        wk.wait = 2 // the stand is full (or no coop to visit): wait at it and try again
        return
      }
      m.leg = 'out'
      m.s = 0
      go([...yardWay(m.j), m.stops[0].p])
      return
    }
    // At nest stop m.s.
    const stop = m.stops[m.s]
    if (stop) m.carry += game.stockerPick(stop.n, cap - m.carry)
    if (m.carry < cap && m.s + 1 < m.stops.length) {
      m.s++
      go([m.stops[m.s].p])
      return
    }
    // Full (or every nest visited): back past the nests already visited, up the yard walk, to the stand.
    m.leg = 'home'
    const back = m.stops.slice(0, m.s).reverse().map((x) => [x.p[0], x.p[1], 0])
    go([...back, ...yardWay(m.j).reverse(), standSpot(m.j)])
  }

  return {
    crews,
    update(dt, t) {
      const speed = game.crewSpeed()
      for (const list of crews.values()) {
        for (const m of list) {
          if (!m) continue
          if (m.walker) {
            m.walker.speed = m.base * speed
            if (m.leg && m.walker.i === m.walker.pts.length - 1 && m.walker.wait <= 0) stockerNext(m)
            if (m.n.load) m.n.load.visible = !m.leg || m.carry > 0
            updateWalker(m.walker, t, dt)
          } else {
            m.n.group.visible = m.kind === 'oiler' || !parks?.out(m.kind, m.k)
            if (m.n.group.visible) idle(m.n, t, dt)
          }
        }
      }
    },
  }
}
