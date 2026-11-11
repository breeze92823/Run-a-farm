import {
  BoxGeometry,
  Group,
  ExtrudeGeometry,
  Shape,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { RAPIER, addFixed } from '../physics.js'
import { bake } from '../bake.js'

// Shared building blocks for the farm: cached materials, primitive placers,
// sign painting, collider shorthands and the two registries the rest of the
// game reads: walkable surfaces (footstep sounds) and the shared wind state
// (wheat sway, falling leaves and the wind sound all follow the same gusts).

// --- Materials ----------------------------------------------------------------------
const matCache = new Map()
// Plastic-ish standard material, cached by colour + options.
export function M(color, opts = {}) {
  const key = color + JSON.stringify(opts)
  let m = matCache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts })
    matCache.set(key, m)
  }
  return m
}
// Emissive material for bulbs, lit windows and glowing bits.
export function E(color, intensity = 1.5, opts = {}) {
  return M(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...opts })
}

// --- Geometry cache ---------------------------------------------------------------------
const geoCache = new Map()
export function boxGeo(w, h, d) {
  const key = `b${w}|${h}|${d}`
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = new BoxGeometry(w, h, d)))
  return g
}
export function cylGeo(rt, rb, h, seg = 12) {
  const key = `c${rt}|${rb}|${h}|${seg}`
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = new CylinderGeometry(rt, rb, h, seg)))
  return g
}

