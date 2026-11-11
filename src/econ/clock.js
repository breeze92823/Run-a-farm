import { GAME } from '../config.js'
import * as game from '../game.js'

// The farm's clock (roadmap 3.1-3.3): an in-game day of GAME.clock.day seconds
// (80% light, 20% night) that drives the sky, the weather and the seasons.
//  - night: hens lay slower, fewer customers come; lamps, headlights and barn
//    lights glow (lighting.js eases toward the clock's night level)
//  - weather: clear / rain (crops grow faster) / wind (drones fly slower, the
//    wheat sways harder) / storm (lightning, thunder, vehicles slow down)
//  - seasons: GAME.seasons.days days each, autumn first; spring is a planting
//    bonus, summer brings customers
//  - the Pumpkin Weigh-off Festival on the last autumn day, judged at its end
// State lives in game.state.clock so it is saved and reset with the farm.

const C = GAME.clock
const W = GAME.weather
const S = GAME.seasons

const fresh = () => ({ t: C.start * C.day, day: 1, weather: 'clear', wt: 90, judged: 0 })
const st = () => (game.state.clock ??= fresh())

export const clock = {
  night: 0, // 0..1, eased
  hour: 6,
  minute: 0,
  season: 'autumn',
  weather: 'clear',
  wind: 0, // 0..1 extra gustiness
  rain: 0, // 0..1 how hard it rains
  storm: 0,
  festival: false,
}

// 0 = dawn (6:00) .. 1 = next dawn; the light part of the day takes C.light of the real time.
export function dayFraction() {
  return st().t / C.day
}
function hourOf(f) {
  // 6:00 -> 20:00 over the light part, 20:00 -> 6:00 over the night part.
  if (f < C.light) return 6 + (f / C.light) * 14
  return (20 + ((f - C.light) / (1 - C.light)) * 10) % 24
}
// How dark it is at day fraction f: dusk and dawn blend over ~an hour.
function nightAt(f) {
  const h = hourOf(f)
  if (h >= 20.5 || h < 5.5) return 1
  if (h >= 19 && h < 20.5) return (h - 19) / 1.5
  if (h >= 5.5 && h < 7) return 1 - (h - 5.5) / 1.5
  return 0
}
export const seasonIndex = () => Math.floor((st().day - 1) / S.days) % S.order.length
export const seasonDay = () => ((st().day - 1) % S.days) + 1
export const seasonDef = () => S[clock.season]
export const fmtTime = () => `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`

function pickWeather() {
  const odds = { ...W.odds }
  if (clock.season === 'summer') odds.rain *= 0.6
  if (clock.season === 'spring') odds.rain *= 1.4
  let r = Math.random() * Object.values(odds).reduce((a, b) => a + b, 0)
  for (const k in odds) {
    r -= odds[k]
    if (r <= 0) return k
  }
  return 'clear'
}
export function setWeather(kind, seconds = null) {
  const s = st()
  s.weather = kind
  s.wt = seconds ?? W.every[0] + Math.random() * (W.every[1] - W.every[0])
  game.markDirty()
  game.emit('weather', kind)
  const names = { clear: 'The sky clears up', rain: 'Rain! Crops grow faster', wind: 'A strong wind: drones fly slower', storm: 'A storm rolls in: vehicles slow down' }
  game.emit('toast', { text: names[kind], kind: 'info' })
}
// Skips to the next dawn or dusk (N key / Settings).
export function skipToNext() {
  const s = st()
  const f = s.t / C.day
  if (f < C.light) s.t = C.light * C.day + 1
  else {
    s.t = 0.02 * C.day
    s.day++
    game.emit('newDay', s.day)
  }
  game.markDirty()
}

