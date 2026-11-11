import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import * as sfx from '../audio/sfx.js'
import { gated } from './kit.js'
import { carton, packer } from './models.js'
import { eggVan } from './vehicles.js'
import { updateRig } from './rig.js'
import { pallet } from './props.js'
import { idle, makeNPC } from './npc.js'

// Farm Shop Lv2: the carton packer beside the stand (eggs ride its conveyor
// into the packing box; every carton pops out onto the pallet by the road) and
// the egg van that comes along the road from town, stops at the stand, opens
// its back doors, takes the cartons (they hop across into it), pays, toots and
// drives off west.

const V = GAME.cartons.van
const ROAD_IN = FARM.road.z - 3 // the westbound lane
const STOP_X = FARM.cartonPallet.x - 1
const FROM_X = FARM.town.maxX + 20
const GONE_X = -460

function labelSprite() {
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 128
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(3.3, 1.1, 1)
  let last = ''
  s.userData.set = (line1, line2) => {
    const key = line1 + line2
    if (key === last) return
    last = key
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = 'rgba(40,24,10,0.78)'
    ctx.beginPath()
    ctx.roundRect(6, 6, 372, 116, 22)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 46px Fredoka, sans-serif'
    ctx.fillStyle = '#ffe9a0'
    ctx.fillText(line1, 192, 44, 360)
    ctx.font = '600 32px Fredoka, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line2, 192, 92, 360)
    t.needsUpdate = true
  }
  document.fonts?.ready?.then(() => (last = ''))
  return s
}

