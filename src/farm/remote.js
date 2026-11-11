import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { FARM, GAME, slotRect } from '../config.js'
import { label } from '../propkit.js'
import { mulberry32 } from '../textures.js'
import { world } from '../physics.js'
import { M, bakeInto, block, box, captureColliders, cyl, gableRoof, prism, solidRect } from './kit.js'
import { cowBarn, droneBase, duckHouse, oilTank, pigHouse, stables, townHouse } from './models.js'
import { cow, duck, horse, pig, sheep } from './animals.js'
import { farmTruck, tractor } from './vehicles.js'
import { awning, crate, pumpkin } from './props.js'
import { tube } from './detail.js'
import { boundary } from './boundary.js'
import { sign } from './townmodels.js'
import * as net from '../net.js'

// The three farm slots around the town that are not the player's own (FARM.farmSlots 1-3). Each
// shows the farm of the other player in the room who holds it, drawn from the summary their game
// sends (net.js `farmInfo`: buildings, fields + crops, stand level, vehicles, drones, pump jacks,
// farm level) as a lower-detail farm: fence and gate with the owner's name, farmhouse, farm stand,
// coops, fields with their crop, barn, bays with tractors / trucks, ranch barns, oil pumps, drone
// base. A slot nobody holds is bare land with an OPEN FARMLAND sign. Every slot is rebuilt only
// when what it shows changes. The other players themselves (their Bloxity looks) are
// drawn by remotePlayers.js, which places them with this module's `mapPose` (their pose mapped from
// their frame into this one: their home farm <-> the slot it is drawn at).
//
// A slot's own frame: W x D m centred on the slot, the gate in the middle of the +Z edge.

const SW = FARM.slot.w
const SD = FARM.slot.d
const HW = SW / 2
const HD = SD / 2

const SEED_COLOR = { wheat: '#e3b84e', corn: '#f4d03a', carrot: '#f08a24', sunflower: '#f7c948', pumpkin: '#ee7a1f' }
const GREEN = new Color('#6fa83a')

