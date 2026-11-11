import {
  BoxGeometry,
  CircleGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector2,
} from 'three'
import { FARM } from '../config.js'
import { bake } from '../bake.js'
import { mulberry32, paintWaterNormal, toTexture } from '../textures.js'
import { E, M, addSurface, bakeInto, block, box, cyl, gated, gatedAny, signCanvas, signMaterial, signPanel, solid, solidCyl, solidRect } from './kit.js'
import { fence } from './fence.js'
import { pumpkin } from './props.js'
import { paintDirt, paintHay, tex } from './textures.js'

// The north end: the wide dirt road behind the plot, the railway (gravel bed,
// sleepers, steel rails) between an orange wooden fence and the ranch's white
// fence, blue oil drums waiting for the train and the red OIL FIELD sign (with
// the Oil Field), a level crossing with crossbucks and flashing lights, the
// white-fenced RANCH (paddocks with feed troughs, a sand jumping arena, hay rolls,
// pumpkins: each part with the barn it belongs to), a duck pond with reeds and a
// little jetty, and the oil train that rumbles through.

const R = FARM.rail
const C = FARM.crossing
const RA = FARM.ranch

// --- Railway ---------------------------------------------------------------------------------
function railway(root) {
  const len = R.maxX - R.minX
  const cx = (R.minX + R.maxX) / 2
  // Ballast bed: a raised gravel band with sloped shoulders.
  const ballast = new MeshStandardMaterial({ map: tex(paintDirt(256, '#8a7d6c', '#5e5448', 951), len / 4, 1), roughness: 1 })
  block(root, len, 0.22, 4.2, ballast, cx, 0, R.z, 0, false).receiveShadow = true
  block(root, len, 0.12, 5.2, ballast, cx, 0, R.z, 0, false).receiveShadow = true
  // Sleepers (instanced).
  const sleeperGeo = new BoxGeometry(0.32, 0.14, 2.7)
  const sleeperMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 })
  const step = 0.85
  const n = Math.floor(len / step)
  const sleepers = new InstancedMesh(sleeperGeo, sleeperMat, n)
  const o = new Object3D()
  const c = new Color()
  for (let i = 0; i < n; i++) {
    o.position.set(R.minX + i * step, 0.29, R.z + ((i * 7) % 5 - 2) * 0.01)
    o.rotation.set(0, ((i * 13) % 7 - 3) * 0.006, 0)
    o.updateMatrix()
    sleepers.setMatrixAt(i, o.matrix)
    sleepers.setColorAt(i, c.set('#6b3a22').multiplyScalar(0.85 + ((i * 17) % 9) * 0.03))
  }
  sleepers.receiveShadow = true
  root.add(sleepers)
  // Rails: head + web, both sides.
  const steel = M('#9aa0a6', { roughness: 0.3, metalness: 0.75 })
  const web = M('#5e5148', { roughness: 0.7, metalness: 0.3 })
  for (const s of [-1, 1]) {
    block(root, len, 0.12, 0.1, web, cx, 0.36, R.z + (s * R.gauge) / 2, 0, false)
    block(root, len, 0.07, 0.14, steel, cx, 0.48, R.z + (s * R.gauge) / 2, 0, false)
  }
  addSurface({ minX: R.minX, maxX: R.maxX, minZ: R.z - 2.6, maxZ: R.z + 2.6 }, 'gravel')
  // Fences either side, open at the level crossing.
  fence([[-1200, FARM.railFenceS], [C.x - C.half - 1, FARM.railFenceS]], 'orange')
  fence([[C.x + C.half + 1, FARM.railFenceS], [1200, FARM.railFenceS]], 'orange')
  fence([[-1200, FARM.railFenceN], [RA.minX, FARM.railFenceN]], 'white', { collide: true })
  fence([[RA.maxX, FARM.railFenceN], [1200, FARM.railFenceN]], 'white', { collide: true })
}

