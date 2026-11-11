// The item in the player's hands (game.js `hand`): a small model per good or
// seed pack, carried in front of the chest between the avatar's hands. The
// animator raises the arms into a carry pose while something is held
// (`animator.update(..., { carry })`); this module places the model at the
// midpoint of the two hands each frame, so it follows any rig and emote.
import { Group, Vector3 } from 'three'
import { GAME } from './config.js'
import { M, box, cyl } from './farm/kit.js'

// The hand end of each arm bone, in the bone's own (rig unit) space: the arm
// box is 2.4 long and hangs 0.4 behind the shoulder pivot (avatar/character.js).
const HAND = new Vector3(0, -2.25, -0.4)
const ZERO = new Vector3()
const tmpL = new Vector3()
const tmpR = new Vector3()

const egg = (g, x, y, z, color, r = 0.032) => cyl(g, r, r, r * 2.4, M(color, { roughness: 0.35 }), x, y, z, 8, false)

// Models, sized in metres, resting on y = 0 (the hands), facing +Z (forward).
const MODELS = {
  basket(eggColor) {
    const g = new Group()
    cyl(g, 0.15, 0.11, 0.12, M('#b9813f', { roughness: 0.95 }), 0, 0.06, 0, 12)
    cyl(g, 0.155, 0.155, 0.02, M('#8d5a2b'), 0, 0.12, 0, 12)
    cyl(g, 0.13, 0.13, 0.01, M('#d8b55e', { roughness: 1 }), 0, 0.11, 0, 12, false)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      egg(g, Math.cos(a) * (i ? 0.07 : 0), 0.15, Math.sin(a) * (i ? 0.07 : 0), eggColor)
    }
    const handle = cyl(g, 0.13, 0.13, 0.015, M('#8d5a2b'), 0, 0.12, 0, 14)
    handle.rotation.x = Math.PI / 2
    handle.scale.set(1, 1, 0.12)
    return g
  },
  wheat() {
    // A sheaf: a bundle of stalks tied with twine, golden ears on top.
    const g = new Group()
    const stalk = M('#d9b04a', { roughness: 0.9 })
    const ear = M('#e8c25a', { roughness: 0.8 })
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const r = i ? 0.035 : 0
      const s = cyl(g, 0.008, 0.008, 0.5, stalk, Math.cos(a) * r, 0.2, Math.sin(a) * r, 5, false)
      s.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12)
      const e = cyl(g, 0.018, 0.012, 0.09, ear, Math.cos(a) * r * 3.2, 0.47, Math.sin(a) * r * 3.2, 6, false)
      e.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3)
    }
    cyl(g, 0.05, 0.05, 0.03, M('#8a5a2b'), 0, 0.18, 0, 10, false)
    g.rotation.x = -0.5 // leaning against the chest
    return g
  },
  corn() {
    const g = new Group()
    for (let i = 0; i < 3; i++) {
      const c = new Group()
      c.position.set((i - 1) * 0.07, 0.04 + (i === 1 ? 0.03 : 0), 0)
      c.rotation.set(Math.PI / 2, (i - 1) * 0.2, 0)
      cyl(c, 0.035, 0.028, 0.22, M('#f4d03a', { roughness: 0.6 }), 0, 0, 0, 8, false)
      for (const s of [-1, 1]) {
        const leaf = box(c, 0.05, 0.2, 0.01, M('#7fae3a', { roughness: 0.9 }), s * 0.03, -0.04, 0, 0, false)
        leaf.rotation.z = s * 0.25
      }
      g.add(c)
    }
    return g
  },
  carrot() {
    const g = new Group()
    for (let i = 0; i < 4; i++) {
      const c = new Group()
      c.position.set((i - 1.5) * 0.045, 0.05, 0)
      c.rotation.set(Math.PI / 2 - 0.2, 0, (i - 1.5) * 0.15)
      cyl(c, 0.025, 0.004, 0.18, M('#f08a24', { roughness: 0.7 }), 0, 0, 0, 7, false)
      for (const s of [-1, 0, 1]) {
        const leaf = cyl(c, 0.004, 0.004, 0.12, M('#5f9a2e'), s * 0.01, -0.14, 0, 4, false)
        leaf.rotation.z = s * 0.35
      }
      g.add(c)
    }
    return g
  },
  sunflower() {
    const g = new Group()
    const head = new Group()
    head.position.set(0, 0.2, 0.02)
    head.rotation.x = Math.PI / 2 - 0.35
    cyl(head, 0.09, 0.09, 0.03, M('#5a3a1a', { roughness: 1 }), 0, 0, 0, 14, false)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const p = box(head, 0.05, 0.012, 0.03, M('#f7c948'), Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, 0, false)
      p.rotation.y = -a
    }
    g.add(head)
    cyl(g, 0.01, 0.01, 0.28, M('#5f9a2e'), 0, 0.06, 0, 5, false)
    return g
  },
  pumpkin() {
    const g = new Group()
    cyl(g, 0.17, 0.17, 0.2, M("#ee7a1f", { roughness: 0.7 }), 0, 0.11, 0, 12)
    for (let i = 0; i < 6; i++) {
      const r = box(g, 0.025, 0.21, 0.36, M('#d8641a', { roughness: 0.7 }), 0, 0.11, 0, (i / 6) * Math.PI, false)
      r.scale.set(1, 1, 0.98)
    }
    cyl(g, 0.02, 0.025, 0.07, M('#5a7a2a'), 0, 0.24, 0, 6, false)
    return g
  },
  bottle(color) {
    const g = new Group()
    cyl(g, 0.055, 0.055, 0.2, M(color, { roughness: 0.3 }), 0, 0.1, 0, 12)
    cyl(g, 0.03, 0.05, 0.05, M(color, { roughness: 0.3 }), 0, 0.225, 0, 10, false)
    cyl(g, 0.032, 0.032, 0.025, M('#3a7ad8'), 0, 0.26, 0, 10, false)
    return g
  },
  fruit(color) {
    // A small crate of round fruit.
    const g = new Group()
    box(g, 0.3, 0.1, 0.22, M('#b98a52', { roughness: 0.95 }), 0, 0.05, 0)
    for (let i = 0; i < 6; i++) {
      const f = cyl(g, 0.04, 0.04, 0.07, M(color, { roughness: 0.5 }), ((i % 3) - 1) * 0.09, 0.12, (Math.floor(i / 3) - 0.5) * 0.09, 10, false)
      f.scale.set(1, 1, 1)
    }
    return g
  },
  crate(color) {
    // Anything else: a little wooden crate with the good's colour on top.
    const g = new Group()
    box(g, 0.3, 0.18, 0.22, M('#b98a52', { roughness: 0.95 }), 0, 0.09, 0)
    box(g, 0.26, 0.03, 0.18, M(color, { roughness: 0.6 }), 0, 0.185, 0, 0, false)
    return g
  },
  seeds(color) {
    // A seed packet with a picture band of the crop's colour.
    const g = new Group()
    box(g, 0.16, 0.22, 0.03, M('#f4ead2', { roughness: 0.9 }), 0, 0.11, 0)
    box(g, 0.14, 0.09, 0.005, M(color, { roughness: 0.7 }), 0, 0.12, 0.017, 0, false)
    box(g, 0.14, 0.025, 0.005, M('#3f7a2a'), 0, 0.2, 0.017, 0, false)
    g.rotation.x = -0.35
    return g
  },
}

