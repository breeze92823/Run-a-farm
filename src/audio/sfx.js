import { A, onStart, ready, voice } from './core.js'
import { burst, crinkle, modal, rnd, tone, bubbles } from './synth.js'
import { place, posLoop, quack as duckQuack, register, voiced } from './farm.js'

// The newer farm sounds, all synthesised and placed in space like audio/farm.js:
//  - building: hammer knocks, a rising whoosh and a fanfare as a building rises
//  - vehicles: one engine loop for whatever the player rides (bike freewheel
//    ticks, truck diesel, tractor putter), the van's engine and horn, truck
//    loading thuds, the bike bell
//  - drones: a buzzing rotor loop per drone, take-off whoosh
//  - oil: pump-jack thumps and creaks, oil gurgles, the train's brakes and steam
//  - animals: moos, oinks, neighs and hoof clops, quacks
//  - money: the cash register at the town market, carton thumps

const ok = (x, z, far, s = 1, pr = 0.5, near, key = null, gap) => {
  if (!ready()) return null
  const p = place(x, z, far, near)
  if (p.level < 0.02 || !voice(s, pr, key, gap)) return null
  p.t = A.ctx.currentTime + 0.02
  return p
}

// --- Building -------------------------------------------------------------------------------------------
export function build(x, z) {
  const p = ok(x, z, 120, 2.5, 1, 10, 'build', 0.6)
  if (!p) return
  const { t, pan, verb, level } = p
  for (let i = 0; i < 5; i++) modal({ t: t + i * 0.16, f: rnd(180, 260), modes: [[1, 1, 0.09], [2.3, 0.6, 0.06], [4.4, 0.3, 0.04]], gain: 0.35 * level, pan, verb, strike: 0.6, bus: A.sfx })
  burst({ t: t + 0.3, noise: 'pink', type: 'bandpass', f: 200, f2: 1600, q: 0.7, a: 0.6, d: 0.5, gain: 0.25 * level, pan, verb: verb + 0.2, bus: A.sfx })
  burst({ t: t + 0.4, noise: 'brown', type: 'lowpass', f: 300, a: 0.3, d: 1.2, gain: 0.35 * level, pan, verb, bus: A.sfx }) // rumble out of the ground
  const notes = [392, 523, 659, 784, 1046]
  notes.forEach((f, i) => tone({ t: t + 1.0 + i * 0.09, type: 'triangle', f, d: 0.5, a: 0.004, gain: 0.12 * level, pan, verb: 0.5, bus: A.sfx }))
  crinkle({ t: t + 1.2, n: 14, dur: 0.6, gain: 0.06 * level, f0: 5000, f1: 10000, width: 0.8, bus: A.sfx })
}

// --- Money -------------------------------------------------------------------------------------------
export function till(x, z) {
  register(x, z)
}
export function cartonThump(x, z) {
  const p = ok(x, z, 26, 0.4, 0.3, undefined, 'carton', 0.08)
  if (!p) return
  burst({ t: p.t, noise: 'pink', type: 'lowpass', f: 700, a: 0.002, d: 0.07, gain: 0.25 * p.level, pan: p.pan, verb: p.verb })
  modal({ t: p.t, f: rnd(240, 300), modes: [[1, 1, 0.06], [2.1, 0.4, 0.04]], gain: 0.12 * p.level, pan: p.pan, verb: p.verb, bus: A.sfx })
}
export function crateThud(x, z, n = 3) {
  const p = ok(x, z, 40, 1, 0.5, undefined, 'crate', 0.3)
  if (!p) return
  for (let i = 0; i < Math.min(5, n); i++) modal({ t: p.t + i * rnd(0.09, 0.14), f: rnd(130, 190), modes: [[1, 1, 0.12], [2.2, 0.5, 0.07], [3.9, 0.3, 0.05]], gain: 0.32 * p.level, pan: p.pan, verb: p.verb, strike: 0.5, bus: A.sfx })
}

