import { Vector3 } from 'three'
import { GAME, SMALL_SHADOWS } from '../config.js'

// Phone performance (roadmap 1.2). Groups tagged `userData.lod` ('small':
// animals, people; 'big': vehicles, pump jacks) stop drawing beyond
// GAME.lod.far m from the camera ('big' ones a bit further). Their meshes move
// to layer 1, which the camera does not render, so whatever else switches the
// group's `visible` keeps working. On the Low and Medium presets the small
// ones cast no shadows either.

const v = new Vector3()
export function buildLod(root, preset) {
  const low = (preset?.shadowMap ?? 2048) <= 512
  const far = low ? GAME.lod.farLow : GAME.lod.far
  const entries = []
  root.traverse((o) => {
    if (!o.userData.lod) return
    const meshes = []
    o.traverse((m) => m.isMesh && meshes.push(m))
    entries.push({ o, meshes, r: o.userData.lod === 'big' ? far * 1.6 : far, hidden: false })
  })
  // Small moving parts: no shadows on the lighter presets.
  const name = Object.keys(SMALL_SHADOWS).find((k) => preset && k === preset.name) ?? (preset?.shadowMap >= 2048 ? 'High' : 'Medium')
  if (!SMALL_SHADOWS[name]) for (const e of entries) if (e.r === far) for (const m of e.meshes) m.castShadow = false
  let t = 0
  return {
    count: entries.length,
    update(dt, focus, camera) {
      t -= dt
      if (t > 0) return
      t = 0.25
      const cx = camera?.position.x ?? focus.x
      const cz = camera?.position.z ?? focus.z
      for (const e of entries) {
        e.o.getWorldPosition(v)
        const hide = Math.hypot(v.x - cx, v.z - cz) > e.r
        if (hide === e.hidden) continue
        e.hidden = hide
        for (const m of e.meshes) m.layers.set(hide ? 1 : 0)
      }
    },
  }
}
