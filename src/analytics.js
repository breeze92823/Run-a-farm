// GameAnalytics (gameanalytics.com, free): where players drop off. Like bloxity.js, nothing here may
// throw or block the game; with no keys (local dev, dev channel) every call is a no-op.
//
// Keys come from the build env (VITE_GA_GAME_KEY / VITE_GA_SECRET_KEY, set only for the prod build in
// .github/workflows/deploy.yml). GameAnalytics makes its own random user id; no Bloxity id, name or
// other personal data is sent.
//
// What is sent (see `install` and the calls in main.js / net.js):
//  - Session start / end (the SDK; pagehide also ends it, since phones often skip beforeunload).
//  - Load:Done (value = seconds from page open), so sessions without it quit while loading.
//  - Tutorial progression: Start / Complete per step (Tutorial:<step id>), Fail when skipped.
//  - Build:<id>, Field:<n>, Vehicle:<id>, Hire:<id>, Level:Up, Prestige, with value = this
//    browser's total play minutes, so the dashboard shows how long each milestone takes.
//  - Sell:Stand / Sell:Market (the first of each a session), Ad:Break, Net:Joined / Net:Dropped /
//    Net:Offline, and script errors (deduplicated, at most MAX_ERRORS a session).
//  - Dimensions: 01 = touch / desktop, 02 = guest / signedIn, 03 = graphics preset.
import { gameanalytics } from 'gameanalytics'
import { COARSE_POINTER, DEFAULT_GRAPHICS, GAME } from './config.js'
import * as bloxity from './bloxity.js'
import * as game from './game.js'

const GAME_KEY = import.meta.env.VITE_GA_GAME_KEY || ''
const SECRET_KEY = import.meta.env.VITE_GA_SECRET_KEY || ''
const BUILD = import.meta.env.VITE_BUILD_ID || 'local'
const PLAY_KEY = 'run-a-farm.ga.play.v1' // total seconds played in this browser
const MAX_ERRORS = 10
const GRAPHICS = ['Low', 'Medium', 'High', 'Ultra']

const GA = gameanalytics.GameAnalytics
const { EGAProgressionStatus: Status, EGAErrorSeverity: Severity } = gameanalytics
let on = false

function safe(fn) {
  if (!on) return
  try {
    fn()
  } catch (e) {
    console.warn('[analytics]', e)
  }
}

// GameAnalytics event id parts: letters, digits, space and - _ . ( ) ! ? (max 64 each).
const part = (s) => String(s ?? '').replace(/[^A-Za-z0-9 \-_.()!?]/g, '_').slice(0, 64) || 'none'

// --- Play time (this browser, all sessions): counted while the tab is visible ------------------------
let played = 0
try {
  played = Number(localStorage.getItem(PLAY_KEY)) || 0
} catch {
  // Storage blocked: count this session only.
}
const playMinutes = () => Math.round((played / 60) * 10) / 10

export function design(id, value) {
  safe(() => (value === undefined ? GA.addDesignEvent(id) : GA.addDesignEvent(id, value)))
}
const milestone = (id) => design(id, playMinutes())

// Called once the loading screen goes away (main.js).
export function loadDone() {
  design('Load:Done', Math.round(performance.now() / 100) / 10)
  tutorialStart()
}

// --- Tutorial ----------------------------------------------------------------------------------------
const tut = () => game.state.tutorial
const stepId = (i) => GAME.tutorial[i]?.id
let tutStep = -1 // the step we last sent Start for
function tutorialStart() {
  const t = tut()
  if (!t || t.done || t.step >= GAME.tutorial.length) return
  if (tutStep === t.step) return
  tutStep = t.step
  safe(() => GA.addProgressionEvent(Status.Start, 'Tutorial', part(stepId(t.step))))
}
function onTutorial() {
  const t = tut()
  if (!t) return
  // Skipped (Settings): the step it was on fails.
  if (t.done && t.step < GAME.tutorial.length) {
    if (tutStep >= 0) safe(() => GA.addProgressionEvent(Status.Fail, 'Tutorial', part(stepId(tutStep))))
    design('Tutorial:Skipped')
    tutStep = -1
    return
  }
  // Advanced: every step from the last one sent up to the new one is complete.
  if (tutStep >= 0 && t.step > tutStep) {
    for (let i = tutStep; i < t.step; i++) {
      const id = part(stepId(i))
      safe(() => GA.addProgressionEvent(Status.Complete, 'Tutorial', id))
    }
  }
  if (t.done) {
    safe(() => GA.addProgressionEvent(Status.Complete, 'Tutorial'))
    milestone('Tutorial:Done')
    tutStep = -1
    return
  }
  tutStep = -1
  tutorialStart()
}

