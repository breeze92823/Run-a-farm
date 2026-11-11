import './hud.css'
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3 } from 'three'
import { FARM, GAME } from '../config.js'
import { GOOD_ICONS, ICONS, SEED_ICONS } from './icons.js'
import * as game from '../game.js'
import * as sfx from '../audio/ui.js'
import { anyWindowOpen, setWindowReserved } from './window.js'
import { openDealer, openDrones, openIndex, openOffice, openOil, openQuests, openRanch, openSeedMarket, openSettings, openShop } from './menus.js'
import { openInvite } from './invite.js'
import { mount } from '../mount.js'
import * as fx from '../audio/sfx.js'
import { createHudExtras } from './hud2.js'
import { shear } from '../audio/extra.js'

// The on-screen HUD, laid out after the reference screenshots (1920x992):
//   top centre   - HOME, the money bar, two boosts, the Harvest Moon timer, and
//                  the goal banner under them ("Need $X more!")
//   left         - SHOP / SETTINGS / INDEX buttons and the WEIGH-OFF EVENT card
//   bottom left  - BAG (with EMPTY), STAND, STORAGE and CARGO bars
//   bottom       - the SEEDS TO PLANT hotbar (keys 1-5)
//   right        - the quests button with its "!" badge
//   bottom right - toasts; floating "+$" popups rise from the farm stand
// Sizes are reference pixels times --u. Boxity's toolbar and chat feed (top
// left) stay clear (setReserved); touch screens move things out of the way of
// the joystick and the jump cluster, and short landscape screens get their own
// compact arrangement (hud.css).

const REF = { w: 1920, h: 992 }

function el(tag, className, html) {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (html != null) e.innerHTML = html
  return e
}
const outlined = (className, text) => {
  const e = el('span', `ol ${className}`)
  e.textContent = text
  return e
}
// HUD buttons fire on pointerdown (no click delay on touch) with a press pop.
function button(className, html, fn) {
  const b = el('button', `hud-btn ${className}`, html)
  b.type = 'button'
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    b.classList.remove('pop')
    void b.offsetWidth
    b.classList.add('pop')
    sfx.click()
    fn?.(b)
  })
  return b
}

