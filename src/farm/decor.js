import { Group, IcosahedronGeometry, Mesh } from 'three'
import { mulberry32 } from '../textures.js'
import { E, M, bakeInto, block, box, cyl, gated, solidCyl, solidRect } from './kit.js'
import { lanternPost } from './chickens.js'

// What the DECOR pads (FARM.pads) build: each one is a gate `pad:<name>` (farm/gates.js), plain
// lawn until it is bought, then it rises out of the ground like a building. The pads stand
// beside their pieces, never inside a collider, so the player is never caught in one.
//  - Fountain: a two-tier stone fountain on the seed market plaza
//  - Blossom Trees: a row of pink blossom trees on the grass strip between Field 1 and the plaza
//  - Flower Garden: raised flower beds, a rose arch and a bench on the east lawn
//  - Playground: swings, a slide, a seesaw and a sandpit by the cottage
//  - Truck Lanterns: lantern posts along the west track (tractors use it at night)
// The road's Street Lamps (scenery.js) and the yard's Farm Lanterns (chickens.js) are gated there.

const blobGeo = new IcosahedronGeometry(1, 1)
function blob(g, mat, x, y, z, sx, sy = sx, sz = sx) {
  const m = new Mesh(blobGeo, mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  g.add(m)
  return m
}

function fountain(G, x, z) {
  const g = new Group()
  const stone = M('#c9c2b4', { roughness: 0.85 })
  const dark = M('#a59d8e', { roughness: 0.9 })
  const water = E('#6fb6e0', 0.25, { roughness: 0.05, metalness: 0.1 })
  cyl(g, 2.3, 2.45, 0.6, stone, x, 0.3, z, 28) // basin wall
  cyl(g, 2.05, 2.05, 0.04, water, x, 0.5, z, 28, false) // pool
  cyl(g, 2.5, 2.5, 0.12, dark, x, 0.66, z, 28) // rim cap
  cyl(g, 0.3, 0.42, 1.5, stone, x, 1.25, z, 12) // pedestal
  cyl(g, 1.0, 0.45, 0.32, stone, x, 2.0, z, 18) // lower bowl
  cyl(g, 0.9, 0.9, 0.03, water, x, 2.17, z, 18, false)
  cyl(g, 0.16, 0.22, 0.7, stone, x, 2.5, z, 10)
  cyl(g, 0.5, 0.24, 0.2, stone, x, 2.9, z, 14) // top bowl
  cyl(g, 0.12, 0.05, 0.35, E('#bfe6ff', 0.6), x, 3.15, z, 8, false) // the jet
  // Water falling off the bowls (thin bright skirts).
  cyl(g, 1.02, 1.12, 0.5, E('#bfe6ff', 0.35, { transparent: true, opacity: 0.45 }), x, 1.95, z, 18, false)
  cyl(g, 0.52, 0.6, 0.6, E('#bfe6ff', 0.35, { transparent: true, opacity: 0.45 }), x, 2.6, z, 14, false)
  // Flower tubs round it.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const tx = x + Math.cos(a) * 3.3
    const tz = z + Math.sin(a) * 3.3
    cyl(g, 0.38, 0.3, 0.45, M('#b65a32'), tx, 0.23, tz, 10)
    blob(g, M(['#ff6f91', '#ffd23f', '#c86bff', '#ff8c42'][i], { flatShading: true }), tx, 0.62, tz, 0.4, 0.28)
  }
  bakeInto(G, g)
  solidCyl(2.5, 0.7, x, z)
}

function blossomTrees(G, x, zs, rand) {
  const g = new Group()
  const bark = M('#6b4a35', { roughness: 0.9 })
  const pinks = ['#f7a8c8', '#f6b8d4', '#fbc6dc', '#f190b8'].map((c) => M(c, { flatShading: true, roughness: 0.8 }))
  const petal = M('#f9c4da', { roughness: 1 })
  for (const z of zs) {
    const h = 2.0 + rand() * 0.5
    cyl(g, 0.16, 0.24, h, bark, x, h / 2, z, 8)
    const lean = (rand() - 0.5) * 0.3
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2
      const r = i === 0 ? 0 : 0.8 + rand() * 0.4
      blob(g, pinks[(i + Math.floor(rand() * 4)) % 4], x + Math.cos(a) * r + lean, h + 0.6 + rand() * 0.5, z + Math.sin(a) * r, 1.1 + rand() * 0.3, 0.9 + rand() * 0.2)
    }
    // Fallen petals under it.
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2
      const r = 0.6 + rand() * 1.8
      cyl(g, 0.09, 0.09, 0.01, petal, x + Math.cos(a) * r, 0.03, z + Math.sin(a) * r, 6, false)
    }
    solidCyl(0.25, h, x, z)
  }
  bakeInto(G, g)
}

