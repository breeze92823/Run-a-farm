// Talks to the game server (Run-a-farm-backend, Colyseus room "world"): the signed-in player's
// save lives there (localStorage in game.js stays as the offline / guest copy). Nothing here may
// throw or block the game: with no server the farm just runs on the local save.
import { Client } from '@colyseus/sdk'
import * as bloxity from './bloxity.js'
import * as game from './game.js'
import * as analytics from './analytics.js'
import { GAME } from './config.js'

const DEV_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'ws://localhost:2567' : '')

let room = null
let canSave = false // only once the server has answered the load (never overwrite an unread save)
let pending = null // latest save JSON waiting to be sent
let userId = ''
let retry = 0
let offlineSent = false // Net:Offline sent for this outage

const status = { connected: false, signedIn: false }
export const netStatus = () => status

// --- The farms around the town ------------------------------------------------------------------------
// The server gives every player in the room a farm slot (roster `slot`, 0..GAME.net.slots-1); this
// client's own farm is always drawn at home, the others round the town (farm/remote.js). `roster()`
// lists the other players as { id, name, slot, farm (summary JSON), x, y, z, yaw, speed, uid (Bloxity
// account id, '' = guest), avatar (look JSON), ride ('kind/seat', '' = on foot), emote, emoteAt
// (server ms) }; [] offline. The entries are reused between calls (no per-frame garbage), so callers
// must not keep them.
const others = []
const entries = new Map() // session id -> reused roster entry
export function mySlot() {
  const me = room?.state?.players?.get?.(room.sessionId)
  return me && me.slot >= 0 ? me.slot : 0
}
export function roster() {
  others.length = 0
  try {
    room?.state?.players?.forEach?.((p, id) => {
      if (id === room.sessionId || p.slot < 0) return
      let e = entries.get(id)
      if (!e) entries.set(id, (e = { id }))
      e.name = p.username || 'Farmer'
      e.slot = p.slot
      e.farm = p.farm || ''
      e.x = p.x
      e.y = p.y
      e.z = p.z
      e.yaw = p.yaw
      e.speed = p.speed
      e.uid = (p.uid || '').split('#')[0]
      e.avatar = p.avatar || ''
      e.ride = p.ride || ''
      e.emote = p.emote || ''
      e.emoteAt = p.emoteAt || 0
      others.push(e)
    })
  } catch {
    // State not synced yet.
  }
  if (entries.size > others.length + 8) for (const id of entries.keys()) if (!others.some((o) => o.id === id)) entries.delete(id)
  return others
}
// True once this client is in a room and the roster has synced (its own entry is there).
export const inRoom = () => !!room?.state?.players?.get?.(room.sessionId)
// The current room's id ('' = none): a change means a different town.
export const roomKey = () => room?.roomId ?? ''

// The server's clock (ms), from the offset measured on the load answer: emote start times.
let clockOffset = 0
export const serverNow = () => Date.now() + clockOffset

// --- Presence: our look, what we ride, our emote -------------------------------------------------------
// Our Bloxity look as ids only ({ equipped, proportions }; the others compose the skin themselves).
let avatarJson = ''
export function setLook(equipped, proportions) {
  const json = equipped ? JSON.stringify({ equipped, proportions: proportions ?? null }) : ''
  if (json.length > 3000 || json === avatarJson) return
  avatarJson = json
  send('setAvatar', { avatar: json })
}
let rideKey = ''
let rideMsg = { kind: '', seat: '' }
// What we ride now (mount.js kind + seat; '' = on foot). Call every frame: only a change is sent.
export function setRide(kind, seat) {
  const key = kind ? `${kind}/${seat || ''}` : ''
  if (key === rideKey) return
  rideKey = key
  rideMsg = { kind: kind || '', seat: seat || '' }
  send('ride', rideMsg)
}
// Invites (backend invite.ts; they unlock the boosts, game.js `invite`): a direct invite we sent,
// our invite link shared, and a re-read of the friends-joined count (the Invite window opens).
export function sendInvited(friendId) {
  if (room) send('invited', { friendId })
  else game.setInvite({ moneyBoost: true }) // no server: remembered in this browser
}
export function sendInviteLink() {
  if (room) send('inviteLink', {})
  else game.setInvite({ moneyBoost: true })
}
export const refreshInvites = () => send('inviteRefresh', {})

// An emote we started from the portal ('' = stopped), relayed so the others play it too.
export function sendEmote(id) {
  send('emote', { id: id || '' })
}

// What the others draw of this farm (backend farms.ts `farmInfo`).
export function farmSummary() {
  const s = game.state
  const plots = [...s.plots.owned].sort((a, b) => a - b).map((n) => [s.plots.crop[n] || '', Math.round(Math.min(1, s.plots.grow[n] ?? 0) * 100)])
  return { b: [...s.built], p: plots, s: s.upgrades.stand ?? 0, tr: s.vehicles.tractors ?? 0, tk: s.vehicles.trucks ?? 0, d: s.drones?.n ?? 0, o: s.oil?.pumps ?? 0, lv: s.xp?.level ?? 1 }
}
let farmKey = ''
let farmAt = 0
function sendFarm(force = false) {
  if (!room) return
  const now = performance.now()
  if (!force && now - farmAt < GAME.net.farmEvery * 1000) return
  const info = farmSummary()
  const key = JSON.stringify(info)
  if (key === farmKey) return
  farmKey = key
  farmAt = now
  send('farmInfo', { farm: info })
}
// This player's pose (feet, yaw, speed) at most GAME.net.poseHz a second while it changes; main.js
// calls it every frame. Also nudges the farm summary up when it changed.
let poseKey = ''
let poseAt = 0
export function sendPose(x, y, z, yaw, speed) {
  if (!room) return
  sendFarm()
  const now = performance.now()
  if (now - poseAt < 1000 / GAME.net.poseHz) return
  const key = `${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${yaw.toFixed(2)}`
  if (key === poseKey) return
  poseKey = key
  poseAt = now
  send('pose', { x, y, z, yaw, speed })
}

