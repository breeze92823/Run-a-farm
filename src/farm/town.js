import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { FARM } from '../config.js'
import { M, addSurface, bakeInto, block, box, cyl, signCanvas, signMaterial, signPanel, solid, solidCyl, solidRect } from './kit.js'
import { dealer, townHouse, townMarket } from './models.js'
import { farmTruck, tractor } from './vehicles.js'
import { lampPost } from './props.js'
import { idle, makeNPC, makeWalker, updateWalker } from './npc.js'
import { paintPavers, tex } from './textures.js'

// The town east along the road, outside the farm: the TOWN MARKET (walk, ride
// or drive into the green SELL HERE square in front of it and everything you
// carry is sold at market prices) and the VEHICLE DEALER (tractors, trucks and
// bike upgrades, E at its door), a paved square, houses, street lamps,
// flags, a welcome sign and shoppers.

const T = FARM.town
const MK = FARM.townMarket
const DL = FARM.dealer

export function buildTown(root, { addLamp }) {
  const g = new Group()
  // Paved square in front of the market and the dealer.
  const square = { minX: T.minX + 22, maxX: T.maxX - 4, minZ: FARM.sidewalkS.maxZ, maxZ: 74 }
  const pav = tex(paintPavers(512, 16, '#d8cbb4', '#c4b496', '#8e7c62', 993).color, 1)
  pav.repeat.set((square.maxX - square.minX) / 6, (square.maxZ - square.minZ) / 6)
  const sq = new Mesh(new PlaneGeometry(square.maxX - square.minX, square.maxZ - square.minZ), new MeshStandardMaterial({ map: pav, roughness: 0.9 }))
  sq.rotation.x = -Math.PI / 2
  sq.position.set((square.minX + square.maxX) / 2, 0.03, (square.minZ + square.maxZ) / 2)
  sq.receiveShadow = true
  root.add(sq)
  addSurface(square, 'pavers')
  // The SELL HERE square (the market zone's walkable part).
  const z = MK.zone
  const sell = signCanvas(512, 384, { bg: 'rgba(47,138,87,0.85)', border: '#f5efd6', borderWidth: 16, radius: 30, lines: [{ text: 'SELL', size: 130, color: '#f5efd6' }, { text: 'HERE', size: 130, color: '#f5efd6' }] })
  const mat = signMaterial(sell, { transparent: true })
  const sp = signPanel(root, 14, 10.5, mat, (z.minX + z.maxX) / 2, 0.05, (FARM.sidewalkS.maxZ + MK.z) / 2)
  sp.rotation.x = -Math.PI / 2

  // The market hall, facing the road (north).
  const m = townMarket()
  m.g.position.set(MK.x, 0, MK.z)
  m.g.rotation.y = Math.PI
  root.add(m.g)
  solidRect(MK.x - 10, MK.x + 10, MK.z, MK.z + 12, 7)
  // Market stall keepers.
  const keepers = [0, 1].map((i) => {
    const n = makeNPC({ shirt: i ? '#e2763a' : '#2f8a57', pants: '#3a3a44', apron: '#f5efd6', hat: i ? 'straw' : 'cap', hatColor: '#2f8a57' })
    n.group.position.set(MK.x - 4 + i * 8, 0.04, MK.z + 2.4)
    n.group.rotation.y = Math.PI
    root.add(n.group)
    return n
  })

  // The dealer, with a tractor turning on its podium and a truck out front.
  const d = dealer()
  d.g.position.set(DL.x, 0, DL.z)
  d.g.rotation.y = Math.PI
  root.add(d.g)
  solidRect(DL.x - 11, DL.x + 11, DL.z + 13.4, DL.z + 14.6, 7)
  solidRect(DL.x - 11, DL.x - 10.4, DL.z, DL.z + 14, 7)
  solidRect(DL.x + 10.4, DL.x + 11, DL.z, DL.z + 14, 7)
  const show = farmTruck('#c8302a', 'NEW')
  show.g.position.set(DL.x + 8, 0.03, DL.z - 4)
  show.g.rotation.y = Math.PI * 0.85
  root.add(show.g)
  solid(1.3, 1.5, 3.6, DL.x + 8, 1.5, DL.z - 4, Math.PI * 0.85)
  const display = tractor('#3f9a3a')
  display.setLevel({ header: 0 })
  d.podium.add(display.g)
  display.g.position.y = 0.4
  display.beacon = null
  const salesman = makeNPC({ shirt: '#f2f2f2', pants: '#2b2b2b', hair: '#3a2416' })
  salesman.group.position.set(DL.x - 3, 0.34, DL.z + 2)
  salesman.group.rotation.y = Math.PI
  root.add(salesman.group)

  // Houses along the back of the square and across the road.
  const houses = [
    [T.minX + 10, 90, 0, '#e8c48a', '#7a3a2a'],
    [T.minX + 44, 94, 0, '#cfe0e8', '#3a5a7a'],
    [T.maxX - 10, 92, 0, '#f2d6d6', '#7a3a4a'],
    [T.minX + 14, 14, Math.PI, '#e0e8cf', '#4a6a3a'],
    [T.minX + 40, 12, Math.PI, '#f4e2b8', '#8a4a2a'],
    [T.minX + 70, 14, Math.PI, '#d8d0e8', '#4a3a6a'],
    [T.minX + 100, 12, Math.PI, '#e8c48a', '#6a3a2a'],
    [T.minX + 130, 14, Math.PI, '#cfe0e8', '#3a5a7a'],
  ]
  for (const [x, hz, ry, c, r] of houses) {
    const h = townHouse(c, r)
    h.position.set(x, 0, hz)
    h.rotation.y = ry
    root.add(h)
    if (hz > 50) solidRect(x - 4, x + 4, hz - 3.5, hz + 3.5, 6)
  }
  // Street lamps along both sidewalks, benches and planters.
  for (let x = T.minX + 6; x < T.maxX; x += 18) {
    for (const lz of [FARM.sidewalkN.minZ + 1, FARM.sidewalkS.maxZ - 1]) {
      const [bx, by, bz] = lampPost(g, x, lz, 4)
      if (x < T.minX + 60 && lz > 50) addLamp(bx, by, bz)
      solidCyl(0.2, 4, x, lz)
    }
  }
  for (const [x, bz] of [[MK.x - 14, 66], [DL.x - 16, 66], [DL.x + 16, 66]]) {
    block(g, 2.4, 0.1, 0.7, M('#b67a42'), x, 0.45, bz)
    block(g, 2.4, 0.5, 0.1, M('#b67a42'), x, 0.6, bz + 0.3)
    for (const s of [-1, 1]) block(g, 0.1, 0.45, 0.6, M('#2f2f33'), x + s, 0, bz)
    solid(1.2, 0.5, 0.4, x, 0.5, bz)
    cyl(g, 0.6, 0.5, 0.7, M('#b65a32'), x + 2.4, 0.35, bz, 12)
    cyl(g, 0.65, 0.7, 0.8, M('#e8732a', { flatShading: true }), x + 2.4, 1.0, bz, 7)
  }
  // Welcome sign at the edge of town.
  const ws = signCanvas(768, 240, { bg: '#2f5d3a', border: '#f5efd6', borderWidth: 14, radius: 20, plank: 2, lines: [{ text: 'WELCOME TO TOWN', size: 92, color: '#f5efd6', stroke: '#173020', strokeWidth: 10 }, { text: 'market · vehicle dealer', size: 48, color: '#ffe9a0' }] })
  for (const s of [-1, 1]) block(g, 0.3, 3.6, 0.3, M('#6e4122'), T.minX + 4 + s * 3, 0, 32)
  box(g, 6.6, 2.1, 0.2, M('#2f5d3a'), T.minX + 4, 3, 32)
  signPanel(g, 6.4, 2, signMaterial(ws), T.minX + 4, 3, 32.12)
  solidRect(T.minX + 0.8, T.minX + 7.2, 31.8, 32.2, 4)
  bakeInto(root, g)

  // Shoppers strolling the square and the sidewalks.
  const looks = [
    { shirt: '#8a5ad8', pants: '#2c2c3a', hat: 'straw', item: 'basket' },
    { shirt: '#3a86d8', pants: '#e4d2b0', hair: '#c9862b' },
    { shirt: '#e58ab8', pants: '#3a3a44', hat: 'beanie', hatColor: '#f2c230' },
    { shirt: '#4cae5a', pants: '#2c3e66', item: 'box' },
  ]
  const walkers = looks.map((look, i) => {
    const n = makeNPC(look)
    root.add(n.group)
    const y = FARM.curbHeight
    const paths = [
      [[MK.x - 10, 68], [MK.x + 10, 68], [DL.x - 10, 70]],
      [[T.minX + 8, FARM.sidewalkS.minZ + 1.5], [T.maxX - 6, FARM.sidewalkS.minZ + 1.5]],
      [[DL.x - 6, 64], [DL.x + 6, 64], [MK.x, 62]],
      [[T.minX + 8, FARM.sidewalkN.minZ + 1.5], [T.maxX - 6, FARM.sidewalkN.minZ + 1.5]],
    ]
    return makeWalker(n, paths[i], { speed: 1.3 + i * 0.1, pause: 3, pingPong: true, y: i % 2 ? y : 0.04 })
  })

  return {
    dealerAt: [DL.x, DL.z - 2],
    marketAt: [MK.x, MK.z - 2],
    update(dt, t) {
      for (const k of keepers) idle(k, t, dt, 0.8)
      idle(salesman, t, dt, 0.6)
      for (const w of walkers) updateWalker(w, t, dt)
      d.podium.rotation.y = t * 0.3
      for (const [i, f] of d.flags.entries()) f.rotation.y = Math.sin(t * 2 + i) * 0.4
    },
  }
}
