import { Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FARM, westPlots } from '../config.js'
import { mulberry32 } from '../textures.js'
import { E, M, addSurface, bakeInto, block, box, cyl, gableRoof, gatedAny, prism, signCanvas, signMaterial, signPanel } from './kit.js'
import { fence } from './fence.js'
import { addSway, part } from './field.js'
import { awning, pumpkin } from './props.js'
import { paintDirt, tex } from './textures.js'

// The west side of the farm: a grid of plots for sale (plain lawn, a wooden FIELD
// sign on each; its pad and what grows once it is bought are in plots.js), the
// track from the yard path to the dirt road, the tracks between the plots (laid as
// the plots beside them are bought), and, across the woods, the neighbouring
// player's farm.

function ground(root, r, y, map, tile) {
  const w = r.maxX - r.minX
  const d = r.maxZ - r.minZ
  const geo = new PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2)
  const t = map.clone()
  t.repeat.set(w / tile, d / tile)
  t.needsUpdate = true
  const m = new Mesh(geo, new MeshStandardMaterial({ map: t, roughness: 1 }))
  m.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2)
  m.receiveShadow = true
  root.add(m)
  return m
}

// Tall grass tuft: 5 tapered blades leaning out.
function tuftGeo(rand) {
  const parts = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand()
    const h = 0.45 + rand() * 0.45
    const lean = 0.18 + rand() * 0.25
    const g = part(0.05, h, 0.02, 0, 0, 0, i % 2 ? '#7aa83e' : '#93b84a', lean, 0, 0)
    g.applyMatrix4(new Matrix4().makeRotationY(a))
    parts.push(g)
  }
  return mergeGeometries(parts)
}

function plotSign(g, x, z, n) {
  const post = M('#6e4122')
  block(g, 0.12, 1.0, 0.12, post, x, 0, z)
  const p = signCanvas(256, 110, { bg: '#b07a42', plank: 2, border: '#6e4122', borderWidth: 8, radius: 8, lines: [{ text: `FIELD ${n}`, size: 54, color: '#fff3d6', stroke: '#5a3018', strokeWidth: 8 }] })
  const s = new Group()
  s.position.set(x, 1.05, z)
  s.rotation.z = (n % 2 ? 1 : -1) * 0.05 // hand-hammered, slightly crooked
  box(s, 0.95, 0.42, 0.06, M('#b07a42'), 0, 0, 0)
  signPanel(s, 0.93, 0.4, signMaterial(p), 0, 0, 0.035)
  g.add(s)
}

// --- The neighbour's farm --------------------------------------------------------------------
// A lower-detail copy of a farm plot (it is only ever seen from far away).
export function neighbour(root, { x: nx, z: nz, ry = 0 } = FARM.neighbor) {
  const g = new Group()
  const dirt = M('#c99a62', { roughness: 1 })
  const soil = M('#5e4029', { roughness: 1 })
  const concrete = M('#bdbab3', { roughness: 0.95 })
  const pavers = M('#d2b48a', { roughness: 1 })
  const red = M('#c3282c', { roughness: 0.8 })
  const white = M('#f7f4ec')
  const roof = M('#62656b', { roughness: 0.6 })
  // Ground patches.
  block(g, 56, 0.04, 28, dirt, -18, 0, 2)
  block(g, 40, 0.04, 34, soil, -22, 0, -38)
  block(g, 32, 0.05, 40, concrete, 30, 0, -2)
  block(g, 26, 0.05, 14, pavers, -24, 0, 24)
  // Wheat on half the field.
  const wheat = M('#e3b84e', { roughness: 0.9 })
  for (let i = 0; i < 9; i++) block(g, 1.2, 1.1, 30, wheat, -40 + i * 2.2, 0, -38)
  for (let i = 9; i < 18; i++) block(g, 1.3, 0.25, 30, M('#6b4a33'), -40 + i * 2.2, 0, -38)
  // Coops.
  for (const cx of [-34, -18, -2]) {
    block(g, 3.8, 2.6, 3.0, red, cx, 0.4, -5)
    prism(g, 3.8, 1.3, 3.0, red, cx, 3.0, -5)
    gableRoof(g, 3.8, 3.0, 3.0, 34, roof, { cx, cz: -5, overhang: 0.3, trim: white })
  }
  // Stand with a striped awning.
  block(g, 6, 1, 1, M('#a8693a'), -22, 0, 26)
  const aw = awning(6.6, 3.6, 3.5, 2.8)
  aw.position.set(-22, 0, 25.5)
  g.add(aw)
  // Truck bay.
  block(g, 18, 7, 26, M('#a9a8a4'), 10, 0, 6)
  block(g, 14, 5.4, 0.2, M('#2a2b2f'), 10, 0, 19.05)
  block(g, 19, 0.6, 27, roof, 10, 7, 6)
  block(g, 12, 1.2, 0.2, M('#2f5d3a'), 10, 5.8, 19.2)
  // Barn.
  block(g, 30, 8.5, 30, red, 34, 0, -46)
  prism(g, 30, 9.7, 30, red, 34, 8.5, -46, Math.PI / 2)
  gableRoof(g, 30, 30, 8.45, 33, roof, { overhang: 0.8, thick: 0.3, axis: 'x', cx: 34, cz: -46, trim: white })
  block(g, 13, 3.6, 0.3, M('#2f5d3a'), 34, 7.5, -30.8)
  block(g, 11, 6.5, 0.2, M('#24170f'), 34, 0, -30.9)
  // Racks along the east edge.
  for (let i = 0; i < 9; i++) {
    block(g, 1.6, 0.12, 3.6, M('#e8812c'), 44, 1.3, -14 + i * 3.8)
    block(g, 1.6, 0.12, 3.6, M('#e8812c'), 44, 2.5, -14 + i * 3.8)
    block(g, 0.12, 3.8, 0.12, M('#2f63c4'), 44.8, 0, -16 + i * 3.8)
    block(g, 1.0, 0.8, 1.1, M('#c99a5e'), 44, 1.42, -14 + i * 3.8)
  }
  // Farmhouse.
  block(g, 13, 4.2, 9, white, -62, 0, -2)
  prism(g, 9, 3, 13, white, -62, 4.2, -2, Math.PI / 2)
  gableRoof(g, 13, 9, 4.15, 34, M('#3f8a4a'), { overhang: 0.7, thick: 0.25, axis: 'x', cx: -62, cz: -2 })
  // Upgrade pads glowing here and there.
  for (const [px, pz] of [[-46, 8], [4, -20], [-8, 20]]) cyl(g, 1.4, 1.4, 0.12, E('#4ef06a', 0.9), px, 0.08, pz, 20, false)
  pumpkin(g, -12, 22, 0.4)
  // Its fences.
  const fences = new Group()
  for (const [x0, z0, x1, z1] of [[-46, -12, -46, 16], [-46, 16, 10, 16], [-46, -56, 50, -56], [50, -56, 50, 16]]) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.round(len / 2.4)
    const yaw = Math.atan2(-(z1 - z0), x1 - x0)
    for (let k = 0; k <= n; k++) block(fences, 0.24, 1.25, 0.24, M('#9a5a2c'), x0 + ((x1 - x0) * k) / n, 0, z0 + ((z1 - z0) * k) / n)
    for (const y of [0.48, 0.98]) box(fences, len, 0.2, 0.11, M('#bf7a3e'), (x0 + x1) / 2, y, (z0 + z1) / 2, yaw)
  }
  g.add(fences)
  g.position.set(nx, 0, nz)
  g.rotation.y = ry
  bakeInto(root, g)
}

