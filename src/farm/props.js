import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three'
import { paintCrate } from '../textures.js'
import { E, M, block, box, cyl } from './kit.js'
import { paintStripes, tex } from './textures.js'

// Props shared by several areas: pumpkins, crates, barrels, sacks, flower
// boxes, lamp posts, pallets, cardboard boxes, striped awnings and strings of
// fairy lights (instanced warm bulbs hanging on sagging wires).

let crateMat = null
export function crateMaterial() {
  if (!crateMat) crateMat = new MeshStandardMaterial({ map: tex(paintCrate().color, 1, 1), roughness: 0.85 })
  return crateMat
}

const pumpkinGeo = new SphereGeometry(1, 14, 10)
export function pumpkin(g, x, z, r = 0.35, color = '#ee7a1f', y = 0) {
  const p = new Group()
  p.position.set(x, y, z)
  const mat = M(color, { roughness: 0.55 })
  // Ribbed look: a few overlapping squashed spheres around the core.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const m = new Mesh(pumpkinGeo, mat)
    m.scale.set(r * 0.62, r * 0.78, r * 0.62)
    m.position.set(Math.cos(a) * r * 0.36, r * 0.74, Math.sin(a) * r * 0.36)
    m.castShadow = true
    m.receiveShadow = true
    p.add(m)
  }
  cyl(p, 0.05 * r * 3, 0.07 * r * 3, r * 0.4, M('#5d7a2a'), 0, r * 1.52, 0, 6)
  g.add(p)
  return p
}

export function crate(g, x, y, z, s = 1, ry = 0) {
  const c = block(g, 0.9 * s, 0.7 * s, 0.7 * s, crateMaterial(), x, y, z, ry)
  return c
}

export function barrel(g, x, z, ry = 0) {
  const wood = M('#8a5530', { roughness: 0.85 })
  const hoop = M('#3b3b40', { roughness: 0.4, metalness: 0.6 })
  const b = new Group()
  b.position.set(x, 0, z)
  b.rotation.y = ry
  cyl(b, 0.42, 0.42, 0.06, wood, 0, 0.03, 0, 14)
  cyl(b, 0.5, 0.42, 0.55, wood, 0, 0.32, 0, 14)
  cyl(b, 0.42, 0.5, 0.55, wood, 0, 0.87, 0, 14)
  cyl(b, 0.43, 0.43, 0.06, M('#6e4122'), 0, 1.14, 0, 14)
  for (const y of [0.18, 0.6, 1.0]) cyl(b, y === 0.6 ? 0.515 : 0.47, y === 0.6 ? 0.515 : 0.47, 0.06, hoop, 0, y, 0, 14)
  g.add(b)
  return b
}

export function sack(g, x, z, color = '#c9a874', top = '#e2b24a', ry = 0) {
  const s = new Group()
  s.position.set(x, 0, z)
  s.rotation.y = ry
  cyl(s, 0.32, 0.38, 0.75, M(color, { roughness: 1 }), 0, 0.38, 0, 9)
  cyl(s, 0.34, 0.32, 0.1, M(color, { roughness: 1 }), 0, 0.8, 0, 9)
  cyl(s, 0.3, 0.3, 0.06, M(top, { roughness: 0.9 }), 0, 0.86, 0, 9) // seeds showing
  g.add(s)
  return s
}

export function pallet(g, x, z, ry = 0, y = 0) {
  const wood = M('#c99a5e', { roughness: 0.9 })
  const p = new Group()
  p.position.set(x, y, z)
  p.rotation.y = ry
  for (const s of [-0.5, 0, 0.5]) block(p, 1.2, 0.1, 0.18, wood, 0, 0, s)
  for (let i = 0; i < 6; i++) block(p, 0.16, 0.04, 1.2, wood, -0.52 + i * 0.21, 0.1, 0)
  g.add(p)
  return p
}

export function cardboard(g, x, y, z, w = 0.8, h = 0.6, d = 0.6, ry = 0) {
  const b = block(g, w, h, d, M('#d6a86a', { roughness: 0.95 }), x, y, z, ry)
  block(g, w + 0.01, 0.06, 0.12, M('#c69a5c'), x, y + h - 0.03, z, ry) // tape
  return b
}

// Flower box: a wooden planter of soil with small blossoms on stems.
const blossomGeo = new IcosahedronGeometry(1, 0)
export function flowerBox(g, x, z, len = 2.2, ry = 0, rand = Math.random) {
  const b = new Group()
  b.position.set(x, 0, z)
  b.rotation.y = ry
  block(b, len, 0.45, 0.6, M('#8a5530'), 0, 0, 0)
  block(b, len - 0.1, 0.04, 0.5, M('#4b3222'), 0, 0.43, 0)
  const colors = ['#ff5d7a', '#ffd23f', '#ffffff', '#c86bff', '#ff8c42']
  for (let i = 0; i < len * 6; i++) {
    const fx = -len / 2 + 0.12 + rand() * (len - 0.24)
    const fz = (rand() - 0.5) * 0.4
    const h = 0.15 + rand() * 0.25
    box(b, 0.03, h, 0.03, M('#3f8a2c'), fx, 0.45 + h / 2, fz, 0, false)
    const f = new Mesh(blossomGeo, M(colors[Math.floor(rand() * colors.length)], { roughness: 0.6 }))
    f.position.set(fx, 0.45 + h + 0.04, fz)
    f.scale.setScalar(0.07 + rand() * 0.04)
    b.add(f)
    if (rand() < 0.5) {
      const leaf = box(b, 0.12, 0.02, 0.06, M('#4c9a34'), fx + 0.05, 0.45 + h * 0.5, fz, rand() * 3, false)
      leaf.rotation.z = 0.4
    }
  }
  g.add(b)
  return b
}

