// The other players in the town, as themselves: the Bloxity base rig in their own look (equipped
// items, skin, proportions; relayed as ids, never URLs), the locomotion animator, the emotes they
// play from the portal's emote wheel, a Bloxity chat bubble when they talk, a name tag, and the
// vehicle they ride (bike, tractor, truck, combine, sprayer, horse) with its wheels turning.
// Positions come from the roster (net.js roster(), sent at GAME.net.poseHz by each client) and are
// mapped region to region by farm/remote.js mapPose (their home farm <-> the slot we draw it at).
//
// Kept cheap for a big world:
//  - snapshot interpolation (a short delay buffer) instead of per-frame network data
//  - distance LOD: full detail near, animator at a low rate and no shadows further out, the name
//    tag dropped, and nothing drawn at all past REMOTE.hide m
//  - no animator work for players outside the camera frustum
//  - avatar builds queued one at a time (nearest first) and only for players in draw range
//  - vehicles pooled per kind and reused across riders
import { Frustum, Group, Matrix4, Sphere, Vector3 } from 'three'
import { inRoom, mySlot, roomKey, roster, serverNow } from './net.js'
import * as bloxity from './bloxity.js'
import { label } from './propkit.js'
import { speechBubble } from './bubble.js'
import { groundHeight } from './farm/terrain.js'
import { bicycle, combineHarvester, cropSprayer, farmTruck, tractor } from './farm/vehicles.js'
import { horse, gait } from './farm/animals.js'
import { updateRig } from './farm/rig.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { EmotePlayer, captureBind } from './avatar/emotes.js'

export const REMOTE = {
  delay: 0.22, // s the drawn pose trails the newest sample (a little over one 6 Hz pose)
  near: 45, // m: full detail (shadows, every-frame animation) inside this
  far: 110, // m: name tag hidden and animation at `farHz` past `near`
  farHz: 12,
  hide: 220, // m: not drawn at all past this
  tagY: 2.45, // name tag height over the feet
  bubbleY: 2.9, // chat bubble height
  snap: 30, // m: a jump this big snaps instead of sliding
}
// How high the rider sits on each seat (main.js SEAT_Y), and how far behind the axle a tractor seat is.
const SEAT_Y = { bike: 0.42, seat: 0.78, horse: 1.45 }
const SEAT_BACK = { seat: 0.75, bike: 0.18 }
const VEHICLES = {
  bike: () => bicycle(),
  tractor: () => tractor(),
  truck: () => farmTruck('#2f6fd0', 'FARM'),
  combine: () => combineHarvester(),
  sprayer: () => cropSprayer(),
  horse: () => {
    const h = horse(5)
    return { ...h, horse: h }
  },
}

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const lerpAngle = (a, b, t) => a + angleDelta(a, b) * t

// --- Avatar builds: one at a time ---------------------------------------------------------------------
let loading = Promise.resolve()
function queueBuild(fn) {
  const job = loading.then(fn, fn)
  loading = job.catch(() => {})
  return job
}

// --- Vehicle pool --------------------------------------------------------------------------------------
const pool = new Map() // kind -> [vehicle]
function takeVehicle(kind, parent) {
  const make = VEHICLES[kind]
  if (!make) return null
  const free = pool.get(kind)?.pop()
  let v = free
  if (!v) {
    try {
      v = make()
    } catch (err) {
      console.warn('[remotePlayers] vehicle build failed', kind, err)
      return null
    }
    v.kind = kind
    if (v.driver) v.driver.visible = false // the rider is the avatar
    if (v.stand) v.stand.visible = false // the bike's kickstand is up
    v.g.traverse((o) => {
      if (o.isMesh) o.castShadow = false
    })
  }
  parent.add(v.g)
  v.g.visible = true
  if (v.rig) v.rig.s = null // restart the rig's motion tracking at the new place
  return v
}
function giveVehicle(v) {
  if (!v) return
  v.g.removeFromParent()
  if (!pool.has(v.kind)) pool.set(v.kind, [])
  pool.get(v.kind).push(v)
}

class Remote {
  constructor(parent, id) {
    this.id = id
    this.parent = parent
    this.group = new Group()
    this.group.name = `remote:${id}`
    parent.add(this.group)
    this.body = new Group() // the avatar, lifted onto a seat while riding
    this.group.add(this.body)
    this.avatar = null
    this.animator = null
    this.emote = new EmotePlayer()
    this.emoteKey = ''
    this.lookJson = null // what the current rig was built from
    this.generation = 0
    this.name = ''
    this.tag = null
    this.bubble = null
    this.vehicle = null
    this.rideKey = ''
    this.samples = [] // { t, x, y, z, yaw, speed } in our world, oldest first
    this.lastKey = ''
    this.placed = false
    this.vy = 0
    this.prevY = 0
    this.animDt = 0
    this.shadows = true
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.body.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    captureBind(next)
    this.body.add(next)
    this.animator = makeAnimator(next)
    this.emote.stop()
    const on = this.shadows
    this.shadows = null // re-apply the current shadow state to the new rig
    this.setShadows(on)
  }

