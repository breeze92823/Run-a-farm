import { FARM, GAME } from '../config.js'
import * as game from '../game.js'

// Onboarding (roadmap 1.3): the first few minutes lead the player by the hand:
// collect eggs at Coop 1, restock the stand, get on the bike, sell at the town
// market, buy Coop 2. A floating arrow (farm/guide.js) marks where to go and a
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
  if (s.id === 'collect') {
    const n = game.nestState[0]
    return [n.x, n.z]
  }
  if (s.id === 'restock') return [FARM.stand.x, FARM.stand.z + 2.2]
  if (s.id === 'ride') return bikePos ? [bikePos.x, bikePos.z] : [FARM.bike.x, FARM.bike.z]
  if (s.id === 'sell') {
    const z = FARM.townMarket.zone
    return [(z.minX + z.maxX) / 2, (z.minZ + z.maxZ) / 2]
  }
  const b = game.buildingById('coop2')
  return [b.x, b.z]
}

function advance(id) {
  const s = currentStep()
  if (!s || s.id !== id) return
  st().step++
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
  game.changed()
  game.emit('tutorial', 0)
}

// An existing farm (anything built) has no need of it.
if (!st().done && (game.state.built.length > 0 || game.state.plots.owned.length > 0)) st().done = true

game.on('collect', () => advance('collect'))
game.on('restock', () => advance('restock'))
game.on('mount', (m) => m?.kind === 'bike' && advance('ride'))
game.on('market', ({ source }) => {
  // Walking all the way there is fine too.
  if (currentStep()?.id === 'ride') advance('ride')
  if (source === 'walk' || source === 'bike' || source === 'truck') advance('sell')
})
game.on('delivered', () => advance('sell'))
game.on('build', (b) => b.id === 'coop2' && advance('coop2'))
// If the bag is already full of eggs at the start, the first step is done.
game.on('change', () => {
  if (currentStep()?.id === 'collect' && game.bagEggs() > 0) advance('collect')
})
game.on('reset', () => {
  // A fresh farm starts the tutorial again (not after a prestige, which sets it done).
  st().step = 0
  st().done = false
})
