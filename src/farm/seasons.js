import { BufferAttribute, BufferGeometry, CircleGeometry, Color, LineBasicMaterial, LineSegments, Mesh, MeshPhysicalMaterial } from 'three'
import { FARM } from '../config.js'
import * as game from '../game.js'
import { clock } from '../econ/clock.js'
import { wind } from './kit.js'

// What the weather and the seasons look like (econ/clock.js decides them):
//  - tree crowns repaint per season (autumn's own colours, spring blossom,
//    summer green)
//  - rain streaks around the camera, puddles on the dirt that fill while it
//    rains and dry up after, stronger wind gusts
// Lightning flashes are lighting.js (clock.js triggers them); thunder is audio.

// Season palettes for the crowns (autumn keeps the woods' own colours).
const PALETTE = {
  spring: ['#f7c6d9', '#f4a6c4', '#fbe3ee', '#ffffff', '#a8dc78', '#f29bbd'],
  summer: ['#4f9a3a', '#5fae46', '#3f8a34', '#7cc25a', '#6aa83e'],
}

export function buildSeasons(root, { scenery, particles }) {
  // --- Crowns -------------------------------------------------------------------------------------------
  const crowns = scenery.crowns
  const targets = {}
  if (crowns) {
    const c = new Color()
    for (const k in PALETTE) {
      const arr = new Float32Array(crowns.count * 3)
      for (let i = 0; i < crowns.count; i++) {
        // The same blob keeps the same pick (by a hash of its index), tinted a little.
        const pal = PALETTE[k]
        c.set(pal[(i * 2654435761) % pal.length]).offsetHSL(0, 0, (((i * 40503) % 100) / 100 - 0.5) * 0.08)
        arr[i * 3] = c.r
        arr[i * 3 + 1] = c.g
        arr[i * 3 + 2] = c.b
      }
      targets[k] = arr
    }
    targets.autumn = crowns.autumn
  }
  let crownFrom = null
  let crownTo = null
  let crownT = 1
  let painted = 'autumn'
  function paintCrowns(season, instant = false) {
    if (!crowns || season === painted) return
    painted = season
    crownFrom = new Float32Array(crowns.blobs.instanceColor.array.slice(0, crowns.count * 3))
    crownTo = targets[season]
    crownT = instant ? 1 : 0
    if (instant) {
      crowns.blobs.instanceColor.array.set(crownTo)
      crowns.blobs.instanceColor.needsUpdate = true
    }
  }

  // --- Rain ------------------------------------------------------------------------------------------
  const N = Math.round(1400 * Math.max(0.4, particles?.density ?? 1))
  const BOX = { w: 70, h: 34 }
  const rainPos = new Float32Array(N * 6)
  const drops = new Float32Array(N * 3) // x, y, z of each streak head (relative to the box centre)
  for (let i = 0; i < N; i++) {
    drops[i * 3] = (Math.random() - 0.5) * BOX.w
    drops[i * 3 + 1] = Math.random() * BOX.h
    drops[i * 3 + 2] = (Math.random() - 0.5) * BOX.w
  }
  const rainGeo = new BufferGeometry()
  rainGeo.setAttribute('position', new BufferAttribute(rainPos, 3))
  const rainMat = new LineBasicMaterial({ color: '#c8d8ec', transparent: true, opacity: 0, depthWrite: false })
  const rain = new LineSegments(rainGeo, rainMat)
  rain.frustumCulled = false
  root.add(rain)

  // --- Puddles on the dirt ----------------------------------------------------------------------------------------
  const puddleMat = new MeshPhysicalMaterial({ color: '#3a4652', roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false })
  const spots = [
    [FARM.yardArch.x - 4, FARM.yardArch.z - 4, 1.6], [-30, 8, 2.2], [-46, 12, 1.4], [-60, -15, 1.8], [-100, -15, 2.4], [-62, -40, 1.6],
    [30, -10, 2.6], [44, 4, 1.8], [52, -30, 2], [10, -40, 1.5], [-20, -105, 3], [40, -108, 2.6], [90, -104, 2.4], [-80, -110, 3],
    [-10, 70, 2.4], [30, 70, 2], [70, 72, 2.6], [110, 70, 2.2], [-98, 14, 1.4], [-83, -140, 1.8], [33, -141, 1.6],
  ]
  const puddles = spots.map(([x, z, r]) => {
    const m = new Mesh(new CircleGeometry(1, 20), puddleMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.045, z)
    m.scale.set(r * 1.3, r, 1)
    m.rotation.z = (x * 13 + z) % 3
    m.visible = false
    root.add(m)
    return m
  })
  let wet = 0

  // Apply to the season we load into.
  game.on('season', (s) => paintCrowns(s))
  return {
    update(dt, t, focus) {
      // Wind: the clock's wind adds gusts on top of the base signal (read by wheat, leaves, sound).
      wind.strength = Math.min(1.6, wind.strength + clock.wind * (0.5 + 0.3 * Math.sin(t * 0.9)))
      // Crown colours glide to the season's palette.
      if (crowns && crownT < 1) {
        crownT = Math.min(1, crownT + dt / 8)
        const a = crowns.blobs.instanceColor.array
        for (let i = 0; i < crowns.count * 3; i++) a[i] = crownFrom[i] + (crownTo[i] - crownFrom[i]) * crownT
        crowns.blobs.instanceColor.needsUpdate = true
      }
      // Rain around the camera.
      const k = clock.rain
      rain.visible = k > 0.02
      if (rain.visible) {
        const fall = 26
        const drift = 3 * (0.4 + wind.strength)
        const len = 0.9 + clock.storm * 0.5
        const cx = focus.x
        const cz = focus.z
        for (let i = 0; i < N; i++) {
          let y = drops[i * 3 + 1] - fall * dt * (0.8 + (i % 7) * 0.05)
          let x = drops[i * 3] + drift * dt * wind.dirX
          let z = drops[i * 3 + 2] + drift * dt * wind.dirZ
          if (y < 0) y += BOX.h
          if (x > BOX.w / 2) x -= BOX.w
          if (x < -BOX.w / 2) x += BOX.w
          if (z > BOX.w / 2) z -= BOX.w
          if (z < -BOX.w / 2) z += BOX.w
          drops[i * 3] = x
          drops[i * 3 + 1] = y
          drops[i * 3 + 2] = z
          const j = i * 6
          rainPos[j] = cx + x
          rainPos[j + 1] = y
          rainPos[j + 2] = cz + z
          rainPos[j + 3] = cx + x - wind.dirX * 0.15
          rainPos[j + 4] = y + len
          rainPos[j + 5] = cz + z - wind.dirZ * 0.15
        }
        rainGeo.attributes.position.needsUpdate = true
        rainMat.opacity = Math.min(0.55, k * 0.6)
      }
      // Puddles fill while it rains and dry up slowly afterwards.
      const raining = k > 0.3
      wet = Math.max(0, Math.min(1, wet + (raining ? dt / 25 : -dt / 90)))
      const show = wet > 0.02
      puddleMat.opacity = wet * 0.75
      for (const p of puddles) p.visible = show
      if (raining && particles && Math.random() < dt * 6) {
        const p = puddles[Math.floor(Math.random() * puddles.length)]
        if (Math.hypot(p.position.x - focus.x, p.position.z - focus.z) < 40) particles.puff(p.position.x + (Math.random() - 0.5) * p.scale.x, 0.08, p.position.z + (Math.random() - 0.5) * p.scale.y, { color: '#d8e6f2', size: 0.15, grow: 3, life: 0.5, vy: 0, a: 0.4 })
      }
    },
    setSeason(s) {
      paintCrowns(s, true)
    },
  }
}
