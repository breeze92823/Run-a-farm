import { Group } from 'three'
import { FARM } from '../config.js'
import { mulberry32 } from '../textures.js'
import { M, bakeInto, block, box, cyl, signCanvas, signMaterial, signPanel, solid, solidCyl, gated } from './kit.js'
import { awning, crate, flowerBox, lampPost, pumpkin, sack } from './props.js'
import { idle, makeNPC } from './npc.js'

// The seed market plaza: herringbone pavers with an iron lamp post at each
// corner (pumpkins and flowers at their feet), and the SEED MARKET stall: a
// wooden counter under a red/white awning, open sacks of seed in bright
// colours, produce baskets (corn, carrots, pumpkins), seed packets on a rack
// and potted seedlings, with a shopkeeper.

const P = FARM.plaza

function produceBasket(g, x, y, z, kind) {
  cyl(g, 0.34, 0.26, 0.3, M('#b9813f', { roughness: 0.95 }), x, y + 0.15, z, 12)
  if (kind === 'corn') {
    for (let i = 0; i < 4; i++) {
      const c = cyl(g, 0.07, 0.06, 0.42, M('#f2cf3a'), x - 0.15 + i * 0.1, y + 0.36, z, 8)
      c.rotation.z = 1.3 + i * 0.1
      const husk = box(g, 0.1, 0.02, 0.2, M('#8cc34a'), x - 0.15 + i * 0.1, y + 0.33, z + 0.05, 0, false)
      husk.rotation.x = 0.3
    }
  } else if (kind === 'carrot') {
    for (let i = 0; i < 6; i++) {
      const c = cyl(g, 0.05, 0.01, 0.34, M('#f27a1f'), x + Math.cos(i) * 0.14, y + 0.36, z + Math.sin(i) * 0.14, 6)
      c.rotation.z = Math.PI / 2 + (i - 3) * 0.2
      box(g, 0.04, 0.12, 0.04, M('#4c9a34'), x + Math.cos(i) * 0.14 + 0.17, y + 0.4, z + Math.sin(i) * 0.14, 0, false)
    }
  } else if (kind === 'apple') {
    for (let i = 0; i < 7; i++) cyl(g, 0.08, 0.08, 0.13, M(i % 3 ? '#d63a2c' : '#8cc34a', { roughness: 0.4 }), x + Math.cos(i * 0.9) * (i ? 0.17 : 0), y + 0.34, z + Math.sin(i * 0.9) * (i ? 0.17 : 0), 10)
  }
}

function seedStall(root) {
  const { x, z } = FARM.seedStall
  const g = new Group()
  const wood = M('#a8693a')
  const woodDark = M('#6e4122')
  const top = M('#c99a5e')
  const W = 5.6
  // Counter (front faces south, toward the plaza).
  block(g, W, 1.0, 1.0, wood, 0, 0, 0.6)
  for (let i = 0; i < 14; i++) block(g, 0.03, 0.96, 0.02, woodDark, -W / 2 + 0.2 + i * 0.4, 0.02, 1.11, 0, false)
  block(g, W + 0.2, 0.1, 1.2, top, 0, 1.0, 0.6)
  for (const sx of [-1, 1]) {
    block(g, 0.16, 3.0, 0.16, woodDark, sx * (W / 2 - 0.1), 0, 1.1)
    block(g, 0.16, 3.4, 0.16, woodDark, sx * (W / 2 - 0.1), 0, -1.2)
  }
  block(g, W, 2.4, 0.1, woodDark, 0, 0, -1.25)
  const aw = awning(W + 0.6, 2.9, 3.5, 2.85)
  aw.position.set(0, 0, 0.1)
  g.add(aw)
  // Signboard on top: SEED MARKET / buy and unlock seeds.
  const p = signCanvas(768, 200, {
    bg: '#7a4a26',
    plank: 2,
    border: '#4e2c14',
    borderWidth: 12,
    radius: 12,
    lines: [
      { text: 'SEED MARKET', size: 92, color: '#fff3d6', stroke: '#3e2210', strokeWidth: 10 },
      { text: 'buy and unlock seeds', size: 42, color: '#ffe0a8', weight: 600 },
    ],
  })
  box(g, 4.3, 1.15, 0.14, M('#7a4a26'), 0, 4.15, -1.2)
  signPanel(g, 4.25, 1.1, signMaterial(p), 0, 4.15, -1.12)
  for (const s of [-1, 1]) block(g, 0.12, 0.8, 0.12, woodDark, s * 1.8, 3.4, -1.2)
  // Seed sacks along the counter top front and bins.
  const seedColors = ['#e2b24a', '#8bc34a', '#e8732a', '#c86b3a', '#f5e08a', '#9b6b3a']
  for (let i = 0; i < 6; i++) {
    const s = sack(g, -2.3 + i * 0.92, 0.65, '#cfae7a', seedColors[i], (i - 3) * 0.1)
    s.position.y = 1.05
    s.scale.setScalar(0.62)
  }
  // Shelf behind with seed packets (little coloured cards) and potted seedlings.
  block(g, W - 0.4, 0.08, 0.5, top, 0, 1.5, -0.95)
  block(g, W - 0.4, 0.08, 0.5, top, 0, 2.2, -0.95)
  const packet = ['#e8732a', '#8bc34a', '#f2cf3a', '#d63a2c', '#7e57c2', '#29b6f6']
  for (let i = 0; i < 14; i++) {
    const c = block(g, 0.22, 0.32, 0.03, M(packet[i % packet.length]), -2.4 + i * 0.37, 1.56, -0.9, 0, false)
    c.rotation.x = -0.15
  }
  for (let i = 0; i < 8; i++) {
    const px = -2.2 + i * 0.62
    cyl(g, 0.14, 0.11, 0.22, M('#b65a32'), px, 2.35, -0.95, 10)
    cyl(g, 0.12, 0.12, 0.02, M('#4b3222'), px, 2.46, -0.95, 10)
    for (let k = 0; k < 3; k++) box(g, 0.12, 0.02, 0.05, M('#5fb84a'), px, 2.52 + k * 0.03, -0.95, k * 1.1, false)
  }
  // Produce baskets and crates either side of the counter.
  produceBasket(g, -W / 2 - 0.6, 0, 1.0, 'corn')
  produceBasket(g, -W / 2 - 0.7, 0, 1.9, 'apple')
  produceBasket(g, W / 2 + 0.6, 0, 1.0, 'carrot')
  crate(g, W / 2 + 0.8, 0, 2.0, 0.9, 0.2)
  pumpkin(g, W / 2 + 0.8, 2.0, 0.3, '#ee7a1f', 0.63)
  pumpkin(g, -W / 2 - 0.4, 2.8, 0.38)
  g.position.set(x, 0.04, z)
  bakeInto(root, g)
  solid(W / 2 + 0.1, 0.55, 0.6, x, 0.55, z + 0.6)
  solid(W / 2, 1.2, 0.3, x, 1.2, z - 1.15)
  // The "E OPEN SEED MARKET" prompt is the HUD's (hud.js), so it also works by tap.
}

