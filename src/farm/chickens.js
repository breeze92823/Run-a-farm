import {
  BoxGeometry,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FARM, GAME } from '../config.js'
import * as game from '../game.js'
import { nestState, on } from '../game.js'

// The floating coop cards (their hen buttons take clicks, see hud.js).
const coopCards = []
import { mulberry32 } from '../textures.js'
import { E, M, bakeInto, block, box, cyl, gableRoof, gated, inRect, prism, signCanvas, signMaterial, signPanel, solid, solidCyl } from './kit.js'
import { built } from '../game.js'
import { fence } from './fence.js'
import { makeNPC, makeWalker, updateWalker } from './npc.js'
import { paintHay, paintSiding, tex } from './textures.js'

// The chicken yard: a fenced dirt yard with three red coops (raised on legs,
// white trim, gable roof, ramp, nest box, round window), feed troughs, hay,
// a water drinker, lanterns, the CHICKEN YARD arch, two farm hands collecting
// eggs and a flock of hens that wander, peck, preen and scatter (with a flap
// and a puff of feathers) when the player runs through them.

const Y = FARM.chickenYard

// --- Shared materials ---------------------------------------------------------------
let mats = null
function materials() {
  if (mats) return mats
  const siding = tex(paintSiding(256, 8), 1, 1)
  const hay = tex(paintHay(), 1, 1)
  mats = {
    red: new MeshStandardMaterial({ color: '#d0302e', map: siding, roughness: 0.75 }),
    redPlain: M('#c92d2b'),
    white: M('#f7f4ec', { roughness: 0.6 }),
    roof: M('#5e6168', { roughness: 0.55, metalness: 0.2 }),
    dark: M('#2e1d14', { roughness: 1 }),
    wood: M('#a8693a'),
    woodDark: M('#7b4a26'),
    plank: M('#c18a52'),
    hay: new MeshStandardMaterial({ color: '#ffffff', map: hay, roughness: 1 }),
    egg: M('#fff6e3', { roughness: 0.35 }),
    eggBrown: M('#e9c9a0', { roughness: 0.4 }),
    yellow: M('#f4c430'),
    metal: M('#b8bec4', { roughness: 0.35, metalness: 0.6 }),
    grain: M('#e7c56a', { roughness: 1 }),
    glass: E('#ffe2a0', 0.5),
  }
  return mats
}

