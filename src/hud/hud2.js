import './hud2.css'
import { FARM, GAME, parkAt } from '../config.js'
import * as game from '../game.js'
import { GOOD_ICONS, ICONS } from './icons.js'
import * as sfx from '../audio/ui.js'
import * as fx from '../audio/sfx.js'
import { comboTick, customHorn, fanfare, splash } from '../audio/extra.js'
import { mount } from '../mount.js'
import { clock, fmtTime, seasonDef } from '../econ/clock.js'
import { hotItem } from '../econ/prices.js'
import * as prog from '../econ/progress.js'
import * as fleet from '../econ/fleet.js'
import * as care from '../econ/care.js'
import * as proc from '../econ/processing.js'
import { course, courseTime, fishing, cast } from '../econ/minigames.js'
import { currentStep, stepTarget } from '../econ/tutorial.js'
import { getYaw } from '../camera.js'
import { openAwards, openContracts, openFuel, openHelipad, openPrices, openProcessing, openWorkshop } from './menus2.js'

// The HUD pieces for the roadmap systems, added to hud.js's root:
//  - top right: the clock (time, day, season), the weather and the hot item
//  - under the goal banner: the farm level and its XP bar; the tutorial hint
//    with a compass arrow pointing where to go
//  - the combo meter, the jumping-course timer, a level-up banner
//  - FUEL and WEAR bars with the stats while driving, and a horn button
//  - AWARDS in the left menu column
// It also supplies interaction targets (processing buildings, the contracts
// board, troughs, shearing, fishing, the workshop, fuel station, helipad).

const el = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const outlined = (cls, text) => {
  const e = el('span', `ol ${cls}`)
  e.textContent = text
  return e
}
const WEATHER = { clear: '☀', rain: '🌧', wind: '🌬', storm: '⛈' }
const SEASON_ICON = { autumn: '🍂', spring: '🌸', summer: '🌻' }

