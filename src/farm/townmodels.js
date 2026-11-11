import { Color, ConeGeometry, Group, IcosahedronGeometry, Mesh } from 'three'
import { E, M, block, box, cyl, gableRoof, prism, signCanvas, signMaterial, signPanel } from './kit.js'
import { lathe, rbox, sph, tube } from './detail.js'
import { awning, barrel, crate, flowerBox, pumpkin, sack } from './props.js'

// The rural town's buildings (farm/town.js places them): the big Farmers' Market hall, the shop
// fronts along the road, the vehicle dealer's showroom with a walk-in lobby (front desk, display
// podium, waiting area), and the Town Park's pieces. Every model's front faces +Z with its origin
// on the ground at the middle of its front line; low buildings only (one or two storeys).

const AUTUMN = ['#f08a24', '#e4632a', '#d9442b', '#f4b23a', '#f7c948', '#c8532a']

// A canvas sign `w` x `h` m facing +Z at (x, y, z).
export function sign(g, w, h, opts, x, y, z, ry = 0) {
  const px = 1024
  const c = signCanvas(px, Math.max(64, Math.round((px * h) / w)), opts)
  return signPanel(g, w, h, signMaterial(c), x, y, z, ry)
}
const title = (text, size, color = '#f5efd6', stroke = '#2a1a10') => ({ text, size, color, stroke, strokeWidth: Math.round(size / 9) })

