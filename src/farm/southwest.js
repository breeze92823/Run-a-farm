import { CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { FARM } from '../config.js'
import { mulberry32 } from '../textures.js'
import { E, M, addSurface, bakeInto, block, box, cyl, gableRoof, gated, prism, signCanvas, signMaterial, signPanel, solid, solidCyl, solidRect } from './kit.js'
import { rbox } from './detail.js'
import { fence } from './fence.js'
import { barrel, flowerBox, pallet, pumpkin } from './props.js'
import { paintDirt, paintHay, paintSoil, tex } from './textures.js'

// The south-west corner: the farmer's cottage (cream walls, green roof,
// chimney) by the road, the dirt path down the chicken yard's west side, the
// gravel walk to the road, and the pumpkin weigh-off patch: a round bed of dark
// soil with a straw rim, the giant pumpkin with its weight card, barrels, a
// red wheelbarrow, corn shocks, a hay roll and little pumpkins around it.

function ground(root, r, y, map, tile, type) {
  const w = r.maxX - r.minX
  const d = r.maxZ - r.minZ
  const geo = new PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2)
  const t = map.clone()
  t.repeat.set(w / tile, d / tile)
  t.needsUpdate = true
  const m = new Mesh(geo, new MeshStandardMaterial({ map: t, roughness: 1 }))
  m.position.set((r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2)
  m.receiveShadow = true
  root.add(m)
  addSurface(r, type)
}

function cottage(root) {
  const { x, z } = FARM.farmhouse
  const g = new Group()
  const wall = M('#f6ecd2', { roughness: 0.8 })
  const roof = M('#3fbf4a', { roughness: 0.55 })
  const trim = M('#d98a3a', { roughness: 0.7 })
  const W = 11 // along x
  const D = 7.5
  const H = 3.6
  block(g, W + 0.4, 0.35, D + 0.4, trim, 0, 0, 0) // orange base band
  block(g, W, H, D, wall, 0, 0.35, 0)
  // Gable ends east and west, roof ridge along x.
  const pitch = 33
  const rise = Math.tan((pitch * Math.PI) / 180) * (D / 2)
  prism(g, D, rise, W, wall, 0, H + 0.35, 0, Math.PI / 2)
  gableRoof(g, W, D, H + 0.3, pitch, roof, { overhang: 0.55, thick: 0.28, axis: 'x', trim: M('#33a33e') })
  // Chimney.
  block(g, 0.9, 2.6, 0.9, M('#c9bfae', { roughness: 0.9 }), -2.6, H + 1.2, -0.9)
  block(g, 1.05, 0.2, 1.05, M('#a89d8b'), -2.6, H + 3.8, -0.9)
  // Windows (two-pane with white frames and an orange sill), front and sides.
  const win = (wx, wy, wz, ry) => {
    const f = new Group()
    f.position.set(wx, wy, wz)
    f.rotation.y = ry
    block(f, 1.2, 1.2, 0.06, M('#8fc3e0', { roughness: 0.1, metalness: 0.2 }), 0, 0, 0)
    block(f, 1.36, 0.1, 0.1, M('#ffffff'), 0, 1.2, 0.03)
    block(f, 0.08, 1.2, 0.1, M('#ffffff'), 0, 0, 0.04)
    for (const s of [-0.64, 0.64]) block(f, 0.08, 1.2, 0.1, M('#ffffff'), s, 0, 0.03)
    block(f, 1.5, 0.1, 0.25, trim, 0, -0.08, 0.1)
    g.add(f)
  }
  win(-2.8, 1.4, D / 2 + 0.02, 0)
  win(2.8, 1.4, D / 2 + 0.02, 0)
  win(-W / 2 - 0.02, 1.4, 0, -Math.PI / 2)
  win(W / 2 + 0.02, 1.4, 1.2, Math.PI / 2)
  win(1.5, 1.4, -D / 2 - 0.02, Math.PI)
  // Front door with a little step and porch light.
  block(g, 1.2, 2.3, 0.08, M('#3f8a4a'), 0, 0.35, D / 2 + 0.02)
  block(g, 1.4, 0.12, 0.12, M('#ffffff'), 0, 2.7, D / 2 + 0.05)
  cyl(g, 0.05, 0.05, 0.06, M('#e2b24a', { metalness: 0.6 }), 0.4, 1.5, D / 2 + 0.1, 8).rotation.x = Math.PI / 2
  block(g, 1.8, 0.2, 0.9, M('#c9bfae'), 0, 0, D / 2 + 0.45)
  box(g, 0.2, 0.3, 0.2, E('#ffd27a', 1.8), 0.95, 2.6, D / 2 + 0.12)
  // Flower boxes under the front windows, a bench by the door.
  flowerBox(g, -2.8, D / 2 + 0.45, 1.4, 0, mulberry32(5))
  flowerBox(g, 2.8, D / 2 + 0.45, 1.4, 0, mulberry32(6))
  g.position.set(x, 0, z)
  bakeInto(root, g)
  solidRect(x - W / 2, x + W / 2, z - D / 2, z + D / 2, H + 2)
  // Chimney smoke source (world).
  return { smoke: { x: x - 2.6, y: H + 4.2, z: z - 0.9 } }
}

// The Farm Office (bought, GAME.buildings `office`): a covered porch on the
// cottage's front with a plank deck, a tin lean-to roof on two posts and the
// FARM OFFICE board on its fascia; the farmer's desk (ledger, desk lamp, mug,
// call bell, HIRING card) with a chair and a filing cabinet, a HELP WANTED
// notice board pinned with job flyers, potted plants by the door, a welcome
// mat and a mailbox out by the road. Workers are hired here.
function officePorch(root) {
  const { x, z } = FARM.farmhouse
  const F = 3.75 // the cottage's front wall (local z)
  gated(root, 'office', (gate) => {
    const g = new Group()
    const wood = M('#a8693a', { roughness: 0.85 })
    const woodDark = M('#6e3a18', { roughness: 0.9 })
    const plankA = M('#b98252', { roughness: 0.9 })
    const plankB = M('#a8733f', { roughness: 0.9 })
    const tin = M('#3fae48', { roughness: 0.45, metalness: 0.35 })
    const metal = M('#7d858e', { roughness: 0.4, metalness: 0.6 })
    const brass = M('#d9a53a', { roughness: 0.3, metalness: 0.8 })
    // Deck: planks across, a skirt board and joist ends at the front.
    for (let i = 0; i < 9; i++) block(g, 7.2, 0.1, 0.29, i % 2 ? plankA : plankB, 0, 0.04, F + 0.17 + i * 0.31)
    block(g, 7.3, 0.14, 0.06, woodDark, 0, 0, F + 2.85)
    for (let i = 0; i < 7; i++) block(g, 0.12, 0.1, 0.04, woodDark, -3.3 + i * 1.1, 0.01, F + 2.89)
    // Posts with knee braces, the beam, the sloping tin roof with ribs and a fascia.
    for (const sx of [-1, 1]) {
      block(g, 0.2, 2.7, 0.2, wood, sx * 3.45, 0.14, F + 2.6)
      block(g, 0.32, 0.12, 0.32, woodDark, sx * 3.45, 0.14, F + 2.6)
      const brace = box(g, 0.1, 0.9, 0.1, wood, sx * 3.1, 2.45, F + 2.6)
      brace.rotation.z = sx * 0.75
    }
    block(g, 7.2, 0.24, 0.24, woodDark, 0, 2.72, F + 2.6)
    block(g, 7.2, 0.16, 0.16, woodDark, 0, 3.0, F + 0.08) // ledger board on the wall
    const slope = Math.atan2(0.42, 3.1)
    const roof = new Group()
    roof.position.set(0, 3.08, F + 1.5)
    roof.rotation.x = slope
    box(roof, 7.8, 0.08, 3.2, tin, 0, 0, 0)
    for (let i = 0; i < 16; i++) box(roof, 0.06, 0.06, 3.2, tin, -3.75 + i * 0.5, 0.06, 0)
    box(roof, 7.9, 0.22, 0.06, woodDark, 0, -0.06, 1.62) // fascia
    g.add(roof)
    // Rafters under the roof.
    for (let i = 0; i < 6; i++) {
      const r = box(g, 0.1, 0.14, 3.0, woodDark, -3.1 + i * 1.24, 2.92, F + 1.45)
      r.rotation.x = slope
    }
    // The FARM OFFICE board standing on the fascia, with two gooseneck lamps.
    const board = signCanvas(640, 128, { bg: '#c0662c', plank: 2, border: '#6e3a18', borderWidth: 10, radius: 12, lines: [{ text: 'FARM OFFICE', size: 84, color: '#fff3d6', stroke: '#5a2a10', strokeWidth: 12 }] })
    rbox(g, 4.3, 0.95, 0.12, 0.04, woodDark, 0, 3.32, F + 3.06)
    signPanel(g, 4.15, 0.83, signMaterial(board), 0, 3.32, F + 3.13)
    for (const sx of [-1.3, 1.3]) {
      box(g, 0.05, 0.05, 0.45, metal, sx, 3.95, F + 3.3)
      cyl(g, 0.02, 0.14, 0.12, metal, sx, 3.9, F + 3.52, 10)
      cyl(g, 0.08, 0.08, 0.02, E('#fff2c8', 2.2), sx, 3.84, F + 3.52, 10, false)
    }
    // The desk (east end): top, drawers, legs, and what is on it.
    const desk = new Group()
    desk.position.set(2.3, 0.14, F + 1.55)
    rbox(desk, 1.6, 0.07, 0.8, 0.02, M('#8a5530', { roughness: 0.6 }), 0, 0.76, 0)
    rbox(desk, 0.5, 0.66, 0.74, 0.02, wood, 0.5, 0.39, 0)
    for (let i = 0; i < 3; i++) {
      block(desk, 0.44, 0.18, 0.02, plankA, 0.5, 0.12 + i * 0.21, 0.375)
      block(desk, 0.14, 0.03, 0.03, brass, 0.5, 0.2 + i * 0.21, 0.39)
    }
    for (const lz of [-0.33, 0.33]) block(desk, 0.07, 0.73, 0.07, woodDark, -0.72, 0, lz)
    // Open ledger and a pen.
    const book = new Group()
    book.position.set(-0.25, 0.81, 0.05)
    book.rotation.y = 0.15
    block(book, 0.5, 0.03, 0.34, M('#7a2a1e'), 0, 0, 0)
    for (const s of [-1, 1]) {
      const pg = block(book, 0.23, 0.015, 0.31, M('#f6efdc'), s * 0.12, 0.03, 0)
      pg.rotation.z = -s * 0.06
      for (let l = 0; l < 5; l++) block(book, 0.17, 0.004, 0.006, M('#8aa0c8'), s * 0.12, 0.05, -0.11 + l * 0.055, 0, false)
    }
    const pen = box(book, 0.015, 0.015, 0.2, M('#1f2a44'), 0.12, 0.06, 0.08)
    pen.rotation.y = 0.6
    desk.add(book)
    // Desk lamp: base, two arm segments and a shade with a warm bulb.
    const lampMat = M('#2e5a3a', { metalness: 0.4, roughness: 0.4 })
    cyl(desk, 0.1, 0.12, 0.04, lampMat, 0.55, 0.82, -0.22, 14)
    const arm1 = box(desk, 0.03, 0.4, 0.03, lampMat, 0.55, 1.0, -0.22)
    arm1.rotation.x = -0.25
    const arm2 = box(desk, 0.03, 0.32, 0.03, lampMat, 0.55, 1.2, -0.08)
    arm2.rotation.x = 1.1
    cyl(desk, 0.05, 0.13, 0.14, lampMat, 0.55, 1.2, 0.08, 14)
    cyl(desk, 0.045, 0.045, 0.02, E('#ffe2a0', 2.4), 0.55, 1.13, 0.08, 10, false)
    // Mug, call bell, a paper stack and the HIRING card.
    cyl(desk, 0.05, 0.045, 0.1, M('#e8e4da', { roughness: 0.4 }), -0.62, 0.85, -0.2, 12)
    cyl(desk, 0.042, 0.042, 0.01, M('#5a3418'), -0.62, 0.9, -0.2, 12, false)
    cyl(desk, 0.07, 0.08, 0.015, M('#2a2a2e'), 0.05, 0.805, 0.28, 14)
    const bell = cyl(desk, 0.015, 0.065, 0.06, brass, 0.05, 0.84, 0.28, 14)
    bell.scale.y = 1.2
    cyl(desk, 0.012, 0.012, 0.03, brass, 0.05, 0.89, 0.28, 8)
    for (let i = 0; i < 4; i++) block(desk, 0.3, 0.012, 0.22, M(i % 2 ? '#fdfaf0' : '#f2ead2'), 0.15, 0.8 + i * 0.013, -0.2, i * 0.08)
    const hire = signCanvas(256, 110, { bg: '#fff3d6', border: '#c0662c', borderWidth: 8, radius: 10, lines: [{ text: 'HIRING!', size: 58, color: '#c0302a' }] })
    const card = new Group()
    card.position.set(-0.55, 0.8, 0.3)
    card.rotation.x = -0.3
    box(card, 0.34, 0.15, 0.01, M('#fff3d6'), 0, 0.07, 0)
    signPanel(card, 0.33, 0.14, signMaterial(hire), 0, 0.072, 0.008)
    desk.add(card)
    g.add(desk)
    // The farmer's chair behind the desk.
    const chair = new Group()
    chair.position.set(2.1, 0.14, F + 0.75)
    chair.rotation.y = 0.2
    rbox(chair, 0.5, 0.06, 0.48, 0.02, wood, 0, 0.47, 0)
    rbox(chair, 0.5, 0.5, 0.05, 0.02, wood, 0, 0.75, -0.22)
    for (const cx of [-0.21, 0.21]) for (const cz of [-0.2, 0.2]) block(chair, 0.05, 0.46, 0.05, woodDark, cx, 0, cz)
    g.add(chair)
    // Filing cabinet against the wall.
    const fc = new Group()
    fc.position.set(3.25, 0.14, F + 0.4)
    rbox(fc, 0.55, 1.25, 0.6, 0.03, M('#6f8a7a', { roughness: 0.45, metalness: 0.5 }), 0, 0.625, 0)
    for (let i = 0; i < 3; i++) {
      block(fc, 0.47, 0.34, 0.02, M('#7f9a8a', { roughness: 0.4, metalness: 0.5 }), 0, 0.1 + i * 0.4, 0.3)
      block(fc, 0.16, 0.03, 0.04, metal, 0, 0.36 + i * 0.4, 0.32)
      block(fc, 0.12, 0.06, 0.005, M('#f6efdc'), 0, 0.3 + i * 0.4, 0.315, 0, false)
    }
    g.add(fc)
    // HELP WANTED notice board (west end), facing the walk, pinned with job flyers.
    const nb = new Group()
    nb.position.set(-2.35, 0.14, F + 2.25)
    for (const s of [-0.85, 0.85]) block(nb, 0.1, 2.1, 0.1, woodDark, s, 0, 0)
    rbox(nb, 1.8, 1.15, 0.08, 0.03, woodDark, 0, 1.45, 0)
    box(nb, 1.62, 0.98, 0.04, M('#c8955c', { roughness: 1 }), 0, 1.45, 0.04)
    const hw = signCanvas(512, 96, { bg: '#2f5f3a', border: '#e9c48c', borderWidth: 6, radius: 8, lines: [{ text: 'HELP WANTED', size: 64, color: '#ffe9a8' }] })
    rbox(nb, 1.5, 0.3, 0.06, 0.02, woodDark, 0, 2.2, 0)
    signPanel(nb, 1.44, 0.27, signMaterial(hw), 0, 2.2, 0.035)
    const flyers = ['#fff3d6', '#ffe08a', '#cfe8ff', '#ffd0d0', '#d8f5c8', '#fff3d6']
    flyers.forEach((c, i) => {
      const fx = -0.52 + (i % 3) * 0.52
      const fy = 1.68 - Math.floor(i / 3) * 0.48
      const f = box(nb, 0.34, 0.4, 0.005, M(c, { roughness: 0.9 }), fx, fy, 0.065, 0, false)
      f.rotation.z = ((i * 0.37) % 0.24) - 0.12
      for (let l = 0; l < 4; l++) box(nb, 0.24, 0.025, 0.004, M('#6b5a48'), fx, fy + 0.1 - l * 0.07, 0.07, 0, false)
      cyl(nb, 0.025, 0.025, 0.02, M(['#d6342c', '#2f6fd0', '#3f9a3a'][i % 3]), fx, fy + 0.17, 0.075, 8, false).rotation.x = Math.PI / 2
    })
    g.add(nb)
    // Potted plants by the door and a welcome mat.
    for (const s of [-1, 1]) {
      cyl(g, 0.22, 0.17, 0.38, M('#b8582e', { roughness: 0.8 }), s * 0.98, 0.33, F + 0.35, 14)
      cyl(g, 0.2, 0.2, 0.03, M('#4b3222'), s * 0.98, 0.5, F + 0.35, 14, false)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const leaf = box(g, 0.08, 0.5, 0.03, M(i % 2 ? '#3f8a2c' : '#4f9e36'), s * 0.98 + Math.cos(a) * 0.08, 0.75, F + 0.35 + Math.sin(a) * 0.08, -a)
        leaf.rotation.x = Math.sin(a) * 0.35
        leaf.rotation.z = -Math.cos(a) * 0.35
      }
    }
    block(g, 1.1, 0.02, 0.6, M('#7a3b2a', { roughness: 1 }), 0, 0.15, F + 0.75)
    block(g, 0.9, 0.005, 0.42, M('#c9a24a', { roughness: 1 }), 0, 0.17, F + 0.75, 0, false)
    // Mailbox by the road at the end of the gravel walk, flag up.
    const mb = new Group()
    mb.position.set(3.75, 0, 13.2)
    const blue = M('#2f5f8a', { roughness: 0.4, metalness: 0.4 })
    block(mb, 0.1, 1.05, 0.1, woodDark, 0, 0, 0)
    rbox(mb, 0.32, 0.26, 0.55, 0.03, blue, 0, 1.18, 0)
    const top = cyl(mb, 0.16, 0.16, 0.55, blue, 0, 1.3, 0, 14)
    top.rotation.x = Math.PI / 2
    block(mb, 0.02, 0.3, 0.05, M('#d6342c'), 0.17, 1.2, -0.1)
    block(mb, 0.02, 0.08, 0.14, M('#d6342c'), 0.17, 1.44, -0.05)
    g.add(mb)

    g.position.set(x, 0, z)
    bakeInto(gate, g)
    solidCyl(0.14, 2.9, x - 3.45, z + F + 2.6)
    solidCyl(0.14, 2.9, x + 3.45, z + F + 2.6)
    solid(0.8, 0.45, 0.4, x + 2.3, 0.45, z + F + 1.55)
    solid(0.28, 0.65, 0.3, x + 3.25, 0.65, z + F + 0.4)
    solid(0.9, 1.1, 0.08, x - 2.35, 1.1, z + F + 2.25)
    solidCyl(0.08, 1.4, x + 3.75, z + 13.2)
  }, 4.2)
}

