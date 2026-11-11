import { GAME } from '../config.js'
import * as game from '../game.js'

// Animal care (roadmap 4.1) and breeding (4.2). Every animal barn has a feed
// trough and a water trough that empty over time; the barn's happiness (0-100%)
// scales how fast its animals produce (down to GAME.care.min when neglected).
// The player refills them at the trough by the barn's crate (E), a Rancher
// working that barn refills them when they run low, and the Automatic Feeder
// upgrade keeps them full for good. Each animal bought with "+1 animal" is born
// a baby and grows up over GAME.babyGrow s (farm/ranch.js scales it and has it
// follow its mother). Plant-like buildings (apiary, orchard, greenhouse) need no care.

const C = GAME.care
export const cares = (r) => !r.plant
export const careState = (r) => (game.built(r.id) && cares(r) ? (game.state.care[r.id] ??= { food: 1, water: 1, feeder: 0, born: {} }) : null)
export function happiness(r) {
  const s = careState(r)
  if (!s) return 1
  if (s.feeder) return 1
  const h = Math.min(1, (s.food + s.water) / 2 + 0.15)
  return s.food <= 0 || s.water <= 0 ? h * 0.4 : h
}
export const produceK = (r) => C.min + (1 - C.min) * happiness(r)
const prev = game.mods.ranch
game.mods.ranch = (r) => prev(r) * produceK(r)

export function refill(r, by = 'player') {
  const s = careState(r)
  if (!s) return false
  const was = Math.min(s.food, s.water)
  s.food = 1
  s.water = 1
  s.warned = false
  game.changed()
  game.emit('refill', { r, by, was })
  if (by === 'player') game.emit('toast', { text: `Filled the ${r.name} troughs! Happy ${r.plural ?? r.animal + 's'}`, kind: 'good' })
  return true
}
export const feederPrice = (r) => Math.round((r.addPrice * C.feeder.price) / 50) * 50
export function buyFeeder(r) {
  const s = careState(r)
  if (!s || s.feeder) return false
  if (!game.spend(feederPrice(r), `Automatic Feeder (${r.name})`)) return false
  s.feeder = 1
  s.food = 1
  s.water = 1
  game.changed()
  game.emit('toast', { text: `Automatic Feeder installed at the ${r.name}: no more trough chores!`, kind: 'good' })
  game.emit('buy', { big: true })
  game.emit('refill', { r, by: 'feeder' })
  return true
}

// Babies: an animal's growth 0..1 (1 = grown or never recorded).
export function growth(r, i) {
  const born = game.state.care[r.id]?.born?.[i]
  if (!born) return 1
  return Math.min(1, (Date.now() - born) / (GAME.babyGrow * 1000))
}
game.on('animals', (r) => {
  const s = careState(r)
  const n = game.ranchState(r)?.n ?? 0
  if (!s || n < 1) return
  s.born[n - 1] = Date.now()
  game.markDirty()
  game.emit('toast', { text: `A baby ${r.animal} was born! It will grow up in a few minutes`, kind: 'good' })
})

let rancherT = 0
export function tickCare(dt) {
  const ranchers = game.hired(game.workerById('rancher'))
  const list = game.ranchBuilt()
  for (const r of GAME.ranch) {
    const s = careState(r)
    if (!s) continue
    if (s.feeder) {
      s.food = s.water = 1
      continue
    }
    s.food = Math.max(0, s.food - dt / C.food)
    s.water = Math.max(0, s.water - dt / C.water)
    if (happiness(r) < C.sad && !s.warned) {
      s.warned = true
      game.emit('toast', { text: `The ${r.name} animals are hungry and thirsty! Refill their troughs`, kind: 'warn' })
    }
  }
  // Ranchers top up the troughs of the barn they look after.
  rancherT -= dt
  if (rancherT <= 0) {
    rancherT = 5
    for (let k = 0; k < Math.min(ranchers, list.length); k++) {
      const s = careState(list[k])
      if (s && !s.feeder && Math.min(s.food, s.water) < C.refillBelow) refill(list[k], 'rancher')
    }
  }
}
