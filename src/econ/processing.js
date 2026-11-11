import { FARM, GAME, parkAt } from '../config.js'
import * as game from '../game.js'

// Processing buildings (roadmap 2.1): the Flour Mill, Bakery, Dairy, Juice
// Press and Oil Refinery in the Processing Park west of the plot. Each one
// takes its inputs from storage (the refinery from the oil tank), runs a
// timed cycle of the best paying recipe it has inputs for, and drops the
// output in its crate out front. Walk past the crate to collect it into the
// bag, or hire the building's worker (Miller, Baker, ...): it runs the
// machine 50% faster and carries the crate to storage. Upgrades: Faster
// Machines (speed) and Bigger Batches (more per cycle, a bigger crate).
// farm/processing.js animates the machines while `running(id)` is true.

const U = GAME.procUp
export const procDef = (id) => GAME.proc.find((p) => p.id === id)
export const procState = (id) => (game.built(id) ? (game.state.proc[id] ??= { speed: 0, cap: 0, worker: 0, crate: {}, job: null, carryT: 0 }) : null)
const building = (id) => game.buildingById(id)
export const batch = (s) => 1 + s.cap
export const crateMax = (def, s) => Math.round(def.crate * (1 + s.cap * 0.5))
export const speedK = (s) => (1 + s.speed * U.speed.step) * (s.worker ? U.worker.speed : 1)
export const cycleTime = (def, s) => def.every / speedK(s)
export const running = (id) => !!game.state.proc[id]?.job
export const crateCount = (id) => game.count(game.state.proc[id]?.crate ?? {})

const avail = (good) => (good === 'crude' ? Math.floor(game.state.oil.tank) : game.state.storage.items[good] ?? 0)
function takeInput(good, n) {
  if (good === 'crude') game.state.oil.tank -= n
  else game.take(game.state.storage.items, good, n)
}
// How many cycles' worth (up to the batch) a recipe can run right now.
export function canRun(rc, k) {
  let n = k
  for (const g in rc.in) n = Math.min(n, Math.floor(avail(g) / rc.in[g]))
  return n
}
export function inputsText(rc) {
  return Object.keys(rc.in)
    .map((g) => `${rc.in[g]} ${g === 'crude' ? 'crude oil' : GAME.goods[g].name.toLowerCase()}`)
    .join(' + ')
}

// --- Buying ------------------------------------------------------------------------------------------
const round50 = (n) => Math.round(n / 50) * 50
export const upPrice = (id, key) => round50(building(id).price * U[key].price * Math.pow(U[key].growth, procState(id)?.[key] ?? 0))
export const workerPrice = (id) => round50(building(id).price * U.worker.price)
export function buyProcUp(id, key) {
  const s = procState(id)
  const u = U[key]
  if (!s || s[key] >= u.max) return false
  if (!game.spend(upPrice(id, key), `${u.name} (${procDef(id).name})`)) return false
  s[key]++
  game.changed()
  game.emit('toast', { text: `${procDef(id).name} ${u.name} level ${s[key]}! ${u.perk}`, kind: 'good' })
  game.emit('buy', { big: true })
  game.emit('procUp', { id, key })
  return true
}
export function hireProc(id) {
  const s = procState(id)
  if (!s || s.worker) return false
  const def = procDef(id)
  if (!game.spend(workerPrice(id), def.worker)) return false
  s.worker = 1
  game.changed()
  game.emit('toast', { text: `Hired a ${def.worker}! The ${def.name} runs faster and its crate goes to storage`, kind: 'good' })
  game.emit('buy', { big: true })
  game.emit('procUp', { id, key: 'worker' })
  return true
}

// --- Collecting -------------------------------------------------------------------------------------
// The player empties a crate into the bag; the worker into storage.
export function collectCrate(id, by) {
  const s = procState(id)
  if (!s || !game.count(s.crate)) return 0
  const box = by === 'player' ? game.state.bag : game.built('storage') ? game.state.storage : null
  if (!box) return 0
  const n = game.move(s.crate, box, game.count(s.crate))
  if (!n) {
    if (by === 'player' && !s.fullWarned) {
      s.fullWarned = true
      game.emit('toast', { text: 'Your bag is full! Unload it at the storage yard', kind: 'warn' })
      game.emit('deny', {})
    }
    return 0
  }
  s.fullWarned = false
  game.changed()
  game.emit('procCollect', { id, n, by })
  if (by === 'player') game.emit('toast', { text: `+${n} from the ${procDef(id).name}`, kind: 'good' })
  return n
}

// --- Simulation -------------------------------------------------------------------------------------
let zoneT = 0
export function tickProcessing(dt, player) {
  for (const def of GAME.proc) {
    const s = procState(def.id)
    if (!s) continue
    // Start a cycle: the best paying recipe the inputs allow.
    if (!s.job && game.count(s.crate) < crateMax(def, s)) {
      let best = null
      let bestV = 0
      for (const rc of def.recipes) {
        const k = canRun(rc, batch(s))
        if (k <= 0) continue
        const v = GAME.goods[rc.out].market * rc.n * k
        if (v > bestV) {
          best = { rc, k }
          bestV = v
        }
      }
      if (best) {
        for (const g in best.rc.in) takeInput(g, best.rc.in[g] * best.k)
        s.job = { out: best.rc.out, n: best.rc.n * best.k, t: 0 }
        game.changed()
        game.emit('procStart', { id: def.id })
      } else if (!s.idleWarned && game.count(s.crate) === 0) {
        s.idleWarned = true
        game.emit('procIdle', { id: def.id })
      }
    }
    if (s.job) {
      s.idleWarned = false
      s.job.t += dt * speedK(s)
      if (s.job.t >= def.every) {
        const { out, n } = s.job
        s.job = null
        s.crate[out] = (s.crate[out] ?? 0) + n
        game.state.life[`p_${out}`] = (game.state.life[`p_${out}`] ?? 0) + n
        game.changed()
        game.emit('processed', { id: def.id, good: out, n })
      }
    }
    // The worker carries the crate to storage.
    if (s.worker) {
      s.carryT += dt
      if (s.carryT >= U.worker.every) {
        s.carryT = 0
        collectCrate(def.id, 'worker')
      }
    }
  }
  // Walking past a crate collects it (checked a few times a second).
  zoneT -= dt
  if (zoneT > 0) return
  zoneT = 0.4
  for (const def of GAME.proc) {
    const s = game.state.proc[def.id]
    if (!s || !game.count(s.crate) || !game.built(def.id)) continue
    const [cx, cz] = crateSpot(def.id)
    if (Math.hypot(player.x - cx, player.z - cz) < 3) collectCrate(def.id, 'player')
  }
}
// Where each building's crate stands (set by farm/processing.js from its model; a default before).
const spots = {}
export const crateSpot = (id) => spots[id] ?? parkAt(FARM.proc[id], 5, -9)
export const setCrateSpot = (id, x, z) => (spots[id] = [x, z])
