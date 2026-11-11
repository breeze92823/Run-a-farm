import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import { FARM, inWalk } from '../config.js'
import { mulberry32 } from '../textures.js'
import { E, M, bakeInto, block, box, cyl, gableRoof, inRect, prism, solidCyl, solidRect } from './kit.js'
import { fence } from './fence.js'
import { lampPost } from './props.js'
import { groundHeight } from './terrain.js'

// Everything around the plot: autumn woods (low-poly blob crowns in orange,
// red, gold and rust, instanced), dark pines, bushes, white ranch fences
// across the far fields,
// street lamps along the road, wind turbines turning on the hills, a striped
// hot-air balloon drifting by and the odd flock of birds.

const AUTUMN = ['#f08a24', '#e4632a', '#d9442b', '#f4b23a', '#f7c948', '#c8532a', '#ef9a3a', '#b8402a']

// Keep trees off the plot's built areas and the road.
function blocked(x, z) {
  const F = FARM
  if (z > F.sidewalkN.minZ - 1 && z < F.sidewalkS.maxZ + 2.5) return true // road band
  if (z > F.railFenceN - 3 && z < F.dirtRoad.maxZ + 2) return true // dirt road + railway
  if (x > -72 && x < F.east.maxX + 3 && z > F.northEdge - 4 && z < F.sidewalkN.minZ) return true // the plot itself
  if (inRect(x, z, F.ranch, 2)) return true // the ranch places its own trees
  if (inRect(x, z, { minX: F.town.minX - 4, maxX: F.town.maxX + 14, minZ: 0, maxZ: F.town.maxZ + 10 })) return true // the town
  if (inRect(x, z, F.homestead, 1)) return true // cottage, pumpkin patch
  if (inRect(x, z, F.park, 3)) return true // the Processing Park
  if (z > F.sidewalkN.minZ && Math.abs(x - F.sideRoad.x) < F.sideRoad.width / 2 + 6) return true // side road
  const N2 = F.neighbor2
  if (inRect(x, z, { minX: N2.x - 75, maxX: N2.x + 75, minZ: F.sidewalkS.maxZ, maxZ: N2.z + 60 })) return true // the farm across the road
  if (inRect(x, z, F.west, 3) || inRect(x, z, F.path, 2)) return true // the west plots
  if (inRect(x, z, { minX: F.neighbor.x - 70, maxX: F.neighbor.x + 70, minZ: F.neighbor.z - 60, maxZ: F.sidewalkN.minZ })) return true // the neighbour's farm
  return false
}

