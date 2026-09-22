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

// Owns the real project page shown after the WebGL entrance transition
// lands: the same split as the Journal detail panel (see JournalView.js) —
// a full-height media pane on the left 75% (the clicked cover, crop-fit to
// land pixel-identical on the WebGL hero it replaces, then any extra
// images/screenshots as a horizontally-scrollable filmstrip) and a fixed
// info panel on the right 25%. Kept deliberately as regular DOM/CSS rather
// than more WebGL — it's the simplest robust way to get the filmstrip's
// native scroll, and it never has to touch the gallery's own render loop.
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

    // Lets an ordinary vertical wheel/trackpad gesture drive the media
    // pane's horizontal scroll too — same technique as the Journal detail
    // panel (see JournalView._onDetailWheel).
    this._onMediaWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      this.media.scrollLeft += e.deltaY
    }
    this.media.addEventListener('wheel', this._onMediaWheel, { passive: false })
  }

  get isOpen() {
    return this.tile !== null
  }

  // The media pane's own layout (position:fixed, width:75%, height:100% —
  // see style.css) already reproduces the WebGL hero's final rect exactly,
  // and the hero slide inside it is sized to the pane itself (flex-basis
  // 100%) rather than the image's own aspect ratio, cropping the same way
  // the tile shader's cover-fit UVs do — so no per-item layout math is
  // needed here any more to keep the hand-off pixel-identical.
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

    // Extra images/screenshots join the same filmstrip, uncropped at their
    // own natural width (real "images tailles différentes" side by side) —
    // exactly the Journal detail panel's technique.
    const extras = item.type === 'video' ? item.screenshots : item.images
    ;(extras || []).forEach((extra) => {
      const img = document.createElement('img')
      img.src = extra.src
      img.alt = ''
      img.loading = 'lazy'
      img.className = 'project-extra-media'
      this.media.appendChild(img)
    })

    this.media.scrollLeft = 0
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
}