// --- The Farmers' Market -------------------------------------------------------------------------------
// A long brick hall (50 x 28 m) under a green standing-seam roof with a glazed ridge lantern. Its
// front is an arcade of brick piers: a produce stall in every bay (eggs, dairy, veg, fruit, bread,
// honey, cheese, flowers) under a striped awning, and in the middle the gabled entrance portico
// with the big FARMERS' MARKET sign and a clock. A loading dock with roll-up doors on its +X side.
export function bigMarket() {
  const g = new Group()
  const W = 50
  const D = 28
  const H = 6.5
  const brick = M('#b8573a', { roughness: 0.85 })
  const darkBrick = M('#8e3f2a', { roughness: 0.9 })
  const cream = M('#f5efd6', { roughness: 0.6 })
  const stone = M('#a39d92', { roughness: 0.95 })
  const dark = M('#2a1c14')
  const roofMat = M('#4e7a5c', { roughness: 0.5, metalness: 0.25 })
  // Plinth, the hall, and the arcade floor in front of it.
  block(g, W + 0.8, 0.4, D + 0.8, stone, 0, 0, -D / 2)
  block(g, W, H, D - 3, brick, 0, 0.4, -(3 + (D - 3) / 2))
  block(g, W - 1, 0.04, 3, M('#cdbfa6', { roughness: 0.7 }), 0, 0.4, -1.5)
  // Brick bands and a cream cornice.
  block(g, W + 0.2, 0.3, D - 2.8, darkBrick, 0, 2.2, -(3 + (D - 3) / 2))
  block(g, W + 0.6, 0.5, D + 0.6, cream, 0, H + 0.4, -D / 2)
  // Arcade: 11 piers carrying a lintel, soffit over the walkway.
  const bays = 10
  const bay = W / bays
  for (let i = 0; i <= bays; i++) {
    const x = -W / 2 + i * bay
    block(g, 0.9, H - 0.6, 0.9, brick, x, 0.4, -0.45)
    block(g, 1.15, 0.3, 1.15, cream, x, H - 0.5, -0.45)
    block(g, 1.15, 0.35, 1.15, stone, x, 0.4, -0.45)
    // A lamp on every other pier.
    if (i % 2 === 0) {
      box(g, 0.3, 0.45, 0.3, M('#25262b', { roughness: 0.4, metalness: 0.5 }), x, 4.2, 0.15)
      box(g, 0.2, 0.3, 0.2, E('#ffe2a0', 1.6), x, 4.15, 0.16, 0, false)
    }
  }
  block(g, W + 0.4, 0.9, 1.0, cream, 0, H - 0.2, -0.45)
  block(g, W, 0.2, 3, M('#e1d6bc'), 0, H + 0.1, -1.6)
  // The hall's front wall behind the arcade: an arched opening in every bay.
  const opening = M('#20160f', { roughness: 1 })
  for (let i = 0; i < bays; i++) {
    const x = -W / 2 + (i + 0.5) * bay
    block(g, 3.4, 3.4, 0.08, opening, x, 0.42, -2.98)
    const arch = cyl(g, 1.7, 1.7, 0.08, opening, x, 3.82, -2.98, 16, false)
    arch.rotation.x = Math.PI / 2
    block(g, 3.9, 0.22, 0.2, cream, x, 3.82 + 1.75, -2.92)
  }
  // Roof: gable along X, gable ends in brick with a round vent, a glazed lantern on the ridge.
  const eave = H + 0.9
  const rise = gableRoof(g, W, D, eave, 20, roofMat, { overhang: 0.9, thick: 0.25, axis: 'x', cx: 0, cz: -D / 2, trim: cream })
  for (const s of [-1, 1]) {
    prism(g, D, rise, 0.4, brick, (s * W) / 2, eave, -D / 2, Math.PI / 2)
    const vent = cyl(g, 1, 1, 0.12, cream, (s * (W / 2 + 0.22)), eave + rise * 0.4, -D / 2, 20)
    vent.rotation.z = Math.PI / 2
  }
  const lanternW = W * 0.6
  block(g, lanternW, 1.5, 3.2, cream, 0, eave + rise - 0.9, -D / 2)
  block(g, lanternW - 0.4, 0.9, 3.24, E('#fff1c8', 0.25, { roughness: 0.2 }), 0, eave + rise - 0.6, -D / 2)
  for (let i = 0; i <= 12; i++) block(g, 0.12, 0.95, 3.3, cream, -lanternW / 2 + 0.2 + (i * (lanternW - 0.4)) / 12, eave + rise - 0.62, -D / 2)
  gableRoof(g, lanternW, 3.2, eave + rise + 0.6, 24, roofMat, { overhang: 0.4, thick: 0.18, axis: 'x', cx: 0, cz: -D / 2 })
  // Tall windows down the sides.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const z = -6 - k * 4.4
      block(g, 0.1, 2.6, 1.6, E('#ffe6b0', 0.18, { roughness: 0.2 }), s * (W / 2 + 0.02), 2.6, z)
      block(g, 0.16, 0.2, 2.0, cream, s * (W / 2 + 0.05), 2.45, z)
      block(g, 0.16, 0.2, 2.0, cream, s * (W / 2 + 0.05), 5.3, z)
    }
  }

  // Produce stalls: a counter in every bay but the two by the entrance, a striped awning outside.
  const stalls = [
    { name: 'EGGS', a: '#2f8a57', goods: 'eggs' },
    { name: 'DAIRY', a: '#2f6fd0', goods: 'milk' },
    { name: 'VEG', a: '#e2763a', goods: 'veg' },
    { name: 'FRUIT', a: '#d6322c', goods: 'fruit' },
    null,
    null,
    { name: 'BAKERY', a: '#a8693a', goods: 'bread' },
    { name: 'HONEY', a: '#f2b01e', goods: 'honey' },
    { name: 'CHEESE', a: '#e8b830', goods: 'cheese' },
    { name: 'FLOWERS', a: '#d64a8a', goods: 'flowers' },
  ]
  stalls.forEach((st, i) => {
    if (!st) return
    const x = -W / 2 + (i + 0.5) * bay
    stall(g, x, st)
    const aw = awning(bay - 0.9, 1.7, H - 0.9, H - 1.7, { a: st.a, b: '#fbf6ee' })
    aw.position.set(x, 0, 0.95)
    g.add(aw)
  })

  // The entrance: wide open doors under a gabled portico on two columns.
  const PW = 14
  block(g, 8, 4.4, 0.1, opening, 0, 0.42, -2.9)
  for (const s of [-1, 1]) {
    const door = block(g, 1.9, 4.2, 0.12, M('#3d5c46', { roughness: 0.6 }), s * 4.9, 0.42, -2.4)
    door.rotation.y = s * 1.2
  }
  block(g, PW + 0.4, 0.9, 5, cream, 0, H, 1.0)
  for (const s of [-1, 1]) {
    lathe(g, [[0, 0], [0.55, 0], [0.55, 0.3], [0.42, 0.4], [0.36, H - 0.6], [0.5, H - 0.4], [0.55, H - 0.4], [0.55, H - 0.0], [0, H - 0.0]], cream, s * (PW / 2 - 0.6), 0.4, 3.0, 16)
  }
  const pr = gableRoof(g, PW, 5, H + 0.9, 30, roofMat, { overhang: 0.5, thick: 0.22, axis: 'z', cx: 0, cz: 1.0, trim: cream })
  prism(g, PW, pr, 0.3, cream, 0, H + 0.9, 3.4)
  // Clock in the pediment.
  const ring = cyl(g, 1.15, 1.15, 0.2, M('#2a2c30', { metalness: 0.5, roughness: 0.4 }), 0, H + 0.9 + pr * 0.42, 3.5, 28)
  ring.rotation.x = Math.PI / 2
  const face = cyl(g, 1.0, 1.0, 0.04, M('#fbf6ee', { roughness: 0.4 }), 0, H + 0.9 + pr * 0.42, 3.62, 28)
  face.rotation.x = Math.PI / 2
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    box(g, 0.06, 0.18, 0.03, M('#2a2c30'), Math.sin(a) * 0.82, H + 0.9 + pr * 0.42 + Math.cos(a) * 0.82, 3.66, 0, false).rotation.z = -a
  }
  const hands = new Group()
  hands.position.set(0, H + 0.9 + pr * 0.42, 3.68)
  box(hands, 0.08, 0.55, 0.03, M('#2a2c30'), 0, 0.26, 0, 0, false)
  const minute = box(hands, 0.05, 0.8, 0.03, M('#2a2c30'), 0, 0, 0.01, 0, false)
  minute.geometry = minute.geometry.clone()
  minute.geometry.translate(0, 0.38, 0)
  minute.rotation.z = -2.1
  g.add(hands)
  // The big sign on the portico's beam and a smaller one along the lintel.
  sign(g, PW - 0.6, 1.6, { bg: '#2f6b45', border: '#f5efd6', borderWidth: 12, radius: 16, lines: [title("FARMERS' MARKET", 128, '#f5efd6', '#173f28')] }, 0, H + 0.45, 3.52)
  sign(g, 22, 0.75, { bg: '#f5efd6', radius: 8, lines: [{ text: 'WE BUY EGGS · MILK · CROPS · HONEY · MORE', size: 52, color: '#2f6b45' }] }, -13.5 - 1.6, H - 0.15, 0.06)
  // Loading dock on the +X side: a raised concrete platform, roll-up doors, bumpers, pallets.
  const conc = M('#bdbab3', { roughness: 0.9 })
  block(g, 4, 1.2, 18, conc, W / 2 + 2, 0, -15)
  for (const z of [-9, -15, -21]) {
    block(g, 0.1, 3.4, 3.6, M('#c8ccd2', { roughness: 0.5, metalness: 0.4 }), W / 2 + 0.06, 1.2, z)
    for (let k = 0; k < 8; k++) block(g, 0.12, 0.05, 3.6, M('#9aa0a6', { metalness: 0.5 }), W / 2 + 0.1, 1.4 + k * 0.4, z)
    block(g, 0.3, 0.4, 0.5, M('#1d1d1f'), W / 2 + 4.1, 0.6, z - 1.2)
    block(g, 0.3, 0.4, 0.5, M('#1d1d1f'), W / 2 + 4.1, 0.6, z + 1.2)
    box(g, 4, 0.12, 0.5, M('#f2c230'), W / 2 + 2, 1.26, z + 2.2, 0, false)
  }
  crate(g, W / 2 + 2.4, 1.2, -12, 1, 0.2)
  crate(g, W / 2 + 2.6, 1.2, -18.2, 1, -0.1)
  // Planters between the stalls.
  for (const x of [-W / 2 - 1.2, W / 2 + 0.9]) cyl(g, 0.6, 0.5, 0.8, M('#b65a32'), x, 0.8, 0.6, 12)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, clock: hands }
}