// Box with its centre at (x, y, z), yaw ry.
export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0, shadow = true) {
  const m = new Mesh(boxGeo(w, h, d), mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  m.castShadow = shadow
  m.receiveShadow = true
  parent.add(m)
  return m
}
// Box standing on y (its base at y).
export const block = (parent, w, h, d, mat, x, y, z, ry = 0, shadow = true) => box(parent, w, h, d, mat, x, y + h / 2, z, ry, shadow)

export function cyl(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 12, shadow = true) {
  const m = new Mesh(cylGeo(rt, rb, h, seg), mat)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  parent.add(m)
  return m
}

// --- Signs ----------------------------------------------------------------------------
// Paints a sign face: background, optional border, then lines of text
// [{ text, size (px), color, font weight, stroke }] stacked vertically.
export function signCanvas(w, h, { bg = '#7a4a26', border = null, borderWidth = 10, lines = [], radius = 0, plank = false } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    if (bg) {
      ctx.fillStyle = bg
      roundRect(ctx, 0, 0, w, h, radius)
      ctx.fill()
      if (plank) {
        // Horizontal plank seams and a light grain.
        const n = typeof plank === 'number' ? plank : 3
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'
        ctx.lineWidth = 3
        for (let i = 1; i < n; i++) {
          ctx.beginPath()
          ctx.moveTo(0, (h * i) / n)
          ctx.lineTo(w, (h * i) / n)
          ctx.stroke()
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 2
        for (let i = 0; i < 40; i++) {
          const y = ((i * 37) % h) + 2
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2)
          ctx.stroke()
        }
      }
    }
    if (border) {
      ctx.strokeStyle = border
      ctx.lineWidth = borderWidth
      roundRect(ctx, borderWidth / 2, borderWidth / 2, w - borderWidth, h - borderWidth, Math.max(0, radius - borderWidth / 2))
      ctx.stroke()
    }
    const total = lines.reduce((s, l) => s + l.size * (l.gap ?? 1.15), 0)
    let y = (h - total) / 2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (const l of lines) {
      const lh = l.size * (l.gap ?? 1.15)
      ctx.font = `${l.weight ?? 700} ${l.size}px ${l.family ?? 'Fredoka, "Arial Black", sans-serif'}`
      const cx = w / 2 + (l.dx ?? 0)
      const cy = y + lh / 2
      if (l.stroke) {
        ctx.lineWidth = l.strokeWidth ?? l.size * 0.16
        ctx.strokeStyle = l.stroke
        ctx.strokeText(l.text, cx, cy, w * 0.94)
      }
      ctx.fillStyle = l.color ?? '#ffffff'
      ctx.fillText(l.text, cx, cy, w * 0.94)
      y += lh
    }
  }
  draw()
  return { canvas: c, draw }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (!r) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const fontReady = document.fonts?.load ? Promise.all([document.fonts.load('700 64px Fredoka'), document.fonts.load('600 64px Fredoka')]).catch(() => null) : Promise.resolve()

// A canvas-textured sign material that repaints once Fredoka has loaded.
export function signMaterial(painted, { emissive = 0, transparent = false, side = DoubleSide, roughness = 0.8 } = {}) {
  const tex = new CanvasTexture(painted.canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const mat = new MeshStandardMaterial({ map: tex, roughness, transparent, side, alphaTest: transparent ? 0.05 : 0 })
  if (emissive) {
    mat.emissive = new Color('#ffffff')
    mat.emissiveMap = tex
    mat.emissiveIntensity = emissive
  }
  fontReady.then(() => {
    painted.draw()
    tex.needsUpdate = true
  })
  return mat
}

// Flat sign panel (plane) of w x h metres facing +Z, centred at (x, y, z), yaw ry.
export function signPanel(parent, w, h, mat, x, y, z, ry = 0) {
  const m = new Mesh(new PlaneGeometry(w, h), mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  m.receiveShadow = true
  parent.add(m)
  return m
}

// --- Colliders ------------------------------------------------------------------------
const yawQ = (yaw) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
// Solid box: half extents, centre, yaw.
export function solid(hx, hy, hz, x, y, z, yaw = 0) {
  return captured(addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z }, yaw ? yawQ(yaw) : null))
}
// Solid box from a rect on the ground, `h` tall.
export function solidRect(minX, maxX, minZ, maxZ, h, y0 = 0) {
  return solid((maxX - minX) / 2, h / 2, (maxZ - minZ) / 2, (minX + maxX) / 2, y0 + h / 2, (minZ + maxZ) / 2)
}
export function solidCyl(r, h, x, z, y0 = 0) {
  return captured(addFixed(RAPIER.ColliderDesc.cylinder(h / 2, r), { x, y: y0 + h / 2, z }))
}

// --- Gated buildings ---------------------------------------------------------------------
// Things the player has to buy first (coops, the barn, the truck bay, ...) are
// built into a gate group at load and hidden; their colliders are captured
// while they are built and switched off until the building is bought
// (farm/gates.js shows them, rising out of the ground).
let capture = null
function captured(c) {
  capture?.push(c)
  return c
}
// Runs fn, returning every collider made through kit.js meanwhile.
export function captureColliders(fn) {
  const prev = capture
  const list = []
  capture = list
  try {
    fn()
  } finally {
    capture = prev
  }
  return list
}
export const gateRegistry = new Map() // building id -> [{ group, colliders, height }]
let openGate = null // the gate group being built (surfaces registered meanwhile belong to it)
// A group for building `id`, added to root; build into it inside `fn` (colliders are captured).
// Everything that belongs to a bought thing goes in here, its ground (pavers, concrete, paths,
// soil, fences) too, so the plot shows plain lawn until it is bought and it all rises together.
// `id` is a building id, `field1`, or `any:a,b,...` (shown once the first of those is bought).
export function gated(root, id, fn, height = 6) {
  const group = new Group()
  group.name = `gate:${id}`
  root.add(group)
  const prev = openGate
  openGate = group
  let colliders
  try {
    colliders = captureColliders(() => fn(group))
  } finally {
    openGate = prev
  }
  if (!gateRegistry.has(id)) gateRegistry.set(id, [])
  gateRegistry.get(id).push({ group, colliders, height })
  return group
}
// The gate group being built right now (inside a `gated` fn), else null: index.js ties a lamp's
// real light to it, so a lamp that is not bought yet stays dark.
export const currentGate = () => openGate
// Shown (and risen) along with the first of `ids` to be bought: shared ground such as a ranch's
// paths and perimeter fence or a park's lanes.
export const gatedAny = (root, ids, fn, height = 6) => gated(root, `any:${ids.join(',')}`, fn, height)

// --- Rects ------------------------------------------------------------------------------
export const inRect = (x, z, r, pad = 0) => x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad
export const rectW = (r) => r.maxX - r.minX
export const rectD = (r) => r.maxZ - r.minZ
export const rectCX = (r) => (r.minX + r.maxX) / 2
export const rectCZ = (r) => (r.minZ + r.maxZ) / 2
// Distance from a point to a rect (0 inside).
export function rectDist(x, z, r) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX)
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ)
  return Math.hypot(dx, dz)
}

