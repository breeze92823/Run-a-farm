import { FARM, GAME, parkAt } from '../config.js'
import * as game from '../game.js'
import { mount } from '../mount.js'
import { addLife } from './progress.js'

// Small hands-on activities:
//  - fishing at the lake dock (roadmap 6.1 zone): cast, wait for a bite, press
//    E in time; the fish goes into the bag
//  - the jumping course in the horse arena (4.5): ride a horse into the arena
//    and clear the jumps in order (airborne = clean, knocked = time penalty),
//    grab the floating clocks for time off; finishing pays prize money that
//    grows with speed and records a best time

// --- Fishing ---------------------------------------------------------------------------------------------
const FI = GAME.fishing
export const fishing = { phase: 'idle', t: 0, size: 0 }
export function cast() {
  if (fishing.phase === 'wait') return
  if (fishing.phase === 'bite') return reel()
  if (game.bagCount() >= game.state.bag.max) {
    game.emit('toast', { text: 'Your bag is full!', kind: 'warn' })
    game.emit('deny', {})
    return
  }
  fishing.phase = 'wait'
  fishing.t = FI.wait[0] + Math.random() * (FI.wait[1] - FI.wait[0])
  game.emit('fish', { phase: 'cast' })
}
function reel() {
  let r = Math.random()
  let n = 1
  for (const [p, k] of FI.weights) {
    if (r < p) {
      n = k
      break
    }
    r -= p
  }
  const got = game.put(game.state.bag, 'fish', n)
  fishing.phase = 'idle'
  addLife('fish', got)
  game.changed()
  game.emit('fish', { phase: 'catch', n: got })
  game.emit('toast', { text: n >= 4 ? `A WHOPPER! +${got} fish` : `Caught ${got} fish!`, kind: 'good' })
}
function tickFishing(dt, player) {
  if (fishing.phase === 'idle') return
  const [dx, dz] = parkAt(FARM.lake.dock, 9, 0) // the casting spot on the dock
  if (Math.hypot(player.x - dx, player.z - dz) > 8) {
    fishing.phase = 'idle'
    game.emit('fish', { phase: 'reel-in' })
    return
  }
  fishing.t -= dt
  if (fishing.phase === 'wait' && fishing.t <= 0) {
    fishing.phase = 'bite'
    fishing.t = FI.window
    game.emit('fish', { phase: 'bite' })
  } else if (fishing.phase === 'bite' && fishing.t <= 0) {
    fishing.phase = 'idle'
    game.emit('fish', { phase: 'lost' })
    game.emit('toast', { text: 'It got away! Press E faster when it bites', kind: 'warn' })
  }
}

// --- Jumping course -------------------------------------------------------------------------------------
const CO = GAME.course
const A = FARM.arena
const JUMPS = FARM.arenaCourse
// Floating clocks between the jumps.
export const CLOCKS = JUMPS.slice(0, CO.clocks).map(([x, z], i) => {
  const [nx, nz] = JUMPS[i + 1]
  return [(x + nx) / 2, (z + nz) / 2]
})
export const course = { on: false, t: 0, next: 0, penalty: 0, bonus: 0, clocks: [], jumps: [] }
const inArena = (x, z) => x > A.minX && x < A.maxX && z > A.minZ && z < A.maxZ
function tickCourse(dt, player, airborne) {
  const riding = mount.active?.kind === 'horse'
  const inside = inArena(player.x, player.z)
  if (!course.on) {
    if (riding && inside && course.cool <= 0) {
      Object.assign(course, { on: true, t: 0, next: 0, penalty: 0, bonus: 0, clocks: CLOCKS.map(() => true), jumps: JUMPS.map(() => null) })
      game.emit('course', { phase: 'start' })
      game.emit('toast', { text: `Jumping course! Clear the ${JUMPS.length} jumps in order`, kind: 'moon' })
    }
    course.cool = Math.max(0, (course.cool ?? 0) - dt)
    return
  }
  if (!riding || !inside) {
    course.on = false
    course.cool = 3
    game.emit('course', { phase: 'abort' })
    game.emit('toast', { text: 'Course abandoned', kind: 'warn' })
    return
  }
  course.t += dt
  CLOCKS.forEach(([x, z], i) => {
    if (course.clocks[i] && Math.hypot(player.x - x, player.z - z) < 2.4) {
      course.clocks[i] = false
      course.bonus += CO.bonus
      game.emit('course', { phase: 'clock', i, x, z })
    }
  })
  const [jx, jz] = JUMPS[course.next]
  if (Math.hypot(player.x - jx, player.z - jz) < 3) {
    const clean = airborne
    course.jumps[course.next] = clean
    if (!clean) course.penalty += CO.penalty
    game.emit('course', { phase: 'jump', i: course.next, clean, x: jx, z: jz })
    course.next++
    if (course.next >= JUMPS.length) finish()
  }
}
export const courseTime = () => Math.max(1, course.t + course.penalty - course.bonus)
function finish() {
  const time = courseTime()
  course.on = false
  course.cool = 6
  const best = game.state.course.best
  const record = !best || time < best
  if (record) game.state.course.best = Math.round(time * 100) / 100
  const prize = Math.round((CO.prize * Math.max(0.3, Math.min(1.6, CO.par / time))) / 10) * 10
  addLife('courses')
  game.earn(prize, 'course')
  game.changed()
  game.emit('course', { phase: 'finish', time, prize, record })
  game.emit('toast', { text: `Finished in ${time.toFixed(1)}s${record ? ' - a new best!' : ''} Prize ${game.fmtMoney(prize)}`, kind: 'good' })
  game.emit('buy', { big: true })
}

export function tickMinigames(dt, player, airborne) {
  tickFishing(dt, player)
  tickCourse(dt, player, airborne)
}
