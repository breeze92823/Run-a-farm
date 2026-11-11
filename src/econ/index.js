import { tickClock, attachLighting } from './clock.js'
import './prices.js'
import { tickProcessing } from './processing.js'
import { tickContracts } from './contracts.js'
import { tickCare } from './care.js'
import { tickProgress } from './progress.js'
import './tutorial.js'
import { tickFleet } from './fleet.js'
import { tickMinigames } from './minigames.js'

// The roadmap's systems on top of game.js (each module hooks game.mods and
// listens to game events). main.js calls tickEcon once a frame after game.tick.

const p = { x: 0, z: 0, vx: 0, vz: 0 }
export function installEcon({ lighting }) {
  attachLighting(lighting)
}
export function tickEcon(dt, player) {
  p.x = player.renderPosition.x
  p.z = player.renderPosition.z
  p.vx = player.velocity.x
  p.vz = player.velocity.z
  tickClock(dt)
  tickProcessing(dt, p)
  tickContracts(dt)
  tickCare(dt)
  tickProgress(dt)
  tickFleet(dt, p)
  tickMinigames(dt, p, !player.grounded)
}
