import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { FARM, GAME } from '../config.js'
import { mulberry32 } from '../textures.js'
import { E, M, addSurface, bakeInto, block, box, cyl, signCanvas, signMaterial, signPanel, solid, solidCyl, solidRect } from './kit.js'
import { townHouse } from './models.js'
import { combineHarvester, cropSprayer, eggVan, farmTruck, tractor } from './vehicles.js'
import { crate, lampPost, pumpkin } from './props.js'
import { fence } from './fence.js'
import { idle, makeNPC, makeWalker, updateWalker } from './npc.js'
import { paintAsphalt, paintDirt, paintPavers, tex } from './textures.js'
import { festivalStall, lake } from './zonemodels.js'
import { SHOWROOM, bench, bigMarket, fountain, flowerBed, gazebo, hedge, parkTree, picnicTable, playground, priceTag, pylon, shopFront, showroom, sign } from './townmodels.js'

// The rural town in the middle of the hub, round the crossroads of the road (east-west) and Main
// Street (north-south, gate to gate between the north and south farms):
//   north-west: a row of shops facing the road (general store, bakery, hardware, café, post office)
//               with houses behind;
//   north-east: the Town Park (fountain plaza, gazebo, pond, playground, picnic lawn, flower beds);
//   south-west: the big FARMERS' MARKET hall (walk, ride or drive into its SELL HERE square and
//               everything you carry is sold), its plaza with outdoor stalls and a car park;
//   south-east: the VEHICLE DEALER: a lot of tractors, trucks, a combine and a sprayer out front, and
//               a walk-in showroom (sliding doors, front desk: E opens the catalogue).
// Low buildings only; houses, lamps, benches and shoppers in between.

const T = FARM.town
const MK = FARM.townMarket
const DL = FARM.dealer
const MS = FARM.mainStreet
const SN = FARM.sidewalkN
const SS = FARM.sidewalkS
const C = FARM.curbHeight

// A flat textured patch (pavers, asphalt, gravel) over rect r at height y.
function pave(root, r, map, tile, y = 0.035) {
  const w = r.maxX - r.minX
  const d = r.maxZ - r.minZ
  const t = map.clone()
  t.repeat.set(w / tile, d / tile)
  t.needsUpdate = true
  const geo = new PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2)
  const m = new Mesh(geo, new MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 - y * 20, polygonOffsetUnits: -1 - y * 200 }))
  m.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2)
  m.receiveShadow = true
  root.add(m)
  return m
}