export function createHud({ farm, actions }) {
  const root = el('div', 'hud')
  document.body.append(root)

  // --- Top centre ------------------------------------------------------------------------
  const top = el('div', 'hud-top')
  const row = el('div', 'hud-toprow')
  const home = button('hud-home', `<span class="ico">${ICONS.home}</span>`, () => actions.home())
  home.append(outlined('lbl', 'HOME'))
  const money = el('div', 'hud-money')
  const moneyText = outlined('money-val', '$0')
  money.append(el('span', 'money-coin', ICONS.coin), el('span', 'money-bar'))
  money.lastChild.append(moneyText)
  const boosts = el('div', 'hud-boosts')
  // Earned through invites (game.js boostActive): greyed with a lock until then; a tap opens Invite Friends.
  const boostEls = GAME.boosts.map((b) => {
    const e = button('hud-boost', `<span class="ico">${b.id === 'money' ? ICONS.boostMoney : ICONS.boostFriends}</span>`, () => openInvite())
    e.append(outlined('lbl', b.label))
    boosts.append(e)
    return e
  })
  const paintBoosts = () =>
    GAME.boosts.forEach((b, i) => {
      const on = game.boostActive(b)
      boostEls[i].classList.toggle('locked', !on)
      boostEls[i].title = on ? `${b.title}: ${b.text}` : `${b.title} (locked): ${b.unlock}`
    })
  paintBoosts()
  game.on('invite', paintBoosts)
  const moonBadge = el('div', 'hud-moon', `<span class="ico">${ICONS.sun}</span>`)
  const moonText = outlined('lbl', '')
  moonBadge.append(moonText)
  boosts.append(moonBadge)
  row.append(home, money, boosts)
  // The goal banner appears at the top centre when a goal is new (or just became affordable) and folds
  // into a GOAL tab on the right edge after a few seconds, or at once with its minimize button. Tap the
  // tab to bring the banner back for a moment.
  const goal = el('div', 'hud-goal')
  const goalText = el('span', 'goal-text')
  const goalStep = el('span', 'goal-step')
  const goalIco = el('span', 'goal-ico', '')
  goalIco.style.display = 'none'
  let goalTimer = 0
  let goalHas = false
  const showGoal = (on, ms = 0) => {
    goal.classList.toggle('shown', on && goalHas)
    goalTab.classList.toggle('hide', on || !goalHas)
    clearTimeout(goalTimer)
    if (on && ms) goalTimer = setTimeout(() => showGoal(false), ms)
  }
  const goalMin = button('goal-min', '−', () => showGoal(false))
  goalMin.setAttribute('aria-label', 'Minimize goal')
  const goalTab = button('goal-tab hide', '<span>GOAL</span>', () => showGoal(true))
  goalTab.setAttribute('aria-label', 'Show the next goal')
  goal.append(goalIco, goalText, goalStep, goalMin)
  // A picture shows only when the goal is a vehicle (its bay is built); otherwise no icon.
  const GOAL_ICON = { tractors: 'tractor', trucks: 'truck' }
  let goalIcoKey = null
  let goalSeen = null // which goal / ready state the card last announced
  top.append(row, goal)

  // --- Left: menu buttons ---------------------------------------------------------
  const left = el('div', 'hud-left')
  const menuBtn = (cls, icon, label, fn) => {
    const b = button(`hud-menu ${cls}`, `<span class="ico">${ICONS[icon]}</span>`, fn)
    b.append(outlined('lbl', label))
    return b
  }
  left.append(
    menuBtn('m-shop', 'shop', 'SHOP', () => openShop()),
    menuBtn('m-settings', 'settings', 'SETTINGS', () => openSettings(actions)),
    menuBtn('m-index', 'index', 'INDEX', () => openIndex()),
  )

  // --- Stats ---------------------------------------------------------------------------------------
  const stats = el('div', 'hud-stats')
  const statRow = (id, icon, label, kind) => {
    const r = el('div', `stat stat-${id}`)
    const bar = el('div', `stat-bar ${kind}`)
    const fill = el('i')
    const val = outlined('stat-val', '')
    bar.append(fill, val)
    r.append(el('span', 'stat-ico', ICONS[icon]), outlined('stat-lbl', label), bar)
    stats.append(r)
    return { r, fill, val }
  }
  const sBag = statRow('bag', 'bag', 'BAG', 'green')
  const emptyBtn = button('stat-empty', '', () => game.emptyBag())
  emptyBtn.append(outlined('', 'EMPTY'))
  sBag.r.append(emptyBtn)
  const sStand = statRow('stand', 'eggs', 'STAND', 'green')
  const sStorage = statRow('storage', 'crate', 'STORAGE', 'gold')
  const sCargo = statRow('cargo', 'cargo', 'CARGO', 'red')

  // --- Hotbar ------------------------------------------------------------------------------------------
  // What the player carries (game.hotbarItems): bought seed packs, then the goods in the bag.
  // Keys 1-9 / a tap pick one; the held item shows in the avatar's hands.
  const hotbar = el('div', 'hud-hotbar')
  hotbar.append(outlined('hotbar-title', 'HOTBAR'))
  const slotsRow = el('div', 'hotbar-slots')
  hotbar.append(slotsRow)
  let slots = []
  let slotsKey = ''
  function buildSlots(items) {
    slotsRow.textContent = ''
    slots = items.map((it, k) => {
      const ico = it.kind === 'seed' ? SEED_ICONS[it.id] : GOOD_ICONS[it.id] ?? ICONS.crate
      const b = button(`slot ${it.kind}`, `<span class="slot-ico">${ico}</span>`, () => game.selectHotbar(k))
      b.title = it.kind === 'seed' ? `${GAME.seeds[it.i].name} seeds` : GAME.goods[it.id].name
      if (k < 9) b.append(outlined('slot-num', String(k + 1)))
      if (it.kind === 'seed') b.append(el('span', 'slot-tag', 'SEEDS'))
      const count = outlined('slot-count', '')
      b.append(count)
      slotsRow.append(b)
      return { b, count, it }
    })
  }

  // --- Right: quests ------------------------------------------------------------------------------------
  const questBtn = button('hud-quests', `<span class="ico">${ICONS.back}</span>`, () => openQuests())
  const questBadge = outlined('badge', '!')
  questBtn.append(questBadge)

  // --- Interact prompt, toasts, popups -------------------------------------------------------------------
  const prompt = button('hud-prompt', '', () => interact())
  prompt.addEventListener('pointerup', () => release())
  prompt.addEventListener('pointercancel', () => release())
  prompt.addEventListener('pointerleave', () => release())
  const promptHold = el('i', 'prompt-hold')
  prompt.append(promptHold)
  const promptKey = el('span', 'prompt-key', 'E')
  const promptText = el('span', 'prompt-text')
  const promptSub = el('span', 'prompt-sub')
  const promptWords = el('span', 'prompt-words')
  promptWords.append(promptText, promptSub)
  prompt.append(promptKey, promptWords)
  const toasts = el('div', 'hud-toasts')
  const pops = el('div', 'hud-pops')

  root.append(top, goalTab, left, stats, hotbar, questBtn, prompt, toasts, pops)
  const extras = createHudExtras({ root, top, left, stats, button, popAt: (...a) => popAt(...a), toast: (t) => toast(t), farm, actions })

  // --- Toasts ---------------------------------------------------------------------------------------------
  const recent = new Map()
  function toast({ text, kind = 'info' }) {
    const last = recent.get(text)
    if (last && performance.now() - last < 1500) return
    recent.set(text, performance.now())
    const t = el('div', `toast toast-${kind}`)
    t.append(outlined('', text))
    toasts.prepend(t)
    while (toasts.children.length > 4) toasts.lastChild.remove()
    setTimeout(() => t.classList.add('out'), 3200)
    setTimeout(() => t.remove(), 3600)
    if (kind !== 'good') sfx.toast()
  }
  game.on('toast', toast)
  game.on('deny', (d) => {
    if (d?.need) toast({ text: `Need ${game.fmtMoney(d.need)} more for ${d.what}!`, kind: 'warn' })
    sfx.deny()
  })
  const parts = farm.particles
  game.on('collect', (d) => {
    sfx.collect(d.n)
    parts?.burst(d.x, 0.9, d.z, { n: Math.min(10, 2 + d.n), colors: ['#fff6e3', '#e9c9a0'], speed: 1.4, up: 4, gravity: -9, life: 0.8, size: 0.24, additive: false, grow: 1 })
    parts?.burst(d.x, 1.2, d.z, { n: 8, colors: ['#fff6c0', '#ffe36a'], speed: 1.5, up: 3, gravity: -2, life: 0.6, size: 0.3 })
  })
  game.on('restock', () => {
    sfx.restock()
    parts?.burst(FARM.stand.x, 1.6, FARM.stand.z + 1, { n: 16, colors: ['#fff6c0', '#ffe36a', '#ffffff'], speed: 2.4, up: 3.5, gravity: -4, life: 0.8, size: 0.3 })
  })
  game.on('unload', ({ n }) => {
    sfx.restock()
    const L = FARM.loadZone
    fx.crateThud((L.minX + L.maxX) / 2, (L.minZ + L.maxZ) / 2, n)
    parts?.burst(cam ? lastPos.x : 0, 1.4, cam ? lastPos.z : 0, { n: 14, colors: ['#c79a5c', '#ffe36a'], speed: 2, up: 4, gravity: -9, life: 0.8, size: 0.28, additive: false })
  })
  game.on('truckLoad', ({ n }) => {
    fx.crateThud(lastPos.x, lastPos.z, n)
    parts?.burst(lastPos.x, 2, lastPos.z, { n: 18, colors: ['#c79a5c', '#fff3dc', '#f1c75a'], speed: 2.2, up: 4, gravity: -9, life: 0.9, size: 0.3, additive: false })
  })
  game.on('market', ({ amount, at }) => {
    if (!at) return
    sfx.coin(5)
    fx.till(at[0], at[1])
    parts?.coins(at[0], 2.2, at[1], 22)
    parts?.confetti(at[0], 2.5, at[1], 30)
    popAt(at[0], 3.2, at[1], `+${game.fmtMoney(amount)}`)
  })
  game.on('vanSold', ({ amount }) => {
    sfx.coin(4)
    popAt(FARM.cartonPallet.x, 4, FARM.road.z - 3, `+${game.fmtMoney(amount)}`)
  })
  game.on('oilSold', ({ amount }) => {
    sfx.coin(5)
    popAt(FARM.oil.station.x, 6, FARM.rail.z, `+${game.fmtMoney(amount)}`)
  })
  game.on('droneSold', ({ amount }) => {
    sfx.coin(2)
    toast({ text: `A drone sold goods in town +${game.fmtMoney(amount)}`, kind: 'good' })
  })
  game.on('ranchCollect', ({ r, amount, by }) => {
    if (r.cash) {
      sfx.coin(4)
      const [x, z] = FARM.ranchCrates[r.id]
      popAt(x, 3, z, `+${game.fmtMoney(amount)}`)
    } else if (by === 'player') sfx.collect(4)
  })
  game.on('build', () => (target = null))
  game.on('mount', () => (target = null))
  game.on('dismount', () => (target = null))
  game.on('buy', (d) => sfx.buy(d?.big))
  game.on('select', () => paint())
  game.on('reset', () => {
    applyPads()
    paint()
  })

  // Floating "+$" popups: over the farm stand when a batch of eggs sells, over
  // a plot when it is harvested, over the truck bay when a driver delivers.
  const v = new Vector3()
  let cam = null
  const lastPos = { x: 0, z: 0 }
  function popAt(x, y, z, text, coin = true) {
    if (!cam) return
    v.set(x, y, z)
    v.project(cam)
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return
    const p = el('div', 'money-pop') // not 'pop': that is the button press animation class
    if (coin) p.append(el('span', 'money-pop-coin', ICONS.coin))
    p.append(outlined('', text))
    p.style.left = `${((v.x + 1) / 2) * 100}%`
    p.style.top = `${((1 - v.y) / 2) * 100}%`
    pops.append(p)
    setTimeout(() => p.remove(), 1600)
    if (!coin) return
    flyCoins(((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight, 7)
  }
  // Coins burst from a screen point and fly in arcs into the money counter.
  let flying = 0
  function flyCoins(sx, sy, n) {
    const target = money.querySelector('.money-coin')?.getBoundingClientRect()
    if (!target || flying > 40) return
    const tx = target.left + target.width / 2
    const ty = target.top + target.height / 2
    for (let i = 0; i < n; i++) {
      const c = el('span', 'fly-coin', ICONS.coin)
      pops.append(c)
      flying++
      const a = Math.random() * Math.PI * 2
      const r = 30 + Math.random() * 50
      const mx = sx + Math.cos(a) * r
      const my = sy + Math.sin(a) * r - 40
      const delay = i * 55
      const dur = 650 + Math.random() * 250
      const anim = c.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) scale(0.3) rotate(0deg)`, opacity: 0 },
          { transform: `translate(${mx}px, ${my}px) scale(1.15) rotate(${120 + Math.random() * 120}deg)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.6) rotate(${360 + Math.random() * 180}deg)`, opacity: 1 },
        ],
        { duration: dur, delay, easing: 'cubic-bezier(.45,.05,.55,1)', fill: 'both' },
      )
      anim.onfinish = () => {
        c.remove()
        flying--
        if (i % 2 === 0) sfx.coin(1)
        money.classList.remove('bump')
        void money.offsetWidth
        money.classList.add('bump')
      }
    }
  }
  game.on('sale', ({ amount, n }) => {
    sfx.coin(n)
    popAt(FARM.stand.x + (Math.random() - 0.5) * 2, 4, FARM.stand.z + 1, `+${game.fmtMoney(amount)}`)
  })
  // Plants picked one by one: a soft pickup sound and a "+N" by the player, batched every ~0.4 s.
  const picks = { n: 0, good: null, t: 0, timer: 0 }
  const flushPicks = () => {
    picks.timer = 0
    if (picks.n > 0) popAt(lastPos.x, 2.6, lastPos.z, `+${picks.n} ${GAME.goods[picks.good].name}`, false)
    picks.n = 0
  }
  game.on('pick', ({ n, good }) => {
    if (picks.good !== good) flushPicks()
    picks.good = good
    picks.n += n
    const now = performance.now()
    if (now - picks.t > 140) {
      picks.t = now
      sfx.collect(1)
    }
    if (!picks.timer) picks.timer = setTimeout(flushPicks, 400)
  })
  game.on('harvest', ({ p, n, good, player }) => {
    sfx.collect(5)
    const c = p.crops
    popAt((c.minX + c.maxX) / 2, 3, (c.minZ + c.maxZ) / 2, `+${n} ${GAME.goods[good].name}${player ? '' : ' to storage'}`, false)
    if (player) parts?.burst(lastPos.x, 1.4, lastPos.z, { n: 20, colors: [GAME.goods[good].color, '#ffe36a'], speed: 2.5, up: 5, gravity: -9, life: 1, size: 0.3, additive: false })
  })
  game.on('work', ({ w, amount, n }) => {
    if (w.id === 'driver') {
      sfx.coin(3)
      toast({ text: `Truck sold ${n} goods in town +${game.fmtMoney(amount)}`, kind: 'good' })
    } else if (w.id === 'stocker') popAt(FARM.stand.x, 4.6, FARM.stand.z, `+${n} eggs`, false)
  })

  // --- Decor pads: shown once the buildings they need stand, gone once bought ------------------------------------
  function applyPads() {
    for (const p of farm.pads.pads) {
      if (p.dynamic) continue // plot / building pads: plots.js and gates.js show and hide them
      p.setVisible(game.padReady(p))
    }
  }
  applyPads()
  game.on('pad', applyPads)
  game.on('build', applyPads)
  game.on('plot', () => {
    target = null
    applyPads() // Field 1 counts as a building (`field1`)
  })

  // --- Interaction: the nearest thing the player can use --------------------------------------------------------
  let target = null
  let shownText = null // the prompt text currently on screen
  function findTarget(pos) {
    let best = null
    let bestD = Infinity
    // Riding: "get off", unless a drive-up service (refuel at the Fuel Station, repair at
    // the Workshop) is in reach and has work to do (hud2.js flags those `drive`).
    if (farm.rideables.current) {
      for (const t of extras.targets(pos)) {
        if (!t.drive) continue
        const d = Math.hypot(pos.x - t.x, pos.z - t.z)
        if (d < t.reach && d < bestD) {
          best = t
          bestD = d
        }
      }
      return best ?? farm.rideables.target(pos)
    }
    const consider = (x, z, reach, t) => {
      const d = Math.hypot(pos.x - x, pos.z - z)
      if (d < reach && d < bestD) {
        best = t
        bestD = d
      }
    }
    const s = FARM.seedStall
    if (game.built('seedMarket')) consider(s.x, s.z + 2.6, 5, { text: 'OPEN SEED MARKET', sub: 'Seed Market', run: () => openSeedMarket() })
    // The dealer: its front desk inside the showroom, and every vehicle on the lot out front.
    const desk = farm.town.desk
    consider(desk.x, desk.z, desk.reach, { text: 'VIEW VEHICLES', sub: 'Vehicle Dealer · front desk', run: () => openDealer() })
    for (const v of farm.town.lotSpots) consider(v.x, v.z, 4.5, { text: 'VIEW VEHICLES', sub: `${v.name[0]}${v.name.slice(1).toLowerCase()} for sale · Vehicle Dealer`, run: () => openDealer() })
    if (game.built('droneBase')) consider(farm.drones.console[0], farm.drones.console[1], 4, { text: 'DRONE BASE', sub: `${game.state.drones.n}/${GAME.drones.max} drones`, run: () => openDrones() })
    if (game.built('oilField')) consider(farm.oil.tankAt[0], farm.oil.tankAt[1] + 5, 4.5, { text: 'OIL FIELD', sub: `Tank ${Math.floor(game.state.oil.tank)}/${game.oilTankMax()} barrels`, run: () => openOil() })
    for (const sp of farm.ranch.spots) if (game.built(sp.r.id) && !sp.r.hold) consider(sp.x, sp.z, 3.2, { text: sp.r.name.toUpperCase(), sub: 'Animals and upgrades', run: () => openRanch(sp.r) })
    for (const sp of farm.ranch.spots) if (game.built(sp.r.id) && sp.r.hold) consider(sp.x + 2.6, sp.z, 2.2, { text: sp.r.name.toUpperCase(), sub: 'Animals and upgrades', run: () => openRanch(sp.r) })
    for (const t of extras.targets(pos)) consider(t.x, t.z, t.reach, t)
    const o = FARM.office
    const dO = Math.hypot(pos.x - o.x, pos.z - o.z)
    if (game.built('office') && dO < o.reach && dO < bestD) {
      best = { text: 'HIRE WORKERS', sub: 'Farm Office', run: () => openOffice(), office: true }
      bestD = dO
    }
    for (const p of farm.pads.pads) {
      if (!p.disc.visible) continue
      const d = Math.hypot(pos.x - p.x, pos.z - p.z)
      if (d < 2.4 && d < bestD) {
        bestD = d
        const sub = p.u ? `${game.fmtMoney(p.price)} · ${p.u.perk}` : game.fmtMoney(p.price)
        best = { text: p.u ? `UPGRADE ${p.name.toUpperCase()}` : `BUY ${p.name.toUpperCase()}`, sub, run: () => (p.buy ? p.buy() : game.buyPad(p)), pad: p }
      }
    }
    // Vehicles to get on.
    const r = farm.rideables.target(pos)
    if (r && r.d < bestD + 0.5) best = r
    return best
  }
  // Hold-to-act targets (shearing): E / the prompt held down for target.hold s.
  let holding = null // { t, target }
  function release() {
    if (!holding) return
    holding = null
    promptHold.style.width = '0'
  }
  window.addEventListener('keyup', (e) => e.code === 'KeyE' && release())
  function interact() {
    if (anyWindowOpen() || !target) return false
    if (target.hold) {
      holding = { t: 0, target }
      return true
    }
    target.run()
    // The prompt text (price, level) may have changed: re-read it next frame.
    target = null
    return true
  }
  // A left click in the world: while the cursor is locked (camera look), it
  // uses whatever the prompt offers; with a free cursor, only a click on the
  // thing itself (its pad, card or the office) uses it, so clicking anywhere
  // else still grabs the cursor for the camera as before.
  const ray = new Raycaster()
  const ndc = new Vector2()
  // The FARM STAND card's EGG PRICE + button: a click / tap on it buys the
  // upgrade from anywhere it can be seen (with a locked cursor, the screen
  // centre is the pointer).
  const card = farm.stand.card
  const cardHits = []
  function onCardButton(x, y) {
    if (!cam || !card.sprite.visible) return false
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    cardHits.length = 0
    card.sprite.raycast(ray, cardHits)
    return cardHits.length > 0 && card.hitButton(cardHits[0].uv)
  }
  function click(e, locked) {
    if (anyWindowOpen()) return false
    const cx = locked ? window.innerWidth / 2 : e.clientX
    const cy = locked ? window.innerHeight / 2 : e.clientY
    if (onCardButton(cx, cy)) {
      sfx.click()
      card.press()
      return true
    }
    if (!target) return false
    if (locked) return interact()
    if (!cam) return false
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    if (target.obj) return ray.intersectObject(target.obj, true).length ? interact() : false
    if (!target.office && !target.pad) return false
    const hits = target.office ? officeHits : [target.pad.disc, target.pad.rim, target.pad.label]
    if (!ray.intersectObjects(hits, false).length) return false
    return interact()
  }
  // The office: an invisible box around the cottage front for click hits.
  const officeBox = new Mesh(new BoxGeometry(11, 4.5, 2), new MeshBasicMaterial())
  officeBox.position.set(FARM.farmhouse.x, 2.25, FARM.office.z - 1.5)
  officeBox.updateMatrixWorld()
  const officeHits = [officeBox]
  // Mouse hover over the card button (free cursor only): pointer cursor + highlight.
  let hoverXY = null
  window.addEventListener('pointermove', (e) => {
    hoverXY = e.pointerType === 'mouse' && e.target?.tagName === 'CANVAS' && !document.pointerLockElement ? [e.clientX, e.clientY] : null
  })
  function updateHover() {
    const on = !!hoverXY && !anyWindowOpen() && onCardButton(hoverXY[0], hoverXY[1])
    card.setHover(on)
    document.body.classList.toggle('hud-hover-btn', on)
  }

  // --- Paint ------------------------------------------------------------------------------------------------------
  const setBar = (s, n, max) => {
    s.fill.style.width = `${Math.max(0, Math.min(1, n / max)) * 100}%`
    s.val.textContent = `${n} / ${max}`
  }
  function paint() {
    const st = game.state
    const bag = game.bagCount()
    setBar(sBag, bag, st.bag.max)
    setBar(sStand, st.stand.eggs, st.stand.max)
    sStorage.r.style.display = game.built('storage') ? '' : 'none'
    setBar(sStorage, game.storageCount(), st.storage.max)
    const m = mount.active
    sCargo.r.style.display = m?.kind === 'truck' ? '' : 'none'
    if (m?.kind === 'truck') setBar(sCargo, game.count(game.truckCargo(m.k).items), game.truckCargoMax())
    emptyBtn.style.visibility = bag > 0 ? 'visible' : 'hidden'
    sBag.r.classList.toggle('full', bag >= st.bag.max)
    // The goal: the cheapest building / field / vehicle for sale right now.
    const next = game.nextGoal()
    const need = next ? next.price - st.money : 0
    if (!!next !== goalHas) {
      goalHas = !!next
      if (!next) showGoal(false)
    }
    if (next) goalText.textContent = need > 0 ? `Next: ${next.name} · need ${game.fmtMoney(need)} more!` : `${next.name} ready to buy!`
    goal.classList.toggle('ready', need <= 0)
    goalTab.classList.toggle('ready', need <= 0)
    const gk = next ? GOAL_ICON[next.id] ?? '' : ''
    if (gk !== goalIcoKey) {
      goalIcoKey = gk
      goalIco.innerHTML = gk ? ICONS[gk] : ''
      goalIco.style.display = gk ? '' : 'none'
    }
    const seen = next ? `${next.id}:${need <= 0}` : null
    if (seen !== goalSeen) {
      goalSeen = seen
      if (seen) showGoal(true) // a new goal, or it just became affordable: stays maximized until the player minimizes it
    }
    goalStep.textContent = `${st.built.length + st.plots.owned.length}/${GAME.buildings.length + GAME.plots.max}`
    paintHotbar()
    const ready = game.questsReady()
    questBadge.style.display = ready > 0 ? '' : 'none'
  }
  function paintHotbar() {
    const items = game.hotbarItems()
    const key = items.map((it) => `${it.kind}:${it.id}`).join('|')
    if (key !== slotsKey) {
      slotsKey = key
      buildSlots(items)
    }
    hotbar.style.display = items.length ? '' : 'none'
    const h = game.hand
    slots.forEach(({ b, count }, k) => {
      const it = items[k]
      b.classList.toggle('selected', h.kind === it.kind && h.id === it.id)
      count.textContent = `x${it.count}`
    })
  }
  game.on('change', paint)
  game.on('hold', paintHotbar)
  paint()

  // --- Layout --------------------------------------------------------------------------------------------------------
  let reserved = []
  function layout() {
    const w = window.innerWidth
    const h = window.innerHeight
    const touch = document.body.classList.contains('touch-ui')
    const narrow = w < 720
    const short = h < 540 && w > h
    let u = Math.min(w / REF.w, h / REF.h)
    u = short ? Math.min(0.6, Math.max(0.36, (h / REF.h) * 1.15)) : Math.min(1.25, Math.max(narrow ? 0.4 : 0.45, u))
    root.classList.toggle('touch', touch)
    root.classList.toggle('narrow', narrow && !short)
    root.classList.toggle('short', short)
    const docStyle = document.documentElement.style
    docStyle.setProperty('--u', String(u))
    // Phones: touch.js moves its buttons into the HUD's side columns too. Only touch the body's
    // classes when they change: the MutationObserver below re-runs layout on every class write.
    const bodyCls = document.body.classList
    if (bodyCls.contains('layout-narrow') !== (narrow && !short)) bodyCls.toggle('layout-narrow', narrow && !short)
    if (bodyCls.contains('layout-short') !== short) bodyCls.toggle('layout-short', short)
    // Landscape phones: the quests button joins the menu grid; elsewhere it stands on its own.
    const questHome = short ? left : root
    if (questBtn.parentNode !== questHome) questHome.append(questBtn)
    // Boxity's toolbar and chat: slide the top row right of the toolbar when there is room
    // (landscape phones keep the whole height that way), else push it under the toolbar;
    // the left column hangs under the chat feed.
    const tb = reserved.find((a) => a.id === 'toolbar')
    const chat = reserved.find((a) => a.id === 'chat')
    const rowW = row.offsetWidth || 600 * u
    let topY = 0
    let topX = w / 2
    if (tb && tb.left + tb.width > (w - rowW) / 2 - 6) {
      // Right of the toolbar, clear of the top-right corner (touch buttons, clock).
      // With touch the menu grid sits under the touch buttons; without, it is level with the row.
      const rightKeep = touch || !short ? 126 : w - left.getBoundingClientRect().left + 8
      const x = tb.left + tb.width + 8 + rowW / 2
      if (short && x + rowW / 2 <= w - rightKeep) topX = x
      else topY = tb.top + tb.height + 4
    }
    const leftTop = Math.max(275 * u, (chat ? chat.top + chat.height : tb ? tb.top + tb.height : 0) + 10)
    root.style.setProperty('--top', `${topY}px`)
    root.style.setProperty('--top-x', `${topX}px`)
    // Landscape phones: the goal banner (centred under the row) must stop short of the toolbar
    // on its left and the menu grid on its right.
    if (short) {
      const lo = (tb && !topY ? tb.left + tb.width : 0) + 8
      const hi = left.getBoundingClientRect().left - 8
      goal.style.maxWidth = `${Math.max(160, 2 * Math.min(topX - lo, hi - topX))}px`
    } else goal.style.removeProperty('max-width')
    root.style.setProperty('--left-top', `${leftTop}px`)
    docStyle.setProperty('--hud-col-top', `${leftTop}px`)
    setWindowReserved(tb ? tb.top + tb.height : 0)
    fitLeft(u, short)
  }
  // The menu column hangs under Boxity's chat feed and the stats stand on the bottom
  // edge; on a short window they would meet. Then the column 
  // (and, if that is not enough, the stats) shrink to fit, keeping 44 px tap targets.
  function fitLeft(u, short) {
    for (const e of [left, stats]) e.style.removeProperty('--px')
    if (short) return
    const gap = 12
    const lt = left.getBoundingClientRect()
    const st = stats.getBoundingClientRect()
    if (st.left >= lt.right || lt.bottom + gap <= st.top) return
    const minU = 44 / 112 // a menu button stays a 44 px tap target
    const room = st.top - gap - lt.top
    let lu = Math.max(minU, (u * room) / lt.height)
    if (lu > u) lu = u
    left.style.setProperty('--px', `${lu}px`)
    const lb = left.getBoundingClientRect().bottom
    if (lb + gap > st.top) {
      // Still too tall: the stats give way too (they stand on the bottom edge).
      const su = Math.max(0.3, (u * (window.innerHeight - lb - gap - 8)) / (st.height + 20 * u))
      stats.style.setProperty('--px', `${Math.min(u, su)}px`)
    }
  }
  window.addEventListener('resize', layout)
  new MutationObserver(layout).observe(document.body, { attributes: true, attributeFilter: ['class'] })
  layout()
  requestAnimationFrame(layout) // once the fonts have given the top row its width

  // --- Per frame -------------------------------------------------------------------------------------------------------
  let shown = game.state.money
  let lastShown = -1
  let clockT = 0
  let paintT = 0
  return {
    interact,
    click,
    setReserved(areas) {
      reserved = areas
      layout()
    },
    update(dt, playerPos, camera) {
      cam = camera
      lastPos.x = playerPos.x
      lastPos.z = playerPos.z
      game.tick(dt, playerPos)
      updateHover()
      extras.update(dt, playerPos)
      if (holding) {
        holding.t += dt
        promptHold.style.width = `${Math.min(1, holding.t / holding.target.hold) * 100}%`
        shear(playerPos.x, playerPos.z, dt)
        if (holding.t >= holding.target.hold) {
          const t = holding.target
          release()
          t.run()
          target = null
        } else if (target !== holding.target && target?.text !== holding.target.text) release()
      }
      // Money counts up/down smoothly to the real value.
      const target$ = game.state.money
      shown += (target$ - shown) * Math.min(1, dt * 8)
      if (Math.abs(target$ - shown) < 1) shown = target$
      const r = Math.round(shown)
      if (r !== lastShown) {
        lastShown = r
        moneyText.textContent = game.fmtMoney(r)
      }
      // Once a second: countdowns.
      clockT -= dt
      if (clockT <= 0) {
        clockT = 1
      }
      moonBadge.style.display = game.moon.active ? '' : 'none'
      if (game.moon.active) moonText.textContent = `${Math.ceil(game.moon.left)}s`
      if (mount.active?.kind === 'truck' || paintT-- <= 0) {
        paintT = 30
        paint()
      }
      // Interaction prompt.
      const next = anyWindowOpen() ? null : findTarget(playerPos)
      // Compare with what the prompt shows (not `target`, which events and interact() null out), so a
      // target that vanished while `target` was already null still hides the prompt.
      if ((next?.text ?? null) !== shownText || (next && !target)) {
        target = next
        shownText = next?.text ?? null
        prompt.classList.toggle('show', !!target)
        if (target) {
          promptText.textContent = target.text
          promptSub.textContent = target.sub
        }
      }
    },
  }
}