// --- Setup -------------------------------------------------------------------------------------------
export function install() {
  if (!GAME_KEY || !SECRET_KEY || on) return
  try {
    if (import.meta.env.DEV) GA.setEnabledInfoLog(true)
    GA.configureBuild(part(BUILD))
    GA.configureAvailableCustomDimensions01(['touch', 'desktop'])
    GA.configureAvailableCustomDimensions02(['guest', 'signedIn'])
    GA.configureAvailableCustomDimensions03(GRAPHICS)
    GA.initialize(GAME_KEY, SECRET_KEY)
    on = true
    GA.setCustomDimension01(COARSE_POINTER ? 'touch' : 'desktop')
    GA.setCustomDimension02('guest')
    const g = bloxity.settings.graphics_quality
    GA.setCustomDimension03(GRAPHICS.includes(g) ? g : DEFAULT_GRAPHICS)
  } catch (e) {
    console.warn('[analytics] init failed', e)
    on = false
    return
  }

  bloxity.subscribeAuth((s) => {
    if (s.ready) safe(() => GA.setCustomDimension02(s.user ? 'signedIn' : 'guest'))
  })
  bloxity.onSetting((key, value) => {
    if (key === 'graphics_quality' && GRAPHICS.includes(value)) safe(() => GA.setCustomDimension03(value))
  })
  bloxity.onAdBreak((start) => start && design('Ad:Break'))

  game.on('tutorial', onTutorial)
  game.on('build', (b) => milestone(`Build:${part(b?.id)}`))
  game.on('plot', (e) => e?.why === 'buy' && milestone(`Field:${part(e.p?.n)}`))
  game.on('vehicle', (v) => milestone(`Vehicle:${part(v?.id)}`))
  game.on('hire', (w) => milestone(`Hire:${part(w?.id)}`))
  game.on('levelUp', (e) => design('Level:Up', Number(e?.level) || 0))
  game.on('prestige', (n) => design('Prestige', Number(n) || 0))
  let soldStand = false
  let soldMarket = false
  game.on('sale', () => {
    if (soldStand) return
    soldStand = true
    milestone('Sell:Stand')
  })
  game.on('market', () => {
    if (soldMarket) return
    soldMarket = true
    milestone('Sell:Market')
  })

  // Play time: +5 s every 5 s while the tab is visible, saved now and then.
  let tick = 0
  setInterval(() => {
    if (document.hidden) return
    played += 5
    if (++tick % 6 === 0) {
      try {
        localStorage.setItem(PLAY_KEY, String(played))
      } catch {
        // Storage blocked.
      }
    }
  }, 5000)

  // Errors: the first few distinct ones a session.
  const seen = new Set()
  const report = (msg) => {
    const m = String(msg || 'unknown').slice(0, 500)
    if (seen.has(m) || seen.size >= MAX_ERRORS) return
    seen.add(m)
    safe(() => GA.addErrorEvent(Severity.Error, m))
  }
  window.addEventListener('error', (e) => report(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`))
  window.addEventListener('unhandledrejection', (e) => report(`unhandled: ${e.reason?.message ?? e.reason}`))

  // Phones often close a tab without beforeunload; pagehide ends the session there.
  window.addEventListener('pagehide', () => {
    try {
      localStorage.setItem(PLAY_KEY, String(played))
    } catch {
      // Storage blocked.
    }
    safe(() => GA.onStop())
  })
  window.addEventListener('pageshow', (e) => e.persisted && safe(() => GA.onResume()))
}
