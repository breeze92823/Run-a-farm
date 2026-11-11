import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
} from 'three'
import { paintSoftDot } from '../textures.js'
import { wind } from './kit.js'

// Ambient effects: autumn leaves drifting down around the player, golden
// pollen motes over the wheat, soft puffs (truck exhaust, the locomotive's
// smoke, dust kicked up by footsteps on dirt) and fireflies after dark.

const dotTex = new CanvasTexture(paintSoftDot(64))

// --- Soft puffs: one Points cloud with per-particle size, alpha and colour ---------------------
function puffSystem(root, max, { additive = false } = {}) {
  const pos = new Float32Array(max * 3)
  const size = new Float32Array(max)
  const alpha = new Float32Array(max)
  const col = new Float32Array(max * 3)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('size', new BufferAttribute(size, 1))
  geo.setAttribute('alpha', new BufferAttribute(alpha, 1))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const mat = new ShaderMaterial({
    uniforms: { map: { value: dotTex }, scale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      attribute vec3 color;
      uniform float scale;
      varying float vA;
      varying vec3 vC;
      void main() {
        vA = alpha;
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying float vA;
      varying vec3 vC;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vC, t.a * vA);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  })
  const pts = new Points(geo, mat)
  pts.frustumCulled = false
  root.add(pts)
  const list = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, a: 0, r: 1, g: 1, b: 1, gy: 0, drag: 0.8, wind: 0.8, floor: -99 }))
  let next = 0
  const c = new Color()
  return {
    mat,
    emit(x, y, z, o) {
      const p = list[next]
      next = (next + 1) % max
      p.life = p.max = o.life
      p.x = x
      p.y = y
      p.z = z
      p.vx = o.vx ?? 0
      p.vy = o.vy ?? 0
      p.vz = o.vz ?? 0
      p.s0 = o.s0
      p.s1 = o.s1
      p.a = o.a
      p.gy = o.gravity ?? 0
      p.drag = o.drag ?? 0.8
      p.wind = o.wind ?? 0.8
      p.floor = o.floor ?? -99
      c.set(o.color ?? '#ffffff')
      p.r = c.r
      p.g = c.g
      p.b = c.b
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const p = list[i]
        if (p.life > 0) {
          p.life -= dt
          p.x += (p.vx + wind.dirX * wind.strength * p.wind) * dt
          p.vy += p.gy * dt
          p.y += p.vy * dt
          if (p.y < p.floor) {
            p.y = p.floor
            p.vy *= -0.35
            p.vx *= 0.6
            p.vz *= 0.6
          }
          p.z += (p.vz + wind.dirZ * wind.strength * p.wind) * dt
          p.vx *= 1 - dt * p.drag
          p.vz *= 1 - dt * p.drag
        }
        const k = p.life > 0 ? 1 - p.life / p.max : 1
        pos[i * 3] = p.x
        pos[i * 3 + 1] = p.y
        pos[i * 3 + 2] = p.z
        size[i] = p.life > 0 ? p.s0 + (p.s1 - p.s0) * k : 0
        alpha[i] = p.life > 0 ? p.a * Math.min(1, k * 6) * (1 - k) : 0
        col[i * 3] = p.r
        col[i * 3 + 1] = p.g
        col[i * 3 + 2] = p.b
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.size.needsUpdate = true
      geo.attributes.alpha.needsUpdate = true
      geo.attributes.color.needsUpdate = true
    },
  }
}