function flowerGarden(G, x, z, rand) {
  const g = new Group()
  const wood = M('#8a5a36', { roughness: 0.9 })
  const soil = M('#5a3d27', { roughness: 1 })
  const leaf = M('#4f9a3a', { flatShading: true })
  const colors = ['#ff5d7a', '#ffd23f', '#c86bff', '#ff8c42', '#ffffff', '#5fb0ff'].map((c) => M(c, { roughness: 0.7 }))
  // Four raised beds round a gravel square (the pad stands on the square).
  const beds = [[-4.2, -3.2, 5, 2], [4.2, -3.2, 5, 2], [-4.2, 3.2, 5, 2], [4.2, 3.2, 5, 2]]
  for (const [dx, dz, w, d] of beds) {
    const bx = x + dx
    const bz = z + dz
    block(g, w, 0.4, d, wood, bx, 0, bz)
    block(g, w - 0.3, 0.06, d - 0.3, soil, bx, 0.36, bz)
    for (let i = 0; i < 26; i++) {
      const fx = bx + (rand() - 0.5) * (w - 0.6)
      const fz = bz + (rand() - 0.5) * (d - 0.6)
      cyl(g, 0.03, 0.03, 0.35, leaf, fx, 0.58, fz, 4, false)
      blob(g, colors[Math.floor(rand() * colors.length)], fx, 0.8, fz, 0.13, 0.1)
    }
  }
  cyl(g, 2.4, 2.4, 0.03, M('#cbbd9e', { roughness: 1 }), x, 0.02, z, 24, false) // gravel square
  // A rose arch over the south walk.
  const az = z + 6
  for (const s of [-1.1, 1.1]) block(g, 0.14, 2.4, 0.14, M('#f2efe6'), x + s, 0, az)
  box(g, 2.5, 0.14, 0.3, M('#f2efe6'), x, 2.45, az)
  for (let i = 0; i < 14; i++) blob(g, i % 3 ? leaf : colors[0], x + (rand() - 0.5) * 2.6, 1.2 + rand() * 1.4, az + (rand() - 0.5) * 0.3, 0.22)
  solidCyl(0.12, 2.4, x - 1.1, az)
  solidCyl(0.12, 2.4, x + 1.1, az)
  // A bench on the north side, a birdbath beside it.
  block(g, 2.2, 0.1, 0.6, M('#b67a42'), x, 0.45, z - 6.2)
  block(g, 2.2, 0.5, 0.08, M('#b67a42'), x, 0.6, z - 6.5)
  for (const s of [-0.9, 0.9]) block(g, 0.1, 0.45, 0.55, M('#2f2f33', { metalness: 0.4 }), x + s, 0, z - 6.2)
  solidRect(x - 1.1, x + 1.1, z - 6.6, z - 5.9, 0.6)
  cyl(g, 0.12, 0.2, 0.9, M('#c9c2b4'), x + 2.4, 0.45, z - 6.2, 8)
  cyl(g, 0.45, 0.2, 0.15, M('#c9c2b4'), x + 2.4, 0.95, z - 6.2, 14)
  cyl(g, 0.38, 0.38, 0.02, M('#6fb6e0', { roughness: 0.05 }), x + 2.4, 1.02, z - 6.2, 14, false)
  bakeInto(G, g)
}

