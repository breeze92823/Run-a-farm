import { AUDIO, FARM } from '../config.js'
import { A, onStart, ready, voice } from './core.js'
import { burst, crinkle, env, modal, pick, rnd, route, tone } from './synth.js'
import { rectDist, wind } from '../farm/kit.js'
import { built, state } from '../game.js'

// The farm's soundscape, all synthesised and placed in space:
//  - beds: wind (with gusts that match the swaying wheat), leaf rustle, wheat
//    hiss near the field, the truck idling in the bay, the crowd at the farm
//    stand, the train's rumble
//  - creatures: hens (contented clucks, the egg song, alarmed squawks and wing
//    flaps when startled), the rooster, ducks on the pond, songbirds by day,
//    crickets and frogs by night, pigeons in the barn
//  - things: the cash register, egg-crate knocks, the barn creaking, turbine
//    whooshes, the crossing bell, the train horn and its wheels over rail joints,
//    sparkles near upgrade pads
//  - the player's footsteps, which change with the ground underfoot.
// Every positional sound gets level from distance (to the player, so the
// camera boom doesn't change the mix), stereo pan from the camera's facing,
// and more reverb the further away it is.

const L = { x: 0, z: 0, rx: 1, rz: 0, fx: 0, fz: -1 } // listener: position, right and forward vectors
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Level, pan and reverb for a source at (x, z) audible to `far` m.
function place(x, z, far, near = AUDIO.near) {
  const dx = x - L.x
  const dz = z - L.z
  const d = Math.hypot(dx, dz)
  const k = clamp01(1 - (d - near) / (far - near))
  const level = k * k * (3 - 2 * k) // smooth
  const pan = d > 0.5 ? ((dx * L.rx + dz * L.rz) / d) * Math.min(1, d / 6) * 0.85 : 0
  const verb = 0.08 + clamp01(d / far) * 0.5
  return { level, pan, verb, d }
}
// Same for an area (nearest point of a rect).
function placeRect(r, far) {
  const x = Math.max(r.minX, Math.min(L.x, r.maxX))
  const z = Math.max(r.minZ, Math.min(L.z, r.maxZ))
  const p = place(x, z, far, 0)
  if (rectDist(L.x, L.z, r) === 0) p.pan = 0
  return p
}

// --- Voice: an oscillator through vocal-tract formants ----------------------------------------
// { t, type, f, f2, glide, a, d, hold, formants: [[f, q, gain]], gain, pan, verb, vib: [rate, cents],
//   am: [rate, depth], breath (noise level), lp }
function voiced(o) {
  const ctx = A.ctx
  const t = o.t
  const a = o.a ?? 0.008
  const dur = a + (o.hold ?? 0) + o.d
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sawtooth'
  osc.frequency.setValueAtTime(o.f, t)
  if (o.curve) osc.frequency.setValueCurveAtTime(o.curve, t, dur)
  else if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur))
  const stop = t + dur + 0.05
  if (o.vib) {
    const v = ctx.createOscillator()
    v.frequency.value = o.vib[0]
    const vg = ctx.createGain()
    vg.gain.value = o.vib[1]
    v.connect(vg).connect(osc.detune)
    v.start(t)
    v.stop(stop)
  }
  const mix = ctx.createGain()
  const out = ctx.createGain()
  env(out.gain, t, a, o.gain ?? 0.2, o.d, o.hold ?? 0)
  for (const [f, q, g] of o.formants) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    const fg = ctx.createGain()
    fg.gain.value = g
    osc.connect(bp).connect(fg).connect(mix)
  }
  if (o.breath) {
    const src = ctx.createBufferSource()
    src.buffer = A.noise.white
    src.loop = true
    src.start(t, Math.random())
    src.stop(stop)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = o.formants[0][0] * 1.4
    bp.Q.value = 1.2
    const ng = ctx.createGain()
    ng.gain.value = o.breath
    src.connect(bp).connect(ng).connect(mix)
  }
  let last = mix
  if (o.am) {
    const amg = ctx.createGain()
    amg.gain.value = 1 - o.am[1]
    const lfo = ctx.createOscillator()
    lfo.frequency.value = o.am[0]
    const depth = ctx.createGain()
    depth.gain.value = o.am[1]
    lfo.connect(depth).connect(amg.gain)
    lfo.start(t)
    lfo.stop(stop)
    last = last.connect(amg)
  }
  if (o.lp) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = o.lp
    last = last.connect(lp)
  }
  last.connect(out)
  osc.start(t)
  osc.stop(stop)
  route(out, o)
  return t + dur
}

