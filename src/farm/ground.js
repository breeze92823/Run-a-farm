import { Box3, DoubleSide, Matrix4, Vector3 } from 'three'
import { FARM, GROUND } from '../config.js'
import { mount } from '../mount.js'
import { RAPIER, world } from '../physics.js'

// Visual ground: the physics floor is flat at y = 0 plus the colliders the farm registers,
// but plenty of what is drawn on the ground is a little higher and has no collider (field
// and plot ridges, rail ballast and sleepers, the barn floor, pads, raised beds, crossing
// planks, plazas in the town). Feet and wheels sank into those.
// This indexes every drawn upward face between GROUND.minY and GROUND.maxY inside the
// walkable areas (in 2 m cells) and answers "how high is the drawn ground here"; the drawn
// player (and so the vehicle they ride), parked vehicles and the farm's own tractors /
// trucks sit on it. Only meshes that are shown and still where they were indexed count, so
// hidden (unbought) buildings and anything that moves (vehicles, animals) are never stood on.
// Indexing runs a few ms a frame (never a load hitch); a rescan every GROUND.rescan s picks
// up new meshes (bought plots, other players' farms) and ones that moved and settled again
// (a bought building that has finished rising out of the ground).
// Flag a group `userData.noGround` to keep it out (vehicles, the land and mountains).

const CELL = 2
const BUDGET = 3 // ms of indexing per frame while the first index is built
const RESCAN_BUDGET = 1.5 // ms per frame for the rescans after it
let first = true
const cells = new Map() // cell key -> [tri]
const entries = new Map() // mesh -> { mesh, geo, m, iv, last, liv, stamp, tris, q, ok }
let scene = null
let deadTris = 0 // triangles of replaced / removed meshes still in the cells
let liveTris = 0
let rescanT = 0
let query = 0
let lift = 0
let scanId = 0
const queue = []
let qi = 0
let scanning = false

const key = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768)
const a = new Vector3()
const b = new Vector3()
const c = new Vector3()
const inst = new Matrix4()
const mw = new Matrix4()
const box = new Box3()

// Only ground the player can reach counts (the plot, its west annex, the town hub).
const AREAS = [FARM.walk, FARM.walkWest, FARM.hub]
const inAreas = (minX, maxX, minZ, maxZ) => AREAS.some((r) => maxX > r.minX - 2 && minX < r.maxX + 2 && maxZ > r.minZ - 2 && minZ < r.maxZ + 2)
const BOUNDS = {
  minX: Math.min(...AREAS.map((r) => r.minX)) - 2,
  maxX: Math.max(...AREAS.map((r) => r.maxX)) + 2,
  minZ: Math.min(...AREAS.map((r) => r.minZ)) - 2,
  maxZ: Math.max(...AREAS.map((r) => r.maxZ)) + 2,
}

const flat = (mat) => !mat || mat.side === DoubleSide || mat.transparent || mat.alphaTest > 0 || mat.wireframe
const skipMaterial = (m) => (Array.isArray(m) ? m.some(flat) : flat(m))

// Per instanced geometry: the vertex indices of its triangles that face more or less up in
// its own space (instances only turned about y can have no other upward faces).
const upCache = new WeakMap()
function upTris(geo) {
  let list = upCache.get(geo)
  if (list) return list
  const all = triList(geo)
  const n = triCount(geo, all)
  const pos = geo.attributes.position
  const out = []
  for (let i = 0; i + 2 < n; i += 3) {
    const i0 = all ? all[i] : i
    const i1 = all ? all[i + 1] : i + 1
    const i2 = all ? all[i + 2] : i + 2
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1).sub(a)
    c.fromBufferAttribute(pos, i2).sub(a)
    const ny = b.z * c.x - b.x * c.z
    if (ny > 0 && ny > 0.5 * Math.hypot(b.y * c.z - b.z * c.y, ny, b.x * c.y - b.y * c.x)) out.push(i0, i1, i2)
  }
  list = Uint32Array.from(out)
  upCache.set(geo, list)
  return list
}
// A geometry's triangle list: its index, or null for non-indexed (vertices in order).
const triList = (geo) => (geo.index ? geo.index.array : null)
const triCount = (geo, list) => (list ? list.length : geo.attributes.position.count)