// --- Level crossing ---------------------------------------------------------------------------
function crossing(root) {
  const g = new Group()
  const plank = M('#8a6440', { roughness: 0.9 })
  for (let i = 0; i < 12; i++) block(g, 0.62, 0.1, 5.4, plank, C.x - C.half + 0.35 + i * 0.68, 0.42, R.z)
  // Dirt ramps up to the bed on both sides.
  const dirt = M('#8b6a48', { roughness: 1 })
  for (const s of [-1, 1]) {
    const ramp = block(g, C.half * 2 + 1, 0.12, 3, dirt, C.x, 0.12, R.z + s * 3.6)
    ramp.rotation.x = s * 0.12
  }
  const lights = []
  const post = M('#e8e8e4', { roughness: 0.5 })
  const black = M('#1f2124')
  // Crossbucks with twin red lamps, one each side of the track, facing the roads.
  for (const [x, z, ry] of [[C.x - C.half - 1.2, R.z + 4.2, 0], [C.x + C.half + 1.2, R.z - 4.2, Math.PI]]) {
    const s = new Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    cyl(s, 0.09, 0.11, 4.4, post, 0, 2.2, 0, 8)
    cyl(s, 0.3, 0.35, 0.2, black, 0, 0.1, 0, 8)
    const xb = signCanvas(512, 96, { bg: '#ffffff', border: '#1f2124', borderWidth: 8, lines: [{ text: 'RAILROAD CROSSING', size: 52, color: '#1f2124' }] })
    const mat = signMaterial(xb)
    for (const a of [0.7, -0.7]) {
      const blade = box(s, 2.0, 0.34, 0.06, M('#ffffff'), 0, 3.85, 0.12)
      blade.rotation.z = a
      const face = signPanel(s, 1.98, 0.33, mat, 0, 3.85, 0.155)
      face.rotation.z = a
    }
    box(s, 1.6, 0.12, 0.12, black, 0, 2.8, 0.1)
    for (const lx of [-0.62, 0.62]) {
      cyl(s, 0.28, 0.28, 0.1, black, lx, 2.8, 0.16, 16).rotation.x = Math.PI / 2
      const lamp = new Mesh(new CircleGeometry(0.18, 16), new MeshStandardMaterial({ color: '#5a1410', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.3 }))
      lamp.position.set(lx, 2.8, 0.22)
      s.add(lamp)
      const hood = box(s, 0.44, 0.06, 0.25, black, lx, 3.02, 0.3)
      void hood
      lights.push(lamp)
    }
    block(s, 0.5, 0.7, 0.4, M('#9aa0a6', { metalness: 0.5 }), 0, 0, -0.35) // bell / relay box
    g.add(s)
    solidCyl(0.2, 4, x, z)
  }
  root.add(g)
  addSurface({ minX: C.x - C.half, maxX: C.x + C.half, minZ: R.z - 2.7, maxZ: R.z + 2.7 }, 'wood')
  return lights
}

// --- Oil field: sign and barrels (they come with the Oil Field) -----------------------------------------
function oilField(root) {
  gated(root, 'oilField', (G) => oilDressing(G), 3)
}
function oilDressing(root) {
  const g = new Group()
  const { x, z } = FARM.oilSign
  const s = new Group()
  s.position.set(x, 0, z)
  s.rotation.y = 0.35
  const post = M('#6e3a1e')
  for (const px of [-1.9, 1.9]) block(s, 0.24, 1.8, 0.24, post, px, 0, 0)
  const p = signCanvas(640, 200, {
    bg: '#c8302a',
    border: '#6e1a12',
    borderWidth: 12,
    radius: 10,
    plank: 2,
    lines: [
      { text: 'OIL FIELD', size: 104, color: '#fff3d6', stroke: '#6e1a12', strokeWidth: 10 },
      { text: 'sell oil to the train', size: 44, color: '#ffe0b0', weight: 600 },
    ],
  })
  box(s, 4.4, 1.4, 0.16, M('#8a2a20'), 0, 1.35, 0)
  signPanel(s, 4.3, 1.34, signMaterial(p), 0, 1.35, 0.085)
  box(s, 4.6, 0.14, 0.3, M('#6e1a12'), 0, 2.1, 0)
  s.rotation.x = -0.12 // leaning back a little
  g.add(s)
  // Blue steel drums in loose clusters along the dirt road.
  const drum = M('#2f4f9a', { roughness: 0.4, metalness: 0.35 })
  const rib = M('#243f7c', { roughness: 0.4, metalness: 0.4 })
  const lid = M('#3a5aa8', { roughness: 0.35, metalness: 0.4 })
  const rand = mulberry32(77)
  for (const [bx, bz] of FARM.barrels) {
    const n = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2
      const r = i === 0 ? 0 : 0.75 + rand() * 0.5
      const dx = bx + Math.cos(a) * r
      const dz = bz + Math.sin(a) * r
      cyl(g, 0.42, 0.42, 1.2, drum, dx, 0.6, dz, 14)
      for (const y of [0.3, 0.9]) cyl(g, 0.44, 0.44, 0.06, rib, dx, y, dz, 14)
      cyl(g, 0.4, 0.4, 0.03, lid, dx, 1.215, dz, 14)
      cyl(g, 0.06, 0.06, 0.04, M('#1d2f5a'), dx + 0.2, 1.24, dz + 0.1, 8)
    }
    solidCyl(1.2, 1.2, bx, bz)
  }
  bakeInto(root, g)
  solid(2.1, 1.2, 0.3, x, 1.2, z, 0.35)
}