export function buildWest(root) {
  const rand = mulberry32(4343)
  const dirtTex = tex(paintDirt(256, '#9c7550', '#7a5638', 947), 1)
  const plots = westPlots()
  const W = FARM.west

  // The north-south track from the yard path to the dirt road is always there.
  ground(root, FARM.westPath, 0.024, dirtTex, 6)
  addSurface(FARM.westPath, 'dirt')
  // The tracks between the plots are laid with the plots they serve: the stretch of the
  // middle track along a column with either plot in that column, the track down a gap
  // between two columns (and its marker post) with any plot beside it.
  const rowMinZ = W.minZ + (W.maxZ - W.minZ - W.gap) / 2
  const rowMaxZ = rowMinZ + W.gap
  const cw = (W.maxX - W.minX - W.gap * (W.cols - 1)) / W.cols
  const plotGate = (list) => list.map((p) => `plot:${p.n}`)
  for (let c = 0; c < W.cols; c++) {
    const maxX = W.maxX - c * (cw + W.gap)
    const piece = { minX: maxX - cw, maxX, minZ: rowMinZ, maxZ: rowMaxZ }
    const column = plots.filter((p) => Math.abs(p.rect.maxX - maxX) < 0.01)
    gatedAny(root, plotGate(column), (G) => {
      ground(G, piece, 0.024, dirtTex, 6)
      addSurface(piece, 'dirt')
    }, 0.3)
    if (c === 0) continue
    const gap = { minX: maxX, maxX: maxX + W.gap, minZ: W.minZ, maxZ: W.maxZ }
    const beside = plots.filter((p) => Math.abs(p.rect.minX - gap.maxX) < 0.01 || Math.abs(p.rect.maxX - gap.minX) < 0.01)
    gatedAny(root, plotGate(beside), (G) => {
      ground(G, gap, 0.024, dirtTex, 6)
      addSurface(gap, 'dirt')
      // A weathered wooden marker post where it meets the dirt road.
      block(G, 0.2, 0.7, 0.2, M('#7b4a26'), (gap.minX + gap.maxX) / 2, 0, W.maxZ + 1.5)
    }, 0.3)
  }

  // The plots themselves are plain lawn until bought (plots.js tills a bought one);
  // only a wooden FIELD sign on each says it is for sale.
  const g = new Group()
  for (const p of plots) plotSign(g, p.rect.maxX - 1.2, p.rect.maxZ + 0.9, p.n)
  bakeInto(root, g)
  // Tall grass tufts along the field fence.
  const tufts = []
  for (let z = -88; z < -20; z += 1.6 + rand()) tufts.push([-58.5 + rand() * 1.2, z])
  const tuftMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  addSway(tuftMat, { bend: 0.5, sheen: 0.12 })
  const tuftMesh = new InstancedMesh(tuftGeo(rand), tuftMat, tufts.length)
  const o = new Object3D()
  tufts.forEach(([x, z], i) => {
    o.position.set(x, 0.02, z)
    o.rotation.set(0, rand() * 6.28, 0)
    const s = 0.7 + rand() * 0.8
    o.scale.set(s, 0.7 + rand() * 0.9, s)
    o.updateMatrix()
    tuftMesh.setMatrixAt(i, o.matrix)
  })
  root.add(tuftMesh)
  // The plot's north fence along the plots (gaps where the tracks meet the dirt road)
  // and a fence down the far west edge.
  for (const p of plots.slice(W.cols)) fence([[p.rect.minX, FARM.northEdge], [p.rect.maxX, FARM.northEdge]], 'wood')
  fence([[W.minX - 2, FARM.northEdge], [W.minX - 2, FARM.path.minZ - 2]], 'wood')
  neighbour(root, FARM.neighbor)
  neighbour(root, FARM.neighbor2)

  return { rect: { minX: W.minX, maxX: W.maxX, minZ: W.minZ, maxZ: W.maxZ } }
}
