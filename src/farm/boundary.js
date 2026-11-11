import { Group } from 'three'
import { M, block, box, solidCyl } from './kit.js'
import { fence } from './fence.js'

// A farm's boundary: one closed loop of fence in a single style, with a stout corner post at
// every corner and a gateway at every opening: two tall capped gate posts and, on a gateway up to
// GATE_LEAVES m wide, a pair of farm gates (rails, stiles, a diagonal brace) swung open into the
// farm; a wider opening (a shop front, a yard) gets lantern posts instead. Used for the player's
// own farm (world coordinates, farm/scenery.js) and every farm around the town (farm/remote.js,
// in the slot's own frame).
//
// corners: the loop's corners [[x, z], ...] (closed automatically).
// gates:   per side (corner i -> i + 1), the openings as [from, to] distances along that side.
// opts:    style (fence.js), into (build into this group now instead of the shared queue: needed
//          for anything rebuilt at run time), collide (fence and post colliders, world coords only),
//          posts (called with (x, z, r) for each gate / corner post when collide is off).
const GATE_LEAVES = 12

export function boundary(g, corners, gates, { style = 'wood', into = null, collide = true, posts = null } = {}) {
  const n = corners.length
  const cx = corners.reduce((s, c) => s + c[0], 0) / n
  const cz = corners.reduce((s, c) => s + c[1], 0) / n
  const postMat = M('#6e4122', { roughness: 0.85 })
  const capMat = M('#4a2a14', { roughness: 0.8 })
  const solidPost = (x, z, r) => (collide ? solidCyl(r, 2, x, z) : posts?.(x, z, r))
  const bigPost = (x, z, h = 1.8, w = 0.42) => {
    block(g, w, h, w, postMat, x, 0, z)
    block(g, w + 0.14, 0.12, w + 0.14, capMat, x, h, z)
    block(g, w * 0.5, 0.18, w * 0.5, capMat, x, h + 0.12, z)
  }
  for (let i = 0; i < n; i++) {
    const [ax, az] = corners[i]
    const [bx, bz] = corners[(i + 1) % n]
    const len = Math.hypot(bx - ax, bz - az)
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    // Inward normal (toward the loop's middle).
    let nx = -dz
    let nz = dx
    if ((cx - ax) * nx + (cz - az) * nz < 0) {
      nx = -nx
      nz = -nz
    }
    const at = (t) => [ax + dx * t, az + dz * t]
    // Fence runs between the openings.
    const open = [...(gates[i] ?? [])].map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(len, Math.max(a, b))]).sort((p, q) => p[0] - q[0])
    let t = 0
    for (const [a, b] of open) {
      if (a - t > 0.3) fence([at(t), at(a)], style, { into, collide })
      t = Math.max(t, b)
    }
    if (len - t > 0.3) fence([at(t), at(len)], style, { into, collide })
    // Corner post.
    bigPost(ax, az, 1.6, 0.36)
    solidPost(ax, az, 0.25)
    // Gateways.
    for (const [a, b] of open) {
      const w = b - a
      const [px, pz] = at(a)
      const [qx, qz] = at(b)
      if (w > GATE_LEAVES) {
        for (const [x, z] of [[px, pz], [qx, qz]]) {
          bigPost(x, z, 2.4, 0.46)
          block(g, 0.3, 0.42, 0.3, M('#25262b', { roughness: 0.4, metalness: 0.5 }), x, 2.66, z)
          block(g, 0.2, 0.3, 0.2, M('#ffe2a0', { emissive: '#ffcf7a', emissiveIntensity: 1.2 }), x, 2.72, z, 0, false)
          solidPost(x, z, 0.3)
        }
        continue
      }
      for (const [x, z, sx, sz] of [[px, pz, dx, dz], [qx, qz, -dx, -dz]]) {
        bigPost(x, z, 2.0, 0.46)
        solidPost(x, z, 0.3)
        // The gate leaf, hinged on this post, swung ~80 degrees open into the farm.
        const a80 = (80 * Math.PI) / 180
        const vx = sx * Math.cos(a80) + nx * Math.sin(a80)
        const vz = sz * Math.cos(a80) + nz * Math.sin(a80)
        leaf(g, x + vx * 0.25, z + vz * 0.25, Math.atan2(-vz, vx), w / 2 - 0.35)
      }
    }
  }
}

// A five-bar style farm gate leaf of length `len` from its hinge at (x, z), along yaw.
function leaf(g, x, z, yaw, len) {
  const l = new Group()
  l.position.set(x, 0, z)
  l.rotation.y = yaw
  const wood = M('#c8955a', { roughness: 0.85 })
  for (const y of [0.35, 0.75, 1.15]) box(l, len, 0.12, 0.08, wood, len / 2, y, 0)
  for (const s of [0.06, len / 2, len - 0.06]) box(l, 0.12, 1.0, 0.09, wood, s, 0.75, 0)
  const brace = box(l, Math.hypot(len - 0.1, 0.8), 0.1, 0.07, wood, len / 2, 0.75, 0)
  brace.rotation.z = Math.atan2(0.8, len - 0.1)
  box(l, 0.1, 0.22, 0.14, M('#3a3d42', { metalness: 0.6, roughness: 0.4 }), 0.02, 1.0, 0)
  box(l, 0.1, 0.22, 0.14, M('#3a3d42', { metalness: 0.6, roughness: 0.4 }), 0.02, 0.45, 0)
  g.add(l)
}