// --- Ranch -------------------------------------------------------------------------------------------
// A rectangular white-fenced pen with a gate gap centred on one side.
function pen(r, gateSide = 'S', gateAt = null, gate = 4, into = null) {
  const { minX, maxX, minZ, maxZ } = r
  const gx = gateAt ?? (minX + maxX) / 2
  const pts = {
    S: [[[gx + gate / 2, maxZ], [maxX, maxZ], [maxX, minZ], [minX, minZ], [minX, maxZ], [gx - gate / 2, maxZ]]],
    N: [[[gx - gate / 2, minZ], [minX, minZ], [minX, maxZ], [maxX, maxZ], [maxX, minZ], [gx + gate / 2, minZ]]],
  }
  for (const line of pts[gateSide]) fence(line, 'white', { into })
}

function trough(g, x, z, ry) {
  const t = new Group()
  t.position.set(x, 0, z)
  t.rotation.y = ry
  const wood = M('#d9772f', { roughness: 0.8 })
  block(t, 3.0, 0.1, 0.7, wood, 0, 0.32, 0)
  for (const s of [-1, 1]) {
    block(t, 3.0, 0.3, 0.1, wood, 0, 0.36, s * 0.32)
    block(t, 0.12, 0.42, 0.7, M('#a8521f'), s * 1.45, 0, 0)
  }
  block(t, 2.8, 0.06, 0.52, M('#e7c56a', { roughness: 1 }), 0, 0.5, 0)
  g.add(t)
}

function jump(g, x, z, ry, rand) {
  const j = new Group()
  j.position.set(x, 0, z)
  j.rotation.y = ry
  const white = M('#f7f4ec')
  const red = M('#d63a2c')
  for (const s of [-1.6, 1.6]) {
    block(j, 0.18, 1.5, 0.18, white, s, 0, 0)
    for (let k = 0; k < 3; k++) block(j, 0.19, 0.18, 0.19, red, s, 0.25 + k * 0.45, 0)
    block(j, 0.5, 0.06, 0.4, white, s, 0, 0)
  }
  const bars = 1 + Math.floor(rand() * 2)
  for (let k = 0; k < bars; k++) {
    const y = 0.55 + k * 0.42
    for (let i = 0; i < 6; i++) block(j, 0.52, 0.1, 0.1, i % 2 ? white : red, -1.3 + i * 0.52, y, 0)
  }
  g.add(j)
}

function ranchArch(g) {
  const x = C.x
  const z = RA.maxZ - 1
  const post = M('#7a4426')
  for (const s of [-3.4, 3.4]) {
    block(g, 0.4, 4.6, 0.4, post, x + s, 0, z)
    const brace = box(g, 0.16, 1.4, 0.16, post, x + s * 0.82, 3.9, z)
    brace.rotation.z = s > 0 ? -0.8 : 0.8
  }
  box(g, 8.0, 0.32, 0.4, post, x, 4.5, z)
  const p = signCanvas(512, 120, { bg: '#b8742e', plank: 2, border: '#6e3a1e', borderWidth: 10, radius: 8, lines: [{ text: 'RANCH', size: 84, color: '#fff3d6', stroke: '#5a2e14', strokeWidth: 10 }] })
  const sign = new Group()
  sign.position.set(x, 3.7, z)
  sign.rotation.z = -0.06
  box(sign, 3.6, 0.9, 0.12, M('#b8742e'), 0, 0, 0)
  const mat = signMaterial(p)
  signPanel(sign, 3.55, 0.86, mat, 0, 0, 0.065)
  signPanel(sign, 3.55, 0.86, mat, 0, 0, -0.065, Math.PI)
  for (const s of [-1.4, 1.4]) box(sign, 0.04, 0.5, 0.04, M('#2c2c30'), s, 0.6, 0)
  g.add(sign)
  // Horseshoe over the beam.
  const shoe = cyl(g, 0.45, 0.45, 0.1, M('#9aa0a6', { metalness: 0.7, roughness: 0.3 }), x, 5.1, z, 16)
  shoe.rotation.x = Math.PI / 2
  solidCyl(0.25, 4.6, x - 3.4, z)
  solidCyl(0.25, 4.6, x + 3.4, z)
}

