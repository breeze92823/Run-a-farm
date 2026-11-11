import { BufferGeometry, CanvasTexture, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, LatheGeometry, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Vector2 } from 'three'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { mulberry32 } from '../textures.js'
import { E, M, bakeInto, block, box, captureColliders, cyl, gated, signCanvas, signMaterial, signPanel, solid, solidCyl } from './kit.js'
import { rbox } from './detail.js'
import * as sfx from '../audio/sfx.js'
import { fence } from './fence.js'
import { makeNPC, idle, makeWalker, updateWalker } from './npc.js'
import { awning, crate, flowerBox, makeStringLights, pallet, pumpkin } from './props.js'

// The egg farm stand on its paver plaza by the road: a wooden counter under a
// big red/white striped awning (FARM STAND) and a smaller one (BUY THE DOZEN),
// trays and cartons of eggs, baskets, a cash register and scale, crates of
// eggs, a chalkboard price sign, fairy lights strung to corner poles, flower
// boxes and pumpkins, a seller, a queue of customers, and the red FRESH EGGS
// billboard out by the road.

const P = FARM.standPlaza
const STAND = GAME.shop.find((i) => i.id === 'stand')
// A bunting pennant: a triangle hanging from its top edge.
const flagGeo = new BufferGeometry()
flagGeo.setAttribute('position', new Float32BufferAttribute([-0.14, 0, 0, 0.14, 0, 0, 0, -0.32, 0], 3))
flagGeo.computeVertexNormals()

// --- Stand eggs ----------------------------------------------------------------------------------
// The trays, cartons, baskets and the egg tower are baked empty; each egg spot
// is an `eggSlot` marker that `stage()` collects into one InstancedMesh per
// stand piece, so the stand fills up (and empties) with its real stock.
function eggSlot(parent, x, y, z, brown, r) {
  const o = new Object3D()
  o.position.set(x, y, z)
  o.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25)
  o.scale.set(r, r * 1.28, r)
  o.userData.eggSlot = brown ? 1 : 0
  parent.add(o)
}
let eggGeo = null
// A unit egg (radius 1, a little narrower at the top).
function eggGeometry() {
  if (eggGeo) return eggGeo
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI
    const y = -Math.cos(a)
    pts.push(new Vector2(Math.max(0.001, Math.sin(a) * (1 - 0.16 * y)), y))
  }
  eggGeo = new LatheGeometry(pts, 10)
  return eggGeo
}
const eggMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.38 })
const EGG_WHITE = new Color('#fff7e8')
const EGG_BROWN = new Color('#e3b98a')

function eggTray(g, x, y, z, cols = 4, rows = 3, ry = 0) {
  const t = new Group()
  t.position.set(x, y, z)
  t.rotation.y = ry
  block(t, cols * 0.2 + 0.08, 0.06, rows * 0.2 + 0.08, M('#d9c49b', { roughness: 1 }), 0, 0, 0)
  // The moulded cups the eggs sit in.
  const cup = M('#cdb68a', { roughness: 1 })
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = (i - (cols - 1) / 2) * 0.2
      const cz = (j - (rows - 1) / 2) * 0.2
      cyl(t, 0.085, 0.06, 0.05, cup, cx, 0.085, cz, 8, false)
      eggSlot(t, cx, 0.17, cz, (i + j) % 4 === 0, 0.072)
    }
  }
  g.add(t)
}

function carton(g, x, y, z, ry = 0) {
  const t = new Group()
  t.position.set(x, y, z)
  t.rotation.y = ry
  block(t, 0.62, 0.12, 0.28, M('#9fb7c9', { roughness: 1 }), 0, 0, 0)
  const lid = block(t, 0.62, 0.04, 0.28, M('#9fb7c9', { roughness: 1 }), 0, 0.12, -0.24)
  lid.rotation.x = -1.1
  for (let i = 0; i < 6; i++) eggSlot(t, (i % 3 - 1) * 0.19, 0.17, (Math.floor(i / 3) - 0.5) * 0.12, false, 0.058)
  g.add(t)
}

function basket(g, x, y, z, eggs = true) {
  cyl(g, 0.3, 0.22, 0.28, M('#b9813f', { roughness: 0.95 }), x, y + 0.14, z, 12)
  cyl(g, 0.31, 0.31, 0.04, M('#8d5a2b'), x, y + 0.28, z, 12)
  // A straw lining, seen when the basket is empty.
  cyl(g, 0.27, 0.27, 0.02, M('#d8b55e', { roughness: 1 }), x, y + 0.24, z, 12, false)
  if (eggs) for (let i = 0; i < 7; i++) eggSlot(g, x + Math.cos(i * 0.9) * (i ? 0.15 : 0), y + 0.33, z + Math.sin(i * 0.9) * (i ? 0.15 : 0), i % 3 === 0, 0.068)
  const handle = cyl(g, 0.24, 0.24, 0.03, M('#8d5a2b'), x, y + 0.3, z, 12)
  handle.rotation.x = Math.PI / 2
  handle.scale.set(1, 1, 0.12)
}

// --- The stall, built up level by level ------------------------------------------------------
// Bigger Stand level 0 is a small egg table with a hand-painted board and an
// honesty box; every level adds the next piece (GAME.shop `stand` stages):
// 1 the wooden counter, 2 the striped awning, 3 back shelves, 4 the register,
// scale, chalkboard and crates, 5 the BUY THE DOZEN stall, 6 a glass-door egg
// cooler, 7 the rooftop FRESH EGGS sign, 8 bunting, lanterns and an egg tower.
// Stage 0 shows only at level 0; stage k shows from level k on. Each stage is
// one baked group with its own colliders, so an upgrade can raise it.
const W = 6.2
const D = 2.6