// --- Vehicles ---------------------------------------------------------------------------------------------
export function bikeBell() {
  if (!ready() || !voice(0.8, 0.8, 'bell', 0.2)) return
  const t = A.ctx.currentTime + 0.02
  for (let i = 0; i < 2; i++) modal({ t: t + i * 0.13, f: 2600, modes: [[1, 1, 0.5], [2.3, 0.5, 0.3], [3.6, 0.25, 0.2]], beat: 7, gain: 0.12, strike: 0.2, bus: A.sfx })
}
export function engineStart(kind) {
  if (kind === 'bike') return bikeBell()
  if (!ready() || !voice(1.2, 0.8, 'engineStart', 0.4)) return
  const t = A.ctx.currentTime + 0.02
  const f = kind === 'tractor' ? 38 : 48
  for (let i = 0; i < 6; i++) burst({ t: t + i * 0.09, noise: 'brown', type: 'lowpass', f: 260, a: 0.004, d: 0.07, gain: 0.3, bus: A.sfx })
  tone({ t: t + 0.5, type: 'sawtooth', f: f * 0.7, f2: f * 1.6, glide: 0.35, d: 0.5, a: 0.05, gain: 0.12, lp: 500, bus: A.sfx })
}
export function horn(x, z) {
  const p = ok(x, z, 120, 1.2, 0.8, 6, 'vanHorn', 0.5)
  if (!p) return
  for (const [at, len] of [[0, 0.18], [0.26, 0.34]]) for (const f of [415, 523]) tone({ t: p.t + at, type: 'square', f, a: 0.01, hold: len, d: 0.06, gain: 0.05 * p.level, pan: p.pan, verb: p.verb, lp: 1600, bus: A.sfx })
}
export function doorSlam(x, z) {
  const p = ok(x, z, 40, 0.5, 0.4, undefined, 'door', 0.15)
  if (!p) return
  burst({ t: p.t, noise: 'brown', type: 'lowpass', f: 400, a: 0.002, d: 0.12, gain: 0.4 * p.level, pan: p.pan, verb: p.verb })
  modal({ t: p.t, f: 140, modes: [[1, 1, 0.1], [2.6, 0.4, 0.05]], gain: 0.2 * p.level, pan: p.pan, verb: p.verb, bus: A.sfx })
}

// An engine loop: a sawtooth + sub through a lowpass with a little roughness;
// set(level, rpm 0..1, pan, verb) every frame.
function engineLoop(base, cutoff, rough) {
  const ctx = A.ctx
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const sub = ctx.createOscillator()
  sub.type = 'square'
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  lp.Q.value = 2
  const am = ctx.createGain()
  am.gain.value = 1 - rough
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  depth.gain.value = rough
  lfo.connect(depth).connect(am.gain)
  const subG = ctx.createGain()
  subG.gain.value = 0.5
  osc.connect(lp)
  sub.connect(subG).connect(lp)
  lp.connect(am)
  const out = posLoop(am, A.engine ?? A.sfx)
  osc.start()
  sub.start()
  lfo.start()
  return {
    set(level, rpm, pan = 0, verb = 0.1) {
      const now = ctx.currentTime
      const f = base * (1 + rpm * 1.6)
      osc.frequency.setTargetAtTime(f, now, 0.08)
      sub.frequency.setTargetAtTime(f / 2, now, 0.08)
      lfo.frequency.setTargetAtTime(f / 4, now, 0.08)
      lp.frequency.setTargetAtTime(cutoff * (1 + rpm), now, 0.1)
      out.set(level, pan, verb)
    },
  }
}
// The drones' rotor whine: a few detuned saws, high and buzzy.
function rotorLoop() {
  const ctx = A.ctx
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 900
  bp.Q.value = 0.7
  const oscs = [190, 197, 203, 211].map((f) => {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    o.connect(bp)
    o.start()
    return o
  })
  const out = posLoop(bp, A.sfx)
  return {
    set(level, rpm, pan, verb) {
      const now = ctx.currentTime
      oscs.forEach((o, i) => o.frequency.setTargetAtTime((180 + i * 7) * (0.8 + rpm * 0.5), now, 0.15))
      out.set(level, pan, verb)
    },
  }
}