export function buildRemote(root) {
  const slots = [1, 2, 3].map((k) => {
    const s = FARM.farmSlots[k]
    const holder = new Group()
    holder.name = `farmSlot:${k}`
    holder.position.set(s.x, 0, s.z)
    holder.rotation.y = s.ry
    root.add(holder)
    return { k, s, holder, key: null, colliders: [], content: null, fence: null, tag: null }
  })

  // Slot-frame point -> world.
  const toWorld = (s, lx, lz) => {
    const c = Math.cos(s.ry)
    const n = Math.sin(s.ry)
    return [s.x + lx * c + lz * n, s.z - lx * n + lz * c]
  }
  // A collider over a slot-frame rect (slots are turned by quarter turns, so it stays axis-aligned).
  const rect = (slot, x0, x1, z0, z1, h) => {
    const [ax, az] = toWorld(slot.s, x0, z0)
    const [bx, bz] = toWorld(slot.s, x1, z1)
    solidRect(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), h)
  }

  function clear(slot) {
    for (const c of slot.colliders) {
      try {
        world?.removeCollider(c, false)
      } catch {
        // Already gone.
      }
    }
    slot.colliders = []
    if (slot.fence) {
      slot.fence.traverse((o) => {
        if (o.isMesh) o.geometry.dispose()
      })
      slot.fence.removeFromParent()
      slot.fence = null
    }
    if (slot.content) {
      slot.content.traverse((o) => {
        if (o.isMesh) o.geometry.dispose()
      })
      slot.content.removeFromParent()
      slot.content = null
    }
    if (slot.tag) {
      slot.tag.material.map?.dispose()
      slot.tag.material.dispose()
      slot.tag.removeFromParent()
      slot.tag = null
    }
  }

  function build(slot, info, name) {
    clear(slot)
    const g = new Group()
    // The boundary fence's rails are instanced (fence.js): they live beside the baked content.
    slot.fence = new Group()
    slot.holder.add(slot.fence)
    slot.colliders = captureColliders(() => {
      if (info) farm(g, slot, info, name)
      else bare(g, slot)
    })
    const baked = bakeInto(slot.holder, g)
    baked.position.set(0, 0, 0)
    baked.quaternion.identity()
    slot.content = baked
    const tag = label(info ? `${name.toUpperCase()}'S FARM` : 'OPEN FARMLAND', 2.2, info ? { color: '#fff3d6', outline: '#173020' } : { color: '#ffe9a0', outline: '#5a3018' })
    tag.position.set(0, 10.5, HD + 1)
    slot.holder.add(tag)
    slot.tag = tag
  }

  // --- Bare land -------------------------------------------------------------------------------------------
  function bare(g, slot) {
    const rand = mulberry32(700 + slot.k)
    // A rougher meadow patch, corner posts, a sign at the gateway, hay bales, rocks, an old tree.
    const meadow = new Mesh(new PlaneGeometry(SW - 4, SD - 4), new MeshStandardMaterial({ color: '#b7c27a', roughness: 1, transparent: true, opacity: 0.35, depthWrite: false }))
    meadow.rotation.x = -Math.PI / 2
    meadow.position.y = 0.02
    g.add(meadow)
    // The same boundary fence as a farm (its gateway toward the town), the sign beside the gateway.
    fenceSlot(g, slot)
    const sx = 11
    for (const s of [-1, 1]) block(g, 0.3, 2.8, 0.3, M('#6e4122'), sx + s * 3, 0, HD - 1.5)
    box(g, 6.6, 1.8, 0.16, M('#b07a42'), sx, 2.2, HD - 1.5)
    sign(g, 6.4, 1.7, { bg: '#b07a42', plank: 2, border: '#6e4122', borderWidth: 10, radius: 8, lines: [{ text: 'OPEN FARMLAND', size: 110, color: '#fff3d6', stroke: '#5a3018', strokeWidth: 10 }, { text: 'waiting for a farmer', size: 60, color: '#ffe9a0' }] }, sx, 2.2, HD - 1.4)
    rect(slot, sx - 3.3, sx + 3.3, HD - 1.7, HD - 1.3, 3)
    const hay = M('#e3c46a', { roughness: 1 })
    for (let i = 0; i < 6; i++) {
      const x = -60 + rand() * 120
      const z = -60 + rand() * 110
      const b = cyl(g, 0.8, 0.8, 1.3, hay, x, 0.8, z, 14)
      b.rotation.z = Math.PI / 2
      b.rotation.y = rand() * 3
      rect(slot, x - 0.8, x + 0.8, z - 0.8, z + 0.8, 1.5)
    }
    for (let i = 0; i < 9; i++) {
      const r = 0.4 + rand() * 0.9
      const m = cyl(g, r * 0.7, r, r * 0.8, M('#9a958c', { roughness: 1, flatShading: true }), -80 + rand() * 160, r * 0.3, -70 + rand() * 130, 6)
      m.rotation.y = rand() * 3
    }
    // Tall grass clumps.
    const tuft = M('#9cb35a', { roughness: 1 })
    for (let i = 0; i < 70; i++) {
      const x = -85 + rand() * 170
      const z = -75 + rand() * 150
      for (let k = 0; k < 3; k++) {
        const b = block(g, 0.08, 0.6 + rand() * 0.5, 0.08, tuft, x + (rand() - 0.5) * 0.4, 0, z + (rand() - 0.5) * 0.4)
        b.rotation.z = (rand() - 0.5) * 0.5
      }
    }
  }

  // The boundary fence round a slot, the same as every farm's (farm/boundary.js): its gateway in the
  // middle of the +Z side toward the town, GATE m wide. Colliders follow the slot's turn.
  const GATE = 12
  function fenceSlot(g, slot) {
    const h = GATE / 2
    boundary(g, [[-HW, HD], [-HW, -HD], [HW, -HD], [HW, HD]], [[], [], [], [[HW - h, HW + h]]], {
      into: slot.fence,
      collide: false,
      posts: (x, z, r) => rect(slot, x - r, x + r, z - r, z + r, 2),
    })
    rect(slot, -HW - 0.2, -h, HD - 0.2, HD + 0.2, 1.3)
    rect(slot, h, HW + 0.2, HD - 0.2, HD + 0.2, 1.3)
    rect(slot, -HW - 0.2, -HW + 0.2, -HD, HD, 1.3)
    rect(slot, HW - 0.2, HW + 0.2, -HD, HD, 1.3)
    rect(slot, -HW, HW, -HD - 0.2, -HD + 0.2, 1.3)
  }

  // --- A player's farm ------------------------------------------------------------------------------------
  function farm(g, slot, info, name) {
    const rand = mulberry32(900 + slot.k)
    const built = new Set(info.b ?? [])
    const dirt = M('#b8936a', { roughness: 1 })
    const red = M('#c3282c', { roughness: 0.8 })
    const white = M('#f7f4ec')
    const roof = M('#62656b', { roughness: 0.6 })
    const ground = (x0, x1, z0, z1, mat, y = 0.03) => block(g, x1 - x0, 0.04, z1 - z0, mat, (x0 + x1) / 2, y - 0.02, (z0 + z1) / 2, 0, false)

    // The boundary fence, and a gate arch over its gateway with the owner's board.
    fenceSlot(g, slot)
    const wood = M('#6e4122')
    for (const s of [-1, 1]) block(g, 0.56, 5.2, 0.56, wood, s * 6, 0, HD)
    box(g, 13, 0.5, 0.5, wood, 0, 5.2, HD)
    box(g, 9, 1.9, 0.18, M('#2f5d3a'), 0, 4.0, HD + 0.3)
    sign(g, 8.8, 1.8, { bg: '#2f5d3a', border: '#f5efd6', borderWidth: 10, radius: 10, plank: 2, lines: [{ text: `${name.toUpperCase()}'S FARM`, size: 96, color: '#f5efd6', stroke: '#173020', strokeWidth: 10 }, { text: `farm level ${Math.max(1, info.lv | 0)}`, size: 54, color: '#ffe9a0' }] }, 0, 4.0, HD + 0.4)
    // Drive from the gate into the yard, the yard itself.
    ground(-4, 4, 16, HD, dirt)
    ground(-HW + 4, HW - 4, 14, 22, dirt)

    // Farmhouse.
    const house = townHouse('#f7f4ec', '#3f8a4a', 12, 9)
    house.position.set(-62, 0, 58)
    g.add(house)
    rect(slot, -68, -56, 53.5, 62.5, 6)
    // Farm stand by the gate, bigger with the stand level.
    const lv = info.s | 0
    block(g, 6, 1, 1.2, M('#a8693a'), 18, 0, 70)
    rect(slot, 15, 21, 69.4, 70.6, 1)
    for (let i = 0; i < Math.min(6, 2 + lv); i++) crate(g, 15.6 + (i % 3) * 1.8, 1, 70 - Math.floor(i / 3) * 0.1, 0.7)
    if (lv >= 2) {
      const aw = awning(7, 3.2, 3.6, 2.8)
      aw.position.set(18, 0, 70.4)
      g.add(aw)
      for (const s of [-1, 1]) block(g, 0.14, 3.4, 0.14, wood, 18 + s * 3.3, 0, 71.8)
    }
    if (lv >= 5) block(g, 2.4, 1.6, 1.2, M('#e8f0f4'), 23, 0, 69.6)
    if (lv >= 7) {
      box(g, 6, 1.1, 0.16, M('#d6322c'), 18, 4.4, 69.2)
      sign(g, 5.8, 1.0, { bg: '#d6322c', lines: [{ text: 'FARM STAND', size: 120, color: '#ffffff' }] }, 18, 4.4, 69.29)
    }
    pumpkin(g, 12.5, 71.5, 0.4)

    // Coops (coop 1 always), hens pecking in the yard.
    const coops = ['coop1', 'coop2', 'coop3'].filter((id) => id === 'coop1' || built.has(id))
    coops.forEach((_, i) => {
      const cx = -74 + i * 14
      block(g, 4.2, 2.6, 3.2, red, cx, 0.3, 32)
      prism(g, 4.2, 1.3, 3.2, red, cx, 2.9, 32)
      gableRoof(g, 4.2, 3.2, 2.9, 34, roof, { overhang: 0.3, cx, cz: 32, trim: white })
      block(g, 0.9, 1.4, 0.08, M('#3a2418'), cx, 0.3, 33.62)
      rect(slot, cx - 2.2, cx + 2.2, 30.3, 33.7, 4)
      for (let h = 0; h < 4; h++) {
        const hx = cx - 3 + rand() * 6
        const hz = 36 + rand() * 5
        box(g, 0.32, 0.3, 0.42, white, hx, 0.3, hz)
        box(g, 0.12, 0.1, 0.12, M('#d6322c'), hx, 0.52, hz + 0.18)
      }
    })
    if (built.has('seedMarket')) {
      const aw = awning(6, 3, 3.4, 2.6, { a: '#3f8a4a' })
      aw.position.set(-22, 0, 33)
      g.add(aw)
      block(g, 5.6, 1, 1.2, M('#a8693a'), -22, 0, 32)
      for (let i = 0; i < 4; i++) block(g, 0.8, 0.5, 0.6, M(['#c9a874', '#e2b24a', '#d6c08a', '#b89a5a'][i]), -24.4 + i * 1.6, 1, 32)
      rect(slot, -25, -19, 31.2, 32.8, 1)
    }
    // Storage barn.
    if (built.has('storage')) {
      block(g, 24, 8, 18, red, 64, 0, 28)
      prism(g, 18, 6, 24, red, 64, 8, 28, Math.PI / 2)
      gableRoof(g, 24, 18, 8, 34, roof, { overhang: 0.6, thick: 0.25, axis: 'x', cx: 64, cz: 28, trim: white })
      block(g, 8, 6, 0.2, M('#24170f'), 64, 0, 37.1)
      for (const s of [-1, 1]) tube(g, [64 + s * 4, 0.1, 37.25], [64 - s * 4, 5.9, 37.25], 0.1, white, 4)
      ground(50, 78, 37, 46, M('#bdbab3', { roughness: 0.95 }))
      rect(slot, 52, 76, 19, 37, 9)
    }
    // Truck bay with the trucks.
    const tk = Math.min(4, info.tk | 0)
    if (built.has('truckBay')) {
      ground(28, 80, 50, 66, M('#5a5d62', { roughness: 0.9 }))
      for (let i = 0; i <= 4; i++) block(g, 0.3, 4.5, 0.3, M('#9aa0a6', { metalness: 0.5 }), 30 + i * 12.5, 0, 50)
      block(g, 52, 0.4, 7, M('#2f6fd0'), 54, 4.5, 52)
      for (let i = 0; i < tk; i++) {
        const t = farmTruck(['#2f6fd0', '#c8302a', '#3f8a4a', '#f2c230'][i], `FARM ${i + 1}`)
        t.g.position.set(36 + i * 12.5, 0.03, 58)
        t.g.rotation.y = Math.PI
        g.add(t.g)
        rect(slot, 34.6 + i * 12.5, 37.4 + i * 12.5, 54.5, 61.5, 2.6)
      }
    }
    // Tractor park.
    const tr = Math.min(4, info.tr | 0)
    if (built.has('tractorBay')) {
      ground(6, 46, -4, 10, M('#a59a86', { roughness: 1 }))
      for (let i = 0; i < tr; i++) {
        const t = tractor(['#3f9a3a', '#d6322c', '#2f6fd0', '#f2c230'][i])
        t.g.position.set(12 + i * 10, 0.03, 3)
        t.g.rotation.y = Math.PI
        g.add(t.g)
        rect(slot, 10.6 + i * 10, 13.4 + i * 10, 0.4, 5.6, 2.8)
      }
    }
    // Ranch barns (with a couple of their animals), smaller than the real ones.
    const ranch = [
      ['duckHouse', duckHouse, duck],
      ['cowBarn', cowBarn, cow],
      ['pigPen', pigHouse, pig],
      ['stables', stables, horse],
      ['sheepShed', null, sheep],
    ].filter(([id]) => built.has(id))
    ranch.slice(0, 4).forEach(([, make, animal], i) => {
      const x = -74 + i * 20
      const z = 2
      if (make) {
        const b = make()
        b.g.position.set(x, 0, z - 4)
        b.g.scale.setScalar(0.55)
        g.add(b.g)
      } else {
        block(g, 8, 3.5, 6, M('#e8dcc0'), x, 0, z - 4)
        gableRoof(g, 8, 6, 3.5, 30, roof, { cx: x, cz: z - 4 })
      }
      rect(slot, x - 5, x + 5, z - 8, z, 4)
      for (let k = 0; k < 2; k++) {
        const a = animal(k + i * 3)
        a.g.position.set(x - 2.5 + k * 5, 0, z + 4 + rand() * 3)
        a.g.rotation.y = rand() * 6
        g.add(a.g)
      }
      fenceLine(g, [[x - 8, z + 1], [x - 8, z + 10], [x + 8, z + 10], [x + 8, z + 1]], 'low')
    })
    // Fields at the back: one per owned field, its crop's colour and height by growth.
    const plots = (info.p ?? []).slice(0, 8)
    const cols = 4
    const fw = (136 - 3 * 4) / cols
    const fd = 30
    plots.forEach(([seed, grow], i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      const x0 = -86 + c * (fw + 4)
      const z0 = -12 - fd - r * (fd + 4)
      ground(x0, x0 + fw, z0, z0 + fd, M('#5e4029', { roughness: 1 }), 0.035)
      if (!seed) return
      const k = Math.max(0, Math.min(1, grow / 100))
      const col = new Color(SEED_COLOR[seed] ?? '#e3b84e')
      const tint = `#${GREEN.clone().lerp(col, k).getHexString()}`
      const tall = seed === 'corn' || seed === 'sunflower' ? 2.4 : seed === 'wheat' ? 1.1 : 0.45
      const h = 0.15 + tall * (0.25 + 0.75 * k)
      const rows = Math.floor(fw / 2.2)
      for (let j = 0; j < rows; j++) block(g, 1.1, h, fd - 2, M(seed === 'carrot' || seed === 'pumpkin' ? '#5f9a3a' : tint, { roughness: 0.9 }), x0 + 1.4 + j * 2.2, 0, z0 + fd / 2)
      if (k > 0.6 && (seed === 'pumpkin' || seed === 'sunflower')) {
        for (let j = 0; j < rows; j += 2) for (let q = 0; q < 5; q++) {
          if (seed === 'pumpkin') pumpkin(g, x0 + 1.4 + j * 2.2, z0 + 3 + q * 6, 0.35)
          else cyl(g, 0.35, 0.35, 0.12, M('#f7c948'), x0 + 1.4 + j * 2.2, h + 0.1, z0 + 3 + q * 6, 10)
        }
      }
    })
    // Oil: pump jacks and the tank down the east side.
    if (built.has('oilField')) {
      const pumps = Math.max(1, Math.min(4, info.o | 0))
      for (let i = 0; i < pumps; i++) pumpJack(g, 72, -70 + i * 14)
      for (let i = 0; i < pumps; i++) rect(slot, 68, 76, -72 + i * 14, -68 + i * 14, 4)
      const tank = oilTank()
      tank.g.position.set(80, 0, -10)
      tank.g.scale.setScalar(0.7)
      g.add(tank.g)
      rect(slot, 75, 85, -15, -5, 6)
    }
    if (built.has('droneBase')) {
      const d = droneBase()
      d.g.position.set(-24, 0, 58)
      d.g.scale.setScalar(0.7)
      g.add(d.g)
    }
    // Trees by the farmhouse.
    for (const [x, z] of [[-80, 70], [-44, 66], [-82, 46]]) {
      cyl(g, 0.25, 0.4, 3, M('#6b4428', { flatShading: true }), x, 1.5, z, 6)
      for (let k = 0; k < 3; k++) box(g, 2.4, 2.2, 2.4, M(['#f08a24', '#e4632a', '#f4b23a'][k], { flatShading: true }), x + (k - 1) * 0.8, 3.6 + k * 0.6, z + (k % 2) * 0.6, k)
    }
  }

  // A plain wooden fence along a polyline (posts + two rails), baked with the slot.
  function fenceLine(g, pts, style = 'wood') {
    const post = M(style === 'low' ? '#8f5428' : '#9a5a2c')
    const rail = M(style === 'low' ? '#b87538' : '#bf7a3e')
    const h = style === 'low' ? 0.8 : 1.25
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.max(1, Math.round(len / 2.6))
      for (let k = 0; k <= n; k++) block(g, 0.22, h, 0.22, post, ax + ((bx - ax) * k) / n, 0, az + ((bz - az) * k) / n)
      const yaw = Math.atan2(-(bz - az), bx - ax)
      for (const y of style === 'low' ? [0.55] : [0.48, 0.98]) box(g, len, 0.18, 0.1, rail, (ax + bx) / 2, y, (az + bz) / 2, yaw)
    }
  }

  // A static pump jack silhouette.
  function pumpJack(g, x, z) {
    const steel = M('#3a3d42', { metalness: 0.4, roughness: 0.5 })
    const yellow = M('#f2c230', { roughness: 0.5 })
    block(g, 2, 0.4, 7, M('#9a958c'), x, 0, z)
    tube(g, [x - 0.8, 0.4, z - 0.8], [x, 3.6, z], 0.12, steel)
    tube(g, [x + 0.8, 0.4, z - 0.8], [x, 3.6, z], 0.12, steel)
    box(g, 0.5, 0.5, 6.5, yellow, x, 3.9, z + 0.4)
    box(g, 0.6, 1.6, 0.6, yellow, x, 3.4, z + 3.8)
    block(g, 1.4, 1.0, 1.4, steel, x, 0.4, z - 2.6)
    tube(g, [x, 0.2, z + 3.8], [x, 2.6, z + 3.8], 0.05, M('#d9dde1', { metalness: 0.8 }))
  }

  // --- Mapping other players' poses (remotePlayers.js draws them) ----------------------------------------------
  const homeBox = { minX: FARM.walkWest.minX, maxX: FARM.walk.maxX, minZ: FARM.walk.minZ, maxZ: FARM.walk.maxZ }
  const rects = [null, slotRect(1), slotRect(2), slotRect(3)]
  const inR = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ
  // Which region of its sender's frame a point is in: 0 = home, 1-3 = a slot, -1 = the town.
  function regionOf(x, z) {
    for (let k = 1; k <= 3; k++) if (inR(rects[k], x, z)) return k
    return x < FARM.hub.minX ? 0 : -1
  }
  // Region -> its own frame (u across 0..1 from its far side to its gate, v across); home faces east.
  function toFrame(r, x, z) {
    if (r === 0) return [(x - homeBox.minX) / (homeBox.maxX - homeBox.minX), (z - homeBox.minZ) / (homeBox.maxZ - homeBox.minZ)]
    const s = FARM.farmSlots[r]
    const c = Math.cos(s.ry)
    const n = Math.sin(s.ry)
    const dx = x - s.x
    const dz = z - s.z
    const lx = dx * c - dz * n
    const lz = dx * n + dz * c
    return [(lz + HD) / SD, (HW - lx) / SW]
  }
  function fromFrame(r, u, v) {
    if (r === 0) return [homeBox.minX + u * (homeBox.maxX - homeBox.minX), homeBox.minZ + v * (homeBox.maxZ - homeBox.minZ)]
    return toWorld(FARM.farmSlots[r], HW - v * SW, u * SD - HD)
  }
  const frameYaw = (r) => (r === 0 ? Math.PI / 2 : FARM.farmSlots[r].ry)
  const out = { x: 0, z: 0, yaw: 0 }
  function mapPose(p, mySlot) {
    const r = regionOf(p.x, p.z)
    out.yaw = p.yaw
    if (r < 0 || p.slot < 0) {
      out.x = p.x
      out.z = p.z
      return out
    }
    const N = GAME.net.slots
    const globalSlot = (p.slot + r) % N
    const mine = (globalSlot - mySlot + N) % N
    const [u, v] = toFrame(r, p.x, p.z)
    const [x, z] = fromFrame(mine, Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)))
    out.x = x
    out.z = z
    out.yaw = p.yaw + frameYaw(mine) - frameYaw(r)
    return out
  }

  let farmCheck = 0
  return {
    slots,
    // (roster entry, mySlot) -> { x, z, yaw } in this client's world (for remote avatars). The
    // result is one shared object, overwritten by the next call: copy what you need.
    mapPose,
    update(dt) {
      // Slots: rebuild the ones whose holder or farm changed (checked a few times a second).
      farmCheck -= dt
      if (farmCheck <= 0) {
        farmCheck = 0.5
        const mySlot = net.mySlot()
        const others = net.roster()
        const N = GAME.net.slots
        for (const slot of slots) {
          const globalSlot = (mySlot + slot.k) % N
          const p = others.find((o) => o.slot === globalSlot)
          const key = p ? `${p.name}|${p.farm}` : 'bare'
          if (key === slot.key) continue
          slot.key = key
          let info = null
          if (p) {
            try {
              info = p.farm ? JSON.parse(p.farm) : { b: [], p: [], s: 0 }
            } catch {
              info = { b: [], p: [], s: 0 }
            }
          }
          build(slot, info, p?.name || 'Farmer')
        }
      }
    },
  }
}