// --- Creature calls ---------------------------------------------------------------------------------
// A hen's short cluck: a voiced "buk" with a quick pitch fall.
function cluck(t, f0, g, pan, verb) {
  voiced({ t, f: f0, f2: f0 * 0.78, a: 0.006, d: rnd(0.05, 0.09), formants: [[rnd(1100, 1500), 4, 1], [rnd(2400, 3000), 6, 0.5]], gain: g, pan, verb, breath: 0.25, bus: A.sfx })
}
function henCall(x, z, kind) {
  const p = place(x, z, AUDIO.chickens.far)
  if (p.level < 0.02 || !voice(1.5, 0.6)) return
  const t = A.ctx.currentTime + 0.02
  const g = AUDIO.chickens.cluck * p.level
  const f0 = rnd(420, 560)
  if (kind === 'murmur') {
    // Contented: 2-4 soft clucks, then sometimes a purring trill.
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) cluck(t + i * rnd(0.14, 0.24), f0 * rnd(0.95, 1.05), g * rnd(0.5, 0.8), p.pan, p.verb)
    if (Math.random() < 0.35) voiced({ t: t + n * 0.2, f: f0 * 0.7, f2: f0 * 0.62, d: rnd(0.3, 0.5), a: 0.04, formants: [[900, 3, 1], [2000, 5, 0.4]], gain: g * 0.45, pan: p.pan, verb: p.verb, am: [rnd(18, 26), 0.8], bus: A.sfx })
  } else if (kind === 'song') {
    // The egg song: buk buk buk buk-BAGAWK.
    const n = 3 + Math.floor(Math.random() * 3)
    let tt = t
    for (let i = 0; i < n; i++) {
      cluck(tt, f0 * (1 + i * 0.03), g * 0.85, p.pan, p.verb)
      tt += rnd(0.16, 0.22)
    }
    voiced({ t: tt + 0.05, f: f0 * 1.05, curve: new Float32Array([f0 * 1.0, f0 * 1.5, f0 * 1.75, f0 * 1.6, f0 * 1.2]), d: 0.32, a: 0.02, formants: [[1400, 3, 1], [2900, 5, 0.6]], gain: g * 1.1, pan: p.pan, verb: p.verb, breath: 0.35, bus: A.sfx })
  } else if (kind === 'alarm') {
    // Startled squawk, then a flurry of wingbeats.
    voiced({ t, f: f0 * 1.5, curve: new Float32Array([f0 * 1.4, f0 * 2.0, f0 * 1.7, f0 * 1.3]), d: 0.22, a: 0.01, formants: [[1600, 2.5, 1], [3200, 4, 0.7]], gain: g * 1.2, pan: p.pan, verb: p.verb, breath: 0.5, bus: A.sfx })
    const beats = 7 + Math.floor(Math.random() * 5)
    for (let i = 0; i < beats; i++) burst({ t: t + 0.05 + i * rnd(0.045, 0.06), noise: 'pink', type: 'bandpass', f: rnd(700, 1400), q: 0.9, a: 0.004, d: 0.045, gain: g * 0.9 * (1 - i / beats * 0.6), pan: p.pan, verb: p.verb * 0.6 })
  }
}
function peckTap(x, z) {
  const p = place(x, z, 14, 2)
  if (p.level < 0.05 || !voice(0.1, 0.3)) return
  burst({ t: A.ctx.currentTime + 0.01, type: 'highpass', f: 2500, a: 0.001, d: 0.012, gain: 0.12 * p.level, pan: p.pan })
}
function rooster(x, z) {
  const p = place(x, z, AUDIO.rooster.far, 6)
  if (p.level < 0.02 || !voice(2.2, 0.8)) return
  const t = A.ctx.currentTime + 0.02
  const g = AUDIO.rooster.gain * p.level
  const base = rnd(480, 540)
  const notes = [[1.0, 0.13], [1.12, 0.12], [1.3, 0.16]]
  let tt = t
  for (const [k, d] of notes) {
    voiced({ t: tt, f: base * k, f2: base * k * 0.96, d, a: 0.015, formants: [[1100, 3, 1], [2500, 4, 0.6], [3600, 6, 0.25]], gain: g, pan: p.pan, verb: p.verb + 0.15, breath: 0.4, bus: A.sfx })
    tt += d + 0.03
  }
  voiced({ t: tt, f: base * 1.45, curve: new Float32Array([base * 1.45, base * 1.52, base * 1.5, base * 1.38, base * 1.15]), d: 0.8, a: 0.03, formants: [[1150, 3, 1], [2600, 4, 0.6], [3600, 6, 0.25]], gain: g, pan: p.pan, verb: p.verb + 0.2, breath: 0.45, vib: [6, 25], bus: A.sfx })
}
function quack(x, z) {
  const p = place(x, z, 40)
  if (p.level < 0.03 || !voice(1, 0.5)) return
  const t = A.ctx.currentTime + 0.02
  const n = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) voiced({ t: t + i * rnd(0.18, 0.26), f: rnd(230, 280), f2: rnd(170, 200), d: rnd(0.11, 0.16), a: 0.008, formants: [[rnd(900, 1100), 2.2, 1], [2200, 4, 0.5]], gain: 0.22 * p.level, pan: p.pan, verb: p.verb, breath: 0.2, type: 'sawtooth', bus: A.sfx })
}
function pigeon(x, z) {
  const p = place(x, z, AUDIO.barn.far)
  if (p.level < 0.03 || !voice(1.4, 0.4)) return
  const t = A.ctx.currentTime + 0.02
  voiced({ t, f: 330, curve: new Float32Array([300, 360, 340, 280]), d: 0.42, a: 0.05, type: 'triangle', formants: [[500, 1.5, 1]], gain: AUDIO.barn.gain * p.level, pan: p.pan, verb: p.verb + 0.2, am: [9, 0.5], bus: A.sfx })
  voiced({ t: t + 0.55, f: 290, f2: 250, d: 0.5, a: 0.06, type: 'triangle', formants: [[450, 1.5, 1]], gain: AUDIO.barn.gain * 0.8 * p.level, pan: p.pan, verb: p.verb + 0.2, bus: A.sfx })
}
function creak(x, z) {
  const p = place(x, z, AUDIO.barn.far)
  if (p.level < 0.03 || !voice(1, 0.3)) return
  voiced({ t: A.ctx.currentTime + 0.02, f: rnd(70, 110), f2: rnd(130, 180), d: rnd(0.5, 0.9), a: 0.1, formants: [[700, 6, 1], [1500, 8, 0.4]], gain: AUDIO.barn.gain * 0.6 * p.level, pan: p.pan, verb: p.verb + 0.25, am: [rnd(28, 40), 0.9], bus: A.sfx })
}

