import { GAME } from '../config.js'
import * as game from '../game.js'
import { addAnimal, expandRanch, feedAnimals } from '../game.js'
import { buyFeeder, careState, refill } from './care.js'

// Progression and goals (roadmap phases 6 and 7):
//  - Farm level + XP: money earned, buildings, harvests and collecting give XP;
//    levels unlock the orchard (5), the fishing lake (8) and the greenhouse (12)
//  - achievements (lifetime counters in state.life) with a trophy shelf on the
//    cottage porch
//  - prestige: sell the farm for a permanent money boost; looks, trophies and
//    best times carry over
//  - zone foremen: hired at the Farm Office, each spends up to a budget a
//    minute on the cheapest upgrade or hire in its zone
//  - combo meter: quick manual collecting builds a streak with a cash bonus
//  - rare drops: a golden egg when collecting eggs, a giant crop when harvesting

const X = GAME.xp
const st = () => game.state
const life = (k, n = 1) => (st().life[k] = (st().life[k] ?? 0) + n)

// --- Level and XP -----------------------------------------------------------------------------------
export const level = () => st().xp.level
export const xpFor = (lvl) => Math.round(X.base * Math.pow(lvl, X.pow))
export const xpProgress = () => st().xp.xp / xpFor(level())
const prevLevel = game.mods.level
game.mods.level = () => Math.max(prevLevel(), level())
export function addXp(n, why) {
  const x = st().xp
  if (x.level >= X.max || !(n > 0)) return
  x.xp += n
  let up = false
  while (x.xp >= xpFor(x.level) && x.level < X.max) {
    x.xp -= xpFor(x.level)
    x.level++
    up = true
    const cash = X.levelCash * x.level
    st().money += cash
    game.emit('levelUp', { level: x.level, cash })
    const unlocks = GAME.buildings.filter((b) => b.level === x.level)
    game.emit('toast', { text: `Level ${x.level}! +${game.fmtMoney(cash)}${unlocks.length ? ` · ${unlocks.map((b) => b.name).join(', ')} unlocked!` : ''}`, kind: 'moon' })
  }
  game.markDirty()
  game.emit('xp', { n, why, up })
}

// --- Achievements -------------------------------------------------------------------------------------
const ANIMALS = ['duckHouse', 'cowBarn', 'pigPen', 'stables', 'sheepShed', 'goatBarn', 'apiary']
export function statValue(stat) {
  if (stat === 'animalKinds') return ANIMALS.filter(game.built).length
  if (stat === 'buildings') return st().built.length
  if (stat === 'earned') return st().life.earned ?? 0
  return st().life[stat] ?? 0
}
export const unlocked = (a) => st().ach.includes(a.id)
function checkAchievements() {
  for (const a of GAME.achievements) {
    if (unlocked(a) || statValue(a.stat) < a.goal) continue
    st().ach.push(a.id)
    game.markDirty()
    addXp(200, 'achievement')
    game.emit('achievement', a)
    game.emit('toast', { text: `Achievement: ${a.name}! A ${a.medal} trophy for your shelf`, kind: 'moon' })
    game.emit('buy', { big: true })
  }
}

// --- Prestige --------------------------------------------------------------------------------------------
const P = GAME.prestige
export const canPrestige = () => (st().life.earned ?? 0) >= P.minEarned
export const nextBoost = () => Math.min(P.maxBoost, st().prestige.boost + P.step)
game.mods.boost = () => st().prestige.boost ?? 0
export function prestige() {
  if (!canPrestige()) return false
  const keep = {
    prestige: { n: st().prestige.n + 1, boost: nextBoost(), keep: {} },
    looks: st().fleet.looks,
    ach: st().ach,
    life: st().life,
    course: st().course,
    tutorial: { step: 99, done: true },
  }
  game.resetProgress()
  Object.assign(st(), { prestige: keep.prestige, ach: keep.ach, life: { ...keep.life, earned: 0 }, course: keep.course, tutorial: keep.tutorial })
  st().fleet.looks = keep.looks
  st().money = 500 * keep.prestige.n
  game.changed()
  game.emit('prestige', keep.prestige)
  game.emit('toast', { text: `You sold the farm and started again with a +${Math.round(keep.prestige.boost * 100)}% money boost!`, kind: 'moon' })
  return true
}

