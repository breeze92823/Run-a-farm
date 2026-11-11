import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial, Object3D, Color } from 'three'
import { solid } from './kit.js'

// Wooden rail fences, all drawn as a few instanced meshes: square posts with a
// bevelled cap and two (or three) rails between each pair. fence() queues a
// polyline; buildFences() turns the queue into meshes + colliders.

const STYLES = {
  wood: { post: '#9a5a2c', rail: '#bf7a3e', h: 1.25, rails: [0.48, 0.98], postW: 0.24, railW: 0.11, railH: 0.2, gap: 2.4 },
  white: { post: '#f1efe9', rail: '#ffffff', h: 1.3, rails: [0.45, 0.85, 1.2], postW: 0.2, railW: 0.08, railH: 0.16, gap: 3 },
  orange: { post: '#6e3218', rail: '#e2743a', h: 1.45, rails: [0.6, 1.15], postW: 0.28, railW: 0.13, railH: 0.26, gap: 2.8 },
  low: { post: '#8f5428', rail: '#b87538', h: 0.8, rails: [0.55], postW: 0.2, railW: 0.1, railH: 0.16, gap: 2.2 },
}
const queue = { wood: [], white: [], low: [], orange: [] }

// Polyline fence: points [[x, z], ...]; `solid` adds colliders. With `into` (a kit.js
// `gated` group) the fence is built right away into that group, so it stays hidden with
// its colliders off until that thing is bought; otherwise it joins the shared queue.
export function fence(points, style = 'wood', { collide = true, y = 0, into = null } = {}) {
  if (into) {
    const g = new Group()
    g.userData.noCompact = true
    into.add(g)
    buildStyle(g, style, [{ points, collide, y }])
  } else queue[style].push({ points, collide, y })
}

export function buildFences(root) {
  for (const [name, list] of Object.entries(queue)) {
    if (!list.length) continue
    buildStyle(root, name, list)
    list.length = 0
  }
}

function buildStyle(root, name, list) {
  const o = new Object3D()
  const S = STYLES[name]
  const posts = []
  const rails = []
  for (const { points, collide, y } of list) {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i]
      const [bx, bz] = points[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.max(1, Math.round(len / S.gap))
      const yaw = Math.atan2(-(bz - az), bx - ax)
      for (let k = 0; k <= n; k++) {
        if (k === 0 && i > 0) continue // shared corner post
        const t = k / n
        posts.push([ax + (bx - ax) * t, az + (bz - az) * t, y, (k * 7 + i * 3) % 5])
      }
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        rails.push([ax + (bx - ax) * t, az + (bz - az) * t, y, yaw, len / n])
      }
      if (collide) solid(len / 2, 0.8, 0.15, (ax + bx) / 2, y + 0.8, (az + bz) / 2, yaw)
    }
  }
  const postGeo = new BoxGeometry(S.postW, S.h, S.postW)
  postGeo.translate(0, S.h / 2, 0)
  const capGeo = new BoxGeometry(S.postW * 1.25, 0.08, S.postW * 1.25)
  capGeo.translate(0, S.h + 0.04, 0)
  const postMat = new MeshStandardMaterial({ color: S.post, roughness: 0.85 })
  const railMat = new MeshStandardMaterial({ color: S.rail, roughness: 0.8 })
  const postMesh = new InstancedMesh(postGeo, postMat, posts.length)
  const capMesh = new InstancedMesh(capGeo, postMat, posts.length)
  const c = new Color()
  posts.forEach(([x, z, y, v], i) => {
    o.position.set(x, y, z)
    o.rotation.set(0, v * 0.05, (v - 2) * 0.008) // a hand-built wobble
    o.scale.set(1, 0.97 + v * 0.015, 1)
    o.updateMatrix()
    postMesh.setMatrixAt(i, o.matrix)
    capMesh.setMatrixAt(i, o.matrix)
    postMesh.setColorAt(i, c.set('#ffffff').multiplyScalar(0.9 + v * 0.03))
  })
  const railGeo = new BoxGeometry(1, S.railH, S.railW)
  const railMesh = new InstancedMesh(railGeo, railMat, rails.length * S.rails.length)
  let r = 0
  for (const [x, z, y, yaw, len] of rails) {
    for (const ry of S.rails) {
      o.position.set(x, y + ry, z)
      o.rotation.set(0, yaw, ((r * 13) % 7 - 3) * 0.004)
      o.scale.set(len + S.postW * 0.6, 1, 1)
      o.updateMatrix()
      railMesh.setMatrixAt(r, o.matrix)
      railMesh.setColorAt(r, c.set('#ffffff').multiplyScalar(0.88 + ((r * 31) % 9) * 0.015))
      r++
    }
  }
  for (const m of [postMesh, capMesh, railMesh]) {
    m.castShadow = name !== 'white'
    m.receiveShadow = true
    root.add(m)
  }
}
