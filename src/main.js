import './style.css'
import { GalleryApp } from './gallery/GalleryApp.js'

const app = document.getElementById('app')
const loader = document.getElementById('loader')
const loaderGrid = document.getElementById('loader-grid')
const loaderCounter = document.getElementById('loader-counter')
const scrollHint = document.getElementById('scroll-hint')

// Scatter each tile out toward a screen edge, in a random order/offset, so
// it reads as loose disorder rather than a neat ring — settling them back
// onto the grid at 100% is what makes the reveal feel deliberate.
const loaderTiles = [...loaderGrid.children]
loaderTiles.forEach((tile, i) => {
  const angle = (i / loaderTiles.length) * Math.PI * 2 + (Math.random() - 0.5) * 1.4
  const radius = 26 + Math.random() * 20
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
    loaderGrid.classList.add('is-settled')
    // Give the staggered settle animation time to land (max stagger delay
    // + its own transition duration), plus a short pause, before the whole
    // loader dissolves.
    setTimeout(() => loader.classList.add('is-hidden'), 1450)
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
