import { FARM } from '../config.js'
import { A, onStart, ready, voice } from './core.js'
import { burst, modal, rnd, tone } from './synth.js'
import { place } from './farm.js'

// Sounds for the roadmap systems, all synthesised like the rest:
//  - horns (classic, air horn, a tune, a moo), the level-up fanfare, combo ticks
//    that climb in pitch, splashes and a fishing bite, shearing clippers
//  - weather beds: rain on the farm (a hiss with drips), storm wind, thunder
//    rolling in after a lightning flash
//  - background music: one gentle generated track per zone (farm, town, ranch,
//    oil field) that crossfades as the player moves between them

const now = () => A.ctx.currentTime + 0.02
const ok = (s = 0.5, p = 1) => ready() && voice(s, p)

// --- One-shots --------------------------------------------------------------------------------------------
export function customHorn(id) {
  if (!ok(1.2, 0.9)) return
  const t = now()
  const sq = (f, at, len, g = 0.06) => tone({ t: t + at, type: 'square', f, a: 0.01, hold: len, d: 0.06, gain: g, lp: 1800, bus: A.sfx })
  if (id === 'truck') {
    for (const f of [155, 196, 233]) tone({ t, type: 'sawtooth', f, a: 0.02, hold: 0.7, d: 0.15, gain: 0.05, lp: 1200, bus: A.sfx })
  } else if (id === 'tune') {
    const n = [392, 392, 392, 523, 659, 392, 392, 392, 523, 659]
    n.forEach((f, i) => sq(f, i * 0.12, 0.08, 0.05))
  } else if (id === 'moo') {
    tone({ t, type: 'sawtooth', f: 160, f2: 110, glide: 0.9, a: 0.08, hold: 0.5, d: 0.3, gain: 0.12, lp: 700, bus: A.sfx })
  } else {
    for (const [at, len] of [[0, 0.16], [0.24, 0.3]]) for (const f of [415, 523]) sq(f, at, len)
  }
}
export function fanfare() {
  if (!ok(1.5, 1)) return
  const t = now()
  ;[523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone({ t: t + i * 0.11, type: 'triangle', f, d: i === 5 ? 0.7 : 0.25, a: 0.004, gain: 0.13, verb: 0.3, bus: A.ui }))
  burst({ t: t + 0.55, noise: 'pink', type: 'highpass', f: 6000, a: 0.01, d: 0.5, gain: 0.04, bus: A.ui })
}
export function comboTick(n) {
  if (!ok(0.3, 0.6)) return
  const f = 660 * Math.pow(2, Math.min(n - 2, 14) / 12)
  modal({ t: now(), f, modes: [[1, 1, 0.18], [2.01, 0.4, 0.1]], gain: 0.07, strike: 0.05, bus: A.ui })
}
export function splash(x, z) {
  const p = ready() && place(x, z, 40)
  if (!p || p.level < 0.02 || !voice(0.6, 0.6)) return
  const t = now()
  burst({ t, noise: 'white', type: 'bandpass', f: 1800, f2: 500, q: 0.6, a: 0.005, d: 0.35, gain: 0.25 * p.level, pan: p.pan, verb: p.verb })
  for (let i = 0; i < 4; i++) tone({ t: t + 0.05 + i * 0.05, f: rnd(700, 1400), f2: rnd(1600, 2400), d: 0.05, gain: 0.04 * p.level, pan: p.pan, bus: A.sfx })
}
let shearT = 0
export function shear(x, z, dt) {
  shearT -= dt
  if (shearT > 0) return
  shearT = 0.11
  if (!ok(0.15, 0.3)) return
  burst({ t: now(), noise: 'white', type: 'highpass', f: 4000, a: 0.001, d: 0.03, gain: 0.08, bus: A.sfx })
  modal({ t: now(), f: rnd(3000, 3600), modes: [[1, 1, 0.02]], gain: 0.03, bus: A.sfx })
  void x
  void z
}
export function thunder(delay = 1) {
  if (!ok(4, 0.9)) return
  const t = now() + delay
  burst({ t, noise: 'white', type: 'lowpass', f: 3000, f2: 400, a: 0.005, d: 0.4, gain: 0.25, verb: 0.6, bus: A.sfx })
  burst({ t: t + 0.1, noise: 'brown', type: 'lowpass', f: 180, a: 0.3, hold: 0.6, d: 2.8, gain: 0.7, verb: 0.8, bus: A.sfx })
  burst({ t: t + 0.6, noise: 'brown', type: 'lowpass', f: 120, a: 0.4, d: 2.2, gain: 0.45, verb: 0.9, bus: A.sfx })
}
export function wash() {
  if (!ok(2, 0.6)) return
  const t = now()
  burst({ t, noise: 'pink', type: 'bandpass', f: 1200, q: 0.5, a: 0.3, hold: 1.4, d: 0.6, gain: 0.2, bus: A.sfx })
  for (let i = 0; i < 10; i++) tone({ t: t + rnd(0, 2), f: rnd(900, 1800), f2: rnd(2000, 3000), d: 0.04, gain: 0.03, bus: A.sfx })
}