// --- Coop -------------------------------------------------------------------------
function coop(root, x, z, n, sprites) {
  const m = materials()
  const g = new Group()
  const W = 3.8 // x
  const D = 3.0 // z
  const floor = 0.55
  const wallH = 2.1
  // Legs and floor deck.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.24, floor, 0.24, m.woodDark, sx * (W / 2 - 0.15), 0, sz * (D / 2 - 0.15))
  block(g, W + 0.2, 0.16, D + 0.2, m.white, 0, floor - 0.08, 0)
  // Walls.
  block(g, W, wallH, D, m.red, 0, floor + 0.08, 0)
  const top = floor + 0.08 + wallH
  // Trim: corners, base and eave bands.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, 0.16, wallH + 0.06, 0.16, m.white, sx * (W / 2), floor + 0.05, sz * (D / 2))
  box(g, W + 0.1, 0.12, D + 0.1, m.white, 0, top - 0.04, 0)
  // Gable ends (front faces south) and the roof, ridge along Z.
  const rise = Math.tan((34 * Math.PI) / 180) * (W / 2)
  prism(g, W, rise, D, m.red, 0, top, 0)
  gableRoof(g, W, D, top - 0.02, 34, m.roof, { overhang: 0.32, thick: 0.14, axis: 'z', trim: m.white })
  // White barge boards along the front gable.
  const slope = Math.hypot(W / 2 + 0.3, rise + 0.2)
  const ang = Math.atan2(rise, W / 2)
  for (const s of [-1, 1]) {
    const b = box(g, slope, 0.14, 0.1, m.white, (s * W) / 4, top + rise / 2 + 0.05, D / 2 + 0.36)
    b.rotation.z = -s * ang
  }
  // Round window in the gable.
  const win = cyl(g, 0.34, 0.34, 0.08, m.white, 0, top + rise * 0.42, D / 2 + 0.02, 18)
  win.rotation.x = Math.PI / 2
  const pane = cyl(g, 0.25, 0.25, 0.1, m.dark, 0, top + rise * 0.42, D / 2 + 0.03, 18)
  pane.rotation.x = Math.PI / 2
  box(g, 0.5, 0.05, 0.02, m.white, 0, top + rise * 0.42, D / 2 + 0.09)
  box(g, 0.05, 0.5, 0.02, m.white, 0, top + rise * 0.42, D / 2 + 0.09)
  // Door (pop hole) with frame, and a slatted ramp down to the dirt.
  const dx = -0.7
  block(g, 0.95, 1.25, 0.06, m.dark, dx, floor + 0.15, D / 2 + 0.01)
  block(g, 1.15, 0.12, 0.08, m.white, dx, floor + 1.4, D / 2 + 0.03)
  block(g, 0.12, 1.3, 0.08, m.white, dx - 0.53, floor + 0.12, D / 2 + 0.03)
  block(g, 0.12, 1.3, 0.08, m.white, dx + 0.53, floor + 0.12, D / 2 + 0.03)
  const rampLen = 1.7
  const rampAng = Math.atan2(floor + 0.15, rampLen * 0.95)
  const ramp = new Group()
  ramp.position.set(dx, (floor + 0.15) / 2, D / 2 + rampLen / 2)
  ramp.rotation.x = rampAng
  box(ramp, 0.9, 0.07, rampLen, m.plank, 0, 0, 0)
  for (let i = 0; i < 6; i++) box(ramp, 0.9, 0.05, 0.06, m.woodDark, 0, 0.05, -rampLen / 2 + 0.2 + i * 0.27)
  g.add(ramp)
  // A small square window with shutters on the right of the door.
  block(g, 0.7, 0.6, 0.05, m.glass, 0.85, floor + 0.85, D / 2 + 0.01)
  block(g, 0.8, 0.08, 0.08, m.white, 0.85, floor + 0.8, D / 2 + 0.04)
  block(g, 0.8, 0.08, 0.08, m.white, 0.85, floor + 1.45, D / 2 + 0.04)
  block(g, 0.06, 0.7, 0.08, m.white, 0.85, floor + 0.8, D / 2 + 0.05)
  // Nest box bolted to the east wall: red box with a sloped hinged lid.
  const nb = new Group()
  nb.position.set(W / 2 + 0.45, floor + 0.3, 0)
  block(nb, 0.9, 0.85, 2.2, m.red, 0, 0, 0)
  const lid = box(nb, 1.1, 0.1, 2.4, m.roof, 0, 0.98, 0)
  lid.rotation.z = -0.32
  for (const s of [-1, 0, 1]) block(nb, 0.04, 0.6, 0.04, m.white, 0.46, 0.1, s * 0.7)
  g.add(nb)
  // Ventilation slot under the eave on the back.
  block(g, 2, 0.2, 0.04, m.dark, 0, top - 0.45, -D / 2 - 0.01)
  // Name board over the door.
  const p = signCanvas(256, 96, { bg: '#f7f4ec', border: '#7b4a26', borderWidth: 8, radius: 10, lines: [{ text: `COOP ${n}`, size: 54, color: '#c92d2b' }] })
  signPanel(g, 1.1, 0.42, signMaterial(p), dx, floor + 1.75, D / 2 + 0.07)

  // In front: a straw nest crate with eggs, the yellow EGGS plank and a feeder.
  const nest = new Group()
  nest.position.set(1.3, 0, D / 2 + 1.6)
  block(nest, 1.2, 0.3, 0.8, m.wood, 0, 0, 0)
  block(nest, 1.06, 0.06, 0.66, m.hay, 0, 0.28, 0)
  for (let i = 0; i < 5; i++) {
    const e = cyl(nest, 0.085, 0.085, 0.16, i % 3 ? m.egg : m.eggBrown, -0.36 + i * 0.18, 0.4, (i % 2 - 0.5) * 0.2, 10)
    e.scale.set(1, 1.15, 1)
  }
  g.add(nest)
  const eggSign = new Group()
  eggSign.position.set(-0.5, 0, D / 2 + 2.5)
  eggSign.rotation.y = 0.15
  const ep = signCanvas(256, 96, { bg: '#f4c430', border: '#b07a12', borderWidth: 8, radius: 8, lines: [{ text: 'EGGS', size: 64, color: '#7b4a10' }] })
  box(eggSign, 1.2, 0.36, 0.08, m.yellow, 0, 0.18, 0)
  signPanel(eggSign, 1.18, 0.34, signMaterial(ep), 0, 0.2, 0.045)
  eggSign.rotation.x = -1.2 // lying in the dirt, tipped up
  eggSign.position.y = 0.12
  g.add(eggSign)

  g.position.set(x, 0, z)
  bakeInto(root, g)
  solid(W / 2 + 0.95, 2, D / 2 + 0.1, x + 0.45, 2, z)

  // Floating coop card: name, nests, egg rate, FULL tag.
  const card = coopCard(n, x, z, top + rise + 1.4)
  coopCards.push(card)
  root.add(card.sprite)
}

