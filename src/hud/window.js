import './window.css'
import { ICONS } from './icons.js'
import * as sfx from '../audio/ui.js'

// One popup window at a time: a blurred backdrop and a cream panel in a wooden
// frame with an outlined title tab and a round X. Esc (routed through
// closeTopWindow by main.js), the X or a tap on the backdrop closes it. The
// caller fills `body` and can re-render it with `refresh`.

let current = null
let reservedTop = 0 // px kept clear at the top (Boxity's toolbar)

export const anyWindowOpen = () => !!current
export function closeTopWindow() {
  if (!current) return false
  current.close()
  return true
}
export function setWindowReserved(top) {
  reservedTop = top
  if (current) current.overlay.style.setProperty('--uiw-top', `${top}px`)
}

// render(body, api) fills the body; api.refresh() re-renders it.
export function openWindow({ title, icon, theme = 'wood', render, onClose }) {
  current?.close(true)
  document.exitPointerLock?.()
  const overlay = document.createElement('div')
  overlay.className = `uiw-overlay uiw-${theme}`
  overlay.style.setProperty('--uiw-top', `${reservedTop}px`)
  const dialog = document.createElement('div')
  dialog.className = 'uiw'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-label', title)
  const head = document.createElement('div')
  head.className = 'uiw-title'
  head.innerHTML = `<span class="uiw-title-icon">${ICONS[icon] ?? ''}</span><span class="ol">${title}</span>`
  const x = document.createElement('button')
  x.type = 'button'
  x.className = 'uiw-close'
  x.setAttribute('aria-label', 'Close')
  x.innerHTML = ICONS.close
  const body = document.createElement('div')
  body.className = 'uiw-body'
  dialog.append(head, x, body)
  overlay.append(dialog)
  document.body.append(overlay)
  sfx.open()

  const api = {
    overlay,
    body,
    refresh() {
      const scroll = body.scrollTop
      body.innerHTML = ''
      render(body, api)
      body.scrollTop = scroll
    },
    close(silent = false) {
      if (current !== api) return
      current = null
      overlay.classList.add('closing')
      setTimeout(() => overlay.remove(), 160)
      if (!silent) sfx.close()
      onClose?.()
    },
  }
  current = api
  const stop = (e) => e.stopPropagation()
  for (const t of ['pointerdown', 'pointerup', 'wheel', 'touchstart']) overlay.addEventListener(t, stop, { passive: true })
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) api.close()
  })
  x.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    api.close()
  })
  api.refresh()
  return api
}

// Small builders for window content.
export function el(tag, className, html) {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (html != null) e.innerHTML = html
  return e
}
// A button that fires on pointerdown (no click delay on touch) with a pop.
export function btn(className, html, fn) {
  const b = el('button', `uiw-btn ${className}`, html)
  b.type = 'button'
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (b.disabled) return
    b.classList.remove('pop')
    void b.offsetWidth
    b.classList.add('pop')
    sfx.click()
    fn?.(b)
  })
  return b
}
