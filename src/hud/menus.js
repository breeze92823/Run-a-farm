import { GAME } from '../config.js'
import * as game from '../game.js'
import * as audio from '../audio/core.js'
import { GOOD_ICONS, ICONS, SEED_ICONS } from './icons.js'
import { btn, el, openWindow } from './window.js'
import { dealerExtras, officeExtras, openPrices, ranchExtras, settingsExtras } from './menus2.js'
import { known as goodKnown, priceMult, trend, hotItem } from '../econ/prices.js'
import { restartTutorial, skipTutorial, tutorialOn } from '../econ/tutorial.js'

// The contents of every HUD window. Each re-renders itself while open when the
// game state changes (money ticking up makes buttons affordable live).

function live(api) {
  // Re-render at most a few times a second (sales change the money constantly).
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

function card({ icon, name, text, meta, locked = false }) {
  const c = el('div', `uiw-card${locked ? ' locked' : ''}`)
  c.append(el('div', 'uiw-card-icon', icon), el('div', 'uiw-card-name', name), el('div', 'uiw-card-text', text))
  if (meta) c.append(el('div', 'uiw-card-meta', meta))
  return c
}

// --- Shop: upgrades bought with farm money, and the active boosts --------------------------------
export function openShop() {
  const api = openWindow({
    title: 'SHOP',
    icon: 'shop',
    render(body) {
      body.append(el('p', 'uiw-sub', `Spend your farm money on upgrades. You have <b>${game.fmtMoney(game.state.money)}</b>.`))
      const grid = el('div', 'uiw-grid')
      const icons = { bag: ICONS.bag, stand: ICONS.eggs, price: ICONS.coin, customers: ICONS.boostFriends, nests: ICONS.eggs, storage: ICONS.crate, packer: ICONS.build }
      for (const item of GAME.shop) {
        const lvl = game.upgradeLevel(item.id)
        const maxed = lvl >= item.max
        const locked = !!item.needs && !game.built(item.needs)
        const next = item.stages && !maxed ? `Next: ${item.stages[lvl + 1]}, holds ${item.caps[lvl + 1]} eggs` : item.text
        const c = card({ icon: icons[item.id], name: item.name, text: locked ? `Build the ${game.buildingById(item.needs).name} first` : next, locked })
        const pips = el('div', 'uiw-level')
        for (let i = 0; i < item.max; i++) pips.append(el('i', i < lvl ? 'on' : ''))
        c.append(pips)
        const price = game.upgradePrice(item)
        const b = btn(maxed || locked ? 'grey' : game.state.money >= price ? '' : 'gold', maxed ? 'MAXED' : locked ? 'LOCKED' : game.fmtMoney(price), () => game.buyUpgrade(item))
        b.disabled = maxed || locked
        c.append(b)
        grid.append(c)
      }
      body.append(grid)
      body.append(el('p', 'uiw-sub', '<br>Active boosts'))
      const boosts = el('div', 'uiw-grid')
      for (const b of GAME.boosts) {
        const c = card({ icon: b.id === 'money' ? ICONS.boostMoney : ICONS.boostFriends, name: b.title, text: b.text, meta: 'ACTIVE' })
        boosts.append(c)
      }
      body.append(boosts)
    },
  })
  live(api)
}

// --- Settings ------------------------------------------------------------------------------------------
export function openSettings(actions) {
  let confirmReset = false
  const api = openWindow({
    title: 'SETTINGS',
    icon: 'settings',
    theme: 'blue',
    render(body, self) {
      const row = (icon, label, control) => {
        const r = el('div', 'uiw-row')
        const l = el('span', 'uiw-row-label', `${icon}<span>${label}</span>`)
        r.append(l, control)
        body.append(r)
      }
      const muted = audio.isMuted()
      row(ICONS.sound, 'Sound', btn(muted ? 'red' : '', muted ? 'OFF' : 'ON', () => {
        audio.setMuted(!muted)
        self.refresh()
      }))
      const slider = el('input')
      slider.type = 'range'
      slider.min = '0'
      slider.max = '100'
      slider.value = String(Math.round(audio.getVolume() * 100))
      slider.setAttribute('aria-label', 'Volume')
      slider.addEventListener('input', () => audio.setVolume(Number(slider.value) / 100))
      row(ICONS.sound, 'Volume', slider)
      row(ICONS.moonIcon, 'Skip to dawn / dusk', btn('gold', 'SKIP', () => actions.dayNight()))
      settingsExtras(row, actions, self, { on: tutorialOn, skip: skipTutorial, restart: restartTutorial })
      row(ICONS.home, 'Back to spawn', btn('', 'GO', () => {
        actions.home()
        self.close()
      }))
      row(ICONS.quest, 'Reset progress', btn('red', confirmReset ? 'SURE?' : 'RESET', () => {
        if (!confirmReset) {
          confirmReset = true
          self.refresh()
          return
        }
        game.resetProgress()
        self.close()
      }))
      body.append(el('p', 'uiw-sub', 'Graphics quality, camera sensitivity and fullscreen are in the portal menu (Esc).'))
    },
  })
  void api
}

// --- Index: the crop collection -------------------------------------------------------------------------
export function openIndex() {
  openWindow({
    title: 'INDEX',
    icon: 'index',
    theme: 'green',
    render(body) {
      const known = goodKnown
      const goods = Object.keys(GAME.goods)
      const hot = hotItem()
      body.append(el('p', 'uiw-sub', `Discovered ${goods.filter(known).length} of ${goods.length}. Prices at the town market right now (they drift through the day; today's hot item <b>${GAME.goods[hot].name}</b> sells for 2x):`))
      const pricesBtn = btn('', 'LIVE PRICES', () => openPrices())
      body.append(pricesBtn)
      const grid = el('div', 'uiw-grid')
      for (const g of goods) {
        const k = known(g)
        const seed = GAME.seeds.find((s) => s.id === g)
        const ranchR = GAME.ranch.find((r) => r.good === g)
        const procR = GAME.proc.find((p) => p.recipes.some((rc) => rc.out === g))
        const how = g === 'egg' ? 'Laid by your hens. Sold at the stand or in town.' : seed ? seed.text : ranchR ? `From the ${ranchR.name}.` : procR ? `Made at the ${procR.name}.` : g === 'fish' ? 'Caught off the lake dock.' : g === 'goldenEgg' ? 'A rare find in the nests.' : ''
        const tr = trend(g)
        const arrowTxt = tr > 0 ? ' ▲' : tr < 0 ? ' ▼' : ''
        grid.append(card({ icon: GOOD_ICONS[g] ?? ICONS.crate, name: k ? GAME.goods[g].name : '???', text: k ? how : 'Not discovered yet.', meta: k ? `${game.fmtMoney(game.goodPrice(g))} each${arrowTxt}${g === hot ? ' · HOT' : ` · ${priceMult(g) >= 1 ? '+' : ''}${Math.round((priceMult(g) - 1) * 100)}%`}${seed ? ` · grows in ${seed.grow}s` : ''}` : '', locked: !k }))
      }
      body.append(grid)
    },
  })
}

// --- Seed Market -----------------------------------------------------------------------------------------
export function openSeedMarket() {
  const api = openWindow({
    title: 'SEED MARKET',
    icon: 'wheat',
    render(body) {
      body.append(el('p', 'uiw-sub', `Buy and unlock seeds. You have <b>${game.fmtMoney(game.state.money)}</b>.`))
      const grid = el('div', 'uiw-grid')
      GAME.seeds.forEach((s, i) => {
        const st = game.state.seeds[i]
        const c = card({ icon: SEED_ICONS[s.id], name: s.name, text: st.unlocked ? `You have ${st.count} seeds (one plants a field)` : s.text, meta: st.unlocked ? `${s.pack} a pack · sells ${game.fmtMoney(GAME.goods[s.id].market)}` : '', locked: !st.unlocked })
        if (st.unlocked) c.append(btn(game.state.money >= s.packPrice ? '' : 'gold', `BUY ${game.fmtMoney(s.packPrice)}`, () => game.buySeeds(i)))
        else c.append(btn(game.state.money >= s.unlock ? '' : 'gold', `UNLOCK ${game.fmtMoney(s.unlock)}`, () => game.unlockSeed(i)))
        grid.append(c)
      })
      body.append(grid)
    },
  })
  live(api)
}

// --- Daily quests ------------------------------------------------------------------------------------------
export function openQuests() {
  const api = openWindow({
    title: 'DAILY QUESTS',
    icon: 'quest',
    theme: 'gold',
    render(body) {
      body.append(el('p', 'uiw-sub', 'New quests every day.'))
      for (const q of GAME.quests) {
        const r = el('div', 'uiw-quest')
        const words = el('div', '', `<div class="uiw-quest-name">${q.name}</div><div class="uiw-quest-text">${q.text}</div>`)
        const done = game.questDone(q)
        const claimed = game.questClaimed(q)
        const b = btn(claimed ? 'grey' : done ? 'gold' : 'grey', claimed ? 'CLAIMED' : `+${game.fmtMoney(q.reward)}`, () => game.claimQuest(q))
        b.disabled = claimed || !done
        const bar = el('div', 'uiw-bar')
        const p = game.questProgress(q)
        bar.append(el('i'), el('span', '', q.stat === 'earned' ? `${game.fmtMoney(p)} / ${game.fmtMoney(q.goal)}` : `${p} / ${q.goal}`))
        bar.firstChild.style.width = `${(p / q.goal) * 100}%`
        r.append(words, b, bar)
        body.append(r)
      }
    },
  })
  live(api)
}

// --- Farm Office: hire workers, buy vehicles, crew upgrades -------------------------------------------------------
// How many of each worker can be hired follows what the farm owns: stockers
// the coops, field hands the bought fields, drivers the tractors and trucks.
export function openOffice() {
  const api = openWindow({
    title: 'FARM OFFICE',
    icon: 'office',
    render(body) {
      const st = game.state
      body.append(el('p', 'uiw-sub', `Hire workers to run the farm for you. You have <b>${game.fmtMoney(st.money)}</b>. Vehicles are sold at the dealer in town.`))
      const grid = el('div', 'uiw-jobs')
      for (const w of GAME.workers) {
        const n = game.hired(w)
        const cap = game.workerCap(w)
        const c = el('div', 'uiw-job')
        c.append(el('div', 'uiw-job-head', `<span>${w.name.toUpperCase()}</span>`))
        const main = el('div', 'uiw-job-main')
        main.append(el('div', 'uiw-job-icon', ICONS[w.id] ?? ''))
        const words = el('div', 'uiw-job-words')
        words.append(el('div', 'uiw-job-text', `${w.text}: hire ${w.capText}`))
        words.append(el('div', `uiw-job-count${n >= cap && cap > 0 ? ' full' : ''}`, `HIRED ${n}/${cap}`))
        main.append(words)
        c.append(main)
        const foot = el('div', 'uiw-job-foot')
        const stat = w.carry ? `Carries ${game.workerCarry(w)} ${w.carryText}` : w.bonus ? `+${Math.round(w.bonus * 100)}% harvest` : w.id === 'rancher' ? 'Crates to storage' : w.id === 'oiler' ? 'Keeps a pump running' : 'Harvests the moment it ripens'
        foot.append(el('span', 'uiw-job-stat', stat))
        let b
        if (n >= cap) {
          const max = cap >= game.workerMaxCap(w)
          b = btn('grey', max ? '<small>ALL HIRED</small>MAX' : `<small>${game.capHint(w).toUpperCase()}</small>FULL`, null)
          b.disabled = true
          b.title = `${game.capHint(w)} to hire more`
        } else {
          const price = game.hirePrice(w)
          b = btn(st.money >= price ? '' : 'red', `<small>HIRE</small>${game.fmtMoney(price)}`, () => game.hireWorker(w))
        }
        b.classList.add('uiw-job-btn')
        foot.append(b)
        c.append(foot)
        grid.append(c)
      }
      body.append(grid)

      // Vehicles (more tractors / trucks = room for more drivers) and the crew upgrades.
      const rows = el('div', 'uiw-jobs uiw-wide')
      const row = (icon, name, text, price, maxed, fn, blue) => {
        const r = el('div', 'uiw-perk')
        r.append(el('span', 'uiw-perk-icon', icon), el('div', 'uiw-perk-words', `<div class="uiw-perk-name">${name}</div><div class="uiw-perk-text">${text}</div>`))
        const b = btn(maxed ? 'grey' : st.money >= price ? (blue ? 'blue' : '') : 'red', maxed ? 'MAX' : game.fmtMoney(price), fn)
        b.disabled = maxed
        r.append(b)
        rows.append(r)
      }
      for (const cr of GAME.crew) {
        const lvl = game.crewLevel(cr.id)
        row(ICONS[cr.id], cr.name.toUpperCase(), `${cr.text} - LV ${lvl}/${cr.max}`, game.crewPrice(cr), lvl >= cr.max, () => game.buyCrew(cr), true)
      }
      body.append(rows)
      officeExtras(body)
    },
  })
  live(api)
}

// --- A row of perk / upgrade buttons (shared by the newer windows) ---------------------------------------
function perkRow(parent, { icon, name, text, price, maxed = false, locked = false, lockText = 'LOCKED', fn, blue = false }) {
  const r = el('div', 'uiw-perk')
  r.append(el('span', 'uiw-perk-icon', icon ?? ''), el('div', 'uiw-perk-words', `<div class="uiw-perk-name">${name}</div><div class="uiw-perk-text">${text}</div>`))
  const b = btn(maxed || locked ? 'grey' : game.state.money >= price ? (blue ? 'blue' : '') : 'red', maxed ? 'MAX' : locked ? lockText : game.fmtMoney(price), fn)
  b.disabled = maxed || locked
  r.append(b)
  parent.append(r)
  return r
}

// --- Vehicle dealer (town) -----------------------------------------------------------------------------
export function openDealer() {
  const api = openWindow({
    title: 'VEHICLE DEALER',
    icon: 'dealer',
    theme: 'blue',
    render(body) {
      body.append(el('p', 'uiw-sub', `New vehicles are delivered to their bay on your farm. You have <b>${game.fmtMoney(game.state.money)}</b>.`))
      const rows = el('div', 'uiw-jobs uiw-wide')
      for (const v of GAME.vehicles) {
        const have = game.vehicleCount(v)
        const locked = !game.built(v.needs)
        perkRow(rows, { icon: ICONS[v.id === 'tractors' ? 'tractor' : 'truck'], name: `${v.name.toUpperCase()} ${have}/${v.max}`, text: locked ? `Build the ${game.buildingById(v.needs).name} first` : v.text, price: game.vehiclePrice(v), maxed: have >= v.max, locked, lockText: 'NO BAY', fn: () => game.buyVehicle(v) })
      }
      for (const g of GAME.garage) {
        const lvl = game.garageLevel(g.id)
        const locked = !!g.needs && !game.built(g.needs)
        perkRow(rows, { icon: ICONS[g.id === 'bike' || g.id === 'basket' ? 'bike' : g.id === 'cargo' || g.id === 'truckEngine' ? 'truck' : 'tractor'], name: g.name.toUpperCase(), text: `${g.text} - LV ${lvl}/${g.max}`, price: game.garagePrice(g), maxed: lvl >= g.max, locked, lockText: 'NO BAY', fn: () => game.buyGarage(g), blue: true })
      }
      body.append(rows)
      dealerExtras(body)
    },
  })
  live(api)
}

// --- Drone base ------------------------------------------------------------------------------------------
export function openDrones() {
  const api = openWindow({
    title: 'DRONE BASE',
    icon: 'drone',
    theme: 'blue',
    render(body) {
      const D = GAME.drones
      body.append(el('p', 'uiw-sub', `Drones fly goods from your storage to the town market (+${Math.round((D.bonus - 1) * 100)}%). Storage: <b>${game.storageCount()}/${game.state.storage.max}</b>`))
      const rows = el('div', 'uiw-jobs uiw-wide')
      for (let k = 0; k < D.max; k++) {
        if (k < game.state.drones.n) {
          const lvl = game.state.drones.cap[k] ?? 0
          const run = game.droneRuns[k]
          const doing = !run || run.leg < 0 ? 'on its pad' : run.load ? 'delivering' : 'flying'
          perkRow(rows, { icon: ICONS.drone, name: `DRONE ${k + 1} CAPACITY`, text: `Carries ${game.droneCap(k)} goods · ${doing} - LV ${lvl}/${D.capMax}`, price: game.droneCapPrice(k), maxed: lvl >= D.capMax, fn: () => game.upgradeDrone(k), blue: true })
          const sl = game.droneSpeedLevel(k)
          perkRow(rows, { icon: ICONS.speed, name: `DRONE ${k + 1} SPEED`, text: `+${Math.round(D.speedStep * 100)}% flight speed, bigger props - LV ${sl}/${D.speedMax}`, price: game.droneSpeedPrice(k), maxed: sl >= D.speedMax, fn: () => game.upgradeDroneSpeed(k), blue: true })
        } else if (k === game.state.drones.n) {
          perkRow(rows, { icon: ICONS.drone, name: `DRONE ${k + 1}`, text: `A new delivery drone (${D.cap} goods a trip)`, price: game.dronePrice(), fn: () => game.buyDrone() })
        } else perkRow(rows, { icon: ICONS.drone, name: `DRONE ${k + 1}`, text: 'Buy the drone before it first', price: 0, locked: true })
      }
      body.append(rows)
    },
  })
  live(api)
}

// --- Oil field -----------------------------------------------------------------------------------------------
export function openOil() {
  const api = openWindow({
    title: 'OIL FIELD',
    icon: 'oil',
    render(body) {
      const st = game.state.oil
      const workers = game.hired(game.workerById('oiler'))
      const train = game.built('railStation') ? `the train loads ${game.stationLoad()} barrels at ${game.fmtMoney(game.barrelPrice())} each` : 'build the Rail Station on the dirt road to sell it'
      body.append(el('p', 'uiw-sub', `Tank <b>${Math.floor(st.tank)}/${game.oilTankMax()}</b> barrels · ${train}. Oil workers: <b>${workers}/${st.pumps}</b> (hire them at the Farm Office)`))
      const rows = el('div', 'uiw-jobs uiw-wide')
      for (let i = 0; i < st.pumps; i++) {
        for (const u of GAME.oil.upgrades) {
          const lvl = game.pumpLevel(i, u.id)
          perkRow(rows, { icon: ICONS.pump, name: `PUMP ${i + 1} ${u.name.toUpperCase()}`, text: `${u.perk} - LV ${lvl}/${u.max}${game.pumpRunning(i) ? '' : ' · NO WORKER'}`, price: game.pumpUpPrice(i, u), maxed: lvl >= u.max, fn: () => game.buyPumpUpgrade(i, u), blue: true })
        }
      }
      if (st.pumps < GAME.oil.pumps) perkRow(rows, { icon: ICONS.pump, name: `PUMP JACK ${st.pumps + 1}`, text: 'Another pump (it needs an Oil Worker)', price: game.pumpPrice(), fn: () => game.buyPump() })
      for (const u of [GAME.oil.tankUp, GAME.oil.crane, GAME.oil.refine]) {
        const lvl = game.oilLevel(u.id)
        const locked = u.id === 'crane' && !game.built('railStation')
        perkRow(rows, { icon: u.id === 'crane' ? ICONS.station : u.id === 'refine' ? ICONS.coin : ICONS.oil, name: u.name.toUpperCase(), text: `${u.perk} - LV ${lvl}/${u.max}`, price: game.oilUpPrice(u), maxed: lvl >= u.max, locked, lockText: 'NO STATION', fn: () => game.buyOilUpgrade(u), blue: true })
      }
      body.append(rows)
    },
  })
  live(api)
}

// --- A ranch barn ---------------------------------------------------------------------------------------------
export function openRanch(r) {
  const api = openWindow({
    title: r.name.toUpperCase(),
    icon: r.animal,
    theme: 'green',
    render(body) {
      const s = game.ranchState(r)
      if (!s) return
      const what = r.cash ? `ride money (${game.fmtMoney(r.cash)} a ride)` : GAME.goods[r.good].name.toLowerCase()
      const many = r.plural ?? `${r.animal}s`
      const how = r.hold ? 'Hold E at the shearing station to shear them' : 'Walk past the crate to collect'
      body.append(el('p', 'uiw-sub', `${s.n} ${s.n === 1 ? r.animal : many} make ${what}: one every <b>${game.ranchEvery(r).toFixed(1)}s</b>. ${r.hold ? 'Wool waiting' : 'Crate'} ${s.crate}/${game.ranchCrateMax(r)}. ${how}, or hire a Rancher.`))
      const rows = el('div', 'uiw-jobs uiw-wide')
      perkRow(rows, { icon: ICONS[r.animal] ?? ICONS.build, name: `+1 ${r.animal.toUpperCase()}`, text: `${s.n}/${r.max} ${many}`, price: game.ranchAddPrice(r), maxed: s.n >= r.max, fn: () => game.addAnimal(r) })
      ranchExtras(rows, r)
      perkRow(rows, { icon: ICONS.carry, name: GAME.feed.name.toUpperCase(), text: `${GAME.feed.perk} - LV ${s.feed}/${GAME.feed.max}`, price: game.ranchFeedPrice(r), maxed: s.feed >= GAME.feed.max, fn: () => game.feedAnimals(r), blue: true })
      perkRow(rows, { icon: ICONS.build, name: GAME.expand.name.toUpperCase(), text: `${GAME.expand.perk} - LV ${s.expand ?? 0}/${GAME.expand.max}`, price: game.ranchExpandPrice(r), maxed: (s.expand ?? 0) >= GAME.expand.max, fn: () => game.expandRanch(r), blue: true })
      body.append(rows)
    },
  })
  live(api)
}
