import { Vector3 } from 'three'
import { AUTO_RES, CULL } from './config.js'

// Frame-rate helpers for main.js:
//  - createCuller: the draw distance. Meshes that would look tiny (or are past the preset's far
//    limit) move off layer 0, which the camera renders, so they skip both the main and the shadow
//    pass while anything that switches their `visible` keeps working. Spread over several frames.
//  - createAutoRes: lowers the pixel ratio while the game lags, raises it again once it keeps up.
//  - warmUp: compiles every material (also of buildings not bought yet) and uploads every shown
//    mesh and texture during the loading screen, so turning toward a new area does not hitch.

const c = new Vector3()

export function createCuller(scene, camera) {
  let cfg = CULL.High
  let list = [] // { o, sphere, hidden }
  const entries = new Map() // object -> entry
  let cursor = 0
  let rescanIn = 0

  function sphereOf(o) {
    if (o.isInstancedMesh) {
      if (!o.boundingSphere) o.computeBoundingSphere()
      return o.boundingSphere
    }
    const g = o.geometry
    if (!g) return null
    if (!g.boundingSphere) g.computeBoundingSphere()
    return g.boundingSphere
  }

  function walk(o, out) {
    if (o.userData.noCull) return
    if ((o.isMesh || o.isSprite) && !o.isSkinnedMesh && o.frustumCulled !== false) {
      let e = entries.get(o)
      if (!e) {
        const sphere = sphereOf(o)
        if (sphere && Number.isFinite(sphere.radius)) e = { o, sphere, hidden: false }
      }
      if (e) out.push(e)
    }
    for (const k of o.children) walk(k, out)
  }

  function rescan() {
    const next = []
    walk(scene, next)
    const keep = new Set(next)
    // Anything that left the scene (pooled vehicles, rebuilt farms) comes back drawable.
    for (const e of list) if (!keep.has(e) && e.hidden) show(e)
    entries.clear()
    for (const e of next) entries.set(e.o, e)
    list = next
    cursor = 0
  }

  function show(e) {
    e.hidden = false
    e.o.layers.enable(0)
  }

  function check(e, cx, cy, cz) {
    const o = e.o
    c.copy(e.sphere.center).applyMatrix4(o.matrixWorld)
    const r = e.sphere.radius * (o.isSprite ? Math.max(o.scale.x, o.scale.y) : o.matrixWorld.getMaxScaleOnAxis())
    const d = Math.hypot(c.x - cx, c.y - cy, c.z - cz) - r
    const limit = Math.min(cfg.far, Math.max(cfg.near, r / cfg.angle))
    const hide = d > limit
    if (hide === e.hidden) return
    e.hidden = hide
    if (hide) o.layers.disable(0)
    else o.layers.enable(0)
  }

  return {
    get count() {
      return list.length
    },
    get hidden() {
      let n = 0
      for (const e of list) if (e.hidden) n++
      return n
    },
    // preset: a graphicsPreset() result; its name picks the CULL row (by shadow map size otherwise).
    configure(preset) {
      cfg = CULL[preset?.name] ?? (preset?.shadowMap >= 4096 ? CULL.Ultra : preset?.shadowMap >= 2048 ? CULL.High : preset?.shadows ? CULL.Medium : CULL.Low)
      cursor = 0
    },
    // Show everything again (warm-up renders, debugging).
    showAll() {
      for (const e of list) if (e.hidden) show(e)
    },
    update(dt) {
      rescanIn -= dt
      if (rescanIn <= 0) {
        rescanIn = CULL.rescan
        rescan()
      }
      if (!list.length) return
      // One sweep per CULL.pass seconds, a slice each frame.
      const n = Math.min(list.length, Math.ceil(list.length * Math.min(1, dt / CULL.pass)))
      const { x, y, z } = camera.position
      for (let i = 0; i < n; i++) {
        if (cursor >= list.length) cursor = 0
        check(list[cursor++], x, y, z)
      }
    },
    // A jump (teleport, respawn, overview start): sweep everything now.
    sweep() {
      const { x, y, z } = camera.position
      for (const e of list) check(e, x, y, z)
    },
  }
}