// One produce stall: a wooden counter with crates of its goods and a hanging name board.
function stall(g, x, { name, a, goods }) {
  const wood = M('#a8723f', { roughness: 0.9 })
  const top = M('#c8955a', { roughness: 0.8 })
  block(g, 3.6, 0.95, 1.0, wood, x, 0.42, -1.5)
  block(g, 3.8, 0.08, 1.1, top, x, 1.37, -1.5)
  block(g, 3.6, 0.2, 0.06, M(a), x, 1.05, -0.98)
  const y = 1.45
  const put = (fn) => {
    for (let k = 0; k < 3; k++) fn(x - 1.15 + k * 1.15, y, -1.5, k)
  }
  const trayMat = M('#c9a06a', { roughness: 0.9 })
  if (goods === 'eggs') {
    put((cx, cy, cz) => {
      block(g, 0.95, 0.08, 0.7, trayMat, cx, cy, cz)
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) sph(g, 0.085, M(i % 3 ? '#fff3dc' : '#e8c9a0', { roughness: 0.5 }), cx - 0.33 + i * 0.22, cy + 0.15, cz - 0.2 + j * 0.2, 1, 1.25, 1, 8)
    })
  } else if (goods === 'milk') {
    put((cx, cy, cz) => {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        cyl(g, 0.11, 0.11, 0.42, M('#ffffff', { roughness: 0.3 }), cx - 0.25 + i * 0.25, cy + 0.21, cz - 0.12 + j * 0.24, 10)
        cyl(g, 0.06, 0.06, 0.08, M('#2f6fd0'), cx - 0.25 + i * 0.25, cy + 0.46, cz - 0.12 + j * 0.24, 8)
      }
    })
  } else if (goods === 'veg') {
    put((cx, cy, cz, k) => {
      block(g, 0.95, 0.3, 0.7, trayMat, cx, cy, cz)
      const col = ['#f08a24', '#4f9a3a', '#f4d03a'][k]
      for (let i = 0; i < 6; i++) sph(g, 0.13, M(col, { roughness: 0.7 }), cx - 0.3 + (i % 3) * 0.3, cy + 0.38, cz - 0.12 + Math.floor(i / 3) * 0.24, 1.4, 0.8, 0.8, 8)
    })
    pumpkin(g, x + 1.9, -0.6, 0.35)
  } else if (goods === 'fruit') {
    put((cx, cy, cz, k) => {
      block(g, 0.95, 0.3, 0.7, trayMat, cx, cy, cz)
      const col = ['#d8322c', '#7cbf3a', '#f4b23a'][k]
      for (let i = 0; i < 8; i++) sph(g, 0.11, M(col, { roughness: 0.45 }), cx - 0.33 + (i % 4) * 0.22, cy + 0.38 + (i > 3 ? 0.05 : 0), cz - 0.1 + Math.floor(i / 4) * 0.22, 1, 1, 1, 8)
    })
  } else if (goods === 'bread') {
    put((cx, cy, cz) => {
      for (let i = 0; i < 3; i++) rbox(g, 0.28, 0.16, 0.5, 0.07, M('#c98a3c', { roughness: 0.8 }), cx - 0.3 + i * 0.3, cy + 0.08, cz, 2)
    })
  } else if (goods === 'honey') {
    put((cx, cy, cz) => {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        cyl(g, 0.1, 0.1, 0.22, M('#f2b01e', { roughness: 0.2, transparent: true, opacity: 0.9 }), cx - 0.25 + i * 0.25, cy + 0.11, cz - 0.12 + j * 0.24, 10)
        cyl(g, 0.105, 0.105, 0.05, M('#f5efd6'), cx - 0.25 + i * 0.25, cy + 0.245, cz - 0.12 + j * 0.24, 10)
      }
    })
  } else if (goods === 'cheese') {
    put((cx, cy, cz) => {
      cyl(g, 0.34, 0.34, 0.22, M('#f6cf4a', { roughness: 0.6 }), cx, cy + 0.11, cz, 16)
      cyl(g, 0.22, 0.22, 0.16, M('#efe6c8', { roughness: 0.6 }), cx, cy + 0.3, cz, 14)
    })
  } else if (goods === 'flowers') {
    put((cx, cy, cz, k) => {
      cyl(g, 0.2, 0.16, 0.32, M('#4a6b8a'), cx, cy + 0.16, cz, 10)
      const col = ['#e84a7a', '#f7c948', '#9a5ae8'][k]
      for (let i = 0; i < 5; i++) sph(g, 0.1, M(col, { roughness: 0.7 }), cx + Math.cos(i * 1.3) * 0.12, cy + 0.48 + (i % 2) * 0.06, cz + Math.sin(i * 1.3) * 0.12, 1, 1, 1, 6)
    })
  }
  // Hanging name board.
  for (const s of [-1, 1]) tube(g, [x + s * 1.1, 4.6, -1.0], [x + s * 1.1, 5.9, -1.0], 0.015, M('#3a3d42'), 4)
  box(g, 2.5, 0.75, 0.08, M(a), x, 4.25, -1.0)
  sign(g, 2.36, 0.62, { bg: '#fbf6ee', radius: 8, lines: [{ text: name, size: 160, color: a }] }, x, 4.25, -0.955)
}

