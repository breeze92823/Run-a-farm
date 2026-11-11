import { CanvasTexture, CircleGeometry, Group, Mesh, MeshPhysicalMaterial, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import * as sfx from '../audio/sfx.js'
import { M, block, cyl, gated, inRect, solidCyl, solidRect } from './kit.js'
import { cowBarn, duckHouse, pigHouse, stables } from './models.js'
import { cow, duck, gait, goat, horse, pig, setWool, sheep } from './animals.js'
import { beeHives, goatBarn, sheepShed } from './zonemodels.js'
import { careState, growth, happiness } from '../econ/care.js'
import { CLOCKS, course } from '../econ/minigames.js'
import { makeNPC } from './npc.js'
import { mount } from '../mount.js'
import { player } from '../player.js'

// The ranch north of the railway (FARM.ranch): four barns bought on build
// pads along the ranch's south path, each with its animals and a crate by the
// path where its produce collects:
//  - Duck House (ducks waddle between the house and their pool): duck eggs
//  - Cow Barn + silo (cows graze the west paddock): milk
//  - Pig Pen (pigs root about and wallow in the mud): truffles
//  - Horse Stables (horses canter round the jumping arena): ride money
// Walk past a crate to collect it (ride money goes straight to the bank), or
// hire Ranchers at the Farm Office. "+1 animal" and Better Feed are bought in
// each barn's window (E at its crate).

const rnd = (a, b) => a + Math.random() * (b - a)

function crateLabel() {
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 112
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(3, 0.875, 1)
  let last = ''
  s.userData.set = (a, b, color) => {
    if (a + b === last) return
    last = a + b
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = 'rgba(40,24,10,0.8)'
    ctx.beginPath()
    ctx.roundRect(4, 4, 376, 104, 20)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 42px Fredoka, sans-serif'
    ctx.fillStyle = color
    ctx.fillText(a, 192, 38, 360)
    ctx.font = '600 30px Fredoka, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(b, 192, 82, 360)
    t.needsUpdate = true
  }
  document.fonts?.ready?.then(() => (last = ''))
  return s
}

// The crate by the path: a wooden box whose contents (bottles, eggs, truffles, coins) fill up.
function produceCrate(root, x, z, kind) {
  const g = new Group()
  g.userData.noCompact = true // the produce fills up item by item
  g.position.set(x, 0, z)
  block(g, 1.6, 0.6, 1.1, M('#a8723f', { roughness: 0.9 }), 0, 0, 0)
  for (const y of [0.15, 0.45]) block(g, 1.62, 0.06, 1.12, M('#7b4a26'), 0, y, 0, 0, false)
  const items = []
  const color = { milk: '#ffffff', duckEgg: '#cfe6d8', truffle: '#5a3a24', cash: '#ffd23a' }[kind] ?? GAME.goods[kind]?.color ?? '#ffffff'
  for (let i = 0; i < 12; i++) {
    let m
    if (kind === 'milk') {
      m = new Group()
      cyl(m, 0.1, 0.1, 0.34, M('#f4f6f8', { roughness: 0.2, transparent: true, opacity: 0.95 }), 0, 0.17, 0, 10)
      cyl(m, 0.06, 0.06, 0.06, M('#2f6fd0'), 0, 0.37, 0, 8)
    } else {
      m = new Mesh(new SphereGeometry(kind === 'cash' ? 0.13 : 0.1, 8, 6), M(color, { roughness: kind === 'cash' ? 0.25 : 0.5, metalness: kind === 'cash' ? 0.7 : 0 }))
      if (kind === 'duckEgg') m.scale.y = 1.25
      if (kind === 'cash') m.scale.y = 0.3
    }
    m.position.set(-0.55 + (i % 4) * 0.37, 0.55 + Math.floor(i / 8) * 0.12, -0.3 + (Math.floor(i / 4) % 2) * 0.55)
    m.visible = false
    g.add(m)
    items.push(m)
  }
  // A little sign post.
  block(g, 0.1, 1.6, 0.1, M('#6e4122'), 0.95, 0, -0.4)
  root.add(g)
  const label = crateLabel()
  label.position.set(x, 2.5, z)
  root.add(label)
  return { g, items, label }
}

// A herd inside a rect, keeping out of `avoid` rects. Each animal picks what
// to do next (graze, stand and look about, amble somewhere, hurry), speeds up
// and slows down smoothly, turns gradually and is posed by animals.js `gait`.
// Extras: `pool` (an ellipse ducks swim in), `loop` (a ring the horses canter
// round), `mud` (pigs wallow, flicking mud).
function herd(root, make, max, area, avoid, { walk = 1, run = 2.4, graze = 0.6, runChance = 0.2, pool = null, loop = null, mud = null } = {}) {
  const list = []
  for (let i = 0; i < max; i++) {
    const q = make(i)
    q.g.visible = false
    root.add(q.g)
    list.push({ q, x: rnd(area.minX + 2, area.maxX - 2), z: rnd(area.minZ + 2, area.maxZ - 2), yaw: rnd(0, 6), v: 0, state: 'idle', t: rnd(0, 3), target: null, run: false, graze: 0, swim: 0, flap: 0, lap: 0 })
  }
  const inPool = (x, z) => pool && ((x - pool.x) / pool.rx) ** 2 + ((z - pool.z) / pool.rz) ** 2 < 1
  const free = (x, z) => inRect(x, z, area, -1.2) && !avoid.some((r) => inRect(x, z, r, 1.2))
  const pick = () => {
    for (let k = 0; k < 20; k++) {
      const x = rnd(area.minX + 2, area.maxX - 2)
      const z = rnd(area.minZ + 2, area.maxZ - 2)
      if (free(x, z)) return [x, z]
    }
    return [(area.minX + area.maxX) / 2, (area.minZ + area.maxZ) / 2]
  }
  for (const a of list) if (!free(a.x, a.z)) [a.x, a.z] = pick()
  return {
    list,
    // ex: { mood: 0..1 happiness, grow(i): 0..1 baby growth, heart(a) } (econ/care.js)
    update(dt, t, n, onStep, far = false, ex = null) {
      const mood = ex?.mood ?? 1
      const sad = mood < GAME.care.sad
      list.forEach((a, i) => {
        const on = i < n && !far
        a.q.g.visible = on
        if (!on) return
        a.t -= dt
        // A baby keeps close to its mother (the first of the herd).
        const gr = ex?.grow ? ex.grow(i) : 1
        a.q.g.scale.setScalar(0.45 + 0.55 * gr)
        if (gr < 1 && i > 0 && a.state !== 'lap') {
          const mom = list[0]
          const dd = Math.hypot(mom.x - a.x, mom.z - a.z)
          if (dd > 2.4) {
            a.state = 'walk'
            a.target = [mom.x - Math.sin(mom.yaw) * 1.3 + (i % 2 ? 0.7 : -0.7), mom.z - Math.cos(mom.yaw) * 1.3]
            a.run = dd > 6
            a.t = 2
          }
        }
        if (mood >= GAME.care.happy && ex?.heart && Math.random() < dt * 0.06) ex.heart(a)
        // Decide.
        if (a.state !== 'walk' && a.state !== 'lap' && a.t <= 0) {
          const r = Math.random()
          if (loop && r < 0.18) {
            a.state = 'lap'
            a.lap = Math.atan2(a.z - loop.z, a.x - loop.x)
            a.t = rnd(12, 22)
          } else if (pool && r < 0.4) {
            a.state = 'walk'
            const ang = rnd(0, Math.PI * 2)
            a.target = [pool.x + Math.cos(ang) * pool.rx * 0.6, pool.z + Math.sin(ang) * pool.rz * 0.6]
            a.run = false
            a.t = 20
          } else if (r < 0.6) {
            a.state = 'walk'
            a.target = pick()
            a.run = Math.random() < runChance
            a.t = 16
          } else {
            a.state = Math.random() < graze ? 'graze' : 'idle'
            a.t = rnd(3, 8)
          }
        }
        let want = 0
        if (a.state === 'lap') {
          // Canter round the ring.
          a.lap += (run / loop.r) * dt
          const tx = loop.x + Math.cos(a.lap + 0.4) * loop.r
          const tz = loop.z + Math.sin(a.lap + 0.4) * loop.r * loop.k
          a.target = [tx, tz]
          want = run
          if (a.t <= 0) {
            a.state = 'walk'
            a.target = pick()
            a.run = false
            a.t = 10
          }
        } else if (a.state === 'walk' && a.target) {
          const d = Math.hypot(a.target[0] - a.x, a.target[1] - a.z)
          want = a.run ? run : walk
          if (d < 1.2) want *= d / 1.2
          if (d < 0.25 || a.t <= 0) {
            a.state = inPool(a.x, a.z) ? 'idle' : Math.random() < graze ? 'graze' : 'idle'
            a.t = rnd(3, 8)
          }
        }
        if (sad) want *= 0.45 // unhappy animals mope about
        // Accelerate / brake smoothly, turn toward the target.
        a.v += (want - a.v) * Math.min(1, dt * (want > a.v ? 1.6 : 2.4))
        if (a.target && a.v > 0.02) {
          const tw = Math.atan2(a.target[0] - a.x, a.target[1] - a.z)
          a.yaw += Math.atan2(Math.sin(tw - a.yaw), Math.cos(tw - a.yaw)) * Math.min(1, dt * (a.state === 'lap' ? 4 : 2.2))
          const nx = a.x + Math.sin(a.yaw) * a.v * dt
          const nz = a.z + Math.cos(a.yaw) * a.v * dt
          if (free(nx, nz) || a.state === 'lap') {
            a.x = nx
            a.z = nz
          } else {
            a.target = pick()
            a.v *= 0.5
          }
        }
        a.graze += ((a.state === 'graze' ? 1 : sad ? 0.7 : 0) - a.graze) * Math.min(1, dt * 1.5) // a sad animal hangs its head
        a.swim += ((inPool(a.x, a.z) ? 1 : 0) - a.swim) * Math.min(1, dt * 3)
        a.flap = Math.max(0, a.flap - dt)
        if (a.q.kind === 'duck' && Math.random() < dt * 0.05) a.flap = 0.8
        const steps = gait(a.q, dt, t, { speed: a.v, graze: a.graze, swim: a.swim, flap: a.flap > 0 ? 1 : 0, run: a.v > walk * 1.5 })
        a.q.g.position.set(a.x, 0, a.z)
        a.q.g.rotation.y = a.yaw
        if (steps.length) onStep?.(a, steps)
        if (a.swim > 0.5 && a.v > 0.1 && Math.random() < dt * 4) onStep?.(a, ['swim'])
        if (mud && a.graze > 0.5 && Math.random() < dt * 0.8) onStep?.(a, ['root'])
      })
    },
  }
}

export function buildRanch(root, { particles }) {
  const C = FARM.ranchCrates
  const spots = []
  const crates = {}
  for (const r of GAME.ranch) {
    gated(root, r.id, (G) => {
      const [x, z] = C[r.id]
      crates[r.id] = produceCrate(G, x, z, r.cash ? 'cash' : r.good)
    }, 3)
    spots.push({ r, x: C[r.id][0], z: C[r.id][1] })
  }

  // --- Duck House + pool --------------------------------------------------------------------------------
  const DH = FARM.duckHouse
  gated(root, 'duckHouse', (G) => {
    const h = duckHouse()
    h.g.position.set(DH.x, 0, DH.z)
    G.add(h.g)
    const bank = cyl(G, 1, 1, 0.1, M('#7a6a48', { roughness: 1 }), DH.pool.x, 0.03, DH.pool.z, 24, false)
    bank.scale.set(5.2, 1, 3.8)
    const water = new Mesh(new CircleGeometry(1, 32), new MeshPhysicalMaterial({ color: '#3f8fbf', roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.9 }))
    water.rotation.x = -Math.PI / 2
    water.scale.set(4.6, 3.3, 1)
    water.position.set(DH.pool.x, 0.1, DH.pool.z)
    G.add(water)
    solidRect(DH.x - 1.7, DH.x + 1.7, DH.z - 1.4, DH.z + 1.4, 3)
  }, 4)
  const duckRule = GAME.ranch.find((r) => r.id === 'duckHouse')
  const ducks = herd(root, (i) => duck(i), duckRule.max, DH.pen, [{ minX: DH.x - 2, maxX: DH.x + 2, minZ: DH.z - 1.6, maxZ: DH.z + 1.6 }], { walk: 0.45, run: 0.9, graze: 0.5, pool: { x: DH.pool.x, z: DH.pool.z, rx: 4.3, rz: 3.0 } })
  // Ducks: their 'neck' is the head group.

  // --- Cow Barn -------------------------------------------------------------------------------------------
  const CB = FARM.cowBarn
  gated(root, 'cowBarn', (G) => {
    const b = cowBarn()
    b.g.position.set(CB.x, 0, CB.z)
    G.add(b.g)
    solidRect(CB.x - 6, CB.x + 6, CB.z - 5, CB.z + 5, 6)
    solidCyl(2.2, 12, CB.x + 8.6, CB.z - 1.5)
  }, 12)
  const cowRule = GAME.ranch.find((r) => r.id === 'cowBarn')
  const cows = herd(root, (i) => cow(i), cowRule.max, CB.pen, [{ minX: CB.x - 7, maxX: CB.x + 11, minZ: CB.z - 6, maxZ: CB.z + 6 }], { walk: 0.8, run: 1.8, graze: 0.8, runChance: 0.08 })

  // --- Pig Pen ----------------------------------------------------------------------------------------------
  const PP = FARM.pigPen
  let mud = null
  gated(root, 'pigPen', (G) => {
    const h = pigHouse()
    h.g.position.set(PP.x, 0, PP.z)
    G.add(h.g)
    mud = { x: PP.x + h.mud.x, z: PP.z + h.mud.z }
    solidRect(PP.x - 4.5, PP.x + 4.5, PP.z - 3, PP.z + 3, 3)
  }, 4)
  const pigRule = GAME.ranch.find((r) => r.id === 'pigPen')
  const pigs = herd(root, (i) => pig(i), pigRule.max, PP.pen, [{ minX: PP.x - 5.5, maxX: PP.x + 5.5, minZ: PP.z - 4, maxZ: PP.z + 4 }], { walk: 0.7, run: 1.8, graze: 0.75, runChance: 0.2, mud: true })

  // --- Horse Stables ----------------------------------------------------------------------------------------
  const SB = FARM.stables
  let vane = null
  gated(root, 'stables', (G) => {
    const s = stables()
    s.g.position.set(SB.x, 0, SB.z)
    G.add(s.g)
    vane = s.vane
    solidRect(SB.x - 11, SB.x + 11, SB.z - 5, SB.z + 5, 7)
  }, 9)
  const horseRule = GAME.ranch.find((r) => r.id === 'stables')
  const A = FARM.arena
  const horses = herd(root, (i) => horse(i), horseRule.max, A, [], { walk: 1.3, run: 6.5, graze: 0.45, runChance: 0, loop: { x: (A.minX + A.maxX) / 2, z: (A.minZ + A.maxZ) / 2, r: (A.maxX - A.minX) / 2 - 5, k: (A.maxZ - A.minZ - 10) / (A.maxX - A.minX - 10) } })

  // --- Sheep Shed (wool to shear) and Goat Barn ---------------------------------------------------------------
  const SS = FARM.sheepShed
  gated(root, 'sheepShed', (G) => {
    const m = sheepShed()
    m.g.position.set(SS.x, 0, SS.z)
    m.g.rotation.y = Math.PI // open front toward the ranch path
    G.add(m.g)
    solidRect(SS.x - 5, SS.x + 5, SS.z - 3.5, SS.z + 1, 3.5)
  }, 5)
  const sheepRule = GAME.ranch.find((r) => r.id === 'sheepShed')
  const flock = herd(root, (i) => sheep(i), sheepRule.max, SS.pen, [{ minX: SS.x - 6, maxX: SS.x + 6, minZ: SS.z - 4.5, maxZ: SS.z + 4.5 }], { walk: 0.55, run: 1.6, graze: 0.8, runChance: 0.12 })
  const GB = FARM.goatBarn
  gated(root, 'goatBarn', (G) => {
    const m = goatBarn()
    m.g.position.set(GB.x, 0, GB.z)
    m.g.rotation.y = Math.PI
    G.add(m.g)
    solidRect(GB.x - 5, GB.x + 5, GB.z - 4, GB.z + 4, 4)
  }, 6)
  const goatRule = GAME.ranch.find((r) => r.id === 'goatBarn')
  const goats = herd(root, (i) => goat(i), goatRule.max, GB.pen, [{ minX: GB.x - 6, maxX: GB.x + 6, minZ: GB.z - 5, maxZ: GB.z + 5 }], { walk: 0.7, run: 2.2, graze: 0.6, runChance: 0.3 })
  // --- Apiary north of Field 1 -----------------------------------------------------------------------------------
  const AP = FARM.apiary
  let hives = null
  gated(root, 'apiary', (G) => {
    hives = beeHives(6)
    hives.g.position.set(AP.x, 0, AP.z)
    G.add(hives.g)
  }, 3)
  // --- Troughs by every animal barn's crate (care) ---------------------------------------------------------------------
  const troughs = {}
  for (const r of GAME.ranch) {
    if (r.plant) continue
    const [tx, tz] = FARM.troughs[r.id]
    gated(root, r.id, (G) => {
      const g = new Group()
      g.userData.noCompact = true
      g.position.set(tx, 0, tz)
      block(g, 1.4, 0.5, 0.7, M('#7b4a26'), -0.8, 0, 0)
      block(g, 1.4, 0.5, 0.7, M('#9aa3ab', { metalness: 0.5, roughness: 0.35 }), 0.8, 0, 0)
      const feed = block(g, 1.2, 0.08, 0.5, M('#e3c063', { roughness: 1 }), -0.8, 0.38, 0, 0, false)
      const water = block(g, 1.2, 0.04, 0.5, M('#5fa8d6', { roughness: 0.05 }), 0.8, 0.4, 0, 0, false)
      block(g, 0.08, 1.4, 0.08, M('#6e4122'), 0, 0, -0.45)
      G.add(g)
      troughs[r.id] = { feed, water }
    }, 2)
  }
  // --- Tourists riding in the arena (the ride money) --------------------------------------------------------------------
  const riders = [0, 2].map((k, i) => {
    const n = makeNPC({ shirt: i ? '#e85aa0' : '#2fa8a0', pants: '#2c3e66', hat: 'cap', hatColor: i ? '#ffffff' : '#e23a35' })
    n.group.scale.setScalar(0.85)
    n.legL.rotation.x = n.legR.rotation.x = -1.2
    n.legL.rotation.z = 0.35
    n.legR.rotation.z = -0.35
    n.armL.rotation.x = n.armR.rotation.x = -0.7
    horses.list[k].q.g.add(n.group)
    n.group.position.set(0, 1.42, 0.05)
    return n
  })
  // --- The player's own horse, saddled by the arena --------------------------------------------------------------------
  const myHorse = horse(5)
  const HZ = { x: -100, z: -141, ry: Math.PI / 2 }
  myHorse.g.position.set(HZ.x, 0, HZ.z)
  myHorse.g.rotation.y = HZ.ry
  myHorse.g.visible = false
  root.add(myHorse.g)
  block(myHorse.body, 0.6, 0.12, 0.75, M('#7a3a1a'), 0, 0.7, 0.05) // the saddle
  const mount2 = { kind: 'horse', k: 0, g: myHorse.g, rig: null, name: 'RIDE HORSE', sub: () => 'Gallop anywhere · Space jumps', available: () => game.built('stables'), take() {}, leave() {} }
  const horseState = { v: 0, graze: 0 }
  // --- The jumping course: jumps and the clocks ----------------------------------------------------------------------------------
  const J = FARM.arenaCourse
  const jumps = J.map(([x, z], i) => {
    const g = new Group()
    g.userData.noCompact = true
    const [nx, nz] = J[i + 1] ?? J[i - 1]
    g.rotation.y = Math.atan2(nx - x, nz - z) + Math.PI / 2
    g.position.set(x, 0, z)
    for (const sx of [-1.6, 1.6]) {
      block(g, 0.18, 1.5, 0.18, M('#f4f1e8'), sx, 0, 0)
      for (let k = 0; k < 3; k++) block(g, 0.2, 0.18, 0.2, M('#d6322c'), sx, 0.2 + k * 0.45, 0, 0, false)
    }
    for (const y of [0.55, 1.0]) block(g, 3.2, 0.08, 0.08, M(i % 2 ? '#2f6fd0' : '#f2a03a'), 0, y, 0)
    const flag = cyl(g, 0.5, 0.5, 0.05, M('#ffd34a', { emissive: '#ffb000', emissiveIntensity: 0.6 }), 0, 2.2, 0, 16, false)
    flag.rotation.x = Math.PI / 2
    flag.visible = false
    gated(root, 'stables', (G) => G.add(g), 2)
    return { g, flag }
  })
  const clocks = CLOCKS.map(([x, z]) => {
    const c = cyl(root, 0.45, 0.45, 0.1, M('#ffd23a', { metalness: 0.6, roughness: 0.3, emissive: '#ffb000', emissiveIntensity: 0.4 }), x, 1.6, z, 18, false)
    c.rotation.x = Math.PI / 2
    c.visible = false
    return c
  })
  game.on('course', (e) => {
    if (e.phase === 'jump') particles?.burst(e.x, 1.4, e.z, e.clean ? { n: 20, colors: ['#ffd23a', '#ffffff'], speed: 3, up: 4, gravity: -6, life: 0.8, size: 0.3 } : { n: 10, colors: ['#ff4a4a'], speed: 2, up: 2, gravity: -6, life: 0.6, size: 0.3 })
    if (e.phase === 'clock') particles?.coins(e.x, 1.6, e.z, 10)
    if (e.phase === 'finish') particles?.confetti(player.position.x, 3, player.position.z, 90)
  })

  const herds = { duckHouse: ducks, cowBarn: cows, pigPen: pigs, stables: horses, sheepShed: flock, goatBarn: goats }

  // Barn Expansion levels, beside each barn: 1 a lean-to shed, 2 a stack of hay, 3 a water trough and feeder.
  const EXP = { duckHouse: [DH.x + 3.2, DH.z + 4, 0.55], cowBarn: [CB.x - 2, CB.z + 8, 1], pigPen: [PP.x - 2, PP.z + 5.5, 0.8], stables: [SB.x + 2, SB.z + 8, 1] }
  const expansions = {}
  for (const r of GAME.ranch) {
    expansions[r.id] = []
    if (!EXP[r.id]) continue
    const [ex, ez, k] = EXP[r.id]
    const parts = []
    gated(root, r.id, (G) => {
      const lean = new Group()
      lean.position.set(ex - 4 * k, 0, ez)
      for (const [px, pz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) block(lean, 0.16, pz < 0 ? 2.6 * k : 2.1 * k, 0.16, M('#7b4a26'), px * k, 0, pz * k)
      const roof = block(lean, 3.8 * k, 0.1, 3.0 * k, M('#9aa3ab', { metalness: 0.5, roughness: 0.4 }), 0, 2.35 * k, 0)
      roof.rotation.x = 0.18
      block(lean, 3.4 * k, 1.4 * k, 0.08, M('#a8693a'), 0, 0, -1.2 * k)
      for (let i = 0; i < 3; i++) block(lean, 0.9 * k, 0.5 * k, 0.6 * k, M('#e3c063', { roughness: 1 }), -1 * k + i * k, 0, -0.6 * k)
      G.add(lean)
      const hay = new Group()
      hay.position.set(ex, 0, ez)
      for (let i = 0; i < 6; i++) block(hay, 1.2 * k, 0.55 * k, 0.75 * k, M('#e3c063', { roughness: 1 }), (i % 3 - 1) * 1.25 * k, Math.floor(i / 3) * 0.55 * k, 0, (i % 2) * 0.05)
      G.add(hay)
      const trough = new Group()
      trough.position.set(ex + 4 * k, 0, ez)
      block(trough, 2.4 * k, 0.6 * k, 0.8 * k, M('#9aa3ab', { metalness: 0.5, roughness: 0.35 }), 0, 0, 0)
      block(trough, 2.2 * k, 0.04, 0.6 * k, M('#6fb0d6', { roughness: 0.05 }), 0, 0.56 * k, 0)
      block(trough, 0.9 * k, 1.4 * k, 0.9 * k, M('#c8302a'), 1.9 * k, 0, 0) // feeder
      block(trough, 1.1 * k, 0.12, 1.1 * k, M('#5e6168'), 1.9 * k, 1.4 * k, 0)
      G.add(trough)
      parts.push(lean, hay, trough)
    }, 3)
    expansions[r.id] = parts
  }
  const showExp = () => {
    for (const r of GAME.ranch) expansions[r.id].forEach((p, i) => (p.visible = i < (game.ranchState(r)?.expand ?? 0)))
  }
  showExp()
  game.on('expand', (r) => {
    showExp()
    const [ex, ez] = EXP[r.id] ?? FARM.ranchCrates[r.id]
    particles?.ring(ex, ez, 4, '#c9a57a', 30)
    particles?.confetti(ex, 3, ez, 50)
    sfx.build(ex, ez)
  })
  game.on('reset', showExp)
  game.on('animals', (r) => {
    const h = herds[r.id]
    const a = h?.list[(game.ranchState(r)?.n ?? 1) - 1]
    if (a) {
      particles?.confetti(a.x, 2, a.z, 30)
      particles?.ring(a.x, a.z, 1.5, '#c9a57a', 14)
    }
  })
  game.on('ranchCollect', ({ r, by }) => {
    const [x, z] = C[r.id]
    if (r.cash) {
      particles?.coins(x, 1.5, z, 14)
      sfx.till(x, z)
    } else particles?.burst(x, 1.2, z, { n: 14, colors: [GAME.goods[r.good].color, '#ffe36a'], speed: 2, up: 4, gravity: -9, life: 0.8, size: 0.26, additive: false })
    void by
  })
  game.on('product', (r) => {
    const [x, z] = C[r.id]
    particles?.burst(x, 1.0, z, { n: 5, colors: ['#fff6c0'], speed: 0.8, up: 2, gravity: -3, life: 0.5, size: 0.22 })
  })

  const callT = { cow: rnd(3, 8), pig: rnd(3, 8), horse: rnd(5, 12), duck: rnd(3, 8) }
  const heart = (a) => particles?.burst(a.x, 1.6 * a.q.g.scale.y + 0.4, a.z, { n: 3, colors: ['#ff5a8a', '#ff9ab4'], speed: 0.4, up: 1.6, gravity: -0.5, life: 1.4, size: 0.34, grow: 1.2 })
  game.on('refill', ({ r }) => {
    const T = FARM.troughs[r.id]
    if (!T) return
    particles?.burst(T[0], 1, T[1], { n: 16, colors: ['#5fa8d6', '#e3c063', '#ffffff'], speed: 2, up: 3, gravity: -8, life: 0.8, size: 0.24, additive: false })
    for (const a of herds[r.id]?.list ?? []) if (a.q.g.visible && Math.random() < 0.6) heart(a)
  })
  game.on('ranchCollect', ({ r }) => {
    if (r.id !== 'sheepShed') return
    for (const a of flock.list) if (a.q.g.visible) particles?.burst(a.x, 0.9, a.z, { n: 10, colors: ['#f6f2e8', '#e9dec6'], speed: 1.5, up: 2.5, gravity: -3, life: 1.2, size: 0.3, additive: false })
  })
  return {
    spots,
    horse: mount2,
    update(dt, t, focus) {
      // Far from the ranch (and the camera with the player), the herds rest unseen.
      const RA = FARM.ranch
      const far = !!focus && Math.hypot(Math.max(RA.minX - focus.x, 0, focus.x - RA.maxX), Math.max(RA.minZ - focus.z, 0, focus.z - RA.maxZ)) > 110
      const n = (id) => (game.built(id) ? game.ranchState(GAME.ranch.find((r) => r.id === id))?.n ?? 0 : 0)
      const exOf = (id) => {
        const r = GAME.ranch.find((x) => x.id === id)
        return { mood: happiness(r), grow: (i) => growth(r, i), heart }
      }
      ducks.update(dt, t, far ? 0 : n('duckHouse'), (a, steps) => {
        if (steps[0] === 'swim') particles?.puff(a.x - Math.sin(a.yaw) * 0.3, 0.12, a.z - Math.cos(a.yaw) * 0.3, { color: '#e8f4ff', size: 0.2, grow: 4, life: 1.2, vy: 0, a: 0.35 })
      }, false, exOf('duckHouse'))
      cows.update(dt, t, far ? 0 : n('cowBarn'), (a) => a.v > 1 && particles?.dust(a.x, a.z, '#b8936a', 1), false, exOf('cowBarn'))
      flock.update(dt, t, far ? 0 : n('sheepShed'), (a) => a.v > 1 && particles?.dust(a.x, a.z, '#b8936a', 1), false, exOf('sheepShed'))
      goats.update(dt, t, far ? 0 : n('goatBarn'), (a) => a.v > 1.5 && particles?.dust(a.x, a.z, '#b8936a', 1), false, exOf('goatBarn'))
      pigs.update(dt, t, far ? 0 : n('pigPen'), (a, steps) => {
        const inMud = mud && Math.hypot(a.x - mud.x, a.z - mud.z) < 4.5
        const fx = a.x + Math.sin(a.yaw) * 0.8
        const fz = a.z + Math.cos(a.yaw) * 0.8
        if (steps[0] === 'root') particles?.burst(fx, 0.1, fz, { n: 5, colors: ['#5a3a22', '#7a5434'], speed: 1, up: 2.5, gravity: -9, life: 0.6, size: 0.12, additive: false })
        else if (inMud) particles?.burst(a.x, 0.1, a.z, { n: 4, colors: ['#4a2e1a', '#6a4428'], speed: 1.4, up: 2, gravity: -9, life: 0.5, size: 0.14, additive: false })
      }, false, exOf('pigPen'))
      horses.update(dt, t, far ? 0 : n('stables'), (a) => {
        sfx.clop(a.x, a.z)
        if (a.v > 2) particles?.dust(a.x - Math.sin(a.yaw), a.z - Math.cos(a.yaw), '#e3be8a', a.v > 4 ? 3 : 1)
      }, false, exOf('stables'))
      // Wool grows on the sheep while it waits to be shorn.
      const ss = game.ranchState(sheepRule)
      if (ss) {
        const k = ss.crate / game.ranchCrateMax(sheepRule)
        flock.list.forEach((a) => setWool(a.q, k))
      }
      hives?.update(dt, t, game.built('apiary'))
      // Troughs show how full they are.
      for (const id in troughs) {
        const c = careState(GAME.ranch.find((r) => r.id === id))
        if (!c) continue
        troughs[id].feed.scale.y = Math.max(0.05, c.food)
        troughs[id].water.visible = c.water > 0.02
        troughs[id].water.position.y = 0.3 + 0.12 * c.water
      }
      // Tourists ride the first and third horse.
      riders.forEach((r, i) => (r.group.visible = n('stables') > i * 2))
      // The player's horse: waits by the arena, or carries the player.
      const ridingHorse = mount.active?.kind === 'horse'
      myHorse.g.visible = game.built('stables')
      if (myHorse.g.visible) {
        const v = ridingHorse ? Math.hypot(player.velocity.x, player.velocity.z) : 0
        horseState.v += (v - horseState.v) * Math.min(1, dt * 6)
        if (!ridingHorse) horseState.graze += ((Math.sin(t * 0.3) > 0.2 ? 1 : 0) - horseState.graze) * Math.min(1, dt)
        else horseState.graze = 0
        const steps = gait(myHorse, dt, t, { speed: horseState.v * 0.45, graze: horseState.graze, run: horseState.v > 7 })
        if (ridingHorse) {
          myHorse.g.position.y = player.renderPosition.y
          if (steps.length) sfx.clop(myHorse.g.position.x, myHorse.g.position.z)
          if (horseState.v > 6 && player.grounded) particles?.dust(myHorse.g.position.x, myHorse.g.position.z, '#c9a57a', 1)
        }
      }
      // The course.
      jumps.forEach((j, i) => {
        j.flag.visible = course.on && i === course.next
        if (j.flag.visible) j.flag.rotation.z = t * 3
      })
      clocks.forEach((c, i) => {
        c.visible = course.on && course.clocks[i]
        if (c.visible) {
          c.rotation.z = t * 3
          c.position.y = 1.6 + Math.sin(t * 2 + i) * 0.2
        }
      })
      if (vane) vane.rotation.y = Math.sin(t * 0.2) * 1.2
      // Calls now and then from a random animal.
      const call = (key, h, id, fn) => {
        callT[key] -= dt
        if (callT[key] > 0) return
        callT[key] = rnd(5, 14)
        const k = n(id)
        if (!k) return
        const a = h.list[Math.floor(Math.random() * k)]
        fn(a.x, a.z)
      }
      call('cow', cows, 'cowBarn', sfx.moo)
      call('pig', pigs, 'pigPen', sfx.oink)
      call('horse', horses, 'stables', sfx.neigh)
      call('duck', ducks, 'duckHouse', sfx.quack)
      // Crates fill up with produce; labels say what and how much.
      for (const r of GAME.ranch) {
        const c = crates[r.id]
        const s = game.ranchState(r)
        if (!c || !s) continue
        const f = s.crate / game.ranchCrateMax(r)
        c.items.forEach((m, i) => (m.visible = i < Math.ceil(f * c.items.length)))
        const what = r.cash ? `RIDES ${game.fmtMoney(s.crate * r.cash * game.ranchValue(r))}` : `${GAME.goods[r.good].name.toUpperCase()} ${s.crate}/${game.ranchCrateMax(r)}`
        c.label.userData.set(what, `${s.n} ${r.animal}${s.n > 1 ? 's' : ''} · E for upgrades`, r.cash ? '#ffd23a' : '#9dff8a')
        c.label.position.y = 2.5 + Math.sin(t * 1.3) * 0.05
      }
    },
  }
}
