import { Group, IcosahedronGeometry, Mesh, MeshLambertMaterial } from 'three'
import { mulberry32 } from './textures.js'

// The sky dressing: soft puffy clouds drifting slowly over the farm. The ground,
// the plot and the scenery are built by farm/ (buildFarm).

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#e6f0ff', emissiveIntensity: 0.6, fog: false, transparent: true, opacity: 0.92 })
  const group = new Group()
  for (let i = 0; i < 16; i++) {
    const ang = rand() * Math.PI * 2
    const dist = 330 + rand() * 260
    const cloud = new Group()
    const puffs = 4 + Math.floor(rand() * 4)
    const len = 26 + rand() * 30
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 7)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.7, r)
      puff.position.set(t * len, r * 0.2 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat)
    flat.scale.set(len * 0.62, 3.5, 9)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist, 120 + rand() * 90, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  return group
}

export function createWorld(scene) {
  const clouds = makeClouds()
  clouds.userData.noCull = true // sky dressing: always drawn (perf.js)
  scene.add(clouds)
  return {
    update(dt) {
      clouds.rotation.y += dt * 0.0016 // a slow drift across the sky
    },
  }
}
