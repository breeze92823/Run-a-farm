import { FARM, GAME } from '../config.js'
import * as game from '../game.js'

// Onboarding (roadmap 1.3): the first few minutes lead the player by the hand:
// collect eggs at Coop 1, sell them at the stand, collect again, get on the bike,
// sell at the town market, buy Coop 2, buy the Farm Office. A floating arrow (farm/guide.js) marks where to go and a
// HUD hint with a compass arrow says what to do. Progress is saved; Settings
// can skip it; it never shows again once finished. Saves that are already
// past the start (anything built) skip it.

const T = GAME.tutorial
const st = () => game.state.tutorial
export const tutorialOn = () => !st().done && st().step < T.length
export const currentStep = () => (tutorialOn() ? T[st().step] : null)

// Where the current step wants the player (x, z), or null.
export function stepTarget(bikePos) {
  const s = currentStep()
  if (!s) return null
  if (s.id === 'collect' || s.id === 'collect2') {
    const n = game.nestState[0]
    return [n.x, n.z]
  }
  if (s.id === 'ride') return bikePos ? [bikePos.x, bikePos.z] : [FARM.bike.x, FARM.bike.z]
  if (s.id === 'stand') return [FARM.stand.x, FARM.stand.z + 2.2]
  if (s.id === 'market') {
    const z = FARM.townMarket.zone
    return [(z.minX + z.maxX) / 2, (z.minZ + z.maxZ) / 2]
  }
  const b = game.buildingById(s.id === 'office' ? 'office' : 'coop2')
  return [b.x, b.z]
}

// The save keeps the current step's id next to its index, so a save stays on the same step when the
// step list changes (`settle` re-finds it by id).
function mark() {
  st().id = T[st().step]?.id ?? null
}

function advance(id) {
  const s = currentStep()
  if (!s || s.id !== id) return
  st().step++
  mark()
  if (st().step >= T.length) {
    st().done = true
    game.emit('toast', { text: 'Tutorial complete! Keep growing your farm', kind: 'moon' })
  }
  game.changed()
  game.emit('tutorial', st().step)
}
export function skipTutorial() {
  st().done = true
  game.changed()
  game.emit('tutorial', st().step)
}
export function restartTutorial() {
  st().done = false
  st().step = 0
  mark()
  game.changed()
  game.emit('tutorial', 0)
}

// An existing farm (anything built) has no need of it. Runs at load and again after a save from the
// server replaces the state (hydrate).
// The 5-step order saves from before the step id was stored used (index -> id); their 'sell' was the
// stand sale.
const LEGACY = ['collect', 'ride', 'stand', 'coop2', 'office']
function settle() {
  if (!st().done && (game.state.built.length > 0 || game.state.plots.owned.length > 0)) st().done = true
  if (st().done) return
  const id = st().id ?? (st().step > 0 ? LEGACY[st().step] : T[0].id)
  const i = T.findIndex((s) => s.id === id)
  if (i >= 0) st().step = i
  mark()
}
settle()

// Selling at the town market counts even if the bike step was skipped (walked there).
function soldAtMarket() {
  advance('ride')
  advance('market')
}

game.on('collect', () => {
  advance('collect')
  advance('collect2')
})
// The first sale is at the egg stand (restocking it brings the customers).
game.on('sale', () => advance('stand'))
game.on('mount', (m) => m?.kind === 'bike' && advance('ride'))
game.on('market', ({ source }) => {
  if (source === 'walk' || source === 'bike' || source === 'truck') soldAtMarket()
})
game.on('delivered', soldAtMarket)
game.on('build', (b) => {
  if (b.id === 'coop2') advance('coop2')
  if (b.id === 'office') advance('office')
})
// If the bag is already full of eggs at the start, the first step is done.
game.on('change', () => {
  if (currentStep()?.id === 'collect' && game.bagEggs() > 0) advance('collect')
  // Buildings bought before their step came up must not leave the tutorial stuck on it.
  for (let id = currentStep()?.id; id === 'coop2' || id === 'office'; id = currentStep()?.id) {
    if (!game.built(id)) break
    advance(id)
  }
})
// `reset` fires for a new farm (resetProgress: fresh state, tutorial at step 0; a prestige then marks it
// done) and after a server save is loaded (hydrate: the saved tutorial state). Either way the state
// already holds the right values, so it must not be touched here (it used to restart the tutorial on
// every login).
game.on('reset', settle)