// --- Shop fronts ---------------------------------------------------------------------------------------
// A small-town shop: clapboard body (w x 12 m, one or two storeys), a western false front with its
// painted name board, display windows lit warm, a glazed door, a striped awning and the kind's
// props out front (café tables, bread rack, sacks, a mailbox...).
export function shopFront({ w = 18, name = 'SHOP', sub = '', wall = '#e8d6b0', trim = '#f7f4ec', board = '#2f6b45', a = '#e23a35', b = '#fbf6ee', storeys = 1, kind = 'store' } = {}) {
  const g = new Group()
  const D = 12
  const h = storeys > 1 ? 7.4 : 4.6
  const wallM = M(wall, { roughness: 0.85 })
  const trimM = M(trim, { roughness: 0.6 })
  block(g, w, h, D, wallM, 0, 0, -D / 2)
  // Clapboard lines on the front.
  const lineM = M(`#${new Color(wall).multiplyScalar(0.86).getHexString()}`, { roughness: 1 })
  for (let y = 0.6; y < h; y += 0.5) block(g, w + 0.02, 0.04, 0.04, lineM, 0, y, 0.01, 0, false)
  block(g, w + 0.3, 0.3, D + 0.3, M('#5a5650', { roughness: 0.8 }), 0, h, -D / 2)
  // False front: a parapet above the roof line with a cornice and the name board.
  const ph = 2.4
  block(g, w + 0.4, ph, 0.35, wallM, 0, h, 0)
  block(g, w + 0.9, 0.3, 0.7, trimM, 0, h + ph, 0.05)
  block(g, w + 0.6, 0.22, 0.5, trimM, 0, h - 0.1, 0.05)
  for (const s of [-1, 1]) block(g, 0.4, h + ph, 0.5, trimM, s * (w / 2 + 0.05), 0, 0.05)
  sign(g, Math.min(w - 2, 14), 1.55, { bg: board, border: trim, borderWidth: 10, radius: 10, plank: 2, lines: [title(name, 112), ...(sub ? [{ text: sub, size: 40, color: '#ffe9a0' }] : [])] }, 0, h + ph / 2, 0.2)
  // Storefront: two display windows and a door.
  const glow = E('#ffe2a8', 0.45, { roughness: 0.15 })
  const winW = w / 2 - 2.2
  for (const s of [-1, 1]) {
    const cx = s * (1.1 + winW / 2 + 0.1)
    block(g, winW, 2.3, 0.08, glow, cx, 0.75, 0.04)
    block(g, winW + 0.3, 0.75, 0.2, trimM, cx, 0, 0.08)
    block(g, winW + 0.3, 0.16, 0.2, trimM, cx, 3.05, 0.08)
    for (const e of [-1, 1]) block(g, 0.14, 2.3, 0.16, trimM, cx + e * (winW / 2 + 0.07), 0.75, 0.08)
    block(g, 0.08, 2.3, 0.14, trimM, cx, 0.75, 0.1)
  }
  block(g, 1.5, 2.6, 0.1, M('#5a3a24', { roughness: 0.7 }), 0, 0, 0.05)
  block(g, 1.0, 1.1, 0.12, E('#ffe2a8', 0.35), 0, 1.25, 0.06)
  block(g, 1.9, 0.18, 0.2, trimM, 0, 2.6, 0.08)
  const aw = awning(w - 0.8, 2.1, 3.7, 2.9, { a, b })
  aw.position.set(0, 0, 1.05)
  g.add(aw)
  // Upstairs windows.
  if (storeys > 1) {
    for (let i = 0; i < 3; i++) {
      const x = -w / 3 + (i * w) / 3
      block(g, 1.3, 1.5, 0.08, E('#ffe2a8', 0.2), x, 4.9, 0.04)
      block(g, 1.6, 0.14, 0.2, trimM, x, 4.8, 0.08)
      block(g, 1.6, 0.14, 0.2, trimM, x, 6.42, 0.08)
    }
  }
  // Side windows.
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) block(g, 0.08, 1.3, 1.4, E('#ffe2a8', 0.2), s * (w / 2 + 0.02), 1.3, -4 - k * 4)
  shopProps(g, kind, w)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return g
}

function shopProps(g, kind, w) {
  const z = 3.2
  if (kind === 'store') {
    crate(g, -w / 2 + 2, 0, z, 1, 0.1)
    crate(g, -w / 2 + 2.1, 0.62, z, 0.9, -0.2)
    barrel(g, w / 2 - 1.8, z)
    for (let i = 0; i < 4; i++) sph(g, 0.12, M('#d8322c'), -w / 2 + 1.8 + i * 0.2, 1.3, z, 1, 1, 1, 8)
    flowerBox(g, w / 4, 0.6, 2.2, 0)
  } else if (kind === 'bakery') {
    const rack = M('#a8693a', { roughness: 0.85 })
    block(g, 2.2, 1.0, 0.7, rack, -w / 2 + 2.4, 0, z)
    for (let i = 0; i < 4; i++) rbox(g, 0.42, 0.22, 0.28, 0.08, M('#c98a3c', { roughness: 0.8 }), -w / 2 + 1.6 + i * 0.52, 1.12, z, 2)
    // Chalkboard A-frame.
    const cb = new Group()
    cb.position.set(w / 2 - 2.4, 0, z)
    for (const s of [-1, 1]) {
      const p = block(cb, 0.8, 1.1, 0.05, M('#2b2f2a'), 0, 0, s * 0.18)
      p.rotation.x = s * 0.18
    }
    g.add(cb)
    sign(g, 0.7, 0.8, { bg: '#2b2f2a', lines: [{ text: 'FRESH', size: 120, color: '#f5efd6' }, { text: 'BREAD', size: 120, color: '#ffe9a0' }] }, w / 2 - 2.4, 0.62, z + 0.29)
  } else if (kind === 'hardware') {
    for (let i = 0; i < 3; i++) sack(g, -w / 2 + 1.8 + i * 0.9, z, '#c9a874', '#8a6a3a', i * 0.4)
    barrel(g, -w / 2 + 4.6, z)
    barrel(g, w / 2 - 2.0, z + 0.2)
    const rack = M('#3a3d42', { metalness: 0.4 })
    block(g, 0.1, 1.6, 0.1, rack, w / 2 - 3.6, 0, z)
    block(g, 0.1, 1.6, 0.1, rack, w / 2 - 2.8, 0, z)
    for (let i = 0; i < 3; i++) tube(g, [w / 2 - 3.5 + i * 0.25, 0.1, z + 0.15], [w / 2 - 3.5 + i * 0.25, 1.5, z + 0.15], 0.025, M('#b67a42'), 5)
  } else if (kind === 'cafe') {
    for (const [dx, col] of [[-w / 4, '#2f8a57'], [w / 4, '#e2763a']]) {
      cyl(g, 0.45, 0.45, 0.05, M('#f7f4ec'), dx, 0.76, z, 16)
      cyl(g, 0.05, 0.05, 0.76, M('#3a3d42', { metalness: 0.5 }), dx, 0.38, z, 6)
      cyl(g, 0.04, 0.04, 2.4, M('#d9dde1'), dx, 1.2, z, 6)
      const um = new Mesh(new ConeGeometry(1.4, 0.55, 8), M(col, { roughness: 0.7 }))
      um.position.set(dx, 2.5, z)
      g.add(um)
      for (const s of [-1, 1]) {
        block(g, 0.42, 0.06, 0.42, M('#3a3d42', { metalness: 0.4 }), dx + s * 0.8, 0.45, z)
        block(g, 0.42, 0.5, 0.06, M('#3a3d42', { metalness: 0.4 }), dx + s * 0.8, 0.48, z + (s > 0 ? 0.2 : -0.2))
        for (const e of [-1, 1]) block(g, 0.04, 0.45, 0.04, M('#3a3d42'), dx + s * 0.8 + e * 0.18, 0, z)
      }
    }
  } else if (kind === 'post') {
    // A blue mailbox and the flag.
    rbox(g, 0.6, 0.8, 0.5, 0.15, M('#2f4fa0', { roughness: 0.5 }), w / 2 - 2, 0.85, z, 3)
    block(g, 0.12, 0.45, 0.12, M('#2a2c30'), w / 2 - 2, 0, z)
    cyl(g, 0.06, 0.08, 8, M('#d9dde1', { metalness: 0.6 }), -w / 2 + 1.5, 4, z + 0.6, 8)
    block(g, 0.04, 1.0, 1.6, M('#d6322c'), -w / 2 + 1.5, 6.8, z + 1.45)
    flowerBox(g, 0, 0.6, 2.6, 0)
  } else if (kind === 'feed') {
    for (let i = 0; i < 5; i++) sack(g, -w / 2 + 1.6 + (i % 3) * 0.9, z + Math.floor(i / 3) * 0.8, '#e2d3a8', '#3f8a4a', i)
    const hay = M('#e3c46a', { roughness: 1 })
    block(g, 1.4, 0.7, 0.9, hay, w / 2 - 2, 0, z)
    block(g, 1.4, 0.7, 0.9, hay, w / 2 - 2, 0.7, z, 0.15)
  } else if (kind === 'diner') {
    for (const dx of [-w / 4, w / 4]) {
      block(g, 1.4, 0.06, 0.8, M('#d6322c'), dx, 0.74, z)
      block(g, 0.1, 0.74, 0.1, M('#d9dde1', { metalness: 0.6 }), dx, 0, z)
      for (const s of [-1, 1]) cyl(g, 0.22, 0.22, 0.1, M('#2f6fd0'), dx + s * 0.9, 0.5, z, 12)
    }
  }
}