// Songbirds: a few species, each a phrase of FM-ish sine sweeps.
function birdPhrase() {
  if (!voice(1.5, 0.4)) return
  const t = A.ctx.currentTime + 0.02
  const pan = rnd(-0.9, 0.9)
  const g = AUDIO.birds * rnd(0.4, 1)
  const verb = rnd(0.25, 0.6)
  const kind = Math.floor(Math.random() * 4)
  if (kind === 0) {
    // Trill: a quick run of down-chirps.
    const n = 5 + Math.floor(Math.random() * 6)
    const f = rnd(3200, 4600)
    for (let i = 0; i < n; i++) tone({ t: t + i * 0.065, f: f * (1 + i * 0.01), f2: f * 0.72, d: 0.05, a: 0.004, gain: g, pan, verb, bus: A.amb })
  } else if (kind === 1) {
    // Two-note whistle (fee-bee).
    tone({ t, f: 3900, f2: 3800, d: 0.28, a: 0.03, gain: g, pan, verb, bus: A.amb })
    tone({ t: t + 0.36, f: 3300, f2: 3150, d: 0.32, a: 0.03, gain: g * 0.9, pan, verb, bus: A.amb })
  } else if (kind === 2) {
    // Warble: rising-falling sweeps.
    for (let i = 0; i < 3; i++) {
      const f = rnd(2400, 3400)
      tone({ t: t + i * 0.16, f, f2: f * 1.35, glide: 0.06, d: 0.12, a: 0.01, gain: g, pan, verb, bus: A.amb })
    }
  } else {
    // Sparrow chips.
    const n = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < n; i++) tone({ t: t + i * rnd(0.09, 0.14), f: rnd(4800, 5600), f2: rnd(3800, 4200), d: 0.03, a: 0.002, gain: g * 0.8, pan, verb, bus: A.amb })
  }
}
// Grasshopper: a short rasp of dry clicks.
function grasshopper(x, z) {
  const p = place(x, z, 26, 2)
  if (p.level < 0.04 || !voice(0.8, 0.2)) return
  const t = A.ctx.currentTime + 0.02
  const n = 8 + Math.floor(Math.random() * 10)
  const f = rnd(4500, 6500)
  for (let i = 0; i < n; i++) burst({ t: t + i * rnd(0.022, 0.03), type: 'bandpass', f, q: 4, a: 0.001, d: 0.012, gain: 0.08 * p.level, pan: p.pan, bus: A.amb })
}
function cricket() {
  if (!voice(0.5, 0.2)) return
  const t = A.ctx.currentTime + 0.02
  const pan = rnd(-0.8, 0.8)
  const f = rnd(4300, 4900)
  for (let i = 0; i < 3; i++) tone({ t: t + i * 0.045, f, d: 0.028, a: 0.004, gain: AUDIO.crickets, pan, verb: 0.3, bus: A.amb })
}
function frog(x, z) {
  const p = place(x, z, 60)
  if (p.level < 0.03 || !voice(0.6, 0.3)) return
  const t = A.ctx.currentTime + 0.02
  for (let i = 0; i < 2; i++) voiced({ t: t + i * 0.13, f: rnd(150, 190), d: 0.09, a: 0.01, formants: [[650, 3, 1], [1400, 4, 0.4]], gain: 0.16 * p.level, pan: p.pan, verb: p.verb, am: [70, 0.9], bus: A.amb })
}

