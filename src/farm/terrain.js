import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from 'three'
import { FARM } from '../config.js'
import { mulberry32 } from '../textures.js'
import { M, addSurface, block, gated, inRect, solid, solidRect } from './kit.js'
import { paintAsphalt, paintConcrete, paintDirt, paintGrass, paintPavers, paintRoad, paintSoil, tex } from './textures.js'

// The ground: a lawn that stays flat over the plot and rolls up into low-poly
// hills and distant blue mountains outside it; the east-west road with raised
// sidewalks; and every flat surface patch of the plot (dirt yard, pavers,
// concrete pads, driveway, field soil), each registered for footstep sounds.

// --- Height field ---------------------------------------------------------------------
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// Distance outside the flat area.
function outside(x, z) {
  const f = FARM.flat
  const dx = Math.max(f.minX - x, 0, x - f.maxX)
  const dz = Math.max(f.minZ - z, 0, z - f.maxZ)
  let d = Math.hypot(dx, dz)
  // The town hub (the town and the three farm slots around it) stays flat too.
  const H = FARM.hub
  const tx = Math.max(H.minX - x, 0, x - (H.maxX + 10))
  const tz = Math.max(H.minZ - 10 - z, 0, z - (H.maxZ + 10))
  d = Math.min(d, Math.hypot(tx, tz) * 1.6)
  // The road and railway valleys stay flat (a gentle bank on each side).
  for (const c of FARM.corridors) {
    if (c.x !== undefined) {
      if (z > c.minZ) d = Math.min(d, Math.max(0, Math.abs(x - c.x) - c.half) * 1.6)
    } else d = Math.min(d, Math.max(0, Math.abs(z - c.z) - c.half) * 1.6)
  }
  return d
}
// Ground height at (x, z): 0 on the plot, rolling hills beyond.
export function groundHeight(x, z) {
  const d = outside(x, z)
  if (d <= 0) return 0
  const k = smooth(0, 160, d)
  const hills = vnoise(x / 140, z / 140) * 46 + vnoise(x / 60 + 7, z / 60 - 3) * 16 + vnoise(x / 25, z / 25) * 4
  // The north (behind the farm) climbs higher, like the screenshots' backdrop.
  const north = smooth(-150, -700, z) * 40
  return k * (hills + north) - (1 - k) * 0
}

// --- Ground mesh ------------------------------------------------------------------------
function buildLand(root) {
  const size = 2600
  const seg = 180
  const geo = new PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new Color()
  const near = new Color('#ffffff')
  const meadow = [new Color('#a9bf78'), new Color('#8fae62'), new Color('#7c9d55'), new Color('#bcc283')]
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = groundHeight(x, z)
    pos.setY(i, h - 0.02)
    // Near the plot the grass texture shows as is; out on the hills big
    // patches of lighter / yellower meadow tint it (vertex colours).
    const d = outside(x, z)
    const k = smooth(0, 90, d)
    const n = vnoise(x / 45, z / 45)
    c.copy(meadow[Math.floor(n * 3.99)]).lerp(meadow[Math.floor(vnoise(x / 18 + 5, z / 18) * 3.99)], 0.4)
    c.lerp(near, 1 - k)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const grass = tex(paintGrass(), size / 9)
  const mat = new MeshStandardMaterial({ map: grass, color: '#d3dcbc', vertexColors: true, roughness: 0.95 })
  const land = new Mesh(geo, mat)
  land.receiveShadow = true
  land.userData.noGround = true // flat (y = 0) where it can be walked: nothing for farm/ground.js
  root.add(land)
}

