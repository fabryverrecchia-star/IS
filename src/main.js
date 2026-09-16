import './style.css'
import { GalleryApp } from './gallery/GalleryApp.js'
import { computeGridLayout } from './gallery/layout.js'
import { galleryItems } from './data/galleryData.js'

const app = document.getElementById('app')
const loader = document.getElementById('loader')
const loaderStage = document.getElementById('loader-stage')
const loaderCounter = document.getElementById('loader-counter')
const loaderWordmarkFill = document.querySelector('.loader-wordmark-fill')
const scrollHint = document.getElementById('scroll-hint')

// Small preview tiles scattered loosely around the viewport (not a tidy
// grid) — each gets a random angle/radius from screen center plus a
// slight rotation, clamped so it stays fully on-screen.
function computeScatterLayout(count, viewportWidth, viewportHeight) {
  const cellWidth = Math.min(Math.max(viewportWidth * 0.055, 48), 86)
  const cellHeight = cellWidth * 1.2
  const cx = viewportWidth / 2
  const cy = viewportHeight / 2
  const margin = 16

  const positions = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 1.6
    const radiusX = viewportWidth * (0.16 + Math.random() * 0.24)
    const radiusY = viewportHeight * (0.12 + Math.random() * 0.26)
    const x = Math.min(
      Math.max(cx + Math.cos(angle) * radiusX, cellWidth / 2 + margin),
      viewportWidth - cellWidth / 2 - margin
    )
    const y = Math.min(
      Math.max(cy + Math.sin(angle) * radiusY, cellHeight / 2 + margin),
      viewportHeight - cellHeight / 2 - margin
    )
    positions.push({ x, y, width: cellWidth, height: cellHeight, rotation: (Math.random() - 0.5) * 14 })
  }
  return positions
}

const loaderTiles = [...loaderStage.children]
const scatterPositions = computeScatterLayout(loaderTiles.length, window.innerWidth, window.innerHeight)
// The real first two grid rows, in the real grid order — this is what the
// scattered preview grows into once loading finishes, so the reveal reads
// as the preview becoming the mosaic rather than a cut between them.
const realLayout = computeGridLayout(galleryItems.length, window.innerWidth, window.innerHeight)

function placeTile(tile, cell) {
  tile.style.left = `${cell.x - cell.width / 2}px`
  tile.style.top = `${cell.y - cell.height / 2}px`
  tile.style.width = `${cell.width}px`
  tile.style.height = `${cell.height}px`
}

loaderTiles.forEach((tile, i) => {
  const cell = scatterPositions[i]
  placeTile(tile, cell)
  tile.style.setProperty('--rot', `${cell.rotation}deg`)

  // Random z-index around the wordmark's (5): about half the tiles sit in
  // front of it, half behind — a layered, collaged look since the
  // scattered tiles overlap the centered wordmark.
  tile.style.zIndex = Math.random() < 0.5 ? 1 : 10

  // Each tile reveals its own content with a bottom-to-top wipe, on a
  // random delay — a decorative entrance independent of real load
  // progress (that's tracked separately by the counter/wordmark fill).
  tile.style.setProperty('--reveal-delay', `${Math.random() * 900}ms`)
})
// Trigger the reveal on the next frame so the initial clipped state
// actually paints first (otherwise there's nothing to transition from).
requestAnimationFrame(() => {
  loaderTiles.forEach((tile) => tile.classList.add('is-revealed'))
})

// The counter and wordmark fill are driven by whichever is SLOWER: real
// asset progress, or a forced 4s minimum. A fast load still takes the
// full 4s to visually finish (no jarring instant flash); a slow load
// keeps tracking real progress past 4s instead of stalling at it.
const FORCED_MIN_MS = 4000
const loadStart = performance.now()
let realRatio = 0
let realReady = false
let growTriggered = false

function applyProgress(ratio) {
  loaderCounter.textContent = Math.round(ratio * 100)
  loaderWordmarkFill.style.clipPath = `inset(0 ${(1 - ratio) * 100}% 0 0)`
}

function triggerGrow() {
  if (growTriggered) return
  growTriggered = true
  // Make sure every tile is fully revealed regardless of its random
  // entrance delay before it starts growing into the real mosaic.
  loaderTiles.forEach((tile) => tile.classList.add('is-revealed'))
  loaderStage.classList.add('is-growing')
  loaderTiles.forEach((tile, i) => {
    placeTile(tile, realLayout.positions[i])
    tile.style.setProperty('--rot', '0deg')
  })
  // Once the grow animation lands, dissolve the loader — the tiles are
  // already sitting exactly where the real grid does.
  setTimeout(() => loader.classList.add('is-hidden'), 1150)
}

function tick() {
  const elapsed = performance.now() - loadStart
  const timeRatio = Math.min(elapsed / FORCED_MIN_MS, 1)
  applyProgress(Math.min(realRatio, timeRatio))
  if (realReady && elapsed >= FORCED_MIN_MS) {
    applyProgress(1)
    triggerGrow()
    return
  }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

const gallery = new GalleryApp(app, {
  onProgress(ratio) {
    realRatio = ratio
  },
  onReady() {
    realRatio = 1
    realReady = true
  },
})

let hintTimer = setTimeout(() => scrollHint.classList.add('is-hidden'), 4000)
window.addEventListener(
  'scroll',
  () => {
    scrollHint.classList.add('is-hidden')
    clearTimeout(hintTimer)
  },
  { passive: true, once: true }
)

if (import.meta.env.DEV) {
  window.__gallery = gallery
}