// --- Things ------------------------------------------------------------------------------------------
function register(x, z) {
  const p = place(x, z, AUDIO.crowd.far)
  if (p.level < 0.03 || !voice(1.2, 0.6)) return
  const t = A.ctx.currentTime + 0.02
  const g = AUDIO.register.gain * p.level
  burst({ t, noise: 'pink', type: 'lowpass', f: 600, a: 0.002, d: 0.08, gain: g * 0.8, pan: p.pan, verb: p.verb }) // drawer thunk
  modal({ t: t + 0.06, f: 2093, modes: [[1, 1, 0.9], [2.76, 0.4, 0.5], [5.4, 0.2, 0.3]], beat: 4, gain: g * 0.5, pan: p.pan, verb: p.verb + 0.1, strike: 0.2, bus: A.sfx })
  crinkle({ t: t + 0.12, n: 8, dur: 0.25, gain: g * 0.4, f0: 3500, f1: 8000, width: 0.1, bus: A.sfx }) // coins
}
function knock(x, z) {
  const p = place(x, z, AUDIO.crowd.far)
  if (p.level < 0.05 || !voice(0.4, 0.3)) return
  const t = A.ctx.currentTime + 0.02
  modal({ t, f: rnd(380, 520), modes: [[1, 1, 0.08], [2.3, 0.5, 0.05], [4.1, 0.25, 0.03]], gain: 0.16 * p.level, pan: p.pan, verb: p.verb, strike: 0.25, bus: A.sfx })
}
// One babbled syllable from a customer.
const VOWELS = [[800, 1200], [400, 2200], [450, 800], [300, 2300], [350, 700], [600, 1700]]
function syllable(x, z, f0) {
  const p = place(x, z, AUDIO.crowd.far, 3)
  if (p.level < 0.03 || !voice(0.4, 0.25)) return
  const [f1, f2] = pick(VOWELS)
  const d = rnd(0.07, 0.2)
  voiced({ t: A.ctx.currentTime + 0.02, f: f0 * rnd(0.92, 1.12), f2: f0 * rnd(0.85, 1.05), d, a: 0.02, formants: [[f1, 5, 1], [f2, 8, 0.5]], gain: AUDIO.crowd.gain * p.level, pan: p.pan, verb: p.verb, lp: 2600, bus: A.sfx })
}
function sparkle(x, z) {
  const p = place(x, z, AUDIO.pads.far, 1.5)
  if (p.level < 0.05 || !voice(0.8, 0.3)) return
  const t = A.ctx.currentTime + 0.02
  const scale = [1046, 1175, 1318, 1568, 1760, 2093, 2349]
  for (let i = 0; i < 3; i++) tone({ t: t + i * 0.09, f: pick(scale) * 2, d: 0.35, a: 0.003, gain: AUDIO.pads.gain * p.level, pan: p.pan + rnd(-0.2, 0.2), verb: 0.6 })
}
function whoosh(x, z, far, gain) {
  const p = place(x, z, far, 30)
  if (p.level < 0.02 || !voice(1.2, 0.2)) return
  burst({ t: A.ctx.currentTime + 0.02, noise: 'pink', type: 'bandpass', f: 320, f2: 560, q: 0.8, a: 0.45, d: 0.7, gain: gain * p.level, pan: p.pan, verb: 0.5, bus: A.amb })
}
function bell(x, z) {
  const p = place(x, z, 120, 6)
  if (p.level < 0.02 || !voice(0.6, 0.5)) return
  modal({ t: A.ctx.currentTime + 0.02, f: 1650, modes: [[1, 1, 0.45], [2.4, 0.5, 0.25], [3.9, 0.25, 0.15]], beat: 6, gain: 0.3 * p.level, pan: p.pan, verb: p.verb, strike: 0.3, bus: A.sfx })
}
function horn(x, z, len) {
  const p = place(x, z, 700, 20)
  if (p.level < 0.01 || !voice(len + 0.5, 1)) return
  const t = A.ctx.currentTime + 0.02
  for (const f of [277, 349, 415, 554]) tone({ t, type: 'sawtooth', f, detune: rnd(-6, 6), a: 0.06, hold: len, d: 0.25, gain: 0.07 * p.level, pan: p.pan, verb: p.verb + 0.3, lp: 1800, bus: A.sfx })
}
function clack(x, z, g) {
  const p = place(x, z, 160, 8)
  if (p.level < 0.02 || !voice(0.3, 0.5)) return
  const t = A.ctx.currentTime + 0.02
  for (let i = 0; i < 2; i++) {
    modal({ t: t + i * 0.11, f: rnd(170, 210), modes: [[1, 1, 0.06], [2.7, 0.6, 0.04], [5.1, 0.3, 0.03]], gain: g * p.level, pan: p.pan, verb: p.verb, strike: 0.5, bus: A.sfx })
  }
}