function pond(root, rand) {
  const cx = -72
  const cz = -207
  const g = new Group()
  // Muddy bank, then water with scrolling ripples.
  const bank = cyl(g, 1, 1, 0.12, M('#7a6a48', { roughness: 1 }), cx, 0.03, cz, 28, false)
  bank.scale.set(21, 1, 14)
  const ripples = paintWaterNormal()
  const normal = toTexture(ripples, { repeat: 4 })
  const water = new Mesh(new CircleGeometry(1, 40), new MeshPhysicalMaterial({ color: '#3f8fbf', roughness: 0.15, metalness: 0, normalMap: normal, normalScale: new Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.92 }))
  water.rotation.x = -Math.PI / 2
  water.scale.set(19, 12.5, 1)
  water.position.set(cx, 0.1, cz)
  water.receiveShadow = true
  root.add(water)
  // Reeds and cattails around the edge, lily pads on the water, rocks.
  const reedMat = M('#5a8a34', { roughness: 0.9 })
  const cattail = M('#6b4024', { roughness: 0.9 })
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2
    const r = 0.86 + rand() * 0.2
    const x = cx + Math.cos(a) * 19 * r
    const z = cz + Math.sin(a) * 12.5 * r
    if (Math.cos(a) > 0.6 && Math.sin(a) > 0) continue // the jetty side stays clear
    const h = 0.7 + rand() * 1.0
    const reed = box(g, 0.05, h, 0.05, reedMat, x, h / 2, z, 0, false)
    reed.rotation.z = (rand() - 0.5) * 0.3
    if (rand() < 0.4) box(g, 0.1, 0.25, 0.1, cattail, x - Math.sin(reed.rotation.z) * h * 0.5, h * 0.95, z, 0, false)
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2
    const r = rand() * 0.75
    const pad = cyl(g, 0.4 + rand() * 0.3, 0.4, 0.02, M('#4f9a3a'), cx + Math.cos(a) * 19 * r, 0.13, cz + Math.sin(a) * 12.5 * r, 10, false)
    void pad
    if (rand() < 0.3) cyl(g, 0.08, 0.12, 0.08, M('#ff9ac8'), pad.position.x, 0.18, pad.position.z, 6, false)
  }
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const rock = cyl(g, 0.3 + rand() * 0.4, 0.5 + rand() * 0.4, 0.4, M('#8f8a80', { flatShading: true }), cx + Math.cos(a) * 20.5, 0.15, cz + Math.sin(a) * 13.5, 6)
    rock.rotation.y = rand() * 3
  }
  // A little wooden jetty on the south-east bank.
  const wood = M('#9a6a3e')
  for (let i = 0; i < 9; i++) block(g, 1.6, 0.08, 0.36, wood, cx + 14, 0.5, cz + 7.5 - i * 0.42)
  for (const [px, pz] of [[-0.7, 0], [0.7, 0], [-0.7, -3.4], [0.7, -3.4]]) block(g, 0.16, 0.6, 0.16, M('#6e4122'), cx + 14 + px, 0, cz + 7.5 + pz)
  bakeInto(root, g)
  addSurface({ minX: cx - 19, maxX: cx + 19, minZ: cz - 12, maxZ: cz + 12 }, 'mud')
  // Keep the player out of the water.
  solid(15, 1, 9, cx, 1, cz)

  // Ducks paddling slow circles.
  const ducks = []
  for (let i = 0; i < 4; i++) {
    const d = new Group()
    const drake = i % 2 === 0
    block(d, 0.34, 0.24, 0.55, M(drake ? '#c9c2b4' : '#8a6a48'), 0, 0, 0)
    block(d, 0.2, 0.18, 0.18, M(drake ? '#6a5a4a' : '#7a5a38'), 0, 0.12, -0.3) // tail
    block(d, 0.2, 0.22, 0.2, M(drake ? '#2f7a3a' : '#8a6a48'), 0, 0.22, 0.24) // head
    block(d, 0.1, 0.06, 0.14, M('#f2a02a'), 0, 0.27, 0.4) // bill
    if (drake) block(d, 0.21, 0.04, 0.21, M('#ffffff'), 0, 0.2, 0.24) // white collar
    block(d, 0.36, 0.1, 0.32, M(drake ? '#5a4a3a' : '#6e5232'), 0, 0.2, -0.04) // wings
    d.traverse((o) => {
      if (o.isMesh) o.castShadow = true
    })
    root.add(d)
    ducks.push({ g: d, r: 4 + i * 2.2, a: rand() * 6, speed: 0.06 + rand() * 0.05, ph: rand() * 6 })
  }
  return { cx, cz, ducks, normal }
}