// Effects on the economy (game.mods).
function install() {
  const prevLay = game.mods.lay
  game.mods.lay = () => prevLay() * (1 - clock.night * (1 - C.night.lay))
  const prevCust = game.mods.customers
  game.mods.customers = () => prevCust() * (1 - clock.night * (1 - C.night.customers)) * (S[clock.season]?.customers ?? 1) * (clock.festival ? 1.5 : 1)
  const prevGrow = game.mods.grow
  game.mods.grow = (p) => {
    let k = prevGrow(p) * (S[clock.season]?.grow ?? 1)
    if (clock.weather === 'rain') k *= W.rain.grow
    if (clock.weather === 'storm') k *= W.storm.grow
    return k
  }
  const prevDrone = game.mods.drone
  game.mods.drone = () => prevDrone() * (clock.weather === 'wind' || clock.weather === 'storm' ? W.wind.drone : 1)
  const prevSeed = game.mods.seedPack
  game.mods.seedPack = () => prevSeed() * (1 + (clock.season === 'spring' ? S.spring.seedBonus : 0))
}
install()

let lighting = null
let flash = 0
let nextBolt = 6
export function attachLighting(l) {
  lighting = l
}

// Festival: judged once when it ends (on the last autumn day).
function festivalTick(f) {
  const s = st()
  const F = GAME.festival
  const lastAutumnDay = clock.season === 'autumn' && seasonDay() === S.days
  const on = lastAutumnDay && f >= F.from && f < F.to
  if (on !== clock.festival) {
    clock.festival = on
    game.emit('festival', on)
    if (on) game.emit('toast', { text: 'The Pumpkin Weigh-off Festival has begun! Visitors pour in', kind: 'moon' })
  }
  if (lastAutumnDay && f >= F.to && s.judged !== s.day) {
    s.judged = s.day
    const lb = game.state.weight
    const prize = Math.round(lb * F.perLb)
    game.earn(prize, 'festival')
    game.emit('judged', { lb, prize })
    game.emit('toast', { text: `The judges weighed your pumpkin: ${lb} lb! Prize ${game.fmtMoney(prize)}`, kind: 'good' })
    game.emit('buy', { big: true })
  }
}

export function tickClock(dt) {
  const s = st()
  s.t += dt
  if (s.t >= C.day) {
    s.t -= C.day
    s.day++
    game.emit('newDay', s.day)
    const season = S.order[seasonIndex()]
    if (season !== clock.season) game.emit('toast', { text: `${S[season].name} has arrived!`, kind: 'moon' })
  }
  const f = s.t / C.day
  const h = hourOf(f)
  clock.hour = Math.floor(h)
  clock.minute = Math.floor((h % 1) * 60)
  const wasNight = clock.night > 0.5
  clock.night = nightAt(f)
  if (wasNight !== clock.night > 0.5) game.emit(clock.night > 0.5 ? 'nightfall' : 'dawn')
  const season = S.order[seasonIndex()]
  if (season !== clock.season) {
    clock.season = season
    game.emit('season', season)
  }
  // Weather.
  s.wt -= dt
  if (s.wt <= 0) setWeather(pickWeather())
  clock.weather = s.weather
  const ease = Math.min(1, dt * 0.4)
  clock.rain += ((s.weather === 'rain' || s.weather === 'storm' ? 1 : 0) - clock.rain) * ease
  clock.wind += ((s.weather === 'wind' ? 1 : s.weather === 'storm' ? 0.8 : 0) - clock.wind) * ease
  clock.storm += ((s.weather === 'storm' ? 1 : 0) - clock.storm) * ease
  // Lightning.
  flash = Math.max(0, flash - dt * 4)
  if (s.weather === 'storm') {
    nextBolt -= dt
    if (nextBolt <= 0) {
      nextBolt = W.storm.lightning[0] + Math.random() * (W.storm.lightning[1] - W.storm.lightning[0])
      flash = 1
      game.emit('lightning', { delay: 0.4 + Math.random() * 1.6 })
    }
  }
  festivalTick(f)
  game.markDirty()
  if (lighting) {
    lighting.setNightTarget(clock.night)
    lighting.setWeather(Math.min(1, clock.rain * 0.7 + clock.storm * 0.35), flash > 0.5 ? flash : 0)
  }
}
game.on('reset', () => {
  game.state.clock = fresh()
  clock.festival = false
})