  setShadows(on) {
    if (on === this.shadows) return
    this.shadows = on
    this.avatar?.traverse((o) => {
      if (o.isMesh) o.castShadow = on
    })
  }

  // The look arrives as JSON { equipped, proportions } ("" = the default character).
  syncLook(json) {
    if (json === this.lookJson) return
    this.lookJson = json
    const mine = ++this.generation
    let look = null
    try {
      look = json ? JSON.parse(json) : null
    } catch {
      look = null
    }
    queueBuild(async () => {
      if (mine !== this.generation) return
      const group = await loadBaseCharacter()
      if (mine !== this.generation) return
      if (look?.equipped) {
        const skin = bloxity.skinTextureUrlFor(look.equipped) ?? undefined
        await attachEquippedAccessories(group, look.equipped, { skinTextureUrl: skin })
        if (mine !== this.generation) return
      }
      applyProportions(group, look?.proportions ?? null)
      this.setAvatar(group)
    }).catch((err) => console.warn('[remotePlayers] avatar load failed', err))
  }

  syncName(name) {
    if (name === this.name && this.tag) return
    this.name = name
    if (this.tag) {
      this.group.remove(this.tag)
      this.tag.material.map?.dispose()
      this.tag.material.dispose()
    }
    this.tag = label(name || 'Farmer', 0.5, { color: '#ffffff' })
    this.tag.position.y = REMOTE.tagY
    this.group.add(this.tag)
  }

  syncRide(ride) {
    if (ride === this.rideKey) return
    this.rideKey = ride
    giveVehicle(this.vehicle)
    this.vehicle = null
    const [kind, seat] = ride ? ride.split('/') : ['', '']
    this.seat = kind ? seat || 'seat' : ''
    if (kind) this.vehicle = takeVehicle(kind, this.parent)
    this.body.visible = this.seat !== 'hidden'
    this.body.position.set(0, SEAT_Y[this.seat] ?? 0, -(SEAT_BACK[this.seat] ?? 0))
    if (this.seat) this.emote.stop()
  }

  // A new emote id / start time from the roster: start it where it should be by now.
  async syncEmote(id, at) {
    const key = id ? `${id}@${at}` : ''
    if (key === this.emoteKey) return
    this.emoteKey = key
    if (!id) return this.emote.stop()
    const clip = (await bloxity.emoteClips()).get(id)
    if (!clip || this.emoteKey !== key) return // an id this client can't play: ignore quietly
    const elapsed = at ? Math.max(0, (serverNow() - at) / 1000) : 0
    if (!clip.loop && elapsed > (Number(clip.len) || 0)) return // already over
    this.emote.play(id, clip, elapsed)
  }

  say(text) {
    this.bubble?.remove?.()
    this.bubble = speechBubble(this.group, text, REMOTE.bubbleY + (SEAT_Y[this.seat] ?? 0))
  }

