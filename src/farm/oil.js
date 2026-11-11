import { Group } from 'three'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import * as sfx from '../audio/sfx.js'
import { M, block, gated, signCanvas, signMaterial, signPanel, solid, solidCyl, solidRect } from './kit.js'
import { bakeStatic, bx, cy, metal, rbox, tube } from './detail.js'
import { oilTank, railStation } from './models.js'
import { pumpJack, WELL_X } from './pumpjack.js'

// Crude oil, on the north-east lawn and the dirt road:
//  - the Oil Field (build pad): four full-size pump slots in a 2 x 2 grid, a
//    header pipeline between the rows into the crude tank (level gauge),
//    a pipeline north over the fence to the rail station
//  - pump jacks bought one by one (a pad on the next free slot), rising out of
//    the ground; each needs an Oil Worker to run. They nod at real pump
//    speeds (faster with the Motor upgrade), thump each stroke, drip a little
//    oil at the stuffing box, smoke from their gas engines, and burn off gas at
//    the flare once the wellhead is fully kitted out
//  - the Rail Station (build pad): when the tank holds oil the train brakes to
//    a stop, the loading boom swings out over the tank cars, the barrels go
//    aboard with a gush of oil and the train pays

const O = FARM.oil
const R = FARM.rail
const ST = { x: O.station.x, z: R.z + 11 } // platform centre (track side faces -Z)
export const STOP_HEAD_X = ST.x + 17.5 + 13.6 * 2.5 // engine position that parks the third tank car at the station

