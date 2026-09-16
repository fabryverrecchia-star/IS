import './style.css'
import { GalleryApp } from './gallery/GalleryApp.js'
import { computeGridLayout } from './gallery/layout.js'
import { galleryItems } from './data/galleryData.js'

const app = document.getElementById('app')
const loader = document.getElementById('loader')
const loaderStage = document.getElementById('loader-stage')
const loaderCounter = document.getElementById('loader-counter')
const scrollHint = document.getElementById('scroll-hint')

// The loader's 8 tiles are the real first two grid rows, in the real grid
// order — computing their landing spot with the same layout math the
// gallery itself uses means "settled" already IS the home mosaic at full
// size, so there's nothing left to scale afterward, just a quick reveal.
const loaderTiles = [...loaderStage.children]
const gridLayout = computeGridLayout(galleryItems.length, window.innerWidth, window.innerHeight)
loaderTiles.forEach((tile, i) => {
  const cell = gridLayout.positions[i]
  tile.style.left = `${cell.x - cell.width / 2}px`
  tile.style.top = `${cell.y - cell.height / 2}px`
  tile.style.width = `${cell.width}px`
  tile.style.height = `${cell.height}px`

  // Scatter out toward a screen edge, in a random order/offset, so it
  // reads as loose disorder rather than a neat ring — settling them back
  // onto the grid at 100% is what makes the reveal feel deliberate.
  const angle = (i / loaderTiles.length) * Math.PI * 2 + (Math.random() - 0.5) * 1.4
  const radius = 22 + Math.random() * 16
  tile.style.setProperty('--dx', `${Math.cos(angle) * radius}vw`)
  tile.style.setProperty('--dy', `${Math.sin(angle) * radius}vh`)
  tile.style.setProperty('--dr', `${(Math.random() - 0.5) * 50}deg`)
})
// Shuffle the settle order independently of scatter position for a less
// mechanical cascade.
const settleOrder = loaderTiles.map((_, i) => i).sort(() => Math.random() - 0.5)
settleOrder.forEach((tileIndex, order) => {
  loaderTiles[tileIndex].style.setProperty('--delay', `${order * 45}ms`)
})

const gallery = new GalleryApp(app, {
  onProgress(ratio) {
    loaderCounter.textContent = Math.round(ratio * 100)
  },
  onReady() {
    loaderCounter.textContent = 100
    loaderStage.classList.add('is-settled')
    // Give the staggered settle animation time to land (max stagger delay
    // + its own transition duration), plus a short pause, before the whole
    // loader dissolves — by then the tiles already sit exactly where the
    // real grid does, so the reveal underneath is a plain crossfade.
    setTimeout(() => loader.classList.add('is-hidden'), 1550)
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
