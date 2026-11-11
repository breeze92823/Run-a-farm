import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { fbm, heightToNormal, mulberry32 } from '../textures.js'

// Canvas painters for the farm's ground and building surfaces. Every texture
// tiles seamlessly; sizes are kept small (mobile) and repeated in world units.

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
const hex = (h) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Wrap as a repeating texture; `rx`/`ry` repeats.
export function tex(c, rx = 1, ry = rx, srgb = true) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(rx, ry)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

// Colour canvas from a noise field between two colours, plus speckle.
function noiseColor(size, field, a, b, speckle = 0, rand = Math.random) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const A = hex(a)
  const B = hex(b)
  for (let i = 0; i < field.length; i++) {
    const t = Math.max(0, Math.min(1, field[i] + (rand() - 0.5) * speckle))
    img.data[i * 4] = A[0] + (B[0] - A[0]) * t
    img.data[i * 4 + 1] = A[1] + (B[1] - A[1]) * t
    img.data[i * 4 + 2] = A[2] + (B[2] - A[2]) * t
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Draws fn at (x, y) and its wrapped copies so strokes cross the tile edge seamlessly.
function wrapped(size, x, y, r, fn) {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      if (x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size) continue
      fn(x + ox, y + oy)
    }
  }
}

// Lawn: soft yellow-green mottling with short blade strokes and a few clover dots.
export function paintGrass(size = 512) {
  const rand = mulberry32(811)
  const field = fbm(size, 6, 5, 812)
  const c = noiseColor(size, field, '#6a9a3e', '#8fb853', 0.18, rand)
  const ctx = c.getContext('2d')
  ctx.lineCap = 'round'
  for (let i = 0; i < 2600; i++) {
    const x = rand() * size
    const y = rand() * size
    const len = 3 + rand() * 6
    const lean = (rand() - 0.5) * 4
    const light = rand() < 0.5
    ctx.strokeStyle = light ? `rgba(190,230,120,${0.25 + rand() * 0.25})` : `rgba(60,110,35,${0.2 + rand() * 0.25})`
    ctx.lineWidth = 1 + rand() * 1.2
    wrapped(size, x, y, 10, (px, py) => {
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + lean, py - len)
      ctx.stroke()
    })
  }
  return c
}