// --- Footsteps -----------------------------------------------------------------------------------------
export function footstep(surface, k = 1, leafy = false) {
  if (!ready() || !voice(0.25, 0.9)) return
  const t = A.ctx.currentTime + 0.005
  const g = AUDIO.footsteps.gain * k
  const pan = rnd(-0.08, 0.08)
  const thump = (f, gg) => tone({ t, f, f2: f * 0.55, d: 0.06, a: 0.002, gain: g * gg, pan, lp: 400 })
  switch (surface) {
    case 'meadow': // long dry grass: a bigger swish
      burst({ t, noise: 'pink', type: 'bandpass', f: rnd(2200, 3400), q: 0.6, a: 0.02, d: 0.16, gain: g * 0.7, pan })
      crinkle({ t, n: 4, dur: 0.1, gain: g * 0.18, f0: 3000, f1: 7000, width: 0.1 })
      thump(80, 0.45)
      break
    case 'grass':
      burst({ t, noise: 'pink', type: 'bandpass', f: rnd(1800, 2800), q: 0.7, a: 0.012, d: 0.1, gain: g * 0.55, pan })
      thump(85, 0.5)
      break
    case 'dirt':
      crinkle({ t, n: 6, dur: 0.05, gain: g * 0.45, f0: 900, f1: 3500, width: 0.05 })
      burst({ t, noise: 'brown', type: 'lowpass', f: 500, a: 0.003, d: 0.07, gain: g * 0.8, pan })
      thump(100, 0.5)
      break
    case 'soil':
    case 'mud':
      burst({ t, noise: 'brown', type: 'bandpass', f: 380, f2: surface === 'mud' ? 1100 : 600, q: 1.3, a: 0.005, d: 0.1, gain: g * 0.9, pan })
      crinkle({ t, n: 3, dur: 0.04, gain: g * 0.25, f0: 700, f1: 2200, width: 0.05 })
      break
    case 'sand':
      burst({ t, noise: 'pink', type: 'lowpass', f: 1400, a: 0.02, d: 0.12, gain: g * 0.7, pan })
      break
    case 'gravel':
      crinkle({ t, n: 14, dur: 0.08, gain: g * 0.5, f0: 1800, f1: 7000, width: 0.08 })
      thump(110, 0.5)
      break
    case 'wood':
      modal({ t, f: rnd(150, 190), modes: [[1, 1, 0.09], [2.3, 0.5, 0.06], [3.9, 0.3, 0.04]], gain: g * 0.9, pan, strike: 0.35 })
      break
    case 'pavers':
      burst({ t, type: 'highpass', f: 2800, a: 0.001, d: 0.022, gain: g * 0.5, pan })
      modal({ t, f: rnd(700, 900), modes: [[1, 0.6, 0.03], [2.1, 0.3, 0.02]], gain: g * 0.3, pan })
      thump(150, 0.7)
      break
    case 'asphalt':
      burst({ t, type: 'highpass', f: 2400, a: 0.001, d: 0.02, gain: g * 0.4, pan })
      thump(130, 0.75)
      break
    default: // concrete
      burst({ t, type: 'highpass', f: 3200, a: 0.001, d: 0.025, gain: g * 0.55, pan })
      thump(160, 0.75)
  }
  if (leafy && Math.random() < 0.5) crinkle({ t: t + 0.01, n: 7, dur: 0.07, gain: g * 0.35, f0: 2500, f1: 8000, width: 0.1 })
}

// --- Loops ---------------------------------------------------------------------------------------------
function loopSource(buffer) {
  const s = A.ctx.createBufferSource()
  s.buffer = buffer
  s.loop = true
  s.start(0, Math.random() * buffer.duration)
  return s
}
// A positional loop: input -> gain -> panner -> bus (+ reverb send). set(level, pan, verb).
function posLoop(input, bus = A.amb) {
  const ctx = A.ctx
  const g = ctx.createGain()
  g.gain.value = 0
  const p = ctx.createStereoPanner()
  const send = ctx.createGain()
  send.gain.value = 0
  input.connect(g).connect(p).connect(bus)
  p.connect(send).connect(A.verb)
  return {
    set(level, pan = 0, verb = 0) {
      const now = ctx.currentTime
      g.gain.setTargetAtTime(level, now, 0.15)
      p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1)
      send.gain.setTargetAtTime(verb * level, now, 0.2)
    },
  }
}

