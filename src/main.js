import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput, onKey, onWorldClick } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { getPitch, getYaw, setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createWorld } from './world.js'
import { buildFarm } from './farm/index.js'
import { initGround, liftPlayer, updateGround } from './farm/ground.js'
import { createHud } from './hud/hud.js'
import { closeTopWindow } from './hud/window.js'
import { hand, selectHotbar } from './game.js'
import { mount } from './mount.js'
import { getMode } from './modes.js'
import * as audioCore from './audio/core.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { install as installNet, sendEmote, sendPose, setLook, setRide } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { EmotePlayer, captureBind } from './avatar/emotes.js'
import { speechBubble } from './bubble.js'
import { createHeld } from './held.js'
import { installEcon, tickEcon } from './econ/index.js'
import { skipToNext } from './econ/clock.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> sky + lighting, the farm,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
// Esc closes an open HUD window first, otherwise opens the portal menu.
installInput(() => endCine() || closeTopWindow() || bloxity.showMenu(), renderer.domElement)

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const world = createWorld(scene) // the clouds
bloxity.loadingStep('Building the farm')
const farm = buildFarm(scene, lighting, preset)
initGround(scene) // the drawn ground the player and vehicles stand on (ridges, slabs, ballast)
// Respawning (R, HOME, the portal) gets off whatever the player rides first.
const goHome = () => {
  farm.farm.rideables.dismount()
  respawn()
}
installEcon({ lighting })
installNet()
const hud = createHud({ farm: farm.farm, actions: { home: goHome, dayNight: skipToNext, overview: () => startOverview(), photo: () => startPhoto() } })
bloxity.onReservedAreas((areas) => hud.setReserved(areas))
audioCore.installAudio()
createPlayerBody()
syncYawToPlayer()

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false
const emote = new EmotePlayer() // the Bloxity emote we are playing (portal emote wheel)
const held = createHeld(playerGroup) // the item in the player's hands (game.js `hand`)

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  captureBind(next) // emotes pose bones as deltas over the bind pose
  emote.stop()
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))

// --- Multiplayer: our look for the others, the others themselves, emotes, chat -------------------
// Our Bloxity look goes to the room as ids (signed in; a guest is the default character).
const shareLook = () => (bloxity.authState.user ? setLook(bloxity.getEquippedAvatar(), bloxity.getProportions()) : setLook(null))
bloxity.subscribeAuth(shareLook)
bloxity.onAvatarChanged(shareLook)
bloxity.onProportionsChanged(shareLook)
const remotePlayers = createRemotePlayers(scene, { mapPose: farm.farm.remote?.mapPose })
// Emotes from the portal's wheel: played on our avatar (standing, on foot) and relayed.
bloxity.onEmote(async (id) => {
  if (mount.active) return
  const clip = (await bloxity.emoteClips()).get(id)
  if (!clip) return // unknown ids are ignored quietly
  emote.play(id, clip)
  sendEmote(id)
})
// Chat: our own message as a bubble over our head (the others' in remotePlayers.js).
let myBubble = null
bloxity.onChat((m) => {
  if (!m.isLocalPlayer) return
  myBubble?.remove?.()
  myBubble = speechBubble(playerGroup, m.text, 2.9)
})
bloxity.onRespawnRequest(goHome)

// --- Modes + keys --------------------------------------------------------------
onModeChanged(() => {})
// First person: you are the camera; inside a truck's cab the avatar is hidden too.
const avatarShown = () => getMode() !== 'player' && mount.active?.seat !== 'hidden'
// How high the avatar sits on what it rides (feet = the vehicle's ground).
const SEAT_Y = { bike: 0.42, seat: 0.78, horse: 1.45 }
onKey('KeyV', toggleMode)
onKey('KeyN', skipToNext)
onKey('KeyR', goHome)
onKey('KeyE', () => hud.interact())
onWorldClick((e, locked) => hud.click(e, locked))
for (let i = 1; i <= 9; i++) onKey(`Digit${i}`, () => selectHotbar(i - 1))
installTouch({ mode: toggleMode, day: skipToNext, respawn: goHome })

