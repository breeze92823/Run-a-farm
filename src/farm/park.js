import { CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace } from 'three'
import { FARM, GAME, PARK_TURN, parkAt } from '../config.js'
import * as game from '../game.js'
import * as proc from '../econ/processing.js'
import * as con from '../econ/contracts.js'
import * as fleet from '../econ/fleet.js'
import { fishing } from '../econ/minigames.js'
import { hotItem } from '../econ/prices.js'
import { M, addSurface, block, cyl, gated, gatedAny, signCanvas, signMaterial, signPanel, solidRect } from './kit.js'
import { paintDirt, tex } from './textures.js'
import { bakery, dairy, flourMill, juicePress, refinery } from './procmodels.js'
import { carWash, contractBoard, fuelStation, helipad, workshop } from './servicemodels.js'
import { helicopter, milkTanker } from './vehicles.js'
import { appleTree, fishingDock, greenhouse, lake } from './zonemodels.js'
import { updateRig } from './rig.js'
import * as sfxx from '../audio/extra.js'

// The Processing Park west of the plot, north of the road (FARM.park) and the
// town additions. The park is laid out as if south of the road and turned half
// a turn (config.js PARK_TURN): every model here is turned with it (rotation.y =
// PI) and offsets in a model's own frame go through parkAt().
//  - a gravel lane with the five processing buildings facing the road (Flour
//    Mill, Bakery, Dairy, Juice Press, Oil Refinery), each with its output
//    crate out front that fills up item by item; their machines run while
//    they process (econ/processing.js)
//  - the second row: Workshop, Fuel Station, Car Wash (drive through it),
//    Greenhouse (level 12), the Apple Orchard (level 5) and the Fishing Lake
//    with its dock (level 8); the Helipad by the lane with the cargo
//    helicopter, the Milk Tanker parked on the lane between its runs
//  - in town: the contracts board and a market price board

const rnd = (a, b) => a + Math.random() * (b - a)
// A rect in the park's layout -> the world (see PARK_TURN).
const turnRect = (r) => ({ minX: PARK_TURN.x - r.maxX, maxX: PARK_TURN.x - r.minX, minZ: PARK_TURN.z - r.maxZ, maxZ: PARK_TURN.z - r.minZ })
const midX = (r) => (r.minX + r.maxX) / 2
const midZ = (r) => (r.minZ + r.maxZ) / 2
const MODELS = { flourMill, bakery, dairy, juicePress, refinery }
const SIZE = { flourMill: [16, 16], bakery: [16, 14], dairy: [16, 14], juicePress: [14, 14], refinery: [22, 18] }
const HEIGHT = { flourMill: 20, bakery: 10, dairy: 9, juicePress: 8, refinery: 18 }

// An output crate whose goods pile up as it fills.
function outCrate(parent, x, z) {
  const g = new Group()
  g.userData.noCompact = true
  g.position.set(x, 0, z)
  block(g, 1.8, 0.62, 1.2, M('#a8723f', { roughness: 0.9 }), 0, 0, 0)
  for (const y of [0.16, 0.46]) block(g, 1.82, 0.06, 1.22, M('#7b4a26'), 0, y, 0, 0, false)
  const items = []
  const geo = new SphereGeometry(0.15, 8, 6)
  for (let i = 0; i < 16; i++) {
    const m = new Mesh(geo, new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }))
    m.position.set(-0.6 + (i % 4) * 0.4, 0.66 + Math.floor(i / 8) * 0.16, -0.36 + (Math.floor(i / 4) % 2) * 0.66)
    m.visible = false
    g.add(m)
    items.push(m)
  }
  parent.add(g)
  return { g, items }
}

// A canvas sign that can be repainted (price board).
function liveBoard(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return { c, t, ctx: c.getContext('2d') }
}