function buildLoops() {
  const ctx = A.ctx
  // Wind: two bands of stereo pink noise.
  const windSrc = loopSource(A.noise.pinkStereo)
  const windBp = ctx.createBiquadFilter()
  windBp.type = 'bandpass'
  windBp.frequency.value = 500
  windBp.Q.value = 0.6
  const windG = ctx.createGain()
  windG.gain.value = 0
  windSrc.connect(windBp).connect(windG).connect(A.amb)
  const whistleSrc = loopSource(A.noise.white)
  const whistleBp = ctx.createBiquadFilter()
  whistleBp.type = 'bandpass'
  whistleBp.frequency.value = 1300
  whistleBp.Q.value = 9
  const whistleG = ctx.createGain()
  whistleG.gain.value = 0
  whistleSrc.connect(whistleBp).connect(whistleG).connect(A.amb)

  // Wheat hiss.
  const wheatSrc = loopSource(A.noise.pinkStereo)
  const wheatHp = ctx.createBiquadFilter()
  wheatHp.type = 'highpass'
  wheatHp.frequency.value = 1600
  const wheatBp = ctx.createBiquadFilter()
  wheatBp.type = 'peaking'
  wheatBp.frequency.value = 4200
  wheatBp.gain.value = 6
  wheatSrc.connect(wheatHp).connect(wheatBp)
  const wheat = posLoop(wheatBp)

  // Truck idle: firing pulses (saw + square) through a low filter with a little grit.
  const idleF = rnd(24, 27)
  const o1 = ctx.createOscillator()
  o1.type = 'sawtooth'
  o1.frequency.value = idleF
  const o2 = ctx.createOscillator()
  o2.type = 'square'
  o2.frequency.value = idleF * 2
  const o2g = ctx.createGain()
  o2g.gain.value = 0.35
  const jitter = ctx.createOscillator()
  jitter.frequency.value = 0.7
  const jg = ctx.createGain()
  jg.gain.value = 0.6
  jitter.connect(jg).connect(o1.frequency)
  const engLp = ctx.createBiquadFilter()
  engLp.type = 'lowpass'
  engLp.frequency.value = 190
  engLp.Q.value = 2.5
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(512)
  for (let i = 0; i < 512; i++) {
    const x = (i / 511) * 2 - 1
    curve[i] = Math.tanh(x * 2.5)
  }
  shaper.curve = curve
  const rumble = loopSource(A.noise.brown)
  const rumbleLp = ctx.createBiquadFilter()
  rumbleLp.type = 'lowpass'
  rumbleLp.frequency.value = 260
  const rumbleG = ctx.createGain()
  rumbleG.gain.value = 0.5
  // Valve tick: high noise gated at the firing rate.
  const tick = loopSource(A.noise.white)
  const tickHp = ctx.createBiquadFilter()
  tickHp.type = 'bandpass'
  tickHp.frequency.value = 3200
  tickHp.Q.value = 2
  const tickG = ctx.createGain()
  tickG.gain.value = 0
  const gate = ctx.createOscillator()
  gate.type = 'square'
  gate.frequency.value = idleF * 2
  const gateG = ctx.createGain()
  gateG.gain.value = 0.05
  gate.connect(gateG).connect(tickG.gain)
  const engMix = ctx.createGain()
  engMix.gain.value = 0.9
  o1.connect(engLp)
  o2.connect(o2g).connect(engLp)
  engLp.connect(shaper).connect(engMix)
  rumble.connect(rumbleLp).connect(rumbleG).connect(engMix)
  tick.connect(tickHp).connect(tickG).connect(engMix)
  for (const o of [o1, o2, jitter, gate]) o.start()
  const truck = posLoop(engMix)

  // Train rumble: a big diesel and the roar of wheels.
  const tr1 = ctx.createOscillator()
  tr1.type = 'sawtooth'
  tr1.frequency.value = 34
  const trLp = ctx.createBiquadFilter()
  trLp.type = 'lowpass'
  trLp.frequency.value = 150
  const trNoise = loopSource(A.noise.brownStereo)
  const trNoiseLp = ctx.createBiquadFilter()
  trNoiseLp.type = 'lowpass'
  trNoiseLp.frequency.value = 700
  const trMix = ctx.createGain()
  tr1.connect(trLp).connect(trMix)
  trNoise.connect(trNoiseLp).connect(trMix)
  tr1.start()
  const train = posLoop(trMix, A.sfx)

  // Crowd bed: soft low murmur under the babble.
  const crowdSrc = loopSource(A.noise.pinkStereo)
  const crowdBp = ctx.createBiquadFilter()
  crowdBp.type = 'bandpass'
  crowdBp.frequency.value = 450
  crowdBp.Q.value = 1.2
  crowdSrc.connect(crowdBp)
  const crowd = posLoop(crowdBp)

  // Pond lapping.
  const lapSrc = loopSource(A.noise.pinkStereo)
  const lapBp = ctx.createBiquadFilter()
  lapBp.type = 'bandpass'
  lapBp.frequency.value = 900
  lapBp.Q.value = 1.5
  const lapAm = ctx.createGain()
  const lapLfo = ctx.createOscillator()
  lapLfo.frequency.value = 0.35
  const lapDepth = ctx.createGain()
  lapDepth.gain.value = 0.5
  lapAm.gain.value = 0.5
  lapLfo.connect(lapDepth).connect(lapAm.gain)
  lapLfo.start()
  lapSrc.connect(lapBp).connect(lapAm)
  const lap = posLoop(lapAm)

  // Meadow insects: a high chirr, pulsing, over the overgrown west plots.
  const bugSrc = loopSource(A.noise.white)
  const bugBp = ctx.createBiquadFilter()
  bugBp.type = 'bandpass'
  bugBp.frequency.value = 6400
  bugBp.Q.value = 3
  const bugAm = ctx.createGain()
  bugAm.gain.value = 0.5
  const bugLfo = ctx.createOscillator()
  bugLfo.type = 'square'
  bugLfo.frequency.value = 38
  const bugDepth = ctx.createGain()
  bugDepth.gain.value = 0.5
  bugLfo.connect(bugDepth).connect(bugAm.gain)
  bugLfo.start()
  bugSrc.connect(bugBp).connect(bugAm)
  const bugs = posLoop(bugAm)

  return { windBp, windG, whistleBp, whistleG, wheat, truck, train, crowd, lap, bugs }
}