function stage(root, build, height) {
  const group = new Group()
  root.add(group)
  const sx = FARM.stand.x
  const sz = FARM.stand.z
  const slots = []
  const colliders = captureColliders(() => {
    const g = new Group()
    build(g, (hx, hy, hz, x, y, z) => solid(hx, hy, hz, sx + x, y, sz + z), (r, h, x, z) => solidCyl(r, h, sx + x, sz + z))
    g.position.set(sx, 0.04, sz)
    // Pull the egg spots out before baking (their matrices are in the stage group's frame).
    g.updateMatrixWorld(true)
    const marks = []
    g.traverse((o) => o.userData.eggSlot !== undefined && marks.push(o))
    for (const o of marks) {
      slots.push({ m: o.matrixWorld.clone(), brown: o.userData.eggSlot })
      o.removeFromParent()
    }
    bakeInto(group, g)
  })
  let eggs = null
  if (slots.length) {
    eggs = new InstancedMesh(eggGeometry(), eggMat, slots.length)
    slots.forEach((s, i) => {
      eggs.setMatrixAt(i, s.m)
      eggs.setColorAt(i, s.brown ? EGG_BROWN : EGG_WHITE)
    })
    eggs.count = 0
    eggs.receiveShadow = true
    eggs.frustumCulled = false // small, and the instances sit far from the geometry's own bounds
    group.add(eggs)
  }
  return { group, colliders, height, eggs, slots: slots.length }
}