// --- Falling leaves --------------------------------------------------------------------------------
const LEAF = ['#e8732a', '#d9462a', '#f2a530', '#c9561f', '#f4c542', '#b83a26']
function leaves(root, count) {
  const geo = new PlaneGeometry(0.22, 0.16)
  const mat = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.85 })
  const mesh = new InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  mesh.castShadow = false
  const list = []
  const c = new Color()
  for (let i = 0; i < count; i++) {
    list.push({ x: 0, y: -1, z: 0, ph: Math.random() * 10, spin: 1 + Math.random() * 2, fall: 0.6 + Math.random() * 0.7, rest: 0 })
    mesh.setColorAt(i, c.set(LEAF[i % LEAF.length]))
  }
  root.add(mesh)
  const o = new Object3D()
  return {
    update(dt, t, focus) {
      for (let i = 0; i < count; i++) {
        const l = list[i]
        if (l.y < -0.5 || Math.abs(l.x - focus.x) > 45 || Math.abs(l.z - focus.z) > 45) {
          l.x = focus.x + (Math.random() - 0.5) * 70
          l.z = focus.z + (Math.random() - 0.5) * 70
          l.y = 2 + Math.random() * 8
          l.rest = 0
        }
        if (l.y <= 0.05) {
          // Settled: lie on the ground a while, then recycle.
          l.rest += dt
          if (l.rest > 6) l.y = -1
        } else {
          const sway = Math.sin(t * l.spin + l.ph)
          l.x += (wind.dirX * wind.strength * 2.2 + sway * 0.6) * dt
          l.z += (wind.dirZ * wind.strength * 2.2 + Math.cos(t * l.spin * 0.7 + l.ph) * 0.4) * dt
          l.y -= l.fall * (0.75 + Math.abs(sway) * 0.5) * dt
          if (l.y < 0.05) l.y = 0.05
        }
        const flat = l.y <= 0.05
        o.position.set(l.x, l.y, l.z)
        o.rotation.set(flat ? -Math.PI / 2 : Math.sin(t * l.spin + l.ph) * 1.2, t * l.spin * 0.6 + l.ph, flat ? 0 : Math.cos(t * l.spin * 1.3 + l.ph) * 0.9)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}

// --- Drifting motes (pollen by day, fireflies by night) --------------------------------------------
function motes(root, count, rect, { color, size, ymin, ymax, additive = true }) {
  const pos = new Float32Array(count * 3)
  const seed = []
  for (let i = 0; i < count; i++) {
    seed.push({ x: rect.minX + Math.random() * (rect.maxX - rect.minX), z: rect.minZ + Math.random() * (rect.maxZ - rect.minZ), y: ymin + Math.random() * (ymax - ymin), ph: Math.random() * 20 })
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  const alpha = new Float32Array(count)
  geo.setAttribute('alpha', new BufferAttribute(alpha, 1))
  const mat = new ShaderMaterial({
    uniforms: { map: { value: dotTex }, color: { value: new Color(color) }, size: { value: size }, level: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float alpha;
      uniform float size;
      varying float vA;
      void main() {
        vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 300.0 / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      uniform float level;
      varying float vA;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(color, t.a * vA * level);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  })
  const pts = new Points(geo, mat)
  pts.frustumCulled = false
  root.add(pts)
  return {
    mat,
    pts,
    update(t, blinkRate = 0) {
      for (let i = 0; i < count; i++) {
        const s = seed[i]
        pos[i * 3] = s.x + Math.sin(t * 0.3 + s.ph) * 1.5 + wind.strength * Math.sin(t * 0.1 + s.ph) * 2
        pos[i * 3 + 1] = s.y + Math.sin(t * 0.5 + s.ph * 2) * 0.6
        pos[i * 3 + 2] = s.z + Math.cos(t * 0.27 + s.ph) * 1.5
        alpha[i] = blinkRate ? Math.max(0, Math.sin(t * blinkRate + s.ph * 3)) ** 3 : 0.55 + 0.45 * Math.sin(t * 1.3 + s.ph)
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.alpha.needsUpdate = true
    },
  }
}

export function createParticles(root, { field, exhaust, chimney = null, density = 1 }) {
  const puffs = puffSystem(root, 260)
  const sparks = puffSystem(root, 420, { additive: true }) // sparkles, glints, coin flashes
  const bits = puffSystem(root, 420) // confetti, eggs, crumbs, oil drops
  const rnd = (a, b) => a + Math.random() * (b - a)
  const fall = leaves(root, Math.round(110 * density))
  const pollen = motes(root, Math.round(160 * density), field, { color: '#ffe7a0', size: 0.11, ymin: 0.6, ymax: 3.2 })
  const flies = motes(root, Math.round(120 * density), { minX: -110, maxX: 70, minZ: -236, maxZ: 30 }, { color: '#d8ff6a', size: 0.16, ymin: 0.4, ymax: 2.8 })
  let exhaustT = 0
  let chimneyT = 0
  let trainT = 0
  return {
    // A dust puff where a foot lands on dirt / sand / gravel.
    dust(x, z, color = '#c9a57a', n = 2) {
      for (let i = 0; i < n; i++) puffs.emit(x + (Math.random() - 0.5) * 0.3, 0.1, z + (Math.random() - 0.5) * 0.3, { life: 0.7 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.8, vy: 0.35, vz: (Math.random() - 0.5) * 0.8, s0: 0.25, s1: 0.9, a: 0.35, color })
    },
    // A burst of particles thrown up and falling back (gravity), bouncing off the ground.
    burst(x, y, z, { n = 16, colors = ['#ffe36a'], speed = 3, up = 4, gravity = -9, life = 1.1, size = 0.22, additive = true, spread = 0.3, grow = 0.4, a = 0.95 } = {}) {
      const sys = additive ? sparks : bits
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2
        const v = speed * (0.35 + Math.random() * 0.65)
        sys.emit(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread, {
          life: life * (0.6 + Math.random() * 0.6),
          vx: Math.cos(ang) * v,
          vy: up * (0.5 + Math.random() * 0.7),
          vz: Math.sin(ang) * v,
          s0: size,
          s1: size * grow,
          a,
          color: colors[i % colors.length],
          gravity,
          drag: 0.6,
          wind: 0.1,
          floor: 0.08,
        })
      }
    },
    // Party confetti (a purchase, a sale).
    confetti(x, y, z, n = 40) {
      this.burst(x, y, z, { n, colors: ['#ff4a5a', '#ffd23a', '#4ef06a', '#3aa8ff', '#c46aff', '#ffffff'], speed: 6, up: 9, gravity: -11, life: 2.2, size: 0.32, additive: false, grow: 0.8 })
      this.burst(x, y + 0.5, z, { n: Math.round(n / 2), colors: ['#fff6c0', '#ffe36a'], speed: 4, up: 6, gravity: -4, life: 1.2, size: 0.5, grow: 0.1 })
    },
    // Golden coin flashes over a sale.
    coins(x, y, z, n = 10) {
      this.burst(x, y, z, { n, colors: ['#ffd23a', '#ffb800', '#fff3a0'], speed: 2.2, up: 6, gravity: -12, life: 1.1, size: 0.42, additive: false, grow: 0.9, spread: 0.6 })
      this.burst(x, y + 0.4, z, { n: n * 2, colors: ['#fff6c0'], speed: 3, up: 3, gravity: -2, life: 0.7, size: 0.28, grow: 0.1 })
    },
    // A ring of dust rolling out over the ground (a building rising, a landing).
    ring(x, z, r = 4, color = '#c9a57a', n = 36) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        puffs.emit(x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r, { life: 1.4 + Math.random() * 0.6, vx: Math.cos(a) * rnd(2, 4), vy: rnd(0.3, 1.2), vz: Math.sin(a) * rnd(2, 4), s0: 0.6, s1: 2.6, a: 0.42, color })
      }
    },
    // A soft puff (smoke, steam) at any height.
    puff(x, y, z, { color = '#d8d6d2', size = 0.6, grow = 3, life = 2, vy = 0.8, a = 0.3, vx = 0, vz = 0 } = {}) {
      puffs.emit(x, y, z, { life, vx: vx + (Math.random() - 0.5) * 0.3, vy, vz: vz + (Math.random() - 0.5) * 0.3, s0: size, s1: size * grow, a, color })
    },
    update(dt, t, focus, { night = 0, train = null } = {}) {
      // Truck exhaust: small grey puffs from the tailpipe, a few a second.
      exhaustT -= dt
      if (exhaustT <= 0 && exhaust && (exhaust.enabled?.() ?? true)) {
        exhaustT = 0.14 + Math.random() * 0.1
        puffs.emit(exhaust.x, exhaust.y, exhaust.z, { life: 2.2, vx: 0.6 + Math.random() * 0.4, vy: 0.45, vz: -0.3 + Math.random() * 0.2, s0: 0.25, s1: 1.6, a: 0.28, color: '#8d8f94' })
      }
      // Cottage chimney: slow pale wisps.
      chimneyT -= dt
      if (chimneyT <= 0 && chimney) {
        chimneyT = 0.45 + Math.random() * 0.3
        puffs.emit(chimney.x, chimney.y, chimney.z, { life: 5, vx: 0.2, vy: 0.7, vz: (Math.random() - 0.5) * 0.2, s0: 0.5, s1: 3.2, a: 0.22, color: '#d8d6d2' })
      }
      // The locomotive's stacks.
      if (train?.active) {
        trainT -= dt
        if (trainT <= 0) {
          trainT = 0.06
          puffs.emit(train.headX - 8.75 - 3 + (Math.random() < 0.5 ? -1.5 : 1.5), 5.0, train.z, { life: 3, vx: -train.speed * 0.25, vy: 1.6, vz: (Math.random() - 0.5) * 0.4, s0: 0.8, s1: 4.5, a: 0.3, color: '#6d6f74' })
        }
      }
      puffs.update(dt)
      sparks.update(dt)
      bits.update(dt)
      fall.update(dt, t, focus)
      pollen.update(t)
      pollen.mat.uniforms.level.value = 1 - night * 0.8
      flies.pts.visible = night > 0.05
      if (flies.pts.visible) {
        flies.update(t, 1.7)
        flies.mat.uniforms.level.value = night * 2.2
      }
    },
  }
}
