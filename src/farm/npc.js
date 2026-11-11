import { CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { M, box, cyl } from './kit.js'

// Blocky farm folk: customers, farm hands and passers-by. Each one is a little
// rig (legs, torso, arms pivoting at the shoulders, head) that either idles in
// place (breathing, glancing around, shifting weight) or walks a looped path
// with a proper limb swing, pausing at each stop.

let faceMat = null
function face() {
  if (faceMat) return faceMat
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1d1d1f'
  ctx.beginPath()
  ctx.ellipse(22, 26, 3.5, 5.5, 0, 0, Math.PI * 2)
  ctx.ellipse(42, 26, 3.5, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1d1d1f'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(32, 36, 10, 0.25 * Math.PI, 0.75 * Math.PI)
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  faceMat = new MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false })
  return faceMat
}

// opts: shirt, pants, skin, hat ('straw' | 'cap' | 'beanie' | null), hatColor, hair, item ('basket' | 'tray' | 'box' | null), apron
export function makeNPC(opts = {}) {
  const skin = M(opts.skin ?? '#f2c79a')
  const shirt = opts.shirtMat ?? M(opts.shirt ?? '#3f7fd8')
  const pants = M(opts.pants ?? '#2c3e66')
  const shoe = M('#3a2a20')
  const g = new Group()
  g.userData.lod = 'small' // farm/lod.js
  const legL = new Group()
  const legR = new Group()
  legL.position.set(-0.2, 0.86, 0)
  legR.position.set(0.2, 0.86, 0)
  box(legL, 0.38, 0.78, 0.4, pants, 0, -0.4, 0)
  box(legL, 0.4, 0.12, 0.46, shoe, 0, -0.8, 0.03)
  box(legR, 0.38, 0.78, 0.4, pants, 0, -0.4, 0)
  box(legR, 0.4, 0.12, 0.46, shoe, 0, -0.8, 0.03)
  const body = new Group() // everything above the hips (bobs and twists)
  body.position.y = 0.86
  const torso = box(body, 0.84, 0.8, 0.42, shirt, 0, 0.4, 0)
  if (opts.apron) box(body, 0.7, 0.9, 0.04, M(opts.apron), 0, 0.3, 0.23)
  if (opts.overalls) {
    box(body, 0.74, 0.45, 0.44, M(opts.overalls), 0, 0.22, 0)
    box(body, 0.12, 0.42, 0.44, M(opts.overalls), -0.22, 0.6, 0)
    box(body, 0.12, 0.42, 0.44, M(opts.overalls), 0.22, 0.6, 0)
  }
  const armL = new Group()
  const armR = new Group()
  armL.position.set(-0.56, 0.74, 0)
  armR.position.set(0.56, 0.74, 0)
  box(armL, 0.28, 0.5, 0.34, shirt, 0, -0.2, 0)
  box(armL, 0.26, 0.32, 0.32, skin, 0, -0.6, 0)
  box(armR, 0.28, 0.5, 0.34, shirt, 0, -0.2, 0)
  box(armR, 0.26, 0.32, 0.32, skin, 0, -0.6, 0)
  const head = new Group()
  head.position.y = 0.8
  box(head, 0.56, 0.56, 0.52, skin, 0, 0.32, 0)
  const f = box(head, 0.5, 0.5, 0.01, face(), 0, 0.32, 0.265, 0, false)
  f.renderOrder = 2
  if (opts.hair) {
    box(head, 0.6, 0.18, 0.56, M(opts.hair), 0, 0.62, -0.01)
    box(head, 0.6, 0.38, 0.12, M(opts.hair), 0, 0.42, -0.24)
  }
  if (opts.hat === 'straw') {
    const straw = M(opts.hatColor ?? '#e9c46a', { roughness: 0.9 })
    cyl(head, 0.62, 0.66, 0.06, straw, 0, 0.62, 0, 14)
    cyl(head, 0.32, 0.36, 0.26, straw, 0, 0.76, 0, 12)
    cyl(head, 0.365, 0.365, 0.07, M('#b5462f'), 0, 0.68, 0, 12)
  } else if (opts.hat === 'cap') {
    const cap = M(opts.hatColor ?? '#d1342f')
    box(head, 0.6, 0.18, 0.56, cap, 0, 0.66, 0)
    box(head, 0.5, 0.05, 0.3, cap, 0, 0.58, 0.38)
  } else if (opts.hat === 'beanie') {
    const b = M(opts.hatColor ?? '#2f8a57')
    box(head, 0.6, 0.24, 0.56, b, 0, 0.66, 0)
    box(head, 0.62, 0.08, 0.58, M('#ffffff'), 0, 0.55, 0)
  }
  body.add(armL, armR, head)
  // Held item, in the right hand.
  if (opts.item === 'basket') {
    const basket = new Group()
    basket.position.set(0, -0.82, 0.18)
    cyl(basket, 0.24, 0.18, 0.24, M('#b07a3e', { roughness: 0.9 }), 0, 0, 0, 10)
    for (let i = 0; i < 4; i++) cyl(basket, 0.06, 0.06, 0.1, M('#fbf3e2'), (i % 2 - 0.5) * 0.18, 0.13, (Math.floor(i / 2) - 0.5) * 0.14, 8).scale.set(1, 1.3, 1)
    box(basket, 0.04, 0.3, 0.04, M('#8a5a2b'), 0, 0.25, 0)
    armR.add(basket)
  } else if (opts.item === 'tray') {
    armL.rotation.x = armR.rotation.x = -1.1
    const tray = new Group()
    tray.position.set(0.56, 0.5, 0.55)
    box(tray, 0.8, 0.08, 0.5, M('#d8c49a'), 0, 0, 0)
    for (let i = 0; i < 6; i++) cyl(tray, 0.07, 0.07, 0.1, M('#fff7e6'), (i % 3 - 1) * 0.22, 0.09, (Math.floor(i / 3) - 0.5) * 0.2, 8).scale.set(1, 1.3, 1)
    body.add(tray)
  } else if (opts.item === 'box') {
    armL.rotation.x = armR.rotation.x = -1.2
    const crate = box(body, 0.8, 0.5, 0.55, M('#c79a5c'), 0, 0.45, 0.6)
    crate.rotation.x = 0
  }
  g.add(legL, legR, body)
  g.scale.setScalar(opts.scale ?? 0.84) // about the player's height
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  const holds = opts.item === 'tray' || opts.item === 'box'
  return { group: g, legL, legR, armL, armR, body, head, holds, phase: Math.random() * 10 }
}