// --- Overview fly-over and photo mode (roadmap 7) ---------------------------------
// Overview: a slow aerial circle over the farm. Photo: a free camera (move keys /
// joystick fly it, mouse / drag looks) with the HUD hidden. Both end with Esc,
// the on-screen button or (overview) any key.
let cine = null // { kind, t, pos }
const cineBtn = document.createElement('button')
cineBtn.type = 'button'
cineBtn.className = 'cine-exit'
cineBtn.textContent = 'EXIT'
cineBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  e.stopPropagation()
  endCine()
})
document.body.append(cineBtn)
function startCine(kind) {
  closeTopWindow()
  cine = { kind, t: 0, pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z } }
  inputState.frozen = kind === 'photo'
  document.body.classList.add('cine')
  cineBtn.textContent = kind === 'photo' ? 'EXIT PHOTO MODE' : 'EXIT OVERVIEW'
}
function endCine() {
  if (!cine) return false
  cine = null
  inputState.frozen = false
  document.body.classList.remove('cine')
  return true
}
const startOverview = () => startCine('overview')
const startPhoto = () => startCine('photo')
window.addEventListener('keydown', (e) => {
  if (cine?.kind === 'overview' && e.code !== 'Escape') endCine()
})
function updateCine(dt, t) {
  cine.t += dt
  if (cine.kind === 'overview') {
    const a = cine.t * 0.05 + 0.6
    const r = 200 + Math.sin(cine.t * 0.11) * 40
    camera.position.set(Math.sin(a) * r, 80 + Math.sin(cine.t * 0.07) * 20, -40 + Math.cos(a) * r)
    camera.lookAt(0, 0, -40)
    return
  }
  // Photo: fly along the view.
  const yaw = getYaw()
  const pitch = getPitch()
  const mv = inputState.move
  const sp = (inputState.sprint ? 36 : 14) * dt
  const fx = -Math.sin(yaw) * Math.cos(pitch)
  const fz = -Math.cos(yaw) * Math.cos(pitch)
  const fy = -Math.sin(pitch)
  cine.pos.x += (fx * mv.z + Math.cos(yaw) * mv.x) * sp
  cine.pos.z += (fz * mv.z - Math.sin(yaw) * mv.x) * sp
  cine.pos.y = Math.max(0.6, cine.pos.y + fy * mv.z * sp)
  camera.position.set(cine.pos.x, cine.pos.y, cine.pos.z)
  camera.lookAt(cine.pos.x + fx, cine.pos.y + fy, cine.pos.z + fz)
  void t
}

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let viewOverride = null // dev: a fixed camera for inspecting the scene (__game.view)
let shownLoading = true
let readySince = 0

let simTime = 0
function frame(dtOverride) {
  const dt = dtOverride ?? Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  simTime += dt
  const elapsed = simTime

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()
  updateGround(dt)
  liftPlayer(player, dt) // feet (and the ridden vehicle) onto drawn ground that has no collider

  const p = player.renderPosition
  const seat = mount.active?.seat
  playerGroup.visible = avatarShown()
  playerGroup.position.set(p.x, p.y + (SEAT_Y[seat] ?? 0), p.z)
  playerGroup.rotation.y = player.facing
  if (seat === 'seat') playerGroup.position.add({ x: -Math.sin(player.facing) * 0.75, y: 0, z: -Math.cos(player.facing) * 0.75 }) // the tractor seat is behind the axle
  if (seat === 'bike') playerGroup.position.add({ x: -Math.sin(player.facing) * 0.18, y: 0, z: -Math.cos(player.facing) * 0.18 })
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
    ride: seat === 'bike' ? 'bike' : seat ? 'seat' : null,
    carry: !!hand.kind && !seat && !emote.active,
  })
  // An emote plays over the idle pose and stops as soon as we move or get on something.
  if (emote.active && (seat || Math.hypot(player.velocity.x, player.velocity.z) > 0.6 || !player.grounded)) {
    emote.stop()
    sendEmote('')
  }
  emote.update(avatar, dt)
  held.update(avatar, hand, !seat && !emote.active)
  setRide(mount.active?.kind ?? '', seat ?? '')

  updateCamera(camera, dt)
  if (cine) updateCine(dt, elapsed)
  if (viewOverride) {
    camera.position.set(viewOverride[0], viewOverride[1], viewOverride[2])
    camera.lookAt(viewOverride[3], viewOverride[4], viewOverride[5])
  }
  world.update(dt, elapsed)
  farm.update(dt, elapsed, player, camera)
  remotePlayers.update(dt, elapsed, player.renderPosition, camera)
  {
    const rp = player.renderPosition
    sendPose(rp.x, rp.y, rp.z, player.facing, Math.hypot(player.velocity.x, player.velocity.z))
  }
  hud.update(dt, player.renderPosition, camera)
  tickEcon(dt, player)
  lighting.update(dt, playerGroup.position)
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
}
renderer.setAnimationLoop(() => frame())
// Ad breaks: the loop stops and the sound mutes until the break ends (Bloxity rule).
let mutedBeforeAd = false
bloxity.onAdBreak((on) => {
  if (on) {
    mutedBeforeAd = audioCore.isMuted()
    audioCore.setMuted(true)
    renderer.setAnimationLoop(null)
  } else {
    audioCore.setMuted(mutedBeforeAd)
    clock.getDelta() // don't count the break as one huge frame
    renderer.setAnimationLoop(() => frame())
  }
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  const view = (...v) => (viewOverride = v.length ? v : null)
  // step(n, dt): run n frames by hand (a hidden tab pauses the animation loop).
  const step = (n = 1, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) frame(dt)
  }
  window.__game = { player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, farm, lighting, view, audio: audioCore, hud, step }
}