let treeCrowns = null
function buildTrees(root, rand) {
  // Deciduous: trunk + 3-4 crown blobs per tree, every blob one instance.
  const trunkGeo = new CylinderGeometry(0.22, 0.38, 1, 6)
  trunkGeo.translate(0, 0.5, 0)
  const blobGeo = new IcosahedronGeometry(1, 0)
  const trunkMat = new MeshStandardMaterial({ color: '#6b4428', roughness: 0.9, flatShading: true })
  const crownMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true })
  const pineGeo = new ConeGeometry(1, 1, 7)
  pineGeo.translate(0, 0.5, 0)
  const pineMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true })
  const trees = []
  const pines = []
  const place = (x, z, big = 1) => {
    if (blocked(x, z)) return
    const y = groundHeight(x, z)
    if (rand() < (big > 1.28 ? 0.5 : 0.28)) pines.push([x, y, z, (5 + rand() * 6) * big])
    else trees.push([x, y, z, (0.8 + rand() * 0.7) * big])
  }
  // Near woods: a dense band south of the road, east of the barn and west of the yard.
  for (let i = 0; i < 260; i++) place(-170 + rand() * 340, 60 + rand() * 90)
  for (let i = 0; i < 110; i++) place(74 + rand() * 80, -130 + rand() * 170)
  for (let i = 0; i < 90; i++) place(-170 + rand() * 60, -130 + rand() * 170)
  for (let i = 0; i < 90; i++) place(-170 + rand() * 340, -170 + rand() * 70)
  // Around the Processing Park (west of the plot): behind it, and between it and the neighbour's farm.
  for (let i = 0; i < 80; i++) place(-345 + rand() * 180, -130 + rand() * 74)
  for (let i = 0; i < 110; i++) place(-430 + rand() * 88, -110 + rand() * 146)
  // Street-side trees right by the south sidewalk (the big ones in the foreground of the screenshots).
  for (let x = -140; x < 140; x += 11 + rand() * 8) place(x, FARM.sidewalkS.maxZ + 4 + rand() * 6, 1.25)
  // The few trees standing inside the ranch fence.
  for (const [x, z] of [...FARM.ranchTrees, ...FARM.eastTrees]) {
    const y = 0
    if (rand() < 0.4) pines.push([x, y, z, 6 + rand() * 4])
    else trees.push([x, y, z, 0.9 + rand() * 0.4])
  }
  // Far forests scattered over the hills.
  for (let i = 0; i < 3200; i++) {
    const a = rand() * Math.PI * 2
    const r = 210 + Math.pow(rand(), 0.9) * 600
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    // Clumped: skip where a slow noise says meadow.
    if (Math.sin(x * 0.012) * Math.cos(z * 0.015) + Math.sin(x * 0.031 + z * 0.02) * 0.5 < -0.2) continue
    place(x, z, 1.3)
  }

  const o = new Object3D()
  const c = new Color()
  const trunks = new InstancedMesh(trunkGeo, trunkMat, trees.length)
  const blobs = new InstancedMesh(blobGeo, crownMat, trees.length * 4)
  let b = 0
  trees.forEach(([x, y, z, s], i) => {
    const h = 2.4 * s
    o.position.set(x, y, z)
    o.rotation.set(0, rand() * 6, (rand() - 0.5) * 0.08)
    o.scale.set(s, h, s)
    o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
    const base = AUTUMN[Math.floor(rand() * AUTUMN.length)]
    const n = 3 + Math.floor(rand() * 2)
    for (let k = 0; k < n; k++) {
      const r = (1.5 + rand() * 0.9) * s * (k === 0 ? 1.15 : 0.85)
      const a = (k / n) * Math.PI * 2 + rand()
      const off = k === 0 ? 0 : 1.0 * s
      o.position.set(x + Math.cos(a) * off, y + h + r * 0.55 + (k === 0 ? 0.6 * s : rand() * 0.8 * s), z + Math.sin(a) * off)
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3)
      o.scale.set(r, r * (0.8 + rand() * 0.25), r)
      o.updateMatrix()
      blobs.setMatrixAt(b, o.matrix)
      blobs.setColorAt(b, c.set(base).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.1))
      b++
    }
  })
  blobs.count = b
  const pineMesh = new InstancedMesh(pineGeo, pineMat, pines.length * 3)
  const pineTrunks = new InstancedMesh(trunkGeo, trunkMat, pines.length)
  let p = 0
  pines.forEach(([x, y, z, h], i) => {
    o.position.set(x, y, z)
    o.rotation.set(0, 0, 0)
    o.scale.set(0.8, h * 0.3, 0.8)
    o.updateMatrix()
    pineTrunks.setMatrixAt(i, o.matrix)
    const tone = c.set('#2f6b3a').offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.08).clone()
    for (let k = 0; k < 3; k++) {
      const w = h * (0.34 - k * 0.08)
      o.position.set(x, y + h * (0.22 + k * 0.22), z)
      o.rotation.set(0, rand() * 6, 0)
      o.scale.set(w, h * 0.42, w)
      o.updateMatrix()
      pineMesh.setMatrixAt(p, o.matrix)
      pineMesh.setColorAt(p, tone)
      p++
    }
  })
  for (const m of [trunks, blobs, pineMesh, pineTrunks]) {
    m.castShadow = true
    m.receiveShadow = true
    root.add(m)
  }
  // Each blob's autumn colour, kept so the seasons (farm/seasons.js) can repaint the crowns.
  const autumn = new Float32Array(blobs.instanceColor.array.slice(0, b * 3))
  treeCrowns = { blobs, autumn, count: b }
  // Colliders for the trees the player can actually reach.
  for (const [x, , z, s] of trees) if (inWalk(x, z)) solidCyl(0.35 * s, 4, x, z)
  for (const [x, , z] of pines) if (inWalk(x, z)) solidCyl(0.5, 4, x, z)
}