export function createHudExtras({ root, top, left, stats, button, popAt, toast, farm, actions }) {
  // --- Top right: clock, weather, hot item ----------------------------------------------------------
  const world = el('div', 'hud-world')
  const clockEl = el('div', 'hw-clock')
  const clockIco = el('span', 'hw-ico')
  const clockTxt = outlined('hw-time', '')
  const dayTxt = outlined('hw-day', '')
  clockEl.append(clockIco, el('span', 'hw-words'))
  clockEl.lastChild.append(clockTxt, dayTxt)
  const weatherEl = el('div', 'hw-chip')
  const hotEl = el('div', 'hw-chip hot')
  world.append(clockEl, weatherEl, hotEl)
  root.append(world)

  // --- Level bar + tutorial hint under the goal ----------------------------------------------------------
  const lvl = el('div', 'hud-level')
  const lvlNum = outlined('lv-num', 'LV 1')
  const lvlBar = el('div', 'lv-bar')
  const lvlFill = el('i')
  lvlBar.append(lvlFill)
  lvl.append(lvlNum, lvlBar)
  top.append(lvl)
  const hint = el('div', 'hud-hint')
  const hintArrow = el('span', 'hint-arrow', '<svg viewBox="0 0 64 64"><path d="M32 4 L54 40 H40 V60 H24 V40 H10 Z" fill="#ffd34a" stroke="#3a1f0e" stroke-width="4" stroke-linejoin="round"/></svg>')
  const hintText = el('span', 'hint-words')
  hint.append(hintArrow, hintText)
  root.append(hint) // placed under the top block each tick

  // --- Combo, course, level-up -------------------------------------------------------------------------
  const comboEl = el('div', 'hud-combo')
  const comboTxt = outlined('combo-txt', '')
  const comboBar = el('div', 'combo-bar')
  comboBar.append(el('i'))
  comboEl.append(comboTxt, comboBar)
  const courseEl = el('div', 'hud-course')
  const banner = el('div', 'hud-banner')
  root.append(comboEl, courseEl, banner)

  // --- Fuel / wear bars and the horn ------------------------------------------------------------------------
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
  const sFuel = statRow('fuel', 'oil', 'FUEL', 'gold')
  const sWear = statRow('wear', 'build', 'WEAR', 'red')
  const horn = button('hud-horn', '<span class="ico">📯</span>', () => honk())
  root.append(horn)
  function honk() {
    const m = mount.active
    if (!m || m.kind === 'horse') return
    const kind = m.kind === 'bike' ? 'bike' : m.kind
    const h = fleet.lookOf(kind).horn ?? 'classic'
    if (m.kind === 'bike') fx.bikeBell()
    else customHorn(h)
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH' && !e.repeat) honk()
  })

  // --- Left menu: AWARDS ---------------------------------------------------------------------------------------
  const awards = button('hud-menu m-awards', `<span class="ico">${ICONS.quest}</span>`, () => openAwards(actions))
  awards.append(outlined('lbl', 'AWARDS'))
  left.append(awards)

  // --- Events -----------------------------------------------------------------------------------------------------
  game.on('levelUp', ({ level }) => {
    banner.textContent = ''
    banner.append(outlined('', `LEVEL ${level}!`))
    banner.classList.remove('show')
    void banner.offsetWidth
    banner.classList.add('show')
    sfx.buy(true)
    fanfare()
  })
  game.on('achievement', (a) => {
    banner.textContent = ''
    banner.append(outlined('', `🏆 ${a.name}`))
    banner.classList.remove('show')
    void banner.offsetWidth
    banner.classList.add('show')
  })
  game.on('combo', ({ n, bonus }) => {
    if (n >= 2) {
      comboTick(n)
      if (bonus) toast({ text: `Combo x${n}! +${game.fmtMoney(bonus)}`, kind: 'good' })
    }
  })
  game.on('processed', ({ id, good, n }) => {
    const [x, z] = proc.crateSpot(id)
    popAt(x, 3, z, `+${n} ${GAME.goods[good].name}`, false)
  })
  game.on('contractDone', ({ c, at }) => {
    sfx.coin(6)
    if (at) popAt(at[0], 4, at[1], `+${game.fmtMoney(c.reward)}`)
  })
  game.on('serviceSold', ({ id, n, amount }) => {
    sfx.coin(3)
    toast({ text: `${id === 'heli' ? 'The helicopter' : 'The milk tanker'} sold ${n} goods +${game.fmtMoney(amount)}`, kind: 'good' })
  })
  game.on('course', (e) => {
    if (e.phase === 'jump') e.clean ? sfx.collect(3) : sfx.deny()
    if (e.phase === 'clock') sfx.coin(2)
  })
  game.on('fish', (e) => {
    if (e.phase === 'bite') {
      sfx.toast()
      splash(...parkAt(FARM.lake.dock, 12, 0))
    }
    if (e.phase === 'catch') sfx.collect(4)
  })

  // --- Interaction targets -----------------------------------------------------------------------------------------
  const out = []
  function targets(pos) {
    out.length = 0
    const near = (x, z, r) => Math.abs(pos.x - x) < r + 1 && Math.abs(pos.z - z) < r + 1
    for (const def of GAME.proc) {
      if (!game.built(def.id)) continue
      const [x, z] = parkAt(FARM.proc[def.id], 0, -9) // in front of the door
      if (near(x, z, 4)) {
        const s = proc.procState(def.id)
        out.push({ x, z, reach: 4, text: def.name.toUpperCase(), sub: s?.job ? `Making ${GAME.goods[s.job.out].name.toLowerCase()}` : 'Recipes and upgrades', run: () => openProcessing(def.id) })
      }
    }
    const B = FARM.contractBoard
    if (near(B.x, B.z, 4)) out.push({ x: B.x, z: B.z + 1.5, reach: 4, text: 'CONTRACTS BOARD', sub: `${game.state.contracts.list.length} open contracts`, run: () => openContracts() })
    const PB = FARM.priceBoard
    if (near(PB.x, PB.z, 3.5)) out.push({ x: PB.x, z: PB.z, reach: 3.5, text: 'MARKET PRICES', sub: `Hot today: ${GAME.goods[hotItem()].name}`, run: () => openPrices() })
    const m = mount.active
    // Driving up in a vehicle with an engine: repair / refuel it on the spot (`drive`: hud.js
    // offers these while riding, ahead of GET OFF). Only while there is work to do and the
    // player can pay, so a full tank / sound engine (or an empty wallet) still lets E get off.
    const driving = !!m && fleet.FUELLED.has(m.kind)
    if (game.built('workshop')) {
      const [wx, wz] = parkAt(FARM.workshop, 0, -7)
      if (near(wx, wz, 5)) {
        const cost = driving ? fleet.repairCost(m.kind, m.k) : 0
        if (driving && cost > 0 && cost <= game.state.money) out.push({ x: wx, z: wz, reach: 5, drive: true, text: `REPAIR ${game.fmtMoney(cost)}`, sub: `Wear ${Math.round(fleet.wearOf(m.kind, m.k) * 100)}%`, run: () => fleet.repair(m.kind, m.k) })
        else if (!m) out.push({ x: wx, z: wz, reach: 5, text: 'WORKSHOP', sub: 'Repair your vehicles', run: () => openWorkshop() })
      }
    }
    if (game.built('fuelStation')) {
      const S = FARM.fuelStation
      if (near(S.x, S.z, 5.5)) {
        const c = driving ? fleet.refuelCost(m.kind, m.k) : null
        if (c && c.need >= 0.5 && c.cash <= game.state.money) out.push({ x: S.x, z: S.z, reach: 5.5, drive: true, text: `REFUEL ${c.cash ? game.fmtMoney(c.cash) : 'FREE'}`, sub: `Tank ${Math.round(fleet.fuelOf(m.kind, m.k))}/${GAME.fuel.tank} L`, run: () => fleet.refuel(m.kind, m.k) })
        else if (!m) out.push({ x: S.x, z: S.z, reach: 5.5, text: 'FUEL STATION', sub: 'Fill your vehicles', run: () => openFuel() })
      }
    }
    if (game.built('helipad')) {
      const [hx, hz] = parkAt(FARM.helipad, 0, -7)
      if (near(hx, hz, 4)) out.push({ x: hx, z: hz, reach: 4, text: 'HELIPAD', sub: fleet.owns('heli') ? 'Cargo flights' : 'Buy the helicopter in town', run: () => openHelipad() })
    }
    if (!m) {
      for (const r of GAME.ranch) {
        const c = care.careState(r)
        const T = FARM.troughs[r.id]
        if (c && !c.feeder && T && near(T[0], T[1], 2.8)) out.push({ x: T[0], z: T[1], reach: 2.8, text: 'FILL TROUGHS', sub: `Feed ${Math.round(c.food * 100)}% · Water ${Math.round(c.water * 100)}%`, run: () => care.refill(r) })
        if (r.hold && game.built(r.id)) {
          const [cx, cz] = FARM.ranchCrates[r.id]
          const s = game.ranchState(r)
          if (s?.crate && near(cx, cz, 3)) out.push({ x: cx, z: cz + 0.01, reach: 3, text: 'HOLD E: SHEAR SHEEP', sub: `${s.crate} wool ready`, hold: GAME.shear.hold, run: () => game.collectRanch(r, 'player') })
        }
      }
      if (game.built('lake')) {
        const [tx, tz] = parkAt(FARM.lake.dock, 9, 0)
        if (near(tx, tz, 3.5)) {
          const text = fishing.phase === 'bite' ? '!! REEL IT IN !!' : fishing.phase === 'wait' ? 'WAITING FOR A BITE...' : 'CAST YOUR LINE'
          out.push({ x: tx, z: tz, reach: 3.5, text, sub: fishing.phase === 'bite' ? 'Press E now!' : 'Fish into your bag', run: () => cast() })
        }
      }
    }
    return out
  }

  // --- Per frame -------------------------------------------------------------------------------------------------------
  let t1 = 0
  let lastHint = ''
  return {
    targets,
    update(dt, pos) {
      t1 -= dt
      if (t1 <= 0) {
        t1 = 0.25
        const night = clock.night > 0.5
        clockIco.textContent = night ? '🌙' : '☀'
        clockTxt.textContent = fmtTime()
        dayTxt.textContent = `Day ${game.state.clock?.day ?? 1} · ${SEASON_ICON[clock.season]} ${seasonDef()?.name ?? ''}${clock.festival ? ' · FESTIVAL' : ''}`
        weatherEl.textContent = `${WEATHER[clock.weather]} ${clock.weather.toUpperCase()}`
        weatherEl.className = `hw-chip w-${clock.weather}`
        const hot = hotItem()
        hotEl.innerHTML = `<span class="hw-gico">${GOOD_ICONS[hot] ?? ICONS.crate}</span><span>HOT: ${GAME.goods[hot].name} 2x</span>`
        lvlNum.textContent = `LV ${prog.level()}`
        lvlFill.style.width = `${Math.min(1, prog.xpProgress()) * 100}%`
        // Fuel and wear while driving.
        const m = mount.active
        const fuelled = !!m && fleet.FUELLED.has(m.kind)
        sFuel.r.style.display = fuelled ? '' : 'none'
        sWear.r.style.display = fuelled ? '' : 'none'
        if (fuelled) {
          const f = fleet.fuelOf(m.kind, m.k)
          sFuel.fill.style.width = `${(f / GAME.fuel.tank) * 100}%`
          sFuel.val.textContent = `${Math.round(f)} L`
          const w = fleet.wearOf(m.kind, m.k)
          sWear.fill.style.width = `${w * 100}%`
          sWear.val.textContent = `${Math.round(w * 100)}%`
        }
        horn.classList.toggle('show', !!m && m.kind !== 'horse')
      }
      // Tutorial hint + compass.
      const step = currentStep()
      hint.classList.toggle('show', !!step)
      if (step) {
        // Under the top block, centred on it (on landscape phones it sits right of Boxity's toolbar).
        const tr = top.getBoundingClientRect()
        hint.style.top = `${tr.bottom + 8}px`
        hint.style.left = `${tr.left + tr.width / 2}px`
        const txt = `${step.text}`
        if (txt !== lastHint) {
          lastHint = txt
          hintText.innerHTML = `<b>${step.text}</b><small>${step.sub}</small>`
        }
        const tgt = stepTarget(farm.rideables?.bike?.g.position)
        if (tgt) {
          const dx = tgt[0] - pos.x
          const dz = tgt[1] - pos.z
          const d = Math.hypot(dx, dz)
          // Screen up = the camera's forward (-sin yaw, -cos yaw).
          const ang = Math.atan2(dx, dz) - Math.atan2(-Math.sin(getYaw()), -Math.cos(getYaw()))
          hintArrow.style.transform = `rotate(${-ang}rad)`
          hintArrow.style.opacity = d < 4 ? '0.35' : '1'
        }
      }
      // Combo meter.
      const c = prog.combo
      comboEl.classList.toggle('show', c.n >= 2)
      if (c.n >= 2) {
        comboTxt.textContent = `COMBO x${c.n}`
        comboBar.firstChild.style.width = `${(c.t / GAME.combo.window) * 100}%`
      }
      // Course timer.
      courseEl.classList.toggle('show', course.on)
      if (course.on) courseEl.textContent = `⏱ ${courseTime().toFixed(1)}s · JUMP ${Math.min(course.next + 1, FARM.arenaCourse.length)}/${FARM.arenaCourse.length}${game.state.course.best ? ` · BEST ${game.state.course.best.toFixed(1)}s` : ''}`
    },
  }
}
