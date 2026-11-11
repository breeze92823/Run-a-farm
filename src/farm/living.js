import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { clock } from '../econ/clock.js'
import { stepTarget } from '../econ/tutorial.js'
import { M, box } from './kit.js'
import { idle, makeNPC, makeWalker, updateWalker } from './npc.js'
import { festivalStall, bunting, trophyShelf } from './zonemodels.js'

// The farm's people and goings-on (roadmap 3.4 and 3.3):
//  - stand visitors: they walk in from the road, queue at the farm stand, buy
//    and walk off carrying a carton; how many come follows the customers a
//    minute (fewer at night, more in summer and during the festival)
//  - the vet: now and then walks up from the dirt road to a ranch barn, has a
//    look at the animals (they cheer up: troughs topped up) and leaves
//  - the Pumpkin Weigh-off Festival: stalls, bunting and a crowd round the
//    pumpkin patch while it runs, a burst of confetti when it is judged
//  - the tutorial arrow (econ/tutorial.js): a bobbing arrow over where to go

const SHIRTS = ['#d63a2c', '#2f6fd0', '#3f9a3a', '#f2a03a', '#7a3fb0', '#e85aa0', '#2fa8a0', '#f4f1e8']
const rnd = (a, b) => a + Math.random() * (b - a)

