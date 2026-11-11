import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { mount } from '../mount.js'
import { clock } from './clock.js'

// Vehicles and machines (roadmap phase 5):
//  - new vehicles at the dealer: the Combine Harvester (the one parked at the
//    barn becomes drivable; one pass harvests a whole field with a bonus), the
//    Crop Sprayer (drive over growing fields: 2x growth for a minute), the Milk
//    Tanker (runs milk from storage to town on its own), the Livestock Trailer
//    (sell animals from the barns) and the Cargo Helicopter (flies big loads
//    to the city from the helipad)
//  - fuel and wear for everything with an engine the player drives: the HUD
//    shows both while riding; refuel at the Fuel Station (refinery Fuel in
//    storage fills it for free), repair at the Workshop; an empty tank crawls,
//    a worn engine is slower and smokes more
//  - looks: paint, rims, a light bar and a horn per vehicle kind (dealer)
//  - the Car Wash: drive through it for a speed boost

const F = GAME.fuel
const st = () => game.state.fleet
export const fleetDef = (id) => GAME.fleet.find((f) => f.id === id)
export const owns = (id) => !!st().own[id]
export const FUELLED = new Set(['truck', 'tractor', 'combine', 'sprayer'])
const key = (kind, k = 0) => `${kind}:${k}`
export const fuelOf = (kind, k) => st().fuel[key(kind, k)] ?? F.tank
export const wearOf = (kind, k) => st().wear[key(kind, k)] ?? 0

export function buyFleet(f) {
  if (owns(f.id)) return false
  if (f.needs && !game.built(f.needs)) {
    game.emit('toast', { text: `Build the ${game.buildingById(f.needs).name} first`, kind: 'warn' })
    game.emit('deny', {})
    return false
  }
  if (!game.spend(f.price, f.name)) return false
  st().own[f.id] = 1
  game.changed()
  game.emit('toast', { text: `Bought the ${f.name}! ${f.text}`, kind: 'good' })
  game.emit('buy', { big: true })
  game.emit('fleet', f)
  return true
}

// --- Looks ---------------------------------------------------------------------------------------------
const L = GAME.looks
export const LOOK_KINDS = [
  { id: 'truck', name: 'Trucks', needs: 'truckBay' },
  { id: 'tractor', name: 'Tractors', needs: 'tractorBay' },
  { id: 'bike', name: 'Bike', needs: null },
  { id: 'combine', name: 'Combine', fleet: 'combine' },
  { id: 'sprayer', name: 'Sprayer', fleet: 'sprayer' },
]
export const lookOf = (kind) => (st().looks[kind] ??= { paint: null, rims: null, lightBar: false, horn: 'classic', owned: { paint: [], rims: [], horn: ['classic'] } })
export const lookAvailable = (lk) => (lk.fleet ? owns(lk.fleet) : !lk.needs || game.built(lk.needs))
export function buyLook(kind, field, value) {
  const lk = lookOf(kind)
  lk.owned ??= { paint: [], rims: [], horn: ['classic'] }
  const owned = field === 'lightBar' ? lk.lightBar : (lk.owned[field] ?? []).includes(value)
  if (field !== 'lightBar' && owned) {
    lk[field] = value
  } else {
    const price = field === 'paint' ? L.paintPrice : field === 'rims' ? L.rimPrice : field === 'lightBar' ? (lk.lightBar ? 0 : L.barPrice) : L.horns.find((h) => h.id === value).price
    if (price > 0 && !game.spend(price, 'a new look')) return false
    if (field === 'lightBar') lk.lightBar = !lk.lightBar
    else {
      ;(lk.owned[field] ??= []).push(value)
      lk[field] = value
    }
  }
  game.changed()
  game.emit('look', { kind, field, value })
  game.emit('buy')
  return true
}

// --- Fuel, wear, repairs ---------------------------------------------------------------------------------
export function refuelCost(kind, k) {
  const need = F.tank - fuelOf(kind, k)
  const fromStore = Math.min(game.state.storage.items.fuel ?? 0, Math.ceil(need / F.fuelGood))
  return { need, fromStore, cash: Math.max(0, Math.round((need - fromStore * F.fuelGood) * F.price)) }
}
export function refuel(kind, k) {
  const { need, fromStore, cash } = refuelCost(kind, k)
  if (need < 0.5) {
    game.emit('toast', { text: 'The tank is already full', kind: 'info' })
    return false
  }
  if (cash > 0 && !game.spend(cash, 'fuel')) return false
  if (fromStore) game.take(game.state.storage.items, 'fuel', fromStore)
  st().fuel[key(kind, k)] = F.tank
  game.changed()
  game.emit('refuel', { kind, k })
  game.emit('toast', { text: `Tank full!${fromStore ? ` Used ${fromStore} Fuel from storage` : ''}${cash ? ` (${game.fmtMoney(cash)})` : ''}`, kind: 'good' })
  return true
}
export const repairCost = (kind, k) => Math.round((wearOf(kind, k) * F.repair) / 10) * 10
export function repair(kind, k) {
  const cost = repairCost(kind, k)
  if (cost <= 0) {
    game.emit('toast', { text: 'It runs like new already', kind: 'info' })
    return false
  }
  if (!game.spend(cost, 'repairs')) return false
  st().wear[key(kind, k)] = 0
  game.changed()
  game.emit('repair', { kind, k })
  game.emit('toast', { text: 'Repaired! Good as new', kind: 'good' })
  return true
}
// Speed multiplier for what the player rides right now.
export function rideMul(m) {
  if (!m) return 1
  let k = 1
  if (FUELLED.has(m.kind)) {
    if (fuelOf(m.kind, m.k) <= 0) k *= F.empty
    const w = wearOf(m.kind, m.k)
    if (w > 0.5) k *= 1 - (1 - F.worn) * ((w - 0.5) / 0.5)
  }
  if (m.kind !== 'horse') k *= clock.weather === 'storm' ? GAME.weather.storm.vehicle : 1
  if (st().wash > 0 && m.kind !== 'horse') k *= 1 + GAME.wash.boost
  return k
}