// --- The vehicle dealer's showroom ---------------------------------------------------------------------
// A 40 x 22 m glass-fronted showroom under a flat roof with a blue fascia and its sign. The middle
// of the glass front is a pair of sliding doors (returned: town.js opens them as the player comes
// near). Inside, a polished floor with a lobby: the curved FRONT DESK at the back (E there opens
// the dealer's catalogue), a turning display podium on the -X side, a waiting area with armchairs
// and plants, vehicle posters, ceiling light panels. A service bay with roll-up doors on +X.
export const SHOWROOM = { W: 40, D: 22, H: 6, door: 4, desk: { x: 0, z: -11.5 }, podium: { x: -11, z: -12 }, display: { x: 11.5, z: -12 } }
export function showroom() {
  const { W, D, H } = SHOWROOM
  const g = new Group()
  const wall = M('#eef0f2', { roughness: 0.7 })
  const blue = M('#2f6fd0', { roughness: 0.45, metalness: 0.2 })
  const steel = M('#3a3d42', { roughness: 0.35, metalness: 0.6 })
  const glassM = M('#9fd8ff', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28 })
  // Floor (polished tiles), walls, roof.
  block(g, W, 0.12, D, M('#e9e6df', { roughness: 0.18, metalness: 0.08 }), 0, 0, -D / 2)
  for (let i = 1; i < 10; i++) box(g, 0.03, 0.005, D, M('#cfcac0'), -W / 2 + i * 4, 0.123, -D / 2, 0, false)
  for (let i = 1; i < 6; i++) box(g, W, 0.005, 0.03, M('#cfcac0'), 0, 0.123, -i * 3.7, 0, false)
  block(g, W, H, 0.5, wall, 0, 0, -D + 0.25)
  for (const s of [-1, 1]) block(g, 0.5, H, D, wall, s * (W / 2 - 0.25), 0, -D / 2)
  block(g, W + 1, 0.6, D + 1, M('#d9dde1', { roughness: 0.6 }), 0, H, -D / 2)
  block(g, W + 1.2, 1.3, 0.35, blue, 0, H - 0.3, 0.55)
  for (const s of [-1, 1]) block(g, 0.35, 1.3, D + 1.2, blue, s * (W / 2 + 0.6), H - 0.3, -D / 2)
  box(g, W - 1, 0.04, D - 1, M('#f4f4f2', { roughness: 0.9 }), 0, H - 0.02, -D / 2, 0, false) // ceiling
  // Ceiling light panels.
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) box(g, 4, 0.06, 0.8, E('#fffaf0', 1.4), -15 + i * 10, H - 0.06, -6 - k * 9, 0, false)
  // Glass front with mullions, a door gap in the middle, a transom over it.
  const dw = SHOWROOM.door
  for (const s of [-1, 1]) {
    const x0 = dw / 2
    const x1 = W / 2 - 0.5
    const cx = s * (x0 + x1) / 2
    block(g, x1 - x0, H - 0.25, 0.08, glassM, cx, 0.12, -0.1)
    const n = 5
    for (let i = 0; i <= n; i++) block(g, 0.14, H - 0.12, 0.18, steel, s * (x0 + ((x1 - x0) * i) / n), 0.12, -0.1)
    block(g, x1 - x0, 0.12, 0.2, steel, cx, 0.12, -0.1)
  }
  block(g, dw, H - 3.3, 0.08, glassM, 0, 3.3, -0.1)
  block(g, dw + 0.2, 0.18, 0.22, steel, 0, 3.22, -0.1)
  // Sliding doors (moving parts: kept out of the bake by town.js).
  const doors = [-1, 1].map((s) => {
    const d = new Group()
    d.position.set((s * dw) / 4, 0.12, 0.02)
    block(d, dw / 2, 3.05, 0.05, glassM, 0, 0, 0)
    for (const e of [-1, 1]) block(d, 0.08, 3.05, 0.09, steel, (e * dw) / 4, 0, 0)
    block(d, dw / 2, 0.1, 0.09, steel, 0, 2.97, 0)
    block(d, 0.05, 0.9, 0.12, M('#d9dde1', { metalness: 0.7, roughness: 0.2 }), (-s * dw) / 4 + s * 0.25, 1.0, 0.08)
    d.userData.home = d.position.x
    d.userData.dir = s
    return d
  })
  // Entrance canopy and mat.
  block(g, 8, 0.3, 3.2, blue, 0, 3.7, 1.5)
  for (const s of [-1, 1]) tube(g, [s * 3.6, 3.7, 3.0], [s * 1.5, 6.0, 0.3], 0.05, steel, 6)
  block(g, 3.6, 0.02, 2.2, M('#2a3a5a', { roughness: 1 }), 0, 0.12, -1.4)
  // The big sign on the fascia and a logo on the back wall.
  sign(g, 16, 1.15, { bg: '#2f6fd0', lines: [title('VEHICLE DEALER', 120, '#ffffff', '#13305e')] }, 0, H + 0.35, 0.74)
  sign(g, 9, 1.4, { bg: '#2f6fd0', border: '#ffffff', borderWidth: 10, radius: 14, lines: [title('SALES & SERVICE', 110, '#ffffff', '#13305e'), { text: 'tractors · trucks · combines', size: 44, color: '#ffe9a0' }] }, 0, 4.1, -D + 0.52)
  // Vehicle posters on the back wall.
  const posters = [
    ['TRACTORS', '#3f9a3a'],
    ['TRUCKS', '#c8302a'],
    ['COMBINES', '#e8b830'],
    ['BIKES', '#2f6fd0'],
  ]
  posters.forEach(([t, c], i) => {
    const x = [-15, -8.5, 8.5, 15][i]
    block(g, 3.2, 2.2, 0.08, steel, x, 2.2, -D + 0.52)
    sign(g, 3.0, 2.0, { bg: c, border: '#ffffff', borderWidth: 12, radius: 6, lines: [title(t, 150, '#ffffff', '#1d1d1f'), { text: 'NEW & USED', size: 90, color: '#ffe9a0' }] }, x, 3.3, -D + 0.58)
  })

  // The front desk: a curved counter (three rounded segments), a raised top, a SALES front panel.
  const { x: kx, z: kz } = SHOWROOM.desk
  const deskM = M('#f7f4ec', { roughness: 0.4 })
  const topM = M('#2a2c30', { roughness: 0.25, metalness: 0.3 })
  for (const [dx, dz, a] of [[0, 0, 0], [-2.7, -0.55, -0.42], [2.7, -0.55, 0.42]]) {
    const seg = rbox(g, 2.8, 1.1, 0.8, 0.12, deskM, kx + dx, 0.67, kz + dz, 2)
    seg.rotation.y = a
    const t = rbox(g, 2.95, 0.08, 1.0, 0.04, topM, kx + dx, 1.26, kz + dz - 0.05, 2)
    t.rotation.y = a
  }
  block(g, 2.6, 0.3, 0.05, blue, kx, 0.75, kz + 0.42)
  sign(g, 2.0, 0.42, { bg: '#2f6fd0', radius: 6, lines: [{ text: 'FRONT DESK', size: 150, color: '#ffffff' }] }, kx, 0.9, kz + 0.43)
  // Computer, chair, a lamp and brochures on the desk.
  block(g, 0.7, 0.45, 0.05, M('#1d1d1f'), kx - 0.6, 1.42, kz - 0.25)
  block(g, 0.62, 0.38, 0.02, E('#7fc4ff', 0.9), kx - 0.6, 1.45, kz - 0.22, 0, false)
  block(g, 0.1, 0.12, 0.1, M('#1d1d1f'), kx - 0.6, 1.3, kz - 0.27)
  block(g, 0.5, 0.03, 0.18, M('#3a3d42'), kx - 0.6, 1.3, kz - 0.05)
  for (let i = 0; i < 3; i++) block(g, 0.22, 0.02 + i * 0.01, 0.3, M(['#d6322c', '#3f9a3a', '#f2c230'][i]), kx + 0.6 + i * 0.25, 1.3, kz + 0.05)
  cyl(g, 0.22, 0.25, 0.5, M('#2a2c30'), kx + 0.4, 0.25, kz - 1.2, 10)
  block(g, 0.6, 0.12, 0.6, M('#2a2c30'), kx + 0.4, 0.55, kz - 1.2)
  block(g, 0.6, 0.7, 0.1, M('#2a2c30'), kx + 0.4, 0.65, kz - 1.5)
  // Display podium (turns: town.js spins it).
  const podium = new Group()
  podium.position.set(SHOWROOM.podium.x, 0.12, SHOWROOM.podium.z)
  cyl(podium, 4.2, 4.4, 0.4, M('#2a2c30', { metalness: 0.4, roughness: 0.25 }), 0, 0.2, 0, 40)
  cyl(podium, 4.25, 4.25, 0.05, E('#7fc4ff', 1.2), 0, 0.42, 0, 40)
  g.add(podium)
  // Waiting area: armchairs round a low table, plants, a coffee machine, a brochure rack.
  const sofa = M('#5a6b8a', { roughness: 0.8 })
  const wx = -13
  const wz = -3.6
  rbox(g, 1.2, 0.35, 0.7, 0.08, M('#f7f4ec', { roughness: 0.3 }), wx, 0.45, wz, 2)
  for (const [dx, dz, a] of [[-1.5, 0, Math.PI / 2], [1.5, 0, -Math.PI / 2], [0, -1.3, 0]]) {
    const c = new Group()
    c.position.set(wx + dx, 0.12, wz + dz)
    c.rotation.y = a
    rbox(c, 0.95, 0.45, 0.85, 0.12, sofa, 0, 0.32, 0, 2)
    rbox(c, 0.95, 0.7, 0.22, 0.1, sofa, 0, 0.75, -0.34, 2)
    for (const s of [-1, 1]) rbox(c, 0.18, 0.55, 0.85, 0.08, sofa, s * 0.48, 0.45, 0, 2)
    g.add(c)
  }
  for (const [x, z] of [[-W / 2 + 1.4, -1.6], [W / 2 - 1.4, -1.6], [-4.5, -D + 1.4], [4.5, -D + 1.4], [-2.6, -1.2], [2.6, -1.2]]) {
    cyl(g, 0.35, 0.28, 0.6, M('#e8e4da', { roughness: 0.4 }), x, 0.42, z, 12)
    for (let k = 0; k < 4; k++) sph(g, 0.4 - k * 0.05, M(['#3f8a4a', '#4f9a3a'][k % 2], { roughness: 0.8 }), x + Math.cos(k * 2) * 0.15, 1.0 + k * 0.28, z + Math.sin(k * 2) * 0.15, 1, 1, 1, 7)
  }
  block(g, 0.8, 1.7, 0.6, M('#2a2c30', { metalness: 0.4 }), W / 2 - 1.2, 0.12, -D + 1.2)
  block(g, 0.5, 0.3, 0.05, E('#ffcf7a', 0.8), W / 2 - 1.2, 1.3, -D + 1.52, 0, false)
  block(g, 0.9, 1.5, 0.3, steel, 3.4, 0.12, -1.8)
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) block(g, 0.25, 0.35, 0.04, M(['#d6322c', '#3f9a3a', '#2f6fd0'][i]), 3.1 + i * 0.3, 0.6 + k * 0.5, -1.62)
  // Service bay on the +X side: a lower block with two roll-up doors facing +Z.
  const bayW = 12
  block(g, bayW, 5, 16, M('#d9dde1', { roughness: 0.8 }), W / 2 + bayW / 2, 0, -D + 8)
  block(g, bayW + 0.4, 0.5, 16.4, blue, W / 2 + bayW / 2, 5, -D + 8)
  for (const k of [0, 1]) {
    const x = W / 2 + 3 + k * 6
    block(g, 4.4, 3.8, 0.1, M('#c8ccd2', { roughness: 0.5, metalness: 0.4 }), x, 0, -D + 16.02)
    for (let i = 0; i < 9; i++) block(g, 4.4, 0.04, 0.14, M('#9aa0a6', { metalness: 0.5 }), x, 0.3 + i * 0.4, -D + 16.05)
  }
  sign(g, 6, 0.9, { bg: '#2f6fd0', radius: 8, lines: [title('SERVICE', 120, '#ffffff', '#13305e')] }, W / 2 + bayW / 2, 4.4, -D + 16.1)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, doors, podium }
}

