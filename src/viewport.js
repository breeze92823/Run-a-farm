// The one place that notices the screen changing size (rotation, browser bars, split view).
// Phones are unreliable here: after a rotation `resize` often fires while innerWidth /
// innerHeight still hold the old orientation (iOS Safari, in-app browsers, the portal's
// iframe), or it does not fire at all. So every hint (resize, orientationchange,
// screen.orientation, visualViewport, a ResizeObserver on the page) starts a short burst
// of re-measuring on animation frames, and listeners hear about a size only when it
// actually changed. A slow fallback check catches anything those all miss.

const listeners = new Set()
let w = 0
let h = 0
let burst = 0 // frames left to keep re-measuring
let raf = 0

const readW = () => Math.max(1, window.innerWidth || document.documentElement.clientWidth)
const readH = () => Math.max(1, window.innerHeight || document.documentElement.clientHeight)

function check() {
  const nw = readW()
  const nh = readH()
  if (nw === w && nh === h) return
  w = nw
  h = nh
  for (const fn of listeners) fn(w, h)
}

function frame() {
  raf = 0
  check()
  if (--burst > 0) raf = requestAnimationFrame(frame)
}

// Re-measure now and for the next ~60 frames (about a second), when the new size settles.
function kick() {
  check()
  burst = 60
  if (!raf) raf = requestAnimationFrame(frame)
}

window.addEventListener('resize', kick)
window.addEventListener('orientationchange', kick)
window.addEventListener('pageshow', kick)
document.addEventListener('visibilitychange', kick)
try {
  screen.orientation?.addEventListener?.('change', kick)
} catch {
  // Older browsers: orientationchange covers it.
}
window.visualViewport?.addEventListener('resize', kick)
if (typeof ResizeObserver === 'function') new ResizeObserver(kick).observe(document.documentElement)
setInterval(check, 500) // last resort: a few comparisons a second, no allocations when unchanged

w = readW()
h = readH()

export const viewport = {
  get width() {
    return w
  },
  get height() {
    return h
  },
}

// fn(width, height) on every real size change. Returns an unsubscribe function.
export function onViewportChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
