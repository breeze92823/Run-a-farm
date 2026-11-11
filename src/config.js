// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'run-a-farm' // slug registered on bloxity.io
export const GAME_TITLE = 'Run a Farm'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up; the plot faces north = -Z) -----
export const GROUND_Y = 0
// Rectangles are { minX, maxX, minZ, maxZ }. The plot is the player's farm; the
// road runs east-west along its south edge, everything else sits north of it.
export const FARM = {
  walk: { minX: -150, maxX: 150, minZ: -238, maxZ: 150 }, // invisible walls keep the player off the hills
  walkWest: { minX: -342, maxX: -150, minZ: -58, maxZ: 52 }, // ...plus the Processing Park west of the plot, up to the road's far side
  // The rural town east along the road (farm/town.js): shops, the Town Park, the Farmers' Market
  // and the Vehicle Dealer around the crossroads of the road and Main Street. The town sits in the
  // middle of the hub (FARM.hub below); the player's own farm is west of it, the other players'
  // farms north, east and south (FARM.farmSlots).
  town: { minX: 150, maxX: 430, minZ: -40, maxZ: 160 },
  // The market hall's front line is at z (it faces the road, north); walking / driving into `zone` sells.
  townMarket: { x: 214, z: 86, zone: { minX: 189, maxX: 239, minZ: 41, maxZ: 84 } },
  // The showroom's glass front is at z (facing the road); `desk` = the front desk inside (E: view
  // vehicles), `lot` = the vehicles for sale out front.
  dealer: { x: 364, z: 86, reach: 3.2, desk: { x: 364, z: 97.5 } },
  bike: { x: -1.5, z: 31, ry: -0.3 },
  // In front of the barn's drop bay: walking (or driving a truck) in here unloads the bag / loads the truck.
  loadZone: { minX: 24, maxX: 58, minZ: -38, maxZ: -28 },
  packer: { x: -27.5, z: 34.4 }, // the carton packer by the stand
  cartonPallet: { x: -7.5, z: 34.5 }, // where the cartons wait for the van
  droneBase: { x: 110, z: -6 },
  oil: { pumps: [[87, -84], [121, -84], [87, -64], [121, -64]], header: -74, tank: { x: 134, z: -76 }, station: { x: 112, minX: 100, maxX: 124 }, gate: { minX: 103, maxX: 109 } },
  stables: { x: -112, z: -196 },
  arena: { minX: -116, maxX: -62, minZ: -174, maxZ: -144 },
  ranchCrates: { stables: [-83, -138.5], cowBarn: [-24, -138.5], pigPen: [33, -138.5], duckHouse: [78, -138.5] },
  cowBarn: { x: -46, z: -167, pen: { minX: -56, maxX: -4, minZ: -176, maxZ: -144 } },
  pigPen: { x: 42, z: -167, pen: { minX: 2, maxX: 52, minZ: -176, maxZ: -144 } },
  duckHouse: { x: 79, z: -166, pen: { minX: 58, maxX: 86, minZ: -176, maxZ: -144 }, pool: { x: 68, z: -157 } },
  flat: { minX: -560, maxX: 200, minZ: -290, maxZ: 210 }, // ground is flat inside this, hills rise outside
  // Valleys kept flat out to the horizon so the road and the railway run off into the distance.
  // Valleys kept flat: z = east-west (road, railway), x = the side road south (from minZ).
  corridors: [{ z: 46, half: 22 }, { z: -114, half: 26 }, { x: -150, half: 22, minZ: 30 }],
  road: { z: 46, width: 12, minX: -900, maxX: 455 }, // ends at the east farm's gate
  sidewalkN: { minX: -900, maxX: 453, minZ: 37, maxZ: 40 },
  sidewalkS: { minX: -900, maxX: 453, minZ: 52, maxZ: 55 },
  curbHeight: 0.16,
  chickenYard: { minX: -66, maxX: -6, minZ: -12, maxZ: 18 },
  coops: [{ x: -52, z: -5, n: 1 }, { x: -36, z: -5, n: 2 }, { x: -20, z: -5, n: 3 }],
  yardArch: { x: -11, z: 18 },
  standPlaza: { minX: -34, maxX: -4, minZ: 20, maxZ: 37 },
  stand: { x: -19, z: 27 },
  billboard: { x: -50, z: 34 },
  path: { minX: -161, maxX: -4, minZ: -18, maxZ: -12 }, // dirt path between the yard and the field, on out west into the Processing Park
  field: { minX: -56, maxX: -12, minZ: -68, maxZ: -20 },
  fieldRow: 2.2, // m between soil ridges (rows run north-south)
  grassStrip: { minX: -10, maxX: -4, minZ: -68, maxZ: -18 },
  truckBay: { minX: 2, maxX: 20, minZ: -6, maxZ: 24, height: 7.2 },
  driveway: { minX: 2, maxX: 20, minZ: 24, maxZ: 40 },
  bayApron: { minX: 2, maxX: 20, minZ: -24, maxZ: -6 },
  dropOff: { minX: 20, maxX: 60, minZ: -38, maxZ: 32 },
  racks: { x: 56, minZ: -18, maxZ: 28 },
  gantry: { z: -27, minX: 21, maxX: 59 },
  plaza: { minX: -4, maxX: 24, minZ: -58, maxZ: -24 },
  seedStall: { x: 11, z: -50 },
  barn: { minX: 34, maxX: 66, minZ: -72, maxZ: -40 },
  combine: { x: 50, z: -68.5 }, // parked in the barn's north door, header out toward the dirt road
  // East of the barn: open lawn inside the plot fence.
  east: { minX: 62, maxX: 140, minZ: -92, maxZ: 36 },
  eastTrees: [[74, -30], [70.5, -50], [88, -14], [79, 10], [131, 20], [138, -36]],
  farmhouse: { x: -86, z: 23 }, // the cottage, which is also the Farm Office (hire workers)
  office: { x: -86, z: 28.4, reach: 3.4 }, // where its HIRE WORKERS prompt shows, on the porch
  // Where the farm's vehicles park (one slot per vehicle, GAME.vehicles max) and their buy pads.
  // Tractors: a gravel strip between the west plots and the path, nose to the plots.
  tractorPark: { minX: -146.5, maxX: -123, minZ: -25.4, maxZ: -18.3, slotZ: -21.8, pad: { x: -119.3, z: -21.8 } },
  // Trucks: the south-east corner of the drop-off, nose north; they leave along `laneZ`
  // to the driveway and the road (east to the market and back).
  vehiclePark: { minX: 27.5, maxX: 50, minZ: 16, maxZ: 25, slotZ: 20.5, laneZ: 27.2, pad: { x: 24.4, z: 20.5 } },
  // South-west corner: the homestead between the yard and the woods, with the pumpkin weigh-off patch.
  homestead: { minX: -112, maxX: -66, minZ: -12, maxZ: 37 },
  homePath: { minX: -73.5, maxX: -69.5, minZ: -12, maxZ: 37 }, // dirt path down the yard's west side
  housePath: { minX: -89, maxX: -83, minZ: 27.5, maxZ: 37 }, // gravel walk from the cottage to the road
  pumpkinPatch: { x: -98, z: 2, r: 6.5 },
  sideRoad: { x: -150, width: 12, minZ: 40, maxZ: 900 }, // branches south off the main road (T-junction)
  neighbor2: { x: -235, z: 112, ry: Math.PI }, // the farm across the road, facing it
  // West of the field: overgrown plots waiting to be bought, split by dirt paths.
  west: { minX: -146, maxX: -64, minZ: -90, maxZ: -26, gap: 4, cols: 3, rows: 2, firstField: 2, prices: [1800, 3500, 6000, 10000, 16000, 25000] },
  westPath: { minX: -64, maxX: -59.5, minZ: -98, maxZ: -18 }, // the north-south track from the yard path to the dirt road
  neighbor: { x: -480, z: 4 }, // the next player's farm, seen across the woods past the Processing Park
  northEdge: -92, // z of the plot's north fence
  // The farm's boundary fence (farm/scenery.js plotFences, farm/boundary.js): one loop round the
  // whole plot, its gateways at the tracks, paths and drives that leave it.
  boundary: { minX: -148, maxX: 140, minZ: -92, maxZ: 36.4 },
  northGate: { minX: -10, maxX: -3 }, // opening in the north fence onto the dirt road
  // North of the plot: the wide dirt road, the railway (orange fence on its south side,
  // white ranch fence on its north side), oil barrels, and the ranch beyond.
  dirtRoad: { minX: -900, maxX: 900, minZ: -118, maxZ: -98 },
  rail: { z: -124, gauge: 1.5, minX: -1200, maxX: 1200 },
  railFenceS: -119.5,
  railFenceN: -128.5,
  crossing: { x: 92, half: 4 },
  ranch: { minX: -130, maxX: 130, minZ: -236, maxZ: -132 },
  ranchTrees: [[-95, -188], [-46, -192], [-48, -226], [-100, -230], [-1, -158], [-1, -146], [55, -183], [124, -183], [-122, -150], [-126, -205], [22, -232], [124, -232]],
  oilSign: { x: -58, z: -96.5 },
  barrels: [[-70, -104], [-36, -107], [-6, -110], [20, -104.5], [48, -111]],
  train: { every: 85, speed: 19, cars: 7 }, // s between trains, m/s
  // Upgrade pads: name, price, perk line, colour.
  pads: [
    // `needs`: buildings (ids, as GAME.buildings) that must stand before the pad shows up. What
    // each one builds (farm/decor.js, the road's street lamps, the yard's lanterns) is a gate
    // `pad:<name>`: plain lawn until it is bought.
    { x: 3, z: -30, name: 'Fountain', kind: 'DECOR', perk: '+4% customers', price: 900, needs: ['seedMarket'] },
    { x: -7, z: -30, name: 'Blossom Trees', kind: 'DECOR', perk: '+5% customers', price: 3000, needs: ['seedMarket'] },
    { x: 98, z: -42, name: 'Flower Garden', kind: 'DECOR', perk: '+6% customers', price: 7500, needs: ['storage'] },
    { x: -60, z: 30, name: 'Playground', kind: 'DECOR', perk: '+6% customers', price: 6000, needs: ['office'] },
    { x: -60, z: -21.5, name: 'Truck Lanterns', kind: 'DECOR', perk: '+2% customers', price: 1500, needs: ['tractorBay'] },
    { x: -102, z: 33.5, name: 'Street Lamps', kind: 'DECOR', perk: '+3% customers', price: 2250, needs: ['truckBay'] },
    { x: -78, z: -5, name: 'Farm Lanterns', kind: 'DECOR', perk: '+2% customers', price: 1800, needs: ['coop2'] },
  ],
}
// The west plots as rects, nearest (south-east) first: { rect, n, price, x, z (pad) }.
export function westPlots() {
  const W = FARM.west
  const cw = (W.maxX - W.minX - W.gap * (W.cols - 1)) / W.cols
  const rh = (W.maxZ - W.minZ - W.gap * (W.rows - 1)) / W.rows
  const out = []
  for (let r = 0; r < W.rows; r++) {
    for (let c = 0; c < W.cols; c++) {
      const maxX = W.maxX - c * (cw + W.gap)
      const maxZ = W.maxZ - r * (rh + W.gap)
      const i = out.length
      out.push({ i, rect: { minX: maxX - cw, maxX, minZ: maxZ - rh, maxZ }, n: W.firstField + i, price: W.prices[i], x: maxX - 3.5, z: maxZ - 3.5 })
    }
  }
  return out
}
// The part of a plot that grows crops: all of it but a strip along its south
// edge (the headland) where its sign and upgrade pads stand.
export function plotCrops(rect) {
  return { minX: rect.minX + 1, maxX: rect.maxX - 1, minZ: rect.minZ + 1, maxZ: rect.maxZ - GAME.plots.headland }
}
// --- The hub: the rural town with four farms around it -------------------------------------------
// One room on the server = one town with GAME.net.slots farms. Each client draws its own farm at
// home (the plot above, west of the town) and the other three slots from the roster (farm/remote.js:
// a summary farm, or bare land when nobody holds the slot). `farmSlots[k]` is the slot k places
// round from the viewer's own (1 = north, 2 = east, 3 = south): its centre, and `ry` turns the
// slot's own frame (W x D m, gate in the middle of its +Z edge) so the gate faces the town.
Object.assign(FARM, {
  hub: { minX: 150, maxX: 630, minZ: -312, maxZ: 362 }, // walkable and flat: the town and the three farm slots
  mainStreet: { x: 290, width: 10, minZ: -142, maxZ: 196 }, // north-south through town, gate to gate
  slot: { w: 180, d: 160 },
  farmSlots: [null, { x: 290, z: -222, ry: 0 }, { x: 536, z: 46, ry: -Math.PI / 2 }, { x: 290, z: 276, ry: Math.PI }],
})
// The walkable rect of the farm slot k places round (1..3).
export function slotRect(k) {
  const s = FARM.farmSlots[k]
  const turned = Math.abs(Math.sin(s.ry)) > 0.5
  const hw = (turned ? FARM.slot.d : FARM.slot.w) / 2
  const hd = (turned ? FARM.slot.w : FARM.slot.d) / 2
  return { minX: s.x - hw, maxX: s.x + hw, minZ: s.z - hd, maxZ: s.z + hd }
}
// Inside the walkable area (FARM.walk, its western annex FARM.walkWest or the town hub)?
export const inWalk = (x, z) => [FARM.walk, FARM.walkWest, FARM.hub].some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)
export const SPAWN = { x: 11, y: 0.2, z: 32 }
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z, north)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves
// Visual ground (farm/ground.js): low drawn surfaces with no collider (field ridges, rail
// ballast, barn floor, pads, raised beds...) that the drawn player and vehicles are lifted onto.
export const GROUND = {
  minY: 0.07, // m: surfaces lower than this are decals (the player's feet hide them)
  maxY: 0.6, // m: surfaces higher than this are obstacles, not ground
  minNy: 0.85, // a face must point this much up to stand on
  minArea: 0.1, // m^2 (top view): smaller faces are crop, grass, eggs, leaves
  reach: 0.5, // m above the feet a surface still counts (higher ones are walked through)
  dead: 0.04, // m: smaller lifts are ignored (sidewalk texture over its collider)
  up: 8, // m/s the lift rises onto a surface
  down: 2.5, // m/s it settles back off one (crossing furrows reads as a small dip)
  radius: { foot: 0.25, bike: 0.35, horse: 0.6, tractor: 0.9, truck: 1.1, combine: 1.4, sprayer: 1.0 }, // m sampled round the centre
  rescan: 2, // s between checks for meshes added since (bought plots, other players' farms)
}

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 140, far: 1700 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    // Bright autumn afternoon: pale hazy horizon, warm low sun behind the camera (south-west).
    zenith: '#3f93e6',
    horizon: '#cfe7f2',
    sunColor: '#fff0d4',
    sunIntensity: 2.5,
    sunElevation: 48, // degrees above the horizon
    sunAzimuth: -28, // degrees, 0 = from +Z (south)
    hemiSky: '#e6f3ff',
    hemiGround: '#a8b878',
    hemiIntensity: 0.95,
    envIntensity: 0.5,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.98,
  },
  // A bright, playable moonlit night: blue-tinted but everything stays readable.
  night: {
    zenith: '#13245a',
    horizon: '#4d66a0',
    sunColor: '#b4c6ff', // the moon
    sunIntensity: 1.2,
    sunElevation: 46,
    sunAzimuth: -60,
    hemiSky: '#7890d0',
    hemiGround: '#3c4258',
    hemiIntensity: 0.85,
    envIntensity: 0.45,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.3,
  },
}
export const LIGHT = {
  shadowRange: 46, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 3000,
  startPitch: 0.14, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

// --- Game economy (game.js) and HUD (hud/) ------------------------------------------------
// The player starts with nothing but one coop and the farm stand: collect eggs
// by hand, stock the stand, ride the bike to the town market with a full bag,
// and buy the rest of the farm piece by piece (GAME.buildings).
export const GAME = {
  startMoney: 0,
  bag: 24, // goods the bag (and the bike basket) holds
  stand: 12, // eggs the farm stand holds at the start (a small egg table); see the Bigger Stand caps
  storage: 200, // goods the storage barn holds
  eggPrice: 4, // $ per egg at the stand, before boosts
  customersPerMin: 15,
  nestMax: 8, // eggs a coop's nest crate holds
  layEvery: 3.5, // s per egg per coop
  hensPerCoop: 1, // hens each coop starts with (more are bought on the coop's card)
  startHens: 1, // hens in Coop 1 (the free starting coop)
  henMax: 8, // hens a coop holds
  henCost: 40, // $ for the 2nd hen in a coop
  henGrowth: 1.4, // price multiplier per hen already bought
  reach: 2.8, // m from a nest crate to collect it
  standReach: 4.5, // m from the stand counter to restock it
  growEvery: 90, // s per lb the weigh-off pumpkin gains
  eventLength: (10 * 24 + 7) * 3600 * 1000, // the weigh-off event, from the first visit
  moon: { first: 90, length: 30, gap: 16 * 60, bonus: 2 }, // Harvest Moon: s until the first, s up, s between, sale multiplier
  // The boosts shown next to the money (the hat = money, the people = friends).
  boosts: [
    // Earned through invites (game.js boostActive, backend invite.ts): `unlock` says how.
    { id: 'money', label: '+10%', amount: 0.1, title: 'Money Boost', text: '+10% money from every sale', unlock: 'Invite a friend to unlock' },
    { id: 'friends', label: '+10%', amount: 0.1, title: 'Friends Boost', text: '+10% money for playing with friends', unlock: 'Unlocks when a friend you invited joins' },
  ],
  // Everything the farm makes, with its price at the town market ($ each).
  goods: {
    egg: { name: 'Eggs', market: 6, color: '#fff3dc' },
    wheat: { name: 'Wheat', market: 5, color: '#f1c75a' },
    corn: { name: 'Corn', market: 9, color: '#f4d03a' },
    carrot: { name: 'Carrots', market: 12, color: '#f08a24' },
    sunflower: { name: 'Sunflower Seeds', market: 20, color: '#f7c948' },
    pumpkin: { name: 'Pumpkins', market: 55, color: '#ee7a1f' },
    duckEgg: { name: 'Duck Eggs', market: 11, color: '#cfe6d8' },
    milk: { name: 'Milk', market: 22, color: '#ffffff' },
    truffle: { name: 'Truffles', market: 40, color: '#6b4428' },
  },
  // Seeds in hotbar order (keys 1-5): one seed plants one field; the crop yields
  // its good (GAME.goods) and takes `grow` s to ripen.
  seeds: [
    { id: 'wheat', name: 'Wheat', pack: 5, packPrice: 25, unlock: 0, grow: 40, text: 'A golden staple. Quick to grow and easy to sell.' },
    { id: 'corn', name: 'Corn', pack: 5, packPrice: 60, unlock: 800, grow: 60, text: 'Tall stalks with sweet yellow cobs.' },
    { id: 'carrot', name: 'Carrot', pack: 5, packPrice: 120, unlock: 2500, grow: 75, text: 'Crunchy orange roots, pulled by the bunch.' },
    { id: 'sunflower', name: 'Sunflower', pack: 5, packPrice: 250, unlock: 6000, grow: 100, text: 'Big bright heads full of seeds.' },
    { id: 'pumpkin', name: 'Pumpkin', pack: 5, packPrice: 600, unlock: 15000, grow: 140, text: 'The autumn prize. Heavy and valuable.' },
  ],
  // Shop upgrades bought with farm money (`needs`: a building that must stand first).
  shop: [
    { id: 'bag', name: 'Bigger Bag', text: '+12 bag space', price: 60, growth: 1.8, step: 12, max: 8 },
    // Bigger Stand: each level builds the next piece of the farm stand (farm/stand.js) and sets its egg space.
    { id: 'stand', name: 'Bigger Stand', text: 'Builds up the farm stand: more egg space', price: 60, growth: 1.8, max: 8,
      caps: [12, 24, 40, 60, 90, 130, 180, 240, 300],
      stages: ['Egg Table', 'Wooden Counter', 'Striped Awning', 'Egg Shelves', 'Cash Register', 'Dozen Stall', 'Egg Cooler', 'Rooftop Sign', 'Grand Stand'] },
    { id: 'price', name: 'Egg Price', text: '+$1 per egg sold', price: 120, growth: 1.6, step: 1, max: 10 },
    { id: 'customers', name: 'More Customers', text: '+5 customers a minute', price: 150, growth: 1.6, step: 5, max: 8 },
    { id: 'nests', name: 'Bigger Nests', text: '+4 eggs per nest, lays faster', price: 200, growth: 1.9, step: 4, max: 5 },
    { id: 'storage', name: 'Bigger Storage', text: '+150 storage space', price: 1500, growth: 1.8, step: 150, max: 6, needs: 'storage' },
    { id: 'packer', name: 'Faster Packer', text: 'Packs cartons 25% faster', price: 1500, growth: 1.8, step: 0.25, max: 4, needs: 'cartons' },
  ],
  // Buildings bought on build pads around the farm. `needs`: buildings that
  // must stand first. `x, z`: where the build pad is.
  buildings: [
    { id: 'coop2', name: 'Coop 2', kind: 'CHICKENS', perk: '+1 coop of hens', price: 120, x: -36, z: 5.5, needs: [] },
    // The farm stand's decorations (farm/stand.js), one after another; `customers`: + customers a minute.
    { id: 'decorFlowers', name: 'Flower Boxes', kind: 'STAND DECOR', perk: '+3 customers a minute', price: 60, x: -7.5, z: 33.5, needs: [], customers: 3 },
    { id: 'decorLights', name: 'Fairy Lights', kind: 'STAND DECOR', perk: '+4 customers a minute', price: 180, x: -7.5, z: 33.5, needs: ['decorFlowers'], customers: 4 },
    { id: 'decorBench', name: 'Waiting Bench', kind: 'STAND DECOR', perk: '+4 customers a minute', price: 400, x: -7.5, z: 33.5, needs: ['decorLights'], customers: 4 },
    { id: 'decorBillboard', name: 'Road Billboard', kind: 'STAND DECOR', perk: '+8 customers a minute', price: 750, x: -50, z: 30.5, needs: ['decorLights'], customers: 8 },
    // The Farm Office: a porch office on the cottage (farm/southwest.js); workers are hired there.
    { id: 'office', name: 'Farm Office', kind: 'WORKERS', perk: 'Hire workers to run the farm', price: 300, x: -77.5, z: 29.5, needs: ['coop2'] },
    { id: 'seedMarket', name: 'Seed Market', kind: 'SHOP', perk: 'Buy and unlock seeds', price: 200, x: 11, z: -44.5, needs: ['field1'] },
    { id: 'coop3', name: 'Coop 3', kind: 'CHICKENS', perk: '+1 coop of hens', price: 600, x: -20, z: 5.5, needs: ['coop2'] },
    { id: 'storage', name: 'Storage Barn', kind: 'WAREHOUSE', perk: 'Store crops and eggs', price: 1500, x: 41, z: -31, needs: ['field1'] },
    { id: 'cartons', name: 'Carton Packer', kind: 'FARM SHOP LV2', perk: 'Cartons sell to the van', price: 1200, x: -27.5, z: 30.5, needs: ['coop3'] },
    { id: 'tractorBay', name: 'Tractor Bay', kind: 'VEHICLES', perk: 'Park tractors here', price: 2000, x: -119.3, z: -21.8, needs: ['field1'] },
    { id: 'truckBay', name: 'Truck Bay', kind: 'VEHICLES', perk: 'Park trucks here', price: 2500, x: 11, z: 20, needs: ['storage'] },
    { id: 'droneBase', name: 'Drone Base', kind: 'DRONES', perk: 'Drones sell your storage', price: 12000, x: 110, z: 7, needs: ['storage'] },
    { id: 'duckHouse', name: 'Duck House', kind: 'RANCH', perk: 'Ducks lay duck eggs', price: 4000, x: 78, z: -138.5, needs: ['coop3'] },
    { id: 'cowBarn', name: 'Cow Barn', kind: 'RANCH', perk: 'Cows give milk', price: 7500, x: -24, z: -138.5, needs: ['storage'] },
    { id: 'pigPen', name: 'Pig Pen', kind: 'RANCH', perk: 'Pigs dig up truffles', price: 11000, x: 33, z: -138.5, needs: ['cowBarn'] },
    { id: 'stables', name: 'Horse Stables', kind: 'RANCH', perk: 'Horse rides earn money', price: 18000, x: -83, z: -138.5, needs: ['cowBarn'] },
    { id: 'oilField', name: 'Oil Field', kind: 'CRUDE OIL', perk: 'Drill for crude oil', price: 25000, x: 104, z: -74, needs: ['truckBay'] },
    { id: 'railStation', name: 'Rail Station', kind: 'CRUDE OIL', perk: 'The train buys your oil', price: 15000, x: 112, z: -103, needs: ['oilField'] },
  ],
  // The free bicycle by the stand: faster than walking, carries the bag.
  bike: { speed: 17, turn: 4.2, accel: 26 },
  // Vehicles the player drives (drivers drive them later): top speed m/s, turn rad/s, cargo.
  truck: { speed: 22, turn: 2.6, accel: 16, cargo: 40 },
  tractor: { speed: 11, turn: 2.4, accel: 12, harvestBonus: 0.3 },
  // The carton packer (Farm Shop Lv2) and the van that collects the cartons.
  cartons: { eggs: 12, every: 6, max: 20, bonus: 1.6, van: { every: 45, load: 10, stop: 7 } },
  // Plots: Field 1 (the home field) and the west plots (Field 2+), bought in order.
  plots: {
    max: 7,
    home: { price: 400, needs: 'coop2' }, // Field 1 (FARM.field) is for sale once Coop 2 stands
    yield: [12, 14, 16, 18, 21, 24, 28], // goods per harvest, before fertilizer
    headland: 6.5, // m along the plot's south edge kept free of crops
    upgrades: [
      { id: 'sprinklers', name: 'Sprinklers', perk: 'Grows 30% faster', step: 0.3, max: 3, price: 0.6, growth: 2.1 },
      { id: 'fertilizer', name: 'Fertilizer', perk: '50% more crops', step: 0.5, max: 3, price: 0.8, growth: 2.1 },
    ],
  },
  // Workers hired at the Farm Office (the cottage), capped by what the farm
  // owns. Price = price * growth^hired. Each works on a timer of `every` s.
  workers: [
    { id: 'stocker', name: 'Stocker', cap: 'coops', capText: 'one per coop', text: 'Carries eggs from the nests to your stand', carry: 16, carryText: 'eggs', every: 18, price: 250, growth: 1.7, look: { shirt: '#d63a2c', pants: '#2c4f8e', hat: 'cap', hatColor: '#d63a2c', item: 'tray' } },
    { id: 'hand', name: 'Field Hand', cap: 'plots', capText: 'one per field you own', text: 'Harvests one field as soon as it is ripe', every: 4, price: 600, growth: 1.6, look: { shirt: '#e0a43a', pants: '#3a5f9a', hat: 'straw', item: 'box' } },
    // Drives its tractor from the Tractor Bay to a ripe field nobody works, sweeps it (harvest +bonus) and drives back.
    { id: 'tractor', name: 'Tractor Driver', cap: 'tractors', capText: 'one per tractor', text: 'Drives a tractor to ripe fields that have no field hand', bonus: 0.3, every: 6, speed: 9, price: 2000, growth: 1.8, look: { shirt: '#3f8a4a', pants: '#2c3e66', hat: 'cap', hatColor: '#f2c230' } },
    // Loads goods from storage (or eggs off the stand) into its truck and sells them in town.
    { id: 'driver', name: 'Truck Driver', cap: 'trucks', capText: 'one per truck', text: 'Drives storage goods to the town market', carry: 40, carryText: 'goods', every: 30, trip: 22, price: 2500, growth: 1.8, look: { shirt: '#2f6fd0', pants: '#2b2b2b', hat: 'beanie', hatColor: '#2b2b2b' } },
    { id: 'rancher', name: 'Rancher', cap: 'ranch', capText: 'one per animal barn', text: 'Collects milk, duck eggs, truffles and ride money', every: 20, price: 3000, growth: 1.7, look: { shirt: '#8a5a3a', pants: '#3a4a6a', hat: 'straw', overalls: '#3d6bb3' } },
    { id: 'oiler', name: 'Oil Worker', cap: 'pumps', capText: 'one per pump jack', text: 'Runs a pump jack: no worker, no oil', every: 1, price: 4000, growth: 1.6, look: { shirt: '#f2a03a', pants: '#3a3a3a', hat: 'cap', hatColor: '#f2c230' } },
  ],
  // Vehicles bought at the town's vehicle dealer (each needs its bay built).
  vehicles: [
    { id: 'tractors', name: 'Tractor', text: 'Drive it over ripe fields to harvest', start: 0, max: 4, price: 2500, growth: 1.8, needs: 'tractorBay' },
    { id: 'trucks', name: 'Truck', text: 'Load at the storage, sell in town', start: 0, max: 4, price: 3000, growth: 1.8, needs: 'truckBay' },
  ],
  // Dealer upgrades for every vehicle of a kind.
  garage: [
    { id: 'bike', name: 'Racing Bike', text: '+12% bike speed (new paint)', step: 0.12, max: 4, price: 300, growth: 2 },
    { id: 'basket', name: 'Cargo Basket', text: '+8 bag space', step: 8, max: 4, price: 250, growth: 2 },
    { id: 'cargo', name: 'Truck Bed', text: '+20 truck cargo (taller stake sides)', step: 20, max: 5, price: 2500, growth: 1.7, needs: 'truckBay' },
    { id: 'truckEngine', name: 'Truck Engine', text: '+12% truck speed (bull bar, twin stacks, light bar)', step: 0.12, max: 3, price: 3500, growth: 1.9, needs: 'truckBay' },
    { id: 'engine', name: 'Tractor Engine', text: '+15% tractor speed and harvest', step: 0.15, max: 4, price: 2000, growth: 1.8, needs: 'tractorBay' },
    { id: 'header', name: 'Harvester Header', text: '+25% tractor harvest (a header on the front)', step: 0.25, max: 3, price: 4500, growth: 1.9, needs: 'tractorBay' },
  ],
  // Farm Office upgrades for every worker.
  crew: [
    { id: 'speed', name: 'Walk Speed', text: '+5% for every worker', step: 0.05, max: 10, price: 800, growth: 1.45 },
    { id: 'carry', name: 'Carry', text: '+20% for every worker', step: 0.2, max: 10, price: 1000, growth: 1.5 },
  ],
  // Drones: the base (a building), then up to `max` drones; each drone's
  // capacity is upgraded on its own. A drone takes goods from storage, flies
  // them to the town market (x `bonus`) and comes back.
  drones: { max: 4, price: 4000, growth: 1.6, cap: 10, capStep: 10, capMax: 5, capPrice: 1500, capGrowth: 1.9, speed: 22, speedStep: 0.15, speedMax: 5, speedPrice: 1200, bonus: 1.1 },
  // Crude oil: pump jacks (each needs an Oil Worker) fill the tank; the rail
  // station loads the tank onto the train when it stops there.
  oil: {
    pumps: 4,
    pumpPrice: 8000,
    pumpGrowth: 1.7,
    every: 10, // s per barrel per pump
    tank: 60, // barrels the tank holds
    barrel: 70, // $ the train pays per barrel
    station: 20, // barrels loaded per train
    // Per pump. Each level shows on the pump (pumpjack.js setLevel).
    upgrades: [
      { id: 'motor', name: 'Motor', perk: 'Pumps 25% faster (gas engine from LV 3)', step: 0.25, max: 5, price: 4000, growth: 1.75 },
      { id: 'drill', name: 'Drill Bit', perk: '+40% oil a stroke (more wellhead gear)', step: 0.4, max: 5, price: 5000, growth: 1.75 },
      { id: 'weights', name: 'Counterweights', perk: '+20% oil a stroke (more weight plates)', step: 0.2, max: 4, price: 3500, growth: 1.8 },
    ],
    refine: { id: 'refine', name: 'Oil Grade', perk: '+15% a barrel', step: 0.15, max: 5, price: 8000, growth: 1.8 },
    crane: { id: 'crane', name: 'Loading Crane', perk: '+20 barrels a train', step: 20, max: 4, price: 6000, growth: 1.9 },
    tankUp: { id: 'tankUp', name: 'Bigger Tank', perk: '+40 barrels', step: 40, max: 4, price: 5000, growth: 1.8 },
  },
  // Ranch animals: each barn starts with `start` animals (at most `max`); each
  // animal makes one `good` every `every` s into the barn's crate (horses earn
  // `cash` $ of ride money instead). Upgrades: +1 animal, Better Feed.
  ranch: [
    { id: 'duckHouse', animal: 'duck', name: 'Duck House', good: 'duckEgg', start: 3, max: 8, every: 12, crate: 30, addPrice: 900 },
    { id: 'cowBarn', animal: 'cow', name: 'Cow Barn', good: 'milk', start: 2, max: 6, every: 16, crate: 20, addPrice: 2000 },
    { id: 'pigPen', animal: 'pig', name: 'Pig Pen', good: 'truffle', start: 2, max: 6, every: 22, crate: 16, addPrice: 3000 },
    { id: 'stables', animal: 'horse', name: 'Horse Stables', cash: 45, start: 2, max: 6, every: 18, crate: 40, addPrice: 5000 },
  ],
  addGrowth: 1.7, // each extra animal costs this much more
  feed: { name: 'Better Feed', perk: 'Animals produce 25% faster', step: 0.25, max: 4, price: 1.2, growth: 1.9 }, // price x the barn's addPrice
  expand: { name: 'Barn Expansion', perk: 'Bigger crate, +10% produce, +15% ride money', max: 3, price: 2, growth: 2.1 }, // price x the barn's addPrice
  // Daily quests (stat: collected | sold | earned).
  quests: [
    { id: 'collect', name: 'Egg Collector', text: 'Collect 40 eggs from the coops', stat: 'collected', goal: 40, reward: 60 },
    { id: 'sell', name: 'Busy Stand', text: 'Sell 60 eggs at the farm stand', stat: 'sold', goal: 60, reward: 100 },
    { id: 'earn', name: 'Money Maker', text: 'Earn $2,000', stat: 'earned', goal: 2000, reward: 300 },
  ],
}

// --- Roadmap expansion (econ/*.js): places ------------------------------------------------------
// The Processing Park west of the farm, north of the road (its buildings face the
// road, south), the ranch's new pens, the apiary north of Field 1, the contracts
// board in town and the trophy shelf on the cottage porch.
//
// The park is written below in its own layout (as if it stood south of the road,
// facing north) and turned half a turn onto its spot, so every farm plot stays on
// the north side of the road. PARK_TURN maps a layout point to the world:
// (x, z) -> (PARK_TURN.x - x, PARK_TURN.z - z) (its own inverse). Each park building
// is turned too: parkAt(p, dx, dz) is the world spot (dx, dz) from p in the
// building's own frame (e.g. parkAt(p, 0, -9) = 9 m in front, toward the road).
export const PARK_TURN = { x: -196, z: 92 }
export const parkAt = (p, dx, dz) => [p.x - dx, p.z - dz]
Object.assign(FARM, {
  park: { minX: -40, maxX: 142, minZ: 58, maxZ: 146 },
  parkLane: { minX: -38, maxX: 140, minZ: 66, maxZ: 74 }, // gravel lane in front of the buildings
  proc: {
    flourMill: { x: -22, z: 92 },
    bakery: { x: 8, z: 92 },
    dairy: { x: 38, z: 92 },
    juicePress: { x: 68, z: 92 },
    refinery: { x: 106, z: 94 },
  },
  workshop: { x: -22, z: 128 },
  fuelStation: { x: 2, z: 126 },
  carWash: { x: 24, z: 128, zone: { minX: 20, maxX: 28, minZ: 122, maxZ: 134 } },
  greenhouse: { x: 54, z: 130 },
  orchard: { minX: 70, maxX: 100, minZ: 112, maxZ: 142 },
  lake: { x: 124, z: 128, w: 30, d: 30, dock: { x: 108, z: 128 } },
  helipad: { x: 128, z: 76 },
  contractBoard: { x: 262, z: 66 },
  priceBoard: { x: 250, z: 66 }, // MARKET PRICES board by the market's car park
  trophies: { x: -77, z: 31 },
  sheepShed: { x: 118, z: -168, pen: { minX: 92, maxX: 128, minZ: -178, maxZ: -146 } },
  goatBarn: { x: 112, z: -224, pen: { minX: 64, maxX: 128, minZ: -232, maxZ: -192 } },
  apiary: { x: -35, z: -82 },
  troughs: {}, // per barn: [x, z], filled in below from ranchCrates
  festival: { x: -98, z: 2 },
  arenaCourse: [[-108, -159], [-96, -166], [-80, -152], [-70, -166], [-74, -151]], // jump spots, in order
})
Object.assign(FARM.ranchCrates, { sheepShed: [104, -138.5], goatBarn: [118, -138.5], apiary: [-24, -73], orchard: [85, 108], greenhouse: [64, 124] })
// Turn the park's layout onto its spot (see PARK_TURN).
{
  const T = PARK_TURN
  const pt = (p) => Object.assign(p, { x: T.x - p.x, z: T.z - p.z })
  const rect = (r) => Object.assign(r, { minX: T.x - r.maxX, maxX: T.x - r.minX, minZ: T.z - r.maxZ, maxZ: T.z - r.minZ })
  for (const r of [FARM.park, FARM.parkLane, FARM.orchard, FARM.carWash.zone]) rect(r)
  for (const p of [...Object.values(FARM.proc), FARM.workshop, FARM.fuelStation, FARM.carWash, FARM.greenhouse, FARM.lake, FARM.lake.dock, FARM.helipad]) pt(p)
  for (const id of ['orchard', 'greenhouse']) {
    const [x, z] = FARM.ranchCrates[id]
    FARM.ranchCrates[id] = [T.x - x, T.z - z]
  }
}
for (const id in FARM.ranchCrates) {
  const [x, z] = FARM.ranchCrates[id]
  FARM.troughs[id] = [x - 4.2, z]
}

// --- Roadmap expansion: economy ---------------------------------------------------------------------
Object.assign(GAME.goods, {
  flour: { name: 'Flour', market: 16, color: '#f6f1e4' },
  bread: { name: 'Bread', market: 70, color: '#c98a3c' },
  cake: { name: 'Cakes', market: 130, color: '#f4b6c8' },
  cheese: { name: 'Cheese', market: 110, color: '#f6cf4a' },
  butter: { name: 'Butter', market: 70, color: '#f8e27a' },
  juice: { name: 'Juice', market: 60, color: '#f39a2a' },
  fuel: { name: 'Fuel', market: 220, color: '#e94a3a' },
  wool: { name: 'Wool', market: 30, color: '#f2efe6' },
  goatMilk: { name: 'Goat Milk', market: 26, color: '#fbf7ec' },
  goatCheese: { name: 'Goat Cheese', market: 130, color: '#efe6c8' },
  honey: { name: 'Honey', market: 45, color: '#f2b01e' },
  apple: { name: 'Apples', market: 14, color: '#d8322c' },
  tomato: { name: 'Tomatoes', market: 18, color: '#e5402c' },
  fish: { name: 'Fish', market: 35, color: '#7fb0d8' },
  goldenEgg: { name: 'Golden Eggs', market: 500, color: '#ffd23a' },
})
GAME.buildings.push(
  { id: 'flourMill', name: 'Flour Mill', kind: 'PROCESSING', perk: 'Wheat into flour', price: 9000, x: -22, z: 78, needs: ['storage'] },
  { id: 'bakery', name: 'Bakery', kind: 'PROCESSING', perk: 'Flour + eggs into bread and cakes', price: 16000, x: 8, z: 78, needs: ['flourMill'] },
  { id: 'dairy', name: 'Dairy', kind: 'PROCESSING', perk: 'Milk into cheese and butter', price: 14000, x: 38, z: 78, needs: ['cowBarn'] },
  { id: 'juicePress', name: 'Juice Press', kind: 'PROCESSING', perk: 'Carrots and pumpkins into juice', price: 20000, x: 68, z: 78, needs: ['flourMill'] },
  { id: 'refinery', name: 'Oil Refinery', kind: 'PROCESSING', perk: 'Crude oil into fuel', price: 45000, x: 106, z: 80, needs: ['oilField'] },
  { id: 'workshop', name: 'Workshop', kind: 'VEHICLES', perk: 'Repair worn vehicles', price: 5000, x: -22, z: 116, needs: ['truckBay'] },
  { id: 'fuelStation', name: 'Fuel Station', kind: 'VEHICLES', perk: 'Refuel your vehicles', price: 3000, x: 2, z: 116, needs: ['tractorBay'] },
  { id: 'carWash', name: 'Car Wash', kind: 'VEHICLES', perk: 'A clean vehicle drives faster', price: 8000, x: 24, z: 116, needs: ['workshop'] },
  { id: 'sheepShed', name: 'Sheep Shed', kind: 'RANCH', perk: 'Sheep grow wool to shear', price: 9000, x: 104, z: -138.5, needs: ['cowBarn'] },
  { id: 'goatBarn', name: 'Goat Barn', kind: 'RANCH', perk: 'Goats give goat milk', price: 15000, x: 118, z: -138.5, needs: ['sheepShed'] },
  { id: 'apiary', name: 'Apiary', kind: 'RANCH', perk: 'Bees make honey (sunflowers help)', price: 6000, x: -24, z: -73, needs: ['seedMarket'] },
  { id: 'helipad', name: 'Helipad', kind: 'AIR CARGO', perk: 'A helicopter flies big loads away', price: 60000, x: 128, z: 64, needs: ['droneBase'] },
  { id: 'orchard', name: 'Apple Orchard', kind: 'LEVEL 5', perk: 'Apple trees', price: 12000, x: 85, z: 108, needs: ['storage'], level: 5 },
  { id: 'lake', name: 'Fishing Lake', kind: 'LEVEL 8', perk: 'Fish off the dock', price: 20000, x: 104, z: 116, needs: ['storage'], level: 8 },
  { id: 'greenhouse', name: 'Greenhouse', kind: 'LEVEL 12', perk: 'Tomatoes all year round', price: 30000, x: 64, z: 124, needs: ['storage'], level: 12 },
)
// The park buildings' pads are in the park's layout too: turn them onto its spot.
for (const b of GAME.buildings) {
  if (!['flourMill', 'bakery', 'dairy', 'juicePress', 'refinery', 'workshop', 'fuelStation', 'carWash', 'helipad', 'orchard', 'lake', 'greenhouse'].includes(b.id)) continue
  b.x = PARK_TURN.x - b.x
  b.z = PARK_TURN.z - b.z
}
GAME.ranch.push(
  { id: 'sheepShed', animal: 'sheep', plural: 'sheep', name: 'Sheep Shed', good: 'wool', start: 3, max: 8, every: 20, crate: 30, addPrice: 2500, hold: true },
  { id: 'goatBarn', animal: 'goat', name: 'Goat Barn', good: 'goatMilk', start: 2, max: 6, every: 18, crate: 24, addPrice: 3500 },
  { id: 'apiary', animal: 'hive', name: 'Apiary', good: 'honey', start: 3, max: 8, every: 26, crate: 24, addPrice: 2000, plant: true },
  { id: 'orchard', animal: 'apple tree', name: 'Apple Orchard', good: 'apple', start: 8, max: 16, every: 9, crate: 60, addPrice: 1500, plant: true },
  { id: 'greenhouse', animal: 'planter', name: 'Greenhouse', good: 'tomato', start: 4, max: 10, every: 7, crate: 50, addPrice: 3000, plant: true },
)
GAME.workers.find((w) => w.id === 'rancher').text = 'Collects, shears and refills troughs at one ranch building'

Object.assign(GAME, {
  // Processing buildings: each cycle turns `in` (from storage) into `out` x batch;
  // the best paying recipe with its inputs in store runs. Batch = 1 + Capacity level.
  // Crude oil comes from the oil tank (barrels), not storage.
  proc: [
    { id: 'flourMill', name: 'Flour Mill', worker: 'Miller', every: 8, crate: 30, recipes: [{ out: 'flour', n: 1, in: { wheat: 2 } }] },
    { id: 'bakery', name: 'Bakery', worker: 'Baker', every: 14, crate: 20, recipes: [{ out: 'cake', n: 1, in: { flour: 2, egg: 4, milk: 1 } }, { out: 'bread', n: 1, in: { flour: 2, egg: 2 } }] },
    { id: 'dairy', name: 'Dairy', worker: 'Cheesemaker', every: 12, crate: 20, recipes: [{ out: 'goatCheese', n: 1, in: { goatMilk: 3 } }, { out: 'cheese', n: 1, in: { milk: 3 } }, { out: 'butter', n: 1, in: { milk: 2 } }] },
    { id: 'juicePress', name: 'Juice Press', worker: 'Presser', every: 10, crate: 24, recipes: [{ out: 'juice', n: 3, in: { pumpkin: 2 } }, { out: 'juice', n: 1, in: { carrot: 3 } }, { out: 'juice', n: 1, in: { apple: 4 } }] },
    { id: 'refinery', name: 'Oil Refinery', worker: 'Refiner', every: 16, crate: 16, recipes: [{ out: 'fuel', n: 1, in: { crude: 2 } }] },
  ],
  procUp: {
    speed: { name: 'Faster Machines', perk: '+30% speed', step: 0.3, max: 4, price: 0.5, growth: 1.9 }, // price x the building price
    cap: { name: 'Bigger Batches', perk: '+1 per cycle, bigger crate', max: 4, price: 0.6, growth: 2 },
    worker: { price: 0.35, speed: 1.5, every: 12 }, // hire price x building price; works 50% faster, crate -> storage every 12 s
  },
  // Contracts board (town): 3 at a time, each wants 1-3 goods the farm has discovered.
  contracts: { slots: 3, time: [360, 720], pay: [1.5, 2], size: [12, 50], refresh: 25, bonusSeeds: 3 },
  // Market prices drift +-25% over a day; one hot item a day sells for 2x.
  prices: { drift: 0.25, hot: 2 },
  // Day/night: one in-game day lasts `day` s (80% light, 20% night).
  clock: { day: 600, light: 0.8, start: 0.15, night: { lay: 0.55, customers: 0.45 } },
  // Weather: s between changes and the chance of each.
  weather: {
    every: [120, 240],
    odds: { clear: 0.5, rain: 0.22, wind: 0.18, storm: 0.1 },
    rain: { grow: 1.4 },
    wind: { drone: 0.75 },
    storm: { grow: 1.25, vehicle: 0.8, lightning: [5, 14] },
  },
  // Seasons: `days` in-game days each, autumn first (the farm's own look).
  seasons: {
    days: 2,
    order: ['autumn', 'spring', 'summer'],
    autumn: { name: 'Autumn', grow: 1, customers: 1 },
    spring: { name: 'Spring', grow: 1.25, customers: 1, seedBonus: 0.6 },
    summer: { name: 'Summer', grow: 1.1, customers: 1.25 },
  },
  // The Pumpkin Weigh-off Festival: on the last autumn day, judged at the end.
  festival: { enabled: false, from: 0.2, to: 0.6, perLb: 18, xp: 400 }, // enabled: false = event switched off for now
  // Animal care: troughs empty over `food` / `water` s; happiness scales production.
  care: { food: 420, water: 300, min: 0.25, sad: 0.35, happy: 0.8, feeder: { price: 2.5 }, refillBelow: 0.45 },
  babyGrow: 180, // s for a newborn animal to grow up
  // Sheep shearing: hold E this long.
  shear: { hold: 1.2 },
  // Horse riding and the arena jumping course.
  horse: { speed: 15, turn: 3.2, accel: 18, jump: 11 },
  course: { prize: 2500, par: 40, bonus: 2, penalty: 3, clocks: 3 },
  // Fishing at the lake dock: wait for a bite, then press E in time.
  fishing: { wait: [2.5, 6], window: 1.1, weights: [[0.6, 1], [0.3, 2], [0.1, 4]] },
  // New vehicles (dealer). `kind` is what the player rides; `service` ones run on their own.
  fleet: [
    { id: 'combine', name: 'Combine Harvester', text: 'Harvests a whole field in one pass (+60%)', price: 18000, needs: 'storage', ride: true, speed: 9, turn: 1.9, accel: 9, bonus: 0.6 },
    { id: 'sprayer', name: 'Crop Sprayer', text: 'Drive over growing fields: they grow 2x for a minute', price: 7000, needs: 'tractorBay', ride: true, speed: 13, turn: 2.6, accel: 12, boost: 2, boostTime: 60 },
    { id: 'tanker', name: 'Milk Tanker', text: 'Drives milk and goat milk from storage to town (+20%)', price: 12000, needs: 'cowBarn', every: 50, load: 40, bonus: 1.2 },
    { id: 'trailer', name: 'Livestock Trailer', text: 'Sell grown animals from the ranch barns', price: 5000, needs: 'cowBarn', sell: 0.6 },
    { id: 'heli', name: 'Cargo Helicopter', text: 'Flies big storage loads to the city (+50%)', price: 40000, needs: 'helipad', every: 90, load: 120, bonus: 1.5 },
  ],
  // Fuel and wear (truck, tractor, combine, sprayer): litres per km driven, wear per km.
  fuel: { tank: 60, perKm: 6, wearPerKm: 0.02, empty: 0.3, worn: 0.75, price: 3, repair: 1200, fuelGood: 20 }, // fuelGood: litres one Fuel (refinery) gives
  wash: { boost: 0.15, time: 120 },
  // Customisation at the dealer (per vehicle kind): paints, rims, light bar, horn.
  looks: {
    paints: ['#d6322c', '#2f6fd0', '#3f9a3a', '#f2a03a', '#7a3fb0', '#1f2124', '#f4f1e8', '#e85aa0'],
    rims: ['#cfd4d8', '#ffd23a', '#1f2124', '#d6322c'],
    paintPrice: 400, rimPrice: 300, barPrice: 900,
    horns: [{ id: 'classic', name: 'Classic', price: 0 }, { id: 'truck', name: 'Air Horn', price: 500 }, { id: 'tune', name: 'La Cucaracha', price: 1500 }, { id: 'moo', name: 'Moo Horn', price: 800 }],
  },
  // Farm level: XP for money earned, buildings, harvests; level n needs xp.base * n^xp.pow.
  xp: { perDollar: 0.05, build: 120, harvest: 6, collect: 1, contract: 150, base: 120, pow: 1.6, max: 50, levelCash: 250 },
  // Achievements: stat (lifetime) reaching goal. medal = trophy colour.
  achievements: [
    { id: 'eggs1', name: 'Egg Hunter', text: 'Collect 500 eggs', stat: 'eggs', goal: 500, medal: 'bronze' },
    { id: 'eggs2', name: 'Egg Tycoon', text: 'Sell 10,000 eggs', stat: 'eggsSold', goal: 10000, medal: 'gold' },
    { id: 'corn', name: 'Corn Star', text: 'Harvest 1,000 corn', stat: 'h_corn', goal: 1000, medal: 'silver' },
    { id: 'wheat', name: 'Amber Waves', text: 'Harvest 2,000 wheat', stat: 'h_wheat', goal: 2000, medal: 'bronze' },
    { id: 'pump', name: 'Gourd Lord', text: 'Harvest 300 pumpkins', stat: 'h_pumpkin', goal: 300, medal: 'silver' },
    { id: 'bread', name: 'Master Baker', text: 'Bake 200 bread', stat: 'p_bread', goal: 200, medal: 'silver' },
    { id: 'cheese', name: 'Big Cheese', text: 'Make 150 cheese', stat: 'p_cheese', goal: 150, medal: 'silver' },
    { id: 'zoo', name: 'Noah\'s Farm', text: 'Own every kind of animal', stat: 'animalKinds', goal: 7, medal: 'gold' },
    { id: 'contracts', name: 'Dealmaker', text: 'Complete 25 contracts', stat: 'contracts', goal: 25, medal: 'gold' },
    { id: 'rich', name: 'Millionaire', text: 'Earn $1,000,000', stat: 'earned', goal: 1000000, medal: 'gold' },
    { id: 'fish', name: 'Angler', text: 'Catch 50 fish', stat: 'fish', goal: 50, medal: 'bronze' },
    { id: 'golden', name: 'Lucky Hen', text: 'Find a golden egg', stat: 'golden', goal: 1, medal: 'silver' },
    { id: 'rider', name: 'Show Jumper', text: 'Finish the jumping course', stat: 'courses', goal: 1, medal: 'bronze' },
    { id: 'combo', name: 'On a Roll', text: 'Reach a x10 combo', stat: 'bestCombo', goal: 10, medal: 'bronze' },
    { id: 'builder', name: 'Master Builder', text: 'Build 20 buildings', stat: 'buildings', goal: 20, medal: 'gold' },
  ],
  // Prestige: sell the farm (needs `minEarned` lifetime) for +`step` money boost each time.
  prestige: { minEarned: 250000, step: 0.25, maxBoost: 5 },
  // Zone foremen: hired at the Farm Office, spend up to their budget a minute on their zone.
  managers: [
    { id: 'yard', name: 'Yard Foreman', zone: 'Coops and stand', price: 5000 },
    { id: 'fields', name: 'Field Foreman', zone: 'Fields and seeds', price: 8000 },
    { id: 'ranch', name: 'Ranch Foreman', zone: 'Ranch barns', price: 12000 },
    { id: 'oil', name: 'Oil Foreman', zone: 'Oil field', price: 20000 },
  ],
  managerBudgets: [0, 500, 2000, 10000, 50000], // $ a minute
  managerEvery: 6, // s between purchases
  // Combo: manual collects within `window` s chain; each step adds `step` to a multiplier
  // on a small cash bonus, up to `max`.
  combo: { window: 4, step: 0.1, max: 3, cash: 2 },
  rare: { chance: 0.01, giant: 5 }, // golden egg / giant crop chance; a giant crop yields 5x
  tutorial: [
    { id: 'collect', text: 'Collect eggs from Coop 1', sub: 'Walk past the nest crate' },
    { id: 'stand', text: 'Sell your eggs at the egg stand', sub: 'Walk up to the stand counter: customers buy what you stock' },
    { id: 'collect2', text: 'Collect eggs from Coop 1 again', sub: 'Walk past the nest crate' },
    { id: 'ride', text: 'Hop on the bike', sub: 'Press E (or tap the prompt) next to it' },
    { id: 'market', text: 'Sell your eggs at the town market', sub: 'Ride east along the road into the SELL HERE zone' },
    { id: 'coop2', text: 'Buy Coop 2', sub: 'Stand on its build pad' },
    { id: 'office', text: 'Buy the Farm Office', sub: 'Stand on its build pad by the cottage to hire workers' },
  ],
  // Visitors: walkers per customer a minute, horse riders per horse.
  visitors: { perCustomer: 0.25, max: 8, vetEvery: [180, 360] },
  // Distance (m) beyond which small moving models are hidden (phone performance).
  lod: { far: 70, farLow: 50 },
})
// Phone performance: shadows on small moving parts stay on for these presets only.
export const SMALL_SHADOWS = { Low: false, Medium: false, High: true, Ultra: true }

// --- Performance (perf.js) ------------------------------------------------------
// Draw distance: every mesh / sprite in the scene stops drawing once it would look smaller than
// `angle` (its radius / its distance from the camera, ~ a few pixels), never closer than `near` m
// and always beyond `far` m (measured to its near edge, so hills and big merged buildings stay).
// Hidden meshes skip the main and the shadow pass. Flag a group `userData.noCull` to keep it out.
export const CULL = {
  Low: { angle: 0.008, near: 50, far: 650 },
  Medium: { angle: 0.005, near: 60, far: 950 },
  High: { angle: 0.003, near: 70, far: 1400 },
  Ultra: { angle: 0.002, near: 90, far: Infinity },
  pass: 0.25, // s for one sweep over every mesh (spread over the frames in between)
  rescan: 2, // s between looks for meshes added since (bought buildings, other farms)
}
// Auto resolution: when the frame rate stays under `lowFps` for `lowFor` s the pixel ratio steps
// down by `step` (to no less than `minScale` x the preset's); it climbs back once the game holds
// `highFps` for `highFor` s. Windows open (the scene behind them drawn at half rate) do not count.
export const AUTO_RES = { lowFps: 45, highFps: 56, lowFor: 2, highFor: 5, step: 0.15, minScale: 0.6, minDpr: 0.6 }

// --- Audio (audio/) --------------------------------------------------------------------
export const AUDIO = {
  volume: 0.8,
  storageKey: 'run-a-farm.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.6, engine: 0.5 },
  duck: 0.45,
  maxVoices: 64,
  maxVoicesTouch: 32,
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  // Overlap control (core.js voice()): the same named sound is skipped if started again within
  // `sameGap` s or with `maxSame` copies still sounding; `headroom` trims the bus glue's
  // automatic makeup gain before the limiter + soft clipper.
  sameGap: 0.06,
  maxSame: 3,
  headroom: 0.7,
  // Outdoor farm reverb: little pre-delay, a few soft reflections off the barn and bay walls, short airy tail.
  reverb: { seconds: 1.6, preDelay: 0.018, early: [[23, 0.32], [41, 0.22], [67, 0.15], [103, 0.09]], decay: 1.1, tail: 0.13, darken: 2.2, send: 0.8 },
  // Positional sounds: full level inside `near` m, fading to silence at `far` m (from the player).
  near: 4,
  // Global ambience levels (audio/farm.js).
  wind: 0.16,
  leaves: 0.05,
  birds: 0.07,
  birdEvery: [1.2, 4.5], // s between bird phrases
  crickets: 0.03,
  // Area sources: level, far (m).
  chickens: { cluck: 0.32, far: 34, perHen: [5, 16] }, // s between one hen's calls
  rooster: { gain: 0.3, every: [40, 90], far: 90 },
  crowd: { gain: 0.11, far: 30 },
  register: { gain: 0.2, every: [7, 16] },
  truck: { gain: 0.42, far: 32 },
  wheat: { gain: 0.16, far: 26 },
  pads: { gain: 0.05, far: 9 },
  barn: { gain: 0.14, far: 30 },
  turbines: { gain: 0.05, far: 420 },
  footsteps: { gain: 0.32, stride: 1.55 }, // m per step at walking pace
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- Multiplayer: the farms around the town (net.js, farm/remote.js) ---------------------------------
// A room holds `slots` players (backend FARM_SLOTS / ROOM_MAX_CLIENTS); each holds one farm slot.
// The farm summary goes up at most every `farmEvery` s when it changed; the pose `poseHz` times a
// second while moving. Remote players are drawn as farmers with a name tag in `shirts` colours.
GAME.net = {
  slots: 4,
  farmEvery: 4,
  poseHz: 6,
  shirts: ['#d63a2c', '#2f6fd0', '#e0a43a', '#8a5ad8'],
}