export function buildVan(root, { particles }) {
  // --- The packer and the pallet (bought as the Carton Packer) ---------------------------------------
  let pk = null
  const stack = []
  let tag = null
  gated(root, 'cartons', (G) => {
    pk = packer()
    pk.g.position.set(FARM.packer.x, 0, FARM.packer.z)
    G.add(pk.g)
    const P = FARM.cartonPallet
    const pg = new Group()
    pallet(pg, P.x, P.z, 0, 0)
    G.add(pg)
    // Up to GAME.cartons.max cartons: 4 x 2 per layer.
    for (let i = 0; i < GAME.cartons.max; i++) {
      const layer = Math.floor(i / 8)
      const j = i % 8
      const c = carton(G, P.x - 0.5 + (j % 2) * 0.66, 0.16 + layer * 0.24, P.z - 0.48 + Math.floor(j / 2) * 0.32)
      c.visible = false
      stack.push(c)
    }
    tag = labelSprite()
    tag.position.set(P.x, 2.6, P.z)
    G.add(tag)
  }, 3)
  // A packer operator once it is built.
  const op = makeNPC({ shirt: '#3f8a4a', pants: '#2c3e66', apron: '#f5efd6', hat: 'cap', hatColor: '#3f8a4a' })
  op.group.position.set(FARM.packer.x - 1.2, 0.04, FARM.packer.z + 1.5)
  op.group.rotation.y = Math.PI
  gated(root, 'cartons', (G) => G.add(op.group), 2)

  const showStack = () => stack.forEach((c, i) => (c.visible = i < game.state.cartons))
  showStack()
  game.on('carton', () => {
    showStack()
    const P = FARM.cartonPallet
    particles?.burst(P.x, 1.2, P.z, { n: 10, colors: ['#fff6c0', '#ffe36a'], speed: 1.5, up: 3, gravity: -3, life: 0.7, size: 0.3 })
    particles?.burst(FARM.packer.x + 2.8, 2.4, FARM.packer.z, { n: 8, colors: ['#3aff6a', '#ffffff'], speed: 1.2, up: 2, gravity: -2, life: 0.5, size: 0.25 })
    sfx.cartonThump(P.x, P.z)
    flashT = 0.4
  })
  game.on('reset', showStack)

  // --- The van -----------------------------------------------------------------------------------------
  const van = eggVan()
  van.g.visible = false
  root.add(van.g)
  const fly = Array.from({ length: V.load }, () => {
    const g = new Group()
    carton(g, 0, -0.1, 0)
    g.visible = false
    root.add(g)
    return { g, t: -1, from: [0, 0, 0], to: [0, 0, 0] }
  })
  const S = { phase: 'idle', t: V.every * 0.5, x: FROM_X, v: 0, n: 0, sent: 0, doorK: 0 }
  let flashT = 0

  function start() {
    S.phase = 'in'
    S.x = FROM_X
    S.v = 14
    van.g.visible = true
    van.g.position.set(S.x, 0.03, ROAD_IN)
    van.g.rotation.y = -Math.PI / 2 // heading west
    game.emit('van', { phase: 'coming' })
  }

  return {
    update(dt, t) {
      // Packer: eggs ride the belt while the stand has eggs to pack.
      if (pk && game.built('cartons')) {
        const running = game.state.stand.eggs >= GAME.cartons.eggs && game.state.cartons < GAME.cartons.max
        pk.eggs.forEach((e, i) => {
          const u = (t * (running ? 0.35 : 0) + i / pk.eggs.length) % 1
          e.position.x = -2 + u * 4.4
          e.visible = running && u < 0.95
        })
        flashT = Math.max(0, flashT - dt)
        pk.lamp.scale.setScalar(1 + flashT * 2)
        pk.leds.forEach((l, i) => (l.visible = running ? Math.floor(t * 3 + i) % 3 !== 0 : i === 0))
        idle(op, t, dt, 0.8)
        tag?.userData.set(`CARTONS ${game.state.cartons}/${GAME.cartons.max}`, S.phase === 'idle' ? `van in ${Math.max(0, Math.ceil(S.t))}s · ${game.fmtMoney(game.cartonPrice())} each` : 'the van is here!')
      }
      // The van's run.
      if (S.phase === 'idle') {
        if (!game.built('cartons')) return
        S.t -= dt
        if (S.t <= 0) {
          if (game.state.cartons > 0) start()
          else S.t = 6
        }
        sfx.vanEngine(0, 0, false, false)
        return
      }
      if (S.phase === 'in') {
        // Brake toward the stop.
        const left = S.x - STOP_X
        S.v = Math.max(1.2, Math.min(14, left * 0.6))
        S.x -= S.v * dt
        if (S.x <= STOP_X) {
          S.x = STOP_X
          S.phase = 'stop'
          S.t = 0
          S.n = game.state.cartons > 0 ? Math.min(game.state.cartons, V.load) : 0
          S.sent = 0
          sfx.doorSlam(S.x, ROAD_IN)
        }
      } else if (S.phase === 'stop') {
        S.t += dt
        S.doorK = Math.min(1, S.t / 0.6)
        // Cartons hop across from the pallet into the back, one by one.
        const P = FARM.cartonPallet
        while (S.sent < S.n && S.t > 0.7 + S.sent * 0.28) {
          const f = fly[S.sent]
          f.t = 0
          const top = stack[Math.max(0, game.state.cartons - 1 - S.sent)]?.position ?? { x: P.x, y: 0.3, z: P.z }
          f.from = [top.x, top.y + 0.2, top.z]
          f.to = [S.x + 2.9, 1.3, ROAD_IN + (Math.random() - 0.5) * 0.8]
          f.g.visible = true
          S.sent++
          sfx.cartonThump(P.x, P.z)
        }
        const loaded = 0.7 + S.n * 0.28 + 0.5
        if (S.t > loaded && !S.paid) {
          S.paid = true
          const n = game.vanArrived()
          showStack()
          if (n) {
            particles?.coins(S.x + 2, 3, ROAD_IN, 18)
            particles?.confetti(S.x + 2, 3.2, ROAD_IN, 24)
            sfx.till(S.x, ROAD_IN)
          }
        }
        if (S.t > Math.max(V.stop, loaded + 1.2)) {
          S.phase = 'out'
          S.paid = false
          S.v = 0
          sfx.doorSlam(S.x, ROAD_IN)
          sfx.horn(S.x, ROAD_IN)
        }
      } else if (S.phase === 'out') {
        S.doorK = Math.max(0, S.doorK - dt * 2)
        S.v = Math.min(16, S.v + dt * 5)
        S.x -= S.v * dt
        if (S.x < GONE_X) {
          S.phase = 'idle'
          S.t = V.every
          van.g.visible = false
          game.emit('van', { phase: 'gone' })
        }
      }
      van.g.position.x = S.x
      const moving = S.phase === 'in' || S.phase === 'out'
      updateRig(van.rig, dt, t, { particles })
      for (const d of van.doors) d.hinge.rotation.y = d.s * S.doorK * 1.9
      sfx.vanEngine(S.x, ROAD_IN, moving, true)
      // Flying cartons: a hop arc into the van.
      for (const f of fly) {
        if (f.t < 0) continue
        f.t += dt / 0.5
        const k = Math.min(1, f.t)
        f.g.position.set(f.from[0] + (f.to[0] - f.from[0]) * k, f.from[1] + (f.to[1] - f.from[1]) * k + Math.sin(k * Math.PI) * 2.2, f.from[2] + (f.to[2] - f.from[2]) * k)
        f.g.rotation.y = k * 3
        if (k >= 1) {
          f.t = -1
          f.g.visible = false
          particles?.burst(f.to[0], f.to[1], f.to[2], { n: 4, colors: ['#ffe36a'], speed: 1, up: 1.5, gravity: -3, life: 0.4, size: 0.2 })
        }
      }
      // Hide cartons from the pallet as they fly.
      if (S.phase === 'stop' && S.sent && !S.paid) stack.forEach((c, i) => (c.visible = i < game.state.cartons - S.sent))
    },
  }
}