const pushTri = (tris, ax, ay, az, bx, by, bz, cx, cy, cz) => {
  const minX = Math.min(ax, bx, cx)
  const maxX = Math.max(ax, bx, cx)
  const minZ = Math.min(az, bz, cz)
  const maxZ = Math.max(az, bz, cz)
  if (!inAreas(minX, maxX, minZ, maxZ)) return
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
  if (Math.abs(d) < 1e-9) return
  tris.push({ ax, az, ay, bx, bz, by, cx, cz, cy, d, minX, maxX, minZ, maxZ, e: null })
}

// The fast path (a piece only turned about y): plain arithmetic on the position array,
// height band first (world y = e5 * y + e13), then the face's slope and size.
function uprightTris(P, list, n, e, flip, tris) {
  const { minY, maxY, minArea, minNy } = GROUND
  const e0 = e[0], e2 = e[2], e5 = e[5], e8 = e[8], e10 = e[10], e12 = e[12], e13 = e[13], e14 = e[14]
  for (let i = 0; i + 2 < n; i += 3) {
    const j0 = (list ? list[i] : i) * 3
    const ay = e5 * P[j0 + 1] + e13
    if (ay < minY || ay > maxY) continue
    const j1 = (list ? list[i + 1] : i + 1) * 3
    const by = e5 * P[j1 + 1] + e13
    if (by < minY || by > maxY) continue
    const j2 = (list ? list[i + 2] : i + 2) * 3
    const cy = e5 * P[j2 + 1] + e13
    if (cy < minY || cy > maxY) continue
    const ax = e0 * P[j0] + e8 * P[j0 + 2] + e12
    const az = e2 * P[j0] + e10 * P[j0 + 2] + e14
    const bx = e0 * P[j1] + e8 * P[j1 + 2] + e12
    const bz = e2 * P[j1] + e10 * P[j1 + 2] + e14
    const cx = e0 * P[j2] + e8 * P[j2 + 2] + e12
    const cz = e2 * P[j2] + e10 * P[j2 + 2] + e14
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = cx - ax, vy = cy - ay, vz = cz - az
    const ny = (uz * vx - ux * vz) * flip
    if (ny <= 0 || ny / 2 < minArea) continue
    if (ny / Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) < minNy) continue
    pushTri(tris, ax, ay, az, bx, by, bz, cx, cy, cz)
  }
}

// Upward faces of `mesh` (world space, every instance), within the height band.
function extract(mesh) {
  const geo = mesh.geometry
  const pos = geo?.attributes?.position
  const tris = []
  if (!pos || mesh.isSkinnedMesh || skipMaterial(mesh.material)) return tris
  for (let o = mesh; o; o = o.parent) if (o.userData.noGround) return tris
  if (!geo.boundingBox) geo.computeBoundingBox()
  const bb = geo.boundingBox
  const hx = (bb.max.x - bb.min.x) / 2
  const hz = (bb.max.z - bb.min.z) / 2
  const lcx = (bb.max.x + bb.min.x) / 2
  const lcz = (bb.max.z + bb.min.z) / 2
  const P = !pos.isInterleavedBufferAttribute && pos.itemSize === 3 && !pos.normalized ? pos.array : null
  const count = mesh.isInstancedMesh ? mesh.count : 1
  for (let k = 0; k < count; k++) {
    if (mesh.isInstancedMesh) {
      mesh.getMatrixAt(k, inst)
      mw.multiplyMatrices(mesh.matrixWorld, inst)
    } else mw.copy(mesh.matrixWorld)
    const e = mw.elements
    // Upright (only turned about y, scaled): world y = e5 * local y + e13, so whole pieces
    // outside the band, too small to hold a big face (grass, crop, eggs) or away from the
    // walkable areas go without touching a triangle.
    const upright = Math.abs(e[1]) + Math.abs(e[9]) + Math.abs(e[4]) + Math.abs(e[6]) < 1e-6 && e[5] > 0
    let list
    if (upright) {
      if (e[5] * bb.max.y + e[13] < GROUND.minY || e[5] * bb.min.y + e[13] > GROUND.maxY) continue
      const sx = Math.hypot(e[0], e[2])
      const sz = Math.hypot(e[8], e[10])
      if (2 * hx * sx * 2 * hz * sz < 2 * GROUND.minArea) continue
      const r = Math.hypot(hx * sx, hz * sz)
      const wx = e[0] * lcx + e[8] * lcz + e[12]
      const wz = e[2] * lcx + e[10] * lcz + e[14]
      if (!inAreas(wx - r, wx + r, wz - r, wz + r)) continue
      list = mesh.isInstancedMesh ? upTris(geo) : triList(geo)
    } else {
      box.copy(bb).applyMatrix4(mw)
      if (box.max.y < GROUND.minY || box.min.y > GROUND.maxY) continue
      if ((box.max.x - box.min.x) * (box.max.z - box.min.z) < 2 * GROUND.minArea) continue
      if (!inAreas(box.min.x, box.max.x, box.min.z, box.max.z)) continue
      list = triList(geo)
    }
    const flip = mw.determinant() < 0 ? -1 : 1
    if (upright && P) {
      uprightTris(P, list, triCount(geo, list), e, flip, tris)
      continue
    }
    const n = triCount(geo, list)
    for (let i = 0; i + 2 < n; i += 3) {
      const i0 = list ? list[i] : i
      const i1 = list ? list[i + 1] : i + 1
      const i2 = list ? list[i + 2] : i + 2
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw)
      if (a.y < GROUND.minY || a.y > GROUND.maxY) continue
      b.fromBufferAttribute(pos, i1).applyMatrix4(mw)
      if (b.y < GROUND.minY || b.y > GROUND.maxY) continue
      c.fromBufferAttribute(pos, i2).applyMatrix4(mw)
      if (c.y < GROUND.minY || c.y > GROUND.maxY) continue
      // Face normal (b - a) x (c - a): its y is twice the top-view area.
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
      const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
      const nx = uy * vz - uz * vy
      const ny = (uz * vx - ux * vz) * flip
      const nz = ux * vy - uy * vx
      if (ny <= 0 || ny / 2 < GROUND.minArea) continue
      if (ny / Math.hypot(nx, ny, nz) < GROUND.minNy) continue
      pushTri(tris, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    }
  }
  return tris
}