// Everything inside the ranch fence is bought: the outer fence (east, north and west sides),
// the arch, paths and hay come with the first ranch barn; each paddock with the barn whose
// animals graze it; the sand arena with the stables. Until then it is open lawn (the south
// side stays: it fences the railway).
const RANCH_BARNS = ['duckHouse', 'cowBarn', 'pigPen', 'stables', 'sheepShed', 'goatBarn']
function ranch(root, rand) {
  fence([[C.x + 3.4, RA.maxZ], [RA.maxX, RA.maxZ]], 'white')
  fence([[RA.minX, RA.maxZ], [C.x - 3.4, RA.maxZ]], 'white')
  gatedAny(root, RANCH_BARNS, (G) => {
    const g = new Group()
    fence([[RA.maxX, RA.maxZ], [RA.maxX, RA.minZ], [RA.minX, RA.minZ], [RA.minX, RA.maxZ]], 'white', { into: G })
    ranchArch(g)
    // Dirt paths: one east-west inside the south fence, one between the pen rows,
    // and one north-south from the arch.
    const pathTex = tex(paintDirt(256, '#b08a5e', '#8e6a44', 961), 1)
    const paths = [
      { minX: RA.minX + 1, maxX: RA.maxX - 1, minZ: -140, maxZ: RA.maxZ - 0.5 },
      { minX: RA.minX + 1, maxX: RA.maxX - 1, minZ: -186, maxZ: -180 },
      { minX: C.x - 3, maxX: C.x + 3, minZ: -186, maxZ: -140 },
    ]
    for (const p of paths) {
      const m = new Mesh(new BoxGeometry(p.maxX - p.minX, 0.04, p.maxZ - p.minZ), new MeshStandardMaterial({ map: pathTex.clone(), roughness: 1 }))
      m.material.map.repeat.set((p.maxX - p.minX) / 6, (p.maxZ - p.minZ) / 6)
      m.material.map.needsUpdate = true
      m.position.set((p.minX + p.maxX) / 2, 0.02, (p.minZ + p.maxZ) / 2)
      m.receiveShadow = true
      G.add(m)
      addSurface(p, 'dirt')
    }
    // Hay rolls and pumpkin patches along the fences (as dotted around in the screenshots).
    for (const [x, z] of [[-30, -137], [40, -137.5], [118, -187], [-120, -183], [-10, -233]]) {
      hayRoll(g, x, z, rand() * 3)
      solidCyl(0.9, 1.7, x, z)
    }
    for (const [x, z] of [[-60, -137], [10, -136.5], [70, -186], [-125, -138]]) {
      for (let i = 0; i < 4; i++) pumpkin(g, x + i * 0.9 + rand() * 0.3, z + (rand() - 0.5) * 0.8, 0.3 + rand() * 0.15)
    }
    bakeInto(G, g)
  }, 5)
  // The jumping arena: pale sand inside its own fence, with jumps (Horse Stables).
  gated(root, 'stables', (G) => {
    const g = new Group()
    const arena = FARM.arena
    const sand = new Mesh(new BoxGeometry(arena.maxX - arena.minX, 0.05, arena.maxZ - arena.minZ), new MeshStandardMaterial({ map: tex(paintDirt(256, '#e3be8a', '#c99e68', 971), (arena.maxX - arena.minX) / 6, (arena.maxZ - arena.minZ) / 6), roughness: 1 }))
    sand.position.set((arena.minX + arena.maxX) / 2, 0.03, (arena.minZ + arena.maxZ) / 2)
    sand.receiveShadow = true
    G.add(sand)
    addSurface(arena, 'sand')
    pen(arena, 'S', -89, 4, G)
    jump(g, -104, -158, 0.1, rand)
    jump(g, -90, -152, -0.25, rand)
    jump(g, -76, -162, 0.4, rand)
    jump(g, -96, -168, 1.4, rand)
    // A judges' bench and a water butt by the arena.
    block(g, 2.4, 0.1, 0.6, M('#d9772f'), -66, 0.45, -170)
    for (const s of [-1, 1]) block(g, 0.1, 0.45, 0.55, M('#6e3a1e'), -66 + s, 0, -170)
    bakeInto(G, g)
  }, 2)
  // Grass paddocks, each with the barn whose animals use it (the back field joins the
  // horses' stables).
  const pens = [
    { minX: -56, maxX: -4, minZ: -176, maxZ: -144, id: 'cowBarn' },
    { minX: 2, maxX: 52, minZ: -176, maxZ: -144, id: 'pigPen' },
    { minX: 58, maxX: 86, minZ: -176, maxZ: -144, id: 'duckHouse' },
    { minX: 98, maxX: 126, minZ: -176, maxZ: -144, id: 'sheepShed' },
    { minX: -40, maxX: 22, minZ: -230, maxZ: -190, id: 'stables' },
    { minX: 28, maxX: 124, minZ: -230, maxZ: -190, id: 'goatBarn' },
  ]
  pens.forEach((p, i) => {
    gated(root, p.id, (G) => {
      const g = new Group()
      pen(p, i < 4 ? 'S' : 'N', i === 3 ? 102 : null, 4, G)
      // Feed troughs along the back fence and a hay roll or two.
      const back = i < 4 ? p.minZ + 1.4 : p.maxZ - 1.4
      const w = p.maxX - p.minX
      for (let k = 0; k < Math.max(1, Math.floor(w / 18)); k++) trough(g, p.minX + 6 + k * 16, back, 0)
      if (rand() < 0.8) {
        const hx = p.maxX - 3
        const hz = (p.minZ + p.maxZ) / 2
        hayRoll(g, hx, hz, rand() * 3)
        solidCyl(0.9, 1.7, hx, hz)
      }
      bakeInto(G, g)
    }, 2)
  })
  // (The horse stables stand where the tack shed was: farm/ranch.js.)
}

