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

// A small, compact preview grid, centered on screen — where the tiles
// sit while loading, independent of the real mosaic's size.
function computeSmallLayout(count, viewportWidth, viewportHeight) {
  const columns = 4
  const rows = Math.ceil(count / columns)
  const cellWidth = Math.min(Math.max(viewportWidth * 0.055, 48), 86)
  const cellHeight = cellWidth * 1.2
  const gap = Math.min(Math.max(viewportWidth * 0.008, 6), 12)
  const gridWidth = columns * cellWidth + (columns - 1) * gap
  const gridHeight = rows * cellHeight + (rows - 1) * gap
  const originX = (viewportWidth - gridWidth) / 2
  const originY = (viewportHeight - gridHeight) / 2

  const positions = []
  for (let i = 0; i < count; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    positions.push({
      x: originX + col * (cellWidth + gap) + cellWidth / 2,
      y: originY + row * (cellHeight + gap) + cellHeight / 2,
      width: cellWidth,
      height: cellHeight,
    })
  }
  return positions
}

const loaderTiles = [...loaderStage.children]
const smallPositions = computeSmallLayout(loaderTiles.length, window.innerWidth, window.innerHeight)
// The real first two grid rows, in the real grid order — this is what the
// small settled preview grows into once loading finishes, so the reveal
// reads as the preview becoming the mosaic rather than a cut between them.
const realLayout = computeGridLayout(galleryItems.length, window.innerWidth, window.innerHeight)

function placeTile(tile, cell) {
  tile.style.left = `${cell.x - cell.width / 2}px`
  tile.style.top = `${cell.y - cell.height / 2}px`
  tile.style.width = `${cell.width}px`
  tile.style.height = `${cell.height}px`
}

loaderTiles.forEach((tile, i) => {
  placeTile(tile, smallPositions[i])

  // Random z-index around the wordmark's (5): about half the tiles sit in
  // front of it, half behind — a layered, collaged look rather than a
  // flat grid, since the small preview grid spatially overlaps the
  // centered wordmark.
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
  loaderTiles.forEach((tile, i) => placeTile(tile, realLayout.positions[i]))
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