// --- Weather beds -------------------------------------------------------------------------------------------
let beds = null
onStart((ctx) => {
  const mk = (buf, type, f, q, bus) => {
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.start(0, Math.random() * buf.duration)
    const flt = ctx.createBiquadFilter()
    flt.type = type
    flt.frequency.value = f
    flt.Q.value = q
    const g = ctx.createGain()
    g.gain.value = 0
    s.connect(flt).connect(g).connect(bus)
    return { g, flt }
  }
  beds = {
    rain: mk(A.noise.pinkStereo ?? A.noise.pink, 'highpass', 900, 0.5, A.amb),
    rainLow: mk(A.noise.pink, 'lowpass', 500, 0.5, A.amb),
    gale: mk(A.noise.brown, 'bandpass', 380, 0.8, A.amb),
  }
})
let dripT = 0
export function weatherBeds(dt, { rain = 0, wind = 0, indoorsK = 1 } = {}) {
  if (!beds) return
  const t = A.ctx.currentTime
  beds.rain.g.gain.setTargetAtTime(rain * 0.12 * indoorsK, t, 0.6)
  beds.rainLow.g.gain.setTargetAtTime(rain * 0.08 * indoorsK, t, 0.6)
  beds.gale.g.gain.setTargetAtTime(wind * 0.16, t, 0.8)
  beds.gale.flt.frequency.setTargetAtTime(300 + Math.sin(t * 0.7) * 120 + wind * 200, t, 0.5)
  dripT -= dt
  if (rain > 0.2 && dripT <= 0 && voice(0.1, 0.2)) {
    dripT = rnd(0.05, 0.25) / rain
    tone({ t: t + 0.02, f: rnd(1800, 4200), f2: rnd(900, 1500), d: 0.03, gain: 0.015 * rain, pan: rnd(-0.8, 0.8), bus: A.amb })
  }
}