// Distant mountain ring: big low-poly blue-green peaks, softened by fog.
function buildMountains(root) {
  const rand = mulberry32(4401)
  const ring = new PlaneGeometry(1, 1, 120, 10)
  const pos = ring.attributes.position
  const inner = 1150
  const outer = 1450
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5 // 0..1 around
    const v = pos.getY(i) + 0.5 // 0..1 outward
    const ang = u * Math.PI * 2
    const r = inner + (outer - inner) * v
    const peaks = vnoise(u * 22, 3.3) * 0.6 + vnoise(u * 55, 9.1) * 0.3 + vnoise(u * 7, 1.7) * 0.6
    const profile = Math.sin(v * Math.PI) ** 0.8
    const northBoost = 0.7 + 0.5 * Math.max(0, -Math.sin(ang)) // taller behind the farm (north = -Z)
    const h = profile * (70 + peaks * 190) * northBoost - 20
    pos.setXYZ(i, Math.cos(ang) * r, h, Math.sin(ang) * r)
  }
  ring.computeVertexNormals()
  const mat = new MeshStandardMaterial({ color: '#7fa5a8', roughness: 1, flatShading: true, side: DoubleSide })
  const m = new Mesh(ring, mat)
  m.userData.noGround = true
  root.add(m)
  // A second, closer ring of greener forested hills.
  const ring2 = new PlaneGeometry(1, 1, 160, 8)
  const p2 = ring2.attributes.position
  for (let i = 0; i < p2.count; i++) {
    const u = p2.getX(i) + 0.5
    const v = p2.getY(i) + 0.5
    const ang = u * Math.PI * 2
    const r = 820 + 260 * v
    const n = vnoise(u * 30, 2.2) * 0.7 + vnoise(u * 80, 4.4) * 0.3
    const h = Math.sin(v * Math.PI) ** 0.7 * (50 + n * 80) - 10 + rand() * 2
    p2.setXYZ(i, Math.cos(ang) * r, h, Math.sin(ang) * r)
  }
  ring2.computeVertexNormals()
  const m2 = new Mesh(ring2, new MeshStandardMaterial({ color: '#6f9a5c', roughness: 1, flatShading: true, side: DoubleSide }))
  m2.userData.noGround = true
  root.add(m2)
}

// --- Flat patches ----------------------------------------------------------------------------
// A textured rectangle lying on the ground at height y (world-space tiling: `tile` m per repeat).
function patch(root, r, y, map, tile, extra = {}) {
  const w = r.maxX - r.minX
  const d = r.maxZ - r.minZ
  const geo = new PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2)
  const t = map.clone()
  t.repeat.set(w / tile, d / tile)
  t.needsUpdate = true
  // Flat decals stack a few cm apart; the depth buffer can't separate them at distance, so
  // each layer gets a depth bias that grows with its height (higher layer always wins).
  const mat = new MeshStandardMaterial({
    map: t, roughness: 0.92,
    polygonOffset: true, polygonOffsetFactor: -1 - y * 20, polygonOffsetUnits: -1 - y * 200,
    ...extra,
  })
  if (extra.normalMap) {
    const n = extra.normalMap.clone()
    n.repeat.copy(t.repeat)
    n.needsUpdate = true
    mat.normalMap = n
  }
  const m = new Mesh(geo, mat)
  m.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2)
  m.receiveShadow = true
  root.add(m)
  return m
}

// Raised slab (sidewalk, curb-edged pad) with a textured top and concrete sides.
function slab(root, r, h, map, tile) {
  const top = patch(root, r, h + 0.006, map, tile)
  const side = M('#a7a49d')
  block(root, r.maxX - r.minX, h, r.maxZ - r.minZ, side, (r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2, 0, false)
  return top
}

// --- Leaves on the ground ------------------------------------------------------------------------
const LEAF_COLORS = ['#e8732a', '#d9462a', '#f2a530', '#c9561f', '#f4c542', '#b83a26', '#e98f35']
function scatterLeaves(root, count, place, seed) {
  const rand = mulberry32(seed)
  const geo = new PlaneGeometry(0.42, 0.3)
  geo.rotateX(-Math.PI / 2)
  const mat = new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide })
  const mesh = new InstancedMesh(geo, mat, count)
  const o = new Object3D()
  const c = new Color()
  let n = 0
  for (let tries = 0; tries < count * 4 && n < count; tries++) {
    const p = place(rand)
    if (!p) continue
    o.position.set(p.x, p.y + 0.012 + rand() * 0.01, p.z)
    o.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2)
    const s = 0.6 + rand() * 0.9
    o.scale.set(s, 1, s)
    o.updateMatrix()
    mesh.setMatrixAt(n, o.matrix)
    mesh.setColorAt(n, c.set(LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)]).multiplyScalar(0.85 + rand() * 0.3))
    n++
  }
  mesh.count = n
  mesh.receiveShadow = true
  root.add(mesh)
}