// Files a triangle in every cell it covers (within the walkable bounds: the railway's
// ballast runs on for kilometres).
function file(t) {
  const x0 = Math.floor(Math.max(t.minX, BOUNDS.minX) / CELL)
  const x1 = Math.floor(Math.min(t.maxX, BOUNDS.maxX) / CELL)
  const z0 = Math.floor(Math.max(t.minZ, BOUNDS.minZ) / CELL)
  const z1 = Math.floor(Math.min(t.maxZ, BOUNDS.maxZ) / CELL)
  for (let ix = x0; ix <= x1; ix++) {
    for (let iz = z0; iz <= z1; iz++) {
      const k = key(ix, iz)
      let list = cells.get(k)
      if (!list) cells.set(k, (list = []))
      list.push(t)
    }
  }
}

// Retires an entry: its triangles stay filed but never count (dead) until the next rebuild.
function retire(e) {
  e.dead = true
  deadTris += e.tris.length
  liveTris -= e.tris.length
}

function index(mesh) {
  const old = entries.get(mesh)
  if (old) retire(old)
  mesh.updateWorldMatrix(true, false) // added this frame: not drawn (so not updated) yet
  const m = Float64Array.from(mesh.matrixWorld.elements)
  const iv = mesh.instanceMatrix?.version ?? 0
  const e = { mesh, geo: mesh.geometry, m, iv, last: Float64Array.from(m), liv: iv, stamp: scanId, tris: extract(mesh), q: -1, ok: false, dead: false }
  for (const t of e.tris) {
    t.e = e
    file(t)
  }
  liveTris += e.tris.length
  entries.set(mesh, e)
}

// Refiles every live triangle, dropping the dead ones (once they outnumber the live).
function rebuildCells() {
  cells.clear()
  for (const e of entries.values()) for (const t of e.tris) file(t)
  deadTris = 0
}

const same = (m, s) => {
  for (let i = 0; i < 16; i++) if (Math.abs(m[i] - s[i]) > 1e-3) return false
  return true
}

// A scan walks every mesh in the scene, a few ms a frame: it indexes the ones that are new,
// have new geometry, or moved and have stood still since the last scan; whatever is no longer
// in the scene is dropped once the walk is done.
function startScan() {
  scanId++
  queue.length = 0
  qi = 0
  scene.traverse((o) => {
    if (o.isMesh) queue.push(o)
  })
  scanning = true
}