function stallStages(root) {
  const wood = M('#a8693a')
  const woodDark = M('#7b4a26')
  const top = M('#c99a5e')
  const S = []
  // 0: the egg table.
  S.push(
    stage(root, (g, box3) => {
      const t = new Group()
      t.position.set(0, 0, 0.85)
      for (let i = 0; i < 4; i++) block(t, 1.9, 0.05, 0.19, i % 2 ? top : M('#b88a52'), 0, 0.8, -0.3 + i * 0.2)
      for (const s of [-1, 1]) {
        for (const r of [-1, 1]) {
          const leg = box(t, 0.07, 0.9, 0.07, woodDark, s * 0.75, 0.4, r * 0.05)
          leg.rotation.x = r * 0.42
        }
        block(t, 0.06, 0.06, 0.6, woodDark, s * 0.75, 0.3, 0)
      }
      g.add(t)
      eggTray(g, -0.45, 0.85, 0.85, 4, 3)
      basket(g, 0.45, 0.85, 0.8)
      // Honesty box with a coin slot, and a jar of coins.
      const hb = new Group()
      hb.position.set(0.8, 0.85, 1.05)
      block(hb, 0.3, 0.22, 0.22, M('#6e3a18'), 0, 0, 0)
      block(hb, 0.14, 0.01, 0.03, M('#1b1b1b'), 0, 0.22, 0)
      g.add(hb)
      cyl(g, 0.08, 0.08, 0.16, M('#cfe6ee', { roughness: 0.1, transparent: true, opacity: 0.6 }), -0.85, 0.93, 1.05, 12)
      cyl(g, 0.07, 0.07, 0.06, M('#e2b24a', { metalness: 0.7, roughness: 0.3 }), -0.85, 0.88, 1.05, 12)
      crate(g, -0.35, 0, 0.75, 0.7, 0.1)
      // Hand-painted board on a stake.
      const bd = signCanvas(320, 200, {
        bg: '#d9b98a',
        plank: 2,
        border: '#7b4a26',
        borderWidth: 10,
        radius: 8,
        lines: [
          { text: 'FRESH', size: 64, color: '#b0301f' },
          { text: 'EGGS', size: 76, color: '#5a2a10' },
        ],
      })
      const stake = new Group()
      stake.position.set(1.7, 0, 1.9)
      stake.rotation.y = -0.35
      block(stake, 0.08, 1.4, 0.08, woodDark, 0, 0, 0)
      box(stake, 0.92, 0.6, 0.06, M('#7b4a26'), 0, 1.25, 0.05)
      signPanel(stake, 0.86, 0.54, signMaterial(bd), 0, 1.25, 0.085)
      g.add(stake)
      box3(0.95, 0.45, 0.4, 0, 0.45, 0.85)
    }, 1.6),
  )
  // 1: the wooden counter, the FARM STAND board and the RESTOCK board.
  S.push(
    stage(root, (g, box3) => {
      block(g, W, 1.0, 0.9, wood, 0, 0, 0.85)
      for (let i = 0; i < 16; i++) block(g, 0.03, 0.96, 0.02, woodDark, -W / 2 + 0.2 + i * 0.39, 0.02, 1.31, 0, false)
      block(g, W + 0.2, 0.1, 1.1, top, 0, 1.0, 0.85)
      const fs = signCanvas(768, 160, { bg: '#7a2f20', border: '#e9c48c', borderWidth: 10, radius: 12, lines: [{ text: 'FARM STAND', size: 104, color: '#ffd58a', stroke: '#4a1a10', strokeWidth: 12 }] })
      signPanel(g, 3.4, 0.7, signMaterial(fs), 0.6, 0.55, 1.33)
      eggTray(g, -2.3, 1.05, 0.85, 4, 3)
      eggTray(g, -1.2, 1.05, 0.85, 4, 3, 0.1)
      carton(g, -0.2, 1.05, 0.95, -0.2)
      carton(g, 0.5, 1.05, 0.8, 0.15)
      basket(g, 1.4, 1.05, 0.85)
      const rs = signCanvas(640, 200, {
        bg: '#8a3a22',
        plank: 2,
        border: '#5a2412',
        borderWidth: 12,
        radius: 10,
        lines: [
          { text: 'RESTOCK', size: 100, color: '#ffd27a', stroke: '#4a1a0a', strokeWidth: 10 },
          { text: 'stand items with your eggs', size: 40, color: '#ffe8c2', weight: 600 },
        ],
      })
      const restock = new Group()
      restock.position.set(-9.6, 0, 3.2)
      restock.rotation.y = 0.35
      const board = box(restock, 3.0, 0.95, 0.1, M('#8a3a22'), 0, 0.62, 0)
      board.rotation.x = -0.35
      const face = signPanel(restock, 2.95, 0.92, signMaterial(rs), 0, 0.63, 0.06)
      face.rotation.x = -0.35
      for (const s of [-1.2, 1.2]) block(restock, 0.1, 0.7, 0.1, M('#5a2412'), s, 0, -0.25)
      g.add(restock)
      box3(W / 2 + 0.1, 0.55, 0.5, 0, 0.55, 0.85)
    }, 1.4),
  )
  // 2: posts and the striped awning.
  S.push(
    stage(root, (g, box3, cyl3) => {
      for (const s of [-1, 1]) {
        block(g, 0.16, 3.0, 0.16, woodDark, s * (W / 2 - 0.1), 0, 1.3)
        block(g, 0.16, 3.4, 0.16, woodDark, s * (W / 2 - 0.1), 0, -1.3)
      }
      const aw = awning(W + 0.7, D + 1.3, 3.55, 2.85)
      aw.position.set(0, 0, 0.35)
      g.add(aw)
      for (const s of [-1, 1]) cyl3(0.12, 3, s * (W / 2 - 0.1), 1.3)
    }, 4),
  )
  // 3: back wall and shelves of trays and cartons.
  S.push(
    stage(root, (g, box3) => {
      block(g, W, 0.08, 0.7, top, 0, 1.2, -0.95)
      block(g, W, 0.08, 0.7, top, 0, 1.85, -0.95)
      block(g, W, 2.2, 0.08, woodDark, 0, 0, -1.3)
      for (const s of [-1, 1]) block(g, 0.08, 1.95, 0.7, woodDark, s * (W / 2 - 0.05), 0, -0.95)
      for (let i = 0; i < 5; i++) eggTray(g, -2.5 + i * 1.25, 1.24, -0.95, 4, 2)
      for (let i = 0; i < 4; i++) carton(g, -2.2 + i * 1.5, 1.89, -0.95, (i - 1.5) * 0.1)
      box3(W / 2, 1.1, 0.4, 0, 1.1, -1.0)
    }, 2.4),
  )
  // 4: cash register, scale, the chalkboard and crates of eggs.
  S.push(
    stage(root, (g, box3) => {
      block(g, 0.6, 0.32, 0.45, M('#545a63', { roughness: 0.4, metalness: 0.3 }), 2.35, 1.05, 0.75)
      const disp = block(g, 0.4, 0.2, 0.06, M('#2b2f36'), 2.35, 1.4, 0.6)
      disp.rotation.x = -0.3
      block(g, 0.34, 0.12, 0.03, E('#8af0a0', 1.4), 2.35, 1.43, 0.64, 0, false)
      block(g, 0.5, 0.06, 0.12, M('#3b3f46'), 2.35, 1.1, 1.0)
      cyl(g, 0.22, 0.25, 0.12, M('#cfd5db', { metalness: 0.6, roughness: 0.3 }), 1.85, 1.11, 1.12, 14)
      crate(g, -W / 2 - 0.8, 0, 0.6, 1, 0.1)
      crate(g, -W / 2 - 0.8, 0.7, 0.6, 1, -0.15)
      crate(g, -W / 2 - 0.9, 0, 1.6, 1, 0.3)
      eggTray(g, -W / 2 - 0.9, 0.7, 1.6, 4, 3, 0.3)
      const cb = signCanvas(256, 300, {
        bg: '#2d3a33',
        border: '#8a5a2b',
        borderWidth: 16,
        lines: [
          { text: 'EGGS', size: 72, color: '#ffffff', family: 'Fredoka' },
          { text: 'FRESH', size: 70, color: '#ffe680' },
          { text: 'daily', size: 44, color: '#e8e8e8', weight: 600 },
        ],
      })
      const board = new Group()
      board.position.set(3.9, 0, 2.2)
      board.rotation.y = -0.4
      const front = block(board, 0.8, 1.05, 0.06, M('#8a5a2b'), 0, 0, 0.18)
      front.rotation.x = -0.2
      signPanel(board, 0.72, 0.92, signMaterial(cb), 0, 0.57, 0.33).rotation.x = -0.2
      const back = block(board, 0.8, 1.05, 0.06, M('#8a5a2b'), 0, 0, -0.18)
      back.rotation.x = 0.2
      g.add(board)
      box3(0.5, 0.7, 0.9, -W / 2 - 0.85, 0.7, 1.1)
    }, 1.6),
  )
  // 5: the smaller second stall to the west: BUY THE DOZEN.
  S.push(
    stage(root, (g, box3) => {
      const s2 = new Group()
      s2.position.set(-W / 2 - 3.0, 0, 0.3)
      block(s2, 3.4, 0.9, 0.8, wood, 0, 0, 0.6)
      block(s2, 3.6, 0.08, 1.0, top, 0, 0.9, 0.6)
      for (const sx of [-1, 1]) {
        block(s2, 0.14, 2.6, 0.14, woodDark, sx * 1.6, 0, 1.0)
        block(s2, 0.14, 2.9, 0.14, woodDark, sx * 1.6, 0, -0.6)
      }
      const aw2 = awning(3.9, 2.3, 3.0, 2.45)
      aw2.position.set(0, 0, 0.25)
      s2.add(aw2)
      const bd = signCanvas(512, 110, { bg: '#7a2f20', border: '#e9c48c', borderWidth: 8, radius: 10, lines: [{ text: 'BUY THE DOZEN', size: 64, color: '#ffd58a' }] })
      signPanel(s2, 2.6, 0.55, signMaterial(bd), 0, 0.48, 1.01)
      eggTray(s2, -0.9, 0.95, 0.6, 4, 3)
      eggTray(s2, 0.1, 0.95, 0.6, 4, 3, -0.1)
      basket(s2, 1.05, 0.95, 0.6)
      g.add(s2)
      box3(1.7, 0.5, 0.5, -W / 2 - 3.0, 0.5, 0.9)
    }, 3.2),
  )
  // 6: a glass-door egg cooler by the east end, lit inside.
  S.push(
    stage(root, (g, box3) => {
      const c = new Group()
      c.position.set(4.05, 0, -0.55)
      c.rotation.y = -0.25
      const white = M('#eef2f4', { roughness: 0.35, metalness: 0.2 })
      rbox(c, 1.1, 2.0, 0.8, 0.05, white, 0, 1.0, 0)
      box(c, 0.92, 1.5, 0.02, E('#e8f6ff', 0.9), 0, 1.0, 0.36, 0, false) // lit back of the cabinet
      for (let i = 0; i < 3; i++) {
        box(c, 0.9, 0.03, 0.6, M('#c9d3da', { metalness: 0.5, roughness: 0.3 }), 0, 0.45 + i * 0.48, 0.05)
        for (let j = 0; j < 2; j++) carton(c, -0.22 + j * 0.44, 0.47 + i * 0.48, 0.05, 0.05 * (j ? 1 : -1))
      }
      box(c, 0.94, 1.6, 0.02, M('#bfe6ff', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28 }), 0, 1.0, 0.41, 0, false)
      for (const s of [-1, 1]) box(c, 0.05, 1.62, 0.05, M('#9aa3ab', { metalness: 0.6, roughness: 0.3 }), s * 0.47, 1.0, 0.41)
      box(c, 0.05, 0.5, 0.05, M('#9aa3ab', { metalness: 0.6, roughness: 0.3 }), 0.38, 1.0, 0.45)
      const top2 = signCanvas(256, 64, { bg: '#2f6fd0', radius: 8, lines: [{ text: 'COLD EGGS', size: 40, color: '#ffffff' }] })
      signPanel(c, 0.95, 0.24, signMaterial(top2), 0, 1.86, 0.41)
      g.add(c)
      box3(0.6, 1.0, 0.45, 4.05, 1.0, -0.55)
    }, 2.2),
  )
  // 7: the rooftop FRESH EGGS sign with a giant egg and marquee bulbs.
  S.push(
    stage(root, (g) => {
      for (const s of [-1.6, 1.6]) block(g, 0.12, 1.4, 0.12, woodDark, s, 3.45, -1.25)
      const sign = signCanvas(768, 200, { bg: '#c8302a', border: '#ffe2a0', borderWidth: 14, radius: 18, lines: [{ text: 'FRESH EGGS', size: 120, color: '#fff3d6', stroke: '#6a1410', strokeWidth: 12 }] })
      rbox(g, 3.9, 1.05, 0.16, 0.06, M('#7a2a1e'), 0, 4.55, -1.25)
      signPanel(g, 3.75, 0.95, signMaterial(sign), 0, 4.55, -1.16)
      const bulb = E('#ffe9a8', 2.6)
      for (let i = 0; i <= 12; i++) {
        cyl(g, 0.05, 0.05, 0.04, bulb, -1.85 + i * 0.31, 5.1, -1.15, 8, false).rotation.x = Math.PI / 2
        cyl(g, 0.05, 0.05, 0.04, bulb, -1.85 + i * 0.31, 4.0, -1.15, 8, false).rotation.x = Math.PI / 2
      }
      // The giant egg on the sign's east end, in a little nest.
      const egg = new Mesh(new SphereGeometry(0.55, 24, 18), M('#fff4e2', { roughness: 0.35 }))
      egg.scale.set(1, 1.3, 1)
      egg.position.set(2.45, 5.25, -1.25)
      egg.castShadow = true
      g.add(egg)
      const nest = cyl(g, 0.6, 0.45, 0.25, M('#c9a24a', { roughness: 1 }), 2.45, 4.6, -1.25, 16)
      nest.castShadow = true
      block(g, 0.1, 1.3, 0.1, woodDark, 2.45, 3.3, -1.25)
    }, 6),
  )
  // 8: bunting under the awning, two hanging lanterns and a tiered egg tower.
  S.push(
    stage(root, (g, box3, cyl3) => {
      const colors = ['#e23a35', '#ffd23f', '#2f8fd0', '#3fae48', '#ffffff']
      for (let i = 0; i < 14; i++) {
        const f = new Mesh(flagGeo, M(colors[i % colors.length], { roughness: 0.8, side: DoubleSide }))
        const t = i / 13
        f.position.set(-W / 2 - 0.2 + t * (W + 0.4), 2.62 - Math.sin(t * Math.PI) * 0.25, 2.05)
        g.add(f)
      }
      for (const s of [-1, 1]) {
        block(g, 0.02, 0.3, 0.02, M('#2a2a2e'), s * 1.8, 2.36, 1.95)
        cyl(g, 0.05, 0.15, 0.08, M('#2a2a2e', { metalness: 0.5 }), s * 1.8, 2.33, 1.95, 10)
        cyl(g, 0.1, 0.1, 0.22, E('#ffd27a', 2.4), s * 1.8, 2.18, 1.95, 10, false)
        cyl(g, 0.12, 0.08, 0.05, M('#2a2a2e', { metalness: 0.5 }), s * 1.8, 2.05, 1.95, 10)
      }
      // Egg tower: three round tiers ringed with eggs.
      const tw = new Group()
      tw.position.set(-2.3, 0, 2.6)
      cyl(tw, 0.06, 0.06, 1.7, woodDark, 0, 0.85, 0, 8)
      ;[0.75, 0.55, 0.35].forEach((r, k) => {
        const y = 0.45 + k * 0.5
        cyl(tw, r, r, 0.05, top, 0, y, 0, 20)
        const n = Math.round(r * 18)
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          eggSlot(tw, Math.cos(a) * (r - 0.1), y + 0.11, Math.sin(a) * (r - 0.1), i % 3 === 0, 0.066)
        }
      })
      const crown = cyl(tw, 0.1, 0.1, 0.16, M('#ffd23f', { metalness: 0.7, roughness: 0.25 }), 0, 1.78, 0, 10)
      crown.scale.set(1, 1.25, 1)
      g.add(tw)
      cyl3(0.75, 1.8, -2.3, 2.6)
    }, 2.4),
  )
  return S
}

