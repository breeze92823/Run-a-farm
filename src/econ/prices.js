import { GAME } from '../config.js'
import * as game from '../game.js'
import { dayFraction } from './clock.js'

// Changing market prices (roadmap 2.3): each good's town-market price drifts
// within +-GAME.prices.drift over the in-game day on its own two slow waves,
// and one "hot item" a day (picked from the goods the farm can make) sells for
// GAME.prices.hot x. The trend (up / down) is the drift's slope.

const P = GAME.prices
const goods = Object.keys(GAME.goods)
// A fixed phase per good so they do not all move together.
const seed = Object.fromEntries(goods.map((g, i) => [g, [(i * 2.39996) % (Math.PI * 2), (i * 1.7 + 0.6) % (Math.PI * 2)]]))

const day = () => game.state.clock?.day ?? 1
const T = () => day() + dayFraction() // continuous days
function wave(g, t) {
  const [a, b] = seed[g]
  return 0.65 * Math.sin(Math.PI * 2 * t + a) + 0.35 * Math.sin(Math.PI * 2 * 2.3 * t + b)
}
export const drift = (g) => 1 + P.drift * wave(g, T())
// +1 rising, -1 falling, 0 flat.
export function trend(g) {
  const d = wave(g, T() + 0.01) - wave(g, T())
  return Math.abs(d) < 0.004 ? 0 : Math.sign(d)
}

// What the farm can make right now (the hot item is one of these).
export function known(g) {
  const st = game.state
  if (g === 'egg') return true
  if (g === 'goldenEgg') return (st.life.golden ?? 0) > 0
  const seed = st.seeds.find((s) => s.id === g)
  if (seed) return seed.unlocked
  const r = GAME.ranch.find((x) => x.good === g)
  if (r) return game.built(r.id)
  const p = GAME.proc.find((x) => x.recipes.some((rc) => rc.out === g))
  if (p) return game.built(p.id)
  if (g === 'fish') return game.built('lake')
  return false
}
let hotDay = -1
let hotGood = 'egg'
export function hotItem() {
  if (hotDay !== day()) {
    hotDay = day()
    const list = goods.filter((g) => g !== 'goldenEgg' && known(g))
    // Deterministic per day, so a reload keeps the same hot item.
    hotGood = list[(day() * 7919) % list.length] ?? 'egg'
    game.emit('hotItem', hotGood)
  }
  return hotGood
}
export const priceMult = (g) => drift(g) * (g === hotItem() ? P.hot : 1)

const prev = game.mods.price
game.mods.price = (g) => prev(g) * priceMult(g)
