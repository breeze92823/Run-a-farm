import { GAME } from '../config.js'
import * as game from '../game.js'
import { GOOD_ICONS, ICONS } from './icons.js'
import { btn, el, openWindow } from './window.js'
import * as proc from '../econ/processing.js'
import * as con from '../econ/contracts.js'
import { hotItem, known, priceMult, trend } from '../econ/prices.js'
import * as prog from '../econ/progress.js'
import * as fleet from '../econ/fleet.js'
import * as care from '../econ/care.js'
import { clock } from '../econ/clock.js'
import { mount } from '../mount.js'

// Windows for the roadmap systems (econ/*.js). Same shell and live refresh as menus.js.

export function live(api) {
  let queued = false
  const off = game.on('change', () => {
    if (queued) return
    queued = true
    setTimeout(() => {
      queued = false
      api.refresh()
    }, 300)
  })
  const close = api.close
  api.close = (silent) => {
    off()
    close(silent)
  }
}
export function perkRow(parent, { icon, name, text, price, maxed = false, locked = false, lockText = 'LOCKED', fn, blue = false, label = null }) {
  const r = el('div', 'uiw-perk')
  r.append(el('span', 'uiw-perk-icon', icon ?? ''), el('div', 'uiw-perk-words', `<div class="uiw-perk-name">${name}</div><div class="uiw-perk-text">${text}</div>`))
  const b = btn(maxed || locked ? 'grey' : game.state.money >= price ? (blue ? 'blue' : '') : 'red', maxed ? 'MAX' : locked ? lockText : label ?? game.fmtMoney(price), fn)
  b.disabled = maxed || locked
  r.append(b)
  parent.append(r)
  return r
}
const icon = (g) => GOOD_ICONS[g] ?? ICONS.crate
const arrow = (k) => (k > 0 ? '<b class="up">▲</b>' : k < 0 ? '<b class="down">▼</b>' : '<b class="flat">•</b>')
const pct = (k) => `${k >= 1 ? '+' : ''}${Math.round((k - 1) * 100)}%`

// --- A processing building -------------------------------------------------------------------------------
export function openProcessing(id) {
  const def = proc.procDef(id)
  const api = openWindow({
    title: def.name.toUpperCase(),
    icon: 'build',
    theme: 'gold',
    render(body) {
      const s = proc.procState(id)
      if (!s) return
      const job = s.job ? `Making ${s.job.n} ${GAME.goods[s.job.out].name.toLowerCase()} (${Math.round((s.job.t / def.every) * 100)}%)` : 'Idle: waiting for inputs in storage'
      body.append(el('p', 'uiw-sub', `${job}. One cycle every <b>${proc.cycleTime(def, s).toFixed(1)}s</b>, ${proc.batch(s)} at a time. Crate <b>${proc.crateCount(id)}/${proc.crateMax(def, s)}</b>: walk past it to collect, or hire a ${def.worker}.`))
      const rows = el('div', 'uiw-jobs uiw-wide')
      for (const rc of def.recipes) {
        const ok = proc.canRun(rc, 1) > 0
        const r = el('div', `uiw-perk${ok ? '' : ' dim'}`)
        r.append(el('span', 'uiw-perk-icon', icon(rc.out)), el('div', 'uiw-perk-words', `<div class="uiw-perk-name">${rc.n} ${GAME.goods[rc.out].name.toUpperCase()}</div><div class="uiw-perk-text">from ${proc.inputsText(rc)} · sells ${game.fmtMoney(game.goodPrice(rc.out))} each</div>`))
        r.append(el('span', `uiw-tag ${ok ? 'ok' : ''}`, ok ? 'READY' : 'NEED INPUTS'))
        rows.append(r)
      }
      const U = GAME.procUp
      perkRow(rows, { icon: ICONS.speed, name: U.speed.name.toUpperCase(), text: `${U.speed.perk} - LV ${s.speed}/${U.speed.max}`, price: proc.upPrice(id, 'speed'), maxed: s.speed >= U.speed.max, fn: () => proc.buyProcUp(id, 'speed'), blue: true })
      perkRow(rows, { icon: ICONS.crate, name: U.cap.name.toUpperCase(), text: `${U.cap.perk} - LV ${s.cap}/${U.cap.max}`, price: proc.upPrice(id, 'cap'), maxed: s.cap >= U.cap.max, fn: () => proc.buyProcUp(id, 'cap'), blue: true })
      perkRow(rows, { icon: ICONS.hand, name: `HIRE A ${def.worker.toUpperCase()}`, text: s.worker ? 'Working: 50% faster, crate goes to storage' : '50% faster, carries the crate to storage', price: proc.workerPrice(id), maxed: !!s.worker, fn: () => proc.hireProc(id) })
      body.append(rows)
    },
  })
  live(api)
}

