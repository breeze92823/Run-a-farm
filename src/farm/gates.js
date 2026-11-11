import { Box3, Vector3 } from 'three'
import { GAME } from '../config.js'
import * as game from '../game.js'
import * as sfx from '../audio/sfx.js'
import { gateRegistry } from './kit.js'
import { compact } from './detail.js'

// Buildings the player buys (GAME.buildings): a build pad for each one whose
// requirements stand, and the building itself (every group registered with
// kit.js `gated`, its ground, paths and fences included) hidden with its colliders
// off until it is bought, so the land under it is plain lawn. A bought
// building rises out of the ground with a bounce, rolling a ring of dust,
// throwing confetti and playing the build fanfare.

const RISE = 1.5 // s
const easeOutBack = (x) => {
  const c1 = 1.5
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export function buildGates(root, { pads, particles }) {
  // Merge each bought-later building's meshes per material (its moving and
  // switchable parts are their own groups or are flagged noCompact).
  for (const entries of gateRegistry.values()) for (const e of entries) compact(e.group)
  const list = GAME.buildings.map((b) => ({
    b,
    pad: pads.add({ x: b.x, z: b.z, kind: b.kind, name: b.name, perk: b.perk, price: b.price, buy: () => game.buyBuilding(b) }),
  }))
  const rising = new Map() // id -> { t, entries, centre, size, dustT }
  // A gate id is a building id (or field1), `plot:N` (field N owned), `pad:<name>` (that decor
  // pad bought, FARM.pads), or `any:a,b,...` for ground shared by several.
  const owned = (id) => (id.startsWith('plot:') ? game.state.plots.owned.includes(Number(id.slice(5))) : id.startsWith('pad:') ? game.padBought(id.slice(4)) : game.built(id))
  const isOn = (id) => (id.startsWith('any:') ? id.slice(4).split(',').some(owned) : owned(id))
  const shown = new Set()

  function apply(id, on) {
    for (const e of gateRegistry.get(id) ?? []) {
      e.group.visible = on
      e.group.position.y = 0
      for (const c of e.colliders) c.setEnabled(on)
    }
  }
  // Shows / hides every gate to match what is owned; with `animate`, newly bought ones rise.
  function sync(animate) {
    for (const id of gateRegistry.keys()) {
      const on = isOn(id)
      if (on === shown.has(id)) continue
      if (on) shown.add(id)
      else shown.delete(id)
      if (on && animate) rise(id)
      else {
        rising.delete(id)
        apply(id, on)
      }
    }
  }
  function refresh() {
    for (const { b, pad } of list) {
      const show = game.buildingReady(b)
      pad.setVisible(show)
      if (!show) continue
      pad.red = game.state.money < pad.price
      pad.repaint()
    }
  }
  for (const id of gateRegistry.keys()) apply(id, false) // all hidden, then show what is owned
  sync(false)
  refresh()

  const box = new Box3()
  const size = new Vector3()
  const centre = new Vector3()
  function rise(id) {
    const entries = gateRegistry.get(id)
    if (!entries?.length) return
    box.makeEmpty()
    for (const e of entries) {
      e.group.visible = true
      e.group.position.y = 0
      box.expandByObject(e.group)
    }
    box.getSize(size)
    box.getCenter(centre)
    const h = Math.max(...entries.map((e) => e.height))
    for (const e of entries) e.group.position.y = -h - 0.5
    // Shared ground (any:) rises with the building that brought it: one fanfare, one shower.
    const shared = id.startsWith('any:')
    rising.set(id, { t: 0, entries, h, x: centre.x, z: centre.z, r: Math.max(2, Math.min(14, Math.max(size.x, size.z) * 0.55)), dustT: 0, done: false, shared })
    if (shared) return
    sfx.build(centre.x, centre.z)
    particles?.ring(centre.x, centre.z, Math.max(2, Math.min(14, Math.max(size.x, size.z) * 0.5)), '#c9a57a', 42)
  }

  game.on('build', () => {
    sync(true)
    refresh()
  })
  game.on('pad', () => sync(true))
  game.on('plot', ({ why } = {}) => {
    sync(why === 'buy')
    refresh()
  })
  game.on('reset', () => {
    for (const id of rising.keys()) apply(id, isOn(id))
    rising.clear()
    sync(false)
    refresh()
  })

  let moneyT = 0
  return {
    update(dt) {
      // Pads go red / green as the money crosses their price.
      moneyT -= dt
      if (moneyT <= 0) {
        moneyT = 0.5
        for (const { pad } of list) {
          if (!pad.disc.visible) continue
          const red = game.state.money < pad.price
          if (red !== pad.red) {
            pad.red = red
            pad.repaint()
          }
        }
      }
      for (const [id, r] of rising) {
        r.t += dt
        const k = Math.min(1, r.t / RISE)
        const y = (easeOutBack(k) - 1) * (r.h + 0.5)
        for (const e of r.entries) e.group.position.y = y
        // Dust keeps billowing while it rises; a shower of confetti as it lands.
        r.dustT -= dt
        if (k < 0.85 && r.dustT <= 0 && !r.shared) {
          r.dustT = 0.12
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2
            particles?.dust(r.x + Math.cos(a) * r.r, r.z + Math.sin(a) * r.r, '#c9a57a', 3)
          }
        }
        if (k >= 1) {
          rising.delete(id)
          apply(id, true)
          if (!r.shared) particles?.confetti(r.x, Math.min(8, r.h) + 1, r.z, 70)
        }
      }
    },
  }
}