// A price tag on a post (stands in front of each vehicle on the lot), its face turned by ry.
export function priceTag(g, x, z, text, sub, color = '#d6322c', ry = 0) {
  const t = new Group()
  t.position.set(x, 0, z)
  t.rotation.y = ry
  block(t, 0.08, 1.1, 0.08, M('#3a3d42', { metalness: 0.5 }), 0, 0, 0)
  box(t, 1.5, 0.85, 0.05, M('#ffffff'), 0, 1.4, 0)
  sign(t, 1.44, 0.79, { bg: '#ffffff', border: color, borderWidth: 14, radius: 10, lines: [{ text, size: 190, color }, { text: sub, size: 120, color: '#2a2c30' }] }, 0, 1.4, 0.03)
  g.add(t)
}

// A pylon sign by the road.
export function pylon(g, x, z, lines, color = '#2f6fd0') {
  for (const s of [-1, 1]) block(g, 0.35, 7.4, 0.35, M('#3a3d42', { metalness: 0.5 }), x + s * 1.6, 0, z)
  block(g, 4.2, 2.6, 0.5, M(color), x, 5.0, z)
  sign(g, 4.0, 2.4, { bg: color, border: '#ffffff', borderWidth: 12, radius: 12, lines }, x, 6.3, z + 0.26)
  sign(g, 4.0, 2.4, { bg: color, border: '#ffffff', borderWidth: 12, radius: 12, lines }, x, 6.3, z - 0.26, Math.PI)
}