// Packed yard dirt: warm tan with darker scuffs and little pebbles.
export function paintDirt(size = 512, light = '#d29d63', dark = '#a8743f', seed = 901) {
  const rand = mulberry32(seed)
  const field = fbm(size, 5, 5, seed + 1)
  const c = noiseColor(size, field, dark, light, 0.22, rand)
  const ctx = c.getContext('2d')
  for (let i = 0; i < 420; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 1 + rand() * 2.6
    const shade = 120 + rand() * 90
    ctx.fillStyle = `rgba(${shade},${shade * 0.8},${shade * 0.6},0.8)`
    wrapped(size, x, y, r, (px, py) => {
      ctx.beginPath()
      ctx.ellipse(px, py, r, r * 0.75, rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  for (let i = 0; i < 70; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 8 + rand() * 26
    ctx.fillStyle = `rgba(90,55,25,${0.05 + rand() * 0.07})`
    wrapped(size, x, y, r, (px, py) => {
      ctx.beginPath()
      ctx.ellipse(px, py, r, r * 0.6, rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  return c
}

// Tilled soil: dark brown with clods.
export const paintSoil = (size = 256) => paintDirt(size, '#7a5438', '#4f3322', 931)

// Asphalt road: dark speckled tar with a dashed white centre line along U.
// One tile = one dash cycle; repeat it along the road length.
export function paintRoad(w = 512, h = 256) {
  const rand = mulberry32(951)
  const field = fbm(256, 8, 4, 952)
  const base = noiseColor(256, field, '#36373b', '#4a4b50', 0.35, rand)
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  for (let x = 0; x < w; x += 256) for (let y = 0; y < h; y += 256) ctx.drawImage(base, x, y)
  for (let i = 0; i < 900; i++) {
    const v = 80 + rand() * 80
    ctx.fillStyle = `rgba(${v},${v},${v + 5},0.5)`
    ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5)
  }
  // Dash: the first half of the tile, centred across V.
  ctx.fillStyle = '#f2f2ee'
  ctx.fillRect(w * 0.08, h / 2 - 5, w * 0.42, 10)
  // A little tyre wear either side of the centre.
  ctx.fillStyle = 'rgba(20,20,22,0.18)'
  ctx.fillRect(0, h * 0.22, w, h * 0.1)
  ctx.fillRect(0, h * 0.68, w, h * 0.1)
  return c
}

// Plain asphalt (driveway, truck bay floor).
export function paintAsphalt(size = 256) {
  const rand = mulberry32(961)
  return noiseColor(size, fbm(size, 8, 4, 962), '#303135', '#46474c', 0.4, rand)
}

// Concrete slabs: light grey with joints every slab, faint stains. `slabs` per tile side.
export function paintConcrete(size = 512, slabs = 2, base = '#bdbab3', dark = '#a9a69f', seed = 971) {
  const rand = mulberry32(seed)
  const field = fbm(size, 6, 5, seed + 1)
  const c = noiseColor(size, field, dark, base, 0.12, rand)
  const ctx = c.getContext('2d')
  const cell = size / slabs
  ctx.strokeStyle = 'rgba(70,68,64,0.3)'
  ctx.lineWidth = 3
  for (let i = 0; i <= slabs; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, size)
    ctx.moveTo(0, i * cell)
    ctx.lineTo(size, i * cell)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i <= slabs; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cell + 2.5, 0)
    ctx.lineTo(i * cell + 2.5, size)
    ctx.moveTo(0, i * cell + 2.5)
    ctx.lineTo(size, i * cell + 2.5)
    ctx.stroke()
  }
  return c
}

// Herringbone brick pavers (90 deg): 2x1 bricks in staircases 4 cells apart.
// Returns colour + normal canvases. `cells` per tile side (multiple of 4).
export function paintPavers(size = 512, cells = 16, base = '#d7b98d', alt = '#bf9a6d', joint = '#8e7556', seed = 981) {
  const rand = mulberry32(seed)
  const u = size / cells
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = joint
  ctx.fillRect(0, 0, size, size)
  const heights = new Float32Array(size * size).fill(0.1)
  const A = hex(base)
  const B = hex(alt)
  const gap = 2
  const brick = (cx, cy, w, h) => {
    const t = rand()
    const col = A.map((v, i) => Math.round(v + (B[i] - v) * t))
    const x0 = cx * u + gap / 2
    const y0 = cy * u + gap / 2
    const bw = w * u - gap
    const bh = h * u - gap
    const bx = ((x0 % size) + size) % size
    const by = ((y0 % size) + size) % size
    for (const ox of [0, -size]) {
      for (const oy of [0, -size]) {
        {
          const px = bx + ox
          const py = by + oy
          if (px >= size || py >= size || px + bw <= 0 || py + bh <= 0) continue
          ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`
          ctx.fillRect(px, py, bw, bh)
          ctx.fillStyle = 'rgba(255,255,255,0.12)'
          ctx.fillRect(px, py, bw, 2)
          ctx.fillStyle = 'rgba(0,0,0,0.12)'
          ctx.fillRect(px, py + bh - 2, bw, 2)
          for (let yy = Math.max(0, Math.floor(py)); yy < Math.min(size, py + bh); yy++) {
            for (let xx = Math.max(0, Math.floor(px)); xx < Math.min(size, px + bw); xx++) {
              const e = Math.min(xx - px, yy - py, px + bw - xx, py + bh - yy)
              heights[yy * size + xx] = 0.3 + Math.min(1, e / 4) * 0.6
            }
          }
        }
      }
    }
  }
  for (let k = -1; k < cells / 4 + 1; k++) {
    for (let i = -2; i < cells + 2; i++) {
      brick(i + 4 * k, i, 2, 1) // horizontal
      brick(i + 4 * k, i + 1, 1, 2) // vertical
    }
  }
  // Fine grit on top.
  const grit = fbm(size, 32, 2, seed + 2)
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < grit.length; i++) {
    const k = 0.9 + grit[i] * 0.2
    img.data[i * 4] *= k
    img.data[i * 4 + 1] *= k
    img.data[i * 4 + 2] *= k
  }
  ctx.putImageData(img, 0, 0)
  return { color: c, normal: heightToNormal(heights, size, 2) }
}

// Vertical board siding (barn, coops): boards along V with dark seams. Tinted by
// the material colour, so it is painted near-white.
export function paintSiding(size = 256, boards = 8, seed = 991) {
  const rand = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const bw = size / boards
  for (let i = 0; i < boards; i++) {
    const v = 225 + rand() * 30
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(i * bw, 0, bw, size)
    for (let g = 0; g < 10; g++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.03 + rand() * 0.05})`
      ctx.lineWidth = 1
      const x = i * bw + rand() * bw
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + 2, size * 0.3, x - 2, size * 0.6, x + 1, size)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(i * bw, 0, 2, size)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(i * bw + 2, 0, 1, size)
  }
  return c
}

// Corrugated metal roof: ridges along V.
export function paintCorrugated(size = 128, ridges = 8) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let x = 0; x < size; x++) {
    const s = 0.78 + 0.22 * Math.sin((x / size) * ridges * Math.PI * 2)
    for (let y = 0; y < size; y++) {
      const i = (y * size + x) * 4
      const v = 255 * s
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Burlap sack weave.
export function paintBurlap(size = 128) {
  const rand = mulberry32(1001)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#c9a874'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size; i += 4) {
    ctx.fillStyle = `rgba(110,80,40,${0.15 + rand() * 0.1})`
    ctx.fillRect(i, 0, 1.5, size)
    ctx.fillRect(0, i, size, 1.5)
  }
  return c
}

// Hay: dense straw strokes on gold.
export function paintHay(size = 256) {
  const rand = mulberry32(1011)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e2b649'
  ctx.fillRect(0, 0, size, size)
  ctx.lineCap = 'round'
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size
    const y = rand() * size
    const a = (rand() - 0.5) * 0.8
    const len = 6 + rand() * 18
    const v = rand()
    ctx.strokeStyle = v < 0.5 ? `rgba(255,230,140,${0.4 + rand() * 0.4})` : `rgba(170,120,40,${0.25 + rand() * 0.35})`
    ctx.lineWidth = 1 + rand()
    wrapped(size, x, y, len, (px, py) => {
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len)
      ctx.stroke()
    })
  }
  return c
}

// Red/white awning stripes along U.
export function paintStripes(a = '#e23a35', b = '#fbf6ee', stripes = 8, w = 256, h = 64) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? b : a
    ctx.fillRect((i * w) / stripes, 0, w / stripes + 1, h)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  ctx.fillRect(0, h - 6, w, 6)
  return c
}

// Plaid shirt for scarecrows and farmers.
export function paintPlaid(a = '#c8322e', b = '#2b2b2b', size = 64) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = b
  ctx.globalAlpha = 0.45
  for (let i = 0; i < size; i += 16) {
    ctx.fillRect(i, 0, 6, size)
    ctx.fillRect(0, i, size, 6)
  }
  ctx.globalAlpha = 0.2
  ctx.fillStyle = '#ffffff'
  for (let i = 8; i < size; i += 16) {
    ctx.fillRect(i, 0, 1, size)
    ctx.fillRect(0, i, size, 1)
  }
  return c
}

// Overgrown meadow (unbought plots): dry olive grass, longer blade strokes, seed heads.
export function paintMeadow(size = 512) {
  const rand = mulberry32(1201)
  const field = fbm(size, 5, 5, 1202)
  const c = noiseColor(size, field, '#6f7a32', '#a29d4e', 0.2, rand)
  const ctx = c.getContext('2d')
  ctx.lineCap = 'round'
  for (let i = 0; i < 3400; i++) {
    const x = rand() * size
    const y = rand() * size
    const len = 5 + rand() * 11
    const lean = (rand() - 0.5) * 7
    const tone = rand()
    ctx.strokeStyle = tone < 0.4 ? `rgba(190,190,100,${0.3 + rand() * 0.3})` : tone < 0.8 ? `rgba(70,85,30,${0.25 + rand() * 0.3})` : `rgba(120,140,50,${0.4})`
    ctx.lineWidth = 1 + rand() * 1.4
    wrapped(size, x, y, 16, (px, py) => {
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.quadraticCurveTo(px + lean * 0.3, py - len * 0.6, px + lean, py - len)
      ctx.stroke()
    })
  }
  for (let i = 0; i < 120; i++) {
    const x = rand() * size
    const y = rand() * size
    ctx.fillStyle = rand() < 0.5 ? 'rgba(230,220,150,0.7)' : 'rgba(255,255,255,0.6)'
    wrapped(size, x, y, 3, (px, py) => {
      ctx.beginPath()
      ctx.arc(px, py, 1.2 + rand(), 0, Math.PI * 2)
      ctx.fill()
    })
  }
  return c
}