// --- Contracts board ---------------------------------------------------------------------------------------
export function openContracts() {
  const api = openWindow({
    title: 'CONTRACTS',
    icon: 'quest',
    theme: 'gold',
    render(body) {
      body.append(el('p', 'uiw-sub', `Deliver at the town market's SELL HERE square (on foot or by truck): goods a contract needs go to it first. Completed: <b>${game.state.contracts.done ?? 0}</b>`))
      const list = con.contracts()
      if (!list.length) body.append(el('p', 'uiw-sub', 'New contracts are being posted...'))
      for (const c of list) {
        const r = el('div', 'uiw-quest')
        const left = con.timeLeft(c)
        r.append(el('div', '', `<div class="uiw-quest-name">${game.fmtMoney(c.reward)} + ${con.bonusText(c.bonus)}</div><div class="uiw-quest-text">${con.wantText(c)} · ${game.fmtClock(left)} left</div>`))
        const b = btn('grey', `<small>NEW ONE</small>${game.fmtMoney(con.rerollPrice())}`, () => con.reroll(c))
        r.append(b)
        const bar = el('div', 'uiw-bar')
        const p = con.progress(c)
        const t = con.total(c)
        bar.append(el('i'), el('span', '', `${p} / ${t}`))
        bar.firstChild.style.width = `${(p / t) * 100}%`
        r.append(bar)
        body.append(r)
      }
    },
  })
  live(api)
  const off = game.on('contracts', () => api.refresh())
  const close = api.close
  api.close = (s) => {
    off()
    close(s)
  }
  const tick = setInterval(() => api.refresh(), 1000)
  const close2 = api.close
  api.close = (s) => {
    clearInterval(tick)
    close2(s)
  }
}

// --- Market prices (town market, Index) ----------------------------------------------------------------------
export function openPrices() {
  const api = openWindow({
    title: 'MARKET PRICES',
    icon: 'market',
    theme: 'green',
    render(body) {
      const hot = hotItem()
      body.append(el('p', 'uiw-sub', `Prices drift through the day. Today's hot item: <b>${GAME.goods[hot].name}</b> sells for ${GAME.prices.hot}x!`))
      const grid = el('div', 'uiw-grid')
      for (const g of Object.keys(GAME.goods)) {
        if (!known(g)) continue
        const k = priceMult(g)
        const c = el('div', `uiw-card${g === hot ? ' hot' : ''}`)
        c.append(el('div', 'uiw-card-icon', icon(g)), el('div', 'uiw-card-name', GAME.goods[g].name), el('div', 'uiw-card-text', `${game.fmtMoney(game.goodPrice(g))} ${arrow(trend(g))}`), el('div', 'uiw-card-meta', g === hot ? 'HOT 2x' : pct(k)))
        grid.append(c)
      }
      body.append(grid)
    },
  })
  const tick = setInterval(() => api.refresh(), 2000)
  const close = api.close
  api.close = (s) => {
    clearInterval(tick)
    close(s)
  }
}