export function buildPark(root, { particles, rideables }) {
  const P = FARM.park
  // --- Ground: the lanes (laid with the first park building bought), and a sign by the road ---------
  const parkIds = [...GAME.proc.map((d) => d.id), 'workshop', 'fuelStation', 'carWash', 'helipad', 'orchard', 'lake', 'greenhouse']
  gatedAny(root, parkIds, (G) => {
    const L = FARM.parkLane
    const dirt = tex(paintDirt(256, '#b9a283', '#93795c', 431), 1)
    const lw = L.maxX - L.minX
    const ld = L.maxZ - L.minZ
    dirt.repeat.set(lw / 5, ld / 5)
    const lane = new Mesh(new PlaneGeometry(lw, ld), new MeshStandardMaterial({ map: dirt, roughness: 1 }))
    lane.rotation.x = -Math.PI / 2
    lane.position.set((L.minX + L.maxX) / 2, 0.03, (L.minZ + L.maxZ) / 2)
    lane.receiveShadow = true
    G.add(lane)
    addSurface(L, 'gravel')
    // Second-row lane.
    const L2 = turnRect({ minX: -38, maxX: 62, minZ: 112, maxZ: 118 })
    const d2 = dirt.clone()
    d2.repeat.set((L2.maxX - L2.minX) / 5, 6 / 5)
    d2.needsUpdate = true
    const lane2 = new Mesh(new PlaneGeometry(L2.maxX - L2.minX, 6), new MeshStandardMaterial({ map: d2, roughness: 1 }))
    lane2.rotation.x = -Math.PI / 2
    lane2.position.set(midX(L2), 0.03, midZ(L2))
    lane2.receiveShadow = true
    G.add(lane2)
    addSurface(L2, 'gravel')
    // Paths joining the lanes.
    for (const x of [-38 + 3, 61]) {
      const r = turnRect({ minX: x - 2, maxX: x + 2, minZ: 74, maxZ: 112 })
      const path = new Mesh(new PlaneGeometry(4, 112 - 74), new MeshStandardMaterial({ map: dirt, roughness: 1 }))
      path.rotation.x = -Math.PI / 2
      path.position.set(midX(r), 0.031, midZ(r))
      G.add(path)
      addSurface(r, 'gravel')
    }
  }, 0.3)
  const signC = signCanvas(768, 192, { bg: '#2f6b3a', border: '#f5efd6', borderWidth: 14, radius: 24, plank: 2, lines: [{ text: 'PROCESSING PARK', size: 92, color: '#f5efd6' }] })
  // By the road, facing it (south).
  signPanel(root, 8, 2, signMaterial(signC), PARK_TURN.x - 50, 2.6, P.maxZ - 1)
  for (const x of [46.4, 53.6]) block(root, 0.25, 3.6, 0.25, M('#6e4122'), PARK_TURN.x - x, 0, P.maxZ - 1.05)

  // --- Processing buildings ------------------------------------------------------------------------------------
  const procs = []
  for (const def of GAME.proc) {
    const at = FARM.proc[def.id]
    let m = null
    let crate = null
    gated(root, def.id, (G) => {
      m = MODELS[def.id]()
      m.g.position.set(at.x, 0, at.z)
      m.g.rotation.y = Math.PI
      G.add(m.g)
      const [kx, kz] = parkAt(at, m.crate[0], m.crate[1] - 0.4)
      crate = outCrate(G, kx, kz)
      crate.g.rotation.y = Math.PI
      proc.setCrateSpot(def.id, kx, kz)
      const [w, d] = SIZE[def.id]
      solidRect(at.x - w * 0.4, at.x + w * 0.4, at.z - d * 0.45, at.z + d * 0.2, HEIGHT[def.id] * 0.6)
    }, HEIGHT[def.id])
    // The models place smoke and steam at wx / wz + an offset in their own frame: mirror it with the turn.
    const fx = {
      puff: (x, y, z, o) => particles?.puff(2 * at.x - x, y, 2 * at.z - z, o),
      burst: (x, y, z, o) => particles?.burst(2 * at.x - x, y, 2 * at.z - z, o),
      wx: at.x,
      wz: at.z,
    }
    procs.push({ def, at, m, crate, fx })
  }
  const paintLevels = () => {
    for (const p of procs) {
      const s = game.state.proc[p.def.id]
      p.m?.setLevel?.(Math.min(4, Math.round(((s?.speed ?? 0) + (s?.cap ?? 0) + (s?.worker ?? 0)) / 2)))
    }
  }
  paintLevels()
  game.on('procUp', ({ id }) => {
    paintLevels()
    const p = procs.find((x) => x.def.id === id)
    if (p) {
      const [x, z] = parkAt(p.at, 0, -6)
      particles?.confetti(x, 6, z, 50)
    }
  })
  game.on('reset', paintLevels)
  game.on('processed', ({ id, good }) => {
    const [x, z] = proc.crateSpot(id)
    particles?.burst(x, 1.2, z, { n: 10, colors: [GAME.goods[good].color, '#ffe36a'], speed: 1.6, up: 3.5, gravity: -9, life: 0.8, size: 0.26, additive: false })
  })
  game.on('procCollect', ({ id }) => {
    const [x, z] = proc.crateSpot(id)
    particles?.burst(x, 1.4, z, { n: 14, colors: ['#ffe36a', '#ffffff'], speed: 2, up: 4, gravity: -6, life: 0.8, size: 0.28 })
  })

  // --- Service buildings --------------------------------------------------------------------------------------------
  const W = FARM.workshop
  gated(root, 'workshop', (G) => {
    const m = workshop()
    m.g.position.set(W.x, 0, W.z)
    m.g.rotation.y = Math.PI
    G.add(m.g)
    solidRect(W.x - 7.5, W.x + 7.5, W.z - 5.8, W.z + 2, 6)
  }, 8)
  const FS = FARM.fuelStation
  gated(root, 'fuelStation', (G) => {
    const m = fuelStation()
    m.g.position.set(FS.x, 0, FS.z)
    m.g.rotation.y = Math.PI
    G.add(m.g)
  }, 6)
  const CW = FARM.carWash
  let wash = null
  gated(root, 'carWash', (G) => {
    wash = carWash()
    wash.g.position.set(CW.x, 0, CW.z)
    wash.g.rotation.y = Math.PI
    G.add(wash.g)
    solidRect(CW.x - 5.2, CW.x - 4.4, CW.z - 6.5, CW.z + 6.5, 5)
    solidRect(CW.x + 4.4, CW.x + 5.2, CW.z - 6.5, CW.z + 6.5, 5)
  }, 7)
  let washOn = 0
  game.on('wash', ({ x, z }) => {
    washOn = 4
    sfxx.wash()
    for (let i = 0; i < 30; i++) particles?.puff(x + rnd(-3, 3), rnd(0.5, 3.5), z + rnd(-4, 4), { color: '#ffffff', size: 0.6, grow: 2.2, life: 2.5, vy: 0.3, a: 0.75 })
  })
  const H = FARM.helipad
  gated(root, 'helipad', (G) => {
    const m = helipad()
    m.g.position.set(H.x, 0, H.z)
    m.g.rotation.y = Math.PI
    G.add(m.g)
  }, 3)
  const heli = helicopter()
  heli.g.visible = false
  heli.g.position.set(H.x, 0.15, H.z)
  heli.g.rotation.y = Math.PI
  root.add(heli.g)
  const tanker = milkTanker()
  tanker.g.visible = false
  const TK = { x: PARK_TURN.x - 70, z: midZ(FARM.parkLane) } // parked on the lane
  tanker.g.position.set(TK.x, 0.03, TK.z)
  tanker.g.rotation.y = -Math.PI / 2
  root.add(tanker.g)
  // The tanker's route: lane -> across onto the road's far (eastbound) lane -> east to
  // the market -> U-turn -> back west on the near lane -> into the park.
  const tankRoute = [[TK.x, TK.z], [TK.x, 49.5], [FARM.townMarket.x - 6, 49.5], [FARM.townMarket.x, 46], [FARM.townMarket.x - 6, 43], [TK.x + 6, 43], [TK.x + 6, TK.z + 4], [TK.x + 2, TK.z + 1], [TK.x, TK.z]]
  const segs = []
  let routeLen = 0
  for (let i = 1; i < tankRoute.length; i++) {
    const l = Math.hypot(tankRoute[i][0] - tankRoute[i - 1][0], tankRoute[i][1] - tankRoute[i - 1][1])
    segs.push([routeLen, l])
    routeLen += l
  }
  function along(f, out) {
    const d = f * routeLen
    for (let i = 0; i < segs.length; i++) {
      const [s, l] = segs[i]
      if (d <= s + l || i === segs.length - 1) {
        const k = Math.max(0, Math.min(1, (d - s) / l))
        const a = tankRoute[i]
        const b = tankRoute[i + 1]
        out.x = a[0] + (b[0] - a[0]) * k
        out.z = a[1] + (b[1] - a[1]) * k
        out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1])
        return out
      }
    }
    return out
  }
  const tp = { x: 0, z: 0, yaw: 0 }

  // --- Contracts board and price board (town) ----------------------------------------------------------------------------
  const B = FARM.contractBoard
  const board = contractBoard()
  board.g.position.set(B.x, 0, B.z)
  board.g.rotation.y = Math.PI // faces the road (north)
  root.add(board.g)
  solidRect(B.x - 2.2, B.x + 2.2, B.z - 0.3, B.z + 0.3, 3)
  const paintBoard = () => {
    const list = con.contracts()
    const cols = ['#e2763a', '#2f8a57', '#2f6fd0']
    board.paint(list.slice(0, 3).map((c, i) => ({ title: `${game.fmtMoney(c.reward)} · ${game.fmtClock(con.timeLeft(c))}`, sub: con.wantText(c), color: cols[i % 3] })))
  }
  paintBoard()
  const MK = FARM.townMarket
  const pb = liveBoard(512, 384)
  const pbMat = new MeshStandardMaterial({ map: pb.t, roughness: 0.8 })
  const pbx = MK.x + 13
  const pbz = 66.6
  const pbPanel = new Mesh(new PlaneGeometry(2.6, 1.95), pbMat)
  pbPanel.position.set(pbx, 2.1, pbz)
  pbPanel.rotation.y = Math.PI
  root.add(pbPanel)
  block(root, 2.9, 2.3, 0.12, M('#6e4122'), pbx, 0.95, pbz + 0.08)
  for (const dx of [-1.2, 1.2]) block(root, 0.16, 1.0, 0.16, M('#6e4122'), pbx + dx, 0, pbz + 0.08)
  const paintPrices = () => {
    const { ctx, c } = pb
    ctx.fillStyle = '#23402a'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#c8a46a'
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, c.width - 14, c.height - 14)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f5efd6'
    ctx.font = '700 46px Fredoka, sans-serif'
    ctx.fillText("TODAY'S PRICES", 256, 62)
    const hot = hotItem()
    ctx.fillStyle = '#ffd34a'
    ctx.font = '700 36px Fredoka, sans-serif'
    ctx.fillText(`HOT: ${GAME.goods[hot].name.toUpperCase()} 2x!`, 256, 112)
    ctx.textAlign = 'left'
    ctx.font = '600 30px Fredoka, sans-serif'
    const goods = ['egg', 'wheat', 'corn', 'milk', 'flour', 'bread', 'cheese', 'fuel'].filter((g) => GAME.goods[g])
    goods.slice(0, 8).forEach((g, i) => {
      const x = i < 4 ? 30 : 270
      const y = 165 + (i % 4) * 54
      ctx.fillStyle = '#f5efd6'
      ctx.fillText(GAME.goods[g].name, x, y)
      ctx.fillStyle = '#9dff8a'
      ctx.textAlign = 'right'
      ctx.fillText(game.fmtMoney(game.goodPrice(g)), x + 220, y)
      ctx.textAlign = 'left'
    })
    pb.t.needsUpdate = true
  }
  paintPrices()

  // --- Level zones: orchard, lake, greenhouse ------------------------------------------------------------------------------------
  const O = FARM.orchard
  const trees = []
  const orchardRule = GAME.ranch.find((r) => r.id === 'orchard')
  gated(root, 'orchard', (G) => {
    for (let i = 0; i < orchardRule.max; i++) {
      const t = appleTree(i)
      const cx = O.minX + 4 + (i % 4) * ((O.maxX - O.minX - 8) / 3)
      const cz = O.minZ + 5 + Math.floor(i / 4) * ((O.maxZ - O.minZ - 8) / 3)
      t.g.position.set(cx, 0, cz)
      t.g.rotation.y = i * 1.7
      G.add(t.g)
      trees.push(t)
    }
  }, 6)
  const LK = FARM.lake
  let pond = null
  let dock = null
  gated(root, 'lake', (G) => {
    pond = lake(LK.w, LK.d)
    pond.g.position.set(LK.x, 0, LK.z)
    pond.g.rotation.y = Math.PI
    G.add(pond.g)
    dock = fishingDock()
    dock.g.position.set(LK.dock.x, 0, LK.dock.z)
    dock.g.rotation.y = Math.PI
    G.add(dock.g)
  }, 3)
  const bobber = new Mesh(new SphereGeometry(0.16, 10, 8), new MeshStandardMaterial({ color: '#e23a35', roughness: 0.4 }))
  bobber.visible = false
  root.add(bobber)
  const [bobX] = parkAt(LK.dock, 12.5, 0) // out over the water, off the dock's end
  game.on('fish', (e) => {
    const x = bobX
    if (e.phase === 'cast' || e.phase === 'bite' || e.phase === 'catch') particles?.burst(x, 0.3, LK.dock.z, { n: e.phase === 'catch' ? 18 : 8, colors: ['#d8ecff', '#ffffff'], speed: 1.6, up: 3, gravity: -9, life: 0.6, size: 0.2, additive: false })
    if (e.phase === 'catch') sfxx.splash(x, LK.dock.z)
  })
  const GH = FARM.greenhouse
  let gh = null
  gated(root, 'greenhouse', (G) => {
    gh = greenhouse()
    gh.g.position.set(GH.x, 0, GH.z)
    gh.g.rotation.y = Math.PI
    G.add(gh.g)
    solidRect(GH.x - 8, GH.x + 8, GH.z - 5, GH.z + 3, 4)
  }, 5)

  // Heli: lifts off, flies east out of sight and comes back (econ/fleet.js runs the clock).
  const heliHome = { x: H.x, y: 0.15, z: H.z }
  let rpm = 0
  let boardT = 0
  return {
    update(dt, t, focus) {
      // Machines (only near the park: the buildings are far from everything else).
      const near = Math.abs(focus.z - midZ(P)) < 110 && Math.abs(focus.x - midX(P)) < 160
      for (const p of procs) {
        if (!p.m || !game.built(p.def.id)) continue
        if (near) p.m.update(dt, t, proc.running(p.def.id), p.fx)
        const s = game.state.proc[p.def.id]
        if (p.crate && s) {
          const n = proc.crateCount(p.def.id)
          const f = n / proc.crateMax(p.def, s)
          const goods = Object.keys(s.crate)
          p.crate.items.forEach((m, i) => {
            const on = i < Math.ceil(f * p.crate.items.length)
            m.visible = on
            if (on && goods.length) m.material.color.set(GAME.goods[goods[i % goods.length]].color)
          })
        }
      }
      // Car wash brushes.
      washOn = Math.max(0, washOn - dt)
      wash?.update?.(dt, t, washOn > 0)
      // Helicopter.
      const own = fleet.owns('heli') && game.built('helipad')
      heli.g.visible = own
      if (own) {
        const r = fleet.runs.heli
        const T = 34
        if (r.out > 0) {
          const f = 1 - r.out / T // 0..1 over the trip
          const up = Math.min(1, Math.min(f, 1 - f) * 8)
          const away = Math.sin(Math.min(f, 1 - f) * Math.PI) // 0 -> 1 -> 0
          heli.g.position.set(heliHome.x + away * 520, heliHome.y + up * 40 + away * 30, heliHome.z - away * 60)
          heli.g.rotation.y = f < 0.5 ? Math.PI / 2 : -Math.PI / 2
          heli.g.rotation.z = (f < 0.5 ? -1 : 1) * 0.12 * up
          heli.cargo.visible = f < 0.5 && up > 0.6
          rpm += (1 - rpm) * Math.min(1, dt * 1.5)
        } else {
          heli.g.position.set(heliHome.x, heliHome.y, heliHome.z)
          heli.g.rotation.set(0, Math.PI, 0)
          heli.cargo.visible = false
          rpm += (0 - rpm) * Math.min(1, dt * 0.6)
        }
        heli.update(dt, rpm)
        if (rpm > 0.5 && heli.g.position.y < 6 && Math.random() < dt * 20) particles?.dust(heliHome.x + rnd(-5, 5), heliHome.z + rnd(-5, 5), '#c9b89a', 3)
      }
      // Milk tanker.
      const ownT = fleet.owns('tanker')
      tanker.g.visible = ownT
      if (ownT) {
        const r = fleet.runs.tanker
        if (r.out > 0) {
          along(1 - r.out / 26, tp)
          tanker.g.position.set(tp.x, 0.03, tp.z)
          let dy = tp.yaw - tanker.g.rotation.y
          dy = Math.atan2(Math.sin(dy), Math.cos(dy))
          tanker.g.rotation.y += dy * Math.min(1, dt * 5)
        } else {
          tanker.g.position.set(TK.x, 0.03, TK.z)
          tanker.g.rotation.y = -Math.PI / 2
        }
        updateRig(tanker.rig, dt, t, { particles })
      }
      // Orchard: trees for the apple-tree count, apples by how full the crate is.
      const orch = game.ranchState(orchardRule)
      if (orch) {
        const f = orch.crate / game.ranchCrateMax(orchardRule)
        trees.forEach((tr, i) => {
          tr.g.visible = i < orch.n
          tr.setRipe?.(Math.min(1, f * 1.5 + 0.1))
        })
      }
      const ghRule = GAME.ranch.find((r) => r.id === 'greenhouse')
      const ghs = game.ranchState(ghRule)
      if (gh && ghs) gh.setRipe(ghs.crate / game.ranchCrateMax(ghRule))
      pond?.update?.(dt, t)
      // Fishing bobber.
      bobber.visible = fishing.phase !== 'idle'
      if (bobber.visible) {
        const dip = fishing.phase === 'bite' ? -0.18 + Math.sin(t * 30) * 0.08 : Math.sin(t * 2.4) * 0.04
        bobber.position.set(bobX, (pond?.waterY ?? 0.12) + 0.08 + dip, LK.dock.z)
      }
      // Boards.
      boardT -= dt
      if (boardT <= 0) {
        boardT = 1
        paintBoard()
        paintPrices()
      }
      void rideables
    },
  }
}
