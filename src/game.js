import { DEV_MODE, FARM, GAME, plotCrops, westPlots } from './config.js'

const DEV_MONEY = 1e9 // dev mode: the wallet never runs dry
import { mount, riding } from './mount.js'

// The farm's game state and its economy, shared by the HUD, the windows and the world.
// The player starts with nothing but Coop 1 and the farm stand:
//  - hens lay eggs into each built coop's nest crate; walking past a nest
//    collects them into the bag (up to its size)
//  - walking up to the farm stand restocks it from the bag; customers buy eggs
//    off the stand all the time
//  - the bag (on foot or on the bike) can be sold at the town market east along
//    the road, at market prices (more than the stand pays, no customer limit)
//  - money buys buildings (build pads: coops, the storage barn, bays, the drone
//    base, ranch barns, the oil field, the rail station), fields, seeds, shop
//    upgrades and vehicles at the town's dealer
//  - fields grow the seed planted in them (one seed per crop); walking or
//    driving a tractor into a ripe field harvests it into the bag (or storage)
//  - the storage barn takes the bag's goods when the player walks into its
//    yard; trucks load there and sell in town (the player drives first, then a
//    hired driver), drones fly storage goods to town on their own
//  - Farm Shop Lv2 (Carton Packer) packs stand eggs into cartons; a van comes
//    by and buys them for more than loose eggs
//  - ranch barns (ducks, cows, pigs, horses) fill a crate the player or a
//    rancher collects; pump jacks (each needs an oil worker) fill the oil tank
//    and the train buys the oil when it stops at the rail station
// Progress is kept in localStorage (a per-viewer convenience; it is fine if it
// is missing or blocked).

const KEY = 'run-a-farm.save.v2'

const fresh = () => ({
  money: GAME.startMoney,
  bag: { items: {}, max: GAME.bag },
  stand: { eggs: 0, max: GAME.stand },
  storage: { items: {}, max: GAME.storage },
  trucks: [], // per truck: { items } (cargo)
  cartons: 0,
  eggPrice: GAME.eggPrice,
  customersPerMin: GAME.customersPerMin,
  seeds: GAME.seeds.map((s, i) => ({ id: s.id, count: 0, unlocked: i === 0 })), // no free seeds: buy them at the Seed Market
  selected: 0,
  upgrades: {}, // shop item id -> level
  hens: {}, // coop number -> hens in it (default 1)
  pads: [], // names of bought decor pads
  built: [], // building ids
  plots: { owned: [], up: {}, grow: {}, crop: {}, picked: {} }, // owned plot numbers; plot -> upgrades; plot -> 0..1; plot -> seed id | null; plot -> picked plant indices
  workers: {}, // worker id -> hired
  vehicles: {}, // vehicle id -> bought
  garage: {}, // garage upgrade id -> level
  crew: {}, // crew upgrade id -> level
  drones: { n: 0, cap: [], speed: [] }, // drones bought, capacity / speed level per drone
  oil: { pumps: 0, up: [], tank: 0, crane: 0, tankUp: 0, sold: 0 },
  ranch: {}, // building id -> { n, feed, crate, t }
  weight: 225,
  eventEnds: Date.now() + GAME.eventLength,
  stats: { collected: 0, sold: 0, earned: 0 },
  quests: { day: today(), claimed: [] },
  // Roadmap systems (econ/*.js) keep their state here so a reset clears it.
  life: {}, // lifetime counters (achievements)
  proc: {}, // processing building id -> { speed, cap, worker, crate: { good: n }, t }
  contracts: { list: [], next: 0, done: 0 },
  clock: null, // econ/clock.js: { t, day, weather, wt }
  care: {}, // ranch building id -> { food, water, feeder, born: { index: ms } }
  xp: { xp: 0, level: 1 },
  ach: [], // achievement ids unlocked
  tutorial: { step: 0, done: false },
  fleet: { own: {}, fuel: {}, wear: {}, wash: 0, looks: {} },
  managers: {}, // id -> { hired, budget }
  course: { best: 0 },
  prestige: { n: 0, boost: 0, keep: {} },
})

const STAND_ITEM = GAME.shop.find((i) => i.id === 'stand')
// Eggs the farm stand holds at Bigger Stand level `lv`.
export function standCap(lv = state.upgrades.stand ?? 0) {
  return STAND_ITEM.caps[Math.max(0, Math.min(STAND_ITEM.caps.length - 1, lv))]
}
export const standStage = (lv) => STAND_ITEM.stages[Math.max(0, Math.min(STAND_ITEM.stages.length - 1, lv))]

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Merges a saved state (parsed JSON) over a fresh one, so new fields get defaults.
function merge(saved) {
  const base = fresh()
  const s = { ...base, ...saved }
  for (const k of ['bag', 'stand', 'storage', 'plots', 'drones', 'oil', 'contracts', 'xp', 'tutorial', 'fleet', 'course', 'prestige']) s[k] = { ...base[k], ...s[k] }
  // The stand's space follows its Bigger Stand level (older saves added a flat step).
  s.stand.max = standCap(s.upgrades?.stand ?? 0)
  s.stand.eggs = Math.min(s.stand.eggs, s.stand.max)
  // Saves from before the Farm Office had to be built keep it if they already hired someone.
  if (!s.built.includes('office') && Object.values(s.workers ?? {}).some((n) => n > 0)) s.built = [...s.built, 'office']
  if (s.quests?.day !== today()) {
    s.quests = { day: today(), claimed: [] }
    s.stats = { collected: 0, sold: 0, earned: 0 }
  }
  return s
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? merge(JSON.parse(raw)) : fresh()
  } catch {
    return fresh()
  }
}

export const state = load()

// --- Events --------------------------------------------------------------------------
const listeners = new Map()
export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(fn)
  return () => listeners.get(type).delete(fn)
}
export function emit(type, data) {
  for (const fn of listeners.get(type) ?? []) {
    try {
      fn(data)
    } catch (e) {
      console.warn('[game]', e)
    }
  }
}

// Hooks the roadmap systems (econ/*.js) fill in; the defaults change nothing.
export const mods = {
  price: () => 1, // (good) market price multiplier (econ/prices.js)
  lay: () => 1, // hens' laying speed (night)
  customers: () => 1, // stand customers (night, season)
  grow: () => 1, // (plot) crop growth speed (rain, season, sprayer)
  ranch: () => 1, // (barn) ranch production (happiness)
  boost: () => 0, // extra money boost (prestige)
  drone: () => 1, // drone flight speed (wind)
  level: () => 1, // farm level (econ/progress.js)
  seedPack: () => 1, // seeds per pack (spring)
  deliver: null, // (items, at): takes contract goods out of `items` before a market sale
}

let dirty = false
export const markDirty = () => (dirty = true)
export function changed() {
  dirty = true
  emit('change', state)
}
// net.js registers this to push the save to the game server (the account's save).
let saveHook = null
export const onSave = (fn) => (saveHook = fn)
export const serialize = () => JSON.stringify(state)
// Replaces the state with a save from the server (a JSON string) and refreshes everything.
export function hydrate(json) {
  const saved = JSON.parse(json)
  Object.assign(state, merge(saved))
  try {
    localStorage.setItem(KEY, serialize())
  } catch {
    // Storage blocked: this session only.
  }
  changed()
  emit('reset')
}
export function save() {
  try {
    localStorage.setItem(KEY, serialize())
  } catch {
    // Storage blocked: this session only.
  }
  try {
    saveHook?.(serialize())
  } catch (e) {
    console.warn('[game] save hook', e)
  }
}
export function resetProgress() {
  Object.assign(state, fresh())
  for (const n of nests) n.eggs = 0
  save()
  changed()
  emit('reset')
}