const hayMatCache = { m: null }
function hayRoll(g, x, z, ry) {
  if (!hayMatCache.m) hayMatCache.m = new MeshStandardMaterial({ map: tex(paintHay(), 2, 1), roughness: 1 })
  const b = cyl(g, 0.85, 0.85, 1.4, hayMatCache.m, x, 0.85, z, 18)
  b.rotation.z = Math.PI / 2
  b.rotation.y = ry
  // Spiral end faces: a darker inner disc.
  for (const s of [-1, 1]) {
    const face = cyl(g, 0.6, 0.6, 0.02, M('#c99a3a', { roughness: 1 }), x, 0.85, z, 14, false)
    face.rotation.z = Math.PI / 2
    face.rotation.y = ry
    face.position.x += Math.cos(ry) * 0.705 * s
    face.position.z -= Math.sin(ry) * 0.705 * s
  }
}

// --- The oil train ----------------------------------------------------------------------------------
function bogie(g, z, rand) {
  void rand
  const black = M('#1d1f22', { roughness: 0.6, metalness: 0.4 })
  block(g, 2.6, 0.4, 2.2, black, z, 0.55, 0) // x along the track (local X)
  for (const wx of [-0.7, 0.7]) {
    for (const s of [-1, 1]) {
      const w = cyl(g, 0.42, 0.42, 0.14, M('#2a2c30', { metalness: 0.6, roughness: 0.4 }), z + wx, 0.6, s * 0.75, 14)
      w.rotation.x = Math.PI / 2
    }
  }
}

