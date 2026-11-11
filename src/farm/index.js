import { Group } from 'three'
import { AUDIO } from '../config.js'
import { surfaceAt, updateWind } from './kit.js'
import { buildTerrain } from './terrain.js'
import { buildFences } from './fence.js'
import { buildChickenYard } from './chickens.js'
import { buildFarmStand } from './stand.js'
import { buildField } from './field.js'
import { buildTruckBay } from './truckbay.js'
import { buildStorage } from './storage.js'
import { buildMarket } from './market.js'
import { buildPads } from './pads.js'
import { buildPlots } from './plots.js'
import { buildWorkers } from './workers.js'
import { buildParks } from './parks.js'
import { buildScenery } from './scenery.js'
import { buildNorth } from './north.js'
import { buildWest } from './west.js'
import { buildSouthWest } from './southwest.js'
import { buildEast } from './east.js'
import { stringLights } from './props.js'
import { createParticles } from './particles.js'
import { buildGates } from './gates.js'
import { buildRideables } from './rideables.js'
import { buildVan } from './van.js'
import { buildDrones } from './drones.js'
import { buildOil } from './oil.js'
import { buildRanch } from './ranch.js'
import { buildTown } from './town.js'
import { env as rigEnv } from './rig.js'
import { createFarmAudio } from '../audio/farm.js'
import { buildPark } from './park.js'
import { buildSeasons } from './seasons.js'
import { buildLiving } from './living.js'
import { buildFleet3d } from './fleet3d.js'
import { buildLod } from './lod.js'
import { clock } from '../econ/clock.js'
import { updateMusic, weatherBeds, thunder } from '../audio/extra.js'
import * as game from '../game.js'

// Builds the whole farm (ground, every area of the plot, the north end and the
// surroundings out to the wind turbines) and returns its per-frame update,
// which drives the animals, people, wind, particles, the train and the sound.

const MAX_LAMPS = 8 // real point lights (night); every other lamp is emissive only

export function buildFarm(scene, lighting, preset) {
  const root = new Group()
  root.name = 'farm'
  scene.add(root)
  let lamps = 0
  const addLamp = (x, y, z) => {
    if (lamps >= MAX_LAMPS) return null
    lamps++
    // A tiny emissive bulb for the lighting module to brighten at night.
    return lighting.addLamp(x, y, z, bulb)
  }
  const bulb = { emissiveIntensity: 0 } // placeholder target: the real bulbs are emissive meshes
  const ctx = { addLamp }

  buildTerrain(root)
  // Plaza lamps first: they get the real lights.
  const market = buildMarket(root, ctx)
  const stand = buildFarmStand(root, ctx)
  const yard = buildChickenYard(root, ctx)
  const field = buildField(root)
  const truckBay = buildTruckBay(root, ctx)
  const storage = buildStorage(root, ctx)
  const pads = buildPads(root)
  const north = buildNorth(root, ctx)
  const west = buildWest(root)
  const southwest = buildSouthWest(root, ctx)
  const east = buildEast(root)
  const town = buildTown(root, ctx)
  const scenery = buildScenery(root, ctx)
  buildFences(root)
  stringLights.build(root)

  const particles = createParticles(root, { field: field.rect, exhaust: truckBay.exhaust, chimney: southwest.smoke, density: preset.particles ?? 1 })
  const plots = buildPlots(root, { pads, particles })
  const parks = buildParks(root, { particles })
  const workers = buildWorkers(root, { parks })
  const rideables = buildRideables(root, { parks, particles })
  const van = buildVan(root, { particles })
  const drones = buildDrones(root, { particles })
  const oil = buildOil(root, { pads, particles, north })
  const ranch = buildRanch(root, { particles })
  const park = buildPark(root, { particles })
  const living = buildLiving(root, { particles })
  const fleet3d = buildFleet3d(root, { particles, rideables, parks, storage })
  rideables.register(ranch.horse)
  const seasons = buildSeasons(root, { scenery, particles })
  // Last: every gated building has registered by now; the gates hide what is not bought.
  const gates = buildGates(root, { pads, particles })
  stand.attach({ pads, particles })
  const farm = { yard, stand, field, truckBay, storage, market, pads, plots, parks, workers, north, scenery, west, southwest, east, town, rideables, van, drones, oil, ranch, gates, particles, park, living, seasons }
  const audio = createFarmAudio(farm)
  // The season we load into is painted at once.
  seasons.setSeason(clock.season)
  for (const v of [...parks.trucks, ...parks.tractors]) v.g.userData.lod = 'big'
  const lod = buildLod(root, preset)
  game.on('lightning', ({ delay }) => thunder(delay))

  // Footsteps: one per stride of ground covered.
  let strideLeft = 0
  let wasGrounded = true
  const focus = { x: 0, y: 0, z: 0 }
  const playerState = { x: 0, z: 0, vx: 0, vz: 0 }

  return {
    farm,
    update(dt, t, player, camera) {
      updateWind(t)
      const p = player.renderPosition
      seasons.update(dt, t, p)
      focus.x = p.x
      focus.y = p.y
      focus.z = p.z
      playerState.x = p.x
      playerState.z = p.z
      playerState.vx = player.velocity.x
      playerState.vz = player.velocity.z
      const night = lighting.nightLevel?.() ?? 0
      rigEnv.night = night

      yard.update(dt, t, playerState)
      stand.update(dt, t)
      field.update(dt, t)
      truckBay.update(dt, t)
      storage.update(dt, t)
      market.update(dt, t)
      pads.update(dt, t)
      plots.update(dt, t)
      parks.update(dt, t)
      workers.update(dt, t)
      rideables.update(dt, t)
      van.update(dt, t)
      drones.update(dt, t)
      oil.update(dt, t)
      ranch.update(dt, t, focus)
      town.update(dt, t)
      gates.update(dt, t)
      north.update(dt, t)
      scenery.update(dt, t)
      park.update(dt, t, p)
      living.update(dt, t, rideables)
      fleet3d.update(dt, t)
      lod.update(dt, p, camera)
      if (stringLights.mesh) stringLights.mesh.material.emissiveIntensity = 1.6 + night * 2.5 + Math.sin(t * 2) * 0.1
      particles.update(dt, t, focus, { night, train: north.train })

      // Footsteps and landings.
      const speed = Math.hypot(player.velocity.x, player.velocity.z)
      if (player.grounded) {
        const surface = surfaceAt(p.x, p.z)
        if (!wasGrounded && player.velocity.y <= 0) {
          audio.footstep(surface, 1.6)
          audio.footstep(surface, 1.1)
          if (/dirt|sand|gravel|soil/.test(surface)) particles.dust(p.x, p.z, surface === 'sand' ? '#e3c89a' : '#b8936a', 6)
        }
        if (speed > 0.6) {
          strideLeft -= speed * dt
          if (strideLeft <= 0) {
            const run = speed > 10
            strideLeft = AUDIO.footsteps.stride * (run ? 1.45 : 1) * (speed < 3 ? 0.7 : 1)
            audio.footstep(surface, run ? 1.25 : Math.min(1, 0.55 + speed / 16), surface === 'grass' || surface === 'asphalt' || surface === 'concrete')
            if (/dirt|sand|gravel|soil/.test(surface)) particles.dust(p.x, p.z, surface === 'sand' ? '#e3c89a' : '#b8936a', run ? 3 : 1)
          }
        } else strideLeft = 0.2
      }
      wasGrounded = player.grounded
      audio.update(dt, t, focus, camera, night)
      weatherBeds(dt, { rain: clock.rain, wind: clock.wind })
      updateMusic(dt, focus)
    },
  }
}