export function buildMarket(root, { addLamp }) {
  const rand = mulberry32(6161)
  gated(root, 'seedMarket', (G) => seedStall(G), 5)
  // The plaza's dressing (lamp posts, pumpkins, flower boxes, shrubs, benches) is bought with the
  // Seed Market too: until then the plaza is lawn.
  gated(root, 'seedMarket', (G) => {
    const g = new Group()
    // Lamp posts at the four plaza corners, lit at night.
    const corners = [
      [P.minX + 2, P.maxZ - 2],
      [P.maxX - 2, P.maxZ - 2],
      [P.minX + 2, P.minZ + 6],
      [P.maxX - 2, P.minZ + 6],
    ]
    for (const [x, z] of corners) {
      const [bx, by, bz] = lampPost(g, x, z, 3.8)
      addLamp(bx, by, bz)
      solidCyl(0.2, 3.8, x, z)
      pumpkin(g, x + 0.6, z + 0.4, 0.32)
      pumpkin(g, x - 0.5, z + 0.6, 0.24, '#f6b13b')
      flowerBox(g, x, z - 1.1, 1.2, 0, rand)
    }
    // Potted shrubs along the field side.
    for (let z = P.minZ + 4; z < P.maxZ - 3; z += 6) {
      cyl(g, 0.4, 0.3, 0.55, M('#b65a32'), P.minX + 0.6, 0.3, z, 12)
      const bush = cyl(g, 0.45, 0.5, 0.6, M('#4f9a3a', { flatShading: true }), P.minX + 0.6, 0.9, z, 7)
      bush.scale.set(1, 1.1, 1)
    }
    // Benches facing the plaza centre.
    for (const [x, z, ry] of [[P.maxX - 1.2, -46, -Math.PI / 2], [P.maxX - 1.2, -34, -Math.PI / 2]]) {
      const b = new Group()
      b.position.set(x, 0.04, z)
      b.rotation.y = ry
      block(b, 2.2, 0.1, 0.6, M('#b67a42'), 0, 0.45, 0)
      block(b, 2.2, 0.5, 0.08, M('#b67a42'), 0, 0.6, -0.28)
      for (const s of [-0.9, 0.9]) block(b, 0.1, 0.45, 0.55, M('#2f2f33', { metalness: 0.4 }), s, 0, 0)
      g.add(b)
      solid(0.4, 0.5, 1.1, x, 0.5, z)
    }
    bakeInto(G, g)
  }, 4.5)
  // A sandwich-board pointing to the barn: it stands once the Storage Barn does.
  gated(root, 'storage', (G) => {
    const g = new Group()
    const arrow = signCanvas(320, 120, { bg: '#2f5d3a', border: '#f5efd6', borderWidth: 6, radius: 10, lines: [{ text: 'STORAGE ➜', size: 54, color: '#f5efd6' }] })
    block(g, 0.1, 1.4, 0.1, M('#6e4122'), P.maxX + 1.5, 0, -30)
    box(g, 1.4, 0.52, 0.08, M('#2f5d3a'), P.maxX + 1.5, 1.5, -30)
    signPanel(g, 1.38, 0.5, signMaterial(arrow), P.maxX + 1.5, 1.5, -29.95)
    bakeInto(G, g)
  }, 2)

  // The shopkeeper.
  const keeper = makeNPC({ shirt: '#5fae4a', pants: '#5b4636', apron: '#e9d8b4', hat: 'straw', hair: '#3a2416', skin: '#e6b48c' })
  const { x, z } = FARM.seedStall
  keeper.group.position.set(x + 0.8, 0.04, z - 0.4)
  gated(root, 'seedMarket', (G) => G.add(keeper.group), 3)
  return {
    stall: FARM.seedStall,
    update(dt, t) {
      idle(keeper, t, dt, 0.7)
      keeper.group.position.x = x + 0.8 + Math.sin(t * 0.25) * 1.2
    },
  }
}
