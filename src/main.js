import './style.css'
import { GalleryApp } from './gallery/GalleryApp.js'

const app = document.getElementById('app')
const loader = document.getElementById('loader')
const loaderCount = document.getElementById('loader-count')
const loaderFill = document.getElementById('loader-fill')
const scrollHint = document.getElementById('scroll-hint')

const gallery = new GalleryApp(app, {
  onProgress(ratio) {
    const pct = Math.round(ratio * 100)
    loaderCount.textContent = `${pct}%`
    loaderFill.style.width = `${pct}%`
  },
  onReady() {
    loader.classList.add('is-hidden')
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