export function buildOil(root, { pads, particles, north }) {
  // --- The field, the tank and the pipelines ---------------------------------------------------------------
  let tank = null
  gated(root, 'oilField', (G) => {
    const g = new Group()
    const pipe = metal('#5a6068', 0.45)
    const support = metal('#3a3d42', 0.5)
    // A pipe run on supports every few metres.
    const run = (a, b, y) => {
      tube(g, [a[0], y, a[1]], [b[0], y, b[1]], 0.16, pipe, 12)
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      for (let d = 0; d <= len; d += 4) {
        const k = d / len
        const x = a[0] + (b[0] - a[0]) * k
        const z = a[1] + (b[1] - a[1]) * k
        tube(g, [x, 0, z], [x, y - 0.16, z], 0.05, support, 6)
        bx(g, 0.5, 0.06, 0.3, support, x, y - 0.18, z)
      }
    }
    const H = O.header
    run([O.pumps[0][0] + WELL_X, H], [O.tank.x - 4, H], 0.8)
    for (const [x, z] of O.pumps) run([x + WELL_X, z + 2.1], [x + WELL_X, H], 0.8)
    run([O.tank.x, O.tank.z - 4], [O.tank.x, -96], 1.3)
    tube(g, [O.tank.x, 1.3, -96], [O.tank.x, 3.0, -97], 0.16, pipe) // up over the fence
    run([O.tank.x, -97.5], [ST.x + 12.5, -97.5], 3.0)
    run([ST.x + 12.5, -97.5], [ST.x + 12.5, ST.z + 3.2], 3.0)
    // Valves on the header.
    for (const [x] of O.pumps.slice(0, 2)) {
      cy(g, 0.26, 0.26, 0.3, M('#c8302a', { roughness: 0.4 }), x + WELL_X + 2, 0.8, H, 12, 'x')
      cy(g, 0.03, 0.03, 0.5, metal('#9aa3ab'), x + WELL_X + 2, 1.15, H, 6)
    }
    // Gravel pads under the pumps.
    for (const [x, z] of O.pumps) rbox(g, 18, 0.06, 6, 0.03, M('#a9a397', { roughness: 1 }), x + 0.6, 0.03, z)
    // OIL FIELD sign.
    const p = signCanvas(640, 180, { bg: '#2f3338', border: '#f2c230', borderWidth: 12, radius: 12, lines: [{ text: 'OIL FIELD', size: 100, color: '#f2c230' }, { text: 'every pump needs an oil worker', size: 36, color: '#ffffff', weight: 600 }] })
    for (const s of [-1, 1]) block(g, 0.2, 3, 0.2, M('#3a3d42'), 104 + s * 2, 0, -69)
    signPanel(g, 4.2, 1.2, signMaterial(p), 104, 2.6, -68.9)
    bakeStatic(G, g)
    tank = oilTank()
    tank.g.position.set(O.tank.x, 0, O.tank.z)
    tank.g.rotation.y = Math.PI * 0.5
    G.add(tank.g)
    solidCyl(4.7, 9, O.tank.x, O.tank.z)
  }, 9)

  // --- Pump jacks ---------------------------------------------------------------------------------------
  const jacks = O.pumps.map(([x, z], i) => {
    const pj = pumpJack(i + 1)
    pj.g.userData.lod = 'big' // farm/lod.js: hidden far away
    pj.g.position.set(x, 0, z)
    pj.g.visible = false
    root.add(pj.g)
    // Colliders: the foundation, samson post, gearbox and the crank fence (pumps are big now).
    const cs = [solid(0.9, 4, 1.2, x, 4, z), solid(1.3, 1.5, 2.2, x + 4.6, 1.5, z), solid(0.6, 1, 0.6, x + WELL_X, 1, z), solid(1.5, 1.6, 2.2, x + 8.2, 1.6, z)]
    for (const c of cs) c.setEnabled(false)
    return { ...pj, i, x, z, colliders: cs, rise: -1, dripT: Math.random() * 3, smokeT: 0, flareT: 0 }
  })
  const pumpLevels = (i) => ({ motor: game.pumpLevel(i, 'motor'), drill: game.pumpLevel(i, 'drill'), weights: game.pumpLevel(i, 'weights') })
  // The pad for the next pump.
  const pumpPad = pads.add({ x: 0, z: 0, kind: 'CRUDE OIL', name: 'Pump Jack', perk: 'Needs an Oil Worker', price: 0, buy: () => game.buyPump() })
  function movePad(x, z) {
    pumpPad.x = x
    pumpPad.z = z
    pumpPad.disc.position.set(x, 0.12, z)
    pumpPad.rim.position.set(x, 0.06, z)
    for (const r of pumpPad.rings) r.position.set(x, 0.2, z)
    pumpPad.label.position.set(x, 2.6, z)
  }
  function refresh(rise = -1) {
    const n = game.state.oil.pumps
    for (const j of jacks) {
      const on = game.built('oilField') && j.i < n
      j.g.visible = on
      for (const c of j.colliders) c.setEnabled(on)
      if (on) j.setLevel(pumpLevels(j.i))
      if (j.i === rise) j.rise = 0
    }
    const show = game.built('oilField') && n < GAME.oil.pumps
    pumpPad.setVisible(show)
    if (show) {
      const [x, z] = O.pumps[n]
      movePad(x - 2.5, z + 4.6)
      pumpPad.name = `Pump Jack ${n + 1}`
      pumpPad.price = game.pumpPrice()
      pumpPad.red = game.state.money < pumpPad.price
      pumpPad.repaint()
    }
  }
  refresh()
  game.on('pump', (e) => {
    refresh(e?.u ? -1 : e?.i)
    if (e?.u && e.i != null) {
      const j = jacks[e.i]
      particles?.confetti(j.x, 6, j.z, 50)
      particles?.burst(j.x + 4.6, 3, j.z, { n: 30, colors: ['#ffd23a', '#ffffff'], speed: 4, up: 5, gravity: -7, life: 1.2, size: 0.4 })
    }
  })
  game.on('build', (b) => b.id === 'oilField' && refresh())
  game.on('reset', () => refresh())
  game.on('barrel', () => {
    sfx.gurgle(O.tank.x, O.tank.z)
    particles?.burst(O.tank.x, 7.6, O.tank.z, { n: 8, colors: ['#1a1410', '#3a2a1a'], speed: 1.2, up: 2, gravity: -9, life: 0.6, size: 0.25, additive: false })
  })

  // --- The rail station -------------------------------------------------------------------------------------
  let station = null
  gated(root, 'railStation', (G) => {
    station = railStation(24)
    station.g.position.set(ST.x, 0, ST.z)
    G.add(station.g)
    station.boom.rotation.y = Math.PI / 2 // folded along the platform
    station.boom.scale.z = 1.9 // long enough to reach over the fence to the tank cars
    solidRect(ST.x - 12, ST.x + 12, ST.z - 3, ST.z + 3, 1.1)
  }, 7)

  // The train: brake for the station when there is oil to load, stand while it loads.
  const loadT = { t: -1, n: 0 }
  if (north?.train) {
    north.train.hooks = {
      stopX: STOP_HEAD_X,
      wantStop: () => game.oilWaiting(),
      dwell: 8,
      onStop: () => {
        loadT.t = 0
        loadT.n = 0
        sfx.trainBrake(ST.x, R.z)
        for (let i = 0; i < 12; i++) particles?.puff(ST.x - 30 + i * 6, 0.6, R.z + (i % 2 ? 1.2 : -1.2), { color: '#e8e8e8', size: 0.6, grow: 4, life: 1.6, vy: 0.6, a: 0.4 }) // brake steam
      },
      onLeave: () => {
        loadT.t = -1
      },
    }
  }

  const world = (j, [lx, ly, lz]) => [j.x + lx, ly, j.z + lz]
  let moneyT = 0
  return {
    tankAt: [O.tank.x, O.tank.z],
    jacks,
    update(dt, t) {
      moneyT -= dt
      if (moneyT <= 0 && pumpPad.disc.visible) {
        moneyT = 0.5
        const red = game.state.money < pumpPad.price
        if (red !== pumpPad.red) {
          pumpPad.red = red
          pumpPad.repaint()
        }
      }
      for (const j of jacks) {
        if (!j.g.visible) continue
        const running = game.pumpRunning(j.i) && game.state.oil.tank < game.oilTankMax()
        const lv = j.level
        // 6-12 strokes a minute, quicker with the motor.
        const ev = j.update(dt, t, running, 0.1 + lv.motor * 0.025)
        if (ev.turned && running) sfx.pumpThump(j.x + 4.6, j.z)
        if (!running) continue
        // Oil weeps at the stuffing box now and then; the gas engine smokes; the flare burns.
        j.dripT -= dt
        if (j.dripT <= 0) {
          j.dripT = 1.5 + Math.random() * 2.5
          const [x, y, z] = world(j, j.spots.stuffing)
          particles?.burst(x, y, z, { n: 3, colors: ['#15100c', '#2a1f14'], speed: 0.3, up: 0.6, gravity: -9, life: 0.5, size: 0.12, additive: false })
        }
        if (lv.motor >= 3) {
          j.smokeT -= dt
          if (j.smokeT <= 0) {
            j.smokeT = 0.12
            const [x, y, z] = world(j, j.spots.exhaust)
            particles?.puff(x, y, z, { color: '#4a4b50', size: 0.3, grow: 6, life: 2, vy: 1.6, a: 0.3 })
          }
        }
        if (lv.drill >= 5) {
          j.flareT -= dt
          if (j.flareT <= 0) {
            j.flareT = 0.05
            const [x, y, z] = world(j, j.spots.flare)
            particles?.burst(x, y, z, { n: 2, colors: ['#ffb02a', '#ff6a1a', '#ffe36a'], speed: 0.4, up: 2.5, gravity: 1.5, life: 0.6, size: 0.5, grow: 0.2 })
            if (Math.random() < 0.3) particles?.puff(x, y + 1.2, z, { color: '#5a5a5e', size: 0.4, grow: 5, life: 2.5, vy: 1.4, a: 0.18 })
          }
        }
        // A pump rising out of its slot.
        if (j.rise >= 0) {
          j.rise += dt / 1.6
          const k = Math.min(1, j.rise)
          j.g.position.y = -(1 - k) * 10
          if (Math.random() < 0.6) particles?.dust(j.x + (Math.random() - 0.5) * 14, j.z + (Math.random() - 0.5) * 5, '#b8936a', 4)
          if (k >= 1) {
            j.rise = -1
            j.g.position.y = 0
            particles?.confetti(j.x, 8, j.z, 60)
            particles?.ring(j.x, j.z, 7, '#b8936a', 40)
          }
        }
      }
      // A rising pump that is not running yet still has to finish rising.
      for (const j of jacks) {
        if (j.rise < 0 || !j.g.visible || (game.pumpRunning(j.i) && game.state.oil.tank < game.oilTankMax())) continue
        j.rise += dt / 1.6
        const k = Math.min(1, j.rise)
        j.g.position.y = -(1 - k) * 10
        if (Math.random() < 0.6) particles?.dust(j.x + (Math.random() - 0.5) * 14, j.z + (Math.random() - 0.5) * 5, '#b8936a', 4)
        if (k >= 1) {
          j.rise = -1
          j.g.position.y = 0
          particles?.confetti(j.x, 8, j.z, 60)
          particles?.ring(j.x, j.z, 7, '#b8936a', 40)
        }
      }
      if (tank) {
        const f = game.state.oil.tank / game.oilTankMax()
        tank.gauge.scale.y = Math.max(0.01, f) * tank.gauge.userData.h
      }
      if (station) {
        const n = Math.floor(game.state.oil.tank)
        station.barrels.forEach((b, i) => (b.visible = i < Math.min(18, Math.ceil((n / Math.max(1, game.stationLoad())) * 18))))
        // Loading: swing the boom out, load with a gush, swing back.
        if (loadT.t >= 0) {
          loadT.t += dt
          const out = Math.min(1, loadT.t / 1.5)
          station.boom.rotation.y = (Math.PI / 2) * (1 - out)
          if (loadT.t > 2 && loadT.n === 0) {
            loadT.n = game.trainLoad() || -1
            if (loadT.n > 0) {
              particles?.coins(ST.x, 6, R.z, 30)
              particles?.confetti(ST.x, 6, R.z - 2, 50)
              sfx.clank(ST.x, ST.z)
              sfx.till(ST.x, ST.z)
            }
          }
          if (loadT.t > 2 && loadT.t < 6) {
            const sx = ST.x + 9
            const sz = R.z
            if (Math.random() < dt * 30) particles?.burst(sx, 5.2, sz, { n: 3, colors: ['#15100c', '#3a2a1a'], speed: 0.6, up: -1, gravity: -12, life: 0.5, size: 0.22, additive: false })
            if (Math.random() < dt * 6) particles?.puff(sx, 5.0, sz, { color: '#3a3430', size: 0.4, grow: 3, life: 1, vy: 0.5, a: 0.22 })
          }
        } else station.boom.rotation.y += (Math.PI / 2 - station.boom.rotation.y) * Math.min(1, dt * 1.5)
      }
    },
  }
}