// --- Sprayer: per-plot growth boost ---------------------------------------------------------------------
const spray = {} // plot n -> s left (not saved: it is a minute)
export const sprayed = (p) => (spray[p.n] ?? 0) > 0
const prevGrow = game.mods.grow
game.mods.grow = (p) => prevGrow(p) * (sprayed(p) ? fleetDef('sprayer').boost : 1)

// --- Trailer: sell animals -----------------------------------------------------------------------------
export const animalPrice = (r) => Math.round(r.addPrice * fleetDef('trailer').sell)
export function sellAnimal(r) {
  const s = game.ranchState(r)
  if (!owns('trailer') || !s || s.n <= 1) return false
  s.n--
  if (game.state.care[r.id]?.born) delete game.state.care[r.id].born[s.n]
  game.earn(animalPrice(r), 'animals')
  game.changed()
  game.emit('animalSold', r)
  game.emit('toast', { text: `Sold a ${r.animal} for ${game.fmtMoney(animalPrice(r))}`, kind: 'good' })
  return true
}

// --- Services: the milk tanker and the helicopter run on their own ----------------------------------------
export const runs = { tanker: { t: 20, out: 0, load: null }, heli: { t: 30, out: 0, load: null } }
const TRIP = { tanker: 26, heli: 34 } // s out (the sale happens at the far end) and back
function service(id, dt, goods) {
  const f = fleetDef(id)
  const r = runs[id]
  if (!owns(id) || (id === 'heli' && !game.built('helipad'))) return
  if (r.out > 0) {
    r.out -= dt
    if (r.load && r.out <= TRIP[id] / 2) {
      const n = game.count(r.load)
      const amount = game.sellAtMarket(r.load, f.bonus, id, null)
      r.load = null
      game.emit('serviceSold', { id, n, amount })
    }
    if (r.out <= 0) game.emit('serviceHome', { id })
    return
  }
  r.t -= dt
  if (r.t > 0) return
  r.t = f.every
  const box = { items: {}, max: f.load }
  let n = 0
  if (goods) {
    for (const g of goods) {
      const k = Math.min(game.state.storage.items[g] ?? 0, f.load - n)
      if (k <= 0) continue
      game.take(game.state.storage.items, g, k)
      box.items[g] = (box.items[g] ?? 0) + k
      n += k
    }
  } else n = game.move(game.state.storage.items, box, f.load)
  if (!n) return
  r.load = box.items
  r.out = TRIP[id]
  game.changed()
  game.emit('serviceGo', { id, n })
}

let washZone = false
export function tickFleet(dt, player) {
  const m = mount.active
  const s = st()
  // Fuel and wear while driving.
  if (m && FUELLED.has(m.kind)) {
    const v = Math.hypot(player.vx ?? 0, player.vz ?? 0)
    const km = (v * dt) / 1000
    const k = key(m.kind, m.k)
    const before = s.fuel[k] ?? F.tank
    s.fuel[k] = Math.max(0, before - km * F.perKm)
    s.wear[k] = Math.min(1, (s.wear[k] ?? 0) + km * F.wearPerKm)
    if (before > F.tank * 0.15 && s.fuel[k] <= F.tank * 0.15) game.emit('toast', { text: 'Fuel is low! Refuel at the Fuel Station', kind: 'warn' })
    if (before > 0 && s.fuel[k] <= 0) game.emit('toast', { text: 'Out of fuel! The engine sputters along', kind: 'warn' })
    game.markDirty()
  }
  if (m) m.mul = rideMul(m)
  // Car wash.
  s.wash = Math.max(0, (s.wash ?? 0) - dt)
  const inWash = !!m && m.kind !== 'horse' && game.built('carWash') && player.x > FARM.carWash.zone.minX && player.x < FARM.carWash.zone.maxX && player.z > FARM.carWash.zone.minZ && player.z < FARM.carWash.zone.maxZ
  if (inWash && !washZone) {
    s.wash = GAME.wash.time
    game.emit('wash', { x: player.x, z: player.z })
    game.emit('toast', { text: `Squeaky clean! +${Math.round(GAME.wash.boost * 100)}% speed for ${GAME.wash.time / 60} minutes`, kind: 'good' })
  }
  washZone = inWash
  // Sprayer.
  for (const n in spray) spray[n] = Math.max(0, spray[n] - dt)
  if (m?.kind === 'sprayer') {
    const f = fleetDef('sprayer')
    for (const p of game.PLOTS) {
      if (!game.plotOwned(p) || !game.plotCrop(p) || game.plotGrowth(p) >= 1) continue
      const c = p.crops
      if (player.x > c.minX && player.x < c.maxX && player.z > c.minZ && player.z < c.maxZ) {
        if (!sprayed(p)) game.emit('toast', { text: `Sprayed Field ${p.n}: it grows ${f.boost}x for ${f.boostTime}s`, kind: 'good' })
        spray[p.n] = f.boostTime
        game.emit('spraying', { p })
      }
    }
  }
  service('tanker', dt, ['milk', 'goatMilk'])
  service('heli', dt, null)
}
game.on('reset', () => {
  for (const r of Object.values(runs)) Object.assign(r, { t: 20, out: 0, load: null })
})