  // A pose sample (already mapped into our world) when it changed.
  push(x, y, z, yaw, speed, now) {
    const key = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}|${yaw.toFixed(3)}|${speed.toFixed(1)}`
    if (key === this.lastKey) return
    this.lastKey = key
    const s = this.samples
    const last = s[s.length - 1]
    if (!last || Math.hypot(x - last.x, z - last.z) > REMOTE.snap) {
      s.length = 0
      this.placed = false
    }
    s.push({ t: now, x, y, z, yaw, speed })
    if (s.length > 8) s.shift()
  }

  // Where to draw now: interpolated `delay` s behind the newest sample, held at the newest when
  // samples stop (the player stood still).
  sample(now, out) {
    const s = this.samples
    const t = now - REMOTE.delay
    let i = s.length - 1
    while (i > 0 && s[i - 1].t > t) i--
    const b = s[i]
    const a = s[i - 1]
    if (!a || t >= b.t) return Object.assign(out, b, { speed: t - b.t > 0.5 ? 0 : b.speed })
    const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)))
    out.x = a.x + (b.x - a.x) * k
    out.y = a.y + (b.y - a.y) * k
    out.z = a.z + (b.z - a.z) * k
    out.yaw = lerpAngle(a.yaw, b.yaw, k)
    out.speed = a.speed + (b.speed - a.speed) * k
    return out
  }

  update(dt, t, now, viewer, frustum) {
    if (!this.samples.length) return
    const p = this.sample(now, tmp)
    const g = this.group
    const d = Math.hypot(p.x - viewer.x, p.z - viewer.z)
    const shown = d < REMOTE.hide
    g.visible = shown
    if (this.vehicle) this.vehicle.g.visible = shown
    if (!shown) {
      this.placed = false
      g.position.set(p.x, p.y, p.z)
      return
    }
    const prevY = g.position.y
    g.position.set(p.x, p.y, p.z)
    g.rotation.y = p.yaw
    this.vy = this.placed ? this.vy + ((p.y - prevY) / Math.max(dt, 1e-3) - this.vy) * Math.min(1, dt * 10) : 0
    this.placed = true

    // The vehicle under the rider.
    const v = this.vehicle
    if (v) {
      v.g.position.set(p.x, p.y, p.z)
      v.g.rotation.y = p.yaw
      if (v.horse) gait(v.horse, dt, t, { speed: p.speed * 0.45, run: p.speed > 7 })
      else if (v.rig && d < REMOTE.far) updateRig(v.rig, dt, t)
    }

    // LOD: the tag and shadows near, the animator at a lower rate far, nothing off-screen.
    this.setShadows(d < REMOTE.near)
    if (this.tag) this.tag.visible = d < REMOTE.far
    sphere.center.set(p.x, p.y + 1, p.z)
    if (!frustum.intersectsSphere(sphere)) return
    this.animDt += dt
    if (d > REMOTE.near && this.animDt < 1 / REMOTE.farHz) return
    const step = this.animDt
    this.animDt = 0
    if (this.emote.active && (p.speed > 0.6 || this.seat)) this.emote.stop() // emotes stop on movement
    this.animator?.update(step, {
      grounded: !this.seat && Math.abs(this.vy) < 1.5,
      speed: p.speed,
      verticalVelocity: this.vy,
      turn: 0,
      ride: this.seat === 'bike' ? 'bike' : this.seat ? 'seat' : null,
    })
    this.emote.update(this.avatar, step)
  }

  dispose() {
    this.generation++ // drop an avatar build in flight
    this.bubble?.remove?.()
    giveVehicle(this.vehicle)
    this.group.removeFromParent()
    disposeAnimator(this.animator)
    if (this.tag) {
      this.tag.material.map?.dispose()
      this.tag.material.dispose()
    }
  }
}

const tmp = { x: 0, y: 0, z: 0, yaw: 0, speed: 0 }
const sphere = new Sphere(new Vector3(), 1.6)
const frustum = new Frustum()
const projView = new Matrix4()

// `mapPose(p, mySlot)` -> { x, z, yaw } in our world (farm/remote.js). Returns { update, sayBy }.
export function createRemotePlayers(scene, { mapPose }) {
  const root = new Group()
  root.name = 'remotePlayers'
  scene.add(root)
  const remotes = new Map() // session id -> Remote
  const known = new Set() // session ids announced to the portal (join toasts)
  let announced = false // the first roster after a join = players already in the room
  let room = '' // the room those belong to (a new room starts over)

  // Bloxity chat: a bubble over the remote player who said it (ours is main.js's).
  bloxity.onChat((m) => {
    if (m.isLocalPlayer || !m.userId) return
    for (const r of remotes.values()) if (r.uid && r.uid === m.userId.split('#')[0]) return r.say(m.text)
  })

  return {
    get count() {
      return remotes.size
    },
    update(dt, t, viewer, camera) {
      const now = performance.now() / 1000
      if (roomKey() !== room) {
        room = roomKey()
        this.reset()
      }
      const players = roster()
      const slot = mySlot()
      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(projView)
      const seen = new Set()
      for (const p of players) {
        seen.add(p.id)
        let r = remotes.get(p.id)
        if (!r) remotes.set(p.id, (r = new Remote(root, p.id)))
        // Portal join toasts (friends only): who was here when we came, then who arrives.
        if (!known.has(p.id)) {
          known.add(p.id)
          if (announced) bloxity.playerJoined(p.name)
          else bloxity.playerInRoom(p.name)
        }
        r.uid = p.uid
        r.syncName(p.name)
        r.syncRide(p.ride || '')
        // Their pose, mapped from their frame into ours; the ground under the mapped spot plus any jump.
        const m = mapPose ? mapPose(p, slot) : p
        const jump = Math.max(0, (p.y ?? 0) - groundHeight(p.x, p.z))
        const y = groundHeight(m.x, m.z) + jump
        r.push(m.x, y, m.z, m.yaw, p.speed ?? 0, now)
        // Expensive bits only for players we can see (nearest first is implicit: rooms hold 4).
        const d = Math.hypot(m.x - viewer.x, m.z - viewer.z)
        if (d < REMOTE.hide) r.syncLook(p.avatar || '')
        r.syncEmote(p.emote || '', p.emoteAt || 0)
        r.update(dt, t, now, viewer, frustum)
      }
      if (inRoom()) announced = true
      for (const [id, r] of remotes) {
        if (seen.has(id)) continue
        r.dispose()
        remotes.delete(id)
        known.delete(id)
      }
    },
    // Back to an empty town (left the room): forget everyone so the next join re-announces.
    reset() {
      for (const r of remotes.values()) r.dispose()
      remotes.clear()
      known.clear()
      announced = false
    },
  }
}
