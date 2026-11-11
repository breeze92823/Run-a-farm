import { COARSE_POINTER, FARM, GAME, parkAt } from '../config.js'
import * as game from '../game.js'
import * as proc from '../econ/processing.js'
import * as care from '../econ/care.js'
import * as fleet from '../econ/fleet.js'
import * as prog from '../econ/progress.js'
import { restY } from '../farm/ground.js'

// A glowing marker pad on every E spot that opens a window where things are
// bought or upgraded (oil field, drone base, barns, processing, office, dealer,
// seed market, workshop, fuel), so the player can find them. Its card shows the
// cheapest thing for sale in that window: GREEN when the player can afford it,
// RED when not, BLUE when there is nothing to buy (info boards, all maxed).
// Positions match the interaction targets in hud.js / hud2.js.

const cheapest = (list) => {
  let m = null
  for (const v of list) if (v != null && (m == null || v < m)) m = v
  return m
}

// The vehicles with engines (workshop / fuel station), like menus2.js vehicleList.
function engines() {
  const out = []
  const tr = GAME.vehicles.find((v) => v.id === 'tractors')
  const tk = GAME.vehicles.find((v) => v.id === 'trucks')
  for (let k = 0; k < game.vehicleCount(tk); k++) out.push(['truck', k])
  for (let k = 0; k < game.vehicleCount(tr); k++) out.push(['tractor', k])
  for (const id of ['combine', 'sprayer']) if (fleet.owns(id)) out.push([id, 0])
  return out
}

// --- What each window sells (the price of everything buyable right now) ------------------------------------
function seedPrices() {
  return GAME.seeds.map((s, i) => (game.state.seeds[i]?.unlocked ? s.packPrice : s.unlock))
}
function dealerPrices() {
  const out = []
  for (const v of GAME.vehicles) if (game.built(v.needs) && game.vehicleCount(v) < v.max) out.push(game.vehiclePrice(v))
  for (const g of GAME.garage) if ((!g.needs || game.built(g.needs)) && game.garageLevel(g.id) < g.max) out.push(game.garagePrice(g))
  for (const f of GAME.fleet) if ((!f.needs || game.built(f.needs)) && !fleet.owns(f.id)) out.push(f.price)
  return out
}
function dronePrices() {
  const D = GAME.drones
  const n = game.state.drones.n
  const out = []
  for (let k = 0; k < n; k++) {
    if ((game.state.drones.cap[k] ?? 0) < D.capMax) out.push(game.droneCapPrice(k))
    if (game.droneSpeedLevel(k) < D.speedMax) out.push(game.droneSpeedPrice(k))
  }
  if (n < D.max) out.push(game.dronePrice())
  return out
}
function oilPrices() {
  const st = game.state.oil
  const out = []
  for (let i = 0; i < st.pumps; i++) for (const u of GAME.oil.upgrades) if (game.pumpLevel(i, u.id) < u.max) out.push(game.pumpUpPrice(i, u))
  if (st.pumps < GAME.oil.pumps) out.push(game.pumpPrice())
  for (const u of [GAME.oil.tankUp, GAME.oil.crane, GAME.oil.refine]) {
    if (u.id === 'crane' && !game.built('railStation')) continue
    if (game.oilLevel(u.id) < u.max) out.push(game.oilUpPrice(u))
  }
  return out
}
function ranchPrices(r) {
  const s = game.ranchState(r)
  if (!s) return []
  const out = []
  if (s.n < r.max) out.push(game.ranchAddPrice(r))
  if (s.feed < GAME.feed.max) out.push(game.ranchFeedPrice(r))
  if ((s.expand ?? 0) < GAME.expand.max) out.push(game.ranchExpandPrice(r))
  const c = care.careState(r)
  if (c && !c.feeder) out.push(care.feederPrice(r))
  return out
}
function officePrices() {
  const out = []
  for (const w of GAME.workers) if (game.hired(w) < game.workerCap(w)) out.push(game.hirePrice(w))
  for (const c of GAME.crew) if (game.crewLevel(c.id) < c.max) out.push(game.crewPrice(c))
  for (const m of GAME.managers) if (!prog.managerState(m.id).hired) out.push(m.price)
  return out
}
function procPrices(id) {
  const s = proc.procState(id)
  if (!s) return []
  const U = GAME.procUp
  const out = []
  if (s.speed < U.speed.max) out.push(proc.upPrice(id, 'speed'))
  if (s.cap < U.cap.max) out.push(proc.upPrice(id, 'cap'))
  if (!s.worker) out.push(proc.workerPrice(id))
  return out
}
const repairPrices = () => engines().filter(([k, i]) => fleet.wearOf(k, i) >= 0.01).map(([k, i]) => fleet.repairCost(k, i))
const fuelPrices = () => engines().map(([k, i]) => fleet.refuelCost(k, i)).filter((c) => c.need >= 0.5).map((c) => c.cash)