// Idle animation in place.
export function idle(n, t, dt, look = 0.6) {
  const p = t + n.phase
  n.body.position.y = 0.86 + Math.sin(p * 1.6) * 0.012
  n.head.rotation.y = Math.sin(p * 0.37) * look + Math.sin(p * 0.91) * 0.1
  n.head.rotation.x = Math.sin(p * 0.5) * 0.06
  if (!n.holds) {
    n.armL.rotation.x = Math.sin(p * 1.6) * 0.04
    n.armR.rotation.x = -Math.sin(p * 1.6 + 0.4) * 0.04
    n.armL.rotation.z = -0.05
    n.armR.rotation.z = 0.05
  }
  n.legL.rotation.x = n.legR.rotation.x = 0
  n.body.rotation.z = Math.sin(p * 0.3) * 0.02 // weight shift
  void dt
}

// Walk cycle at phase w.
function stride(n, w, amount) {
  const s = Math.sin(w)
  n.legL.rotation.x = s * 0.6 * amount
  n.legR.rotation.x = -s * 0.6 * amount
  if (!n.holds) {
    n.armL.rotation.x = -s * 0.55 * amount
    n.armR.rotation.x = s * 0.55 * amount
  }
  n.body.position.y = 0.86 + Math.abs(Math.cos(w)) * 0.05 * amount
  n.body.rotation.y = s * 0.06 * amount
  n.head.rotation.y = -s * 0.04 * amount
}

// A walker loops through `path` ([x, z] points), pausing `pause` s at each one.
export function makeWalker(n, path, { speed = 1.5, pause = 2, y = 0, pingPong = false } = {}) {
  const pts = pingPong ? [...path, ...path.slice(1, -1).reverse()] : path
  const w = { n, pts, i: 0, speed, pause, wait: Math.random() * pause, y, walk: 0, amount: 0 }
  n.group.position.set(pts[0][0], y, pts[0][1])
  return w
}

export function updateWalker(w, t, dt) {
  const n = w.n
  const g = n.group
  if (w.wait > 0) {
    w.wait -= dt
    w.amount = Math.max(0, w.amount - dt * 4)
    if (w.amount > 0) stride(n, w.walk, w.amount)
    else idle(n, t, dt, 0.8)
    return
  }
  const [tx, tz] = w.pts[(w.i + 1) % w.pts.length]
  const dx = tx - g.position.x
  const dz = tz - g.position.z
  const d = Math.hypot(dx, dz)
  if (d < 0.1) {
    w.i = (w.i + 1) % w.pts.length
    w.wait = w.pause * (0.6 + Math.random() * 0.8)
    return
  }
  const step = Math.min(d, w.speed * dt)
  g.position.x += (dx / d) * step
  g.position.z += (dz / d) * step
  const yaw = Math.atan2(dx, dz)
  let diff = yaw - g.rotation.y
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  g.rotation.y += diff * Math.min(1, dt * 8)
  w.amount = Math.min(1, w.amount + dt * 4)
  w.walk += step * 2.4
  stride(n, w.walk, w.amount)
}
