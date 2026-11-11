import { AdditiveBlending, CanvasTexture, CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { FARM } from '../config.js'

// Upgrade pads: the glowing discs where the player buys the next upgrade
// (Coop 4, Fountain, Blossom Trees, Drone Port, ...). Each one is a bevelled
// glowing disc with a light ring that keeps rising and fading off it, and a
// floating card above: category, name, perk and price. The plots add their
// own pads at run time (`add`): those can be repainted and shown / hidden, and
// carry their own `buy()`.

function card(p) {
  const c = document.createElement('canvas')
  c.width = 420
  c.height = 230
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const text = (t, y, size, fill, stroke = '#1b1b1b', w = 8, weight = 700) => {
      ctx.font = `${weight} ${size}px Fredoka, "Arial Black", sans-serif`
      ctx.lineWidth = w
      ctx.strokeStyle = stroke
      ctx.strokeText(t, 210, y, 400)
      ctx.fillStyle = fill
      ctx.fillText(t, 210, y, 400)
    }
    text(p.kind, 28, 30, '#ffb13b', '#4a2a00', 7)
    text(p.name, 76, 56, '#ffffff', '#1b1b1b', 10)
    text(p.perk, 124, 32, '#9dff8a', '#14320e', 7, 600)
    // Coin + price.
    const price = `$${p.price.toLocaleString('en-US')}`
    ctx.font = '700 48px Fredoka, sans-serif'
    const w = ctx.measureText(price).width
    const cx = 210 - w / 2 - 26
    ctx.fillStyle = '#ffcc33'
    ctx.strokeStyle = '#8a5a00'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(cx, 180, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#8a5a00'
    ctx.font = '700 26px Fredoka, sans-serif'
    ctx.fillText('$', cx, 181)
    ctx.textAlign = 'left'
    ctx.font = '700 48px Fredoka, sans-serif'
    ctx.lineWidth = 9
    ctx.strokeStyle = p.red ? '#3a0a0a' : '#0f2a0a'
    ctx.strokeText(price, cx + 30, 182)
    ctx.fillStyle = p.red ? '#ff6a5a' : '#5cff6a'
    ctx.fillText(price, cx + 30, 182)
  }
  draw()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const redraw = () => {
    draw()
    t.needsUpdate = true
  }
  document.fonts?.ready?.then(redraw)
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  s.scale.set(3.4, 1.86, 1)
  s.userData.redraw = redraw
  return s
}

const discGeo = new CylinderGeometry(1.35, 1.45, 0.14, 40)
const rimGeo = new CylinderGeometry(1.55, 1.6, 0.08, 40)
const ringGeo = new RingGeometry(1.25, 1.45, 48)
ringGeo.rotateX(-Math.PI / 2)
const GREEN = { col: '#4ef06a', rim: '#2a9a3a' }
const RED = { col: '#ff4a3a', rim: '#b8261a' }

function makePad(root, p) {
  const k = p.red ? RED : GREEN
  const disc = new Mesh(discGeo, new MeshStandardMaterial({ color: k.col, emissive: k.col, emissiveIntensity: 0.9, roughness: 0.3 }))
  disc.position.set(p.x, 0.12, p.z)
  const rim = new Mesh(rimGeo, new MeshStandardMaterial({ color: k.rim, roughness: 0.5 }))
  rim.position.set(p.x, 0.06, p.z)
  disc.receiveShadow = rim.receiveShadow = true
  const rings = []
  for (let i = 0; i < 2; i++) {
    const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: k.col, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
    r.position.set(p.x, 0.2, p.z)
    rings.push(r)
    root.add(r)
  }
  const pad = Object.assign(p, { disc, rim, rings })
  pad.label = card(pad)
  pad.label.position.set(p.x, 2.6, p.z)
  root.add(disc, rim, pad.label)
  pad.setVisible = (v) => {
    disc.visible = rim.visible = pad.label.visible = v
    for (const r of rings) r.visible = v
  }
  // After changing kind / name / perk / price / red.
  pad.repaint = () => {
    const c = pad.red ? RED : GREEN
    disc.material.color.set(c.col)
    disc.material.emissive.set(c.col)
    rim.material.color.set(c.rim)
    for (const r of rings) r.material.color.set(c.col)
    pad.label.userData.redraw()
  }
  return pad
}

export function buildPads(root) {
  const pads = FARM.pads.map((p) => makePad(root, { ...p }))
  return {
    pads,
    add(p) {
      const pad = makePad(root, { ...p, dynamic: true })
      pads.push(pad)
      return pad
    },
    update(dt, t) {
      for (const [k, p] of pads.entries()) {
        if (!p.disc.visible) continue
        p.disc.material.emissiveIntensity = 0.75 + Math.sin(t * 3 + k) * 0.25
        p.rings.forEach((r, i) => {
          const f = (t * 0.55 + i * 0.5 + k * 0.13) % 1
          r.position.y = 0.2 + f * 1.6
          r.scale.setScalar(1 - f * 0.18)
          r.material.opacity = (1 - f) * 0.55
        })
        p.label.position.y = 2.6 + Math.sin(t * 1.4 + k) * 0.08
      }
    },
  }
}