function playground(G, x, z) {
  const g = new Group()
  const red = M('#d6322c', { roughness: 0.5 })
  const blue = M('#2f6fd0', { roughness: 0.5 })
  const yellow = M('#f2c22a', { roughness: 0.5 })
  const chain = M('#9aa3ab', { metalness: 0.6, roughness: 0.4 })
  const wood = M('#b67a42', { roughness: 0.8 })
  // Soft play surface.
  cyl(g, 1, 1, 0.04, M('#c98a5a', { roughness: 1 }), x - 1, 0.02, z - 2, 24, false).scale.set(8, 1, 6.5)
  // Swings (west): an A-frame each end, a top bar, two seats.
  const sx = x - 5
  const sz = z - 5
  for (const e of [-2.2, 2.2]) {
    for (const s of [-0.7, 0.7]) {
      const leg = box(g, 0.12, 2.9, 0.12, red, sx + e, 1.35, sz + s)
      leg.rotation.x = s > 0 ? 0.25 : -0.25
      solidCyl(0.1, 2.6, sx + e, sz + s * 1.6)
    }
  }
  box(g, 4.6, 0.14, 0.14, red, sx, 2.75, sz)
  for (const s of [-1, 1]) {
    for (const c of [-0.25, 0.25]) box(g, 0.03, 1.9, 0.03, chain, sx + s + c, 1.8, sz)
    box(g, 0.7, 0.06, 0.3, s > 0 ? blue : yellow, sx + s, 0.85, sz)
  }
  // Slide (east): ladder up to a platform with a little roof, the chute sloping south.
  const lx = x + 4
  const lz = z - 6
  for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) block(g, 0.12, 2.6, 0.12, blue, lx + dx, 0, lz + dz)
  block(g, 1.6, 0.12, 1.6, wood, lx, 1.5, lz)
  const roof = box(g, 1.9, 0.1, 1.9, red, lx, 2.65, lz)
  roof.rotation.y = Math.PI / 4
  for (let i = 0; i < 5; i++) box(g, 0.9, 0.06, 0.08, yellow, lx, 0.3 + i * 0.3, lz - 0.85 - i * 0.03)
  const chute = box(g, 0.8, 0.08, 3.2, yellow, lx, 0.85, lz + 2.1)
  chute.rotation.x = 0.5
  for (const s of [-0.42, 0.42]) {
    const rail = box(g, 0.06, 0.25, 3.2, yellow, lx + s, 0.98, lz + 2.1)
    rail.rotation.x = 0.5
  }
  solidRect(lx - 0.85, lx + 0.85, lz - 0.85, lz + 0.85, 2.6)
  // Seesaw (south-west) and a sandpit (south-east, low: no collider).
  const wx = x - 5
  const wz = z + 2.5
  block(g, 0.3, 0.45, 0.3, red, wx, 0, wz)
  const plank = box(g, 3.4, 0.1, 0.32, blue, wx, 0.55, wz)
  plank.rotation.z = 0.18
  for (const s of [-1.5, 1.5]) box(g, 0.06, 0.3, 0.3, yellow, wx + s, 0.55 - s * 0.18 + 0.15, wz)
  const px = x + 3.5
  const pz = z + 1.5
  block(g, 3, 0.25, 0.15, wood, px, 0, pz - 1.4)
  block(g, 3, 0.25, 0.15, wood, px, 0, pz + 1.4)
  block(g, 0.15, 0.25, 2.9, wood, px - 1.45, 0, pz)
  block(g, 0.15, 0.25, 2.9, wood, px + 1.45, 0, pz)
  block(g, 2.8, 0.12, 2.7, M('#e8d39a', { roughness: 1 }), px, 0, pz)
  cyl(g, 0.25, 0.3, 0.3, red, px + 0.6, 0.25, pz - 0.5, 10) // bucket
  bakeInto(G, g)
}

export function buildDecor(root) {
  const rand = mulberry32(7373)
  gated(root, 'pad:Fountain', (G) => fountain(G, 4, -37), 3.4)
  gated(root, 'pad:Blossom Trees', (G) => blossomTrees(G, -7, [-64, -56, -48, -40, -24], rand), 4)
  gated(root, 'pad:Flower Garden', (G) => flowerGarden(G, 98, -42, rand), 2.6)
  gated(root, 'pad:Playground', (G) => playground(G, -60, 30), 3)
  gated(root, 'pad:Truck Lanterns', (G) => {
    const g = new Group()
    for (let z = -90; z <= -30; z += 12) lanternPost(g, -58.6, z, 2.6)
    bakeInto(G, g)
  }, 2.8)
}
