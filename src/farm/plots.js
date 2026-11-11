import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  QuadraticBezierCurve3,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { mulberry32 } from '../textures.js'
import { M, addSurface, block, box, cyl } from './kit.js'
import { addSway, part } from './field.js'
import { paintSoil, tex } from './textures.js'

// The extra plots west of the field (FARM.west), as the player buys them:
//  - the next plot for sale shows its FARMLAND pad (plots are sold in order,
//    at most GAME.plots.max)
//  - a bought plot loses its overgrowth (west.js) and becomes tilled soil
//    with ridges and a crop that grows from green shoots to golden wheat; a
//    floating card shows its progress, and walking into the ripe crop (or a
//    field hand / tractor driver) harvests it
//  - two pads on its headland upgrade it: Sprinklers (grows faster; more
//    sprinklers stand in the crop per level, spraying) and Fertilizer (more
//    money per harvest; darker soil, sacks on the headland, fuller crop)
// Pads turn red while the player cannot afford them.

const GREEN = new Color('#7fd060')
const WHITE = new Color('#ffffff')
const SOIL = new Color('#c9a88a')
const RICH = new Color('#7d5c44')
// How each crop reads: its ripe tint (over the golden clumps) and height.
const CROP_LOOK = {
  wheat: { ripe: new Color('#ffffff'), h: 1 },
  corn: { ripe: new Color('#e4f08a'), h: 1.6 },
  carrot: { ripe: new Color('#6fd04a'), h: 0.5 },
  sunflower: { ripe: new Color('#ffd23a'), h: 1.75 },
  pumpkin: { ripe: new Color('#ff9a3a'), h: 0.6 },
}

// A light wheat clump (4 stalks with heads and a leaf): the plots can hold a lot of them.
function cropClump(rand) {
  const parts = []
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand()
    const r = 0.08 + rand() * 0.12
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = 1.0 + rand() * 0.3
    const tilt = (rand() - 0.5) * 0.25
    parts.push(part(0.04, h, 0.04, x, 0, z, '#cfa94e', tilt))
    parts.push(part(0.09, 0.3, 0.09, x - Math.sin(tilt) * h, h - 0.04, z, '#f1c75a', tilt * 1.4))
  }
  parts.push(part(0.09, 0.03, 0.42, 0, 0.45, 0, '#b8a046', 0, 0.6, rand() * 3))
  return mergeGeometries(parts)
}

// A water jet: a thin arc from the sprinkler head out and down.
function jetGeo() {
  const curve = new QuadraticBezierCurve3(new Vector3(0, 0, 0), new Vector3(1.3, 0.9, 0), new Vector3(2.8, -1.0, 0))
  return new TubeGeometry(curve, 12, 0.035, 4, false)
}

// Floating status card over a plot: name, progress bar, state line.
function statusCard() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 150
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(7.4, 2.17, 1)
  let last = ''
  s.userData.set = (title, line, f, color) => {
    const key = `${title}|${line}|${Math.round(f * 50)}|${color}`
    if (key === last) return
    last = key
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const text = (str, y, size, fill, stroke, w) => {
      ctx.font = `700 ${size}px Fredoka, "Arial Black", sans-serif`
      ctx.lineWidth = w
      ctx.strokeStyle = stroke
      ctx.strokeText(str, 256, y, 500)
      ctx.fillStyle = fill
      ctx.fillText(str, 256, y, 500)
    }
    text(title, 28, 40, '#ffffff', '#1b1b1b', 9)
    // Progress bar.
    ctx.fillStyle = '#3a2614'
    ctx.beginPath()
    ctx.roundRect(56, 60, 400, 30, 15)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(60, 64, Math.max(22, 392 * f), 22, 11)
    ctx.fill()
    text(line, 122, 34, color, '#1b1b1b', 8)
    t.needsUpdate = true
  }
  document.fonts?.ready?.then(() => {
    last = ''
  })
  return s
}