export function createAutoRes(renderer, onChange) {
  let max = 1
  let min = 1
  let cur = 1
  let acc = 0
  let frames = 0
  let lowFor = 0
  let highFor = 0

  function apply() {
    renderer.setPixelRatio(cur)
    onChange?.(cur)
  }
  function reset() {
    acc = 0
    frames = 0
    lowFor = 0
    highFor = 0
  }

  return {
    get pixelRatio() {
      return cur
    },
    configure(preset) {
      max = Math.min(window.devicePixelRatio || 1, preset.dpr)
      min = Math.min(max, Math.max(AUTO_RES.minDpr, max * AUTO_RES.minScale))
      cur = max
      reset()
      apply()
    },
    // The device pixel ratio changed (window moved to another screen, browser zoom).
    refresh(preset) {
      const nextMax = Math.min(window.devicePixelRatio || 1, preset.dpr)
      if (nextMax === max) return
      this.configure(preset)
    },
    // Real (unclamped) seconds since the last frame; paused = don't judge this frame.
    sample(realDt, paused = false) {
      if (paused || realDt > 0.25 || realDt <= 0) {
        reset() // a hitch, a tab switch, or a window open: start judging afresh
        return
      }
      acc += realDt
      frames++
      if (acc < 0.5) return
      const fps = frames / acc
      const span = acc
      acc = 0
      frames = 0
      if (fps < AUTO_RES.lowFps) {
        lowFor += span
        highFor = 0
      } else if (fps >= AUTO_RES.highFps) {
        highFor += span
        lowFor = 0
      } else {
        lowFor = 0
        highFor = 0
      }
      if (lowFor >= AUTO_RES.lowFor && cur > min) {
        cur = Math.max(min, +(cur - AUTO_RES.step).toFixed(2))
        reset()
        apply()
      } else if (highFor >= AUTO_RES.highFor && cur < max) {
        cur = Math.min(max, +(cur + AUTO_RES.step).toFixed(2))
        reset()
        apply()
      }
    },
  }
}

const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap', 'lightMap', 'specularMap', 'displacementMap']

// Run once before the first frame, behind the loading screen.
export function warmUp(renderer, scene, camera, postfx) {
  // 1) Textures to the GPU (canvas signs, ground painters, ...).
  const textures = new Set()
  const materials = new Set()
  scene.traverse((o) => {
    const m = o.material
    if (!m) return
    for (const mat of Array.isArray(m) ? m : [m]) materials.add(mat)
  })
  for (const mat of materials) for (const k of TEX_KEYS) if (mat[k]?.isTexture && mat[k].image) textures.add(mat[k])
  for (const t of textures) {
    try {
      renderer.initTexture(t)
    } catch {
      // A texture whose image is not ready yet uploads on first use as before.
    }
  }
  // 2) Shader programs for everything, hidden buildings included, built for the target the scene
  //    really draws into (the bloom buffer on High / Ultra, else the screen).
  const prev = renderer.getRenderTarget()
  try {
    renderer.setRenderTarget(postfx.sceneTarget ?? null)
    renderer.compile(scene, camera)
  } catch {
    // Compiling ahead is only an optimisation.
  } finally {
    renderer.setRenderTarget(prev)
  }
  // 3) One full draw with frustum culling off, so every shown mesh's buffers are uploaded now.
  const culled = []
  scene.traverse((o) => {
    if ((o.isMesh || o.isSprite || o.isPoints) && o.frustumCulled) {
      o.frustumCulled = false
      culled.push(o)
    }
  })
  try {
    postfx.render()
  } finally {
    for (const o of culled) o.frustumCulled = true
  }
}