const SEED_COLOR = { wheat: '#e8c25a', corn: '#f4d03a', carrot: '#f08a24', sunflower: '#f7c948', pumpkin: '#ee7a1f', potato: '#c9a16a' }

function modelFor(kind, id) {
  if (kind === 'seed') return MODELS.seeds(SEED_COLOR[id] ?? '#8fbf4a')
  const color = GAME.goods[id]?.color ?? '#c9a16a'
  switch (id) {
    case 'egg':
      return MODELS.basket('#fff7e8')
    case 'duckEgg':
      return MODELS.basket('#cfe6d8')
    case 'goldenEgg':
      return MODELS.basket('#ffd23a')
    case 'wheat':
      return MODELS.wheat()
    case 'corn':
      return MODELS.corn()
    case 'carrot':
      return MODELS.carrot()
    case 'sunflower':
      return MODELS.sunflower()
    case 'pumpkin':
      return MODELS.pumpkin()
    case 'milk':
    case 'goatMilk':
    case 'juice':
      return MODELS.bottle(color)
    case 'apple':
    case 'tomato':
      return MODELS.fruit(color)
    default:
      return MODELS.crate(color)
  }
}

export function createHeld(parent) {
  const cache = new Map()
  let current = null
  let currentKey = ''
  let rigOf = undefined
  let hands = []
  return {
    // Places the held model between the hands; `item` is game.js `hand`, `show` false hides it (riding, first person).
    update(avatar, item, show) {
      const key = item.kind ? `${item.kind}:${item.id}` : ''
      if (key !== currentKey) {
        currentKey = key
        if (current) current.visible = false
        current = null
        if (key) {
          if (!cache.has(key)) {
            const g = new Group()
            g.add(modelFor(item.kind, item.id))
            g.scale.setScalar(1.6) // the blocky avatar's hands are big: real-size goods read too small
            g.traverse((o) => o.isMesh && (o.castShadow = true))
            parent.add(g)
            cache.set(key, g)
          }
          current = cache.get(key)
        }
      }
      if (!current) return
      if (avatar !== rigOf) {
        // player.glb ends each arm in an `ArmX2_leaf` bone at the hand; the procedural rig has only ArmX1.
        rigOf = avatar
        const leafL = avatar?.getObjectByName('ArmL2_leaf')
        const leafR = avatar?.getObjectByName('ArmR2_leaf')
        hands = leafL && leafR ? [leafL, leafR, ZERO] : [avatar?.getObjectByName('ArmL1'), avatar?.getObjectByName('ArmR1'), HAND]
      }
      if (!show || !hands[0] || !hands[1]) {
        current.visible = false
        return
      }
      current.visible = true
      parent.updateMatrixWorld(true) // this frame's pose, not last frame's
      hands[0].localToWorld(tmpL.copy(hands[2]))
      hands[1].localToWorld(tmpR.copy(hands[2]))
      tmpL.add(tmpR).multiplyScalar(0.5)
      parent.worldToLocal(tmpL)
      current.position.set(0, tmpL.y - 0.05, tmpL.z + 0.02)
    },
  }
}