export function buildTown(root, { addLamp }) {
  const rand = mulberry32(5150)
  const g = new Group() // everything static, baked at the end
  const pav = tex(paintPavers(512, 16, '#d8cbb4', '#c4b496', '#8e7c62', 993).color, 1)
  const warmPav = tex(paintPavers(512, 16, '#d7b98d', '#bf9a6d', '#8e7556', 994).color, 1)
  const asphalt = tex(paintAsphalt(), 1)
  const gravel = tex(paintDirt(256, '#d9c9a3', '#bba67c', 961), 1)
  const line = M('#f4f4ef', { roughness: 0.6 })
  const yellowLine = M('#f2c230', { roughness: 0.6 })

  // --- Ground ------------------------------------------------------------------------------------------------
  const shopWalk = { minX: T.minX + 4, maxX: MS.x - MS.width / 2 - 3, minZ: 30, maxZ: SN.minZ }
  pave(root, shopWalk, pav, 6, 0.04)
  addSurface(shopWalk, 'pavers')
  const plaza = { minX: T.minX + 4, maxX: 243, minZ: SS.maxZ, maxZ: MK.z }
  pave(root, plaza, warmPav, 5, 0.04)
  addSurface(plaza, 'pavers')
  const carPark = { minX: 243, maxX: MS.x - MS.width / 2 - 3, minZ: SS.maxZ, maxZ: 114 }
  pave(root, carPark, asphalt, 5, 0.035)
  addSurface(carPark, 'asphalt')
  for (let z = 72; z < 112; z += 3.2) for (const x of [249, 274]) block(g, 5.4, 0.02, 0.12, line, x, 0.045, z, 0, false)
  const lot = { minX: MS.x + MS.width / 2 + 3, maxX: T.maxX - 2, minZ: SS.maxZ, maxZ: DL.z }
  pave(root, lot, asphalt, 5, 0.035)
  addSurface(lot, 'asphalt')
  const walkway = { minX: DL.x - 3, maxX: DL.x + 3, minZ: SS.maxZ, maxZ: DL.z }
  pave(root, walkway, pav, 4, 0.045)
  addSurface(walkway, 'pavers')
  // Parking bays on the lot.
  for (let x = lot.minX + 2; x < lot.maxX; x += 13) if (Math.abs(x - DL.x) > 6) block(g, 0.14, 0.02, 9, line, x, 0.045, 71, 0, false)

  // The SELL HERE square (the market zone's walkable part).
  const z = MK.zone
  const sell = signCanvas(512, 384, { bg: 'rgba(47,138,87,0.85)', border: '#f5efd6', borderWidth: 16, radius: 30, lines: [{ text: 'SELL', size: 130, color: '#f5efd6' }, { text: 'HERE', size: 130, color: '#f5efd6' }] })
  const sellMat = signMaterial(sell, { transparent: true })
  sellMat.polygonOffset = true
  sellMat.polygonOffsetFactor = -6
  sellMat.polygonOffsetUnits = -40
  const sp = signPanel(root, 16, 12, sellMat, (z.minX + z.maxX) / 2, 0.08, (SS.maxZ + z.maxZ) / 2 - 1)
  sp.rotation.set(-Math.PI / 2, 0, Math.PI) // reads upright walking in from the road

  // Crosswalks at the crossroads and stop lines on Main Street.
  const mx0 = MS.x - MS.width / 2
  const mx1 = MS.x + MS.width / 2
  const roadZ0 = FARM.road.z - FARM.road.width / 2
  const roadZ1 = FARM.road.z + FARM.road.width / 2
  for (const cx of [mx0 - 3.5, mx1 + 3.5]) for (let zz = roadZ0 + 0.8; zz < roadZ1 - 0.4; zz += 1.1) block(g, 4, 0.02, 0.6, line, cx, 0.04, zz, 0, false)
  for (const cz of [SN.minZ - 3, SS.maxZ + 3]) for (let xx = mx0 + 0.6; xx < mx1 - 0.3; xx += 1.1) block(g, 0.6, 0.02, 4, line, xx, 0.04, cz, 0, false)
  block(g, MS.width / 2, 0.02, 0.35, yellowLine, MS.x - MS.width / 4, 0.04, SN.minZ - 6, 0, false)
  block(g, MS.width / 2, 0.02, 0.35, yellowLine, MS.x + MS.width / 4, 0.04, SS.maxZ + 6, 0, false)
  // Centre line down Main Street.
  for (let zz = MS.minZ + 2; zz < MS.maxZ; zz += 9) {
    if ((zz > roadZ0 - 8 && zz < roadZ1 + 8) || Math.abs(zz - FARM.rail.z) < 6) continue
    block(g, 0.2, 0.02, 4, M('#f2c230', { roughness: 0.6 }), MS.x, 0.045, zz, 0, false)
  }

  // --- North-west: the shops -------------------------------------------------------------------------------
  const shops = [
    { name: 'GENERAL STORE', sub: 'groceries · tools · seeds', wall: '#e8d6b0', board: '#2f6b45', a: '#2f8a57', storeys: 2, kind: 'store' },
    { name: 'BAKERY', sub: 'fresh bread daily', wall: '#f2d6d6', board: '#a8693a', a: '#e58ab8', kind: 'bakery' },
    { name: 'HARDWARE', sub: 'nails · paint · rope', wall: '#cfe0e8', board: '#3a5a7a', a: '#2f6fd0', storeys: 2, kind: 'hardware' },
    { name: 'CAFÉ', sub: 'coffee · pie', wall: '#f4e2b8', board: '#8a4a2a', a: '#e2763a', kind: 'cafe' },
    { name: 'POST OFFICE', sub: 'parcels & letters', wall: '#e0e8cf', board: '#2f4fa0', a: '#d6322c', kind: 'post' },
  ]
  const shopW = 20
  shops.forEach((s, i) => {
    const x = T.minX + 18 + i * (shopW + 4)
    const m = shopFront({ ...s, w: shopW })
    m.position.set(x, 0, 30)
    g.add(m)
    solidRect(x - shopW / 2 - 0.2, x + shopW / 2 + 0.2, 18, 30.2, s.storeys > 1 ? 10 : 7.2)
  })
  // Houses behind the shops, each with a low picket fence and a front path.
  for (let i = 0; i < 5; i++) house(g, T.minX + 18 + i * 24, -18, 0, i, rand)
  // Two more shops on Main Street, south of the road, facing the street.
  const side = [
    { name: 'FEED & SEED', sub: 'hay · grain · feed', wall: '#e8c48a', board: '#6e4122', a: '#3f8a4a', kind: 'feed' },
    { name: 'DINER', sub: 'open all day', wall: '#f7f4ec', board: '#d6322c', a: '#d6322c', kind: 'diner' },
  ]
  side.forEach((s, i) => {
    const sz = 125 + i * 22
    const m = shopFront({ ...s, w: 18 })
    m.position.set(mx1 + 5, 0, sz)
    m.rotation.y = -Math.PI / 2
    g.add(m)
    solidRect(mx1 + 4.8, mx1 + 17, sz - 9.2, sz + 9.2, 7.2)
  })
  // Houses south of the market and the dealer (facing north), and along Main Street to the rail.
  for (let i = 0; i < 5; i++) house(g, T.minX + 20 + i * 22, 136, Math.PI, i + 5, rand)
  for (let i = 0; i < 4; i++) house(g, 340 + i * 22, 132, Math.PI, i + 10, rand)
  for (const [hz, k] of [[-58, 14], [-80, 15]]) {
    house(g, mx0 - 12, hz, Math.PI / 2, k, rand)
    house(g, mx1 + 12, hz, -Math.PI / 2, k + 2, rand)
  }

  // --- South-west: the Farmers' Market -----------------------------------------------------------------------
  const m = bigMarket()
  m.g.position.set(MK.x, 0, MK.z)
  m.g.rotation.y = Math.PI
  // The clock's hands turn: keep them out of the bake.
  const clock = m.clock
  clock.removeFromParent()
  g.add(m.g)
  const clockHolder = new Group()
  clockHolder.position.copy(m.g.position)
  clockHolder.rotation.copy(m.g.rotation)
  clockHolder.add(clock)
  root.add(clockHolder)
  // World spot of a point in the market's own frame (it is turned half a turn).
  const mk = (dx, dz) => [MK.x - dx, MK.z - dz]
  solidRect(MK.x - 25, MK.x + 25, MK.z + 3, MK.z + 28, 13)
  for (let i = 0; i <= 10; i++) {
    const [px] = mk(-25 + i * 5, 0)
    solid(0.5, 3.3, 0.5, px, 3.3, MK.z + 0.45)
  }
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 5) continue
    const [sx] = mk(-25 + (i + 0.5) * 5, 0)
    solidRect(sx - 1.8, sx + 1.8, MK.z + 1.0, MK.z + 2.0, 1.4)
  }
  for (const s of [-1, 1]) solidCyl(0.6, 6.5, MK.x + s * 6.4, MK.z - 3)
  solidRect(MK.x - 29, MK.x - 25, MK.z + 6, MK.z + 24, 1.2) // loading dock
  // Outdoor stalls along the plaza's west side, produce piles, a pylon by the road.
  ;['#e23a35', '#2f8a57', '#f2c230'].forEach((c, i) => {
    const st = festivalStall(c)
    st.g.position.set(T.minX + 10, 0, 64 + i * 7)
    st.g.rotation.y = Math.PI / 2
    g.add(st.g)
    solidRect(T.minX + 8.6, T.minX + 11.4, 62.5 + i * 7, 65.5 + i * 7, 2)
  })
  for (let i = 0; i < 7; i++) pumpkin(g, T.minX + 15 + (i % 3) * 0.9, 81 - Math.floor(i / 3) * 0.9, 0.38 + (i % 2) * 0.08)
  for (let i = 0; i < 3; i++) crate(g, 186 - i * 1.2, 0, 60, 1, i * 0.3)
  pylon(g, 186, SS.maxZ + 2.5, [{ text: "FARMERS'", size: 150, color: '#ffffff', stroke: '#173f28', strokeWidth: 14 }, { text: 'MARKET', size: 150, color: '#ffffff', stroke: '#173f28', strokeWidth: 14 }, { text: 'sell your goods here', size: 64, color: '#ffe9a0' }], '#2f6b45')
  solidRect(183.8, 188.2, SS.maxZ + 2.2, SS.maxZ + 2.8, 4)
  // The egg van and a pickup by the loading dock / in the car park.
  const van = eggVan()
  van.g.position.set(MK.x - 31, 0.03, MK.z + 18)
  g.add(van.g)
  solid(1.2, 1.4, 3, MK.x - 31, 1.4, MK.z + 18)
  for (const [px, pz, col] of [[249, 88, '#4a6b8a'], [274, 101, '#c8302a'], [249, 104, '#3f8a4a']]) {
    const tk = farmTruck(col, 'TOWN')
    tk.g.position.set(px, 0.03, pz)
    tk.g.rotation.y = px < 260 ? Math.PI / 2 : -Math.PI / 2
    g.add(tk.g)
    solid(3.3, 1.5, 1.2, px, 1.5, pz)
  }

  // --- South-east: the Vehicle Dealer --------------------------------------------------------------------------
  const sr = showroom()
  sr.g.position.set(DL.x, 0, DL.z)
  sr.g.rotation.y = Math.PI
  const dk = (dx, dz) => [DL.x - dx, DL.z - dz] // world spot of a point in the showroom's frame
  // Moving parts (doors, podium) stay out of the bake.
  const moving = new Group()
  moving.position.copy(sr.g.position)
  moving.rotation.copy(sr.g.rotation)
  for (const d of sr.doors) moving.add(d)
  sr.podium.removeFromParent()
  moving.add(sr.podium)
  root.add(moving)
  g.add(sr.g)
  const { W: SW, D: SD, H: SH, door } = SHOWROOM
  solidRect(DL.x - SW / 2, DL.x + SW / 2, DL.z + SD - 0.5, DL.z + SD, SH)
  for (const s of [-1, 1]) solidRect(DL.x + s * (SW / 2 - 0.5) - 0.25 * (1 - s), DL.x + s * (SW / 2 - 0.5) + 0.25 * (1 + s), DL.z, DL.z + SD, SH)
  solidRect(DL.x - SW / 2, DL.x - door / 2, DL.z - 0.25, DL.z + 0.15, SH)
  solidRect(DL.x + door / 2, DL.x + SW / 2, DL.z - 0.25, DL.z + 0.15, SH)
  solidRect(DL.x - door / 2, DL.x + door / 2, DL.z - 0.25, DL.z + 0.15, SH - 3.3, 3.3)
  solidRect(DL.x - SW / 2 - 0.5, DL.x + SW / 2 + 0.5, DL.z - 0.5, DL.z + SD + 0.5, 0.6, SH) // roof (keeps the camera inside)
  solidRect(DL.x - SW / 2 - 12, DL.x - SW / 2, DL.z + SD - 16, DL.z + SD, 5) // service bay
  const [kx, kz] = dk(SHOWROOM.desk.x, SHOWROOM.desk.z)
  solidRect(kx - 4.4, kx + 4.4, kz - 0.5, kz + 1.4, 1.3)
  const [px, pz] = dk(SHOWROOM.podium.x, SHOWROOM.podium.z)
  solidCyl(4.4, 0.6, px, pz)
  const [wx, wz] = dk(-13, -3.6)
  solidRect(wx - 2.2, wx + 2.2, wz - 0.5, wz + 2.0, 0.9)
  // A tractor turning on the podium and a truck on show inside.
  const shown = tractor('#3f9a3a')
  shown.setLevel?.({ header: 0 })
  shown.g.position.y = 0.45
  shown.beacon = null
  sr.podium.add(shown.g)
  const inTruck = farmTruck('#2f6fd0', 'NEW')
  const [tx, tz] = dk(SHOWROOM.display.x, SHOWROOM.display.z)
  inTruck.g.position.set(tx, 0.12, tz)
  inTruck.g.rotation.y = Math.PI * 0.8
  g.add(inTruck.g)
  solid(1.3, 1.5, 3.5, tx, 1.5, tz, Math.PI * 0.8)
  // The lot: vehicles nose to the road with a price tag each, flags along the front, a pylon.
  const price = (id) => {
    const v = [...GAME.vehicles, ...(GAME.fleet ?? [])].find((q) => q.id === id)
    return v?.price ? `$${v.price.toLocaleString('en-US')}` : 'NEW'
  }
  const lotSpots = []
  const lotList = [
    { x: lot.minX + 8, make: () => tractor('#3f9a3a'), name: 'TRACTOR', id: 'tractors', box: [1.4, 1.6, 2.6] },
    { x: lot.minX + 21, make: () => tractor('#d6322c'), name: 'TRACTOR', id: 'tractors', box: [1.4, 1.6, 2.6] },
    { x: lot.minX + 34, make: () => farmTruck('#f2f2f2', 'SALE'), name: 'TRUCK', id: 'trucks', box: [1.3, 1.5, 3.4] },
    { x: lot.minX + 47, make: () => farmTruck('#c8302a', 'NEW'), name: 'TRUCK', id: 'trucks', box: [1.3, 1.5, 3.4] },
    { x: DL.x + 13, make: () => cropSprayer('#e8b830'), name: 'SPRAYER', id: 'sprayer', box: [1.6, 1.8, 3.2] },
    { x: DL.x + 30, make: () => combineHarvester('#3f9a3a'), name: 'COMBINE', id: 'combine', box: [2.6, 2.4, 4.6] },
    { x: DL.x + 50, make: () => farmTruck('#3a3d42', 'USED'), name: 'TRUCK', id: 'trucks', box: [1.3, 1.5, 3.4] },
  ]
  for (const [i, v] of lotList.entries()) {
    const vz = 72
    const ry = Math.PI + (i % 2 ? -0.25 : 0.25)
    const mdl = v.make()
    mdl.g.position.set(v.x, 0.04, vz)
    mdl.g.rotation.y = ry
    if (mdl.beacon) mdl.beacon = null
    g.add(mdl.g)
    solid(v.box[0], v.box[1], v.box[2], v.x, v.box[1], vz, ry)
    const label = v.id === 'combine' ? 'COMBINE' : v.name
    priceTag(g, v.x, 60.5, label, price(v.id), ['#d6322c', '#2f6fd0', '#3f8a4a'][i % 3], Math.PI)
    solidCyl(0.12, 2, v.x, 60.5)
    lotSpots.push({ x: v.x, z: 64, name: v.name })
  }
  for (let x = lot.minX + 2; x < lot.maxX; x += 9) {
    if (Math.abs(x - DL.x) < 5) continue
    cyl(g, 0.06, 0.07, 6.5, M('#d9dde1', { metalness: 0.6, roughness: 0.3 }), x, 3.25, SS.maxZ + 1.2, 8)
  }
  const flags = []
  for (let x = lot.minX + 2, i = 0; x < lot.maxX; x += 9, i++) {
    if (Math.abs(x - DL.x) < 5) continue
    const f = new Group()
    f.position.set(x, 6.2, SS.maxZ + 1.2)
    block(f, 0.04, 0.9, 1.4, M(['#d6322c', '#f2c230', '#2f6fd0', '#3f8a4a'][i % 4]), 0, -0.45, 0.72)
    root.add(f)
    flags.push(f)
  }
  pylon(g, lot.minX + 3, SS.maxZ + 3, [{ text: 'VEHICLE', size: 150, color: '#ffffff', stroke: '#13305e', strokeWidth: 14 }, { text: 'DEALER', size: 150, color: '#ffffff', stroke: '#13305e', strokeWidth: 14 }, { text: 'come inside!', size: 64, color: '#ffe9a0' }])
  solidRect(lot.minX + 0.8, lot.minX + 5.2, SS.maxZ + 2.7, SS.maxZ + 3.3, 4)
  // A bike rack by the door.
  for (let i = 0; i < 4; i++) {
    const r = cyl(g, 0.5, 0.5, 0.06, M('#9aa0a6', { metalness: 0.6 }), DL.x - 6 - i * 0.7, 0.5, DL.z - 2.5, 14)
    r.rotation.z = Math.PI / 2
  }

  // --- North-east: the Town Park --------------------------------------------------------------------------
  const P = { minX: mx1 + 3, maxX: T.maxX - 2, minZ: T.minZ + 4, maxZ: SN.minZ - 2 }
  const pc = { x: (P.minX + P.maxX) / 2, z: (P.minZ + P.maxZ) / 2 }
  const pathX = { minX: P.minX, maxX: P.maxX, minZ: pc.z - 1.8, maxZ: pc.z + 1.8 }
  const pathZ = { minX: pc.x - 1.8, maxX: pc.x + 1.8, minZ: P.minZ, maxZ: P.maxZ + 2 }
  for (const r of [pathX, pathZ]) {
    pave(root, r, gravel, 4, 0.03)
    addSurface(r, 'gravel')
  }
  const disc = cyl(root, 10, 10, 0.06, new MeshStandardMaterial({ map: (() => {
    const t = pav.clone()
    t.repeat.set(4, 4)
    t.needsUpdate = true
    return t
  })(), roughness: 0.9 }), pc.x, 0.03, pc.z, 40, false)
  disc.receiveShadow = true
  addSurface({ minX: pc.x - 9, maxX: pc.x + 9, minZ: pc.z - 9, maxZ: pc.z + 9 }, 'pavers')
  const ft = fountain()
  ft.g.position.set(pc.x, 0.06, pc.z)
  const spray = ft.spray
  spray.removeFromParent()
  g.add(ft.g)
  const sprayHolder = new Group()
  sprayHolder.position.copy(ft.g.position)
  sprayHolder.add(spray)
  root.add(sprayHolder)
  solidCyl(4.2, 0.8, pc.x, pc.z)
  solidCyl(0.9, 3.2, pc.x, pc.z)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const bx = pc.x + Math.cos(a) * 7.6
    const bz = pc.z + Math.sin(a) * 7.6
    bench(g, bx, bz, Math.atan2(pc.x - bx, pc.z - bz))
    solid(1.2, 0.5, 0.4, bx, 0.5, bz, Math.atan2(pc.x - bx, pc.z - bz))
  }
  // Hedges round the park, open where the paths come in.
  const gap = 3
  const hedges = [
    [P.minX, P.minZ, pc.x - gap, P.minZ], [pc.x + gap, P.minZ, P.maxX, P.minZ],
    [P.minX, P.maxZ, pc.x - gap, P.maxZ], [pc.x + gap, P.maxZ, P.maxX, P.maxZ],
    [P.minX, P.minZ, P.minX, pc.z - gap], [P.minX, pc.z + gap, P.minX, P.maxZ],
    [P.maxX, P.minZ, P.maxX, pc.z - gap], [P.maxX, pc.z + gap, P.maxX, P.maxZ],
  ]
  for (const [x0, z0, x1, z1] of hedges) {
    hedge(g, x0, z0, x1, z1)
    solidRect(Math.min(x0, x1) - 0.45, Math.max(x0, x1) + 0.45, Math.min(z0, z1) - 0.45, Math.max(z0, z1) + 0.45, 0.9)
  }
  // Gazebo (north-east quarter), pond (north-west), playground (south-east), picnic lawn (south-west).
  const gz = { x: pc.x + 30, z: pc.z - 17 }
  const gzb = gazebo()
  gzb.position.set(gz.x, 0, gz.z)
  g.add(gzb)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    solidCyl(0.2, 3.5, gz.x + Math.cos(a) * 4, gz.z + Math.sin(a) * 4)
  }
  block(g, 2.4, 0.3, 1.0, M('#b8a88e', { roughness: 0.9 }), gz.x, 0, gz.z + 4.8)
  addSurface({ minX: gz.x - 4.4, maxX: gz.x + 4.4, minZ: gz.z - 4.4, maxZ: gz.z + 4.4 }, 'wood')
  const pond = lake(20, 13, 23)
  pond.g.position.set(pc.x - 32, 0, pc.z - 16)
  root.add(pond.g)
  const pg = playground()
  pg.g.position.set(pc.x + 32, 0, pc.z + 16)
  root.add(pg.g)
  addSurface({ minX: pc.x + 26, maxX: pc.x + 38, minZ: pc.z + 11.5, maxZ: pc.z + 20.5 }, 'sand')
  for (const [x, zz, a] of [[pc.x - 38, pc.z + 12, 0.2], [pc.x - 28, pc.z + 18, -0.3], [pc.x - 44, pc.z + 21, 0.5]]) {
    picnicTable(g, x, zz, a)
    solid(1.1, 0.75, 1.0, x, 0.75, zz, a)
  }
  for (const [x, zz] of [[pc.x - 13, pc.z - 13], [pc.x + 13, pc.z - 13], [pc.x - 13, pc.z + 13], [pc.x + 13, pc.z + 13]]) {
    flowerBed(g, x, zz, 5, 3, rand)
    solidRect(x - 2.5, x + 2.5, zz - 1.5, zz + 1.5, 0.4)
  }
  // Trees, away from the paths and the features.
  const busy = [[pc.x, pc.z, 13], [gz.x, gz.z, 7], [pc.x - 32, pc.z - 16, 13], [pc.x + 32, pc.z + 16, 9], [pc.x - 36, pc.z + 17, 8]]
  for (let n = 0, tries = 0; n < 26 && tries < 400; tries++) {
    const x = P.minX + 3 + rand() * (P.maxX - P.minX - 6)
    const zz = P.minZ + 3 + rand() * (P.maxZ - P.minZ - 6)
    if (Math.abs(zz - pc.z) < 4.5 || Math.abs(x - pc.x) < 4.5) continue
    if (busy.some(([bx, bz, r]) => Math.hypot(x - bx, zz - bz) < r)) continue
    parkTree(g, x, zz, 0.9 + rand() * 0.5, rand)
    solidCyl(0.35, 3, x, zz)
    busy.push([x, zz, 5])
    n++
  }
  // The park's sign by the Main Street entrance.
  for (const s of [-1, 1]) block(g, 0.25, 2.6, 0.25, M('#6e4122'), P.minX - 1.2, 0, pc.z + 4.5 + s * 2.2)
  sign(g, 4.6, 1.3, { bg: '#2f6b45', border: '#f5efd6', borderWidth: 12, radius: 14, plank: 2, lines: [{ text: 'TOWN PARK', size: 150, color: '#f5efd6', stroke: '#173020', strokeWidth: 14 }] }, P.minX - 1.2, 2.2, pc.z + 4.5, -Math.PI / 2)

  // --- Street furniture --------------------------------------------------------------------------------------
  const lampAt = []
  for (let x = T.minX + 8; x < FARM.road.maxX - 4; x += 20) {
    if (Math.abs(x - MS.x) < 9) continue
    for (const lz of [SN.minZ + 1, SS.maxZ - 1]) {
      lampPost(g, x, lz, 4)
      solidCyl(0.2, 4, x, lz)
      lampAt.push([x, lz])
    }
  }
  for (let zz = T.minZ + 10; zz < T.maxZ - 6; zz += 20) {
    if (zz > SN.minZ - 6 && zz < SS.maxZ + 6) continue
    for (const lx of [mx0 - 2, mx1 + 2]) {
      lampPost(g, lx, zz, 4)
      solidCyl(0.2, 4, lx, zz)
    }
  }
  for (const [x, lz] of lampAt.slice(0, 2)) addLamp(x, 4.3, lz)
  // Benches, bins and planters along the sidewalks; fire hydrants at the corners.
  for (const [x, bz, ry] of [[T.minX + 30, SN.minZ + 1.4, Math.PI], [T.minX + 78, SN.minZ + 1.4, Math.PI], [T.minX + 126, SN.minZ + 1.4, Math.PI], [MK.x - 14, 66, 0], [MK.x + 14, 66, 0]]) {
    bench(g, x, bz, ry)
    solid(1.2, 0.5, 0.4, x, 0.5, bz, ry)
    cyl(g, 0.3, 0.26, 0.9, M('#2f5d3a', { roughness: 0.6 }), x + 2.2, 0.45 + (bz < 45 ? C : 0), bz, 10)
  }
  for (const [x, hz] of [[mx0 - 1.5, SN.minZ - 1], [mx1 + 1.5, SS.maxZ + 1], [T.minX + 6, SS.maxZ + 1]]) {
    cyl(g, 0.18, 0.2, 0.7, M('#d6322c', { roughness: 0.4 }), x, 0.35, hz, 10)
    cyl(g, 0.12, 0.18, 0.2, M('#d6322c', { roughness: 0.4 }), x, 0.8, hz, 10)
    const nub = cyl(g, 0.07, 0.07, 0.5, M('#d6322c'), x, 0.5, hz, 8)
    nub.rotation.z = Math.PI / 2
  }
  // A bus shelter on the park side of the road.
  {
    const bx = T.maxX - 14
    const bz = SN.minZ - 2.4
    const frame = M('#3a3d42', { metalness: 0.5, roughness: 0.4 })
    for (const s of [-1, 1]) block(g, 0.12, 2.6, 0.12, frame, bx + s * 2, 0, bz - 0.8)
    block(g, 4.2, 2.4, 0.06, M('#9fd8ff', { roughness: 0.05, transparent: true, opacity: 0.3 }), bx, 0.2, bz - 0.85)
    block(g, 4.6, 0.12, 1.8, M('#2f6fd0'), bx, 2.6, bz - 0.2)
    bench(g, bx, bz - 0.4, Math.PI)
    sign(g, 1.2, 0.5, { bg: '#2f6fd0', lines: [{ text: 'BUS', size: 200, color: '#ffffff' }] }, bx + 2.6, 2.3, bz)
    solidRect(bx - 2.1, bx + 2.1, bz - 0.95, bz - 0.75, 2.6)
  }
  // Welcome sign at the edge of town, a signpost to the farms at the crossroads.
  const ws = signCanvas(768, 240, { bg: '#2f5d3a', border: '#f5efd6', borderWidth: 14, radius: 20, plank: 2, lines: [{ text: 'HARVEST HOLLOW', size: 92, color: '#f5efd6', stroke: '#173020', strokeWidth: 10 }, { text: 'market · shops · park · vehicle dealer', size: 42, color: '#ffe9a0' }] })
  for (const s of [-1, 1]) block(g, 0.3, 3.6, 0.3, M('#6e4122'), T.minX + 4 + s * 3, 0, 33)
  box(g, 6.6, 2.1, 0.2, M('#2f5d3a'), T.minX + 4, 3, 33)
  signPanel(g, 6.4, 2, signMaterial(ws), T.minX + 4, 3, 33.12)
  signPanel(g, 6.4, 2, signMaterial(ws), T.minX + 4, 3, 32.88, Math.PI)
  solidRect(T.minX + 0.8, T.minX + 7.2, 32.8, 33.2, 4)
  {
    const sx = mx0 - 2.2
    const sz = SN.minZ - 2.2
    block(g, 0.2, 4.2, 0.2, M('#6e4122'), sx, 0, sz)
    const arms = [
      ['NORTH FARM', -Math.PI / 2, 3.7],
      ['EAST FARM', 0, 3.2],
      ['SOUTH FARM', Math.PI / 2, 2.7],
      ['HOME FARM', Math.PI, 2.2],
    ]
    for (const [text, a, y] of arms) {
      const arm = new Group()
      arm.position.set(sx, y, sz)
      arm.rotation.y = -a
      box(arm, 2.2, 0.42, 0.08, M('#b07a42'), 1.2, 0, 0)
      sign(arm, 2.1, 0.38, { bg: '#b07a42', lines: [{ text, size: 120, color: '#fff3d6', stroke: '#5a3018', strokeWidth: 10 }] }, 1.2, 0, 0.045)
      sign(arm, 2.1, 0.38, { bg: '#b07a42', lines: [{ text, size: 120, color: '#fff3d6', stroke: '#5a3018', strokeWidth: 10 }] }, 1.2, 0, -0.045, Math.PI)
      g.add(arm)
    }
    solidCyl(0.2, 4, sx, sz)
  }
  // Trees down Main Street between the town and the rail.
  for (let zz = T.minZ - 6; zz > FARM.dirtRoad.maxZ + 4; zz -= 11) for (const x of [mx0 - 4, mx1 + 4]) {
    parkTree(g, x, zz, 0.9 + rand() * 0.3, rand)
    solidCyl(0.35, 3, x, zz)
  }
  fence([[T.minX + 1, T.minZ - 2], [mx0 - 3, T.minZ - 2]], 'low')
  fence([[mx1 + 3, T.minZ - 2], [T.maxX, T.minZ - 2]], 'low')

  bakeInto(root, g)

  // --- People --------------------------------------------------------------------------------------------
  const keepers = [0, 1, 2, 3].map((i) => {
    const n = makeNPC({ shirt: ['#2f8a57', '#e2763a', '#2f6fd0', '#d64a8a'][i], pants: '#3a3a44', apron: '#f5efd6', hat: i % 2 ? 'straw' : 'cap', hatColor: '#2f8a57' })
    const [kx2] = mk(-25 + [0.5, 2.5, 6.5, 8.5][i] * 5, 0)
    n.group.position.set(kx2, 0.42, MK.z + 2.6)
    n.group.rotation.y = Math.PI
    root.add(n.group)
    return n
  })
  const salesman = makeNPC({ shirt: '#f2f2f2', pants: '#2b2b2b', hair: '#3a2416' })
  salesman.group.position.set(kx, 0.12, kz + 1.4)
  salesman.group.rotation.y = Math.PI
  root.add(salesman.group)
  const looks = [
    { shirt: '#8a5ad8', pants: '#2c2c3a', hat: 'straw', item: 'basket' },
    { shirt: '#3a86d8', pants: '#e4d2b0', hair: '#c9862b' },
    { shirt: '#e58ab8', pants: '#3a3a44', hat: 'beanie', hatColor: '#f2c230' },
    { shirt: '#4cae5a', pants: '#2c3e66', item: 'box' },
    { shirt: '#f2a03a', pants: '#3a4a6a', hat: 'cap', hatColor: '#d63a2c' },
    { shirt: '#d63a2c', pants: '#2b2b2b', item: 'basket' },
    { shirt: '#2f6fd0', pants: '#3a3a44', hair: '#2a1a10' },
    { shirt: '#f7f4ec', pants: '#2c3e66', hat: 'straw' },
    { shirt: '#3f8a4a', pants: '#e4d2b0', hat: 'cap', hatColor: '#2f6fd0' },
  ]
  const paths = [
    { pts: [[MK.x - 18, 70], [MK.x + 18, 70], [MK.x + 18, 80], [MK.x - 18, 80]], y: 0.04 },
    { pts: [[T.minX + 8, SS.minZ + 1.5], [mx0 - 4, SS.minZ + 1.5]], y: C },
    { pts: [[MK.x - 10, 62], [MK.x + 4, 76], [MK.x + 22, 64]], y: 0.04 },
    { pts: [[T.minX + 8, SN.minZ + 1.5], [mx0 - 4, SN.minZ + 1.5]], y: C },
    { pts: [[pc.x - 30, pc.z], [pc.x - 9, pc.z], [pc.x, pc.z - 9], [pc.x, P.minZ + 2]], y: 0.04 },
    { pts: [[mx1 + 4, SS.minZ + 1.5], [T.maxX - 4, SS.minZ + 1.5]], y: C },
    { pts: [[lot.minX + 6, 66], [lot.maxX - 8, 66]], y: 0.04 },
    { pts: [[pc.x + 9, pc.z], [P.maxX - 4, pc.z], [pc.x, pc.z + 9], [pc.x, P.maxZ - 2]], y: 0.04 },
    { pts: [[kx - 6, kz + 5], [kx + 8, kz + 4], [kx + 2, DL.z + 4]], y: 0.12 },
  ]
  const walkers = looks.map((look, i) => {
    const n = makeNPC(look)
    root.add(n.group)
    return makeWalker(n, paths[i].pts, { speed: 1.2 + (i % 4) * 0.12, pause: 3, pingPong: true, y: paths[i].y })
  })
  // A kid by the swings and someone feeding the pond.
  const sitters = [
    { look: { shirt: '#f2c230', pants: '#2f6fd0' }, x: pc.x + 30, z: pc.z + 12, ry: Math.PI },
    { look: { shirt: '#8a5a3a', pants: '#3a4a6a', hat: 'straw' }, x: pc.x - 21, z: pc.z - 10, ry: -Math.PI / 2 },
  ].map(({ look, x, z: zz, ry }) => {
    const n = makeNPC(look)
    n.group.position.set(x, 0.04, zz)
    n.group.rotation.y = ry
    if (look.shirt === '#f2c230') n.group.scale.setScalar(0.7)
    root.add(n.group)
    return n
  })

  const doorAt = { x: DL.x, z: DL.z }
  let doorOpen = 0
  return {
    dealerAt: [DL.x, DL.z - 2],
    marketAt: [MK.x, MK.z - 2],
    // Interaction spots (hud.js): the front desk inside and every vehicle on the lot.
    desk: { x: kx, z: kz - 2, reach: DL.reach },
    lotSpots,
    update(dt, t, p) {
      for (const k of keepers) idle(k, t, dt, 0.8)
      idle(salesman, t, dt, 0.6)
      for (const n of sitters) idle(n, t, dt, 0.5)
      for (const w of walkers) updateWalker(w, t, dt)
      sr.podium.rotation.y = t * 0.3
      for (const [i, f] of flags.entries()) f.rotation.y = Math.sin(t * 2 + i) * 0.4
      spray.scale.y = 1 + Math.sin(t * 7) * 0.06
      for (const [i, s] of pg.swings.entries()) s.rotation.x = Math.sin(t * 1.6 + i * 1.3) * (i ? 0.35 : 0.15)
      pond.update?.(dt, t)
      // The market clock shows the in-game hour from the wall clock (minute hand sweeps).
      clock.rotation.z = -t * 0.05
      // Sliding doors: open while someone (the player or the walker inside) is near.
      const near = p && Math.hypot(p.x - doorAt.x, p.z - doorAt.z) < 6
      doorOpen += ((near ? 1 : 0) - doorOpen) * Math.min(1, dt * 5)
      for (const d of sr.doors) d.position.x = d.userData.home + d.userData.dir * doorOpen * (door / 2 - 0.1)
    },
  }
}