// --- Build --------------------------------------------------------------------------------------
export function buildTerrain(root) {
  buildLand(root)
  buildMountains(root)

  const F = FARM
  const dirt = tex(paintDirt(), 1)
  const soil = tex(paintSoil(), 1)
  const concrete = tex(paintConcrete(512, 2), 1)
  const sidewalk = tex(paintConcrete(512, 2, '#c9c6bf', '#b3b0a9', 975), 1)
  const asphalt = tex(paintAsphalt(), 1)
  const pavers = paintPavers()
  const paverTex = tex(pavers.color, 1)
  const paverNormal = tex(pavers.normal, 1, 1, false)

  // Road: one long strip, dash cycle 9 m.
  const roadTex = tex(paintRoad(), 1)
  const road = { minX: F.road.minX, maxX: F.road.maxX, minZ: F.road.z - F.road.width / 2, maxZ: F.road.z + F.road.width / 2 }
  const roadMesh = patch(root, road, 0.03, roadTex, 9)
  roadMesh.material.map.repeat.set((road.maxX - road.minX) / 9, 1)
  addSurface(road, 'asphalt')

  // Sidewalks (raised) on both sides; the south one breaks for the side road, both for Main
  // Street, which has its own sidewalks through the town.
  const SR = F.sideRoad
  const sx0 = SR.x - SR.width / 2 - 3
  const sx1 = SR.x + SR.width / 2 + 3
  const MS = F.mainStreet
  const mx0 = MS.x - MS.width / 2 - 3
  const mx1 = MS.x + MS.width / 2 + 3
  const T = F.town
  const southWalks = [
    { ...F.sidewalkS, maxX: sx0 },
    { ...F.sidewalkS, minX: sx1, maxX: mx0 },
    { ...F.sidewalkS, minX: mx1 },
    { minX: sx0, maxX: sx0 + 3, minZ: F.sidewalkS.maxZ, maxZ: SR.maxZ },
    { minX: sx1 - 3, maxX: sx1, minZ: F.sidewalkS.maxZ, maxZ: SR.maxZ },
    // Main Street's sidewalks: north of the road up to the town's edge, south of it down to the town's edge.
    { minX: mx0, maxX: mx0 + 3, minZ: T.minZ + 4, maxZ: F.sidewalkN.minZ },
    { minX: mx1 - 3, maxX: mx1, minZ: T.minZ + 4, maxZ: F.sidewalkN.minZ },
    { minX: mx0, maxX: mx0 + 3, minZ: F.sidewalkS.maxZ, maxZ: T.maxZ - 4 },
    { minX: mx1 - 3, maxX: mx1, minZ: F.sidewalkS.maxZ, maxZ: T.maxZ - 4 },
  ]
  for (const w of [{ ...F.sidewalkN, maxX: mx0 }, { ...F.sidewalkN, minX: mx1 }]) {
    slab(root, w, F.curbHeight, sidewalk, 4)
    addSurface(w, 'concrete')
    solidRect(w.minX, w.maxX, w.minZ, w.maxZ, F.curbHeight)
  }
  for (const w of southWalks) {
    slab(root, w, F.curbHeight, sidewalk, 4)
    addSurface(w, 'concrete')
    solidRect(w.minX, w.maxX, w.minZ, w.maxZ, F.curbHeight)
  }
  // The side road: same asphalt, its dash cycle running north-south.
  const side = { minX: SR.x - SR.width / 2, maxX: SR.x + SR.width / 2, minZ: road.maxZ, maxZ: SR.maxZ }
  const sideMesh = patch(root, side, 0.031, roadTex, 9)
  sideMesh.rotation.y = 0
  sideMesh.geometry.dispose()
  const sideGeo = new PlaneGeometry(side.maxZ - side.minZ, side.maxX - side.minX)
  sideGeo.rotateX(-Math.PI / 2)
  sideGeo.rotateY(Math.PI / 2)
  sideMesh.geometry = sideGeo
  sideMesh.material.map.repeat.set((side.maxZ - side.minZ) / 9, 1)
  addSurface(side, 'asphalt')
  // Main Street: north from the north farm's gate (over the rail crossing) to the south farm's gate.
  const R = F.rail
  for (const [z0, z1] of [[MS.minZ, R.z - 3.4], [R.z + 3.4, road.minZ], [road.maxZ, MS.maxZ]]) {
    const r = { minX: MS.x - MS.width / 2, maxX: MS.x + MS.width / 2, minZ: z0, maxZ: z1 }
    const geo = new PlaneGeometry(z1 - z0, MS.width)
    geo.rotateX(-Math.PI / 2)
    geo.rotateY(Math.PI / 2)
    const m = patch(root, r, 0.032, roadTex, 9)
    m.geometry.dispose()
    m.geometry = geo
    m.material.map.repeat.set((z1 - z0) / 9, 1)
    addSurface(r, 'asphalt')
  }

  // The wide dirt road north of the plot.
  const dirtRoad = tex(paintDirt(512, '#9c7550', '#7a5638', 941), 1)
  patch(root, FARM.dirtRoad, 0.025, dirtRoad, 8).material.map.repeat.set((FARM.dirtRoad.maxX - FARM.dirtRoad.minX) / 8, (FARM.dirtRoad.maxZ - FARM.dirtRoad.minZ) / 8)
  addSurface(FARM.dirtRoad, 'dirt')

  // Plot patches.
  patch(root, F.chickenYard, 0.025, dirt, 7)
  addSurface(F.chickenYard, 'dirt')
  patch(root, F.path, 0.022, dirt, 7)
  addSurface(F.path, 'dirt')
  patch(root, F.standPlaza, 0.04, paverTex, 4, { normalMap: paverNormal })
  addSurface(F.standPlaza, 'pavers')
  // Ground that belongs to something bought is laid with it (plain lawn until then).
  gated(root, 'field1', (G) => {
    patch(G, F.field, 0.02, soil, 4)
    addSurface(F.field, 'soil')
  }, 0.3)
  gated(root, 'seedMarket', (G) => {
    patch(G, F.plaza, 0.04, paverTex, 4, { normalMap: paverNormal })
    addSurface(F.plaza, 'pavers')
  }, 0.3)
  gated(root, 'storage', (G) => {
    patch(G, F.dropOff, 0.05, concrete, 6)
    addSurface(F.dropOff, 'concrete')
  }, 0.3)
  // Truck Bay: apron, the driveway and bay floor (asphalt, cut through the north
  // sidewalk), its crosswalk and stop line.
  gated(root, 'truckBay', (G) => {
    patch(G, F.bayApron, 0.05, concrete, 6)
    addSurface(F.bayApron, 'concrete')
    const drive = { minX: F.driveway.minX, maxX: F.driveway.maxX, minZ: F.truckBay.minZ, maxZ: F.sidewalkN.maxZ }
    patch(G, drive, F.curbHeight + 0.025, asphalt, 5)
    addSurface(drive, 'asphalt')
    solidRect(drive.minX, drive.maxX, drive.minZ, drive.maxZ, F.curbHeight)
    // Crosswalk on the driveway mouth (stripes run north-south, in a row east-west).
    const stripe = M('#f4f4ef', { roughness: 0.6 })
    for (let x = F.driveway.minX + 1.2; x < F.driveway.maxX - 0.6; x += 1.9) {
      block(G, 1.0, 0.02, 5.2, stripe, x + 0.5, F.curbHeight + 0.03, (F.sidewalkN.minZ + F.sidewalkN.maxZ) / 2 - 2.2, 0, false)
    }
    // A yellow stop line at the bay mouth.
    block(G, F.truckBay.maxX - F.truckBay.minX - 1, 0.02, 0.35, M('#f2c230', { roughness: 0.6 }), (F.truckBay.minX + F.truckBay.maxX) / 2, F.curbHeight + 0.03, F.truckBay.maxZ - 6, 0, false)
  }, 0.3)

  // --- Colliders -------------------------------------------------------------------------
  // The ground: 200 m tiles, not one 4 km slab. Against a box that big Rapier's character
  // controller lost precision and its snap-to-ground pushed the player up to 0.4 m into the
  // floor in places (by the railway, on pads); tiles this size keep it exact (see kit.js solid).
  const GT = 100
  for (let x = -2000 + GT; x < 2000; x += GT * 2) for (let z = -2000 + GT; z < 2000; z += GT * 2) solid(GT, 0.5, GT, x, -0.5, z, 0, GT)
  // Walls around the walkable area (the hills are scenery).
  const W = F.walk
  const h = 30
  solidRect(W.minX - 1, W.maxX + 1, W.minZ - 1, W.minZ, h)
  solidRect(W.minX - 1, W.maxX + 1, W.maxZ, W.maxZ + 1, h)
  // West: open onto the Processing Park annex (F.walkWest), which has its own walls.
  const WW = F.walkWest
  solidRect(W.minX - 1, W.minX, W.minZ, WW.minZ, h)
  solidRect(W.minX - 1, W.minX, WW.maxZ, W.maxZ, h)
  solidRect(WW.minX - 1, WW.maxX, WW.minZ - 1, WW.minZ, h)
  solidRect(WW.minX - 1, WW.maxX, WW.maxZ, WW.maxZ + 1, h)
  solidRect(WW.minX - 1, WW.minX, WW.minZ, WW.maxZ, h)
  // East: open where the road runs on into town (z 26..104); the hub (the town and the farms
  // around it) has its own walls.
  const H = F.hub
  solidRect(W.maxX, W.maxX + 1, Math.min(W.minZ, H.minZ), 26, h)
  solidRect(W.maxX, W.maxX + 1, 104, Math.max(W.maxZ, H.maxZ), h)
  solidRect(H.minX, H.maxX + 1, H.minZ - 1, H.minZ, h)
  solidRect(H.minX, H.maxX + 1, H.maxZ, H.maxZ + 1, h)
  solidRect(H.maxX, H.maxX + 1, H.minZ, H.maxZ, h)

  // --- Fallen leaves -------------------------------------------------------------------------
  // Thick on the road edges and lawn south of the road, sparser on the plot.
  scatterLeaves(
    root,
    2600,
    (rand) => {
      const x = -150 + rand() * 300
      const z = F.sidewalkN.minZ - 1 + rand() * 40
      const onRoad = z > road.minZ && z < road.maxZ
      const y = z > F.sidewalkN.minZ && z < F.sidewalkN.maxZ ? F.curbHeight : z > F.sidewalkS.minZ && z < F.sidewalkS.maxZ ? F.curbHeight : 0.03
      if (onRoad && rand() < 0.35) return null
      return { x, y, z }
    },
    71,
  )
  scatterLeaves(
    root,
    1100,
    (rand) => {
      const x = -150 + rand() * 300
      const z = -130 + rand() * 166
      if (inRect(x, z, F.field) || inRect(x, z, F.truckBay, 0.5) || inRect(x, z, F.barn, 0.5)) return null
      if (inRect(x, z, F.dropOff) && rand() < 0.6) return null
      return { x, y: inRect(x, z, F.dropOff) ? 0.05 : 0.04, z }
    },
    72,
  )
}