// --- Combo meter and rare drops ----------------------------------------------------------------------------
const CB = GAME.combo
export const combo = { n: 0, t: 0, mult: 1 }
function hit(items, at) {
  combo.n = combo.t > 0 ? combo.n + 1 : 1
  combo.t = CB.window
  combo.mult = Math.min(CB.max, 1 + CB.step * (combo.n - 1))
  if (combo.n > (st().life.bestCombo ?? 0)) st().life.bestCombo = combo.n
  if (combo.n >= 2) {
    const bonus = Math.round(CB.cash * combo.n * combo.mult * Math.max(1, Math.sqrt(items)))
    game.earn(bonus, 'combo')
    game.emit('combo', { n: combo.n, mult: combo.mult, bonus, at })
  }
  addXp(X.collect * items * combo.mult, 'collect')
}
function golden(x, z) {
  if (Math.random() >= GAME.rare.chance) return
  if (!game.put(st().bag, 'goldenEgg', 1) && !game.put(st().storage, 'goldenEgg', 1)) return
  life('golden')
  game.changed()
  game.emit('rare', { kind: 'golden', x, z })
  game.emit('toast', { text: `A GOLDEN EGG! Worth ${game.fmtMoney(GAME.goods.goldenEgg.market)} at the market`, kind: 'moon' })
}

// --- Event wiring ----------------------------------------------------------------------------------------------
game.on('collect', ({ n, x, z }) => {
  life('eggs', n)
  hit(n, [x, z])
  golden(x, z)
})
game.on('sale', ({ amount, n }) => {
  life('earned', amount)
  life('eggsSold', n)
  addXp(amount * X.perDollar, 'sale')
})
game.on('vanSold', ({ n }) => life('eggsSold', n * GAME.cartons.eggs))
game.on('earn', ({ amount, source }) => {
  if (source === 'combo') return
  life('earned', amount)
  addXp(amount * X.perDollar, source)
})
game.on('build', () => addXp(X.build, 'build'))
game.on('plot', ({ why }) => why === 'buy' && addXp(X.build, 'build'))
game.on('harvest', ({ good, n, player, giant, p }) => {
  life(`h_${good}`, n)
  addXp(X.harvest * (player ? 2 : 1), 'harvest')
  if (player) hit(n, [(p.crops.minX + p.crops.maxX) / 2, (p.crops.minZ + p.crops.maxZ) / 2])
  if (giant) {
    life('giant')
    game.emit('rare', { kind: 'giant', p, good })
    game.emit('toast', { text: `A GIANT ${GAME.goods[good].name.toUpperCase()} crop! ${GAME.rare.giant}x the harvest`, kind: 'moon' })
  }
})
game.on('ranchCollect', ({ n, by }) => by === 'player' && hit(n, null))
game.on('procCollect', ({ n, by }) => by === 'player' && hit(n, null))
game.on('contractDone', () => addXp(X.contract, 'contract'))