// A town house with a low picket fence and a gravel front path (front faces +Z turned by ry).
function house(g, x, z, ry, i, rand) {
  const colors = [['#e8c48a', '#7a3a2a'], ['#cfe0e8', '#3a5a7a'], ['#f2d6d6', '#7a3a4a'], ['#e0e8cf', '#4a6a3a'], ['#f4e2b8', '#8a4a2a'], ['#d8d0e8', '#4a3a6a']]
  const [c, r] = colors[i % colors.length]
  const h = townHouse(c, r, 8 + (i % 2), 7)
  h.position.set(x, 0, z)
  h.rotation.y = ry
  g.add(h)
  const turned = Math.abs(Math.sin(ry)) > 0.5
  const hw = (turned ? 3.5 : 4.5) + 0.1
  const hd = (turned ? 4.5 : 3.5) + 0.1
  solidRect(x - hw, x + hw, z - hd, z + hd, 6.5)
  // Front yard: fence 5 m out with a gap at the path.
  const fx = Math.sin(ry)
  const fz = Math.cos(ry)
  const ax = -fz
  const az = fx
  const out = 6
  const cx = x + fx * out
  const cz = z + fz * out
  const half = 5.5
  fence([[cx + ax * -half, cz + az * -half], [cx + ax * -1.2, cz + az * -1.2]], 'low')
  fence([[cx + ax * 1.2, cz + az * 1.2], [cx + ax * half, cz + az * half]], 'low')
  for (let k = 0; k < 4; k++) {
    const d = 3.8 + k * 0.8
    block(g, 0.9 + rand() * 0.2, 0.03, 0.5, M('#c8bfae', { roughness: 0.95 }), x + fx * d, 0, z + fz * d, ry)
  }
  if (i % 3 === 0) parkTree(g, x + ax * 6.5 + fx * 2, z + az * 6.5 + fz * 2, 0.8, rand)
  if (i % 2 === 1) {
    cyl(g, 0.35, 0.3, 0.5, M('#b65a32'), x + ax * 2.2 + fx * 4.2, 0.25, z + az * 2.2 + fz * 4.2, 10)
    cyl(g, 0.38, 0.38, 0.4, E('#e84a7a', 0.05, { roughness: 0.8 }), x + ax * 2.2 + fx * 4.2, 0.65, z + az * 2.2 + fz * 4.2, 7)
  }
}
