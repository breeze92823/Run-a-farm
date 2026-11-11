import { Group, MeshBasicMaterial, AdditiveBlending, DoubleSide, Mesh, CircleGeometry } from 'three'
import { M } from './kit.js'
import { bakeStatic, bx, compact, cy, lathe, lens, metal, rbox, ring, sph, tube } from './detail.js'

// A heavy-lift delivery drone (about 2.4 m across): a moulded shell with an
// orange top cover and a status light bar, four carbon arms to motor pods
// with spinning bells and pitched two-blade props (a soft blur disc grows as
// they spin up), prop guards, a battery pack, a GPS mast, a camera gimbal
// that looks around, landing legs that fold up in cruise, red / green nav
// lights and a white strobe, and a winch whose cable pays out to hook a
// crate. Its Speed upgrade fits bigger, orange-tipped props; its Capacity
// upgrade a bigger crate and battery.

export function drone3d() {
  const g = new Group() // position + yaw
  const tilt = new Group() // pitch / roll from acceleration
  g.add(tilt)
  const S = new Group()
  const shell = M('#f4f1e8', { roughness: 0.25, metalness: 0.1 })
  const orange = M('#f07a24', { roughness: 0.35 })
  const carbon = M('#1d1f22', { roughness: 0.35, metalness: 0.3 })
  const grey = metal('#8a9199', 0.35)
  // Body shell, cover, vents, light bar.
  lathe(S, [[0.001, -0.18], [0.42, -0.16], [0.52, -0.05], [0.52, 0.06], [0.44, 0.16], [0.001, 0.2]], shell, 0, 0, 0, 24).scale.set(1, 1, 1.25)
  rbox(S, 0.62, 0.12, 0.78, 0.05, orange, 0, 0.2, -0.05)
  for (let i = 0; i < 5; i++) bx(S, 0.4, 0.02, 0.03, M('#2a2c30'), 0, 0.27, -0.3 + i * 0.1)
  const status = lens('#5aff8a', 2.5)
  rbox(S, 0.5, 0.04, 0.06, 0.02, status, 0, 0.12, 0.62)
  // Battery pack strapped on top.
  rbox(S, 0.36, 0.14, 0.5, 0.03, M('#2a2c30', { roughness: 0.5 }), 0, 0.32, -0.12)
  for (const z of [-0.25, 0.05]) bx(S, 0.4, 0.03, 0.04, orange, 0, 0.4, z)
  // GPS mast.
  tube(S, [0, 0.4, -0.3], [0, 0.72, -0.34], 0.012, grey)
  cy(S, 0.07, 0.07, 0.03, M('#f4f1e8'), 0, 0.74, -0.34, 16)
  const arms = []
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const ax = sx * 0.85
    const az = sz * 0.85
    tube(S, [sx * 0.3, 0.02, sz * 0.35], [ax, 0.05, az], 0.04, carbon, 10)
    tube(S, [sx * 0.32, -0.06, sz * 0.3], [ax, 0.0, az], 0.018, carbon, 6)
    cy(S, 0.11, 0.12, 0.16, M('#2a2c30', { roughness: 0.4, metalness: 0.4 }), ax, 0.1, az, 16) // motor stator housing
    ring(S, 0.42, 0.012, grey, ax, 0.18, az, 'y') // prop guard
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4
      tube(S, [ax, 0.1, az], [ax + Math.cos(a) * 0.42, 0.18, az + Math.sin(a) * 0.42], 0.008, grey, 4)
    }
    arms.push([ax, az, sz])
  }
  // Gimbal mount under the nose.
  cy(S, 0.06, 0.06, 0.08, M('#2a2c30'), 0, -0.2, 0.42, 10)
  bakeStatic(tilt, S)

  // Motor bells, props and blur discs.
  const props = []
  const blurMat = new MeshBasicMaterial({ color: '#d8d8d8', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  const blurGeo = new CircleGeometry(0.4, 28)
  for (const [ax, az, sz] of arms) {
    const bell = new Group()
    bell.position.set(ax, 0.2, az)
    cy(bell, 0.1, 0.1, 0.06, metal('#c7ccd1', 0.25), 0, 0, 0, 16)
    for (let i = 0; i < 6; i++) bx(bell, 0.02, 0.07, 0.04, M('#2a2c30'), Math.cos(i) * 0.09, 0, Math.sin(i) * 0.09)
    const prop = new Group()
    prop.position.y = 0.05
    for (const s of [-1, 1]) {
      const blade = bx(prop, 0.36, 0.012, 0.07, M('#1d1f22', { roughness: 0.4 }), s * 0.2, 0, 0)
      blade.rotation.x = s * 0.18 // pitch
      const tip = bx(prop, 0.06, 0.013, 0.07, orange, s * 0.36, 0, 0)
      tip.rotation.x = s * 0.18
    }
    sph(prop, 0.04, metal('#c7ccd1', 0.2), 0, 0.02, 0)
    bell.add(prop)
    const blur = new Mesh(blurGeo, blurMat)
    blur.rotation.x = -Math.PI / 2
    blur.position.y = 0.06
    bell.add(blur)
    tilt.add(bell)
    props.push({ bell, prop, dir: sz > 0 ? 1 : -1 })
  }
  // Nav lights and a strobe.
  const red = lens('#ff2a1a', 2)
  const green = lens('#3aff6a', 2)
  const strobe = lens('#ffffff', 0)
  for (const [ax, az] of arms) sph(tilt, 0.035, az > 0 ? (ax > 0 ? green : red) : M('#f4f1e8'), ax, -0.01, az + Math.sign(az) * 0.12)
  sph(tilt, 0.05, strobe, 0, 0.42, 0.18)
  // Camera gimbal: yaw ring + pitching camera.
  const gimbal = new Group()
  gimbal.position.set(0, -0.28, 0.42)
  ring(gimbal, 0.08, 0.015, M('#2a2c30'), 0, 0, 0, 'z')
  const cam = new Group()
  rbox(cam, 0.14, 0.12, 0.16, 0.03, M('#2a2c30', { roughness: 0.4 }), 0, 0, 0)
  cy(cam, 0.045, 0.05, 0.05, metal('#3a3d42', 0.2), 0, 0, 0.1, 14, 'z')
  sph(cam, 0.035, M('#1a2a4a', { roughness: 0.05, metalness: 0.6 }), 0, 0, 0.125, 1, 1, 0.5)
  gimbal.add(cam)
  tilt.add(gimbal)
  // Landing legs (fold up in cruise).
  const legs = []
  for (const s of [-1, 1]) {
    const leg = new Group()
    leg.position.set(s * 0.32, -0.12, 0)
    tube(leg, [0, 0, 0], [s * 0.18, -0.5, 0], 0.025, carbon)
    tube(leg, [s * 0.18, -0.5, -0.4], [s * 0.18, -0.5, 0.4], 0.03, carbon)
    for (const z of [-0.4, 0.4]) sph(leg, 0.04, M('#2a2c30'), s * 0.18, -0.5, z)
    tilt.add(leg)
    legs.push({ leg, s })
  }
  // Winch, cable and the crate.
  cy(tilt, 0.08, 0.08, 0.14, metal('#7a828a', 0.4), 0, -0.22, -0.05, 14, 'x')
  const cable = tube(tilt, [0, -0.25, -0.05], [0, -0.6, -0.05], 0.008, M('#2a2c30'), 4)
  cable.userData.keep = true
  const crate = new Group()
  rbox(crate, 0.6, 0.45, 0.6, 0.04, M('#c79a5c', { roughness: 0.85 }), 0, -0.22, 0)
  for (const y of [-0.35, -0.1]) bx(crate, 0.62, 0.05, 0.62, M('#8a5a2c'), 0, y, 0)
  const lid = rbox(crate, 0.5, 0.05, 0.5, 0.02, M('#fff3dc'), 0, 0.02, 0)
  lid.userData.keep = true
  tube(crate, [-0.25, 0.02, 0], [0, 0.25, 0], 0.01, M('#2a2c30'))
  tube(crate, [0.25, 0.02, 0], [0, 0.25, 0], 0.01, M('#2a2c30'))
  crate.visible = false
  tilt.add(crate)
  g.traverse((o) => {
    if (o.isMesh && o.material !== blurMat) o.castShadow = true
  })
  for (const p of props) for (const c of p.bell.children) if (c.isMesh && c.material === blurMat) c.userData.keep = true
  compact(g)
  g.scale.setScalar(1.4)

  let spin = 0
  return {
    g,
    tilt,
    props,
    crate,
    lid,
    // rpm 0..1, fold 0 (legs down) .. 1 (up), cable m below the drone, t time.
    animate(dt, t, { rpm, fold, cable: cableLen, carrying, color }) {
      spin += dt * (3 + rpm * 70)
      for (const p of props) {
        p.prop.rotation.y = spin * p.dir
        p.prop.visible = rpm < 0.85
      }
      blurMat.opacity = Math.max(0, rpm - 0.35) * 0.35
      for (const { leg, s } of legs) leg.rotation.z = s * fold * 1.25
      gimbal.rotation.y = Math.sin(t * 0.4) * 0.6
      cam.rotation.x = 0.25 + Math.sin(t * 0.3) * 0.2
      strobe.emissiveIntensity = t % 1.2 < 0.06 ? 6 : 0
      status.emissiveIntensity = rpm > 0.1 ? 2.5 + Math.sin(t * 6) * 0.8 : 0.6
      const len = Math.max(0.35, cableLen)
      cable.position.set(0, -0.25 - len / 2, -0.05)
      cable.scale.y = len
      crate.visible = carrying
      crate.position.set(0, -0.25 - len, -0.05)
      crate.rotation.y = Math.sin(t * 1.3) * 0.15
      crate.rotation.z = Math.sin(t * 2.1) * 0.05
      if (color) lid.material = M(color, { roughness: 0.6 })
    },
    setLevel({ speed = 0, cap = 0 } = {}) {
      const ps = 1 + speed * 0.08
      for (const p of props) p.prop.scale.set(ps, 1, ps)
      crate.scale.setScalar(1 + cap * 0.15)
    },
  }
}