// --- Money ----------------------------------------------------------------------------------
// The two HUD boosts are earned through invites (net.js keeps this in step with the server's
// `invite` answer; backend invite.ts): the Money Boost once the player has sent an invite (a direct
// Bloxity invite or the shared invite link), the Friends Boost once an invited friend actually
// joined. Kept outside `state` so a reset / prestige never takes them away; remembered per browser
// for offline play.
const INVITE_KEY = 'run-a-farm.invite.v1'
export const invite = (() => {
  const base = { moneyBoost: false, friendsBoost: false, joined: 0, guest: true }
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(INVITE_KEY) || '{}') }
  } catch {
    return base
  }
})()
export function setInvite(next) {
  Object.assign(invite, next)
  try {
    localStorage.setItem(INVITE_KEY, JSON.stringify(invite))
  } catch {
    // Storage blocked: this session only.
  }
  changed()
  emit('invite', invite)
}
export const boostActive = (b) => (b.id === 'money' ? invite.moneyBoost : b.id === 'friends' ? invite.friendsBoost : true)
export const moneyBoost = () => GAME.boosts.reduce((s, b) => s + (boostActive(b) ? b.amount : 0), 0) + mods.boost()
const moonK = () => (moon.active ? GAME.moon.bonus : 1)
// What a customer pays for one egg at the stand right now (boosts, Harvest Moon).
export const eggSalePrice = () => Math.round(state.eggPrice * (1 + moneyBoost()) * moonK())
export function earn(amount, source) {
  amount = Math.round(amount)
  state.money += amount
  state.stats.earned += amount
  changed()
  emit('earn', { amount, source })
}
// Spends if there is enough; returns false (and emits 'deny') if not.
export function spend(amount, what) {
  if (DEV_MODE) {
    // Dev mode: everything is free (state.money is also kept topped up in tick so affordability checks pass).
    emit('spend', { amount: 0, what })
    changed()
    return true
  }
  if (state.money < amount) {
    emit('deny', { need: amount - state.money, what })
    return false
  }
  state.money -= amount
  changed()
  emit('spend', { amount, what })
  return true
}

// --- Goods: the bag, storage and truck cargo hold mixed goods -----------------------------
export const count = (items) => {
  let n = 0
  for (const k in items) n += items[k]
  return n
}
export const bagCount = () => count(state.bag.items)
export const storageCount = () => count(state.storage.items)
export const bagEggs = () => state.bag.items.egg ?? 0
// Puts up to n of a good in a box ({ items, max }); returns how many fit.
export function put(box, good, n) {
  const k = Math.max(0, Math.min(n, box.max - count(box.items)))
  if (k > 0) box.items[good] = (box.items[good] ?? 0) + k
  return k
}
export function take(items, good, n) {
  const k = Math.min(n, items[good] ?? 0)
  items[good] = (items[good] ?? 0) - k
  if (!items[good]) delete items[good]
  return k
}
// Moves up to n goods (best paying first) from one items map to another box.
export function move(from, to, n) {
  let moved = 0
  const order = Object.keys(from).sort((a, b) => GAME.goods[b].market - GAME.goods[a].market)
  for (const g of order) {
    if (moved >= n) break
    const k = put(to, g, Math.min(n - moved, from[g]))
    take(from, g, k)
    moved += k
  }
  return moved
}
// One good's market price right now (before boosts): drifts with the day, hot item 2x.
export const goodPrice = (g) => GAME.goods[g].market * mods.price(g)
// What a set of goods fetches at the town market right now.
export function marketValue(items, bonus = 1) {
  let v = 0
  for (const g in items) v += items[g] * goodPrice(g)
  return Math.round(v * bonus * (1 + moneyBoost()) * moonK())
}
// Sells everything in `items` at the town market.
export function sellAtMarket(items, bonus, source, at) {
  const n = count(items)
  if (!n) return 0
  const amount = marketValue(items, bonus)
  if (items.egg) state.stats.sold += items.egg
  for (const k in items) delete items[k]
  earn(amount, source)
  emit('market', { amount, n, source, at })
  return amount
}
export function emptyBag() {
  const n = bagCount()
  if (!n) return
  state.bag.items = {}
  changed()
  emit('toast', { text: `Emptied ${n} goods from your bag`, kind: 'info' })
}
export const goodsText = (items) =>
  Object.keys(items)
    .filter((g) => items[g] > 0)
    .map((g) => `${items[g]} ${GAME.goods[g].name}`)
    .join(', ')