// --- Town Park pieces ----------------------------------------------------------------------------------
// Tiered stone fountain; `spray` is its water jet (scaled by town.js).
export function fountain() {
  const g = new Group()
  const stone = M('#d8d2c4', { roughness: 0.8 })
  const water = M('#6fb8d8', { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.8 })
  lathe(g, [[0, 0], [4.2, 0], [4.2, 0.7], [3.9, 0.75], [3.9, 0.25], [0, 0.25]], stone, 0, 0, 0, 40)
  cyl(g, 3.9, 3.9, 0.06, water, 0, 0.6, 0, 40, false)
  lathe(g, [[0, 0], [0.7, 0], [0.5, 0.4], [0.35, 1.6], [1.8, 1.9], [1.9, 2.15], [1.7, 2.15], [0.3, 1.95], [0.25, 2.6], [0.8, 2.75], [0.85, 2.9], [0, 2.9]], stone, 0, 0.25, 0, 32)
  cyl(g, 1.7, 1.7, 0.05, water, 0, 2.32, 0, 28, false)
  const spray = new Group()
  spray.position.set(0, 3.1, 0)
  const jet = new Mesh(new ConeGeometry(0.22, 1.6, 10, 1, true), M('#bfe6f7', { roughness: 0.05, transparent: true, opacity: 0.55 }))
  jet.position.y = 0.6
  jet.rotation.x = Math.PI
  spray.add(jet)
  g.add(spray)
  g.traverse((o) => {
    if (o.isMesh && o !== jet) o.castShadow = true
  })
  return { g, spray }
}

// Octagonal bandstand with a railing and a shingled cone roof.
export function gazebo() {
  const g = new Group()
  const white = M('#f7f4ec', { roughness: 0.6 })
  const r = 4
  cyl(g, r + 0.3, r + 0.4, 0.6, M('#b8a88e', { roughness: 0.9 }), 0, 0.3, 0, 8)
  cyl(g, r + 0.1, r + 0.1, 0.06, M('#a8693a', { roughness: 0.8 }), 0, 0.62, 0, 8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    cyl(g, 0.13, 0.13, 3.4, white, x, 2.3, z, 8)
    // Railing between this post and the next, except the entry (+Z side).
    const b = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8
    const nx = Math.cos(b) * r
    const nz = Math.sin(b) * r
    if (Math.abs(Math.sin((a + b) / 2) - 1) < 0.1) continue
    tube(g, [x, 1.6, z], [nx, 1.6, nz], 0.05, white, 6)
    for (let k = 1; k < 6; k++) tube(g, [x + ((nx - x) * k) / 6, 0.65, z + ((nz - z) * k) / 6], [x + ((nx - x) * k) / 6, 1.6, z + ((nz - z) * k) / 6], 0.03, white, 4)
  }
  const roof = new Mesh(new ConeGeometry(r + 1.0, 2.4, 8), M('#2f6b45', { roughness: 0.6 }))
  roof.position.y = 5.2
  roof.rotation.y = Math.PI / 8
  g.add(roof)
  cyl(g, r + 0.9, r + 0.9, 0.25, white, 0, 4.05, 0, 8).rotation.y = Math.PI / 8
  sph(g, 0.25, M('#f2c230', { metalness: 0.5, roughness: 0.3 }), 0, 6.55, 0, 1, 1, 1, 10)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return g
}