// --- The plaza decorations (bought: GAME.buildings decor*) -------------------------------------------
function plaza(root, rand) {
  const sx = FARM.stand.x
  const sz = FARM.stand.z
  // Flower boxes and pumpkins.
  gated(root, 'decorFlowers', (gate) => {
    const g = new Group()
    flowerBox(g, P.minX + 4, P.maxZ - 0.6, 2.4, 0, rand)
    flowerBox(g, P.maxX - 4, P.maxZ - 0.6, 2.4, 0, rand)
    flowerBox(g, -7.5, 21, 2.2, 0.1, rand)
    pumpkin(g, sx + 4.6, sz + 0.6, 0.42)
    pumpkin(g, sx + 5.3, sz + 1.2, 0.3, '#f39a2e')
    pumpkin(g, sx - 9.2, sz + 2.1, 0.38)
    pumpkin(g, P.minX + 2.2, P.maxZ - 2.4, 0.34, '#e46c1a')
    pumpkin(g, -6.2, 23, 0.45)
    pumpkin(g, -6.9, 24.1, 0.28, '#f6b13b')
    bakeInto(gate, g)
  }, 1)
  // Corner poles and fairy lights strung around the plaza.
  gated(root, 'decorLights', (gate) => {
    const g = new Group()
    const pole = M('#6e4122')
    const poles = [
      [P.minX + 1, P.maxZ - 1.5],
      [P.maxX - 1, P.maxZ - 1.5],
      [P.minX + 1, P.minZ + 1.2],
      [P.maxX - 1, P.minZ + 1.2],
    ]
    for (const [x, z] of poles) {
      block(g, 0.2, 4.3, 0.2, pole, x, 0, z)
      block(g, 0.5, 0.2, 0.5, M('#5a3018'), x, 0, z)
      block(g, 0.5, 0.06, 0.06, M('#5a3018'), x, 4.1, z)
      solidCyl(0.2, 4.3, x, z)
    }
    bakeInto(gate, g)
    const lights = makeStringLights()
    const at = (i) => [poles[i][0], 4.2, poles[i][1]]
    lights.add(at(0), at(1), 1.1)
    lights.add(at(2), at(3), 1.1)
    lights.add(at(0), at(2), 0.9)
    lights.add(at(1), at(3), 0.9)
    // Two strings across the front of the plaza, low over the queue.
    const mast = [sx - 3.5, P.maxZ - 3.5]
    lights.add(at(0), [mast[0], 3.4, mast[1]], 0.6)
    lights.add([mast[0], 3.4, mast[1]], at(1), 0.8)
    block(gate, 0.14, 3.5, 0.14, pole, mast[0], 0, mast[1])
    solidCyl(0.12, 3.5, mast[0], mast[1])
    lights.build(gate)
  }, 4.5)
  // The waiting bench, a parasol table and pallets.
  gated(root, 'decorBench', (gate) => {
    const g = new Group()
    const bench = new Group()
    bench.position.set(P.minX + 3, 0.04, 26)
    bench.rotation.y = Math.PI / 2
    block(bench, 2.2, 0.1, 0.6, M('#b67a42'), 0, 0.45, 0)
    block(bench, 2.2, 0.5, 0.08, M('#b67a42'), 0, 0.6, -0.28)
    for (const s of [-0.9, 0.9]) block(bench, 0.1, 0.45, 0.55, M('#2f2f33', { metalness: 0.4 }), s, 0, 0)
    g.add(bench)
    const tb = new Group()
    tb.position.set(-10, 0.04, 23.8)
    cyl(tb, 0.6, 0.6, 0.06, M('#f2efe6', { roughness: 0.5 }), 0, 0.75, 0, 20)
    cyl(tb, 0.05, 0.05, 2.5, M('#9aa3ab', { metalness: 0.6 }), 0, 1.25, 0, 8)
    cyl(tb, 0.35, 0.4, 0.05, M('#5e6168'), 0, 0.03, 0, 16)
    const umb = new Mesh(new ConeGeometry(1.5, 0.55, 8, 1, true), M('#e23a35', { roughness: 0.7, side: DoubleSide }))
    umb.position.set(0, 2.45, 0)
    umb.castShadow = true
    tb.add(umb)
    const umb2 = new Mesh(new ConeGeometry(1.52, 0.56, 8, 1, true, Math.PI / 8, Math.PI / 4), M('#fbf6ee', { roughness: 0.7, side: DoubleSide }))
    umb2.position.set(0, 2.452, 0)
    for (let i = 0; i < 4; i++) {
      const u = umb2.clone()
      u.rotation.y = (i * Math.PI) / 2
      tb.add(u)
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4
      const st = new Group()
      st.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95)
      cyl(st, 0.22, 0.22, 0.06, M('#b67a42'), 0, 0.46, 0, 12)
      for (let k = 0; k < 3; k++) {
        const l = box(st, 0.04, 0.46, 0.04, M('#2f2f33'), Math.cos(k * 2.1) * 0.14, 0.22, Math.sin(k * 2.1) * 0.14)
        l.rotation.set(Math.sin(k * 2.1) * 0.15, 0, -Math.cos(k * 2.1) * 0.15)
      }
      tb.add(st)
    }
    g.add(tb)
    pallet(g, sx + 1.5, sz + 6.5, 0.05, 0.04)
    pallet(g, sx + 1.5, sz + 6.5, 0.05, 0.18)
    bakeInto(gate, g)
    solid(0.4, 0.5, 1.1, P.minX + 3, 0.5, 26)
    solidCyl(0.62, 0.8, -10, 23.8)
  }, 2.6)
}