// --- Achievements + farm level ----------------------------------------------------------------------------------
export function openAwards(actions) {
  const api = openWindow({
    title: 'AWARDS',
    icon: 'quest',
    theme: 'gold',
    render(body) {
      const st = game.state
      body.append(el('p', 'uiw-sub', `Farm level <b>${prog.level()}</b> (${Math.round(prog.xpProgress() * 100)}% to the next). Trophies stand on the shelf on your cottage porch. Unlocked <b>${st.ach.length}/${GAME.achievements.length}</b>.`))
      for (const a of GAME.achievements) {
        const done = prog.unlocked(a)
        const v = Math.min(a.goal, prog.statValue(a.stat))
        const r = el('div', `uiw-quest${done ? ' done' : ''}`)
        r.append(el('div', '', `<div class="uiw-quest-name"><span class="medal ${a.medal}"></span>${a.name}</div><div class="uiw-quest-text">${a.text}</div>`))
        r.append(el('span', `uiw-tag ${done ? 'ok' : ''}`, done ? 'DONE' : a.medal.toUpperCase()))
        const bar = el('div', 'uiw-bar')
        bar.append(el('i'), el('span', '', `${v.toLocaleString('en-US')} / ${a.goal.toLocaleString('en-US')}`))
        bar.firstChild.style.width = `${(v / a.goal) * 100}%`
        r.append(bar)
        body.append(r)
      }
      // Prestige.
      const P = GAME.prestige
      const can = prog.canPrestige()
      const pr = el('div', 'uiw-jobs uiw-wide')
      perkRow(pr, {
        icon: ICONS.coin,
        name: `SELL THE FARM${st.prestige.n ? ` (x${st.prestige.n})` : ''}`,
        text: can ? `Start over with a +${Math.round(prog.nextBoost() * 100)}% money boost forever (now +${Math.round(st.prestige.boost * 100)}%). Trophies and looks stay.` : `Earn ${game.fmtMoney(P.minEarned)} in total first (${game.fmtMoney(st.life.earned ?? 0)} so far)`,
        price: 0,
        locked: !can,
        lockText: 'NOT YET',
        label: 'REBIRTH',
        fn: () => openPrestige(actions),
      })
      body.append(pr)
    },
  })
  live(api)
}
function openPrestige() {
  openWindow({
    title: 'SELL THE FARM?',
    icon: 'coin',
    theme: 'blue',
    render(body, self) {
      body.append(el('p', 'uiw-sub', `Everything you built, bought and stored is sold and you start again from Coop 1, with a permanent <b>+${Math.round(prog.nextBoost() * 100)}%</b> money boost (instead of +${Math.round(game.state.prestige.boost * 100)}%) and $${500 * (game.state.prestige.n + 1)} to start. Achievements, trophies, vehicle looks and your best course time carry over.`))
      const r = el('div', 'uiw-row')
      r.append(btn('red', 'SELL THE FARM', () => {
        prog.prestige()
        self.close()
      }), btn('grey', 'KEEP FARMING', () => self.close()))
      body.append(r)
    },
  })
}