// --- Buildings ---------------------------------------------------------------------------------
export const built = (id) => (id === 'field1' ? state.plots.owned.includes(1) : id === 'coop1' || state.built.includes(id))
export const buildingById = (id) => GAME.buildings.find((b) => b.id === id)
export const buildingReady = (b) => !built(b.id) && b.needs.every(built) && (b.level ?? 0) <= mods.level()
export function buyBuilding(b) {
  if (built(b.id)) return false
  if ((b.level ?? 0) > mods.level()) {
    emit('toast', { text: `${b.name} unlocks at farm level ${b.level}`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!b.needs.every(built)) {
    const miss = b.needs.find((id) => !built(id))
    emit('toast', { text: `Build ${buildingById(miss)?.name ?? 'Field 1'} first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(b.price, b.name)) return false
  state.built.push(b.id)
  if (b.customers) state.customersPerMin += b.customers
  const r = GAME.ranch.find((x) => x.id === b.id)
  if (r) state.ranch[b.id] = { n: r.start, feed: 0, expand: 0, crate: 0, t: 0 }
  changed()
  emit('toast', { text: `Built the ${b.name}! ${b.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('build', b)
  return true
}
// The next thing to save up for: the cheapest building or field for sale now.
export function nextGoal() {
  const list = GAME.buildings.filter((b) => buildingReady(b) && b.kind !== 'STAND DECOR').map((b) => ({ id: b.id, name: b.name, price: b.price }))
  const p = nextPlot()
  if (p && plotForSale(p)) list.push({ id: 'field', name: `Field ${p.n}`, price: p.price })
  for (const v of GAME.vehicles) if (built(v.needs) && vehicleCount(v) === 0) list.push({ id: v.id, name: `a ${v.name}`, price: vehiclePrice(v) })
  if (built('droneBase') && state.drones.n === 0) list.push({ id: 'drone', name: 'a Drone', price: dronePrice() })
  if (built('oilField') && state.oil.pumps === 0) list.push({ id: 'pump', name: 'a Pump Jack', price: pumpPrice() })
  list.sort((a, b) => a.price - b.price)
  return list[0] ?? null
}

// --- Seeds -----------------------------------------------------------------------------------------
export function selectSeed(i) {
  if (i < 0 || i >= state.seeds.length) return
  if (!state.seeds[i].unlocked) {
    emit('toast', { text: `${GAME.seeds[i].name} is locked: unlock it at the Seed Market`, kind: 'warn' })
    emit('deny', {})
    return
  }
  state.selected = i
  if (state.seeds[i].count > 0) hold('seed', state.seeds[i].id)
  changed()
  emit('select', i)
}

// --- The hotbar and the item in the player's hands ---------------------------------------------------
// The hotbar lists what the player carries: seed packs bought at the Seed
// Market, then each good in the bag. `hand` is the item the avatar holds
// (main.js `held.js`); it is not saved. Picking something up (eggs, a
// harvest, a ranch crate) puts it in the hands; it is dropped once the bag
// has none of it left.
export const hand = { kind: null, id: null } // kind 'seed' | 'good'
export function hotbarItems() {
  const list = []
  state.seeds.forEach((s, i) => s.unlocked && s.count > 0 && list.push({ kind: 'seed', id: s.id, i, count: s.count }))
  for (const g of Object.keys(GAME.goods)) {
    const n = state.bag.items[g] ?? 0
    if (n > 0) list.push({ kind: 'good', id: g, count: n })
  }
  return list
}
export function hold(kind, id) {
  if (hand.kind === kind && hand.id === id) return
  hand.kind = kind
  hand.id = id
  emit('hold', hand)
}
export function selectHotbar(k) {
  const it = hotbarItems()[k]
  if (!it) return
  if (it.kind === 'seed') return selectSeed(it.i)
  hold('good', it.id)
  changed()
}
// A good that just went up in the bag was picked up: hold it. The held item is
// dropped once there is none of it left (then the next good in the bag, if any).
const lastBag = { ...state.bag.items }
function checkHand() {
  let picked = null
  for (const g in state.bag.items) if ((state.bag.items[g] ?? 0) > (lastBag[g] ?? 0)) picked = g
  for (const g in lastBag) delete lastBag[g]
  Object.assign(lastBag, state.bag.items)
  if (picked) return hold('good', picked)
  if (!hand.kind) return
  const left = hand.kind === 'seed' ? state.seeds.find((s) => s.id === hand.id)?.count ?? 0 : state.bag.items[hand.id] ?? 0
  if (left > 0) return
  const next = hotbarItems().find((it) => it.kind === 'good')
  hold(next ? 'good' : null, next ? next.id : null)
}
on('change', checkHand)
on('reset', () => hold(null, null))

export function buySeeds(i) {
  const def = GAME.seeds[i]
  const s = state.seeds[i]
  if (!s.unlocked) return
  if (!spend(def.packPrice, `${def.name} seeds`)) return
  const pack = Math.round(def.pack * mods.seedPack())
  s.count += pack
  changed()
  emit('toast', { text: `+${pack} ${def.name} seeds${pack > def.pack ? ' (spring bonus!)' : ''}`, kind: 'good' })
  emit('buy')
}
export function unlockSeed(i) {
  const def = GAME.seeds[i]
  const s = state.seeds[i]
  if (s.unlocked) return
  if (!spend(def.unlock, def.name)) return
  s.unlocked = true
  s.count += def.pack
  state.selected = i
  changed()
  emit('toast', { text: `Unlocked ${def.name}! Fields now plant it`, kind: 'good' })
  emit('buy', { big: true })
  emit('select', i)
}
export const seedDef = (id) => GAME.seeds.find((s) => s.id === id)

// --- Shop upgrades -----------------------------------------------------------------------------------
export const upgradeLevel = (id) => state.upgrades[id] ?? 0
export function upgradePrice(item) {
  return Math.round(item.price * Math.pow(item.growth, upgradeLevel(item.id)))
}
export function buyUpgrade(item) {
  if (upgradeLevel(item.id) >= item.max) {
    emit('toast', { text: `${item.name} is maxed!`, kind: 'info' })
    return false
  }
  if (item.needs && !built(item.needs)) {
    emit('toast', { text: `Build the ${buildingById(item.needs).name} first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(upgradePrice(item), item.name)) return false
  state.upgrades[item.id] = upgradeLevel(item.id) + 1
  if (item.id === 'bag') state.bag.max += item.step
  if (item.id === 'stand') state.stand.max = standCap(state.upgrades.stand)
  if (item.id === 'price') state.eggPrice += item.step
  if (item.id === 'customers') state.customersPerMin += item.step
  if (item.id === 'storage') state.storage.max += item.step
  changed()
  const text = item.id === 'price' ? `Eggs now sell for ${fmtMoney(eggSalePrice())}` : item.id === 'stand' ? `Built the ${standStage(state.upgrades.stand)}! The stand holds ${state.stand.max} eggs` : `${item.name} upgraded!`
  emit('toast', { text, kind: 'good' })
  emit('buy', { big: true })
  emit('upgrade', item)
  return true
}
// Hens in coop `n` (each starts with 1; the coop card's button buys more).
export const hensIn = (n) => Math.min(GAME.henMax, state.hens?.[n] ?? (n === 1 ? GAME.startHens : GAME.hensPerCoop))
export const henPrice = (n) => Math.round(GAME.henCost * Math.pow(GAME.henGrowth, hensIn(n) - 1))
export function buyHen(n) {
  if (hensIn(n) >= GAME.henMax) {
    emit('toast', { text: `Coop ${n} is full!`, kind: 'info' })
    return false
  }
  if (!built(`coop${n}`)) return false
  if (!spend(henPrice(n), 'Hen')) return false
  state.hens = { ...state.hens, [n]: hensIn(n) + 1 }
  changed()
  emit('toast', { text: `New hen in Coop ${n}! (${hensIn(n)}/${GAME.henMax})`, kind: 'good' })
  emit('buy', {})
  emit('nest', nests.find((k) => k.n === n))
  return true
}
export const nestMax = () => GAME.nestMax + upgradeLevel('nests') * 4
const layEvery = () => GAME.layEvery / (1 + upgradeLevel('nests') * 0.15) / mods.lay()

// --- Upgrade pads (decor) ---------------------------------------------------------------------------------
export const padBought = (name) => state.pads.includes(name)
// A decor pad is for sale once the buildings it `needs` stand (FARM.pads).
export const padReady = (p) => !padBought(p.name) && (p.needs ?? []).every(built)
export function buyPad(p) {
  if (padBought(p.name)) return false
  const miss = (p.needs ?? []).find((id) => !built(id))
  if (miss) {
    emit('toast', { text: `Build the ${buildingById(miss)?.name ?? 'Field 1'} first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(p.price, p.name)) return false
  state.pads.push(p.name)
  const m = /\+(\d+)% customers/.exec(p.perk)
  if (m) state.customersPerMin = Math.round(state.customersPerMin * (1 + Number(m[1]) / 100))
  changed()
  emit('toast', { text: `Bought ${p.name}! ${p.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('pad', p)
  return true
}

// --- Plots ---------------------------------------------------------------------------------------------------
const F = FARM.field
const home = { n: 1, rect: { minX: F.minX, maxX: F.maxX, minZ: F.minZ, maxZ: F.maxZ }, price: GAME.plots.home.price, x: F.maxX - 3.5, z: F.maxZ - 3.5, home: true }
export const PLOTS = [home, ...westPlots()].slice(0, GAME.plots.max).map((p, i) => ({ ...p, i, crops: plotCrops(p.rect) }))
export const plotOwned = (p) => state.plots.owned.includes(p.n)
// The next plot for sale (they are sold in order), or null once all are owned.
export const nextPlot = () => PLOTS.find((p) => !plotOwned(p)) ?? null
export const plotForSale = (p) => nextPlot() === p && (p.n > 1 || built(GAME.plots.home.needs))
export const plotLevel = (p, id) => state.plots.up[p.n]?.[id] ?? 0
export const plotGrowth = (p) => state.plots.grow[p.n] ?? 0
export const plotCrop = (p) => state.plots.crop[p.n] ?? null
const upStep = (p, id) => plotLevel(p, id) * (GAME.plots.upgrades.find((u) => u.id === id)?.step ?? 0)
export const plotGrowTime = (p) => (seedDef(plotCrop(p) ?? 'wheat').grow) / (1 + upStep(p, 'sprinklers'))
export const plotYield = (p) => Math.round(GAME.plots.yield[p.i] * (1 + upStep(p, 'fertilizer')))

// --- Plants: a plot's crop is a grid of plants along its ridges (farm/plots.js draws one
// clump per spot). The player harvests the plants within reach as they walk or drive
// through (`pickPlants`), each giving its share of the field's yield; the field replants
// once its last plant is picked. Workers take whatever is left in one go (`harvestPlot`).
export const PICK_REACH = { foot: 2.4, tractor: 4.5, combine: 6 } // m: about 3 rows on foot (rows are FARM.fieldRow apart)
export function plotSpots(p) {
  if (p.spots) return p.spots
  const c = p.crops
  const rows = Math.floor((c.maxX - c.minX) / FARM.fieldRow)
  const x0 = (c.minX + c.maxX) / 2 - ((rows - 1) * FARM.fieldRow) / 2
  const jit = (k) => {
    const v = Math.sin(k * 12.9898 + p.n * 78.233) * 43758.5453
    return v - Math.floor(v) - 0.5
  }
  const spots = []
  for (let i = 0; i < rows; i++) {
    const x = x0 + i * FARM.fieldRow
    for (let z = c.minZ + 0.6; z < c.maxZ - 0.4; z += 1) spots.push([x + jit(spots.length * 2) * 0.3, z + jit(spots.length * 2 + 1) * 0.25])
  }
  p.spots = spots
  return spots
}
// The picked plants of a plot: the saved index list plus a Set for lookups (rebuilt when the list is replaced).
const pickCache = new Map()
export function plotPicked(p) {
  let arr = state.plots.picked?.[p.n]
  if (!arr) {
    state.plots.picked ??= {}
    arr = state.plots.picked[p.n] = []
  }
  let c = pickCache.get(p.n)
  if (!c || c.arr !== arr) pickCache.set(p.n, (c = { arr, set: new Set(arr) }))
  return c
}
const clearPicked = (p) => {
  state.plots.picked[p.n] = []
  p.run = null
}
// Goods for the k-th plant picked of n, out of `total` for the whole field (the first plant already gives one).
const plantShare = (total, k, n) => Math.ceil((total * (k + 1)) / n) - Math.ceil((total * k) / n)
function pickPlants(p, x, z, reach, { bonus = 0, by = null } = {}) {
  const spots = plotSpots(p)
  const N = spots.length
  const pk = plotPicked(p)
  const good = plotCrop(p) ?? 'wheat'
  // A field's harvest run starts with its first plant: that is when a giant crop is rolled.
  if (!p.run || pk.arr.length === 0) p.run = { n: 0, mult: Math.random() < GAME.rare.chance ? GAME.rare.giant : 1, bonus }
  const total = Math.round(plotYield(p) * (1 + bonus) * p.run.mult)
  const storeOk = built('storage')
  const cut = []
  let got = 0
  for (let i = 0; i < N; i++) {
    if (pk.set.has(i)) continue
    const s = spots[i]
    if ((s[0] - x) ** 2 + (s[1] - z) ** 2 > reach * reach) continue
    const share = plantShare(total, pk.arr.length, N)
    if (share > 0) {
      const room = state.bag.max - bagCount() + (storeOk ? state.storage.max - storageCount() : 0)
      if (room < share) {
        if (!p.fullWarned) {
          p.fullWarned = true
          emit('toast', { text: storeOk ? 'No room: your bag and the storage are full!' : 'Your bag is full: sell or unload first', kind: 'warn' })
          emit('deny', {})
        }
        break
      }
      const left = share - put(state.bag, good, share)
      if (left > 0) put(state.storage, good, left)
    }
    p.fullWarned = false
    pk.arr.push(i)
    pk.set.add(i)
    cut.push(i)
    got += share
  }
  if (!cut.length) return
  p.run.n += got
  emit('pick', { p, cut, n: got, good, x, z })
  if (pk.arr.length >= N) {
    // The last plant: the field is done and replants.
    const run = p.run
    clearPicked(p)
    state.plots.grow[p.n] = 0
    plant(p, false)
    changed()
    emit('harvest', { p, n: run.n, good, by, k: 0, player: true, giant: run.mult > 1 })
    emit('toast', { text: `Field ${p.n} harvested: ${run.n} ${GAME.goods[good].name}!`, kind: 'good' })
  } else changed()
}
export const plotHarvest = (p) => marketValue({ [plotCrop(p) ?? 'wheat']: plotYield(p) })
export function plotUpgradePrice(p, u) {
  return Math.round((Math.max(p.price, 600) * u.price * Math.pow(u.growth, plotLevel(p, u.id))) / 50) * 50
}
// Plants the selected seed (or any seed left) in a plot; false if there are none.
function plant(p, quiet = false) {
  const order = [state.selected, ...state.seeds.map((_, i) => i)]
  const i = order.find((j) => state.seeds[j].unlocked && state.seeds[j].count > 0)
  if (i == null) {
    state.plots.crop[p.n] = null
    if (!quiet) emit('toast', { text: `Field ${p.n} is empty: buy seeds at the ${built('seedMarket') ? 'Seed Market' : 'Seed Market (build it north of the truck bay)'}`, kind: 'warn' })
    return false
  }
  state.seeds[i].count--
  state.plots.crop[p.n] = state.seeds[i].id
  state.plots.grow[p.n] = 0
  emit('plant', { p, seed: state.seeds[i].id })
  return true
}
export function buyPlot(p) {
  if (plotOwned(p)) return false
  if (!plotForSale(p)) {
    emit('toast', { text: p.n === 1 ? 'Build Coop 2 first' : `Buy Field ${nextPlot()?.n} first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(p.price, `Field ${p.n}`)) return false
  state.plots.owned.push(p.n)
  plant(p)
  changed()
  emit('toast', { text: `Bought Field ${p.n}! ${plotCrop(p) ? `${seedDef(plotCrop(p)).name} is growing` : 'Buy seeds to plant it'}`, kind: 'good' })
  emit('buy', { big: true })
  emit('plot', { p, why: 'buy' })
  return true
}
export function buyPlotUpgrade(p, u) {
  if (!plotOwned(p) || plotLevel(p, u.id) >= u.max) return false
  if (!spend(plotUpgradePrice(p, u), `${u.name} (Field ${p.n})`)) return false
  const up = (state.plots.up[p.n] ??= {})
  up[u.id] = (up[u.id] ?? 0) + 1
  changed()
  emit('toast', { text: `Field ${p.n} ${u.name} level ${up[u.id]}! ${u.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('plot', { p, why: 'upgrade', u })
  return true
}
// Harvests a ripe plot: the crop goes into the bag (by hand) or storage (workers),
// either one overflowing into the other. Returns false if there is no room.
export function harvestPlot(p, { by = null, k = 0, bonus = 0, player = false, mult = 1 } = {}) {
  const good = plotCrop(p) ?? 'wheat'
  // Plants the player already picked are gone: only the rest of the field's yield is left.
  const full = Math.round(plotYield(p) * (1 + bonus) * mult)
  const done = plotPicked(p).arr.length
  const n = full - Math.ceil((full * done) / plotSpots(p).length)
  const storeOk = built('storage')
  const room = (player ? state.bag.max - bagCount() : 0) + (storeOk ? state.storage.max - storageCount() : 0)
  if (room < n) {
    if (player && !p.fullWarned) {
      p.fullWarned = true
      emit('toast', { text: storeOk ? 'No room: your bag and the storage are full!' : `Your bag needs room for ${n} ${GAME.goods[good].name}: sell or unload first`, kind: 'warn' })
      emit('deny', {})
    }
    return false
  }
  p.fullWarned = false
  let left = n
  if (player) left -= put(state.bag, good, left)
  if (left > 0) put(state.storage, good, left)
  clearPicked(p)
  state.plots.grow[p.n] = 0
  plant(p, !!by)
  changed()
  emit('harvest', { p, n, good, by, k, player, giant: mult > 1 })
  if (player) emit('toast', { text: `Harvested ${n} ${GAME.goods[good].name}!`, kind: 'good' })
  return true
}

// --- Vehicles, the dealer and the garage -------------------------------------------------------------------
export const vehicleCount = (v) => v.start + (state.vehicles[v.id] ?? 0)
const vehicleById = (id) => GAME.vehicles.find((v) => v.id === id)
export const vehiclePrice = (v) => Math.round((v.price * Math.pow(v.growth, state.vehicles[v.id] ?? 0)) / 50) * 50
export function buyVehicle(v) {
  if (vehicleCount(v) >= v.max) return false
  if (!built(v.needs)) {
    emit('toast', { text: `Build the ${buildingById(v.needs).name} on your farm first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(vehiclePrice(v), v.name)) return false
  state.vehicles[v.id] = (state.vehicles[v.id] ?? 0) + 1
  changed()
  emit('toast', { text: `Bought a ${v.name}! It is waiting in your ${buildingById(v.needs).name}`, kind: 'good' })
  emit('buy', { big: true })
  emit('vehicle', v)
  return true
}
export const garageLevel = (id) => state.garage[id] ?? 0
export const garagePrice = (g) => Math.round((g.price * Math.pow(g.growth, garageLevel(g.id))) / 50) * 50
export function buyGarage(g) {
  if (garageLevel(g.id) >= g.max) return false
  if (g.needs && !built(g.needs)) {
    emit('toast', { text: `Build the ${buildingById(g.needs).name} first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(garagePrice(g), g.name)) return false
  state.garage[g.id] = garageLevel(g.id) + 1
  if (g.id === 'basket') state.bag.max += g.step
  changed()
  emit('toast', { text: `${g.name} level ${state.garage[g.id]}! ${g.text}`, kind: 'good' })
  emit('buy', { big: true })
  emit('garage', g)
  return true
}
export const garageStep = (id) => garageLevel(id) * (GAME.garage.find((g) => g.id === id)?.step ?? 0)
export const truckCargoMax = () => GAME.truck.cargo + garageStep('cargo')
export const truckCargo = (k) => (state.trucks[k] ??= { items: {} })
// Handling for whatever the player rides.
export function handling(kind) {
  if (kind === 'bike') return { ...GAME.bike, speed: GAME.bike.speed * (1 + garageStep('bike')), seat: 'bike' }
  if (kind === 'truck') return { ...GAME.truck, speed: GAME.truck.speed * (1 + garageStep('truckEngine')), seat: 'hidden' }
  if (kind === 'horse') return { ...GAME.horse, seat: 'horse' }
  const f = GAME.fleet.find((v) => v.id === kind)
  if (f) return { speed: f.speed, turn: f.turn, accel: f.accel, seat: 'hidden' }
  return { ...GAME.tractor, speed: GAME.tractor.speed * (1 + garageStep('engine')), seat: 'seat' }
}

// --- Workers (Farm Office) -------------------------------------------------------------------------------------
export const crewLevel = (id) => state.crew[id] ?? 0
const crewStep = (id) => crewLevel(id) * (GAME.crew.find((c) => c.id === id)?.step ?? 0)
export const crewSpeed = () => 1 + crewStep('speed')
export const crewCarry = () => 1 + crewStep('carry')
export const hired = (w) => state.workers[w.id] ?? 0
export const workerById = (id) => GAME.workers.find((w) => w.id === id)
export const coopCount = () => FARM.coops.filter((c) => built(`coop${c.n}`)).length
export const ranchBuilt = () => GAME.ranch.filter((r) => built(r.id))
// How many of a worker the farm has room for right now.
export function workerCap(w) {
  if (w.cap === 'coops') return coopCount()
  if (w.cap === 'plots') return state.plots.owned.length
  if (w.cap === 'ranch') return ranchBuilt().length
  if (w.cap === 'pumps') return state.oil.pumps
  return vehicleCount(vehicleById(w.cap))
}
// The most the farm can ever employ.
export function workerMaxCap(w) {
  if (w.cap === 'coops') return FARM.coops.length
  if (w.cap === 'plots') return GAME.plots.max
  if (w.cap === 'ranch') return GAME.ranch.length
  if (w.cap === 'pumps') return GAME.oil.pumps
  return vehicleById(w.cap).max
}
const CAP_HINT = { coops: 'Build another coop', plots: 'Buy another field', tractors: 'Buy a tractor in town', trucks: 'Buy a truck in town', ranch: 'Build a ranch barn', pumps: 'Build a pump jack' }
export const capHint = (w) => CAP_HINT[w.cap]
export const hirePrice = (w) => Math.round((w.price * Math.pow(w.growth, hired(w))) / 10) * 10 - 1
export const crewPrice = (c) => Math.round((c.price * Math.pow(c.growth, crewLevel(c.id))) / 10) * 10
export const workerCarry = (w) => Math.round((w.carry ?? 0) * crewCarry())
export function hireWorker(w) {
  if (!built('office')) {
    emit('toast', { text: 'Build the Farm Office first (by the cottage)', kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (hired(w) >= workerCap(w)) {
    emit('toast', { text: `No room for another ${w.name}. ${capHint(w)} first`, kind: 'warn' })
    emit('deny', {})
    return false
  }
  if (!spend(hirePrice(w), w.name)) return false
  state.workers[w.id] = hired(w) + 1
  changed()
  emit('toast', { text: `Hired a ${w.name}!`, kind: 'good' })
  emit('buy', { big: true })
  emit('hire', w)
  return true
}
export function buyCrew(c) {
  if (crewLevel(c.id) >= c.max) return false
  if (!spend(crewPrice(c), c.name)) return false
  state.crew[c.id] = crewLevel(c.id) + 1
  changed()
  emit('toast', { text: `${c.name} level ${state.crew[c.id]}! ${c.text}`, kind: 'good' })
  emit('buy', { big: true })
  return true
}
// The field hands work the first owned plots, one each.
export function plotHasHand(p) {
  const k = state.plots.owned.indexOf(p.n)
  return k >= 0 && k < hired(workerById('hand'))
}

// Each hired worker runs its own timer (staggered so they do not all fire together).
const shifts = {} // worker id -> [seconds left, ...]
function work(dt) {
  const speed = crewSpeed()
  for (const w of GAME.workers) {
    if (w.id === 'oiler') continue // oil workers just keep their pump running (oil, below)
    if (w.id === 'stocker') continue // stockers walk their trips (farm/workers.js: stockerPick / stockerDrop)
    const n = hired(w)
    const timers = (shifts[w.id] ??= [])
    while (timers.length < n) timers.push(w.every * (0.3 + 0.7 * Math.random()))
    timers.length = n
    for (let k = 0; k < n; k++) {
      timers[k] -= dt * speed
      if (timers[k] > 0) continue
      timers[k] += w.every
      shift(w, k)
    }
  }
}
function shift(w, k) {
  if (w.id === 'hand') {
    const p = PLOTS.find((q) => q.n === state.plots.owned[k])
    if (p && plotCrop(p) && plotGrowth(p) >= 1) harvestPlot(p, { by: w, k })
  } else if (w.id === 'tractor') {
    // Its tractor drives out to a ripe field nobody works (and no other tractor is on its way to).
    if (trips.has(`tractor:${k}`) || riding('tractor', k) || k >= vehicleCount(vehicleById('tractors'))) return
    const claimed = new Set([...trips.values()].map((t) => t.p?.n))
    const p = PLOTS.find((q) => plotOwned(q) && plotCrop(q) && plotGrowth(q) >= 1 && !plotHasHand(q) && !claimed.has(q.n))
    if (!p) return
    const { out, back } = tractorTrip(p, w)
    dispatch({ key: `tractor:${k}`, w, k, p, out, back })
  } else if (w.id === 'driver') {
    // Loads goods from storage (or eggs off the stand) into its truck; they are sold in town.
    if (trips.has(`driver:${k}`) || riding('truck', k) || k >= vehicleCount(vehicleById('trucks'))) return
    const load = {}
    const cap = Math.min(workerCarry(w), truckCargoMax())
    let n = move(state.storage.items, { items: load, max: cap }, cap)
    if (!n && state.stand.eggs > 0) {
      n = Math.min(cap, state.stand.eggs)
      state.stand.eggs -= n
      load.egg = n
    }
    if (!n) return
    changed()
    const t = w.trip / (crewSpeed() * (1 + garageStep('truckEngine')))
    dispatch({ key: `driver:${k}`, w, k, load, out: t, back: t })
  } else if (w.id === 'rancher') {
    // Each rancher looks after one barn: its crate goes to storage (ride money is banked).
    const r = ranchBuilt()[k]
    if (r) collectRanch(r, 'rancher')
  }
}

// Stockers (farm/workers.js) walk to the nests and back: they take eggs out of a
// nest only while standing at it, and the stand fills only once they reach it.
export function stockerPick(coopN, room) {
  const n = nests.find((x) => x.n === coopN)
  if (!n || room <= 0 || !built(`coop${n.n}`)) return 0
  const t = Math.min(room, n.eggs)
  if (!t) return 0
  n.eggs -= t
  emit('nest', n)
  return t
}
export function stockerDrop(w, k, eggs) {
  const t = Math.min(eggs, state.stand.max - state.stand.eggs)
  if (t <= 0) return 0
  state.stand.eggs += t
  state.stats.collected += t
  changed()
  emit('work', { w, k, n: t, text: `+${t} eggs` })
  return t
}

// --- Vehicle trips -------------------------------------------------------------------------------------------------
// A trip runs `out` s (then it arrives: the tractor harvests, the truck sells) and
// `back` s home again; the vehicle is busy (no new job) until it is back. The
// parks (farm/parks.js) drive the vehicles along their routes in the same times.
const trips = new Map() // 'tractor:k' | 'driver:k' -> { w, k, p | load, out, back, t, home }
export const vehicleBusy = (kind, k) => trips.has(`${kind}:${k}`)
// A tractor is on its way to (or sweeping) this plot.
export const plotClaimed = (p) => [...trips.values()].some((t) => t.p === p && !t.home)
// Out: park -> the plot's track -> sweep up and down the crop; back: the way home.
export function tractorTrip(p, w = workerById('tractor')) {
  const P = FARM.tractorPark
  const parkX = (P.minX + P.maxX) / 2
  const c = p.crops
  const drive = Math.abs((c.minX + c.maxX) / 2 - parkX) + Math.abs(c.maxZ - P.slotZ) + 6
  const sweep = 2 * (c.maxZ - c.minZ) + 4
  const v = w.speed * crewSpeed()
  return { out: (drive + sweep) / v, back: drive / v }
}
function dispatch(trip) {
  trip.t = trip.out
  trip.home = false
  trips.set(trip.key, trip)
  emit('dispatch', trip)
}
function driveTrips(dt) {
  for (const [key, trip] of trips) {
    trip.t -= dt
    if (trip.t > 0) continue
    if (trip.home) {
      trips.delete(key)
      emit('parked', trip)
      continue
    }
    trip.home = true
    trip.t = trip.back
    const { w, k } = trip
    if (w.id === 'tractor') {
      if (plotOwned(trip.p) && plotGrowth(trip.p) >= 1) harvestPlot(trip.p, { by: w, k, bonus: w.bonus + garageStep('header') })
    } else {
      const n = count(trip.load)
      const amount = sellAtMarket(trip.load, 1, 'truck', null)
      emit('work', { w, k, n, amount, text: `Truck sold ${n} goods +${fmtMoney(amount)}` })
    }
  }
}
on('reset', () => trips.clear())

// --- What the player does with vehicles (farm/rideables.js calls these) -----------------------------------------
// The player's truck in the storage yard: unload the bag, fill the cargo.
export function loadTruck(k) {
  const c = truckCargo(k)
  const box = { items: c.items, max: truckCargoMax() }
  const n = move(state.storage.items, box, truckCargoMax())
  if (n) {
    changed()
    emit('truckLoad', { k, n })
    emit('toast', { text: `Loaded ${n} goods into the truck (${count(c.items)}/${truckCargoMax()})`, kind: 'good' })
  }
  return n
}

// --- Carton packer and the van (farm/van.js drives the van) -------------------------------------------------
export const packerEvery = () => GAME.cartons.every / (1 + upgradeLevel('packer') * 0.25)
export const cartonPrice = () => Math.round(GAME.cartons.eggs * state.eggPrice * GAME.cartons.bonus * (1 + moneyBoost()) * moonK())
// The van has stopped at the stand: it buys up to its load of cartons.
export function vanArrived() {
  const n = Math.min(state.cartons, GAME.cartons.van.load)
  if (!n) return 0
  state.cartons -= n
  const amount = n * cartonPrice()
  state.stats.sold += n * GAME.cartons.eggs
  earn(amount, 'van')
  emit('vanSold', { n, amount })
  return n
}

// --- Drones ----------------------------------------------------------------------------------------------------
// Each drone: lift off its pad, fly to the storage yard, pick up a load, fly
// to the town market and sell it, fly home and land. The game runs the clock;
// farm/drones.js flies the models along the same legs.
const DRONE_ALT = 24
export const dronePads = () => {
  const b = FARM.droneBase
  return [[-4, -3], [4, -3], [-4, 4], [4, 4]].map(([dx, dz]) => [b.x + dx, b.z + dz])
}
export const DRONE_PICK = [(FARM.loadZone.minX + FARM.loadZone.maxX) / 2, (FARM.loadZone.minZ + FARM.loadZone.maxZ) / 2]
export const DRONE_SELL = [FARM.townMarket.x, FARM.townMarket.z - 4]
export const droneCap = (k) => GAME.drones.cap + (state.drones.cap[k] ?? 0) * GAME.drones.capStep
export const dronePrice = () => Math.round((GAME.drones.price * Math.pow(GAME.drones.growth, state.drones.n)) / 50) * 50
export const droneCapPrice = (k) => Math.round((GAME.drones.capPrice * Math.pow(GAME.drones.capGrowth, state.drones.cap[k] ?? 0)) / 50) * 50
export function buyDrone() {
  if (!built('droneBase') || state.drones.n >= GAME.drones.max) return false
  if (!spend(dronePrice(), 'a Drone')) return false
  state.drones.cap[state.drones.n] = 0
  state.drones.n++
  changed()
  emit('toast', { text: `Drone ${state.drones.n} is ready for take-off!`, kind: 'good' })
  emit('buy', { big: true })
  emit('drone', { k: state.drones.n - 1, why: 'buy' })
  return true
}
export const droneSpeedLevel = (k) => state.drones.speed?.[k] ?? 0
export const droneSpeedPrice = (k) => Math.round((GAME.drones.speedPrice * Math.pow(GAME.drones.capGrowth, droneSpeedLevel(k))) / 50) * 50
export function upgradeDroneSpeed(k) {
  if (k >= state.drones.n || droneSpeedLevel(k) >= GAME.drones.speedMax) return false
  if (!spend(droneSpeedPrice(k), `Drone ${k + 1} speed`)) return false
  state.drones.speed ??= []
  state.drones.speed[k] = droneSpeedLevel(k) + 1
  changed()
  emit('toast', { text: `Drone ${k + 1} flies ${Math.round(droneSpeedLevel(k) * GAME.drones.speedStep * 100)}% faster`, kind: 'good' })
  emit('buy', { big: true })
  emit('drone', { k, why: 'upgrade' })
  return true
}
export function upgradeDrone(k) {
  if (k >= state.drones.n || (state.drones.cap[k] ?? 0) >= GAME.drones.capMax) return false
  if (!spend(droneCapPrice(k), `Drone ${k + 1} capacity`)) return false
  state.drones.cap[k] = (state.drones.cap[k] ?? 0) + 1
  changed()
  emit('toast', { text: `Drone ${k + 1} now carries ${droneCap(k)} goods`, kind: 'good' })
  emit('buy', { big: true })
  emit('drone', { k, why: 'upgrade' })
  return true
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
// Flight legs: [name, seconds, from [x, y, z], to [x, y, z]].
export function droneLegs(k) {
  const pad = dronePads()[k]
  const v = GAME.drones.speed * (1 + droneSpeedLevel(k) * GAME.drones.speedStep) * mods.drone()
  const P = [pad[0], 0.6, pad[1]]
  const up = [pad[0], DRONE_ALT, pad[1]]
  const pickHi = [DRONE_PICK[0], DRONE_ALT * 0.6, DRONE_PICK[1]]
  const pickLo = [DRONE_PICK[0], 3.2, DRONE_PICK[1]]
  const sellHi = [DRONE_SELL[0], DRONE_ALT, DRONE_SELL[1]]
  const sellLo = [DRONE_SELL[0], 4.2, DRONE_SELL[1]]
  return [
    ['lift', 2.2, P, up],
    ['toPick', dist(pad, DRONE_PICK) / v + 0.6, up, pickHi],
    ['down', 1.6, pickHi, pickLo],
    ['pick', 2.2, pickLo, pickLo],
    ['up', 1.6, pickLo, pickHi],
    ['toSell', dist(DRONE_PICK, DRONE_SELL) / v + 0.6, pickHi, sellHi],
    ['drop', 2.4, sellHi, sellLo],
    ['sell', 2.2, sellLo, sellLo],
    ['rise', 1.4, sellLo, sellHi],
    ['home', dist(DRONE_SELL, pad) / v + 0.6, sellHi, up],
    ['land', 2.4, up, P],
  ]
}
export const droneRuns = [] // per drone: { leg, t, load, idle }
function flyDrones(dt) {
  for (let k = 0; k < state.drones.n; k++) {
    const d = (droneRuns[k] ??= { leg: -1, t: 0, load: null, idle: 1 + k * 1.3 })
    if (d.leg < 0) {
      d.idle -= dt
      if (d.idle > 0 || storageCount() === 0) continue
      d.legs = droneLegs(k)
      d.leg = 0
      d.t = 0
      d.load = null
      emit('droneGo', { k })
      continue
    }
    d.t += dt
    const [name, len] = d.legs[d.leg]
    if (d.t < len) continue
    d.t -= len
    if (name === 'pick') {
      const box = { items: {}, max: droneCap(k) }
      const n = move(state.storage.items, box, droneCap(k))
      d.load = n ? box.items : null
      if (n) {
        changed()
        emit('dronePick', { k, n })
      }
    } else if (name === 'sell' && d.load) {
      const n = count(d.load)
      const amount = sellAtMarket(d.load, GAME.drones.bonus, 'drone', DRONE_SELL)
      d.load = null
      emit('droneSold', { k, n, amount })
    }
    d.leg++
    if (d.leg >= d.legs.length) {
      d.leg = -1
      d.idle = 1.5
    }
  }
}
on('reset', () => (droneRuns.length = 0))

// --- Crude oil ---------------------------------------------------------------------------------------------------
const O = GAME.oil
export const pumpPrice = () => Math.round((O.pumpPrice * Math.pow(O.pumpGrowth, state.oil.pumps)) / 50) * 50
export const pumpLevel = (i, id) => state.oil.up[i]?.[id] ?? 0
export const pumpUpPrice = (i, u) => Math.round((u.price * Math.pow(u.growth, pumpLevel(i, u.id))) / 50) * 50
export const pumpRunning = (i) => i < state.oil.pumps && i < hired(workerById('oiler'))
export const oilTankMax = () => O.tank + state.oil.tankUp * O.tankUp.step
export const stationLoad = () => O.station + state.oil.crane * O.crane.step
export const oilLevel = (id) => state.oil[id] ?? 0
export const oilUpPrice = (u) => Math.round((u.price * Math.pow(u.growth, oilLevel(u.id))) / 50) * 50
export const barrelPrice = () => Math.round(O.barrel * (1 + oilLevel('refine') * O.refine.step) * (1 + moneyBoost()))
export function buyPump() {
  if (!built('oilField') || state.oil.pumps >= O.pumps) return false
  if (!spend(pumpPrice(), 'a Pump Jack')) return false
  state.oil.up[state.oil.pumps] = { motor: 0, drill: 0, weights: 0 }
  state.oil.pumps++
  changed()
  emit('toast', { text: `Pump Jack ${state.oil.pumps} built! Hire an Oil Worker to run it`, kind: 'good' })
  emit('buy', { big: true })
  emit('pump', { i: state.oil.pumps - 1 })
  return true
}
export function buyPumpUpgrade(i, u) {
  if (i >= state.oil.pumps || pumpLevel(i, u.id) >= u.max) return false
  if (!spend(pumpUpPrice(i, u), `${u.name} (Pump ${i + 1})`)) return false
  const up = (state.oil.up[i] ??= { motor: 0, drill: 0, weights: 0 })
  up[u.id] = (up[u.id] ?? 0) + 1
  changed()
  emit('toast', { text: `Pump ${i + 1} ${u.name} level ${up[u.id]}! ${u.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('pump', { i, u })
  return true
}
export function buyOilUpgrade(u) {
  if (oilLevel(u.id) >= u.max) return false
  if (u.id === 'crane' && !built('railStation')) return false
  if (!spend(oilUpPrice(u), u.name)) return false
  state.oil[u.id] = oilLevel(u.id) + 1
  changed()
  emit('toast', { text: `${u.name} level ${state.oil[u.id]}! ${u.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('pump', { u })
  return true
}
const pumpT = []
export const pumpPhase = [] // 0..1 stroke progress per pump (for the animation)
function pumpOil(dt) {
  const max = oilTankMax()
  for (let i = 0; i < state.oil.pumps; i++) {
    if (!pumpRunning(i) || state.oil.tank >= max) continue
    const rate = 1 + pumpLevel(i, 'motor') * O.upgrades[0].step
    pumpT[i] = (pumpT[i] ?? 0) + dt * rate
    pumpPhase[i] = (pumpT[i] % O.every) / O.every
    if (pumpT[i] >= O.every) {
      pumpT[i] -= O.every
      const before = Math.floor(state.oil.tank)
      state.oil.tank = Math.min(max, state.oil.tank + 1 + pumpLevel(i, 'drill') * O.upgrades[1].step + pumpLevel(i, 'weights') * O.upgrades[2].step)
      dirty = true
      if (Math.floor(state.oil.tank) > before) emit('barrel', { i })
    }
  }
}
// The train asks whether to stop at the rail station.
export const oilWaiting = () => built('railStation') && state.oil.tank >= 1
// The train has stopped at the station: load what the crane can.
export function trainLoad() {
  const n = Math.min(Math.floor(state.oil.tank), stationLoad())
  if (!n) return 0
  state.oil.tank -= n
  state.oil.sold += n
  const amount = n * barrelPrice()
  earn(amount, 'oil')
  emit('oilSold', { n, amount })
  emit('toast', { text: `The train bought ${n} barrels of oil! +${fmtMoney(amount)}`, kind: 'good' })
  return n
}

// --- Ranch ---------------------------------------------------------------------------------------------------
export const ranchState = (r) => state.ranch[r.id] ?? null
export const ranchAddPrice = (r) => Math.round((r.addPrice * Math.pow(GAME.addGrowth, (ranchState(r)?.n ?? r.start) - r.start)) / 50) * 50
export const ranchFeedPrice = (r) => Math.round((r.addPrice * GAME.feed.price * Math.pow(GAME.feed.growth, ranchState(r)?.feed ?? 0)) / 50) * 50
export function addAnimal(r) {
  const s = ranchState(r)
  if (!s || s.n >= r.max) return false
  if (!spend(ranchAddPrice(r), `a ${r.animal}`)) return false
  s.n++
  changed()
  emit('toast', { text: `A new ${r.animal} joined the ${r.name}! (${s.n}/${r.max})`, kind: 'good' })
  emit('buy', { big: true })
  emit('animals', r)
  return true
}
export function feedAnimals(r) {
  const s = ranchState(r)
  if (!s || s.feed >= GAME.feed.max) return false
  if (!spend(ranchFeedPrice(r), `${GAME.feed.name} (${r.name})`)) return false
  s.feed++
  changed()
  emit('toast', { text: `${r.name} ${GAME.feed.name} level ${s.feed}! ${GAME.feed.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('animals', r)
  return true
}
export const ranchEvery = (r) => r.every / ((ranchState(r)?.n ?? 1) * (1 + (ranchState(r)?.feed ?? 0) * GAME.feed.step) * (1 + (ranchState(r)?.expand ?? 0) * 0.1) * mods.ranch(r))
// Barn Expansion: a bigger crate, +10% production and +15% value a level (and a lean-to, hay, a trough on the model).
export const ranchCrateMax = (r) => Math.round(r.crate * (1 + (ranchState(r)?.expand ?? 0) * 0.5))
export const ranchValue = (r) => 1 + (ranchState(r)?.expand ?? 0) * 0.15
export const ranchExpandPrice = (r) => Math.round((r.addPrice * GAME.expand.price * Math.pow(GAME.expand.growth, ranchState(r)?.expand ?? 0)) / 50) * 50
export function expandRanch(r) {
  const s = ranchState(r)
  if (!s || (s.expand ?? 0) >= GAME.expand.max) return false
  if (!spend(ranchExpandPrice(r), `${GAME.expand.name} (${r.name})`)) return false
  s.expand = (s.expand ?? 0) + 1
  changed()
  emit('toast', { text: `${r.name} expanded to level ${s.expand}! ${GAME.expand.perk}`, kind: 'good' })
  emit('buy', { big: true })
  emit('animals', r)
  emit('expand', r)
  return true
}
function raise(dt) {
  for (const r of GAME.ranch) {
    const s = ranchState(r)
    if (!s || s.crate >= ranchCrateMax(r)) continue
    s.t += dt
    const every = ranchEvery(r)
    while (s.t >= every && s.crate < ranchCrateMax(r)) {
      s.t -= every
      s.crate++
      dirty = true
      emit('product', r)
    }
  }
}
// Empties a barn's crate: by the player into the bag, by a rancher into storage.
// Horse rides are money, banked straight away.
export function collectRanch(r, by) {
  const s = ranchState(r)
  if (!s || !s.crate) return 0
  if (r.cash) {
    const amount = Math.round(s.crate * r.cash * ranchValue(r) * (1 + moneyBoost()))
    const n = s.crate
    s.crate = 0
    earn(amount, 'rides')
    emit('ranchCollect', { r, n, amount, by })
    return n
  }
  const box = by === 'player' ? state.bag : built('storage') ? state.storage : null
  if (!box) return 0
  const n = put(box, r.good, s.crate)
  if (!n) {
    if (by === 'player' && !s.fullWarned) {
      s.fullWarned = true
      emit('toast', { text: 'Your bag is full!', kind: 'warn' })
      emit('deny', {})
    }
    return 0
  }
  s.fullWarned = false
  s.crate -= n
  changed()
  emit('ranchCollect', { r, n, by })
  if (by === 'player') emit('toast', { text: `+${n} ${GAME.goods[r.good].name}`, kind: 'good' })
  return n
}

// --- Daily quests ---------------------------------------------------------------------------------------
export function questProgress(q) {
  return Math.min(q.goal, state.stats[q.stat] ?? 0)
}
export const questDone = (q) => questProgress(q) >= q.goal
export const questClaimed = (q) => state.quests.claimed.includes(q.id)
export function claimQuest(q) {
  if (!questDone(q) || questClaimed(q)) return
  state.quests.claimed.push(q.id)
  earn(q.reward, 'quest')
  emit('toast', { text: `Quest complete! +$${q.reward.toLocaleString('en-US')}`, kind: 'good' })
  emit('buy', { big: true })
}
export const questsReady = () => GAME.quests.filter((q) => questDone(q) && !questClaimed(q)).length

// --- Simulation -----------------------------------------------------------------------------------------
// Each coop's nest crate holds up to nestMax eggs; hens refill it over time.
const nests = FARM.coops.map((c) => ({ x: c.x + 1.3, z: c.z + 3.1, eggs: c.n === 1 ? 3 : 0, t: 0, n: c.n }))
export const nestState = nests

const sim = { sale: 0, batch: 0, batchN: 0, batchT: 0, weightT: 0, saveT: 0, moonT: GAME.moon.first, zoneT: 0, near: { stand: false, market: false, load: false } }
export const moon = { active: false, left: 0 }
const inside = (x, z, r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ

export function tick(dt, player) {
  if (DEV_MODE && state.money < DEV_MONEY) {
    state.money = DEV_MONEY
    changed()
  }
  // Hens lay (in the coops that are built).
  const max = nestMax()
  for (const n of nests) {
    if (n.eggs >= max || !built(`coop${n.n}`)) continue
    n.t += dt * hensIn(n.n)
    if (n.t >= layEvery()) {
      n.t = 0
      n.eggs++
      emit('nest', n)
      emit('lay', n)
    }
  }
  const m = mount.active
  // Collect from nests the player walks (or rides) past.
  for (const n of nests) {
    if (!n.eggs || m?.kind === 'truck' || Math.hypot(player.x - n.x, player.z - n.z) > GAME.reach) continue
    const space = state.bag.max - bagCount()
    if (space <= 0) {
      if (!n.fullWarned) {
        n.fullWarned = true
        emit('toast', { text: 'Your bag is full! Restock the stand or sell in town', kind: 'warn' })
        emit('deny', {})
      }
      continue
    }
    n.fullWarned = false
    const k = Math.min(space, n.eggs)
    n.eggs -= k
    put(state.bag, 'egg', k)
    state.stats.collected += k
    changed()
    emit('collect', { n: k, x: n.x, z: n.z })
    emit('toast', { text: `+${k} eggs collected`, kind: 'good' })
    emit('nest', n)
  }
  // Restock the stand from the bag.
  const sx = FARM.stand.x
  const sz = FARM.stand.z + 2.2
  const atStand = Math.hypot(player.x - sx, player.z - sz) < GAME.standReach && m?.kind !== 'truck'
  if (atStand && !sim.near.stand && bagEggs() > 0) {
    const k = Math.min(bagEggs(), state.stand.max - state.stand.eggs)
    if (k > 0) {
      take(state.bag.items, 'egg', k)
      state.stand.eggs += k
      changed()
      emit('restock', { n: k })
      emit('toast', { text: `Restocked the stand +${k} eggs`, kind: 'good' })
    } else emit('toast', { text: 'The stand is full! Sell the rest in town', kind: 'warn' })
  }
  sim.near.stand = atStand
  // Customers buy.
  if (state.stand.eggs > 0) {
    sim.sale += dt * ((state.customersPerMin * mods.customers()) / 60)
    while (sim.sale >= 1 && state.stand.eggs > 0) {
      sim.sale -= 1
      state.stand.eggs--
      state.stats.sold++
      const amount = eggSalePrice()
      sim.batch += amount
      sim.batchN++
      state.money += amount
      state.stats.earned += amount
      changed()
    }
  } else sim.sale = Math.min(sim.sale, 1)
  sim.batchT += dt
  if (sim.batchT > 2.6 && sim.batch > 0) {
    emit('sale', { amount: sim.batch, n: sim.batchN })
    sim.batch = 0
    sim.batchN = 0
    sim.batchT = 0
  }
  // The carton packer: twelve stand eggs to a carton, waiting for the van.
  if (built('cartons')) {
    sim.packT = (sim.packT ?? 0) + dt
    if (sim.packT >= packerEvery()) {
      sim.packT = 0
      if (state.stand.eggs >= GAME.cartons.eggs && state.cartons < GAME.cartons.max) {
        state.stand.eggs -= GAME.cartons.eggs
        state.cartons++
        changed()
        emit('carton', { n: state.cartons })
      }
    }
  }
  // The town market and the storage yard (checked a few times a second).
  sim.zoneT -= dt
  if (sim.zoneT <= 0) {
    sim.zoneT = 0.4
    const atMarket = inside(player.x, player.z, FARM.townMarket.zone)
    if (atMarket) {
      if (mods.deliver) {
        if (m?.kind === 'truck') mods.deliver(truckCargo(m.k).items, [player.x, player.z])
        mods.deliver(state.bag.items, [player.x, player.z])
      }
      let sold = 0
      if (m?.kind === 'truck') sold += sellAtMarket(truckCargo(m.k).items, 1, 'truck', [player.x, player.z])
      sold += sellAtMarket(state.bag.items, 1, m?.kind === 'bike' ? 'bike' : 'walk', [player.x, player.z])
      if (sold) emit('toast', { text: `Sold at the town market! +${fmtMoney(sold)}`, kind: 'good' })
      else if (!sim.near.market) emit('toast', { text: 'Bring eggs and crops here to sell them', kind: 'info' })
    }
    sim.near.market = atMarket
    const atYard = inside(player.x, player.z, FARM.loadZone) && m?.kind !== 'horse'
    if (atYard && built('storage')) {
      if (bagCount() > 0) {
        const n = move(state.bag.items, state.storage, bagCount())
        if (n) {
          changed()
          emit('unload', { n })
          emit('toast', { text: `Put ${n} goods into storage`, kind: 'good' })
        } else if (!sim.near.load) emit('toast', { text: 'The storage is full!', kind: 'warn' })
      }
      if (m?.kind === 'truck') loadTruck(m.k)
    } else if (atYard && !sim.near.load && bagCount() > 0) emit('toast', { text: 'Build the Storage Barn to store goods here', kind: 'info' })
    sim.near.load = atYard
    // Ranch crates.
    for (const r of GAME.ranch) {
      const [cx, cz] = FARM.ranchCrates[r.id]
      if (!r.hold && ranchState(r)?.crate && Math.hypot(player.x - cx, player.z - cz) < 3) collectRanch(r, 'player')
    }
  }
  // Owned plots grow; walking (or driving a tractor) into a ripe one harvests it.
  for (const p of PLOTS) {
    if (!plotOwned(p)) continue
    if (!plotCrop(p)) {
      if (state.seeds.some((s) => s.unlocked && s.count > 0)) {
        plant(p, true)
        changed()
        emit('plot', { p, why: 'plant' })
      }
      continue
    }
    const g = plotGrowth(p)
    if (g < 1) {
      const next = Math.min(1, g + (dt * mods.grow(p)) / plotGrowTime(p))
      state.plots.grow[p.n] = next
      dirty = true
      if (next >= 1) emit('ripe', p)
    } else if (m?.kind !== 'truck') {
      const c = p.crops
      const e = 1.5 // the edge plants can be picked from just outside the crop too
      if (player.x > c.minX - e && player.x < c.maxX + e && player.z > c.minZ - e && player.z < c.maxZ + e) {
        const tractor = m?.kind === 'tractor'
        const combine = m?.kind === 'combine'
        const bonus = tractor ? GAME.tractor.harvestBonus * (1 + garageStep('engine')) + garageStep('header') : combine ? GAME.fleet[0].bonus : 0
        const reach = tractor ? PICK_REACH.tractor : combine ? PICK_REACH.combine : PICK_REACH.foot
        pickPlants(p, player.x, player.z, reach, { bonus, by: tractor ? 'player-tractor' : combine ? 'player-combine' : null })
      }
    }
  }
  work(dt)
  driveTrips(dt)
  flyDrones(dt)
  pumpOil(dt)
  raise(dt)
  // Weigh-off pumpkin grows.
  sim.weightT += dt
  if (sim.weightT > GAME.growEvery) {
    sim.weightT = 0
    state.weight++
    changed()
  }
  // Harvest Moon: on for a while, then gone until the next one.
  sim.moonT -= dt
  if (sim.moonT <= 0) {
    if (moon.active) {
      moon.active = false
      sim.moonT = GAME.moon.gap
      emit('toast', { text: `The Harvest Moon has set. The next one rises in ${fmtClock(GAME.moon.gap)}`, kind: 'moon' })
    } else {
      moon.active = true
      sim.moonT = GAME.moon.length
      emit('toast', { text: `The Harvest Moon is up! Everything sells for ${GAME.moon.bonus}x`, kind: 'moon' })
    }
  }
  moon.left = Math.max(0, sim.moonT)
  // Save now and then.
  sim.saveT += dt
  if (dirty && sim.saveT > 5) {
    sim.saveT = 0
    dirty = false
    save()
  }
}

export function fmtClock(s) {
  s = Math.max(0, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export const fmtMoney = (n) => `$${Math.floor(n).toLocaleString('en-US')}`
export function fmtLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`
}

window.addEventListener('beforeunload', save)