// --- Road billboard -------------------------------------------------------------------------
function billboard(gate) {
  const { x, z } = FARM.billboard
  const g = new Group()
  const post = M('#6e4122')
  for (const s of [-3.2, 3.2]) block(g, 0.3, 4.6, 0.3, post, s, 0, 0)
  box(g, 8.2, 2.6, 0.24, M('#5a2a1a'), 0, 3.0, 0)
  const p = signCanvas(1024, 330, {
    bg: '#c8302a',
    border: '#f5dfb8',
    borderWidth: 18,
    radius: 22,
    lines: [
      { text: 'FRESH EGGS', size: 150, color: '#fff3d6', stroke: '#7a1a14', strokeWidth: 14 },
      { text: 'FARM STAND ➜', size: 76, color: '#ffd27a' },
    ],
  })
  signPanel(g, 7.9, 2.45, signMaterial(p), 0, 3.0, 0.125)
  box(g, 8.4, 0.18, 0.5, M('#7a3a22'), 0, 4.38, 0)
  // Two small spotlights aiming at the face.
  for (const s of [-2.2, 2.2]) {
    box(g, 0.08, 0.08, 0.7, M('#2a2a2e'), s, 4.4, 0.45)
    box(g, 0.24, 0.18, 0.24, M('#2a2a2e'), s, 4.4, 0.8)
    box(g, 0.18, 0.04, 0.18, E('#fff2c8', 2), s, 4.3, 0.8, 0, false)
  }
  g.position.set(x, 0, z)
  g.rotation.y = 0.12
  bakeInto(gate, g)
  solid(3.6, 0.6, 0.3, x, 0.6, z, 0.12)
}