// --- Zone foremen ------------------------------------------------------------------------------------------------
const M = GAME.managers
export const managerState = (id) => (st().managers[id] ??= { hired: 0, budget: 1, wallet: 0, t: 0 })
export function hireManager(m) {
  const s = managerState(m.id)
  if (s.hired) return false
  if (!game.built('office')) {
    game.emit('toast', { text: 'Build the Farm Office first (by the cottage)', kind: 'warn' })
    game.emit('deny', {})
    return false
  }
  if (!game.spend(m.price, m.name)) return false
  s.hired = 1
  game.changed()
  game.emit('toast', { text: `Hired the ${m.name}! Set their budget in the Farm Office`, kind: 'good' })
  game.emit('buy', { big: true })
  return true
}
export function setBudget(m, i) {
  managerState(m.id).budget = i
  game.changed()
}
// What a foreman could buy right now: [{ price, buy }].
function options(id) {
  const out = []
  const add = (price, buy) => price > 0 && out.push({ price, buy })
  const workerOpt = (wid) => {
    const w = game.workerById(wid)
    if (game.hired(w) < game.workerCap(w)) add(game.hirePrice(w), () => game.hireWorker(w))
  }
  if (id === 'yard') {
    for (const it of GAME.shop) if (game.upgradeLevel(it.id) < it.max && (!it.needs || game.built(it.needs)) && it.id !== 'storage') add(game.upgradePrice(it), () => game.buyUpgrade(it))
    for (const b of GAME.buildings) if ((b.id === 'coop2' || b.id === 'coop3') && game.buildingReady(b)) add(b.price, () => game.buyBuilding(b))
    workerOpt('stocker')
  } else if (id === 'fields') {
    for (const p of game.PLOTS) {
      if (!game.plotOwned(p)) continue
      for (const u of GAME.plots.upgrades) if (game.plotLevel(p, u.id) < u.max) add(game.plotUpgradePrice(p, u), () => game.buyPlotUpgrade(p, u))
    }
    st().seeds.forEach((s, i) => s.unlocked && s.count < 2 && add(GAME.seeds[i].packPrice, () => game.buySeeds(i)))
    workerOpt('hand')
    workerOpt('tractor')
  } else if (id === 'ranch') {
    for (const r of game.ranchBuilt()) {
      const s = game.ranchState(r)
      if (s.n < r.max) add(game.ranchAddPrice(r), () => addAnimal(r))
      if (s.feed < GAME.feed.max) add(game.ranchFeedPrice(r), () => feedAnimals(r))
      if ((s.expand ?? 0) < GAME.expand.max) add(game.ranchExpandPrice(r), () => expandRanch(r))
      const c = careState(r)
      if (c && !c.feeder) {
        if (Math.min(c.food, c.water) < 0.5) add(1, () => refill(r, 'foreman'))
        add(Math.round((r.addPrice * GAME.care.feeder.price) / 50) * 50, () => buyFeeder(r))
      }
    }
    workerOpt('rancher')
  } else if (id === 'oil') {
    if (game.built('oilField')) {
      if (st().oil.pumps < GAME.oil.pumps) add(game.pumpPrice(), () => game.buyPump())
      for (let i = 0; i < st().oil.pumps; i++) for (const u of GAME.oil.upgrades) if (game.pumpLevel(i, u.id) < u.max) add(game.pumpUpPrice(i, u), () => game.buyPumpUpgrade(i, u))
      for (const u of [GAME.oil.tankUp, GAME.oil.refine]) if (game.oilLevel(u.id) < u.max) add(game.oilUpPrice(u), () => game.buyOilUpgrade(u))
      workerOpt('oiler')
    }
  }
  return out.sort((a, b) => a.price - b.price)
}
function runManagers(dt) {
  for (const m of M) {
    const s = st().managers[m.id]
    if (!s?.hired) continue
    const per = GAME.managerBudgets[s.budget] ?? 0
    s.wallet = Math.min(per, (s.wallet ?? 0) + (per * dt) / 60)
    s.t = (s.t ?? 0) - dt
    if (s.t > 0 || per <= 0) continue
    s.t = GAME.managerEvery
    const o = options(m.id)[0]
    if (!o || o.price > s.wallet || o.price > st().money) continue
    if (o.buy() !== false) {
      s.wallet -= o.price
      s.spent = (s.spent ?? 0) + o.price
      game.emit('manager', { m, price: o.price })
    }
  }
}

let achT = 0
export function tickProgress(dt) {
  if (combo.t > 0) {
    combo.t -= dt
    if (combo.t <= 0) {
      combo.n = 0
      combo.mult = 1
      game.emit('combo', { n: 0, mult: 1 })
    }
  }
  runManagers(dt)
  achT -= dt
  if (achT <= 0) {
    achT = 2
    checkAchievements()
  }
}
export { life as addLife }