export function buildLiving(root, { particles }) {
  // --- Stand visitors ---------------------------------------------------------------------------------
  const V = GAME.visitors
  const S = FARM.stand
  const pool = []
  for (let i = 0; i < V.max; i++) {
    const n = makeNPC({ shirt: SHIRTS[i % SHIRTS.length], pants: i % 2 ? '#3a3a44' : '#2c4f8e', hat: i % 3 === 0 ? 'cap' : i % 3 === 1 ? 'straw' : null, hatColor: SHIRTS[(i + 3) % SHIRTS.length] })
    const carton = box(n.armR, 0.5, 0.3, 0.36, M('#e8d6b0'), 0, -0.5, 0.32)
    carton.visible = false
    n.group.visible = false
    root.add(n.group)
    pool.push({ n, carton, w: null, state: 'off', t: 0 })
  }
  const queueSpot = (k) => [S.x + 2.6 - k * 1.3, S.z + 4.8 + k * 0.4]
  let spawnT = 2
  function spawn(v) {
    const fromWest = Math.random() < 0.5
    const sx = fromWest ? S.x - 40 : S.x + 40
    const sz = FARM.sidewalkN.minZ + 1.5
    v.n.group.visible = true
    v.carton.visible = false
    v.n.holds = false
    v.state = 'in'
    v.side = fromWest ? -1 : 1
    const k = pool.filter((p) => p.state === 'queue' || p.state === 'in').length
    const [qx, qz] = queueSpot(Math.min(4, k))
    v.w = makeWalker(v.n, [[sx, sz], [S.x + v.side * 6, sz], [qx, qz]], { speed: rnd(1.3, 1.8), pause: 0 })
    v.w.wait = 0
  }

  // --- The vet ---------------------------------------------------------------------------------------------
  const vet = makeNPC({ shirt: '#f4f6f8', pants: '#3a5f9a', hat: null, item: 'box' })
  vet.group.visible = false
  root.add(vet.group)
  const vs = { t: rnd(...V.vetEvery), w: null, r: null, stay: 0 }

  // --- Festival -----------------------------------------------------------------------------------------------
  const FE = FARM.festival
  const fest = new Group()
  fest.visible = false
  root.add(fest)
  const stallColors = ['#e23a35', '#2f6fd0', '#3f9a3a', '#f2a03a']
  stallColors.forEach((c, i) => {
    const s = festivalStall(c)
    const a = (i / stallColors.length) * Math.PI * 2 + 0.4
    s.g.position.set(FE.x + Math.cos(a) * 11, 0, FE.z + Math.sin(a) * 11)
    s.g.rotation.y = Math.atan2(FE.x - s.g.position.x, FE.z - s.g.position.z) + Math.PI
    fest.add(s.g)
  })
  for (const [x, z, ry] of [[FE.x - 9, FE.z - 9, 0], [FE.x - 9, FE.z + 9, 0]]) {
    const b = bunting(18, '#ffd23a')
    b.g.position.set(x, 0, z)
    b.g.rotation.y = ry
    fest.add(b.g)
  }
  const crowd = []
  for (let i = 0; i < 10; i++) {
    const n = makeNPC({ shirt: SHIRTS[(i + 2) % SHIRTS.length], pants: '#3a3a44', hat: i % 2 ? 'straw' : 'beanie', hatColor: SHIRTS[i % SHIRTS.length] })
    const a = (i / 10) * Math.PI * 2
    const r = 7.5 + (i % 3)
    n.group.position.set(FE.x + Math.cos(a) * r, 0, FE.z + Math.sin(a) * r)
    n.group.rotation.y = Math.atan2(FE.x - n.group.position.x, FE.z - n.group.position.z)
    fest.add(n.group)
    crowd.push(n)
  }
  game.on('festival', (on) => {
    if (on) particles?.confetti(FE.x, 3, FE.z, 60)
  })
  game.on('judged', () => {
    particles?.confetti(FE.x, 4, FE.z, 120)
    particles?.coins(FE.x, 3, FE.z, 30)
  })

  // --- Tutorial arrow -------------------------------------------------------------------------------------------
  const arrow = new Group()
  const glow = new MeshBasicMaterial({ color: '#ffd34a' })
  const head = new Mesh(new ConeGeometry(1.1, 1.8, 12), glow)
  head.rotation.x = Math.PI
  head.position.y = 0.9
  const shaft = new Mesh(new CylinderGeometry(0.4, 0.4, 1.8, 10), glow)
  shaft.position.y = 2.6
  const ring = new Mesh(new RingGeometry(1.6, 2.1, 32), new MeshBasicMaterial({ color: '#ffd34a', transparent: true, opacity: 0.7, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  arrow.add(head, shaft)
  arrow.visible = false
  ring.visible = false
  root.add(arrow, ring)

  // --- Trophy shelf on the cottage porch (achievements) ----------------------------------------------------
  const shelf = trophyShelf()
  shelf.g.position.set(FARM.trophies.x, 0, FARM.trophies.z)
  shelf.g.rotation.y = Math.PI // faces the road
  root.add(shelf.g)
  const paintTrophies = () => shelf.setTrophies(GAME.achievements.filter((a) => game.state.ach.includes(a.id)).slice(0, 12).map((a) => a.medal))
  paintTrophies()
  game.on('achievement', () => {
    paintTrophies()
    particles?.confetti(FARM.trophies.x, 2.5, FARM.trophies.z, 40)
  })
  game.on('reset', paintTrophies)
  game.on('prestige', paintTrophies)

  let customersShown = 0
  return {
    update(dt, t, rideables) {
      // Visitors: how many to have about, from the stand's real customer rate.
      const rate = game.state.stand.eggs > 0 ? game.state.customersPerMin * game.mods.customers() : 0
      const want = Math.min(V.max, Math.round(rate * V.perCustomer))
      customersShown = pool.filter((p) => p.state !== 'off').length
      spawnT -= dt
      if (spawnT <= 0 && customersShown < want) {
        const v = pool.find((p) => p.state === 'off')
        if (v) spawn(v)
        spawnT = rnd(2, 5)
      }
      for (const v of pool) {
        if (v.state === 'off') continue
        if (v.state === 'in' || v.state === 'out') {
          updateWalker(v.w, t, dt)
          if (v.carton.visible) {
            v.n.armR.rotation.x = -1.1
            v.n.armL.rotation.x = -1.1
          }
          const last = v.w.pts[v.w.pts.length - 1]
          const g = v.n.group.position
          if (Math.hypot(g.x - last[0], g.z - last[1]) < 0.15) {
            if (v.state === 'in') {
              v.state = 'queue'
              v.t = rnd(2.5, 5)
              v.n.group.rotation.y = Math.PI // face the counter (north)
            } else {
              v.state = 'off'
              v.n.group.visible = false
            }
          }
        } else if (v.state === 'queue') {
          idle(v.n, t, dt, 0.4)
          // An empty stand: they give up sooner and leave empty-handed.
          const stocked = game.state.stand.eggs > 0
          v.t -= stocked ? dt : dt * 3
          if (v.t <= 0) {
            v.state = 'out'
            v.carton.visible = stocked
            v.n.holds = stocked
            const g = v.n.group.position
            const away = v.side ?? 1
            v.w = makeWalker(v.n, [[g.x, g.z], [S.x - away * 7, FARM.sidewalkN.minZ + 1.5], [S.x - away * 45, FARM.sidewalkN.minZ + 1.5]], { speed: rnd(1.3, 1.7), pause: 0 })
            v.w.wait = 0
            if (stocked) particles?.burst(g.x, 1.4, g.z, { n: 6, colors: ['#ffd23a', '#fff3a0'], speed: 1, up: 2, gravity: -3, life: 0.6, size: 0.24 })
          }
        }
      }

      // The vet.
      if (!vs.w) {
        vs.t -= dt
        const barns = game.ranchBuilt().filter((r) => !r.plant)
        if (vs.t <= 0 && barns.length) {
          vs.r = barns[Math.floor(Math.random() * barns.length)]
          const [cx, cz] = FARM.ranchCrates[vs.r.id]
          vet.group.visible = true
          vs.w = makeWalker(vet, [[cx - 30, FARM.dirtRoad.minZ - 2], [cx, cz + 2], [cx + 1, cz - 1.5]], { speed: 1.6, pause: 0 })
          vs.w.wait = 0
          vs.stay = 0
          vs.phase = 'in'
          game.emit('toast', { text: `The vet is visiting the ${vs.r.name}`, kind: 'info' })
        }
      } else {
        const g = vet.group.position
        const last = vs.w.pts[vs.w.pts.length - 1]
        if (vs.phase !== 'stay') updateWalker(vs.w, t, dt)
        if (vs.phase === 'in' && Math.hypot(g.x - last[0], g.z - last[1]) < 0.15) {
          vs.phase = 'stay'
          vs.stay = 14
        } else if (vs.phase === 'stay') {
          idle(vet, t, dt, 1)
          vs.stay -= dt
          if (Math.random() < dt * 2) particles?.burst(g.x, 1.8, g.z, { n: 3, colors: ['#ff6a8a', '#ffb0c4'], speed: 0.6, up: 2, gravity: -1, life: 1, size: 0.3 })
          if (vs.stay <= 0) {
            const c = game.state.care[vs.r.id]
            if (c) {
              c.food = Math.max(c.food, 0.8)
              c.water = Math.max(c.water, 0.8)
            }
            game.emit('toast', { text: `The vet says the ${vs.r.plural ?? vs.r.animal + 's'} are in fine health!`, kind: 'good' })
            vs.phase = 'out'
            vs.w = makeWalker(vet, [[g.x, g.z], [g.x - 30, FARM.dirtRoad.minZ - 2], [g.x - 90, FARM.dirtRoad.minZ - 2]], { speed: 1.6, pause: 0 })
            vs.w.wait = 0
          }
        } else if (vs.phase === 'out' && Math.hypot(g.x - last[0], g.z - last[1]) < 0.15) {
          vet.group.visible = false
          vs.w = null
          vs.t = rnd(...V.vetEvery)
        }
      }

      // Festival.
      fest.visible = clock.festival
      if (fest.visible) crowd.forEach((n, i) => {
        idle(n, t, dt, 0.5)
        n.armL.rotation.x = -0.4 - Math.max(0, Math.sin(t * 3 + i)) * 1.6 // cheering
      })

      // Tutorial arrow.
      const tgt = stepTarget(rideables?.bike?.g.position)
      arrow.visible = ring.visible = !!tgt
      if (tgt) {
        arrow.position.set(tgt[0], 3.2 + Math.abs(Math.sin(t * 3)) * 0.9, tgt[1])
        arrow.rotation.y = t * 1.5
        ring.position.set(tgt[0], 0.08, tgt[1])
        const s = 1 + (t % 1.2) * 0.4
        ring.scale.set(s, s, s)
        ring.material.opacity = 0.7 * (1 - (t % 1.2) / 1.2)
      }
    },
  }
}
