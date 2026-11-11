import { CanvasTexture, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { M } from './kit.js'
import { arc, compact, cy, extrude, lathe, rbox, sph, tube } from './detail.js'
import { mulberry32 } from '../textures.js'

// Detailed farm animals with jointed legs and real gaits (cow, pig, horse, duck, sheep, goat).
// Every quadruped: a textured rounded body that breathes; four legs, each a
// hip (or shoulder) joint, an upper segment, a knee / hock joint, a lower
// segment and a hoof; a neck and a head that nods, looks about and grazes; a
// jaw that chews; ears that flick; a tail of segments that swishes with lag.
// `gait(a, dt, t, speed)` drives it from its ground speed:
//  - walk: a 4-beat lateral sequence (LH, LF, RH, RF), head nodding with the stride
//  - trot: diagonal pairs with a little bounce (pigs, cows hurrying)
//  - canter: horses at speed, a 3-beat rocking gait
// Ducks waddle (body roll), flap now and then, and swim (paddling feet hidden).

const TAU = Math.PI * 2
const tex = (w, h, draw) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
// Holstein patches: random blobs, different for every cow.
function holstein(seed, base = '#f6f3ec', spot = '#1e1c1a', n = 7) {
  const r = mulberry32(seed)
  return new MeshStandardMaterial({
    roughness: 0.8,
    map: tex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = spot
      for (let i = 0; i < n; i++) {
        const x = r() * w
        const y = r() * h
        const s = 18 + r() * 34
        ctx.beginPath()
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * TAU
          const rr = s * (0.65 + r() * 0.5)
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8)
        }
        ctx.fill()
      }
    }),
  })
}
// A coat with soft shading and a darker back line.
function coat(base, dark, seed, mud = 0) {
  const r = mulberry32(seed)
  return new MeshStandardMaterial({
    roughness: 0.75,
    map: tex(128, 128, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, dark)
      gr.addColorStop(0.35, base)
      gr.addColorStop(1, base)
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(0,0,0,${r() * 0.05})`
        ctx.fillRect(r() * w, r() * h, 2, 4)
      }
      ctx.fillStyle = 'rgba(110,70,40,0.55)'
      for (let i = 0; i < mud; i++) {
        ctx.beginPath()
        ctx.ellipse(r() * w, h * 0.6 + r() * h * 0.4, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, TAU)
        ctx.fill()
      }
    }),
  })
}
const eye = (parent, x, y, z, s = 1) => {
  sph(parent, 0.05 * s, M('#f4f1e8', { roughness: 0.3 }), x, y, z, 1, 1, 0.7, 10)
  sph(parent, 0.032 * s, M('#141210', { roughness: 0.1 }), x + Math.sign(x) * 0.015 * s, y, z + 0.02 * s, 1, 1, 0.7, 8)
}

// --- A generic jointed quadruped -----------------------------------------------------------------------
function quadruped({ len, wid, hgt, hip, upper, lower, legW, bodyMat, legMat, hoof = '#2a2420', gaitKind = 'walk' }) {
  const g = new Group()
  g.userData.lod = 'small' // farm/lod.js: hidden far away, no shadow on Medium / Low
  const body = new Group()
  body.position.y = hip
  g.add(body)
  const torso = rbox(body, wid, hgt, len, Math.min(wid, hgt) * 0.42, bodyMat, 0, hgt * 0.35, 0, 4)
  torso.userData.keep = true // breathes (scaled)
  const legs = []
  // LF, RF, LH, RH (L = +X).
  for (const [sx, sz, hind] of [[1, 1, false], [-1, 1, false], [1, -1, true], [-1, -1, true]]) {
    const top = new Group()
    top.position.set(sx * (wid / 2 - legW * 0.6), 0.05, sz * (len / 2 - legW * 0.9))
    rbox(top, legW * 1.15, upper + 0.15, legW * 1.3, legW * 0.5, legMat, 0, -upper / 2 + 0.05, 0, 3)
    const knee = new Group()
    knee.position.y = -upper
    rbox(knee, legW * 0.85, lower, legW * 0.9, legW * 0.4, legMat, 0, -lower / 2, 0, 2)
    rbox(knee, legW * 1.0, 0.1, legW * 1.15, 0.03, M(hoof, { roughness: 0.6 }), 0, -lower + 0.03, 0.02, 2)
    top.add(knee)
    body.add(top)
    legs.push({ top, knee, hind, side: sx })
  }
  const neck = new Group()
  neck.position.set(0, hgt * 0.55, len / 2 - 0.05)
  body.add(neck)
  const tailRoot = new Group()
  tailRoot.position.set(0, hgt * 0.75, -len / 2)
  body.add(tailRoot)
  return { g, body, torso, legs, neck, tailRoot, hip, gaitKind, phase: Math.random(), ears: [], tail: [], baseY: hip }
}
// A tail as a chain of segments (each a child of the last) that swishes with lag.
function tailChain(root, n, segLen, r0, mat, tip) {
  const segs = []
  let parent = root
  for (let i = 0; i < n; i++) {
    const s = new Group()
    if (i > 0) s.position.y = -segLen
    const r = r0 * (1 - i / (n + 1))
    cy(s, r, r * 0.85, segLen, mat, 0, -segLen / 2, 0, 8)
    parent.add(s)
    segs.push(s)
    parent = s
  }
  if (tip) tip(parent, segLen)
  return segs
}

// --- Cow ------------------------------------------------------------------------------------------------
export function cow(i = 0) {
  const hide = holstein(1000 + i * 17)
  const leg = M('#f0ece2', { roughness: 0.8 })
  const black = M('#1e1c1a', { roughness: 0.7 })
  const pink = M('#f2b8b0', { roughness: 0.6 })
  const q = quadruped({ len: 2.3, wid: 0.95, hgt: 0.95, hip: 1.2, upper: 0.55, lower: 0.62, legW: 0.2, bodyMat: hide, legMat: leg })
  // Hips and shoulders, belly, udder with teats, brisket.
  rbox(q.body, 1.0, 0.5, 0.6, 0.22, hide, 0, 0.55, -0.85, 3)
  rbox(q.body, 0.8, 0.35, 1.4, 0.15, hide, 0, 0.0, 0.0, 3)
  sph(q.body, 0.22, pink, 0, -0.12, -0.6, 1.1, 0.8, 1)
  for (const [x, z] of [[-0.09, -0.52], [0.09, -0.52], [-0.09, -0.7], [0.09, -0.7]]) cy(q.body, 0.025, 0.02, 0.1, pink, x, -0.3, z, 6)
  // Neck, head with muzzle, nostrils, eyes, ears with tags, horns, forelock.
  rbox(q.neck, 0.5, 0.6, 0.6, 0.2, hide, 0, 0, 0.18, 3)
  rbox(q.neck, 0.35, 0.3, 0.5, 0.12, hide, 0, -0.32, 0.1, 2) // dewlap
  const head = new Group()
  head.position.set(0, 0.12, 0.45)
  q.neck.add(head)
  rbox(head, 0.48, 0.5, 0.6, 0.18, hide, 0, 0, 0.18, 3)
  rbox(head, 0.42, 0.3, 0.3, 0.12, pink, 0, -0.14, 0.52, 3)
  for (const s of [-1, 1]) {
    sph(head, 0.035, M('#5a2a2a'), s * 0.08, -0.12, 0.67, 1, 0.7, 0.5, 8)
    eye(head, s * 0.22, 0.08, 0.32)
    const ear = new Group()
    ear.position.set(s * 0.26, 0.15, 0.08)
    rbox(ear, 0.26, 0.08, 0.14, 0.04, i % 2 ? black : hide, s * 0.12, 0, 0, 2)
    rbox(ear, 0.06, 0.07, 0.03, 0.01, M('#f2c230'), s * 0.18, -0.06, 0.05, 1) // ear tag
    head.add(ear)
    q.ears.push({ g: ear, s, t: Math.random() * 5 })
    const horn = tube(head, [s * 0.17, 0.24, 0.1], [s * 0.28, 0.36, 0.14], 0.035, M('#efe2c4', { roughness: 0.4 }))
    void horn
    sph(head, 0.03, M('#efe2c4'), s * 0.29, 0.37, 0.15)
  }
  rbox(head, 0.2, 0.08, 0.12, 0.04, black, 0, 0.26, 0.22, 2) // forelock
  const jaw = new Group()
  jaw.position.set(0, -0.26, 0.4)
  rbox(jaw, 0.34, 0.1, 0.3, 0.05, pink, 0, 0, 0.05, 2)
  head.add(jaw)
  cy(head, 0.08, 0.1, 0.14, M('#d9a62a', { metalness: 0.7, roughness: 0.3 }), 0, -0.42, 0.05, 10) // cow bell
  q.head = head
  q.jaw = jaw
  q.tail = tailChain(q.tailRoot, 4, 0.22, 0.04, leg, (p, l) => sph(p, 0.08, black, 0, -l - 0.05, 0, 1, 1.6, 1))
  q.kind = 'cow'
  q.stride = 2.2
  shadows(q.g)
  return q
}

// --- Pig ------------------------------------------------------------------------------------------------
export function pig(i = 0) {
  const skin = coat('#f4a6b4', '#e98a9c', 2000 + i * 13, 6 + i * 2)
  const pinkDark = M('#e98a9c', { roughness: 0.6 })
  const q = quadruped({ len: 1.35, wid: 0.78, hgt: 0.72, hip: 0.5, upper: 0.22, lower: 0.28, legW: 0.13, bodyMat: skin, legMat: M('#f0a0b0', { roughness: 0.7 }), hoof: '#6a4a3a' })
  rbox(q.body, 0.82, 0.6, 0.5, 0.25, skin, 0, 0.32, -0.5, 3) // round rump
  rbox(q.body, 0.75, 0.55, 0.45, 0.24, skin, 0, 0.3, 0.45, 3) // shoulders
  q.neck.position.y -= 0.12
  const head = new Group()
  head.position.set(0, 0.0, 0.18)
  q.neck.add(head)
  rbox(head, 0.55, 0.5, 0.42, 0.2, skin, 0, 0, 0.1, 3)
  const snout = cy(head, 0.14, 0.16, 0.18, pinkDark, 0, -0.06, 0.38, 16, 'z')
  void snout
  cy(head, 0.14, 0.14, 0.02, M('#e47d92'), 0, -0.06, 0.47, 16, 'z')
  for (const s of [-1, 1]) {
    sph(head, 0.03, M('#7a3a48'), s * 0.05, -0.06, 0.48, 1, 1.3, 0.5, 8)
    eye(head, s * 0.17, 0.08, 0.27, 0.8)
    const ear = new Group()
    ear.position.set(s * 0.18, 0.22, 0.12)
    const e = extrude(ear, [[0, 0], [0.18, 0.02], [0.08, 0.2]], 0.03, pinkDark, 0, 0, 0, 0.01)
    e.rotation.set(0.9, s > 0 ? 0 : Math.PI, s * 0.3)
    head.add(ear)
    q.ears.push({ g: ear, s, t: Math.random() * 5 })
  }
  const jaw = new Group()
  jaw.position.set(0, -0.2, 0.22)
  rbox(jaw, 0.3, 0.08, 0.22, 0.04, pinkDark, 0, 0, 0.05, 2)
  head.add(jaw)
  q.head = head
  q.jaw = jaw
  // The curly tail: a spiral of short segments.
  const curl = new Group()
  q.tailRoot.add(curl)
  for (let k = 0; k < 10; k++) {
    const a = k * 0.75
    sph(curl, 0.03, pinkDark, Math.cos(a) * 0.06, 0.02 + k * 0.006, -0.03 - Math.sin(a) * 0.06, 1, 1, 1, 6)
  }
  q.tail = [curl]
  q.kind = 'pig'
  q.stride = 0.9
  q.gaitKind = 'trot'
  shadows(q.g)
  return q
}

// --- Horse -------------------------------------------------------------------------------------------------
const COATS = [['#8a5a32', '#6a4222', '#1e140c'], ['#3a2a20', '#241a14', '#0e0a08'], ['#d9c2a0', '#c4a880', '#f4ead8'], ['#b8b4ac', '#9a968e', '#4a4640'], ['#c27a3a', '#a2602a', '#f0e2c8'], ['#5a3a24', '#3e2818', '#e8e0d0']]
export function horse(i = 0) {
  const [base, dark, mane] = COATS[i % COATS.length]
  const hide = coat(base, dark, 3000 + i * 7)
  const maneM = M(mane, { roughness: 0.85 })
  const q = quadruped({ len: 2.15, wid: 0.72, hgt: 0.85, hip: 1.45, upper: 0.6, lower: 0.78, legW: 0.15, bodyMat: hide, legMat: hide })
  rbox(q.body, 0.75, 0.7, 0.6, 0.28, hide, 0, 0.45, -0.75, 3) // hindquarters
  rbox(q.body, 0.7, 0.75, 0.55, 0.26, hide, 0, 0.4, 0.75, 3) // chest
  // White socks on two legs and darker lower legs.
  q.legs.forEach((l, k) => {
    rbox(l.knee, 0.15, 0.25, 0.16, 0.05, k % 3 === 0 && i % 2 ? M('#f4ead8') : M(dark), 0, -0.62, 0, 2)
  })
  // Neck: two segments rising forward, with the mane along its crest.
  q.neck.position.y += 0.1
  const neck2 = new Group()
  q.neck.add(neck2)
  const n1 = rbox(neck2, 0.38, 0.95, 0.5, 0.18, hide, 0, 0.35, 0.18, 3)
  n1.rotation.x = 0.55
  const head = new Group()
  head.position.set(0, 0.8, 0.5)
  neck2.add(head)
  // Head: a side profile from poll to muzzle, extruded across.
  const prof = [[-0.12, 0.18], [0.12, 0.2], [0.42, 0.06], [0.68, -0.08], [0.74, -0.2], [0.7, -0.32], [0.5, -0.34], [0.2, -0.26], [-0.12, -0.18]]
  const hp = extrude(head, prof, 0.3, hide, 0, 0, 0, 0.04)
  hp.rotation.y = -Math.PI / 2
  rbox(head, 0.26, 0.2, 0.18, 0.06, M(dark), 0, -0.22, 0.66, 2) // muzzle
  rbox(head, 0.08, 0.3, 0.02, 0.01, M('#f4ead8'), 0, 0.02, 0.42, 1) // blaze
  for (const s of [-1, 1]) {
    eye(head, s * 0.17, 0.06, 0.12, 0.9)
    sph(head, 0.03, M('#1a1210'), s * 0.07, -0.24, 0.74, 1, 1.3, 0.6, 8)
    const ear = new Group()
    ear.position.set(s * 0.09, 0.2, -0.04)
    const e = extrude(ear, [[-0.05, 0], [0.05, 0], [0, 0.2]], 0.04, hide, 0, 0, 0, 0.01)
    void e
    head.add(ear)
    q.ears.push({ g: ear, s, t: Math.random() * 5 })
    // Bridle straps.
    tube(head, [s * 0.16, 0.1, 0.0], [s * 0.15, -0.2, 0.5], 0.015, M('#6e3a1e'))
  }
  tube(head, [-0.15, -0.12, 0.5], [0.15, -0.12, 0.5], 0.015, M('#6e3a1e'))
  const jaw = new Group()
  jaw.position.set(0, -0.32, 0.5)
  rbox(jaw, 0.2, 0.06, 0.25, 0.03, M(dark), 0, 0, 0.05, 2)
  head.add(jaw)
  // Mane plates along the crest and a forelock.
  const maneG = []
  for (let k = 0; k < 9; k++) {
    const m = rbox(neck2, 0.07, 0.22, 0.16, 0.03, maneM, 0, 0.0 + k * 0.1, 0.0 + k * 0.06 - 0.1, 2)
    m.position.set(0, 0.12 + k * 0.1, -0.12 + k * 0.065)
    m.rotation.x = 0.55
    maneG.push(m)
  }
  rbox(head, 0.1, 0.18, 0.06, 0.02, maneM, 0, 0.16, 0.08, 1)
  q.head = head
  q.jaw = jaw
  q.neck2 = neck2
  q.mane = maneG
  // Tail: a long hair tail of segments.
  q.tail = tailChain(q.tailRoot, 5, 0.22, 0.09, maneM, (p, l) => sph(p, 0.1, maneM, 0, -l - 0.05, 0, 1, 1.8, 1))
  // Saddle and saddle pad on the even ones.
  if (i % 2 === 0) {
    rbox(q.body, 0.8, 0.12, 0.7, 0.05, M('#6e3a1e', { roughness: 0.5 }), 0, 0.84, 0.15, 2)
    rbox(q.body, 0.85, 0.42, 0.62, 0.05, M('#c8302a'), 0, 0.62, 0.15, 2)
    for (const s of [-1, 1]) tube(q.body, [s * 0.4, 0.8, 0.15], [s * 0.42, 0.2, 0.15], 0.012, M('#2a2c30'))
    for (const s of [-1, 1]) rbox(q.body, 0.06, 0.08, 0.12, 0.02, M('#9aa0a6', { metalness: 0.7 }), s * 0.43, 0.15, 0.15, 1)
  }
  q.kind = 'horse'
  q.stride = 2.6
  shadows(q.g)
  return q
}

// --- Duck ---------------------------------------------------------------------------------------------------
export function duck(i = 0) {
  const g = new Group()
  g.userData.lod = 'small' // farm/lod.js: hidden far away, no shadow on Medium / Low
  const drake = i % 3 === 1
  const white = i % 3 === 0
  const bodyC = white ? '#f7f4ec' : drake ? '#c9c2b4' : '#8a6a48'
  const body = new Group()
  body.position.y = 0.22
  g.add(body)
  const b = lathe(body, [[0.001, -0.3], [0.12, -0.27], [0.17, -0.1], [0.17, 0.1], [0.1, 0.3], [0.001, 0.36]], M(bodyC, { roughness: 0.7 }), 0, 0.14, 0, 14)
  b.rotation.x = Math.PI / 2
  b.scale.set(1, 1, 0.75)
  const tail = rbox(body, 0.16, 0.06, 0.14, 0.03, M(white ? '#eeeae0' : drake ? '#2a2420' : '#7a5a38'), 0, 0.22, -0.32, 2)
  tail.rotation.x = -0.6
  const neck = new Group()
  neck.position.set(0, 0.24, 0.2)
  cy(neck, 0.055, 0.07, 0.18, M(white ? '#f7f4ec' : drake ? '#2f7a3a' : '#8a6a48'), 0, 0.08, 0, 10)
  const head = new Group()
  head.position.set(0, 0.2, 0.02)
  sph(head, 0.09, M(white ? '#f7f4ec' : drake ? '#2f7a3a' : '#8a6a48', { roughness: drake ? 0.25 : 0.7, metalness: drake ? 0.2 : 0 }), 0, 0, 0, 1, 1, 1.15, 12)
  rbox(head, 0.09, 0.03, 0.14, 0.015, M('#f2a02a'), 0, -0.02, 0.12, 2)
  for (const s of [-1, 1]) sph(head, 0.016, M('#141210'), s * 0.065, 0.025, 0.05, 1, 1, 1, 6)
  if (drake) cy(neck, 0.075, 0.075, 0.025, M('#ffffff'), 0, 0.02, 0, 10)
  neck.add(head)
  body.add(neck)
  const wings = []
  for (const s of [-1, 1]) {
    const w = new Group()
    w.position.set(s * 0.15, 0.2, 0.05)
    const wm = extrude(w, [[0, 0], [0.05, 0.12], [0, 0.3], [-0.04, 0.12]], 0.03, M(white ? '#eeeae0' : drake ? '#6a5a4a' : '#6e5232'), 0, 0, 0, 0.01)
    wm.rotation.set(Math.PI / 2, 0, Math.PI)
    if (drake) cy(w, 0.03, 0.03, 0.02, M('#3a5ad8', { metalness: 0.4, roughness: 0.3 }), s * 0.01, 0.01, -0.1, 6)
    body.add(w)
    wings.push({ g: w, s })
  }
  const legs = []
  for (const s of [-1, 1]) {
    const top = new Group()
    top.position.set(s * 0.07, 0.24, -0.02)
    cy(top, 0.018, 0.018, 0.2, M('#f2a02a'), 0, -0.1, 0, 6)
    const foot = extrude(top, [[0, 0], [0.07, 0.14], [-0.07, 0.14]], 0.015, M('#f2a02a'), 0, -0.21, 0, 0)
    foot.rotation.x = Math.PI / 2
    g.add(top)
    legs.push({ top, side: s })
  }
  shadows(g)
  return { g, body, neck, head, wings, legs, kind: 'duck', phase: Math.random(), ears: [], tail: [tail], stride: 0.35, baseY: 0.22 }
}

// --- Sheep ---------------------------------------------------------------------------------------------------
// A thin shorn body inside a fleece of icosahedron wool blobs (`q.wool`, one
// merged mesh per wool tone after compact); `setWool(q, k)` grows / shears it.
const blobGeos = new Map()
function blob(parent, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  let geo = blobGeos.get(r)
  if (!geo) blobGeos.set(r, (geo = new IcosahedronGeometry(r, 1)))
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
export function sheep(i = 0) {
  const r = mulberry32(4000 + i * 31)
  const black = i % 9 === 4 // the odd black sheep
  const skin = M(black ? '#4a403a' : '#e6d9c6', { roughness: 0.85 }) // shorn body
  const dark = M(black ? '#1a1614' : '#2a2422', { roughness: 0.7 })
  const woolA = M(black ? '#3a3330' : '#f6f2e8', { roughness: 1 })
  const woolB = M(black ? '#2e2826' : '#e9dec6', { roughness: 1 })
  const q = quadruped({ len: 0.9, wid: 0.44, hgt: 0.42, hip: 0.45, upper: 0.22, lower: 0.26, legW: 0.075, bodyMat: skin, legMat: dark, hoof: '#141210' })
  // The fleece: rows of blobs along the body, a collar and a rump.
  const wool = new Group()
  wool.position.set(0, 0.16, 0)
  q.body.add(wool)
  for (const z of [-0.33, -0.11, 0.11, 0.31]) {
    for (const x of [-0.15, 0, 0.15]) {
      const rr = 0.2 + r() * 0.05
      blob(wool, 0.22, r() < 0.5 ? woolA : woolB, x + (r() - 0.5) * 0.04, (x ? -0.02 : 0.07) + (r() - 0.5) * 0.04, z, rr / 0.22, rr / 0.22, rr / 0.22)
    }
  }
  blob(wool, 0.22, woolA, 0, 0.04, 0.42, 0.9, 0.95, 0.8) // collar
  blob(wool, 0.22, woolB, 0, -0.04, -0.44, 0.85, 0.85, 0.7) // rump
  for (const x of [-0.12, 0.12]) blob(wool, 0.22, woolA, x, -0.12, 0, 0.8, 0.7, 1.5) // belly
  // Neck (low, so the head reaches the grass), head with a woolly topknot.
  q.neck.position.y -= 0.08
  rbox(q.neck, 0.2, 0.22, 0.24, 0.08, skin, 0, 0, 0.08, 2)
  const head = new Group()
  head.position.set(0, 0.1, 0.2)
  head.rotation.x = 0.35
  q.neck.add(head)
  rbox(head, 0.19, 0.2, 0.26, 0.08, dark, 0, 0, 0.08, 2)
  rbox(head, 0.14, 0.14, 0.12, 0.05, dark, 0, -0.03, 0.22, 2) // muzzle
  blob(head, 0.22, woolA, 0, 0.1, 0.02, 0.5, 0.4, 0.5) // topknot
  for (const s of [-1, 1]) {
    eye(head, s * 0.09, 0.03, 0.1, 0.55)
    sph(head, 0.015, M('#0e0c0a'), s * 0.03, -0.03, 0.28, 1, 1, 0.5, 6)
    const ear = new Group()
    ear.position.set(s * 0.09, 0.05, 0.0)
    rbox(ear, 0.14, 0.04, 0.07, 0.02, dark, s * 0.07, 0, 0, 1)
    head.add(ear)
    q.ears.push({ g: ear, s, t: Math.random() * 5 })
  }
  const jaw = new Group()
  jaw.position.set(0, -0.1, 0.18)
  rbox(jaw, 0.11, 0.04, 0.12, 0.02, dark, 0, 0, 0.03, 1)
  head.add(jaw)
  q.head = head
  q.jaw = jaw
  // A short woolly tail just behind the fleece.
  q.tailRoot.position.set(0, 0.28, -0.6)
  q.tail = tailChain(q.tailRoot, 2, 0.08, 0.04, woolB, (p, l) => blob(p, 0.22, woolB, 0, -l, 0, 0.3, 0.35, 0.3))
  q.wool = wool
  q.woolK = 1
  q.kind = 'sheep'
  q.stride = 0.75
  q.grazeDown = 1.35
  q.wag = 2
  shadows(q.g)
  return q
}
// k = 1: full fleece, k = 0: freshly shorn (blobs shrink to 0.55, the thin body shows).
// Independent of gait(); call it whenever the wool changes.
export function setWool(q, k) {
  k = Math.max(0, Math.min(1, k))
  q.woolK = k
  q.wool?.scale.setScalar(0.55 + 0.45 * k)
}

// --- Goat ----------------------------------------------------------------------------------------------------
const GOAT_COATS = [
  ['#f2eee4', '#d6cdbb', '#ece6da'], // white
  ['#9a6438', '#6a4022', '#5a3820'], // brown
  ['#f4f0e8', '#1c1a18', '#2a2624'], // black and white (patched)
]
export function goat(i = 0) {
  const v = i % 3
  const [base, dark, legC] = GOAT_COATS[v]
  const hide = v === 2 ? holstein(5000 + i * 11, base, dark, 9) : coat(base, dark, 5000 + i * 11)
  const legM = M(legC, { roughness: 0.8 })
  const horn = M('#b8a888', { roughness: 0.5 })
  const q = quadruped({ len: 0.95, wid: 0.38, hgt: 0.4, hip: 0.5, upper: 0.25, lower: 0.28, legW: 0.07, bodyMat: hide, legMat: legM, hoof: '#2a2420' })
  rbox(q.body, 0.4, 0.38, 0.32, 0.15, hide, 0, 0.17, -0.3, 2) // hindquarters
  rbox(q.body, 0.36, 0.42, 0.3, 0.15, hide, 0, 0.15, 0.32, 2) // chest
  // Neck rising forward, a red collar with a bell.
  q.neck.position.set(0, 0.22, 0.38)
  const n = rbox(q.neck, 0.16, 0.36, 0.18, 0.07, hide, 0, 0.1, 0.05, 2)
  n.rotation.x = 0.45
  const collar = rbox(q.neck, 0.19, 0.05, 0.21, 0.02, M('#c8302a'), 0, 0.02, 0.0, 1)
  collar.rotation.x = 0.45
  sph(q.neck, 0.035, M('#d9a62a', { metalness: 0.7, roughness: 0.3 }), 0, -0.05, 0.12, 1, 1, 1, 8)
  const head = new Group()
  head.position.set(0, 0.27, 0.16)
  head.rotation.x = 0.55
  q.neck.add(head)
  rbox(head, 0.17, 0.18, 0.22, 0.07, hide, 0, 0, 0.02, 2) // skull
  rbox(head, 0.12, 0.12, 0.2, 0.05, v === 2 ? legM : hide, 0, -0.03, 0.18, 2) // long muzzle
  extrude(head, [[-0.03, 0], [0.03, 0], [0.005, -0.16]], 0.04, M(v === 1 ? '#3a2616' : v === 2 ? '#1c1a18' : '#d8d0c0', { roughness: 0.95 }), 0, -0.08, 0.2, 0.008) // beard
  for (const s of [-1, 1]) {
    eye(head, s * 0.085, 0.03, 0.06, 0.55)
    sph(head, 0.012, M('#1a1210'), s * 0.03, -0.03, 0.28, 1, 1, 0.5, 6)
    // Curved horns sweeping up and back (segments thinning to a point).
    const pts = [[s * 0.045, 0.08, -0.02], [s * 0.06, 0.18, -0.07], [s * 0.08, 0.23, -0.15], [s * 0.095, 0.22, -0.24]]
    const rad = [0.026, 0.02, 0.013]
    for (let k = 0; k < 3; k++) {
      tube(head, pts[k], pts[k + 1], rad[k], horn, 6)
      sph(head, rad[k], horn, ...pts[k + 1], 1, 1, 1, 6)
    }
    // Ears held out sideways.
    const ear = new Group()
    ear.position.set(s * 0.08, 0.03, -0.04)
    rbox(ear, 0.15, 0.035, 0.07, 0.015, hide, s * 0.07, 0, 0, 1)
    head.add(ear)
    q.ears.push({ g: ear, s, t: Math.random() * 5 })
  }
  const jaw = new Group()
  jaw.position.set(0, -0.09, 0.16)
  rbox(jaw, 0.1, 0.035, 0.14, 0.015, hide, 0, 0, 0.03, 1)
  head.add(jaw)
  q.head = head
  q.jaw = jaw
  // A short tail held upright, flicking.
  const up = new Group()
  up.rotation.x = Math.PI - 0.45
  q.tailRoot.position.set(0, 0.32, -0.48)
  q.tailRoot.add(up)
  q.tail = tailChain(up, 2, 0.06, 0.025, v === 2 ? legM : hide)
  q.kind = 'goat'
  q.stride = 0.8
  q.grazeDown = 1.3
  q.wag = 2.6
  shadows(q.g)
  return q
}

function shadows(g) {
  compact(g)
  g.traverse((o) => {
    if (o.isMesh) {
      // Eyes, nostrils, tags and bolts are too small to cast a shadow worth a draw call.
      o.geometry.computeBoundingSphere()
      o.castShadow = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) > 0.12
      o.receiveShadow = true
    }
  })
}

// --- Gaits ----------------------------------------------------------------------------------------------------
const OFFSETS = {
  walk: [0.25, 0.75, 0.0, 0.5], // LF, RF, LH, RH: lateral sequence
  trot: [0.0, 0.5, 0.5, 0.0], // diagonal pairs
  canter: [0.55, 0.85, 0.0, 0.3], // 3-beat: RH, LH+RF, LF
}
// Drives an animal's pose. state: { speed (m/s), graze (0..1), swim (0..1), flap (0..1) }.
// Returns the legs that touched down this frame (for dust).
export function gait(q, dt, t, { speed = 0, graze = 0, swim = 0, flap = 0, run = false } = {}) {
  const steps = []
  if (q.kind === 'duck') {
    // Waddle: feet alternate, the body rolls side to side; paddle when swimming.
    const f = speed > 0.05 ? (speed / q.stride) * 1.0 : 0
    const before = q.phase
    q.phase = (q.phase + f * dt) % 1
    const s = Math.sin(q.phase * TAU)
    q.legs[0].top.rotation.x = s * 0.6 * Math.min(1, speed * 3)
    q.legs[1].top.rotation.x = -s * 0.6 * Math.min(1, speed * 3)
    for (const l of q.legs) l.top.visible = swim < 0.5
    q.body.rotation.z = s * 0.15 * Math.min(1, speed * 3) * (1 - swim)
    q.body.position.y = q.baseY - swim * 0.2 + Math.abs(s) * 0.02 * (1 - swim)
    q.neck.rotation.x = graze * 0.9 + Math.sin(t * 1.3 + q.phase * 5) * 0.08 + (speed > 0.05 ? Math.sin(q.phase * TAU * 2) * 0.12 : 0)
    q.head.rotation.y = Math.sin(t * 0.7 + q.phase * 9) * 0.4
    for (const w of q.wings) w.g.rotation.z = -w.s * flap * (0.4 + Math.sin(t * 28) * 0.9)
    if (Math.floor(before * 2) !== Math.floor(q.phase * 2) && speed > 0.1) steps.push(0)
    return steps
  }
  const kind = q.kind === 'horse' && run ? 'canter' : q.gaitKind === 'trot' || (run && q.kind !== 'horse') ? 'trot' : 'walk'
  const offs = OFFSETS[kind]
  const freq = speed > 0.05 ? speed / q.stride : 0
  const before = q.phase
  q.phase = (q.phase + freq * dt) % 1
  const amp = Math.min(1, speed / 1.2) * (kind === 'canter' ? 0.75 : kind === 'trot' ? 0.6 : 0.45)
  q.legs.forEach((l, k) => {
    const p = (q.phase + offs[k]) % 1
    const stance = kind === 'walk' ? 0.62 : 0.5
    let hip
    let bend
    if (p < stance) {
      const u = p / stance
      hip = (-1 + 2 * u) * amp // foot sweeps back under the body
      bend = 0
    } else {
      const u = (p - stance) / (1 - stance)
      hip = (1 - 2 * u) * amp // swings forward
      bend = Math.sin(u * Math.PI) * (0.4 + amp)
    }
    l.top.rotation.x = hip
    // Front knees fold backward, hind hocks forward.
    l.knee.rotation.x = l.hind ? -bend * 0.8 : bend * 1.1
    const pb = (before + offs[k]) % 1
    if (amp > 0.1 && pb > stance && p < stance && p < 0.1) steps.push(k)
  })
  // Body: bounce, canter rocking, breathing.
  const cyc = q.phase * TAU
  const bounce = kind === 'trot' ? Math.abs(Math.sin(cyc * 2)) * 0.06 * amp : kind === 'canter' ? Math.max(0, Math.sin(cyc)) * 0.14 * amp : Math.abs(Math.sin(cyc * 2)) * 0.02 * amp
  q.body.position.y = q.baseY + bounce
  q.body.rotation.x = kind === 'canter' ? Math.sin(cyc) * 0.12 * amp : 0
  const breath = 1 + Math.sin(t * 2.2 + q.baseY * 9) * 0.012
  q.torso.scale.set(breath, breath, 1)
  // Neck and head: graze low, nod with the walk, glance about.
  const nod = speed > 0.05 ? Math.sin(cyc * 2) * (kind === 'walk' ? 0.08 : 0.04) : 0
  const look = Math.sin(t * 0.5 + q.baseY * 13) * 0.35 * (1 - graze)
  const down = graze * (q.grazeDown ?? (q.kind === 'horse' ? 1.3 : 0.95)) - (kind === 'canter' ? 0.25 : 0)
  q.neck.rotation.x += (down + nod - q.neck.rotation.x) * Math.min(1, dt * 4)
  q.neck.rotation.y += (look - q.neck.rotation.y) * Math.min(1, dt * 2)
  if (q.jaw) q.jaw.rotation.x = graze > 0.5 ? Math.max(0, Math.sin(t * 7)) * 0.25 : 0
  // Ears flick now and then; the tail swishes (with lag down the chain).
  for (const e of q.ears) {
    e.t -= dt
    if (e.t <= 0) e.t = 2 + Math.random() * 6
    const flick = e.t < 0.25 ? Math.sin((e.t / 0.25) * Math.PI) * 0.8 : 0
    e.g.rotation.z = e.s * (0.2 + flick)
    e.g.rotation.x = q.kind === 'horse' && kind === 'canter' ? -0.4 : 0
  }
  const swish = Math.sin(t * 2.6 + q.baseY * 5) * (0.35 + (Math.sin(t * 0.37 + q.baseY) > 0.6 ? 0.6 : 0))
  q.tail.forEach((s, k) => {
    s.rotation.z = Math.sin(t * 2.6 * (q.wag ?? 1) - k * 0.6 + q.baseY * 5) * 0.25 * (k + 1) * (swish > 0 ? 1 : 0.6)
    s.rotation.x = (q.kind === 'horse' ? 0.35 + (kind === 'canter' ? 0.5 : 0) : 0.08) / (k + 1)
  })
  if (q.mane) q.mane.forEach((m, k) => (m.rotation.z = Math.sin(t * 5 + k) * 0.08 * (kind === 'canter' ? 3 : 1)))
  return steps
}
export { arc }