// --- Workshop, fuel station, helipad ------------------------------------------------------------------------------
const NAMES = { truck: 'Truck', tractor: 'Tractor', combine: 'Combine', sprayer: 'Sprayer' }
function vehicleList() {
  const out = []
  const tr = GAME.vehicles.find((v) => v.id === 'tractors')
  const tk = GAME.vehicles.find((v) => v.id === 'trucks')
  for (let k = 0; k < game.vehicleCount(tk); k++) out.push(['truck', k])
  for (let k = 0; k < game.vehicleCount(tr); k++) out.push(['tractor', k])
  for (const id of ['combine', 'sprayer']) if (fleet.owns(id)) out.push([id, 0])
  return out
}
export function openWorkshop() {
  const api = openWindow({
    title: 'WORKSHOP',
    icon: 'build',
    theme: 'blue',
    render(body) {
      body.append(el('p', 'uiw-sub', 'Engines wear as you drive: a worn vehicle is slower and smokes. Repairs make it good as new.'))
      const rows = el('div', 'uiw-jobs uiw-wide')
      const list = vehicleList()
      if (!list.length) body.append(el('p', 'uiw-sub', 'You have no vehicles with engines yet.'))
      for (const [kind, k] of list) {
        const w = fleet.wearOf(kind, k)
        perkRow(rows, { icon: ICONS[kind === 'truck' ? 'truck' : 'tractor'], name: `${NAMES[kind].toUpperCase()}${kind === 'truck' || kind === 'tractor' ? ` ${k + 1}` : ''}`, text: `Wear ${Math.round(w * 100)}%`, price: fleet.repairCost(kind, k), maxed: w < 0.01, fn: () => fleet.repair(kind, k), blue: true, label: `REPAIR ${game.fmtMoney(fleet.repairCost(kind, k))}` })
      }
      body.append(rows)
    },
  })
  live(api)
}
export function openFuel() {
  const api = openWindow({
    title: 'FUEL STATION',
    icon: 'oil',
    theme: 'blue',
    render(body) {
      const store = game.state.storage.items.fuel ?? 0
      body.append(el('p', 'uiw-sub', `${game.fmtMoney(GAME.fuel.price)} a litre. Fuel from your refinery in storage fills ${GAME.fuel.fuelGood} litres free (you have <b>${store}</b>).`))
      const rows = el('div', 'uiw-jobs uiw-wide')
      for (const [kind, k] of vehicleList()) {
        const f = fleet.fuelOf(kind, k)
        const { cash, need } = fleet.refuelCost(kind, k)
        perkRow(rows, { icon: ICONS.oil, name: `${NAMES[kind].toUpperCase()}${kind === 'truck' || kind === 'tractor' ? ` ${k + 1}` : ''}`, text: `Tank ${Math.round(f)}/${GAME.fuel.tank} L`, price: cash, maxed: need < 0.5, fn: () => fleet.refuel(kind, k), label: cash ? `FILL ${game.fmtMoney(cash)}` : 'FILL FREE' })
      }
      body.append(rows)
    },
  })
  live(api)
}
export function openHelipad() {
  const api = openWindow({
    title: 'HELIPAD',
    icon: 'drone',
    theme: 'blue',
    render(body) {
      const f = fleet.fleetDef('heli')
      const r = fleet.runs.heli
      const doing = !fleet.owns('heli') ? 'Buy the Cargo Helicopter at the vehicle dealer in town.' : r.out > 0 ? `Out on a delivery (${Math.ceil(r.out)}s)` : `Next flight in ${Math.ceil(r.t)}s (it needs goods in storage)`
      body.append(el('p', 'uiw-sub', `${doing} Each flight carries up to ${f.load} goods from storage and sells them in the city for +${Math.round((f.bonus - 1) * 100)}%.`))
    },
  })
  const tick = setInterval(() => api.refresh(), 1000)
  const close = api.close
  api.close = (s) => {
    clearInterval(tick)
    close(s)
  }
}