// --- Music -----------------------------------------------------------------------------------------------------
// Each zone: bpm, chord roots (semitones from the key), a lead pattern, a voice.
const KEY = { farm: 55, town: 60, ranch: 50, oil: 45 } // MIDI of the key's root
const ZONES = {
  farm: { bpm: 92, prog: [0, 7, 9, 5], scale: [0, 2, 4, 7, 9], lead: 'pluck', pattern: [0, 2, 4, 2, 3, 2, 4, 1] },
  town: { bpm: 112, prog: [0, 5, 7, 5], scale: [0, 2, 4, 5, 7, 9], lead: 'marimba', pattern: [0, 2, 4, 5, 4, 2, 0, 4] },
  ranch: { bpm: 84, prog: [0, 5, 0, 7], scale: [0, 2, 4, 7, 9, 12], lead: 'fiddle', pattern: [2, 3, 4, 3, 2, 1, 0, -1] },
  oil: { bpm: 72, prog: [0, -4, -2, -5], scale: [0, 3, 5, 7, 10], lead: 'bell', pattern: [0, -1, 2, -1, 4, -1, 3, -1] },
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
let music = null
onStart((ctx) => {
  const bus = ctx.createGain()
  bus.gain.value = 0.9
  bus.connect(A.amb)
  const tracks = {}
  for (const z in ZONES) {
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(bus)
    tracks[z] = { g, level: 0, next: ctx.currentTime + 0.5, step: 0 }
  }
  music = { bus, tracks, zone: 'farm', on: true }
})
function note(tr, z, t, m, len, lead) {
  const f = hz(m)
  const out = tr.g
  if (lead === 'pluck') tone({ t, type: 'triangle', f, a: 0.004, d: len * 0.9, gain: 0.07, bus: out })
  else if (lead === 'marimba') modal({ t, f, modes: [[1, 1, len * 0.7], [3.9, 0.25, 0.12], [9.2, 0.08, 0.05]], gain: 0.08, bus: out })
  else if (lead === 'fiddle') tone({ t, type: 'sawtooth', f, a: 0.06, hold: len * 0.5, d: len * 0.4, gain: 0.03, lp: 1400, bus: out })
  else modal({ t, f: f * 2, modes: [[1, 1, 1.4], [2.76, 0.4, 0.6], [5.4, 0.2, 0.3]], gain: 0.04, bus: out })
  void z
}
function zoneAt(x, z) {
  const T = FARM.town
  if (x > T.minX - 10 && x < T.maxX + 10 && z > T.minZ - 10 && z < T.maxZ + 10) return 'town'
  if (x > T.minX - 10) return 'farm' // the other players' farms around the town
  if (z < FARM.rail.z - 4) return 'ranch'
  if (x > 76 && z < -50 && z > -100) return 'oil'
  return 'farm'
}
export function updateMusic(dt, focus, enabled = true) {
  if (!music || !ready()) return
  const ctx = A.ctx
  const zone = zoneAt(focus.x, focus.z)
  music.zone = zone
  for (const z in music.tracks) {
    const tr = music.tracks[z]
    const want = enabled && z === zone ? 1 : 0
    tr.level += (want - tr.level) * Math.min(1, dt * 0.5) // ~2 s crossfade
    tr.g.gain.setTargetAtTime(tr.level * 0.55, ctx.currentTime, 0.1)
    if (tr.level < 0.02) {
      tr.next = ctx.currentTime + 0.2
      continue
    }
    // Schedule a little ahead.
    const Z = ZONES[z]
    const beat = 60 / Z.bpm / 2 // eighth notes
    while (tr.next < ctx.currentTime + 0.3) {
      const bar = Math.floor(tr.step / 8) % Z.prog.length
      const root = KEY[z] + Z.prog[bar]
      const i = tr.step % 8
      const p = Z.pattern[i]
      if (p >= 0 && voice(0.3, 0.1)) {
        const deg = Z.scale[p % Z.scale.length] + 12 * Math.floor(p / Z.scale.length)
        note(tr, z, tr.next, root + 12 + deg, beat * 1.6, Z.lead)
      }
      // Bass on the downbeats.
      if (i % 4 === 0 && voice(0.4, 0.1)) tone({ t: tr.next, type: z === 'town' ? 'square' : 'sine', f: hz(root - 12), a: 0.01, d: beat * 3, gain: z === 'town' ? 0.03 : 0.08, lp: 400, bus: tr.g })
      // A soft chord pad at each bar.
      if (i === 0 && voice(1, 0.1)) for (const k of [0, 4, 7]) tone({ t: tr.next, type: 'sine', f: hz(root + k), a: 0.4, hold: beat * 4, d: beat * 3, gain: 0.018, bus: tr.g })
      tr.next += beat
      tr.step++
    }
  }
}
export const musicZone = () => music?.zone ?? 'farm'