// The floating FARM STAND card: eggs on the stand, the price customers pay,
// customers a minute, and the green EGG PRICE + button (the Shop's Egg Price
// upgrade) that a click or tap on the card buys. Drawn in 360x165 card units at
// 2x; `hitButton(uv)` says whether a raycast hit (sprite uv) is on the button.
const CARD = { w: 360, h: 165, k: 2 }
const BTN = { x: 80, y: 104, w: 200, h: 52 }
const PRICE_ITEM = GAME.shop.find((s) => s.id === 'price')

function standCard(x, y, z) {
  const c = document.createElement('canvas')
  c.width = CARD.w * CARD.k
  c.height = CARD.h * CARD.k
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(6.2, (6.2 * CARD.h) / CARD.w, 1)
  s.position.set(x, y, z)
  let hover = false
  let pressT = 0
  let last = ''

  const round = (ctx, rx, ry, w, h, r) => {
    ctx.beginPath()
    ctx.roundRect(rx, ry, w, h, r)
  }
  const text = (ctx, str, tx, ty, size, fill, { weight = 700, stroke, sw = 0, align = 'center', max } = {}) => {
    ctx.font = `${weight} ${size}px Fredoka, "Arial Black", sans-serif`
    ctx.textAlign = align
    if (stroke) {
      ctx.lineWidth = sw
      ctx.strokeStyle = stroke
      ctx.strokeText(str, tx, ty, max)
    }
    ctx.fillStyle = fill
    ctx.fillText(str, tx, ty, max)
  }

  function draw(force = false) {
    const st = game.state
    const level = game.upgradeLevel(PRICE_ITEM.id)
    const maxed = level >= PRICE_ITEM.max
    const cost = game.upgradePrice(PRICE_ITEM)
    const afford = st.money >= cost
    const each = game.eggSalePrice()
    const pressed = pressT > 0
    const key = `${st.stand.eggs}|${st.stand.max}|${each}|${st.customersPerMin}|${cost}|${maxed}|${afford}|${hover}|${pressed}`
    if (key === last && !force) return
    last = key
    const ctx = c.getContext('2d')
    ctx.setTransform(CARD.k, 0, 0, CARD.k, 0, 0)
    ctx.clearRect(0, 0, CARD.w, CARD.h)
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    // Card body and the FARM STAND tab.
    ctx.fillStyle = 'rgba(255,248,232,0.97)'
    ctx.strokeStyle = '#c99a5e'
    ctx.lineWidth = 4
    round(ctx, 4, 24, 352, 137, 14)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#c9843e'
    ctx.strokeStyle = '#8a5527'
    ctx.lineWidth = 3
    round(ctx, 92, 4, 176, 36, 8)
    ctx.fill()
    ctx.stroke()
    text(ctx, 'FARM STAND', 180, 23, 24, '#fff3d6', { stroke: '#6b3a16', sw: 5 })
    // Eggs on the stand and the price customers pay.
    text(ctx, '🥚', 30, 62, 22, '#000', { align: 'center' })
    text(ctx, `${st.stand.eggs}/${st.stand.max}`, 46, 63, 26, '#5a3b1e', { align: 'left' })
    ctx.fillStyle = '#ffc93a'
    ctx.strokeStyle = '#c98a12'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(192, 62, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    text(ctx, '$', 192, 63, 16, '#b0700a')
    text(ctx, `${game.fmtMoney(each)} each`, 210, 63, 26, '#3f9a2c', { align: 'left', max: 140 })
    text(ctx, `${st.customersPerMin} customers a minute`, 180, 89, 16, '#b48a62', { weight: 600 })
    // The EGG PRICE + button.
    const lift = pressed ? 2 : 0
    const bx = BTN.x
    const by = BTN.y + lift
    const top = maxed ? '#b9b9b9' : !afford ? '#f2c14a' : hover ? '#8ff06a' : '#6fdc4a'
    const bot = maxed ? '#8a8a8a' : !afford ? '#d8962a' : hover ? '#45b52e' : '#3a9e26'
    const edge = maxed ? '#5e5e5e' : !afford ? '#9a6414' : '#24711a'
    ctx.fillStyle = edge
    round(ctx, bx, by + 4 - lift, BTN.w, BTN.h, 10)
    ctx.fill()
    const g = ctx.createLinearGradient(0, by, 0, by + BTN.h)
    g.addColorStop(0, top)
    g.addColorStop(1, bot)
    ctx.fillStyle = g
    round(ctx, bx, by, BTN.w, BTN.h - 2, 10)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    round(ctx, bx + 6, by + 3, BTN.w - 12, 12, 6)
    ctx.fill()
    const ink = maxed ? '#4a4a4a' : !afford ? '#7a4a08' : '#1f5a14'
    if (maxed) text(ctx, 'EGG PRICE MAXED', 180, by + 24, 20, '#ffffff', { stroke: ink, sw: 5 })
    else {
      text(ctx, 'EGG PRICE +', 180, by + 16, 18, '#ffffff', { stroke: ink, sw: 5 })
      text(ctx, game.fmtMoney(cost), 180, by + 36, 17, '#ffffff', { stroke: ink, sw: 5 })
    }
    t.needsUpdate = true
  }

  draw(true)
  document.fonts?.ready?.then(() => draw(true))
  game.on('change', () => draw())
  game.on('reset', () => draw(true))

  return {
    sprite: s,
    // uv from a raycast hit on the sprite (0,0 = bottom left).
    hitButton(uv) {
      if (!uv) return false
      const px = uv.x * CARD.w
      const py = (1 - uv.y) * CARD.h
      return px >= BTN.x && px <= BTN.x + BTN.w && py >= BTN.y && py <= BTN.y + BTN.h + 4
    },
    setHover(on) {
      if (hover === on) return
      hover = on
      draw()
    },
    // Buys the next Egg Price level; the press dips the button for a moment.
    press() {
      pressT = 0.14
      draw()
      return game.buyUpgrade(PRICE_ITEM)
    },
    update(dt) {
      if (pressT <= 0) return
      pressT -= dt
      if (pressT <= 0) draw()
    },
  }
}

const RISE = 1.1 // s for a new stand piece to rise into place
const easeOutBack = (x) => 1 + 2.5 * Math.pow(x - 1, 3) + 1.5 * Math.pow(x - 1, 2)
const PAD_AT = { x: FARM.stand.x + 6.5, z: FARM.stand.z + 4.5 } // the stand's UPGRADE pad

export function buildFarmStand(root, { addLamp }) {
  const rand = mulberry32(7171)
  const stages = stallStages(root)
  plaza(root, rand)
  gated(root, 'decorBillboard', (gate) => billboard(gate), 5)
  const card = standCard(FARM.stand.x + 5.5, 5.2, FARM.stand.z + 1)
  root.add(card.sprite)
  addLamp(FARM.stand.x, 2.6, FARM.stand.z + 2.4)
  const billLamp = addLamp(FARM.billboard.x, 4.1, FARM.billboard.z + 1.4)

  // A low fence along the plaza's west edge (the yard fence closes the north).
  fence([[P.minX, P.minZ], [P.minX, P.maxZ - 4]], 'wood')

  // People: the seller behind the counter (from the wooden counter on) and a
  // passer-by on the sidewalk. The customers are the stand visitors in
  // living.js, who only come while the stand has eggs.
  const sx = FARM.stand.x
  const sz = FARM.stand.z
  const seller = makeNPC({ shirt: '#f2efe6', pants: '#3a3f55', apron: '#c8302a', hat: 'cap', hatColor: '#c8302a', hair: '#6b3b1d' })
  seller.group.position.set(sx - 0.6, 0.04, sz - 0.2)
  const passer = makeNPC({ shirt: '#e2763a', pants: '#3c4a6a', hat: 'cap', hatColor: '#3a6ad8' })
  root.add(seller.group, passer.group)
  const walkers = [makeWalker(passer, [[-80, 38.6], [30, 38.6], [70, 38.6]], { speed: 1.6, pause: 6, y: FARM.curbHeight, pingPong: true })]
  seller.group.rotation.y = 0

  // --- Stand level: which pieces stand, and the rise of a new one ------------------------------
  const shows = (k, lv) => (k === 0 ? lv === 0 : lv >= k)
  const rising = [] // { st, t }
  let particles = null
  let pad = null
  function apply(lv) {
    rising.length = 0
    stages.forEach((st, k) => {
      const on = shows(k, lv)
      st.group.visible = on
      st.group.position.y = 0
      for (const c of st.colliders) c.setEnabled(on)
    })
    seller.group.visible = lv >= 1
    if (billLamp) billLamp.visible = game.built('decorBillboard')
    refreshPad()
  }
  function refreshPad() {
    if (!pad) return
    const lv = game.upgradeLevel('stand')
    const maxed = lv >= STAND.max
    pad.setVisible(!maxed)
    if (maxed) return
    pad.kind = `FARM STAND LV ${lv + 2}`
    pad.name = STAND.stages[lv + 1]
    pad.perk = `Holds ${STAND.caps[lv + 1]} eggs`
    pad.price = game.upgradePrice(STAND)
    pad.u = { perk: `${STAND.stages[lv + 1]}: holds ${STAND.caps[lv + 1]} eggs` }
    pad.red = game.state.money < pad.price
    pad.repaint()
  }
  // A Bigger Stand level: the old table sinks away in a puff, the new piece rises with dust and confetti.
  function upgraded(lv) {
    const st = stages[lv]
    if (!st) return apply(lv)
    for (const [k, s] of stages.entries()) {
      if (k === lv) continue
      const on = shows(k, lv)
      if (s.group.visible && !on) for (let i = 0; i < 8; i++) particles?.puff(sx + (Math.random() - 0.5) * 2, 0.6, sz + 0.9, { color: '#c9a57a', size: 0.5, grow: 4, life: 1.2, vy: 1.2, a: 0.4 })
      s.group.visible = on
      for (const c of s.colliders) c.setEnabled(on)
    }
    st.group.visible = true
    st.group.position.y = -st.height - 0.3
    for (const c of st.colliders) c.setEnabled(true)
    rising.push({ st, t: 0 })
    seller.group.visible = lv >= 1
    sfx.build(sx, sz)
    particles?.ring(sx, sz + 0.5, 4.2, '#c9a57a', 32)
    refreshPad()
  }
  game.on('upgrade', (item) => item.id === 'stand' && upgraded(game.upgradeLevel('stand')))
  game.on('reset', () => apply(game.upgradeLevel('stand')))
  game.on('build', (b) => b.id === 'decorBillboard' && billLamp && (billLamp.visible = true))
  apply(game.upgradeLevel('stand'))

  // The eggs on show follow the stand's stock: empty trays at 0, every spot filled when full.
  // Spots fill piece by piece in build order (the front counter first).
  let eggKey = ''
  function fillEggs() {
    const st = game.state.stand
    const key = `${st.eggs}|${st.max}|${stages.map((s) => (s.group.visible ? 1 : 0)).join('')}`
    if (key === eggKey) return
    eggKey = key
    const shown = stages.filter((s) => s.eggs && s.group.visible)
    const total = shown.reduce((a, s) => a + s.slots, 0)
    let n = st.eggs > 0 ? Math.max(1, Math.round((Math.min(st.eggs, st.max) / Math.max(1, st.max)) * total)) : 0
    for (const s of stages) {
      if (!s.eggs) continue
      const k = s.group.visible ? Math.min(n, s.slots) : 0
      s.eggs.count = k
      n -= k
    }
  }
  fillEggs()

  let padT = 0
  return {
    customers: [sx, sz + 3],
    card,
    // Called once the pads and particles exist (farm/index.js).
    attach({ pads, particles: p }) {
      particles = p
      pad = pads.add({ x: PAD_AT.x, z: PAD_AT.z, kind: 'FARM STAND', name: '', perk: '', price: 0, buy: () => game.buyUpgrade(STAND) })
      refreshPad()
    },
    update(dt, t) {
      fillEggs()
      card.update(dt)
      card.sprite.position.y = 5.2 + Math.sin(t * 1.2) * 0.05
      if (seller.group.visible) {
        idle(seller, t * 1.2, dt, 0.9)
        // The seller sways side to side between the trays.
        seller.group.position.x = sx - 0.6 + Math.sin(t * 0.3) * 1.4
      }
      for (const w of walkers) updateWalker(w, t, dt)
      for (let i = rising.length - 1; i >= 0; i--) {
        const r = rising[i]
        r.t += dt
        const k = Math.min(1, r.t / RISE)
        r.st.group.position.y = (easeOutBack(k) - 1) * (r.st.height + 0.3)
        if (k < 0.8 && Math.random() < dt * 20) particles?.dust(sx + (Math.random() - 0.5) * 7, sz + (Math.random() - 0.3) * 3, '#c9a57a', 3)
        if (k >= 1) {
          r.st.group.position.y = 0
          rising.splice(i, 1)
          particles?.confetti(sx, Math.min(6, r.st.height) + 1, sz + 0.5, 60)
        }
      }
      // The upgrade pad goes red / green as the money crosses its price.
      padT -= dt
      if (pad && padT <= 0) {
        padT = 0.5
        const red = game.state.money < pad.price
        if (pad.disc.visible && red !== pad.red) {
          pad.red = red
          pad.repaint()
        }
      }
    },
  }
}