// --- The spots ------------------------------------------------------------------------------------------------
function spotList(farm) {
  const S = []
  const add = (name, perk, at, shown, prices, empty = 'ALL UPGRADED') => S.push({ name, perk, at, shown, prices, empty })
  add('Seed Market', 'Buy and unlock seeds', () => [FARM.seedStall.x, FARM.seedStall.z + 2.6], () => game.built('seedMarket'), seedPrices)
  add('Vehicle Dealer', 'Vehicles and garage', () => [farm.town.desk.x, farm.town.desk.z], () => true, dealerPrices)
  add('Drone Base', 'Drones and upgrades', () => farm.drones.console, () => game.built('droneBase'), dronePrices)
  add('Oil Field', 'Pumps and upgrades', () => [farm.oil.tankAt[0], farm.oil.tankAt[1] + 5], () => game.built('oilField'), oilPrices)
  for (const sp of farm.ranch.spots) {
    // Beside the crate (still inside the barn's E reach), or by the shearing station.
    const at = sp.r.hold ? [sp.x + 2.6, sp.z] : [sp.x, sp.z + 1.6]
    add(sp.r.name, 'Animals and upgrades', () => at, () => game.built(sp.r.id), () => ranchPrices(sp.r))
  }
  add('Farm Office', 'Hire workers', () => [FARM.office.x, FARM.office.z], () => game.built('office'), officePrices, 'ALL HIRED')
  for (const def of GAME.proc) add(def.name, 'Upgrades and workers', () => parkAt(FARM.proc[def.id], 0, -9), () => game.built(def.id), () => procPrices(def.id))
  add('Workshop', 'Repair vehicles', () => parkAt(FARM.workshop, 0, -7), () => game.built('workshop'), repairPrices, 'ALL REPAIRED')
  add('Fuel Station', 'Refuel vehicles', () => [FARM.fuelStation.x, FARM.fuelStation.z], () => game.built('fuelStation'), fuelPrices, 'ALL FULL')
  add('Helipad', 'Cargo flights', () => parkAt(FARM.helipad, 0, -7), () => game.built('helipad'), () => [], 'PRESS E')
  add('Contracts', 'Town board', () => [FARM.contractBoard.x, FARM.contractBoard.z + 1.5], () => true, () => [], 'PRESS E')
  add('Market Prices', 'Town board', () => [FARM.priceBoard.x, FARM.priceBoard.z], () => true, () => [], 'PRESS E')
  return S
}

const KIND = COARSE_POINTER ? 'STEP ON + TAP' : 'PRESS E'

export function createSpots(farm) {
  const spots = spotList(farm).map((s) => ({ ...s, pad: farm.pads.marker({ x: 0, z: 0, kind: KIND, name: s.name, perk: s.perk, price: null, note: s.empty, tone: 'blue' }), key: '' }))
  let t = 0
  const hits = []
  return {
    // A click ray on a shown marker the player stands within reach of.
    hit(ray, pos) {
      for (const s of spots) {
        const m = s.pad
        if (!m.disc.visible || Math.hypot(pos.x - m.x, pos.z - m.z) > 5) continue
        hits.length = 0
        ray.intersectObjects([m.disc, m.rim, m.label], false, hits)
        if (hits.length) return true
      }
      return false
    },
    // Every half second: show / hide, place on the ground, and recolour by what the wallet affords.
    update(dt) {
      t -= dt
      if (t > 0) return
      t = 0.5
      const money = game.state.money
      for (const s of spots) {
        const show = s.shown()
        if (s.pad.disc.visible !== show) s.pad.setVisible(show)
        if (!show) continue
        // On the floor / porch under the spot (cast from low down, so a roof above isn't
        // taken for it); every refresh, as a building rises out of the ground once bought.
        const [x, z] = s.at()
        s.pad.place(x, restY(x, z, 1.5), z)
        const p = cheapest(s.prices())
        const tone = p == null ? 'blue' : p <= money ? 'green' : 'red'
        const key = `${tone}|${p}`
        if (key === s.key) continue
        s.key = key
        Object.assign(s.pad, { tone, price: p })
        s.pad.repaint()
      }
    },
  }
}