function send(type, msg) {
  try {
    room?.send(type, msg)
  } catch {
    // Connection dropped: reconnect logic restores it.
  }
}

function flush() {
  if (canSave && pending && room) {
    send('saveProgress', { farm: pending })
    pending = null
  }
}

// Who we are. A deployed server only trusts `token` (verified with Bloxity); `userId` is for local dev.
function identity() {
  const u = bloxity.authState.user
  return { userId: u?.id || u?.userId || u?.uid || u?._id || '', username: bloxity.displayName(), pfp: bloxity.getPfp(), token: bloxity.getToken() }
}

// The room the page was launched into (a friend's invite / the portal's Open Rooms) is tried once.
let launchTried = false
async function joinRoom(opts) {
  const launch = launchTried ? '' : bloxity.launchRoomId()
  launchTried = true
  if (launch) {
    try {
      const at = await bloxity.locateRoom(launch)
      if (at) return await new Client(at.endpoint).joinById(at.roomId, opts)
    } catch (e) {
      console.info('[net] launch room unavailable, joining any town', e?.message ?? e)
    }
  }
  // Every connect resolves a fresh pod-pinned endpoint (Bloxity rule: never reuse a Client).
  if (bloxity.canResolveServer()) {
    const { endpoint } = await bloxity.resolveServerEndpoint(opts.userId)
    return new Client(endpoint).joinOrCreate('world', opts)
  }
  if (DEV_URL) return new Client(DEV_URL).joinOrCreate('world', opts)
  return null // no server to talk to (offline / serverless build)
}

async function open() {
  const who = identity()
  userId = who.userId
  const ref = bloxity.launchRef()
  const r = await joinRoom({ ...who, farm: farmSummary(), avatar: avatarJson, ride: rideMsg, ...(ref && { ref }) })
  if (!r) return
  room = r
  canSave = false
  status.connected = true
  retry = 0
  offlineSent = false
  analytics.design('Net:Joined')
  farmKey = ''
  // The portal's invites and Open Rooms land in this room.
  bloxity.updateRoom(r.roomId)
  bloxity.registerPlayWithFriends()

  const clock = (m) => {
    if (typeof m?.serverTime === 'number') clockOffset = m.serverTime - Date.now()
  }
  r.onMessage('progress', (m) => {
    clock(m)
    canSave = true
    if (typeof m?.farm === 'string') {
      try {
        game.hydrate(m.farm)
      } catch (e) {
        console.warn('[net] bad save from server', e)
      }
    }
    flush()
  })
  // New account / guest / no database: keep the local state and push it up.
  r.onMessage('noProgress', (m) => {
    clock(m)
    canSave = true
    pending = pending ?? game.serialize()
    flush()
  })
  // Invites: the server's word on the boosts (a guest: both locked).
  r.onMessage('invite', (m) => {
    if (!m || typeof m !== 'object') return
    game.setInvite({ moneyBoost: !!m.moneyBoost, friendsBoost: !!m.friendsBoost, joined: Number(m.joined) || 0, guest: !!m.guest })
  })
  r.onMessage('friendJoined', (m) => game.emit('toast', { text: `${m?.name || 'A friend'} joined from your invite! Friends Boost unlocked`, kind: 'good' }))
  r.onMessage('invitedBy', (m) => game.emit('toast', { text: `Welcome! ${m?.name || 'A friend'} invited you to the farm`, kind: 'good' }))
  // The save could not be read: saving stays off so it is never overwritten.
  r.onMessage('serverError', () => console.warn('[net] server could not read the save; not saving'))
  for (const t of ['spins', 'daily', 'leaderboard', 'spinResult', 'dailyResult']) r.onMessage(t, () => {})

  // An unexpected close (pod replaced, network) resolves again and rejoins (Bloxity rule).
  r.onLeave(() => {
    analytics.design('Net:Dropped')
    status.connected = false
    bloxity.updateRoom('')
    room = null
    canSave = false
    reconnect()
  })
}

function reconnect() {
  const wait = Math.min(30000, 1000 * 2 ** retry++)
  setTimeout(() => connect(), wait)
}

let connecting = false
async function connect() {
  if (connecting || room) return
  connecting = true
  try {
    await open()
  } catch (e) {
    console.info('[net] server unavailable, playing on the local save', e?.message ?? e)
    // Once per outage (reset by a successful join).
    if (!offlineSent) analytics.design('Net:Offline')
    offlineSent = true
    reconnect()
  } finally {
    connecting = false
  }
}

export function install() {
  game.onSave((json) => {
    pending = json
    flush()
  })
  let started = false
  bloxity.subscribeAuth((s) => {
    if (!s.ready) return
    if (!started) {
      started = true
      connect()
      return
    }
    // Signed in/out mid-session: flush the old identity's save, then re-identify (the server
    // answers progress / noProgress again for the new identity).
    const now = identity()
    if (room && now.userId !== userId) {
      flush()
      userId = now.userId
      canSave = false
      status.signedIn = !!now.userId
      send('identify', now)
    }
  })
  window.addEventListener('beforeunload', () => {
    pending = game.serialize()
    flush()
    try {
      room?.leave()
    } catch {
      // Closing anyway.
    }
  })
}
