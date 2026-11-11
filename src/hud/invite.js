// Invite Friends: how the two HUD boosts are earned (game.js `invite`, backend invite.ts).
//  - Money Boost: send any invite (a Bloxity friend from the list, or share the invite link)
//  - Friends Boost: a friend you invited actually joins (the server credits it, once per account)
// Opened from the boost icons next to the money and from the Shop's boost cards. Invites go
// through Legion.SDK.social (bloxity.js): the friend lands in this player's town (updateRoom).
import { GAME } from '../config.js'
import * as game from '../game.js'
import * as bloxity from '../bloxity.js'
import { refreshInvites, sendInvited, sendInviteLink } from '../net.js'
import { ICONS } from './icons.js'
import { btn, el, openWindow } from './window.js'

const iconOf = (b) => (b.id === 'money' ? ICONS.boostMoney : ICONS.boostFriends)

export function boostCard(b) {
  const on = game.boostActive(b)
  const c = el('div', `uiw-card${on ? '' : ' locked'}`)
  c.append(el('div', 'uiw-card-icon', iconOf(b)), el('div', 'uiw-card-name', `${b.title} ${b.label}`), el('div', 'uiw-card-text', on ? b.text : b.unlock))
  c.append(el('div', 'uiw-card-meta', on ? 'ACTIVE' : 'LOCKED'))
  return c
}

let friends = null // the last friends list (loaded once per window)
const sent = new Set() // friend ids invited this session

export function openInvite() {
  friends = null
  refreshInvites() // friends credited elsewhere since the load
  const off = game.on('invite', () => api?.refresh())
  const api = openWindow({
    title: 'INVITE FRIENDS',
    icon: 'boostFriends',
    onClose: off,
    render(body) {
      body.append(el('p', 'uiw-sub', 'Invite friends to your farm town to unlock the boosts. They stay on for good!'))
      const grid = el('div', 'uiw-grid')
      for (const b of GAME.boosts) grid.append(boostCard(b))
      body.append(grid)

      if (!bloxity.canInvite()) {
        body.append(el('p', 'uiw-sub', '<br>Invites work when you play on Bloxity.'))
        return
      }
      if (!bloxity.authState.user) {
        body.append(el('p', 'uiw-sub', '<br>Sign in to Bloxity (top-left menu) to invite friends and unlock the boosts.'))
        return
      }

      // The invite link (tagged with this account so the server credits us).
      const share = el('div', 'uiw-grid')
      const link = el('div', 'uiw-card')
      link.append(el('div', 'uiw-card-icon', ICONS.boostFriends), el('div', 'uiw-card-name', 'Invite link'), el('div', 'uiw-card-text', 'Share it anywhere: friends who open it join your town.'))
      link.append(
        btn('gold', 'COPY LINK', async () => {
          const url = bloxity.inviteLink()
          if (!url) return game.emit('toast', { text: 'Could not make an invite link. Try again!', kind: 'warn' })
          try {
            await navigator.clipboard.writeText(url)
            game.emit('toast', { text: 'Invite link copied! Send it to a friend', kind: 'good' })
          } catch {
            window.prompt('Copy your invite link:', url)
          }
          sendInviteLink()
        }),
      )
      share.append(link)
      body.append(el('p', 'uiw-sub', '<br>Share'), share)

      // Bloxity friends, each with an Invite button.
      body.append(el('p', 'uiw-sub', '<br>Your Bloxity friends'))
      const list = el('div', 'uiw-grid')
      body.append(list)
      if (!friends) {
        list.append(el('p', 'uiw-sub', 'Loading friends...'))
        bloxity.getFriends().then((f) => {
          friends = f
          api.refresh()
        })
        return
      }
      if (!friends.length) {
        list.append(el('p', 'uiw-sub', 'No Bloxity friends yet: share your invite link instead!'))
        return
      }
      const order = { 'in-game': 0, online: 1, away: 2, offline: 3 }
      const sorted = [...friends].sort((a, b) => (order[a.presence?.status] ?? 4) - (order[b.presence?.status] ?? 4))
      for (const f of sorted.slice(0, 40)) {
        const name = f.displayName || f.username || 'Friend'
        const c = el('div', 'uiw-card')
        const status = f.presence?.status ?? 'offline'
        c.append(el('div', 'uiw-card-icon', ICONS.boostFriends), el('div', 'uiw-card-name'), el('div', 'uiw-card-text', status === 'in-game' && f.presence?.gameName ? `Playing ${f.presence.gameName}` : status))
        c.querySelector('.uiw-card-name').textContent = name // friend names are user text
        const done = sent.has(f._id)
        const b = btn(done ? 'grey' : '', done ? 'INVITED' : 'INVITE', async () => {
          b.disabled = true
          const ok = await bloxity.inviteFriend(f._id)
          if (!ok) {
            b.disabled = false
            return game.emit('toast', { text: `Could not invite ${name}. Try again!`, kind: 'warn' })
          }
          sent.add(f._id)
          sendInvited(f._id)
          game.emit('toast', { text: `Invite sent to ${name}!`, kind: 'good' })
          api.refresh()
        })
        b.disabled = done
        c.append(b)
        list.append(c)
      }
    },
  })
  return api
}