// --- Additions to the existing windows ---------------------------------------------------------------------------
// Dealer: the new vehicles and the looks.
export function dealerExtras(body) {
  const rows = el('div', 'uiw-jobs uiw-wide')
  body.append(el('p', 'uiw-sub', '<br>Machines and services'))
  for (const f of GAME.fleet) {
    const locked = !!f.needs && !game.built(f.needs)
    perkRow(rows, { icon: ICONS[f.id === 'heli' ? 'drone' : f.id === 'tanker' ? 'milk' : f.id === 'trailer' ? 'horse' : 'tractor'], name: f.name.toUpperCase(), text: locked ? `Build the ${game.buildingById(f.needs).name} first` : f.text, price: f.price, maxed: fleet.owns(f.id), locked, lockText: 'LOCKED', fn: () => fleet.buyFleet(f) })
  }
  body.append(rows)
  // Looks.
  const L = GAME.looks
  body.append(el('p', 'uiw-sub', `<br>Paint shop: paint ${game.fmtMoney(L.paintPrice)}, rims ${game.fmtMoney(L.rimPrice)}, light bar ${game.fmtMoney(L.barPrice)} (bought colours stay free to switch)`))
  for (const lk of fleet.LOOK_KINDS) {
    if (!fleet.lookAvailable(lk)) continue
    const look = fleet.lookOf(lk.id)
    const box = el('div', 'uiw-look')
    const preview = el('div', 'uiw-look-preview', ICONS[lk.id === 'bike' ? 'bike' : lk.id === 'truck' ? 'truck' : 'tractor'])
    preview.style.setProperty('--paint', look.paint ?? '#888')
    preview.style.setProperty('--rims', look.rims ?? '#cfd4d8')
    box.append(el('div', 'uiw-look-name', lk.name.toUpperCase()), preview)
    const sw = el('div', 'uiw-swatches')
    for (const c of L.paints) {
      const s = btn(`swatch${look.paint === c ? ' on' : ''}${look.owned?.paint?.includes(c) ? ' own' : ''}`, '', () => fleet.buyLook(lk.id, 'paint', c))
      s.style.background = c
      s.title = 'Paint'
      sw.append(s)
    }
    const rw = el('div', 'uiw-swatches rims')
    for (const c of L.rims) {
      const s = btn(`swatch${look.rims === c ? ' on' : ''}${look.owned?.rims?.includes(c) ? ' own' : ''}`, '', () => fleet.buyLook(lk.id, 'rims', c))
      s.style.background = c
      s.title = 'Rims'
      rw.append(s)
    }
    const extra = el('div', 'uiw-swatches')
    if (lk.id !== 'bike') extra.append(btn(look.lightBar ? 'blue' : '', look.lightBar ? 'LIGHT BAR ON' : 'LIGHT BAR', () => fleet.buyLook(lk.id, 'lightBar', true)))
    for (const h of L.horns) {
      const own = look.owned?.horn?.includes(h.id)
      extra.append(btn(look.horn === h.id ? 'gold' : own ? '' : 'grey', `${h.name}${own || !h.price ? '' : ` ${game.fmtMoney(h.price)}`}`, () => fleet.buyLook(lk.id, 'horn', h.id)))
    }
    box.append(sw, rw, extra)
    body.append(box)
  }
}
// Ranch barn: troughs, feeder, selling animals.
export function ranchExtras(rows, r) {
  const c = care.careState(r)
  if (c) {
    const h = care.happiness(r)
    perkRow(rows, { icon: ICONS.milk, name: `TROUGHS · ${Math.round(h * 100)}% HAPPY`, text: c.feeder ? 'The Automatic Feeder keeps them full' : `Feed ${Math.round(c.food * 100)}% · Water ${Math.round(c.water * 100)}% · fill them at the trough by the crate (E)`, price: 0, maxed: !!c.feeder, label: 'FILL', fn: () => care.refill(r) })
    perkRow(rows, { icon: ICONS.build, name: 'AUTOMATIC FEEDER', text: 'Troughs never run dry', price: care.feederPrice(r), maxed: !!c.feeder, fn: () => care.buyFeeder(r), blue: true })
  }
  if (fleet.owns('trailer') && !r.plant) {
    const s = game.ranchState(r)
    perkRow(rows, { icon: ICONS[r.animal] ?? ICONS.horse, name: `SELL A ${r.animal.toUpperCase()}`, text: 'Load one into the livestock trailer', price: 0, locked: s.n <= 1, lockText: 'KEEP 1', label: `+${game.fmtMoney(fleet.animalPrice(r))}`, fn: () => fleet.sellAnimal(r) })
  }
}
// Farm Office: the zone foremen.
export function officeExtras(body) {
  body.append(el('p', 'uiw-sub', '<br>Zone foremen buy the cheapest upgrade or hire in their zone, up to a budget a minute.'))
  const rows = el('div', 'uiw-jobs uiw-wide')
  for (const m of GAME.managers) {
    const s = prog.managerState(m.id)
    if (!s.hired) {
      perkRow(rows, { icon: ICONS.office, name: m.name.toUpperCase(), text: m.zone, price: m.price, fn: () => prog.hireManager(m) })
      continue
    }
    const r = el('div', 'uiw-perk')
    r.append(el('span', 'uiw-perk-icon', ICONS.office), el('div', 'uiw-perk-words', `<div class="uiw-perk-name">${m.name.toUpperCase()}</div><div class="uiw-perk-text">${m.zone} · spent ${game.fmtMoney(s.spent ?? 0)}</div>`))
    const sel = el('div', 'uiw-swatches')
    GAME.managerBudgets.forEach((b, i) => sel.append(btn(s.budget === i ? 'gold' : 'grey', b ? `${game.fmtMoney(b)}/m` : 'OFF', () => prog.setBudget(m, i))))
    r.append(sel)
    rows.append(r)
  }
  body.append(rows)
}
// Settings rows.
export function settingsExtras(row, actions, self, tut) {
  row(ICONS.quest, 'Tutorial', btn(tut.on() ? 'red' : '', tut.on() ? 'SKIP' : 'REPLAY', () => {
    if (tut.on()) tut.skip()
    else tut.restart()
    self.refresh()
  }))
  row(ICONS.sun, 'Farm overview', btn('', 'FLY', () => actions.overview()))
  row(ICONS.index, 'Photo mode', btn('', 'OPEN', () => actions.photo()))
}
export const ridingFuelled = () => !!mount.active && fleet.FUELLED.has(mount.active.kind)
export { clock }
