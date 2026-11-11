import {
  BoxGeometry,
  BufferAttribute,
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FARM } from '../config.js'
import { mulberry32 } from '../textures.js'
import { M, bakeInto, block, box, cyl, signCanvas, signMaterial, signPanel, solid, wind, gated } from './kit.js'
import { fence } from './fence.js'
import { paintPlaid, paintSoil, tex, paintBurlap, paintHay } from './textures.js'

// The crop field: raised soil ridges running north-south, a block of ripe
// golden wheat that sways in the shared wind (gust waves roll across it with a
// lighter sheen on the crests), rows of fresh sprouts, two scarecrows, FIELD
// signs, irrigation taps, a wheelbarrow of hay and low fences.

const F = FARM.field

// Uniforms shared by every swaying plant material.
export const swayUniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } }

export function addSway(mat, { bend = 0.22, sheen = 0.25 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = swayUniforms.uTime
    shader.uniforms.uWind = swayUniforms.uWind
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWind;
         varying float vCrest;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
         // A gust wave rolling west -> east, plus a quicker per-plant flutter.
         float wave = sin(root.x * 0.16 - root.z * 0.05 - uTime * 1.7) * 0.5 + 0.5;
         float flutter = sin(uTime * 3.1 + root.x * 1.7 + root.z * 2.3) * 0.18;
         float h = max(position.y, 0.0);
         float lean = (0.25 + wave * 0.9 * uWind + flutter) * uWind;
         transformed.x += lean * h * h * ${bend.toFixed(3)};
         transformed.y -= abs(lean) * h * h * ${(bend * 0.25).toFixed(3)};
         transformed.z += flutter * h * h * 0.04;
         vCrest = wave * uWind * smoothstep(0.4, 1.3, h);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCrest;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= 1.0 + vCrest * ${sheen.toFixed(3)};`)
  }
  mat.customProgramCacheKey = () => `sway${bend}${sheen}`
}

// Vertex-coloured box part.
export function part(w, h, d, x, y, z, color, rz = 0, rx = 0, ry = 0) {
  const g = new BoxGeometry(w, h, d)
  g.translate(0, h / 2, 0)
  const m = new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz))
  g.applyMatrix4(m)
  g.translate(x, y, z)
  const c = new Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  const pos = g.attributes.position
  for (let i = 0; i < n; i++) {
    // Darker toward the ground (fake occlusion), brighter at the top.
    const k = 0.55 + Math.min(1, pos.getY(i) / 1.2) * 0.55
    arr[i * 3] = c.r * k
    arr[i * 3 + 1] = c.g * k
    arr[i * 3 + 2] = c.b * k
  }
  g.setAttribute('color', new BufferAttribute(arr, 3))
  return g
}

// A clump of wheat: 6 stalks with grain heads and a few drooping leaves.
function wheatClump(rand) {
  const parts = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand()
    const r = 0.08 + rand() * 0.16
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = 1.05 + rand() * 0.35
    const tilt = (rand() - 0.5) * 0.25
    parts.push(part(0.035, h, 0.035, x, 0, z, '#cfa94e', tilt, (rand() - 0.5) * 0.2))
    const hx = x - Math.sin(tilt) * h
    parts.push(part(0.085, 0.3, 0.085, hx, h - 0.04, z, '#f1c75a', tilt * 1.4))
    parts.push(part(0.012, 0.18, 0.012, hx, h + 0.24, z, '#f7dc8a', tilt * 2)) // awns
    if (i % 2 === 0) parts.push(part(0.09, 0.03, 0.4, x, 0.35 + rand() * 0.3, z, '#b8a046', 0, 0.6, a))
  }
  return mergeGeometries(parts)
}

function sproutClump() {
  return mergeGeometries([
    part(0.03, 0.22, 0.03, 0, 0, 0, '#5aa83a'),
    part(0.14, 0.02, 0.06, 0.05, 0.2, 0, '#6cc04a', 0.5),
    part(0.14, 0.02, 0.06, -0.05, 0.18, 0, '#6cc04a', -0.5),
    part(0.06, 0.02, 0.13, 0, 0.24, 0.04, '#7fd25a', 0, -0.5),
  ])
}

function scarecrow(root, x, z, ry) {
  const g = new Group()
  const post = M('#7b4a26')
  const plaid = new MeshStandardMaterial({ map: tex(paintPlaid('#3a6fc0', '#1d2b45'), 1, 1), roughness: 0.9 })
  const burlap = new MeshStandardMaterial({ map: tex(paintBurlap(), 1, 1), roughness: 1 })
  const straw = new MeshStandardMaterial({ map: tex(paintHay(128), 1, 1), roughness: 1 })
  block(g, 0.14, 2.6, 0.14, post, 0, 0, 0)
  box(g, 2.0, 0.12, 0.12, post, 0, 1.85, 0)
  // Shirt and sleeves, straw poking out of the cuffs and collar.
  block(g, 0.8, 0.8, 0.42, plaid, 0, 1.25, 0)
  box(g, 1.7, 0.3, 0.34, plaid, 0, 1.86, 0)
  for (const s of [-1, 1]) {
    const tuft = box(g, 0.18, 0.26, 0.26, straw, s * 0.95, 1.83, 0)
    tuft.rotation.z = s * 0.4
  }
  // Overall straps and pants.
  block(g, 0.82, 0.5, 0.44, M('#3c5b8e'), 0, 0.85, 0)
  for (const s of [-0.22, 0.22]) block(g, 0.3, 0.6, 0.34, M('#3c5b8e'), s, 0.3, 0)
  for (const s of [-0.22, 0.22]) block(g, 0.32, 0.12, 0.36, straw, s, 0.2, 0)
  // Sack head with a stitched face, straw hat.
  const head = block(g, 0.6, 0.6, 0.55, burlap, 0, 2.05, 0)
  void head
  const face = signCanvas(128, 128, { bg: null, lines: [{ text: 'x  x', size: 40, color: '#3a2a1a' }, { text: '~~~', size: 34, color: '#3a2a1a' }] })
  signPanel(g, 0.5, 0.5, signMaterial(face, { transparent: true }), 0, 2.36, 0.28)
  cyl(g, 0.62, 0.66, 0.06, M('#e9c46a', { roughness: 1 }), 0, 2.68, 0, 14)
  cyl(g, 0.3, 0.34, 0.3, M('#e9c46a', { roughness: 1 }), 0, 2.85, 0, 12)
  cyl(g, 0.345, 0.345, 0.07, M('#b5462f'), 0, 2.74, 0, 12)
  g.position.set(x, 0, z)
  g.rotation.y = ry
  root.add(g)
  solid(0.2, 1.3, 0.2, x, 1.3, z)
  return g
}

function fieldSign(g, x, z, text) {
  block(g, 0.12, 1.1, 0.12, M('#7b4a26'), x, 0, z)
  const p = signCanvas(256, 110, { bg: '#b07a42', plank: 2, border: '#6e4122', borderWidth: 8, radius: 8, lines: [{ text, size: 56, color: '#fff3d6', stroke: '#5a3018', strokeWidth: 8 }] })
  box(g, 0.9, 0.42, 0.06, M('#b07a42'), x, 1.15, z)
  signPanel(g, 0.88, 0.4, signMaterial(p), x, 1.15, z + 0.035)
}

function wheelbarrow(g, x, z, ry) {
  const w = new Group()
  w.position.set(x, 0, z)
  w.rotation.y = ry
  const green = M('#3f8a4a', { roughness: 0.5 })
  const trayBase = block(w, 0.9, 0.08, 1.1, green, 0, 0.45, 0)
  void trayBase
  for (const s of [-1, 1]) {
    const side = block(w, 0.06, 0.4, 1.1, green, s * 0.47, 0.48, 0)
    side.rotation.z = s * 0.2
  }
  block(w, 0.9, 0.4, 0.06, green, 0, 0.48, 0.55)
  block(w, 0.9, 0.4, 0.06, green, 0, 0.48, -0.55)
  const hay = block(w, 0.85, 0.35, 1.0, new MeshStandardMaterial({ map: tex(paintHay(128), 1, 1) }), 0, 0.6, 0)
  hay.scale.y = 1
  const wheel = cyl(w, 0.28, 0.28, 0.12, M('#222'), 0, 0.28, 0.85, 14)
  wheel.rotation.z = Math.PI / 2
  for (const s of [-0.35, 0.35]) {
    const h = box(w, 0.06, 0.06, 1.3, M('#7b4a26'), s, 0.5, -0.6)
    h.rotation.x = -0.25
    block(w, 0.06, 0.45, 0.06, M('#555'), s, 0, -0.35)
  }
  g.add(w)
}

export function buildField(root) {
  const rand = mulberry32(3131)
  const len = F.maxZ - F.minZ
  const rows = Math.floor((F.maxX - F.minX) / FARM.fieldRow)
  const rowX = (i) => F.minX + FARM.fieldRow * (i + 0.5)

  // Soil ridges (one instanced box per row, plus a narrower crown on top).
  const soil = tex(paintSoil(), 1, len / 3)
  const ridgeMat = new MeshStandardMaterial({ map: soil, color: '#c9a88a', roughness: 1 })
  const ridgeGeo = new BoxGeometry(1.35, 0.22, len - 1)
  ridgeGeo.translate(0, 0.11, 0)
  const crownGeo = new BoxGeometry(0.95, 0.1, len - 1.4)
  crownGeo.translate(0, 0.26, 0)
  const ridges = new InstancedMesh(ridgeGeo, ridgeMat, rows)
  const crowns = new InstancedMesh(crownGeo, ridgeMat, rows)
  const o = new Object3D()
  for (let i = 0; i < rows; i++) {
    o.position.set(rowX(i), 0.02, (F.minZ + F.maxZ) / 2)
    o.rotation.set(0, (rand() - 0.5) * 0.004, 0)
    o.updateMatrix()
    ridges.setMatrixAt(i, o.matrix)
    crowns.setMatrixAt(i, o.matrix)
  }
  ridges.receiveShadow = crowns.receiveShadow = true
  void ridges
  void crowns // the home field's ridges and crop are drawn by plots.js once Field 1 is bought

  // Wheat: which rows are planted, and how far.
  const planted = []
  for (let i = 0; i < rows; i++) {
    if (i < 8) planted.push([i, F.minZ + 1, F.maxZ - 1])
    else if (i < 12) planted.push([i, F.minZ + 1, F.minZ + 20 + (i - 8) * 3])
  }
  const clumpGeo = wheatClump(rand)
  const wheatMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
  addSway(wheatMat, { bend: 0.16, sheen: 0.35 })
  const spots = []
  for (const [i, z0, z1] of planted) {
    for (let z = z0; z < z1; z += 0.55) {
      spots.push([rowX(i) + (rand() - 0.5) * 0.35, z + (rand() - 0.5) * 0.2])
    }
  }
  const wheat = new InstancedMesh(clumpGeo, wheatMat, spots.length)
  spots.forEach(([x, z], k) => {
    o.position.set(x, 0.3, z)
    o.rotation.set(0, (rand() - 0.5) * 0.5, 0)
    const s = 0.85 + rand() * 0.3
    o.scale.set(s, 0.85 + rand() * 0.35, s)
    o.updateMatrix()
    wheat.setMatrixAt(k, o.matrix)
  })
  wheat.receiveShadow = true
  void wheat

  // Sprouts on two freshly sown rows and the start of a third.
  const sproutMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
  addSway(sproutMat, { bend: 0.4, sheen: 0.1 })
  const sprouts = []
  for (const [i, z0, z1] of [[13, F.minZ + 2, F.maxZ - 2], [14, F.minZ + 2, F.maxZ - 2], [15, F.maxZ - 18, F.maxZ - 2]]) {
    if (i >= rows) continue
    for (let z = z0; z < z1; z += 0.7) sprouts.push([rowX(i) + (rand() - 0.5) * 0.3, z])
  }
  const sproutMesh = new InstancedMesh(sproutClump(), sproutMat, sprouts.length)
  sprouts.forEach(([x, z], k) => {
    o.position.set(x, 0.33, z)
    o.rotation.set(0, rand() * 6.28, 0)
    o.scale.setScalar(0.8 + rand() * 0.6)
    o.updateMatrix()
    sproutMesh.setMatrixAt(k, o.matrix)
  })
  void sproutMesh

  // Dressing: the FIELD 1 sign stands on the plot for sale (like the west plots'); the
  // irrigation standpipes, wheelbarrow, scarecrows and low fences come with Field 1.
  const g = new Group()
  fieldSign(g, F.maxX + 0.9, F.maxZ - 1.5, 'FIELD 1')
  bakeInto(root, g)
  gated(root, 'field1', (G) => {
    const kit = new Group()
    for (const z of [-26, -42, -58]) {
      block(kit, 0.2, 0.6, 0.2, M('#3a7bd5', { roughness: 0.4 }), F.maxX + 1.2, 0, z)
      cyl(kit, 0.16, 0.16, 0.05, M('#d63a2c'), F.maxX + 1.2, 0.68, z, 8)
      box(kit, 0.5, 0.08, 0.08, M('#3a7bd5'), F.maxX + 0.95, 0.12, z)
    }
    wheelbarrow(kit, F.maxX + 2.6, F.maxZ + 0.8, 0.6)
    G.add(kit)
    scarecrow(G, rowX(4) + 1.1, -44, 0.2)
    scarecrow(G, rowX(16) + 1.1, -32, -0.3)
    // Low fences on the west and north sides.
    fence([[F.minX - 1, F.minZ + 6], [F.minX - 1, F.minZ - 1], [F.maxX + 2, F.minZ - 1]], 'low', { into: G })
    fence([[F.minX - 1, F.minZ + 10], [F.minX - 1, F.maxZ]], 'low', { into: G })
  }, 4)

  return {
    rect: F,
    wheatRect: { minX: F.minX, maxX: rowX(11), minZ: F.minZ, maxZ: F.maxZ },
    update(dt, t) {
      swayUniforms.uTime.value = t
      swayUniforms.uWind.value = wind.strength
    },
  }
}