const loops = { ride: null, van: null, rotors: [], trains: null }
onStart(() => {
  loops.ride = { bike: null, truck: engineLoop(46, 380, 0.25), tractor: engineLoop(34, 300, 0.55) }
  loops.van = engineLoop(52, 420, 0.2)
  loops.rotors = [0, 1, 2, 3].map(rotorLoop)
})
// The player's own vehicle (not placed: the player is in it). kind null = off.
let tickT = 0
export function rideEngine(kind, speed, top, dt) {
  if (!ready() || !loops.ride) return
  for (const k of ['truck', 'tractor']) loops.ride[k].set(kind === k ? 0.08 + Math.min(1, speed / top) * 0.07 : 0, Math.min(1, speed / top))
  if (kind === 'bike' && speed > 1) {
    // Freewheel ticks, faster with speed.
    tickT -= dt
    if (tickT <= 0) {
      tickT = 0.9 / (1 + speed)
      if (voice(0.1, 0.1)) modal({ t: A.ctx.currentTime + 0.01, f: 5200, modes: [[1, 1, 0.012]], gain: 0.035, bus: A.sfx })
    }
  }
}
// The van, wherever it is (level 0 when gone).
export function vanEngine(x, z, moving, on) {
  if (!ready() || !loops.van) return
  if (!on) return loops.van.set(0, 0)
  const p = place(x, z, 70, 6)
  loops.van.set(0.16 * p.level, moving ? 0.6 : 0.1, p.pan, p.verb)
}
export function rotor(k, x, z, on, rpm) {
  const r = loops.rotors[k]
  if (!ready() || !r) return
  if (!on) return r.set(0, 0, 0, 0)
  const p = place(x, z, 60, 4)
  r.set(0.045 * p.level, rpm, p.pan, p.verb)
}
export function liftOff(x, z) {
  const p = ok(x, z, 60, 1.4, 0.4, undefined, 'liftOff', 0.3)
  if (!p) return
  burst({ t: p.t, noise: 'pink', type: 'bandpass', f: 300, f2: 1400, q: 0.8, a: 0.4, d: 0.8, gain: 0.2 * p.level, pan: p.pan, verb: p.verb, bus: A.sfx })
  tone({ t: p.t, f: 880, f2: 1320, d: 0.25, a: 0.01, gain: 0.05 * p.level, pan: p.pan, bus: A.sfx })
}
export function pickupBeep(x, z) {
  const p = ok(x, z, 60, 0.6, 0.4, undefined, 'pickup', 0.2)
  if (!p) return
  tone({ t: p.t, f: 1320, d: 0.08, a: 0.002, gain: 0.07 * p.level, pan: p.pan, bus: A.sfx })
  tone({ t: p.t + 0.1, f: 1760, d: 0.12, a: 0.002, gain: 0.07 * p.level, pan: p.pan, bus: A.sfx })
}

