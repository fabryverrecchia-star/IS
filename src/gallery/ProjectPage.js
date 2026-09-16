import { computeHeroLayout } from './heroLayout.js'

// Resolves once the element has an actual frame ready to paint — an image
// decoded, or a video past HAVE_CURRENT_DATA. A capped wait keeps a stalled
// asset from blocking the hand-off indefinitely.
function waitForHeroReady(el, type) {
  if (type === 'video') {
    if (el.readyState >= 2) return Promise.resolve()
    return new Promise((resolve) => {
      el.addEventListener('loadeddata', () => resolve(), { once: true })
      setTimeout(resolve, 800)
    })
  }
  if (el.decode) return el.decode().catch(() => {})
  if (el.complete) return Promise.resolve()
  return new Promise((resolve) => {
    el.addEventListener('load', () => resolve(), { once: true })
    setTimeout(resolve, 800)
  })
}

// Owns the real, scrollable project page shown after the WebGL entrance
// transition lands: a plain DOM view (hero media + optional extra images/
// screenshots + a top bar with a visible back link and right-aligned
// client/year). Kept deliberately as regular DOM/CSS rather than more
// WebGL — it's the simplest robust way to get real page scrolling and
// parallax, and it never has to touch the gallery's own render loop.
export class ProjectPage {
  constructor(app, { onClose } = {}) {
    this.app = app
    this.onClose = onClose || (() => {})
    this.tile = null

    this.root = document.getElementById('project-page')
    this.backLink = document.getElementById('project-back')
    this.titleEl = document.getElementById('project-title')
    this.clientEl = document.getElementById('project-client')
    this.yearEl = document.getElementById('project-year')
    this.heroSlot = document.getElementById('project-hero-slot')
    this.body = document.getElementById('project-body')

    this.backLink.addEventListener('click', (e) => {
      e.preventDefault()
      this.close()
    })

    this._onScroll = () => this._updateParallax()
    this.root.addEventListener('scroll', this._onScroll, { passive: true })
  }

  get isOpen() {
    return this.tile !== null
  }

  // For a 'banner' cover (see heroLayout.js), #project-page's normal
  // document flow already reproduces the WebGL hero's final rect exactly —
  // a full-width first child scrolled to top needs no extra math. A
  // 'contained' cover (very vertical media) isn't full-width, so its exact
  // size and centering are computed here with the same helper DetailView
  // used, and applied as inline styles — that's what keeps the hand-off
  // pixel-identical (no pop) in that case too.
  open(tile) {
    const item = tile.item
    this.tile = tile

    this.titleEl.textContent = item.title
    this.clientEl.textContent = item.client || ''
    this.clientEl.hidden = !item.client
    this.yearEl.textContent = item.year || ''
    this.yearEl.hidden = !item.year

    this.heroSlot.innerHTML = ''
    this.body.innerHTML = ''

    const { viewportWidth, viewportHeight } = this.app
    const layout = computeHeroLayout({ aspect: item.aspect, viewportWidth, viewportHeight })

    let heroEl
    if (item.type === 'video') {
      // The grid tile's video is a short muted loop driving the WebGL
      // texture — the project page instead plays the real uploaded cut,
      // with sound and native controls, as its own independent element.
      heroEl = document.createElement('video')
      heroEl.playsInline = true
      heroEl.setAttribute('playsinline', '')
      heroEl.controls = true
      heroEl.preload = 'auto'
      const fullSrc = item.fullSrc || item.src
      // Same WebM/VP9-first, MP4/H.264-fallback pairing as the grid tile
      // (see Tile.js) — some engines only decode one of the two.
      const webmSource = document.createElement('source')
      webmSource.src = fullSrc.replace(/\.mp4$/, '.webm')
      webmSource.type = 'video/webm; codecs="vp9,opus"'
      const mp4Source = document.createElement('source')
      mp4Source.src = fullSrc
      mp4Source.type = 'video/mp4'
      heroEl.appendChild(webmSource)
      heroEl.appendChild(mp4Source)
      heroEl.load()
      this._fullVideoEl = heroEl
      // Unmuted autoplay can be blocked depending on browser engagement
      // heuristics; fall back to a muted start rather than stalling
      // playback entirely — controls stay on so sound is one click away.
      heroEl.play().catch(() => {
        heroEl.muted = true
        heroEl.play().catch(() => {})
      })
    } else {
      heroEl = document.createElement('img')
      heroEl.src = item.src
      heroEl.alt = item.title
      heroEl.decoding = 'async'
    }
    heroEl.className = 'project-hero-media'

    if (layout.mode === 'contained') {
      const spacer = Math.max(0, (viewportHeight - layout.height) / 2)
      this.heroSlot.style.paddingTop = `${spacer}px`
      this.heroSlot.style.paddingBottom = `${spacer}px`
      heroEl.style.width = `${layout.width}px`
      heroEl.style.margin = '0 auto'
    } else {
      this.heroSlot.style.paddingTop = ''
      this.heroSlot.style.paddingBottom = ''
      heroEl.style.width = ''
      heroEl.style.margin = ''
    }

    this.heroSlot.appendChild(heroEl)
    this._heroReady = waitForHeroReady(heroEl, item.type)

    if (item.type === 'video' && item.screenshots && item.screenshots.length) {
      const grid = document.createElement('div')
      grid.className = 'project-screens'
      item.screenshots.forEach((shot) => {
        const img = document.createElement('img')
        img.src = shot.src
        img.alt = ''
        img.className = 'project-screens-img'
        grid.appendChild(img)
      })
      this.body.appendChild(grid)
    } else if (item.images && item.images.length) {
      item.images.forEach((extra) => {
        const wrap = document.createElement('div')
        wrap.className = 'project-extra'
        const img = document.createElement('img')
        img.src = extra.src
        img.alt = ''
        img.className = 'project-extra-img'
        wrap.appendChild(img)
        this.body.appendChild(wrap)
      })
    }

    this.root.scrollTop = 0
    // Caller shows the page (see `show()`) only once this resolves — the
    // WebGL hero stays on screen until the DOM one actually has a frame
    // to paint, so the swap is a hard cut between two identical-looking
    // pixels instead of a fade with nothing (a white flash) in between.
    return this._heroReady
  }

  // Makes the built page visible — instant, no fade (see open()'s comment
  // on why easing this would reintroduce the flash it's meant to avoid).
  show() {
    this.root.classList.add('is-visible')
  }

  close() {
    if (this._fullVideoEl) {
      this._fullVideoEl.pause()
      this._fullVideoEl.removeAttribute('src')
      this._fullVideoEl.load()
      this._fullVideoEl = null
    }
    this.root.classList.remove('is-visible')
    const tile = this.tile
    this.tile = null
    this.onClose(tile)
  }

  _updateParallax() {
    const vh = window.innerHeight
    this.body.querySelectorAll('.project-extra-img').forEach((img) => {
      const rect = img.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      const offset = (center - vh / 2) * -0.08
      img.style.transform = `translateY(${offset}px)`
    })
  }
}