function buildBushes(root, rand) {
  const geo = new IcosahedronGeometry(1, 0)
  const mat = new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85 })
  const spots = []
  for (let i = 0; i < 200; i++) {
    const x = -150 + rand() * 300
    const z = -130 + rand() * 280
    if (blocked(x, z)) continue
    spots.push([x, z])
  }
  // Along the outside of the plot fences.
  for (let x = -70; x < 72; x += 5 + rand() * 6) spots.push([x, FARM.northEdge - 2 - rand() * 2])
  const mesh = new InstancedMesh(geo, mat, spots.length * 2)
  const o = new Object3D()
  const c = new Color()
  let n = 0
  for (const [x, z] of spots) {
    const tone = rand() < 0.3 ? AUTUMN[Math.floor(rand() * AUTUMN.length)] : '#5a9a3a'
    for (let k = 0; k < 2; k++) {
      const r = 0.6 + rand() * 0.6
      o.position.set(x + (k ? 0.6 : 0), r * 0.5, z + (k ? 0.3 : 0))
      o.rotation.set(rand(), rand(), rand())
      o.scale.set(r, r * 0.75, r)
      o.updateMatrix()
      mesh.setMatrixAt(n, o.matrix)
      mesh.setColorAt(n, c.set(tone).offsetHSL(0, 0, (rand() - 0.5) * 0.1))
      n++
    }
  }
  mesh.count = n
  mesh.castShadow = true
  mesh.receiveShadow = true
  root.add(mesh)
}

function plotFences() {
  // The plot's north fence, with an opening onto the dirt road, and its east/west ends.
  const N = FARM.northEdge
  const G = FARM.northGate
  fence([[FARM.westPath.maxX, N], [G.minX, N]], 'wood') // west of here, west.js fences the plots
  fence([[G.maxX, N], [FARM.east.maxX, N], [FARM.east.maxX, FARM.east.maxZ], [FARM.dropOff.maxX + 1.5, FARM.east.maxZ]], 'wood')
  // Far ranch fences on the hill pastures beyond the ranch.
  fence([[-200, -300], [-60, -296], [80, -302], [200, -296]], 'white', { collide: false })
  fence([[-60, -296], [-66, -380]], 'white', { collide: false })
}

function streetLamps(root, addLamp) {
  const g = new Group()
  for (let x = -120; x <= 120; x += 30) {
    const z = FARM.sidewalkS.minZ + 1
    const [bx, by, bz] = lampPost(g, x, z, 5.6, 'street')
    if (Math.abs(x) <= 60) addLamp(bx, by, bz)
    solidCyl(0.18, 5, x, z)
  }
  bakeInto(root, g)
}

// --- Wind turbines ------------------------------------------------------------------------
function turbines(root, rand) {
  const list = []
  const white = M('#f4f4f2', { roughness: 0.45 })
  // A row along the ridge north of the ranch (the big ones behind the railway), more on far hills.
  const spots = [
    [-170, -345], [-95, -330], [-20, -338], [55, -326], [130, -342], [205, -360],
    [-300, -420], [290, -440], [-420, -260], [440, -250], [-380, 330], [-160, 420], [120, 430], [360, 360],
  ]
  const bladeGeo = new BoxGeometry(0.9, 26, 0.25)
  bladeGeo.translate(0, 13, 0)
  for (const [x, z] of spots) {
    const y = groundHeight(x, z)
    const g = new Group()
    g.position.set(x, y, z)
    const h = 48
    const tower = new Mesh(new CylinderGeometry(0.9, 1.8, h, 10), white)
    tower.position.y = h / 2
    g.add(tower)
    const nac = new Mesh(new BoxGeometry(2.4, 2.4, 6), white)
    nac.position.set(0, h + 1, 0)
    g.add(nac)
    const hub = new Group()
    hub.position.set(0, h + 1, 3.3)
    const cone = new Mesh(new ConeGeometry(1.1, 2.2, 10), white)
    cone.rotation.x = Math.PI / 2
    cone.position.z = 0.8
    hub.add(cone)
    for (let i = 0; i < 3; i++) {
      const b = new Mesh(bladeGeo, white)
      b.rotation.z = (i / 3) * Math.PI * 2
      hub.add(b)
    }
    g.add(hub)
    g.rotation.y = Math.atan2(-x, -z) + (rand() - 0.5) * 0.6 // roughly facing the farm
    root.add(g)
    list.push({ hub, speed: 0.6 + rand() * 0.35, x, y: y + h, z })
  }
  return list
}