// Black iron street / plaza lamp: a post, a lantern head with warm glass.
// Returns the bulb position.
export function lampPost(g, x, z, h = 3.6, style = 'plaza') {
  const iron = M('#25262b', { roughness: 0.45, metalness: 0.5 })
  cyl(g, 0.16, 0.2, 0.3, iron, x, 0.15, z, 10)
  cyl(g, 0.07, 0.09, h, iron, x, h / 2, z, 8)
  if (style === 'street') {
    box(g, 1.4, 0.1, 0.12, iron, x, h - 0.05, z + 0.0)
    box(g, 0.5, 0.14, 0.34, iron, x + 0.7, h - 0.12, z)
    box(g, 0.42, 0.05, 0.28, E('#fff2c8', 2.4), x + 0.7, h - 0.21, z, 0, false)
    return [x + 0.7, h - 0.4, z]
  }
  cyl(g, 0.12, 0.12, 0.1, iron, x, h + 0.05, z, 10)
  cyl(g, 0.18, 0.12, 0.42, E('#fff0c2', 2.2), x, h + 0.31, z, 8)
  cyl(g, 0.05, 0.25, 0.18, iron, x, h + 0.61, z, 8)
  cyl(g, 0.03, 0.03, 0.12, iron, x, h + 0.76, z, 6)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    box(g, 0.025, 0.44, 0.025, iron, x + Math.cos(a) * 0.17, h + 0.32, z + Math.sin(a) * 0.17, 0, false)
  }
  return [x, h + 0.3, z]
}

// Striped awning slab: w wide, d deep, sloping from back height hb down to front hf.
// Local frame: front edge faces +Z. Returns the group.
let stripeTex = null
export function awning(w, d, hb, hf, { a = '#e23a35', b = '#fbf6ee' } = {}) {
  if (!stripeTex) stripeTex = new Map()
  const key = a + b
  let t = stripeTex.get(key)
  if (!t) stripeTex.set(key, (t = tex(paintStripes(a, b, 8, 256, 64), 1, 1)))
  const map = t.clone()
  map.repeat.set(w / 3.2, 1)
  map.needsUpdate = true
  const mat = new MeshStandardMaterial({ map, roughness: 0.8 })
  const g = new Group()
  const slope = Math.atan2(hb - hf, d)
  const len = Math.hypot(d, hb - hf)
  const top = box(g, w, 0.07, len, mat, 0, (hb + hf) / 2, 0)
  top.rotation.x = slope
  // Scalloped valance along the front: alternating coloured tabs with rounded ends.
  const n = Math.round(w / 0.4)
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n)
    const col = M(i % 2 ? b : a, { roughness: 0.8 })
    box(g, w / n, 0.3, 0.04, col, x, hf - 0.15, d / 2 + 0.02, 0, false)
    const tip = cyl(g, w / n / 2, w / n / 2, 0.04, col, x, hf - 0.3, d / 2 + 0.02, 10, false)
    tip.rotation.x = Math.PI / 2
  }
  return g
}

// Fairy lights between anchor points [[x, y, z], ...] with a sag; returns bulb count.
// All strings share one instanced bulb mesh (call stringLights.build at the end).
// `makeStringLights()` makes another set (built into its own group, e.g. a bought
// decoration); every set shares one bulb material, so index.js's night glow
// (stringLights.mesh.material) lights them all.
let bulbMat = null
const sharedBulbMat = () => (bulbMat ??= new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.2, roughness: 0.3 }))
export const makeStringLights = () => ({
  bulbs: [],
  wires: [],
  add(a, b, sag = 0.6, spacing = 0.55) {
    const A = new Vector3(...a)
    const B = new Vector3(...b)
    const len = A.distanceTo(B)
    const n = Math.max(2, Math.round(len / spacing))
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const p = A.clone().lerp(B, t)
      p.y -= Math.sin(t * Math.PI) * sag
      pts.push(p)
      if (i > 0 && i < n) this.bulbs.push(p.clone().add(new Vector3(0, -0.08, 0)))
    }
    this.wires.push(pts)
  },
  build(root) {
    const wireMat = new LineBasicMaterial({ color: '#2a2622' })
    for (const pts of this.wires) {
      const geo = new BufferGeometry()
      geo.setAttribute('position', new Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3))
      root.add(new Line(geo, wireMat))
    }
    const geo = new SphereGeometry(0.07, 8, 6)
    geo.scale(1, 1.3, 1)
    const mesh = new InstancedMesh(geo, sharedBulbMat(), this.bulbs.length)
    const o = new Object3D()
    const c = new Color()
    const warm = ['#ffd27a', '#ffe9b0', '#ffc35c', '#fff1cf']
    this.bulbs.forEach((p, i) => {
      o.position.copy(p)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c.set(warm[i % warm.length]))
    })
    root.add(mesh)
    this.mesh = mesh
    this.bulbs = []
    this.wires = []
    return mesh
  },
  mesh: null,
})
export const stringLights = makeStringLights()