export function buildPlots(root, { pads, particles }) {
  const rand = mulberry32(5151)
  const soilTex = tex(paintSoil(), 1)
  const clumpGeo = cropClump(rand)
  const jet = jetGeo()
  const jetMat = new MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.5, depthWrite: false })
  const o = new Object3D()
  const ups = GAME.plots.upgrades

  const plots = game.PLOTS.map((p, k) => {
    const r = p.rect
    const buy = pads.add({ x: p.x, z: p.z, kind: 'FARMLAND', name: `Field ${p.n}`, perk: 'More land to plant', price: p.price, buy: () => game.buyPlot(p) })
    const upPads = ups.map((u, j) =>
      pads.add({ x: r.maxX - 3.5 - j * 5.5, z: r.maxZ - 3.2, kind: `FIELD ${p.n}`, name: u.name, perk: u.perk, price: 0, buy: () => game.buyPlotUpgrade(p, u), u }),
    )
    return { p, k, buy, upPads, farmed: null, red: new Map() }
  })

  // Tilled soil, ridges, crop, sprinklers, sacks and the status card for a bought plot.
  function till(pl) {
    const { p } = pl
    const r = p.rect
    const c = p.crops
    const g = new Group()
    const w = r.maxX - r.minX
    const d = r.maxZ - r.minZ
    const soilGeo = new PlaneGeometry(w, d)
    soilGeo.rotateX(-Math.PI / 2)
    const st = soilTex.clone()
    st.repeat.set(w / 5, d / 5)
    st.needsUpdate = true
    const soilMat = new MeshStandardMaterial({ map: st, color: '#d9c2a8', roughness: 1 })
    const soil = new Mesh(soilGeo, soilMat)
    soil.position.set((r.minX + r.maxX) / 2, 0.034, (r.minZ + r.maxZ) / 2)
    soil.receiveShadow = true
    g.add(soil)

    // Ridges running north-south, a crop clump every metre along each.
    const len = c.maxZ - c.minZ
    const rows = Math.floor((c.maxX - c.minX) / FARM.fieldRow)
    const x0 = (c.minX + c.maxX) / 2 - ((rows - 1) * FARM.fieldRow) / 2
    const ridgeGeo = new BoxGeometry(1.25, 0.2, len)
    ridgeGeo.translate(0, 0.1, 0)
    const rt = soilTex.clone()
    rt.repeat.set(1, len / 3)
    rt.needsUpdate = true
    const ridgeMat = new MeshStandardMaterial({ map: rt, color: SOIL.clone(), roughness: 1 })
    const ridges = new InstancedMesh(ridgeGeo, ridgeMat, rows)
    const spots = []
    for (let i = 0; i < rows; i++) {
      const x = x0 + i * FARM.fieldRow
      o.position.set(x, 0.02, (c.minZ + c.maxZ) / 2)
      o.rotation.set(0, 0, 0)
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      ridges.setMatrixAt(i, o.matrix)
      for (let z = c.minZ + 0.6; z < c.maxZ - 0.4; z += 1) spots.push([x + (rand() - 0.5) * 0.3, z + (rand() - 0.5) * 0.25])
    }
    ridges.receiveShadow = true
    g.add(ridges)
    const cropMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, color: GREEN.clone(), emissive: '#000000' })
    addSway(cropMat, { bend: 0.16, sheen: 0.3 })
    const crop = new InstancedMesh(clumpGeo, cropMat, spots.length)
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z)
      o.rotation.set(0, (rand() - 0.5) * 0.6, 0)
      const s = 0.85 + rand() * 0.3
      o.scale.set(s, 0.85 + rand() * 0.3, s)
      o.updateMatrix()
      crop.setMatrixAt(i, o.matrix)
    })
    crop.receiveShadow = true
    const cropRoot = new Group() // stretched up (y) as the crop grows
    cropRoot.position.y = 0.2
    cropRoot.add(crop)
    g.add(cropRoot)

    // Sprinklers: 2 per level, in two columns down the crop.
    const sprinklers = []
    const maxSpr = ups.find((u) => u.id === 'sprinklers').max * 2
    for (let i = 0; i < maxSpr; i++) {
      const sx = c.minX + (c.maxX - c.minX) * (i % 2 ? 0.72 : 0.28)
      const sz = c.maxZ - (len * (Math.floor(i / 2) + 0.5)) / (maxSpr / 2)
      const s = new Group()
      s.position.set(sx, 0, sz)
      cyl(s, 0.07, 0.07, 2.1, M('#3a7bd5', { roughness: 0.4 }), 0, 1.05, 0, 8)
      cyl(s, 0.18, 0.22, 0.12, M('#3a7bd5', { roughness: 0.4 }), 0, 0.06, 0, 8)
      const head = new Group()
      head.position.y = 2.15
      cyl(head, 0.12, 0.12, 0.14, M('#d63a2c'), 0, 0, 0, 8)
      for (let j = 0; j < 3; j++) {
        const m = new Mesh(jet, jetMat)
        m.rotation.y = (j / 3) * Math.PI * 2
        head.add(m)
      }
      s.add(head)
      s.visible = false
      g.add(s)
      sprinklers.push({ s, head })
    }
    // Fertilizer sacks on the headland, one per level.
    const sacks = []
    for (let i = 0; i < ups.find((u) => u.id === 'fertilizer').max; i++) {
      const s = new Group()
      s.position.set(r.minX + 1.6 + i * 1.05, 0, r.maxZ - 1.6 - (i % 2) * 0.3)
      s.rotation.y = (rand() - 0.5) * 0.6
      block(s, 0.8, 0.55, 0.5, M('#efe6d2', { roughness: 0.95 }), 0, 0, 0)
      box(s, 0.82, 0.14, 0.52, M('#3f8a4a'), 0, 0.3, 0)
      box(s, 0.6, 0.12, 0.4, M('#e6dcc4', { roughness: 0.95 }), 0, 0.6, 0)
      s.visible = false
      g.add(s)
      sacks.push(s)
    }
    const card = statusCard()
    card.position.set((c.minX + c.maxX) / 2, 4.4, c.maxZ + 0.5)
    g.add(card)
    root.add(g)
    addSurface(r, 'soil')
    return { g, crop, cropRoot, cropMat, ridgeMat, sprinklers, sacks, card }
  }

  // Dust kicked up across a plot (tilling, harvesting).
  function burst(p, color, n) {
    const c = p.crops
    for (let i = 0; i < n; i++) particles?.dust(c.minX + Math.random() * (c.maxX - c.minX), c.minZ + Math.random() * (c.maxZ - c.minZ), color, 4)
  }

  function refresh(why) {
    const next = game.nextPlot()
    for (const pl of plots) {
      const { p } = pl
      const owned = game.plotOwned(p)
      pl.buy.setVisible(!owned && next === p && game.plotForSale(p))
      if (owned && !pl.farmed) {
        pl.farmed = till(pl)
        if (why?.p === p) burst(p, '#8a6446', 40)
      }
      if (pl.farmed) pl.farmed.g.visible = owned
      ups.forEach((u, j) => {
        const pad = pl.upPads[j]
        const lvl = game.plotLevel(p, u.id)
        const show = owned && lvl < u.max
        pad.setVisible(show)
        if (!show) return
        pad.price = game.plotUpgradePrice(p, u)
        pad.name = `${u.name} ${lvl + 1}/${u.max}`
        pad.red = game.state.money < pad.price
        pad.repaint()
      })
      if (!pl.farmed) continue
      const spr = game.plotLevel(p, 'sprinklers') * 2
      pl.farmed.sprinklers.forEach((s, i) => (s.s.visible = i < spr))
      const fert = game.plotLevel(p, 'fertilizer')
      pl.farmed.sacks.forEach((s, i) => (s.visible = i < fert))
      pl.farmed.ridgeMat.color.copy(SOIL).lerp(RICH, fert / ups.find((u) => u.id === 'fertilizer').max)
    }
    // The buy pad's colour follows the money too.
    for (const pl of plots) {
      if (!pl.buy.disc.visible) continue
      pl.buy.red = game.state.money < pl.buy.price
      pl.buy.repaint()
    }
  }
  refresh()
  game.on('plot', refresh)
  game.on('build', () => refresh()) // Coop 2 puts Field 1 up for sale
  game.on('reset', () => refresh())
  game.on('pad', () => refresh())
  game.on('harvest', ({ p }) => burst(p, '#e8c25a', 18))

  // Pads go red / green as the money crosses their price (checked twice a second).
  let moneyT = 0
  function recolor() {
    for (const pl of plots) {
      for (const pad of [pl.buy, ...pl.upPads]) {
        if (!pad.disc.visible) continue
        const red = game.state.money < pad.price
        if (red !== pad.red) {
          pad.red = red
          pad.repaint()
        }
      }
    }
  }

  return {
    plots,
    update(dt, t) {
      moneyT -= dt
      if (moneyT <= 0) {
        moneyT = 0.5
        recolor()
      }
      for (const pl of plots) {
        const f = pl.farmed
        if (!f || !f.g.visible) continue
        const { p } = pl
        const crop = game.plotCrop(p)
        const look = CROP_LOOK[crop] ?? CROP_LOOK.wheat
        const g = crop ? game.plotGrowth(p) : 0
        const e = g * g * (3 - 2 * g)
        const full = 1 + game.plotLevel(p, 'fertilizer') * 0.06
        // Height only: the group sits at the world origin, so x / z scaling would slide the rows.
        f.cropRoot.visible = !!crop
        f.cropRoot.scale.y = (0.12 + 0.88 * e) * full * look.h
        f.cropMat.color.copy(GREEN).lerp(look.ripe, Math.max(0, (g - 0.45) / 0.55))
        const ripe = g >= 1
        f.cropMat.emissive.setRGB(ripe ? 0.12 + Math.sin(t * 3) * 0.06 : 0, ripe ? 0.09 + Math.sin(t * 3) * 0.045 : 0, 0)
        for (const [i, s] of f.sprinklers.entries()) if (s.s.visible) s.head.rotation.y = t * 1.6 + i
        const hand = game.plotHasHand(p)
        const name = crop ? game.seedDef(crop).name.toUpperCase() : ''
        if (!crop) f.card.userData.set(`FIELD ${p.n}`, 'NO SEEDS: BUY AT THE SEED MARKET', 0, '#ff8a6a')
        else if (ripe) f.card.userData.set(`FIELD ${p.n} · ${name}`, hand ? 'READY! FIELD HAND COMING' : game.plotClaimed(p) ? 'TRACTOR HARVESTING' : 'READY! WALK OR DRIVE IN', 1, '#5cff6a')
        else f.card.userData.set(`FIELD ${p.n} · ${name}`, `GROWING ${Math.floor(g * 100)}%  +${game.plotYield(p)} ${name}`, g, '#ffcc33')
        f.card.position.y = 4.4 + Math.sin(t * 1.3 + pl.k) * 0.06
      }
    },
  }
}