// --- The scheduler ---------------------------------------------------------------------------------------
export function createFarmAudio(farm) {
  let loops = null
  onStart(() => {
    loops = buildLoops()
  })
  const hens = farm.yard.hens
  for (const h of hens) h.nextCall = rnd(1, AUDIO.chickens.perHen[1])
  const timers = { bird: 2, rooster: rnd(6, 20), cricket: 0.5, frog: 2, register: rnd(4, 10), knock: 3, babble: 0.3, pigeon: rnd(5, 15), creak: rnd(8, 20), sparkle: 0.5, quack: rnd(3, 9), bell: 0, rustle: 0.4, hopper: 2 }
  const turbineT = farm.scenery.turbines.map(() => rnd(0, 2.6))
  let lastClackX = null
  let hornDone = -1
  const crowdVoices = [rnd(105, 135), rnd(170, 210), rnd(200, 240), rnd(120, 150)]
  const C = farm.north.crossing

  return {
    footstep,
    update(dt, t, focus, camera, night) {
      if (!ready() || !loops) return
      L.x = focus.x
      L.z = focus.z
      // Camera facing for panning.
      const e = camera.matrixWorld.elements
      const fx = -e[8]
      const fz = -e[10]
      const fl = Math.hypot(fx, fz) || 1
      L.fx = fx / fl
      L.fz = fz / fl
      L.rx = -L.fz
      L.rz = L.fx
      const now = A.ctx.currentTime
      const day = 1 - night

      // Wind bed follows the gusts.
      const w = wind.strength
      loops.windG.gain.setTargetAtTime(AUDIO.wind * (0.35 + w * 0.9), now, 0.4)
      loops.windBp.frequency.setTargetAtTime(350 + w * 700, now, 0.5)
      loops.whistleG.gain.setTargetAtTime(AUDIO.wind * 0.06 * Math.max(0, w - 0.6) * 3, now, 0.5)
      loops.whistleBp.frequency.setTargetAtTime(1100 + w * 500, now, 0.8)
      // Leaf rustle: little crinkles, more in gusts.
      timers.rustle -= dt
      if (timers.rustle <= 0) {
        timers.rustle = rnd(0.15, 0.5) / (0.4 + w)
        if (voice(0.4, 0.2)) crinkle({ t: now + 0.02, n: 5 + Math.floor(w * 8), dur: rnd(0.2, 0.5), gain: AUDIO.leaves * (0.4 + w), f0: 2500, f1: 9000, width: 0.9, bus: A.amb })
      }

      // Wheat.
      const wh = placeRect(farm.field.wheatRect, AUDIO.wheat.far)
      loops.wheat.set(AUDIO.wheat.gain * wh.level * (0.25 + w * 0.9), wh.pan, wh.verb)
      // Truck idle (more reverb inside the bay).
      const tp = place(farm.truckBay.truck.x, farm.truckBay.truck.z, AUDIO.truck.far, 3)
      const inBay = rectDist(L.x, L.z, farm.truckBay.inside) === 0
      loops.truck.set(built('truckBay') ? AUDIO.truck.gain * tp.level : 0, tp.pan, inBay ? 0.9 : tp.verb)
      // Crowd bed at the stand (customers only come while it has eggs).
      const stocked = state.stand.eggs > 0
      const sp = place(farm.stand.customers[0], farm.stand.customers[1], AUDIO.crowd.far, 3)
      loops.crowd.set(stocked ? AUDIO.crowd.gain * 0.5 * sp.level * day : 0, sp.pan, sp.verb)
      // Pond.
      const pp = place(farm.north.pond.x, farm.north.pond.z, 45, 14)
      loops.lap.set(0.05 * pp.level, pp.pan, pp.verb)

      // Meadow insects over the west plots (by day), and grasshoppers.
      const wp = placeRect(farm.west.rect, 34)
      loops.bugs.set(0.035 * wp.level * day, wp.pan, wp.verb)
      timers.hopper -= dt
      if (timers.hopper <= 0) {
        timers.hopper = rnd(1.2, 3.5)
        const r = farm.west.rect
        if (Math.random() < day) grasshopper(Math.max(r.minX, Math.min(L.x + rnd(-10, 10), r.maxX)), Math.max(r.minZ, Math.min(L.z + rnd(-10, 10), r.maxZ)))
      }

      // Hens.
      for (const h of hens) {
        if (h.hidden) continue
        h.nextCall -= dt
        if (h.nextCall <= 0) {
          const [lo, hi] = AUDIO.chickens.perHen
          h.nextCall = rnd(lo, hi) * (night > 0.5 ? 3 : 1)
          henCall(h.x, h.z, Math.random() < 0.12 ? 'song' : 'murmur')
        }
      }
      for (const ev of farm.yard.events.splice(0)) {
        if (ev.type === 'flap') henCall(ev.x, ev.z, 'alarm')
        else peckTap(ev.x, ev.z)
      }
      timers.rooster -= dt
      if (timers.rooster <= 0) {
        timers.rooster = rnd(...AUDIO.rooster.every)
        const c = FARM.coops[1]
        rooster(c.x, c.z + 3)
      }

      // The stand: babble, the till, egg-crate knocks.
      timers.babble -= dt
      if (timers.babble <= 0 && day > 0.3 && stocked) {
        timers.babble = rnd(0.12, 0.45)
        const [x, z] = farm.stand.customers
        syllable(x + rnd(-2, 2), z + rnd(-1, 3), pick(crowdVoices))
      }
      timers.register -= dt
      if (timers.register <= 0) {
        timers.register = rnd(...AUDIO.register.every)
        if (stocked) register(FARM.stand.x + 2.3, FARM.stand.z + 0.8)
      }
      timers.knock -= dt
      if (timers.knock <= 0) {
        timers.knock = rnd(2, 6)
        knock(FARM.stand.x + rnd(-2, 2), FARM.stand.z)
      }

      // Birds by day, crickets and frogs by night.
      timers.bird -= dt
      if (timers.bird <= 0) {
        timers.bird = rnd(...AUDIO.birdEvery)
        if (Math.random() < day) birdPhrase()
      }
      timers.cricket -= dt
      if (timers.cricket <= 0) {
        timers.cricket = rnd(0.08, 0.3)
        if (Math.random() < night) cricket()
      }
      timers.frog -= dt
      if (timers.frog <= 0) {
        timers.frog = rnd(0.6, 2.2)
        if (Math.random() < night + 0.1) frog(farm.north.pond.x + rnd(-15, 15), farm.north.pond.z + rnd(-10, 10))
      }
      timers.quack -= dt
      if (timers.quack <= 0) {
        timers.quack = rnd(4, 12)
        quack(farm.north.pond.x + rnd(-8, 8), farm.north.pond.z + rnd(-5, 5))
      }

      // Barn: pigeons and creaks.
      const b = farm.storage.barn
      timers.pigeon -= dt
      if (timers.pigeon <= 0 && built('storage')) {
        timers.pigeon = rnd(6, 16)
        pigeon(b.cx + rnd(-8, 8), b.cz + 6)
      }
      timers.creak -= dt
      if (timers.creak <= 0 && built('storage')) {
        timers.creak = rnd(9, 22) / (0.5 + w)
        creak(b.cx + rnd(-12, 12), b.cz + 10)
      }

      // Pad sparkles.
      timers.sparkle -= dt
      if (timers.sparkle <= 0) {
        timers.sparkle = rnd(0.7, 1.5)
        for (const p of farm.pads.pads) if (p.disc.visible) sparkle(p.x, p.z)
      }

      // Turbines: a whoosh each blade pass.
      farm.scenery.turbines.forEach((m, i) => {
        turbineT[i] -= dt
        if (turbineT[i] <= 0) {
          turbineT[i] = (Math.PI * 2) / 3 / m.speed
          whoosh(m.x, m.z, AUDIO.turbines.far, AUDIO.turbines.gain)
        }
      })

      // Train: rumble from the nearest point of the train, joint clacks, horn, crossing bell.
      const tr = farm.north.train
      if (tr.active) {
        const nx = Math.max(tr.tailX, Math.min(L.x, tr.headX))
        const p = place(nx, tr.z, 260, 10)
        loops.train.set(0.5 * p.level, p.pan, p.verb)
        // Clacks: each car's bogies over a rail joint every 12 m of travel.
        const joint = Math.floor(tr.headX / 12)
        if (lastClackX !== joint) {
          lastClackX = joint
          clack(nx, tr.z, 0.35)
        }
        // Horn: long, long, short, long as the engine approaches the crossing.
        const cycle = Math.floor(t / 60)
        if (tr.headX > C.x - 260 && tr.headX < C.x - 200 && hornDone !== cycle) {
          hornDone = cycle
          const seq = [[0, 1.2], [1.5, 1.2], [3.0, 0.45], [3.7, 1.8]]
          for (const [at, len] of seq) setTimeout(() => horn(tr.headX, tr.z, len), at * 1000)
        }
      } else {
        loops.train.set(0, 0, 0)
      }
      if (farm.north.crossingActive) {
        timers.bell -= dt
        if (timers.bell <= 0) {
          timers.bell = 0.52
          bell(C.x, C.z + 4)
        }
      }
    },
  }
}

// Shared with audio/sfx.js (the newer farm sounds).
export { place, voiced, posLoop, loopSource, register, quack, horn }
