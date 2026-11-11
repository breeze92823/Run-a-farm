import { GAME } from '../config.js'
import * as game from '../game.js'
import { known } from './prices.js'
import { tutorialOn } from './tutorial.js'

// The contracts board in town (roadmap 2.2): three contracts at a time, each
// asking for 1-3 goods the farm can make within a time limit and paying 1.5-2x
// their market value plus a bonus (seed packs or a golden egg). Goods are
// delivered at the town market: walking, riding or driving into the SELL HERE
// square hands over whatever a contract still needs (from the bag and a driven
// truck's cargo) before the rest is sold. Expired contracts are replaced.
// The clock is play time (state.contracts.t), so contracts do not run out
// while the game is closed.

const K = GAME.contracts
const S = () => game.state.contracts
const rnd = (a, b) => a + Math.random() * (b - a)

export const contracts = () => S().list
export const timeLeft = (c) => Math.max(0, c.ends - (S().t ?? 0))
export const progress = (c) => Object.keys(c.want).reduce((a, g) => a + Math.min(c.got[g] ?? 0, c.want[g]), 0)
export const total = (c) => Object.keys(c.want).reduce((a, g) => a + c.want[g], 0)
export const wantText = (c) =>
  Object.keys(c.want)
    .map((g) => `${Math.min(c.got[g] ?? 0, c.want[g])}/${c.want[g]} ${GAME.goods[g].name}`)
    .join(' · ')

function make() {
  const level = game.mods.level()
  const pool = Object.keys(GAME.goods).filter((g) => g !== 'goldenEgg' && known(g))
  const k = Math.min(pool.length, 1 + Math.floor(Math.random() * Math.min(3, 1 + level / 4)))
  const picks = []
  while (picks.length < k) {
    const g = pool[Math.floor(Math.random() * pool.length)]
    if (!picks.includes(g)) picks.push(g)
  }
  const budget = (350 + 220 * level) * rnd(0.7, 1.3)
  const want = {}
  let value = 0
  for (const g of picks) {
    const price = GAME.goods[g].market
    const n = Math.max(K.size[0] / 2, Math.min(K.size[1] * 2, Math.round(budget / k / price)))
    want[g] = Math.round(n)
    value += want[g] * price
  }
  const pay = rnd(K.pay[0], K.pay[1])
  const unlocked = game.state.seeds.map((s, i) => (s.unlocked ? i : -1)).filter((i) => i >= 0)
  const bonus = Math.random() < 0.15 ? { kind: 'golden', n: 1 } : { kind: 'seeds', i: unlocked[Math.floor(Math.random() * unlocked.length)] ?? 0, n: K.bonusSeeds + Math.floor(level / 4) }
  const time = Math.round(rnd(K.time[0], K.time[1]) / 30) * 30
  S().next = (S().next ?? 0) + 1
  return { id: S().next, want, got: {}, reward: Math.round((value * pay) / 10) * 10, pay, bonus, time, ends: (S().t ?? 0) + time }
}
export const bonusText = (b) => (b.kind === 'golden' ? '+1 Golden Egg' : `+${b.n} ${GAME.seeds[b.i].name} seeds`)

function complete(c, at) {
  const list = S().list
  list.splice(list.indexOf(c), 1)
  S().done = (S().done ?? 0) + 1
  game.state.life.contracts = (game.state.life.contracts ?? 0) + 1
  game.earn(c.reward, 'contract')
  if (c.bonus.kind === 'seeds') game.state.seeds[c.bonus.i].count += c.bonus.n
  else game.put(game.state.storage, 'goldenEgg', 1) || game.put(game.state.bag, 'goldenEgg', 1)
  S().refillT = K.refresh
  game.changed()
  game.emit('contractDone', { c, at })
  game.emit('toast', { text: `Contract complete! +${game.fmtMoney(c.reward)} and ${bonusText(c.bonus)}`, kind: 'good' })
  game.emit('buy', { big: true })
}

// At the town market: hand over what contracts still need.
game.mods.deliver = (items, at) => {
  if (tutorialOn()) return
  let any = 0
  for (const c of [...S().list]) {
    for (const g in c.want) {
      const need = c.want[g] - (c.got[g] ?? 0)
      if (need <= 0 || !items[g]) continue
      const n = game.take(items, g, need)
      c.got[g] = (c.got[g] ?? 0) + n
      any += n
    }
    if (progress(c) >= total(c)) complete(c, at)
  }
  if (any) {
    game.changed()
    game.emit('delivered', { n: any, at })
    if (S().list.length && S().list.some((c) => progress(c) > 0)) game.emit('toast', { text: `Delivered ${any} goods to contracts`, kind: 'good' })
  }
}

export function tickContracts(dt) {
  const s = S()
  s.t = (s.t ?? 0) + dt
  for (const c of [...s.list]) {
    if (timeLeft(c) <= 0) {
      s.list.splice(s.list.indexOf(c), 1)
      game.emit('toast', { text: 'A contract expired. A new one goes up on the board soon', kind: 'warn' })
      game.emit('contracts')
      s.refillT = K.refresh
    }
  }
  s.refillT = (s.refillT ?? 0) - dt
  if (s.list.length < K.slots && s.refillT <= 0 && !tutorialOn()) {
    s.list.push(make())
    s.refillT = s.list.length < K.slots ? 1 : K.refresh
    game.markDirty()
    game.emit('contracts')
  }
}
// Tear one up for a fresh one (costs a little).
export function rerollPrice() {
  return 100 + game.mods.level() * 50
}
export function reroll(c) {
  if (!game.spend(rerollPrice(), 'a new contract')) return
  const list = S().list
  list.splice(list.indexOf(c), 1, make())
  game.changed()
  game.emit('contracts')
}