function cornShock(g, x, z, rand) {
  const s = new Group()
  s.position.set(x, 0, z)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const stalk = box(s, 0.08, 2.2, 0.08, M(i % 3 ? '#d9b45a' : '#c49a3e', { roughness: 0.95 }), Math.cos(a) * 0.25, 1.05, Math.sin(a) * 0.25)
    stalk.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18)
    if (i % 4 === 0) {
      const leaf = box(s, 0.5, 0.03, 0.12, M('#c9a24a'), Math.cos(a) * 0.45, 1.3 + rand() * 0.5, Math.sin(a) * 0.45)
      leaf.rotation.set(0, -a, -0.6)
    }
  }
  cyl(s, 0.3, 0.3, 0.12, M('#8a5a2b'), 0, 1.25, 0, 10) // twine band
  g.add(s)
}

function wheelbarrow(g, x, z, ry) {
  const w = new Group()
  w.position.set(x, 0, z)
  w.rotation.y = ry
  const red = M('#d6342c', { roughness: 0.45 })
  block(w, 0.9, 0.08, 1.1, red, 0, 0.45, 0)
  for (const s of [-1, 1]) {
    const side = block(w, 0.06, 0.4, 1.1, red, s * 0.47, 0.48, 0)
    side.rotation.z = s * 0.2
  }
  block(w, 0.9, 0.4, 0.06, red, 0, 0.48, 0.55)
  block(w, 0.9, 0.4, 0.06, red, 0, 0.48, -0.55)
  pumpkin(w, 0, 0.1, 0.28, '#ee7a1f', 0.5)
  pumpkin(w, 0.22, -0.25, 0.2, '#f6b13b', 0.5)
  const wheel = cyl(w, 0.28, 0.28, 0.12, M('#222'), 0, 0.28, 0.85, 14)
  wheel.rotation.z = Math.PI / 2
  for (const s of [-0.35, 0.35]) {
    box(w, 0.06, 0.06, 1.3, M('#7b4a26'), s, 0.6, -0.65).rotation.x = -0.2
    block(w, 0.06, 0.45, 0.06, M('#555'), s, 0, -0.35)
  }
  g.add(w)
}

