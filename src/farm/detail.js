import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake } from '../bake.js'
import { M } from './kit.js'

// The detail kit for the progression models: rounded boxes, tubes between two
// points, lathed and extruded shapes, lugged tyres with spoked rims, lamps with
// their own (switchable) lens materials, glass and painted metal, small canvas
// decals (plates, logos, gauges) and `bakeStatic` to merge a model's fixed
// parts into one mesh per material (draw calls stay low with all the detail).

const cache = new Map()
const cached = (key, make) => {
  let g = cache.get(key)
  if (!g) cache.set(key, (g = make()))
  return g
}

// --- Materials ----------------------------------------------------------------------------------------
export const paint = (color, gloss = 0.35) => M(color, { roughness: gloss, metalness: 0.25 })
export const metal = (color = '#9aa3ab', rough = 0.35) => M(color, { roughness: rough, metalness: 0.85 })
export const rubber = () => M('#1c1c1e', { roughness: 0.92 })
export const plastic = (color = '#2a2c30') => M(color, { roughness: 0.6 })
let glassMat = null
export const glass = () =>
  (glassMat ??= new MeshPhysicalMaterial({ color: '#9fc6dc', roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.38, clearcoat: 1, depthWrite: false }))
let darkGlassMat = null
export const darkGlass = () => (darkGlassMat ??= new MeshPhysicalMaterial({ color: '#1e2a33', roughness: 0.06, metalness: 0.4, clearcoat: 1 }))
// A lamp lens with its own material so it can be switched on and off.
export function lens(color, base = 0.4) {
  const m = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: base, roughness: 0.2, metalness: 0.1 })
  m.userData.base = base
  m.userData.k = Math.random() // never merged with another lens by bake()
  return m
}