function locomotive() {
  const g = new Group()
  const red = M('#b8322a', { roughness: 0.4 })
  const yellow = M('#f2c230', { roughness: 0.45 })
  const dark = M('#26282c', { roughness: 0.5, metalness: 0.3 })
  const glass = M('#2a3e52', { roughness: 0.1, metalness: 0.3 })
  // Local frame: +X is forward (east).
  block(g, 17, 0.5, 3.0, dark, 0, 1.0, 0) // frame / walkway
  block(g, 11, 2.6, 2.3, red, -2.6, 1.5, 0) // long hood
  block(g, 11.1, 0.28, 2.32, yellow, -2.6, 2.4, 0) // stripe
  block(g, 3.2, 3.4, 2.9, red, 4.5, 1.5, 0) // cab
  block(g, 3.4, 0.25, 3.1, dark, 4.5, 4.9, 0)
  block(g, 0.06, 1.0, 2.4, glass, 6.12, 3.4, 0)
  for (const s of [-1, 1]) block(g, 1.6, 0.9, 0.06, glass, 4.6, 3.4, s * 1.46)
  block(g, 2.2, 1.7, 2.3, red, 7.2, 1.5, 0) // short nose
  block(g, 2.25, 0.28, 2.32, yellow, 7.2, 2.4, 0)
  block(g, 0.2, 0.6, 2.8, yellow, 8.5, 0.9, 0) // pilot
  block(g, 0.08, 0.3, 0.5, E('#fffbe8', 3), 8.32, 2.6, 0, 0, false) // headlight
  for (const s of [-1, 1]) block(g, 0.08, 0.18, 0.18, E('#fff2c8', 2), 8.32, 1.6, s * 0.9, 0, false)
  // Exhaust stacks, radiator grilles, horn.
  for (const x of [-4.5, -1.5]) cyl(g, 0.22, 0.22, 0.5, dark, x, 4.3, 0, 10)
  for (let i = 0; i < 6; i++) block(g, 0.6, 0.06, 1.9, dark, -7.4 + i * 0.25, 4.1, 0)
  cyl(g, 0.08, 0.14, 0.6, M('#c8ccd0', { metalness: 0.8, roughness: 0.2 }), 5.0, 5.3, 0.7, 8).rotation.z = Math.PI / 2
  // Handrails.
  for (const s of [-1, 1]) block(g, 15, 0.06, 0.06, M('#f2c230'), -0.5, 2.3, s * 1.45)
  bogie(g, -5.5)
  bogie(g, 5.5)
  return g
}

function tankCar(i) {
  const g = new Group()
  const dark = M('#1f2124', { roughness: 0.45, metalness: 0.4 })
  const tank = M(i % 3 === 1 ? '#2f4f9a' : '#26282c', { roughness: 0.35, metalness: 0.35 })
  block(g, 13, 0.35, 2.6, dark, 0, 1.0, 0)
  const body = cyl(g, 1.45, 1.45, 11.6, tank, 0, 2.85, 0, 18)
  body.rotation.z = Math.PI / 2
  for (const s of [-1, 1]) {
    const cap = cyl(g, 1.2, 1.45, 0.4, tank, s * 5.95, 2.85, 0, 18)
    cap.rotation.z = (-s * Math.PI) / 2
  }
  cyl(g, 0.55, 0.55, 0.5, dark, 0, 4.45, 0, 12) // dome
  block(g, 3.0, 0.08, 1.0, M('#9aa0a6', { metalness: 0.6 }), 0, 4.25, 0) // walkway
  // OIL plate.
  const p = signCanvas(256, 96, { bg: '#f2c230', border: '#1f2124', borderWidth: 6, lines: [{ text: 'OIL', size: 72, color: '#1f2124' }] })
  const mat = signMaterial(p)
  for (const s of [-1, 1]) signPanel(g, 1.4, 0.52, mat, 2.5, 2.9, s * 1.47, s > 0 ? 0 : Math.PI)
  bogie(g, -4.6)
  bogie(g, 4.6)
  // Couplers.
  for (const s of [-1, 1]) block(g, 0.6, 0.25, 0.25, dark, s * 6.7, 1.0, 0)
  return g
}

function caboose() {
  const g = new Group()
  const red = M('#c8302a', { roughness: 0.45 })
  block(g, 9, 0.35, 2.6, M('#1f2124'), 0, 1.0, 0)
  block(g, 8, 2.6, 2.5, red, 0, 1.35, 0)
  block(g, 8.4, 0.2, 2.9, M('#26282c'), 0, 3.95, 0)
  block(g, 2.6, 1.0, 1.8, red, 0, 4.15, 0) // cupola
  block(g, 2.7, 0.15, 2.0, M('#26282c'), 0, 5.15, 0)
  for (const s of [-1, 1]) for (const x of [-2.5, 0, 2.5]) block(g, 0.8, 0.7, 0.06, M('#2b3644'), x, 2.4, s * 1.26)
  block(g, 0.08, 0.2, 0.2, E('#ff3a2a', 3), -4.55, 3.2, 0, 0, false)
  bogie(g, -2.8)
  bogie(g, 2.8)
  return g
}