// --- Oil ---------------------------------------------------------------------------------------------
export function pumpThump(x, z) {
  const p = ok(x, z, 50, 0.6, 0.3, 4)
  if (!p) return
  burst({ t: p.t, noise: 'brown', type: 'lowpass', f: 160, a: 0.01, d: 0.25, gain: 0.4 * p.level, pan: p.pan, verb: p.verb })
  modal({ t: p.t + 0.05, f: rnd(95, 115), modes: [[1, 1, 0.2], [2.4, 0.4, 0.1]], gain: 0.15 * p.level, pan: p.pan, verb: p.verb, bus: A.sfx })
  if (Math.random() < 0.4) voiced({ t: p.t + 0.3, f: rnd(300, 420), f2: rnd(240, 300), d: 0.3, a: 0.05, formants: [[700, 6, 1], [1500, 8, 0.5]], gain: 0.04 * p.level, pan: p.pan, verb: p.verb, type: 'sawtooth', bus: A.sfx }) // creak
}
export function gurgle(x, z) {
  const p = ok(x, z, 40, 1, 0.3)
  if (!p) return
  bubbles({ t: p.t, n: 8, dur: 0.6, f0: 180, f1: 520, gain: 0.08 * p.level, verb: p.verb, bus: A.sfx })
}
export function trainBrake(x, z) {
  const p = ok(x, z, 60, 2.5, 0.8, 8)
  if (!p) return
  tone({ t: p.t, type: 'sawtooth', f: 2100, f2: 1700, d: 1.8, a: 0.3, gain: 0.03 * p.level, pan: p.pan, verb: p.verb + 0.2, lp: 3500, bus: A.sfx })
  burst({ t: p.t + 1.8, noise: 'white', type: 'highpass', f: 2500, a: 0.05, d: 1.4, gain: 0.25 * p.level, pan: p.pan, verb: p.verb, bus: A.sfx }) // steam hiss
}
export function clank(x, z) {
  const p = ok(x, z, 80, 0.8, 0.5, undefined, 'clank', 0.2)
  if (!p) return
  modal({ t: p.t, f: rnd(300, 420), modes: [[1, 1, 0.3], [2.76, 0.5, 0.2], [5.4, 0.3, 0.1]], beat: 3, gain: 0.25 * p.level, pan: p.pan, verb: p.verb, strike: 0.5, bus: A.sfx })
}

// --- Animals -----------------------------------------------------------------------------------------
export function moo(x, z) {
  const p = ok(x, z, 70, 2, 0.6)
  if (!p) return
  const f = rnd(95, 125)
  voiced({ t: p.t, f: f * 0.9, curve: new Float32Array([f * 0.9, f * 1.05, f * 1.1, f * 1.05, f * 0.8]), a: 0.12, hold: rnd(0.5, 0.9), d: 0.4, formants: [[rnd(380, 450), 4, 1], [rnd(800, 950), 6, 0.6], [2400, 8, 0.15]], gain: 0.32 * p.level, pan: p.pan, verb: p.verb, breath: 0.35, vib: [5, 12], lp: 2200, bus: A.sfx })
}
export function oink(x, z) {
  const p = ok(x, z, 45, 0.8, 0.5)
  if (!p) return
  const n = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    const t = p.t + i * rnd(0.16, 0.24)
    voiced({ t, f: rnd(170, 230), f2: rnd(130, 160), d: rnd(0.1, 0.16), a: 0.01, formants: [[rnd(600, 750), 3, 1], [1800, 5, 0.5]], gain: 0.22 * p.level, pan: p.pan, verb: p.verb, breath: 0.6, am: [rnd(45, 70), 0.85], type: 'sawtooth', bus: A.sfx })
  }
}
export function neigh(x, z) {
  const p = ok(x, z, 90, 2, 0.6)
  if (!p) return
  const f = rnd(420, 520)
  voiced({ t: p.t, f: f * 1.3, curve: new Float32Array([f * 1.25, f * 1.45, f * 1.3, f * 1.1, f * 0.9, f * 0.7, f * 0.55]), a: 0.04, hold: 0.6, d: 0.35, formants: [[900, 3, 1], [1900, 5, 0.6], [3000, 7, 0.2]], gain: 0.16 * p.level, pan: p.pan, verb: p.verb + 0.1, breath: 0.4, vib: [11, 70], bus: A.sfx })
  burst({ t: p.t + 1.1, noise: 'pink', type: 'bandpass', f: 500, q: 1, a: 0.02, d: 0.3, gain: 0.15 * p.level, pan: p.pan, verb: p.verb }) // snort
}
export function clop(x, z) {
  const p = ok(x, z, 30, 0.3, 0.2)
  if (!p) return
  modal({ t: p.t, f: rnd(700, 900), modes: [[1, 1, 0.04], [2.2, 0.5, 0.03]], gain: 0.1 * p.level, pan: p.pan, verb: p.verb, strike: 0.3, bus: A.sfx })
}
export function quack(x, z) {
  duckQuack(x, z)
}