// --- Walkable surfaces (footsteps) ---------------------------------------------------------
// Later registrations win, so register big areas first and details on top.
// A surface registered while a gate is being built only counts once that gate is shown.
const surfaces = [] // { rect, type, gate }
export function addSurface(rect, type) {
  surfaces.push({ rect, type, gate: openGate })
}
export function surfaceAt(x, z) {
  for (let i = surfaces.length - 1; i >= 0; i--) {
    const s = surfaces[i]
    if ((!s.gate || s.gate.visible) && inRect(x, z, s.rect)) return s.type
  }
  return 'grass'
}

// --- Wind: one shared gust signal ------------------------------------------------------------
// strength ~0.35 (calm) .. 1 (gust); direction is roughly from the west.
export const wind = { strength: 0.5, time: 0, dirX: 0.85, dirZ: -0.25 }
export function updateWind(elapsed) {
  wind.time = elapsed
  const slow = Math.sin(elapsed * 0.11) * 0.5 + Math.sin(elapsed * 0.037 + 1.3) * 0.5
  const gust = Math.max(0, Math.sin(elapsed * 0.29 + Math.sin(elapsed * 0.07) * 3)) ** 3
  wind.strength = 0.42 + slow * 0.12 + gust * 0.5
}

// Deterministic random in [lo, hi) from a seeded generator.
export const range = (rand, lo, hi) => lo + rand() * (hi - lo)

// Merges a static group into one mesh per material and adds it to root (draw-call saver).
export function bakeInto(root, group, shadow = true) {
  const b = bake(group, shadow) // geometry is relative to the group...
  b.position.copy(group.position) // ...so the baked copy takes the group's own transform
  b.quaternion.copy(group.quaternion)
  b.scale.copy(group.scale)
  b.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  root.add(b)
  return b
}

// Triangular prism (gable end): base w on y=0, apex h, depth d along Z, centred.
const prismCache = new Map()
export function prismGeo(w, h, d) {
  const key = `${w}|${h}|${d}`
  let g = prismCache.get(key)
  if (!g) {
    const s = new Shape()
    s.moveTo(-w / 2, 0)
    s.lineTo(w / 2, 0)
    s.lineTo(0, h)
    s.closePath()
    g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
    g.translate(0, 0, -d / 2)
    prismCache.set(key, g)
  }
  return g
}
export function prism(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new Mesh(prismGeo(w, h, d), mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

// Gable roof over a w x d footprint whose eaves sit at y; ridge along `axis` ('z' or 'x').
// Returns the ridge height above y.
export function gableRoof(parent, w, d, y, pitchDeg, mat, { overhang = 0.3, thick = 0.14, axis = 'z', cx = 0, cz = 0, trim = null } = {}) {
  const span = (axis === 'z' ? w : d) / 2 + overhang
  const len = (axis === 'z' ? d : w) + overhang * 2
  const a = (pitchDeg * Math.PI) / 180
  const rise = span * Math.tan(a)
  const panelW = span / Math.cos(a)
  for (const s of [-1, 1]) {
    const m = new Mesh(axis === 'z' ? boxGeo(panelW, thick, len) : boxGeo(len, thick, panelW), mat)
    if (axis === 'z') {
      m.position.set(cx + (s * span) / 2, y + rise / 2 + thick / 2, cz)
      m.rotation.z = -s * a
    } else {
      m.position.set(cx, y + rise / 2 + thick / 2, cz + (s * span) / 2)
      m.rotation.x = s * a
    }
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
  }
  if (trim) {
    const r = new Mesh(axis === 'z' ? boxGeo(0.22, 0.22, len + 0.04) : boxGeo(len + 0.04, 0.22, 0.22), trim)
    r.position.set(cx, y + rise + thick * 0.6, cz)
    r.castShadow = true
    parent.add(r)
  }
  return rise
}
