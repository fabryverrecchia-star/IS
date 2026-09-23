import { computeHeroLayout } from './heroLayout.js'
import { ProjectButtons } from './ProjectButtons.js'

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
// transition lands: only the hero borrows the Journal detail panel's
// proportions (a full-height, crop-fit cover on the left 75%, landing
// pixel-identical on the WebGL hero it replaces, with a fixed info panel
// on the right 25%) — everything else is the original page, a normal
// vertically-scrolling document with any extra images stacked below the
// hero. Kept deliberately as regular DOM/CSS rather than more WebGL —
// it's the simplest robust way to get real page scrolling and parallax,
// and it never has to touch the gallery's own render loop.
export class ProjectPage {
  constructor(app, { onClose } = {}) {
    this.app = app
    this.onClose = onClose || (() => {})
    this.tile = null

    this.root = document.getElementById('project-page')
    this.backLink = document.getElementById('project-back')
    this.titleEl = document.getElementById('project-title')
    this.clientEl = document.getElementById('project-client')
    this.clientRow = document.getElementById('project-client-row')
    this.yearEl = document.getElementById('project-year')
    this.yearRow = document.getElementById('project-year-row')
    this.media = document.getElementById('project-media')

    this.buttons = new ProjectButtons(document.getElementById('project-info-actions'))

    this.backLink.addEventListener('click', (e) => {
      e.preventDefault()
      this.close()
    })

    // The hero's own aspect ratio decides how much width it needs (see
    // heroLayout.js) — a window resize while the page is open can flip
    // that between the sidebar and stacked layouts, so it has to be able
    // to recompute, not just reflow via CSS percentages like before.
    this._onResize = () => {
      if (this.isOpen) this._applyHeroLayout()
    }
    window.addEventListener('resize', this._onResize)

    this._onScroll = () => this._updateParallax()
    this.root.addEventListener('scroll', this._onScroll, { passive: true })

    // Drives this page's own scroll manually from the wheel delta instead
    // of leaving it to the browser's native target resolution — Chromium
    // (at least under fast/close-together wheel ticks) doesn't reliably
    // keep targeting this page once it hits a certain pace, and lets the
    // gesture fall through to the gallery page underneath instead. Because
    // that background is still visually hidden behind this opaque overlay,
    // nothing looks wrong while it's happening — it only shows up as a
    // silently-relocated scroll position once this page closes. Redirecting
    // deterministically here (and preventing the native scroll outright)
    // removes that ambiguity entirely, the same way JournalView already
    // drives its own filmstrip from wheel deltas rather than trusting the
    // browser's default target.
    this._onWheel = (e) => {
      if (!this.isOpen) return
      e.preventDefault()
      this.root.scrollTop += e.deltaY
    }
    window.addEventListener('wheel', this._onWheel, { passive: false })
  }

  get isOpen() {
    return this.tile !== null
  }

  // The hero is sized to its own native aspect ratio (no crop) — see
  // heroLayout.js, the same math DetailView's WebGL zoom already lands on,
  // so the DOM hand-off is pixel-identical.
  open(tile) {
    const item = tile.item
    this.tile = tile

    this.titleEl.textContent = item.title
    this.clientEl.textContent = item.client || ''
    this.clientRow.hidden = !item.client
    this.yearEl.textContent = item.year || ''
    this.yearRow.hidden = !item.year

    this._applyHeroLayout()
    this.media.innerHTML = ''

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
    this.media.appendChild(heroEl)
    this._heroReady = waitForHeroReady(heroEl, item.type)

    // Extra images/screenshots stack below the hero in normal page flow,
    // full width of the media column, uncropped at their own aspect ratio.
    const extras = item.type === 'video' ? item.screenshots : item.images
    ;(extras || []).forEach((extra) => {
      const wrap = document.createElement('div')
      wrap.className = 'project-extra'
      const img = document.createElement('img')
      img.src = extra.src
      img.alt = ''
      img.loading = 'lazy'
      img.className = 'project-extra-media'
      wrap.appendChild(img)
      this.media.appendChild(wrap)
    })

    this.root.scrollTop = 0
    // Caller shows the page (see `show()`) only once this resolves — the
    // WebGL hero stays on screen until the DOM one actually has a frame
    // to paint, so the swap is a hard cut between two identical-looking
    // pixels instead of a fade with nothing (a white flash) in between.
    return this._heroReady
  }

  // Makes the built page visible — instant, no fade (see open()'s comment
  // on why easing this would reintroduce the flash it's meant to avoid).
  // Also locks the gallery page's own scroll (same technique as the
  // Journal detail panel's body.journal-detail-open) — without this, once
  // this page's own scroll hits its end, the gesture chains through to
  // the still-scrollable background behind it (invisible under this
  // opaque overlay), so closing later would land back on whatever the
  // background silently scrolled to instead of where it was left.
  show() {
    this.root.classList.add('is-visible')
    document.body.classList.add('project-page-open')
    this.buttons.enable()
  }

  close() {
    if (this._fullVideoEl) {
      this._fullVideoEl.pause()
      this._fullVideoEl.removeAttribute('src')
      this._fullVideoEl.load()
      this._fullVideoEl = null
    }
    this.buttons.disable()
    this.root.classList.remove('is-visible')
    document.body.classList.remove('project-page-open')
    const tile = this.tile
    this.tile = null
    this.onClose(tile)
  }

  // Recomputes the hero/info split for the open item's aspect ratio (see
  // heroLayout.js) and hands the numbers to CSS as custom properties, so
  // the rest of the layout (extras, the info column, the .is-stacked
  // fallback) stays plain, declarative CSS rather than JS-positioned.
  _applyHeroLayout() {
    const aspect = this.tile.item.aspect
    const layout = computeHeroLayout({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      aspect,
    })
    this.root.classList.toggle('is-stacked', layout.stacked)
    this.root.style.setProperty('--hero-width', `${layout.width}px`)
    this.root.style.setProperty('--hero-height', `${layout.height}px`)
    this.root.style.setProperty('--info-width', layout.stacked ? '100%' : `${layout.infoWidth}px`)
    this.buttons.handleResize()
  }

  _updateParallax() {
    const vh = window.innerHeight
    this.media.querySelectorAll('.project-extra-media').forEach((img) => {
      const rect = img.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      const offset = (center - vh / 2) * -0.16
      // The image is scaled up (see .project-extra-media) so this shift
      // never uncovers empty space at the top/bottom of its overflow:
      // hidden wrap (.project-extra).
      img.style.transform = `scale(1.18) translateY(${offset}px)`
    })
  }
}
