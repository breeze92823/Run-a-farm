import './hud.css'
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3 } from 'three'
import { FARM, GAME } from '../config.js'
import { ICONS, SEED_ICONS } from './icons.js'
import * as game from '../game.js'
import * as sfx from '../audio/ui.js'
import { anyWindowOpen, setWindowReserved } from './window.js'
import { openDealer, openDrones, openIndex, openOffice, openOil, openQuests, openRanch, openSeedMarket, openSettings, openShop } from './menus.js'
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
  GAME.boosts.forEach((b) => {
    const e = button('hud-boost', `<span class="ico">${b.id === 'money' ? ICONS.boostMoney : ICONS.boostFriends}</span>`, () => game.emit('toast', { text: `${b.title}: ${b.text}`, kind: 'info' }))
    e.append(outlined('lbl', b.label))
    boosts.append(e)
  })
  const moonBadge = el('div', 'hud-moon', `<span class="ico">${ICONS.sun}</span>`)
  const moonText = outlined('lbl', '')
  moonBadge.append(moonText)
  boosts.append(moonBadge)
  row.append(home, money, boosts)
  const goal = el('div', 'hud-goal')
  const goalText = el('span', 'goal-text')
  const goalStep = el('span', 'goal-step')
  goal.append(el('span', 'goal-ico', ICONS.harvester), goalText, goalStep)
  top.append(row, goal)

  // --- Left: menu buttons + event card ---------------------------------------------------------
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
  const event = el('div', 'hud-event')
  event.append(outlined('event-title', 'WEIGH-OFF EVENT'), el('span', 'event-ico', ICONS.pumpkin))
  const eventWeight = outlined('event-weight', '')
  const eventEnds = el('span', 'event-ends')
  event.append(eventWeight, eventEnds)

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
  const hotbar = el('div', 'hud-hotbar')
  hotbar.append(outlined('hotbar-title', 'SEEDS TO PLANT'))
  const slotsRow = el('div', 'hotbar-slots')
  const slots = GAME.seeds.map((s, i) => {
    const b = button('slot', `<span class="slot-ico">${SEED_ICONS[s.id]}</span><span class="slot-lock">${ICONS.lock}</span>`, () => game.selectSeed(i))
    b.append(outlined('slot-num', String(i + 1)))
    const count = outlined('slot-count', '')
    b.append(count)
    slotsRow.append(b)
    return { b, count }
  })
  hotbar.append(slotsRow)

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

  root.append(top, left, event, stats, hotbar, questBtn, prompt, toasts, pops)
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

  // --- Upgrade pads: bought ones disappear --------------------------------------------------------------------
  function applyPads() {
    for (const p of farm.pads.pads) {
      if (p.dynamic) continue // plot pads: plots.js shows and hides them
      const bought = game.padBought(p.name)
      p.disc.visible = !bought
      p.rim.visible = !bought
      p.label.visible = !bought
      for (const r of p.rings) r.visible = !bought
    }
  }
  applyPads()
  game.on('pad', applyPads)
  game.on('plot', () => (target = null))

  // --- Interaction: the nearest thing the player can use --------------------------------------------------------
  let target = null
  let shownText = null // the prompt text currently on screen
  function findTarget(pos) {
    let best = null
    let bestD = Infinity
    // Riding: the prompt is always "get off".
    if (farm.rideables.current) return farm.rideables.target(pos)
    const consider = (x, z, reach, t) => {
      const d = Math.hypot(pos.x - x, pos.z - z)
      if (d < reach && d < bestD) {
        best = t
        bestD = d
      }
    }
    const s = FARM.seedStall
    if (game.built('seedMarket')) consider(s.x, s.z + 2.6, 5, { text: 'OPEN SEED MARKET', sub: 'Seed Market', run: () => openSeedMarket() })
    consider(FARM.dealer.x, FARM.dealer.z - 2, FARM.dealer.reach, { text: 'VEHICLE DEALER', sub: 'Tractors, trucks, bike upgrades', run: () => openDealer() })
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
    eventWeight.textContent = `${st.weight} lb`
    // The goal: the cheapest building / field / vehicle for sale right now.
    const next = game.nextGoal()
    const need = next ? next.price - st.money : 0
    goal.style.display = next ? '' : 'none'
    if (next) goalText.textContent = need > 0 ? `Next: ${next.name} · need ${game.fmtMoney(need)} more!` : `${next.name} ready to buy!`
    goal.classList.toggle('ready', need <= 0)
    goalStep.textContent = `${st.built.length + st.plots.owned.length}/${GAME.buildings.length + GAME.plots.max}`
    slots.forEach(({ b, count }, i) => {
      const s = st.seeds[i]
      b.classList.toggle('locked', !s.unlocked)
      b.classList.toggle('selected', st.selected === i)
      count.textContent = s.unlocked ? `x${s.count}` : ''
      b.style.display = SEED_ICONS[GAME.seeds[i].id] ? '' : 'none'
      count.style.display = s.unlocked ? '' : 'none'
    })
    const ready = game.questsReady()
    questBadge.style.display = ready > 0 ? '' : 'none'
  }
  game.on('change', paint)
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
    document.documentElement.style.setProperty('--u', String(u))
    // Boxity's toolbar and chat: push the top row under the toolbar when they would meet,
    // and the left column under the chat feed.
    const tb = reserved.find((a) => a.id === 'toolbar')
    const chat = reserved.find((a) => a.id === 'chat')
    const rowW = top.offsetWidth || 660 * u
    let topY = 0
    if (tb && tb.left + tb.width > (w - rowW) / 2 - 6) topY = tb.top + tb.height + 4
    const leftTop = Math.max(275 * u, (chat ? chat.top + chat.height : tb ? tb.top + tb.height : 0) + 10)
    root.style.setProperty('--top', `${topY}px`)
    root.style.setProperty('--left-top', `${leftTop}px`)
    setWindowReserved(tb ? tb.top + tb.height : 0)
    fitLeft(u, short)
  }
  // The menu column hangs under Boxity's chat feed and the stats stand on the bottom
  // edge; on a short window they would meet. Then the column and the event card
  // (and, if that is not enough, the stats) shrink to fit, keeping 44 px tap targets.
  function fitLeft(u, short) {
    for (const e of [left, event, stats]) e.style.removeProperty('--px')
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
    event.style.setProperty('--px', `${lu}px`)
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
        eventEnds.textContent = `Ends in ${game.fmtLeft(game.state.eventEnds - Date.now())}`
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