// --- Hot-air balloon -------------------------------------------------------------------------
function balloon() {
  const g = new Group()
  const colors = ['#e84a3a', '#f7a53a', '#f7d84a', '#5ac25a', '#3a9ae8', '#9a5ae8']
  const segs = 12
  for (let i = 0; i < segs; i++) {
    const geo = new SphereGeometry(7, 2, 14, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs, 0, Math.PI * 0.82)
    const m = new Mesh(geo, new MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.6, flatShading: true, side: DoubleSide }))
    m.scale.set(1, 1.18, 1)
    g.add(m)
  }
  const skirt = new Mesh(new CylinderGeometry(2.6, 1.5, 3, 12, 1, true), new MeshStandardMaterial({ color: '#e84a3a', side: DoubleSide }))
  skirt.position.y = -7.4
  g.add(skirt)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const rope = new Mesh(new BoxGeometry(0.06, 4.5, 0.06), M('#3a2a1a'))
    rope.position.set(Math.cos(a) * 1.2, -10.6, Math.sin(a) * 1.2)
    g.add(rope)
  }
  const basket = new Mesh(new BoxGeometry(2, 1.4, 2), M('#a8693a'))
  basket.position.y = -13.4
  g.add(basket)
  const flame = new Mesh(new ConeGeometry(0.35, 1.2, 8), E('#ffb03a', 3))
  flame.position.y = -11.6
  g.add(flame)
  return { g, flame }
}

// --- Birds ------------------------------------------------------------------------------------
// Each bird is two wing quads hinged on its body line; they flap as the flock crosses the sky.
function birds(root) {
  const geo = new PlaneGeometry(0.42, 0.95)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, 0.475) // span runs from the hinge out along +Z
  const mat = new MeshStandardMaterial({ color: '#2a2a2e', side: DoubleSide, roughness: 1 })
  const n = 14
  const wings = new InstancedMesh(geo, mat, n * 2)
  wings.frustumCulled = false
  root.add(wings)
  const flock = Array.from({ length: n }, (_, i) => ({ ox: (i % 7) * 2.4 - 7.2, oz: Math.abs((i % 7) - 3) * 1.8 + Math.floor(i / 7) * 3, oy: Math.random() * 2, ph: Math.random() * 6 }))
  return { wings, flock, o: new Object3D() }
}

export function buildScenery(root, { addLamp }) {
  const rand = mulberry32(9090)
  buildTrees(root, rand)
  buildBushes(root, rand)
  plotFences()
  streetLamps(root, addLamp)
  const mills = turbines(root, rand)
  const bal = balloon()
  root.add(bal.g)
  const flock = birds(root)

  return {
    turbines: mills,
    balloon: bal.g,
    crowns: treeCrowns,
    update(dt, t) {
      for (const m of mills) m.hub.rotation.z -= dt * m.speed
      // The balloon drifts on a wide slow loop high over the hills to the north.
      bal.g.position.set(Math.sin(t * 0.008) * 160 - 20, 78 + Math.sin(t * 0.05) * 6, -230 + Math.cos(t * 0.008) * 70)
      bal.g.rotation.y = t * 0.02
      bal.flame.scale.setScalar(Math.sin(t * 0.3) > 0.85 ? 1 + Math.random() * 0.4 : 0.001)
      // Bird flock: crosses the sky every ~70 s in a loose V, wings flapping.
      const cycle = (t % 70) / 70
      const fx = -260 + cycle * 520
      const fz = -90 + Math.sin(t * 0.05) * 40
      const fy = 46 + Math.sin(t * 0.21) * 3
      const { wings, o } = flock
      flock.flock.forEach((bd, i) => {
        const flap = Math.sin(t * 8 + bd.ph) * 0.65
        for (const sgn of [1, -1]) {
          o.position.set(fx - bd.oz * 1.5, fy + bd.oy + Math.sin(t * 0.7 + bd.ph) * 0.4, fz + bd.ox * 1.5)
          o.rotation.set(sgn > 0 ? -flap : Math.PI + flap, 0, 0)
          o.updateMatrix()
          wings.setMatrixAt(i * 2 + (sgn > 0 ? 0 : 1), o.matrix)
        }
      })
      wings.instanceMatrix.needsUpdate = true
    },
  }
}