// Park bench (2.4 m, facing +Z).
export function bench(g, x, z, ry = 0) {
  const b = new Group()
  b.position.set(x, 0, z)
  b.rotation.y = ry
  const wood = M('#b67a42', { roughness: 0.85 })
  const iron = M('#2f2f33', { roughness: 0.5, metalness: 0.4 })
  for (let i = 0; i < 3; i++) block(b, 2.4, 0.06, 0.16, wood, 0, 0.45, -0.18 + i * 0.18)
  for (let i = 0; i < 2; i++) box(b, 2.4, 0.14, 0.05, wood, 0, 0.75 + i * 0.2, -0.32)
  for (const s of [-1, 1]) {
    block(b, 0.08, 0.45, 0.55, iron, s * 1.05, 0, 0)
    block(b, 0.08, 0.55, 0.08, iron, s * 1.05, 0.45, -0.3)
  }
  g.add(b)
  return b
}

// A deciduous park tree (trunk + autumn blob crowns), `s` = size.
const blobGeo = new IcosahedronGeometry(1, 0)
export function parkTree(g, x, z, s = 1, rand = Math.random) {
  const h = 2.4 * s
  cyl(g, 0.18 * s, 0.3 * s, h, M('#6b4428', { roughness: 0.9, flatShading: true }), x, h / 2, z, 6)
  const base = AUTUMN[Math.floor(rand() * AUTUMN.length)]
  for (let k = 0; k < 4; k++) {
    const r = (1.3 + rand() * 0.7) * s * (k === 0 ? 1.15 : 0.85)
    const a = (k / 4) * Math.PI * 2 + rand()
    const off = k === 0 ? 0 : 0.9 * s
    const m = new Mesh(blobGeo, M(k ? base : AUTUMN[(AUTUMN.indexOf(base) + 1) % AUTUMN.length], { roughness: 0.8, flatShading: true }))
    m.position.set(x + Math.cos(a) * off, h + r * 0.55 + (k === 0 ? 0.6 * s : rand() * 0.6 * s), z + Math.sin(a) * off)
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3)
    m.scale.set(r, r * 0.85, r)
    m.castShadow = true
    g.add(m)
  }
}

// A raised flower bed (w x d) with a brick edge and rows of blooms.
export function flowerBed(g, x, z, w, d, rand = Math.random) {
  const brick = M('#b8573a', { roughness: 0.9 })
  block(g, w, 0.35, d, brick, x, 0, z)
  block(g, w - 0.3, 0.38, d - 0.3, M('#5e4029', { roughness: 1 }), x, 0, z)
  const cols = ['#e84a7a', '#f7c948', '#9a5ae8', '#f08a24', '#ffffff', '#d6322c']
  for (let i = 0; i < Math.round(w * d * 2); i++) {
    const fx = x - w / 2 + 0.3 + rand() * (w - 0.6)
    const fz = z - d / 2 + 0.3 + rand() * (d - 0.6)
    sph(g, 0.09 + rand() * 0.06, M(cols[Math.floor(rand() * cols.length)], { roughness: 0.7 }), fx, 0.48 + rand() * 0.1, fz, 1, 1, 1, 5)
  }
}

// A low clipped hedge from (x0, z0) to (x1, z1).
export function hedge(g, x0, z0, x1, z1, h = 0.9) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const m = block(g, len, h, 0.9, M('#4a7a3a', { roughness: 0.95 }), (x0 + x1) / 2, 0, (z0 + z1) / 2)
  m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0)
  return m
}

// Swing set, slide and sandbox.
export function playground() {
  const g = new Group()
  const red = M('#d6322c', { roughness: 0.5 })
  const yellow = M('#f2c230', { roughness: 0.5 })
  const blueM = M('#2f6fd0', { roughness: 0.5 })
  block(g, 12, 0.05, 9, M('#d9b98a', { roughness: 1 }), 0, 0, 0)
  // Swings.
  for (const s of [-1, 1]) {
    tube(g, [-2.5, 0, -2 + s * 0.9], [-2.5, 2.6, -2], 0.07, red, 6)
    tube(g, [2.5, 0, -2 + s * 0.9], [2.5, 2.6, -2], 0.07, red, 6)
  }
  tube(g, [-2.6, 2.6, -2], [2.6, 2.6, -2], 0.08, red, 6)
  const swings = []
  for (const x of [-1.1, 1.1]) {
    const sw = new Group()
    sw.position.set(x, 2.6, -2)
    for (const s of [-1, 1]) tube(sw, [s * 0.25, 0, 0], [s * 0.25, -2.0, 0], 0.015, M('#9aa0a6', { metalness: 0.6 }), 4)
    block(sw, 0.6, 0.06, 0.28, M('#2a2c30'), 0, -2.05, 0)
    g.add(sw)
    swings.push(sw)
  }
  // Slide: a ladder, a platform and a chute.
  const px = 3.2
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) tube(g, [px + dx, 0, 1.5 + dz], [px + dx, 1.8, 1.5 + dz], 0.06, yellow, 6)
  block(g, 1.2, 0.1, 1.2, blueM, px + 0.5, 1.8, 2.0)
  for (let k = 0; k < 5; k++) tube(g, [px, 0.35 * k + 0.2, 1.5], [px + 1, 0.35 * k + 0.2, 1.5], 0.03, yellow, 4)
  const chute = box(g, 0.9, 0.08, 3.2, red, px + 0.5, 1.0, 4.0)
  chute.rotation.x = -0.6
  // Sandbox.
  block(g, 3, 0.3, 3, M('#a8693a'), -3, 0, 2.5)
  block(g, 2.7, 0.32, 2.7, M('#ead7a6', { roughness: 1 }), -3, 0, 2.5)
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  return { g, swings }
}

export function picnicTable(g, x, z, ry = 0) {
  const t = new Group()
  t.position.set(x, 0, z)
  t.rotation.y = ry
  const wood = M('#a8723f', { roughness: 0.9 })
  block(t, 2.2, 0.08, 0.9, wood, 0, 0.74, 0)
  for (const s of [-1, 1]) {
    block(t, 2.2, 0.06, 0.3, wood, 0, 0.44, s * 0.75)
    for (const e of [-1, 1]) {
      const leg = block(t, 0.08, 0.8, 0.08, wood, e * 0.85, 0, s * 0.35)
      leg.rotation.x = s * 0.4
    }
  }
  g.add(t)
}
