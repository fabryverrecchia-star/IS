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

  // The hero is sized to the viewport itself (not its own aspect ratio)
  // and crop-fit (see .project-hero-media), matching the tile shader's
  // cover-fit UVs so the WebGL -> DOM hand-off is pixel-identical — no
  // per-item layout math needed here for that part any more.
  open(tile) {
    const item = tile.item
    this.tile = tile

    this.titleEl.textContent = item.title
    this.clientEl.textContent = item.client || ''
    this.clientRow.hidden = !item.client
    this.yearEl.textContent = item.year || ''
    this.yearRow.hidden = !item.year

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
