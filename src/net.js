// Talks to the game server (Run-a-farm-backend, Colyseus room "world"): the signed-in player's
// save lives there (localStorage in game.js stays as the offline / guest copy). Nothing here may
// throw or block the game: with no server the farm just runs on the local save.
import { Client } from '@colyseus/sdk'
import * as bloxity from './bloxity.js'
import * as game from './game.js'

const DEV_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'ws://localhost:2567' : '')

let room = null
let canSave = false // only once the server has answered the load (never overwrite an unread save)
let pending = null // latest save JSON waiting to be sent
let userId = ''
let retry = 0

const status = { connected: false, signedIn: false }
export const netStatus = () => status

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

function identity() {
  const u = bloxity.authState.user
  return { userId: u?.id || u?.userId || u?.uid || '', username: bloxity.displayName(), pfp: bloxity.getPfp() }
}

async function open() {
  const who = identity()
  userId = who.userId
  let client
  if (bloxity.canResolveServer()) {
    const { endpoint } = await bloxity.resolveServerEndpoint(who.userId)
    client = new Client(endpoint)
  } else if (DEV_URL) {
    client = new Client(DEV_URL)
  } else {
    return // no server to talk to (offline / serverless build)
  }
  const r = await client.joinOrCreate('world', who)
  room = r
  canSave = false
  status.connected = true
  retry = 0

  r.onMessage('progress', (m) => {
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
  r.onMessage('noProgress', () => {
    canSave = true
    pending = pending ?? game.serialize()
    flush()
  })
  // The save could not be read: saving stays off so it is never overwritten.
  r.onMessage('serverError', () => console.warn('[net] server could not read the save; not saving'))
  for (const t of ['spins', 'daily', 'leaderboard', 'spinResult', 'dailyResult']) r.onMessage(t, () => {})

  r.onLeave(() => {
    status.connected = false
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