function weightCard(x, y, z) {
  const c = document.createElement('canvas')
  c.width = 360
  c.height = 130
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 360, 130)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = '600 30px Fredoka, sans-serif'
    ctx.lineWidth = 7
    ctx.strokeStyle = '#1b1b1b'
    ctx.strokeText("Your pumpkin", 180, 32)
    ctx.fillStyle = '#ffffff'
    ctx.fillText("Your pumpkin", 180, 32)
    ctx.font = '700 64px Fredoka, sans-serif'
    ctx.lineWidth = 10
    ctx.strokeStyle = '#6a2a00'
    ctx.strokeText('227 lb', 180, 90)
    ctx.fillStyle = '#ffb03a'
    ctx.fillText('227 lb', 180, 90)
  }
  draw()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  document.fonts?.ready?.then(() => {
    draw()
    t.needsUpdate = true
  })
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(3.2, 1.15, 1)
  s.position.set(x, y, z)
  return s
}

function pumpkinPatch(root, rand) {
  const { x, z, r } = FARM.pumpkinPatch
  const g = new Group()
  // Straw rim and the dark soil bed.
  const rim = cyl(g, r + 0.7, r + 0.8, 0.14, new MeshStandardMaterial({ map: tex(paintHay(128), 4, 1), roughness: 1, color: '#e6c27a' }), x, 0.07, z, 40, false)
  rim.receiveShadow = true
  const bed = cyl(g, r, r, 0.18, new MeshStandardMaterial({ map: tex(paintSoil(256), 3, 3), roughness: 1, color: '#7a5a44' }), x, 0.09, z, 40, false)
  bed.receiveShadow = true
  // The giant pumpkin: ribbed lobes, a curly stem and a big leaf or two on a vine.
  pumpkin(g, x, z, 1.7, '#ef7a1c', 0.18)
  const vine = M('#4f8a2c', { roughness: 0.8 })
  for (let i = 0; i < 8; i++) {
    const a = i * 0.7
    const v = box(g, 0.12, 0.08, 1.2, vine, x + 1.8 + Math.cos(a) * i * 0.35, 0.22, z + 1 + Math.sin(a) * i * 0.3)
    v.rotation.y = a
  }
  for (const [lx, lz] of [[x + 2.4, z + 1.6], [x + 3.4, z + 0.4], [x + 1.6, z + 3]]) {
    const leaf = cyl(g, 0.55, 0.55, 0.04, M('#5aa83a', { roughness: 0.7 }), lx, 0.28, lz, 6, false)
    leaf.rotation.set(0.2, rand() * 3, 0.1)
  }
  // Small pumpkins around the rim.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.3
    pumpkin(g, x + Math.cos(a) * (r + 1.6), z + Math.sin(a) * (r + 1.6), 0.22 + rand() * 0.18, rand() < 0.3 ? '#f6b13b' : '#ee7a1f')
  }
  barrel(g, x - 2, z + r + 2.2, 0.2)
  barrel(g, x - 0.9, z + r + 2.6, 1.0)
  wheelbarrow(g, x + r + 1.5, z - r + 0.5, -0.8)
  cornShock(g, x + r + 2.6, z + 3, rand)
  cornShock(g, x - r - 2.2, z - 2, rand)
  const hay = cyl(g, 0.85, 0.85, 1.4, new MeshStandardMaterial({ map: tex(paintHay(), 2, 1), roughness: 1 }), x - 3, 0.85, z - r - 2.4, 18)
  hay.rotation.z = Math.PI / 2
  hay.rotation.y = 0.3
  // A weathered scale beside the bed for the weigh-off.
  block(g, 1.2, 0.2, 1.2, M('#9aa0a6', { metalness: 0.5, roughness: 0.4 }), x + r + 0.4, 0, z + r - 0.4)
  block(g, 0.12, 1.4, 0.12, M('#5e6168'), x + r + 0.9, 0.2, z + r - 0.9)
  const dial = cyl(g, 0.32, 0.32, 0.08, M('#f7f4ec'), x + r + 0.9, 1.7, z + r - 0.85, 16)
  dial.rotation.x = Math.PI / 2
  bakeInto(root, g)
  addSurface({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r }, 'soil')
  root.add(weightCard(x, 4.6, z))
  solidCyl(1.7, 3, x, z)
  solidCyl(0.9, 1.7, x - 3, z - r - 2.4)
  solid(0.9, 0.6, 0.6, x - 1.4, 0.6, z + r + 2.4)
}