function buildTrain(root) {
  const T = FARM.train
  const units = []
  const add = (grp, len) => {
    const b = bake(grp, true)
    b.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true
    })
    b.visible = false
    root.add(b)
    units.push({ g: b, len })
  }
  add(locomotive(), 17.5)
  for (let i = 0; i < T.cars; i++) add(tankCar(i), 13.6)
  add(caboose(), 9.6)
  const total = units.reduce((s, u) => s + u.len, 0)
  const startX = -620
  const endX = 620 + total
  const run = (endX - startX) / T.speed
  // hooks (set by farm/oil.js): { stopX, wantStop(), dwell, onStop(), onLeave() } make it
  // brake to a stop with its engine at stopX when there is oil waiting at the station.
  const state = { z: R.z, active: false, headX: startX, tailX: startX - total, speed: T.speed, total, horn: false, wait: 18, dwell: 0, served: false, stopped: false, hooks: null }
  return {
    state,
    update(dt, t) {
      // The first train ~18 s after loading, then one every T.every s (counted from when the last one left).
      if (!state.active) {
        state.wait -= dt
        for (const u of units) u.g.visible = false
        if (state.wait > 0) return
        state.active = true
        state.headX = startX
        state.speed = T.speed
        state.served = false
      }
      const h = state.hooks
      if (state.dwell > 0) {
        state.dwell -= dt
        state.speed = 0
        if (state.dwell <= 0) {
          state.stopped = false
          h?.onLeave?.()
        }
      } else if (h && !state.served && state.headX < h.stopX && h.wantStop()) {
        // Brake smoothly into the station.
        const d = h.stopX - state.headX
        state.speed = Math.max(0.6, Math.min(T.speed, Math.sqrt(2 * 2.2 * d)))
        if (d < 0.25) {
          state.headX = h.stopX
          state.speed = 0
          state.served = true
          state.stopped = true
          state.dwell = h.dwell ?? 7
          h.onStop?.()
        }
      } else state.speed = Math.min(T.speed, state.speed + dt * 2.5)
      state.headX += state.speed * dt
      if (state.headX > endX) {
        state.active = false
        state.wait = Math.max(8, T.every - run)
        for (const u of units) u.g.visible = false
        return
      }
      state.tailX = state.headX - total
      let x = state.headX
      for (const u of units) {
        const cx = x - u.len / 2
        u.g.visible = cx > -700 && cx < 700
        // A little sway on the springs.
        u.g.position.set(cx, 0.32 + Math.sin(t * 9 + cx * 0.3) * 0.015, R.z)
        u.g.rotation.x = Math.sin(t * 2.3 + cx * 0.1) * 0.006
        x -= u.len
      }
    },
  }
}

export function buildNorth(root, { addLamp }) {
  const rand = mulberry32(2727)
  railway(root)
  const lights = crossing(root)
  oilField(root)
  ranch(root, rand)
  const pd = pond(root, rand)
  const train = buildTrain(root)
  addLamp(C.x, 4.2, RA.maxZ - 1.5)
  addLamp(FARM.oilSign.x, 3, FARM.oilSign.z + 2)

  return {
    train: train.state,
    pond: { x: pd.cx, z: pd.cz },
    crossing: { x: C.x, z: R.z },
    crossingActive: false,
    update(dt, t) {
      train.update(dt, t)
      const s = train.state
      // Lights flash while the train is near or over the crossing.
      const near = s.active && s.headX > C.x - 140 && s.tailX < C.x + 20
      this.crossingActive = near
      const blink = Math.floor(t * 2.2) % 2
      lights.forEach((l, i) => {
        l.material.emissiveIntensity = near && (i % 2) === blink ? 4 : 0
      })
      pd.normal.offset.set(t * 0.01, t * 0.016)
      for (const d of pd.ducks) {
        d.a += dt * d.speed
        const x = pd.cx + Math.cos(d.a) * d.r * 1.3
        const z = pd.cz + Math.sin(d.a) * d.r * 0.8
        d.g.position.set(x, 0.18 + Math.sin(t * 2 + d.ph) * 0.02, z)
        d.g.rotation.y = -d.a // heading along the circle
      }
    },
  }
}