// True when it (re)indexed the mesh (the costly part).
function visit(o) {
  const e = entries.get(o)
  if (!e || e.geo !== o.geometry) {
    index(o)
    return true
  }
  e.stamp = scanId
  const m = o.matrixWorld.elements
  const iv = o.instanceMatrix?.version ?? 0
  if (iv === e.iv && same(m, e.m)) return false
  // Moved: index it again once it has stopped (a risen building, a rebuilt plot), never
  // while it keeps moving (vehicles, animals).
  if (iv === e.liv && same(m, e.last)) {
    index(o)
    return true
  }
  e.last.set(m)
  e.liv = iv
  return false
}

function work(budget) {
  const end = performance.now() + budget
  while (qi < queue.length) {
    const heavy = visit(queue[qi++])
    if ((heavy || (qi & 63) === 0) && performance.now() > end) return
  }
  for (const [mesh, e] of entries) {
    if (e.stamp === scanId) continue
    entries.delete(mesh)
    retire(e)
  }
  if (deadTris > Math.max(2000, liveTris)) rebuildCells()
  queue.length = 0
  qi = 0
  scanning = false
}

// Is this mesh shown, in the scene, and still where (and as) it was indexed?
function live(e) {
  if (e.q === query) return e.ok
  e.q = query
  e.ok = false
  if (e.dead) return false
  const mesh = e.mesh
  let o = mesh
  for (; o.parent; o = o.parent) if (!o.visible) return false
  if (o !== scene || !o.visible) return false
  if (mesh.isInstancedMesh && mesh.instanceMatrix.version !== e.iv) return false
  if (!same(mesh.matrixWorld.elements, e.m)) return false
  e.ok = true
  return true
}

function topAt(x, z, maxY, best) {
  const list = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return best
  for (const t of list) {
    if (x < t.minX || x > t.maxX || z < t.minZ || z > t.maxZ) continue
    const l1 = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / t.d
    if (l1 < -1e-6) continue
    const l2 = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / t.d
    if (l2 < -1e-6 || l1 + l2 > 1 + 1e-6) continue
    const h = l1 * t.ay + l2 * t.by + (1 - l1 - l2) * t.cy
    if (h <= best || h > maxY) continue
    if (live(t.e)) best = h
  }
  return best
}

// The highest drawn ground at (x, z) no higher than maxY, sampled at the centre and at four
// points `r` m around it (a wide wheelbase rides over furrows); -Infinity where there is none.
export function groundTop(x, z, maxY, r = 0) {
  if (!scene) return -Infinity
  query++
  let best = topAt(x, z, maxY, -Infinity)
  if (r > 0) {
    best = topAt(x + r, z, maxY, best)
    best = topAt(x - r, z, maxY, best)
    best = topAt(x, z + r, maxY, best)
    best = topAt(x, z - r, maxY, best)
  }
  return best
}

// Where something set down at (x, z) rests: the top of the static colliders below `fromY`
// (or the ground at 0), raised onto any drawn ground above that.
const STATIC = () => RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
export function restY(x, z, fromY, r = 0) {
  let y = 0
  if (world) {
    const hit = world.castRay(new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }), fromY + 2, true, STATIC())
    if (hit) y = fromY - (hit.timeOfImpact ?? hit.toi)
  }
  return Math.max(y, groundTop(x, z, y + GROUND.reach, r))
}

// Height for the farm's own vehicles on their routes: `base` (the road / curb height they
// already know), raised onto ridges and slabs.
export const rideY = (x, z, base, r = GROUND.radius.tractor) => Math.max(base, groundTop(x, z, base + GROUND.reach, r))

// Lifts the drawn player (feet = renderPosition; the ridden vehicle, the camera and the
// pose sent to other players all follow it) onto the drawn ground. Physics is untouched.
export function liftPlayer(player, dt) {
  const p = player.renderPosition
  const kind = mount.active?.kind
  const r = GROUND.radius[kind ?? 'foot'] ?? GROUND.radius.foot
  const top = groundTop(p.x, p.z, p.y + GROUND.reach, r)
  const want = top - p.y > GROUND.dead ? top - p.y : 0
  lift += Math.max(-GROUND.down * dt, Math.min(GROUND.up * dt, want - lift))
  if (lift < 1e-4) lift = 0
  p.y += lift
}

export function initGround(s) {
  scene = s
  startScan()
}

// Every frame: index a few ms' worth of queued meshes, or start the next rescan when due.
export function updateGround(dt) {
  if (!scene) return
  if (scanning) return work(first ? BUDGET : RESCAN_BUDGET)
  first = false
  rescanT -= dt
  if (rescanT > 0) return
  rescanT = GROUND.rescan
  startScan()
  work(RESCAN_BUDGET)
}