// The floating coop card, as in the reference: a brown "COOP n" tab over a white
// card with the hen count and the laying rate, the nest crate's fill bar (yellow,
// red "FULL" when full) and a grey FULL button (every hen slot taken). Redrawn
// whenever that coop's nest changes (game 'nest' events).
function coopCard(n, x, z, y) {
  const W = 360
  const H = 176
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const nest = nestState.find((k) => k.n === n)
  const BTN = { x: 236, y: 114, w: 104, h: 40 }
  let hover = false
  let pressT = 0
  const rr = (ctx, x0, y0, w, h, r) => {
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(x0, y0, w, h, r) : ctx.rect(x0, y0, w, h)
  }
  const outlined = (ctx, text, x0, y0, size, fill, stroke = '#2a1608', align = 'center') => {
    ctx.font = `700 ${size}px Fredoka, "Arial Black", sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.22
    ctx.strokeStyle = stroke
    ctx.strokeText(text, x0, y0)
    ctx.fillStyle = fill
    ctx.fillText(text, x0, y0)
  }
  const hen = (ctx, cx, cy) => {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#3a1f0e'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(cx, cy + 3, 13, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 9, cy - 8, 6.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e0262b'
    ctx.fillRect(cx + 7, cy - 18, 5, 5)
    ctx.fillStyle = '#f2a02a'
    ctx.beginPath()
    ctx.moveTo(cx + 15, cy - 9)
    ctx.lineTo(cx + 21, cy - 7)
    ctx.lineTo(cx + 15, cy - 5)
    ctx.fill()
  }
  const egg = (ctx, cx, cy) => {
    ctx.fillStyle = '#fbf6ea'
    ctx.strokeStyle = '#3a1f0e'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(cx, cy, 10, 13, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    const eggs = nest?.eggs ?? 0
    const max = GAME.nestMax
    // Card body.
    ctx.fillStyle = 'rgba(255, 252, 244, 0.97)'
    ctx.strokeStyle = '#b9a07a'
    ctx.lineWidth = 6
    rr(ctx, 6, 30, W - 12, H - 36, 18)
    ctx.fill()
    ctx.stroke()
    // Tab.
    ctx.fillStyle = '#8a5130'
    ctx.strokeStyle = '#5a2e14'
    ctx.lineWidth = 5
    rr(ctx, W / 2 - 70, 6, 140, 42, 12)
    ctx.fill()
    ctx.stroke()
    outlined(ctx, `COOP ${n}`, W / 2, 28, 26, '#ffffff', '#3a1a08')
    // Hens and laying rate.
    hen(ctx, 54, 78)
    ctx.font = '700 30px Fredoka, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#3a2414'
    ctx.textBaseline = 'middle'
    const hens = game.hensIn(n)
    const henFull = hens >= GAME.henMax
    ctx.fillText(`${hens}/${GAME.henMax}`, 80, 80)
    egg(ctx, 196, 80)
    ctx.fillStyle = '#3a2414'
    ctx.fillText(`${((hens / GAME.layEvery) * 1).toFixed(1)}/s`, 214, 80)
    // Nest bar.
    const full = eggs >= max
    ctx.fillStyle = '#5b3a1e'
    ctx.strokeStyle = '#2a1608'
    ctx.lineWidth = 4
    rr(ctx, 22, 114, 200, 40, 10)
    ctx.fill()
    ctx.stroke()
    const f = Math.max(0.08, eggs / max)
    const grad = ctx.createLinearGradient(0, 118, 0, 150)
    if (full) {
      grad.addColorStop(0, '#ff7a62')
      grad.addColorStop(1, '#d6342c')
    } else {
      grad.addColorStop(0, '#ffe27a')
      grad.addColorStop(1, '#e9a52a')
    }
    ctx.fillStyle = grad
    rr(ctx, 26, 118, 192 * f, 32, 7)
    ctx.fill()
    outlined(ctx, full ? 'FULL' : `${eggs}/${max}`, 122, 135, 24, '#ffffff')
    // Hen button: grey FULL at the hen limit, otherwise a green / amber buy button.
    const cost = game.henPrice(n)
    const afford = game.state.money >= cost
    const lift = pressT > 0 ? 2 : 0
    ctx.fillStyle = henFull ? '#d9d6cf' : !afford ? '#f2c14a' : hover ? '#8ff06a' : '#6fdc4a'
    ctx.strokeStyle = henFull ? '#8a857a' : !afford ? '#9a6414' : '#24711a'
    ctx.lineWidth = 4
    rr(ctx, BTN.x, BTN.y + lift, BTN.w, BTN.h, 10)
    ctx.fill()
    ctx.stroke()
    const ink = henFull ? '#6a655a' : !afford ? '#7a4a08' : '#1f5a14'
    if (henFull) outlined(ctx, 'FULL', 288, 135 + lift, 22, '#ffffff', ink)
    else {
      outlined(ctx, '+ HEN', 288, 126 + lift, 15, '#ffffff', ink)
      outlined(ctx, game.fmtMoney(cost), 288, 143 + lift, 15, '#ffffff', ink)
    }
  }
  draw()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const redraw = () => {
    draw()
    t.needsUpdate = true
  }
  document.fonts?.ready?.then(redraw)
  on('nest', (k) => k?.n === n && redraw())
  on('change', redraw)
  on('reset', redraw)
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(3.3, 1.62, 1)
  s.position.set(x, y, z)
  return {
    sprite: s,
    // Whether a raycast hit (sprite uv, 0,0 = bottom left) is on the hen button.
    hitButton(uv) {
      if (!uv) return false
      const px = uv.x * W
      const py = (1 - uv.y) * H
      return px >= BTN.x && px <= BTN.x + BTN.w && py >= BTN.y && py <= BTN.y + BTN.h
    },
    setHover(on) {
      if (hover === on) return
      hover = on
      redraw()
    },
    press() {
      pressT = 0.14
      setTimeout(() => {
        pressT = 0
        redraw()
      }, 140)
      redraw()
      return game.buyHen(n)
    },
  }
}

// --- Yard props --------------------------------------------------------------------------
function hayBale(g, x, z, ry = 0, stack = 1) {
  const m = materials()
  for (let i = 0; i < stack; i++) {
    const b = block(g, 1.3, 0.62, 0.8, m.hay, x, i * 0.62, z, ry + i * 0.2)
    void b
    // Two twine bands.
    for (const s of [-0.32, 0.32]) {
      const t = block(g, 0.04, 0.64, 0.82, M('#7a5a2a'), x + Math.cos(ry + i * 0.2) * s, i * 0.62 - 0.01, z - Math.sin(ry + i * 0.2) * s, ry + i * 0.2)
      void t
    }
  }
}

function trough(g, x, z, ry) {
  const m = materials()
  const t = new Group()
  t.position.set(x, 0, z)
  t.rotation.y = ry
  block(t, 2.2, 0.08, 0.6, m.wood, 0, 0.18, 0)
  for (const s of [-1, 1]) {
    block(t, 2.2, 0.32, 0.08, m.wood, 0, 0.18, s * 0.28)
    block(t, 0.1, 0.4, 0.62, m.woodDark, s * 1.1, 0, 0)
  }
  block(t, 2.0, 0.08, 0.44, m.grain, 0, 0.27, 0)
  for (const s of [-1, 1]) block(t, 0.1, 0.26, 0.1, m.woodDark, s * 0.9, 0, 0)
  g.add(t)
}

function drinker(g, x, z) {
  const m = materials()
  cyl(g, 0.55, 0.55, 0.12, m.metal, x, 0.06, z, 16)
  cyl(g, 0.3, 0.32, 0.75, m.metal, x, 0.5, z, 14)
  cyl(g, 0.1, 0.3, 0.2, m.metal, x, 0.98, z, 14)
  cyl(g, 0.04, 0.04, 0.2, m.metal, x, 1.15, z, 6)
  cyl(g, 0.5, 0.5, 0.04, M('#78b6d8', { roughness: 0.1 }), x, 0.12, z, 16)
}

// Lantern on a hook post: dark iron frame around a warm glowing glass.
export function lanternPost(g, x, z, h = 2.4, lamp = null) {
  const iron = M('#2c2c30', { roughness: 0.5, metalness: 0.4 })
  block(g, 0.16, h, 0.16, M('#7b4a26'), x, 0, z)
  block(g, 0.6, 0.1, 0.1, M('#7b4a26'), x + 0.25, h - 0.1, z)
  const lx = x + 0.48
  const ly = h - 0.65
  box(g, 0.05, 0.25, 0.05, iron, lx, ly + 0.42, z)
  box(g, 0.32, 0.06, 0.32, iron, lx, ly + 0.28, z)
  box(g, 0.28, 0.06, 0.28, iron, lx, ly - 0.22, z)
  box(g, 0.22, 0.42, 0.22, E('#ffc46b', 2.2), lx, ly + 0.03, z, 0, false)
  if (lamp) lamp(lx, ly, z)
}

// --- Arch ------------------------------------------------------------------------------
function arch(root, x, z) {
  const g = new Group()
  const post = M('#7a3f22')
  const red = M('#b7322a')
  const half = 3.2
  for (const s of [-1, 1]) {
    block(g, 0.42, 4.4, 0.42, post, x + s * half, 0, z)
    block(g, 0.6, 0.3, 0.6, M('#5a2e18'), x + s * half, 0, z)
  }
  box(g, half * 2 + 1.1, 0.36, 0.5, post, x, 4.25, z)
  box(g, half * 2 + 1.5, 0.12, 0.9, red, x, 4.5, z)
  // Hanging sign under the beam.
  const p = signCanvas(768, 200, {
    bg: '#8a5130',
    plank: 2,
    border: '#5a2e18',
    borderWidth: 14,
    radius: 14,
    lines: [
      { text: 'CHICKEN YARD', size: 96, color: '#d63a2c', stroke: '#fbe6c4', strokeWidth: 10 },
      { text: 'collect eggs from the nests', size: 40, color: '#fbe6c4', weight: 600 },
    ],
  })
  const mat = signMaterial(p)
  box(g, 5.6, 1.5, 0.14, M('#8a5130'), x, 3.2, z)
  signPanel(g, 5.5, 1.43, mat, x, 3.2, z + 0.075)
  signPanel(g, 5.5, 1.43, mat, x, 3.2, z - 0.075, Math.PI)
  for (const s of [-1, 1]) box(g, 0.05, 0.4, 0.05, M('#2c2c30'), x + s * 2.4, 4.0, z)
  bakeInto(root, g)
  solid(0.25, 2.2, 0.25, x - half, 2.2, z)
  solid(0.25, 2.2, 0.25, x + half, 2.2, z)
}

// --- Hens --------------------------------------------------------------------------------
// One merged, vertex-coloured geometry per part; instanced per breed.
function coloured(geo, color) {
  const c = new Color(color)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3))
  return geo
}
function part(w, h, d, x, y, z, color, rx = 0) {
  const g = new BoxGeometry(w, h, d)
  if (rx) g.applyMatrix4(new Matrix4().makeRotationX(rx))
  g.translate(x, y, z)
  return coloured(g, color)
}
function henGeometry(body, dark) {
  const leg = '#f0a030'
  const bodyGeo = mergeGeometries([
    part(0.42, 0.36, 0.52, 0, 0.42, 0, body),
    part(0.36, 0.3, 0.2, 0, 0.42, 0.25, body),
    part(0.34, 0.2, 0.34, 0, 0.3, -0.02, body), // belly fluff
    part(0.3, 0.34, 0.14, 0, 0.62, -0.3, dark, -0.5), // tail
    part(0.22, 0.24, 0.1, 0, 0.72, -0.34, dark, -0.7),
    part(0.07, 0.26, 0.38, 0.23, 0.44, -0.02, dark, 0.15), // wings
    part(0.07, 0.26, 0.38, -0.23, 0.44, -0.02, dark, 0.15),
    part(0.05, 0.24, 0.05, 0.09, 0.12, 0.02, leg),
    part(0.05, 0.24, 0.05, -0.09, 0.12, 0.02, leg),
    part(0.12, 0.03, 0.16, 0.09, 0.015, 0.06, leg),
    part(0.12, 0.03, 0.16, -0.09, 0.015, 0.06, leg),
  ])
  // Head pivots at the neck: origin = neck joint.
  const headGeo = mergeGeometries([
    part(0.16, 0.16, 0.14, 0, 0.04, 0.0, body), // neck
    part(0.22, 0.22, 0.22, 0, 0.16, 0.06, body),
    part(0.09, 0.06, 0.12, 0, 0.14, 0.22, '#f2a02a'),
    part(0.05, 0.12, 0.16, 0, 0.32, 0.06, '#e0262b'), // comb
    part(0.05, 0.08, 0.05, 0, 0.04, 0.16, '#e0262b'), // wattle
    part(0.23, 0.04, 0.04, 0, 0.19, 0.11, '#151515'), // eyes (through the head)
  ])
  return { bodyGeo, headGeo }
}

function makeFlock(root, count, rand) {
  const breeds = [
    { ...henGeometry('#fbfaf6', '#e9e4d8'), share: 0.7 },
    { ...henGeometry('#b8642e', '#7d3d1a'), share: 0.3 },
  ]
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  const hens = []
  const coopRects = FARM.coops.map((c) => ({ minX: c.x - 2.6, maxX: c.x + 3.4, minZ: c.z - 2.2, maxZ: c.z + 4.2 }))
  const blocked = (x, z) => coopRects.some((r) => inRect(x, z, r)) || !inRect(x, z, Y, -1.2)
  const pickTarget = (h) => {
    for (let i = 0; i < 20; i++) {
      const x = h.x + (rand() - 0.5) * 12
      const z = h.z + (rand() - 0.5) * 12
      if (!blocked(x, z)) return [x, z]
    }
    return [(Y.minX + Y.maxX) / 2, 10]
  }
  const meshes = breeds.map((b) => {
    const n = Math.round(count * b.share)
    const body = new InstancedMesh(b.bodyGeo, mat, n)
    const head = new InstancedMesh(b.headGeo, mat, n)
    body.castShadow = head.castShadow = true
    body.receiveShadow = head.receiveShadow = true
    body.frustumCulled = head.frustumCulled = false
    root.add(body, head)
    for (let i = 0; i < n; i++) {
      let x, z
      do {
        x = Y.minX + 2 + rand() * (Y.maxX - Y.minX - 4)
        z = Y.minZ + 2 + rand() * (Y.maxZ - Y.minZ - 4)
      } while (blocked(x, z))
      const h = { x, z, yaw: rand() * 6.28, state: 'idle', t: rand() * 3, target: null, speed: 0, mesh: i, breed: body, headMesh: head, peck: 0, bob: rand() * 10, hop: 0, look: 0, scale: 0.92 + rand() * 0.2 }
      hens.push(h)
    }
    return { body, head }
  })
  // Mix the breeds so the hens shown first (fewer coops built) are not all white.
  for (let i = hens.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[hens[i], hens[j]] = [hens[j], hens[i]]
  }
  return { hens, meshes, pickTarget, blocked }
}

// --- Feathers ------------------------------------------------------------------------------
function makeFeathers(root) {
  const geo = new PlaneGeometry(0.16, 0.06)
  const mat = new MeshStandardMaterial({ color: '#ffffff', side: DoubleSide, roughness: 0.9 })
  const mesh = new InstancedMesh(geo, mat, 40)
  mesh.frustumCulled = false
  const list = []
  const o = new Object3D()
  o.scale.set(0, 0, 0)
  o.updateMatrix()
  for (let i = 0; i < 40; i++) {
    mesh.setMatrixAt(i, o.matrix)
    mesh.setColorAt(i, new Color('#ffffff'))
    list.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, spin: 0 })
  }
  root.add(mesh)
  let next = 0
  const tint = new Color()
  return {
    puff(x, z, color, n = 5) {
      for (let k = 0; k < n; k++) {
        const f = list[next]
        next = (next + 1) % list.length
        f.life = 2.4 + Math.random() * 1.6
        f.x = x
        f.y = 0.5
        f.z = z
        f.vx = (Math.random() - 0.5) * 1.6
        f.vy = 1 + Math.random() * 1.4
        f.vz = (Math.random() - 0.5) * 1.6
        f.r = Math.random() * 6
        f.spin = (Math.random() - 0.5) * 8
        mesh.setColorAt(list.indexOf(f), tint.set(color))
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    update(dt, t) {
      list.forEach((f, i) => {
        if (f.life <= 0) return
        f.life -= dt
        f.vy = Math.max(f.vy - dt * 3, -0.35) // feathers float down slowly
        f.vx *= 1 - dt * 1.5
        f.vz *= 1 - dt * 1.5
        f.x += (f.vx + Math.sin(t * 3 + i) * 0.3) * dt
        f.z += f.vz * dt
        f.y = Math.max(0.04, f.y + f.vy * dt)
        f.r += f.spin * dt
        o.position.set(f.x, f.y, f.z)
        o.rotation.set(f.y > 0.05 ? Math.sin(f.r) * 0.8 : -Math.PI / 2, f.r, f.y > 0.05 ? Math.cos(f.r * 0.7) * 0.6 : 0)
        const s = f.life < 0.5 ? f.life / 0.5 : 1
        o.scale.set(s, s, s)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}

// --- Build ---------------------------------------------------------------------------------
export function buildChickenYard(root, { addLamp }) {
  const rand = mulberry32(5150)
  const sprites = []
  // Fence with the arch gap on the south side and a gate to the path on the north.
  const a = FARM.yardArch
  fence([[a.x - 3.2, Y.maxZ], [Y.minX, Y.maxZ], [Y.minX, Y.minZ], [-30, Y.minZ]])
  fence([[-26, Y.minZ], [Y.maxX, Y.minZ], [Y.maxX, Y.maxZ], [a.x + 3.2, Y.maxZ]])

  // Coop 1 is there from the start; the others are bought on their build pads.
  for (const c of FARM.coops) {
    if (c.n === 1) coop(root, c.x, c.z, c.n, sprites)
    else gated(root, `coop${c.n}`, (G) => coop(G, c.x, c.z, c.n, sprites), 5.5)
  }
  arch(root, a.x, a.z)

  // Props.
  const g = new Group()
  hayBale(g, -60, -8, 0.3, 2)
  hayBale(g, -58.4, -8.6, 1.4)
  hayBale(g, -44, -9.5, 0.1)
  hayBale(g, -28.5, -9, -0.2, 2)
  hayBale(g, -12, -9.5, 0.4)
  hayBale(g, -9, 8, 1.2)
  hayBale(g, -63, 14, 0.2)
  trough(g, -44, 7, 0.1)
  trough(g, -28, 9, -0.15)
  trough(g, -56, 11, 1.4)
  drinker(g, -36, 12)
  drinker(g, -16, 9)
  // Scattered grain piles and egg baskets.
  for (let i = 0; i < 18; i++) {
    const x = Y.minX + 4 + rand() * (Y.maxX - Y.minX - 8)
    const z = 4 + rand() * 12
    const pile = cyl(g, 0.3 + rand() * 0.3, 0.45 + rand() * 0.3, 0.05, M('#e3c063', { roughness: 1 }), x, 0.045, z, 9, false)
    pile.rotation.y = rand() * 6
  }
  for (const [x, z] of [[-47.5, 0.5], [-31.5, 0.5], [-15.5, 0.5]]) {
    cyl(g, 0.34, 0.26, 0.34, M('#b07a3e', { roughness: 0.9 }), x, 0.17, z, 12)
    for (let i = 0; i < 6; i++) cyl(g, 0.08, 0.08, 0.15, materials().egg, x + Math.cos(i) * 0.15, 0.38, z + Math.sin(i) * 0.15, 8)
  }
  bakeInto(root, g)
  // Lanterns around the yard (warm glow, lit at night): the Farm Lanterns decor pad (FARM.pads).
  gated(root, 'pad:Farm Lanterns', (G) => {
    const lg = new Group()
    const lamp = (x, y, z) => addLamp(x, y, z)
    lanternPost(lg, -64.6, 16.6, 2.4)
    lanternPost(lg, -44, 16.6, 2.4, lamp)
    lanternPost(lg, -24, 16.6, 2.4)
    lanternPost(lg, -64.6, -10.6, 2.4)
    lanternPost(lg, -28, -10.4, 2.4, lamp)
    bakeInto(G, lg)
  }, 2.6)
  solidCyl(0.6, 1.2, -36, 12)
  solidCyl(0.6, 1.2, -16, 9)

  for (const s of sprites) root.add(s)

  // Farm hands collecting eggs, walking coop to coop.
  // (No farm hands at the start: the player collects the eggs, stockers come later.)
  const walkers = []
  void makeNPC
  void makeWalker

  const flock = makeFlock(root, FARM.coops.length * GAME.henMax, rand)
  const feathers = makeFeathers(root)
  const o = new Object3D()
  const neck = new Object3D()
  const events = [] // { type: 'flap' | 'peck', x, z } consumed by the audio

  return {
    hens: flock.hens,
    cards: coopCards,
    events,
    update(dt, t, player) {
      for (const w of walkers) updateWalker(w, t, dt)
      feathers.update(dt, t)
      // Coop 1 starts with GAME.startHens; each other built coop adds GAME.hensPerCoop. The rest stay out of sight.
      const henCount = Math.min(
        flock.hens.length,
        FARM.coops.reduce((s, c) => s + (built(`coop${c.n}`) ? game.hensIn(c.n) : 0), 0),
      )
      for (const [i, h] of flock.hens.entries()) {
        h.hidden = i >= henCount
        if (h.hidden) {
          if (!h.zeroed) {
            h.zeroed = true
            o.position.set(h.x, -5, h.z)
            o.scale.setScalar(0.001)
            o.updateMatrix()
            h.breed.setMatrixAt(h.mesh, o.matrix)
            h.headMesh.setMatrixAt(h.mesh, o.matrix)
          }
          continue
        }
        h.zeroed = false
        const pdx = h.x - player.x
        const pdz = h.z - player.z
        const pd = Math.hypot(pdx, pdz)
        const playerSpeed = Math.hypot(player.vx, player.vz)
        // Startle: a player close by (closer still if they are only walking).
        if (h.state !== 'flee' && (pd < 1.6 || (pd < 3.2 && playerSpeed > 9))) {
          h.state = 'flee'
          h.t = 0.9 + Math.random() * 0.5
          const k = 3 / Math.max(pd, 0.3)
          h.target = [h.x + pdx * k + (Math.random() - 0.5) * 2, h.z + pdz * k + (Math.random() - 0.5) * 2]
          h.hop = 0.5
          feathers.puff(h.x, h.z, h.breed === flock.meshes[0].body ? '#ffffff' : '#b8642e', 4)
          events.push({ type: 'flap', x: h.x, z: h.z })
        }
        h.t -= dt
        if (h.state === 'idle' && h.t <= 0) {
          const r = Math.random()
          if (r < 0.45) {
            h.state = 'walk'
            h.target = flock.pickTarget(h)
            h.t = 6
          } else if (r < 0.85) {
            h.state = 'peck'
            h.t = 1.5 + Math.random() * 3
          } else {
            h.state = 'idle'
            h.t = 1 + Math.random() * 2
            h.look = (Math.random() - 0.5) * 1.6
          }
        } else if ((h.state === 'peck' || h.state === 'flee') && h.t <= 0) {
          h.state = 'idle'
          h.t = 0.5 + Math.random() * 2
        }
        let moving = false
        if ((h.state === 'walk' || h.state === 'flee') && h.target) {
          const dx = h.target[0] - h.x
          const dz = h.target[1] - h.z
          const d = Math.hypot(dx, dz)
          if (d < 0.15 || (h.state === 'walk' && h.t <= 0)) {
            if (h.state === 'walk') {
              h.state = Math.random() < 0.6 ? 'peck' : 'idle'
              h.t = 1 + Math.random() * 2.5
            }
          } else {
            const sp = h.state === 'flee' ? 4.2 : 0.75
            const step = Math.min(d, sp * dt)
            const nx = h.x + (dx / d) * step
            const nz = h.z + (dz / d) * step
            if (!flock.blocked(nx, nz)) {
              h.x = nx
              h.z = nz
              moving = true
            } else {
              h.target = flock.pickTarget(h)
            }
            const yaw = Math.atan2(dx, dz)
            let diff = Math.atan2(Math.sin(yaw - h.yaw), Math.cos(yaw - h.yaw))
            h.yaw += diff * Math.min(1, dt * (h.state === 'flee' ? 14 : 6))
          }
        }
        // Pose.
        h.bob += dt * (moving ? (h.state === 'flee' ? 22 : 10) : 0)
        h.hop = Math.max(0, h.hop - dt)
        const hopY = h.hop > 0 ? Math.sin((h.hop / 0.5) * Math.PI) * 0.35 : 0
        const walkY = moving ? Math.abs(Math.sin(h.bob)) * 0.04 : 0
        o.position.set(h.x, hopY + walkY, h.z)
        o.rotation.set(0, h.yaw, moving ? Math.sin(h.bob) * 0.08 : 0)
        o.scale.setScalar(h.scale)
        o.updateMatrix()
        h.breed.setMatrixAt(h.mesh, o.matrix)
        // Head: pecks (fast dips), walking bob (the head-forward pump), idle glances.
        let pitch = 0
        let fwd = 0
        let yawH = 0
        if (h.state === 'peck') {
          const p = (t * 3.2 + h.mesh) % 1
          const dip = p < 0.35 ? Math.sin((p / 0.35) * Math.PI) : 0
          pitch = 0.25 + dip * 1.0
          fwd = dip * 0.08
          if (p < 0.02 + dt * 3.2 && dip < 0.2) {
            h.peck++
            if (h.peck % 2 === 0) events.push({ type: 'peck', x: h.x, z: h.z })
          }
        } else if (moving) {
          fwd = Math.sin(h.bob * 2) * 0.05
        } else {
          yawH = h.look + Math.sin(t * 0.9 + h.mesh) * 0.25
          pitch = Math.sin(t * 1.3 + h.mesh * 2) * 0.1
        }
        neck.position.set(0, 0.56, 0.22 + fwd)
        neck.rotation.set(pitch, yawH, 0)
        neck.updateMatrix()
        o.matrix.multiply(neck.matrix)
        h.headMesh.setMatrixAt(h.mesh, o.matrix)
      }
      for (const m of flock.meshes) {
        m.body.instanceMatrix.needsUpdate = true
        m.head.instanceMatrix.needsUpdate = true
      }
      if (events.length > 40) events.splice(0, events.length - 40)
    },
  }
}