// --- Primitives ---------------------------------------------------------------------------------------
export function rbox(parent, w, h, d, r, mat, x = 0, y = 0, z = 0, seg = 3) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)
  const geo = cached(`rb${w}|${h}|${d}|${rr}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rr))
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
export function bx(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new Mesh(cached(`b${w}|${h}|${d}`, () => new BoxGeometry(w, h, d)), mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
export function cy(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16, axis = 'y') {
  const m = new Mesh(cached(`c${rt}|${rb}|${h}|${seg}`, () => new CylinderGeometry(rt, rb, h, seg)), mat)
  m.position.set(x, y, z)
  if (axis === 'x') m.rotation.z = Math.PI / 2
  if (axis === 'z') m.rotation.x = Math.PI / 2
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
export function sph(parent, r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 14) {
  const m = new Mesh(cached(`s${r}|${seg}`, () => new SphereGeometry(r, seg, Math.max(6, seg * 0.7) | 0)), mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
export function ring(parent, r, tube, mat, x = 0, y = 0, z = 0, axis = 'y', arc = Math.PI * 2) {
  const m = new Mesh(cached(`t${r}|${tube}|${arc}`, () => new TorusGeometry(r, tube, 8, 28, arc)), mat)
  m.position.set(x, y, z)
  if (axis === 'y') m.rotation.x = Math.PI / 2
  if (axis === 'x') m.rotation.y = Math.PI / 2
  m.castShadow = true
  parent.add(m)
  return m
}
// A tube (cylinder) from point a to point b, radius r.
const UP = new Vector3(0, 1, 0)
const va = new Vector3()
const vb = new Vector3()
const q = new Quaternion()
export function tube(parent, a, b, r, mat, seg = 8) {
  va.set(...a)
  vb.set(...b)
  const len = va.distanceTo(vb)
  const m = new Mesh(cached(`c${r}|${r}|1|${seg}`, () => new CylinderGeometry(r, r, 1, seg)), mat)
  m.scale.y = Math.max(0.001, len)
  m.position.copy(va).add(vb).multiplyScalar(0.5)
  q.setFromUnitVectors(UP, vb.sub(va).normalize())
  m.quaternion.copy(q)
  m.castShadow = true
  parent.add(m)
  return m
}
// Re-aims an existing tube() mesh between new end points (animated rods, cables).
export function aimTube(m, a, b) {
  va.set(...a)
  vb.set(...b)
  m.scale.y = Math.max(0.001, va.distanceTo(vb))
  m.position.copy(va).add(vb).multiplyScalar(0.5)
  q.setFromUnitVectors(UP, vb.sub(va).normalize())
  m.quaternion.copy(q)
}
// A lathed solid from [[radius, y], ...] (tanks, domes, bells, wheels hubs).
export function lathe(parent, pts, mat, x = 0, y = 0, z = 0, seg = 24) {
  const key = `l${seg}|${pts.flat().join(',')}`
  const m = new Mesh(cached(key, () => new LatheGeometry(pts.map(([r, h]) => new Vector2(r, h)), seg)), mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
// An extruded 2D outline [[x, y], ...] (in the XY plane), `depth` along Z, centred on Z.
export function extrude(parent, pts, depth, mat, x = 0, y = 0, z = 0, bevel = 0.02) {
  const key = `e${depth}|${bevel}|${pts.flat().join(',')}`
  const geo = cached(key, () => {
    const s = new Shape()
    s.moveTo(pts[0][0], pts[0][1])
    for (const p of pts.slice(1)) s.lineTo(p[0], p[1])
    s.closePath()
    const g = new ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 })
    g.translate(0, 0, -depth / 2)
    return g
  })
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
// Points along an arc (for extrude outlines).
export function arc(cx, cy, r, a0, a1, n = 10) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return out
}

// --- Tyres and rims -------------------------------------------------------------------------------------
// A road / farm tyre with tread lugs and a rim, axle along X, spun on .rotation.x.
// opts: { lugs (count), chevron (tractor lugs), rim color, spokes, dual (twin rear) }
export function tyre(r, w, { lugs = 22, chevron = false, rim = '#cfd4d8', spokes = 6, hub = '#555a60', side = 1 } = {}) {
  const key = `tyre${r}|${w}|${lugs}|${chevron}|${rim}|${spokes}|${side}`
  const src = cached(key, () => {
    const g = new Group()
    // Rounded carcass: a lathe with shoulders, laid on its side.
    const k = r * 0.12
    const prof = [[r * 0.62, -w / 2], [r - k, -w / 2], [r, -w / 2 + k], [r, w / 2 - k], [r - k, w / 2], [r * 0.62, w / 2]]
    const car = lathe(g, prof, rubber(), 0, 0, 0, 28)
    car.rotation.z = Math.PI / 2
    // Tread lugs.
    const lugMat = rubber()
    for (let i = 0; i < lugs; i++) {
      const a = (i / lugs) * Math.PI * 2
      const lw = chevron ? w * 0.48 : w * 0.86
      for (const s of chevron ? [-1, 1] : [0]) {
        const lug = bx(g, lw, r * 0.07, (Math.PI * 2 * r) / lugs * (chevron ? 0.32 : 0.45), lugMat, s * w * 0.24, 0, 0)
        lug.position.y = Math.cos(a) * (r + r * 0.02)
        lug.position.z = Math.sin(a) * (r + r * 0.02)
        lug.rotation.x = a
        if (chevron) lug.rotation.y = s * 0.45
      }
    }
    // Rim: dish, spokes or holes, hub, lug nuts.
    const rimMat = M(rim, { roughness: 0.3, metalness: 0.6 })
    const disc = cy(g, r * 0.6, r * 0.6, w * 0.8, rimMat, 0, 0, 0, 24, 'x')
    void disc
    const face = side * (w * 0.41)
    cy(g, r * 0.5, r * 0.5, 0.02, M('#2a2c30'), face, 0, 0, 24, 'x')
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2
      const sp = bx(g, 0.03, r * 0.42, r * 0.11, rimMat, face + side * 0.01, Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27)
      sp.rotation.x = a
    }
    cy(g, r * 0.2, r * 0.22, w * 0.86 + 0.04, M(hub, { roughness: 0.3, metalness: 0.8 }), 0, 0, 0, 14, 'x')
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      cy(g, r * 0.035, r * 0.035, w * 0.9 + 0.08, metal('#d9dde1', 0.2), 0, Math.cos(a) * r * 0.13, Math.sin(a) * r * 0.13, 6, 'x')
    }
    // One geometry with the parts' colours baked into vertex colours: one draw call a tyre.
    g.updateMatrixWorld(true)
    const parts = []
    const c = new Color()
    g.traverse((o) => {
      if (!o.isMesh) return
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld)
      for (const n of Object.keys(geo.attributes)) if (n !== 'position' && n !== 'normal') geo.deleteAttribute(n)
      c.copy(o.material.color)
      const col = new Float32Array(geo.attributes.position.count * 3)
      for (let i = 0; i < col.length; i += 3) {
        col[i] = c.r
        col[i + 1] = c.g
        col[i + 2] = c.b
      }
      geo.setAttribute('color', new BufferAttribute(col, 3))
      parts.push(geo)
    })
    return mergeGeometries(parts)
  })
  const m = new Mesh(src, tyreMat ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }))
  m.castShadow = true
  m.receiveShadow = true
  return m
}
let tyreMat = null

// --- Decals -------------------------------------------------------------------------------------------
export function decal(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  const redraw = () => {
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
    t.needsUpdate = true
  }
  redraw()
  document.fonts?.ready?.then(redraw)
  return new MeshStandardMaterial({ map: t, roughness: 0.5, transparent: true })
}
export function plate(text = 'FARM 1') {
  return decal(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#f7f4ec'
    ctx.beginPath()
    ctx.roundRect(4, 4, w - 8, h - 8, 12)
    ctx.fill()
    ctx.strokeStyle = '#2a2c30'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.fillStyle = '#1d3a8a'
    ctx.font = '700 54px Fredoka, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 3)
  })
}
export function panel(parent, w, h, mat, x, y, z, ry = 0) {
  const m = new Mesh(cached(`p${w}|${h}`, () => new BoxGeometry(w, h, 0.01)), mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

// --- Baking -------------------------------------------------------------------------------------------
// Merges every mesh in `group` (one mesh per material) and puts the result in `parent`.
export function bakeStatic(parent, group) {
  const b = bake(group, true)
  b.position.copy(group.position)
  b.quaternion.copy(group.quaternion)
  b.scale.copy(group.scale)
  b.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  parent.add(b)
  return b
}
// Merges, inside every group of a model, the meshes that are its direct children
// (one mesh per material), keeping the child groups (joints) as they are: a
// jointed animal or a machine keeps its animation with far fewer draw calls.
// Meshes flagged userData.keep (switchable, re-aimed or toggled parts) stay.
const keyOf = (m) => [m.uuid].join('|')
export function compact(root) {
  const groups = []
  root.traverse((o) => {
    if (!o.isMesh) groups.push(o)
  })
  for (const g of groups) {
    if (g.userData.noCompact) continue
    const meshes = g.children.filter((c) => c.isMesh && !c.userData.keep && c.visible && !Array.isArray(c.material) && !c.isInstancedMesh && !c.isSkinnedMesh)
    if (meshes.length < 2) continue
    const byMat = new Map()
    for (const m of meshes) {
      const k = keyOf(m.material)
      if (!byMat.has(k)) byMat.set(k, { mat: m.material, list: [], cast: false })
      const e = byMat.get(k)
      e.list.push(m)
      e.cast ||= m.castShadow
    }
    for (const { mat, list, cast } of byMat.values()) {
      if (list.length < 2) continue
      const geos = list.map((m) => {
        m.updateMatrix()
        const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix)
        return geo
      })
      const names = Object.keys(geos[0].attributes).filter((n) => geos.every((x) => x.attributes[n]))
      for (const x of geos) {
        for (const n of Object.keys(x.attributes)) if (!names.includes(n)) x.deleteAttribute(n)
        x.morphAttributes = {}
        x.clearGroups()
      }
      const merged = mergeGeometries(geos)
      for (const x of geos) x.dispose()
      if (!merged) continue
      for (const m of list) g.remove(m)
      const mm = new Mesh(merged, mat)
      mm.castShadow = cast
      mm.receiveShadow = true
      g.add(mm)
    }
  }
  return root
}
export { mergeGeometries }