export function buildSouthWest(root, { addLamp }) {
  const rand = mulberry32(6262)
  const dirt = tex(paintDirt(256, '#9c7550', '#7a5638', 949), 1)
  const gravel = tex(paintDirt(256, '#b9ad98', '#8f8574', 953), 1)
  ground(root, FARM.homePath, 0.026, dirt, 6, 'dirt')
  ground(root, FARM.housePath, 0.03, gravel, 4, 'gravel')
  const home = cottage(root)
  officePorch(root)
  pumpkinPatch(root, rand)
  addLamp?.(FARM.farmhouse.x + 0.95, 2.6, FARM.farmhouse.z + 4)

  // The road side is the farm's boundary fence (gateways at the gravel walk and the dirt path);
  // a fence down the woods side keeps the garden.
  const H = FARM.homestead
  const fz = FARM.boundary.maxZ
  fence([[H.minX, fz], [H.minX, H.minZ + 6]])
  // A pallet, a bench and pumpkins by the road fence.
  const g = new Group()
  pallet(g, -78, 33, 0.3)
  const bench = new Group()
  bench.position.set(-95, 0, 33.5)
  block(bench, 2.2, 0.1, 0.6, M('#b67a42'), 0, 0.45, 0)
  block(bench, 2.2, 0.5, 0.08, M('#b67a42'), 0, 0.6, -0.28)
  for (const s of [-0.9, 0.9]) block(bench, 0.1, 0.45, 0.55, M('#2f2f33', { metalness: 0.4 }), s, 0, 0)
  g.add(bench)
  for (const [px, pz] of [[-80, 34.5], [-91, 34.8], [-106, 34]]) pumpkin(g, px, pz, 0.3 + rand() * 0.12)
  bakeInto(root, g)
  solid(1.1, 0.5, 0.35, -95, 0.5, 33.5)
  return { smoke: home.smoke }
}
