import { A, ready, voice } from './core.js'
import { burst, crinkle, modal, rnd, tone } from './synth.js'

// HUD and window sounds, on the UI bus (never ducked, never placed in space):
// soft wooden pops for buttons, a coin chime for sales, clinking eggs when
// collecting, a low two-tone buzz when something can't be afforded, and a
// bright little fanfare for purchases.

const now = () => A.ctx.currentTime + 0.01
const ok = (s = 0.5, p = 1) => ready() && voice(s, p)

export function click() {
  if (!ok(0.2)) return
  const t = now()
  tone({ t, f: rnd(620, 680), f2: 380, d: 0.07, a: 0.002, gain: 0.16, bus: A.ui })
  burst({ t, type: 'bandpass', f: 1800, q: 1.4, a: 0.001, d: 0.02, gain: 0.08, bus: A.ui })
}

export function open() {
  if (!ok(0.4)) return
  const t = now()
  burst({ t, noise: 'pink', type: 'bandpass', f: 600, f2: 2400, q: 0.8, a: 0.04, d: 0.18, gain: 0.12, bus: A.ui })
  tone({ t: t + 0.05, f: 523, f2: 784, d: 0.16, a: 0.005, gain: 0.1, bus: A.ui })
}

export function close() {
  if (!ok(0.3)) return
  const t = now()
  burst({ t, noise: 'pink', type: 'bandpass', f: 2200, f2: 600, q: 0.8, a: 0.02, d: 0.14, gain: 0.1, bus: A.ui })
}

// A coin (or a few, for a bigger sale).
export function coin(n = 1) {
  if (!ok(0.6, 0.8)) return
  const t = now()
  const k = Math.min(4, n)
  for (let i = 0; i < k; i++) {
    const f = rnd(2300, 2700)
    modal({ t: t + i * 0.07, f, modes: [[1, 1, 0.25], [2.4, 0.45, 0.14], [4.3, 0.2, 0.08]], beat: 5, gain: 0.08, strike: 0.15, bus: A.ui })
  }
  crinkle({ t: t + 0.02, n: 3 + k, dur: 0.12, gain: 0.04, f0: 4000, f1: 9000, width: 0.2, bus: A.ui })
}

// Eggs clinking into the basket.
export function collect(n = 1) {
  if (!ok(0.5, 0.8)) return
  const t = now()
  for (let i = 0; i < Math.min(5, n); i++) {
    modal({ t: t + i * 0.06 + rnd(0, 0.02), f: rnd(1300, 1700), modes: [[1, 1, 0.05], [2.6, 0.4, 0.03]], gain: 0.1, strike: 0.2, bus: A.ui })
  }
  tone({ t: t + 0.05, f: 660, f2: 990, d: 0.15, a: 0.005, gain: 0.07, bus: A.ui })
}

export function restock() {
  if (!ok(0.6)) return
  const t = now()
  for (let i = 0; i < 4; i++) modal({ t: t + i * 0.05, f: rnd(400, 520), modes: [[1, 1, 0.07], [2.3, 0.5, 0.05]], gain: 0.12, strike: 0.3, bus: A.ui })
  tone({ t: t + 0.18, f: 784, d: 0.12, a: 0.004, gain: 0.07, bus: A.ui })
  tone({ t: t + 0.28, f: 1046, d: 0.18, a: 0.004, gain: 0.07, bus: A.ui })
}

export function deny() {
  if (!ok(0.3)) return
  const t = now()
  tone({ t, type: 'square', f: 196, d: 0.09, a: 0.004, gain: 0.05, lp: 900, bus: A.ui })
  tone({ t: t + 0.11, type: 'square', f: 165, d: 0.14, a: 0.004, gain: 0.05, lp: 900, bus: A.ui })
}

export function buy(big = false) {
  if (!ok(0.9)) return
  const t = now()
  const notes = big ? [523, 659, 784, 1046, 1318] : [659, 880]
  notes.forEach((f, i) => tone({ t: t + i * 0.075, type: 'triangle', f, d: 0.22, a: 0.004, gain: 0.09, bus: A.ui }))
  crinkle({ t: t + 0.1, n: big ? 10 : 4, dur: 0.3, gain: 0.04, f0: 5000, f1: 10000, width: 0.6, bus: A.ui })
}

export function toast() {
  if (!ok(0.3, 0.6)) return
  tone({ t: now(), f: 1175, f2: 1320, d: 0.1, a: 0.004, gain: 0.05, bus: A.ui })
}
