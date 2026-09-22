import { clamp } from './math.js'

const PARALLAX_RANGE = 24 // px, the image's total pan headroom on hover — kept light
const REVEAL_DISTANCE = 340 // px — how far a card travels in from the right edge before it's fully revealed

// "Journal" strip: a plain DOM section (no WebGL) sitting in normal document
// flow right after the main gallery, before the footer — a demo news/updates
// section reusing existing photos (see journalItems in galleryData.js). All
// 6 cards share one fixed 4:3 box (80% of the viewport height), title below.
//
// The horizontal scroll is driven by ordinary vertical page scroll, not a
// wheel-event hijack: `.journal-sticky` pins to the top of the viewport via
// CSS `position: sticky` for exactly as much extra scroll distance as the
// track's horizontal overflow, and each frame the track's translateX is set
// from how far the page has scrolled through that pinned range. Once the
// range is exhausted the section un-pins and normal vertical scroll carries
// on to the footer — no preventDefault, no wheel listener, works the same
// on trackpad/mouse/touch as any other scroll.
//
// Each card also has a light hover parallax (the image pans a few px against
// the cursor within its own frame), reveals via a clip-path wipe (toward the
// right, ease-out) as it travels in from the right edge of the viewport
// while scrolling, and opens a click-through detail panel — a horizontally-
// scrollable showcase of that entry's own photos on the left, classic
// project info fixed on the right (see openDetail below).
export class JournalView {
  constructor({ items, root }) {
    this.items = items
    this.root = root
    this.label = document.getElementById('journal-label')
    this.track = root.querySelector('.journal-track')
    this.cardEls = []
    this.cardOffsets = []
    this.maxTranslate = 0
    this._labelRevealed = false

    this.detail = document.getElementById('journal-detail')
    this.detailMedia = document.getElementById('journal-detail-media')
    this.detailTitle = document.getElementById('journal-detail-title')
    this.detailClient = document.getElementById('journal-detail-client')
    this.detailYear = document.getElementById('journal-detail-year')
    this.detailCategory = document.getElementById('journal-detail-category')
    this.detailDesc = document.getElementById('journal-detail-desc')
    this.detailClose = document.getElementById('journal-detail-close')

    this._buildDom()

    this._onResize = () => {
      clearTimeout(this._resizeTimeout)
      this._resizeTimeout = setTimeout(() => this._recomputeSize(), 150)
    }
    window.addEventListener('resize', this._onResize)
    this._recomputeSize()

    this._onDetailClose = () => this.closeDetail()
    this._onKeydown = (e) => {
      if (e.key === 'Escape') this.closeDetail()
    }
    this.detailClose.addEventListener('click', this._onDetailClose)
    document.addEventListener('keydown', this._onKeydown)

    // Lets an ordinary vertical wheel/trackpad gesture drive the showcase's
    // horizontal scroll too — without this, seeing "the rest" needs a
    // horizontal-specific gesture (shift+wheel, a trackpad swipe), which
    // isn't obvious for a pane that only scrolls sideways.
    this._onDetailWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      this.detailMedia.scrollLeft += e.deltaY
    }
    this.detailMedia.addEventListener('wheel', this._onDetailWheel, { passive: false })
  }

  _buildDom() {
    this.items.forEach((item) => {
      const card = document.createElement('article')
      card.className = 'journal-card'

      const media = document.createElement('div')
      media.className = 'journal-card-media'
      const img = document.createElement('img')
      img.src = item.src
      img.alt = item.title
      img.loading = 'lazy'
      media.appendChild(img)

      const title = document.createElement('h3')
      title.className = 'journal-card-title'
      title.textContent = item.title

      card.appendChild(media)
      card.appendChild(title)
      card.addEventListener('click', () => this.openDetail(item))
      this._bindParallax(media, img)

      this.track.appendChild(card)
      this.cardEls.push(card)
    })
  }

  // Pans the image a few px opposite the cursor within its own frame — the
  // resting `scale(1.08)` in CSS leaves enough headroom that panning never
  // reveals an empty edge. Cheap enough per card (a rect read + a transform)
  // to bind directly rather than routing through the main render loop.
  _bindParallax(media, img) {
    const onMove = (e) => {
      const rect = media.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      img.style.transform = `translate3d(${-px * PARALLAX_RANGE}px, ${-py * PARALLAX_RANGE}px, 0) scale(1.08)`
    }
    const onLeave = () => {
      img.style.transform = 'translate3d(0, 0, 0) scale(1.08)'
    }
    media.addEventListener('pointermove', onMove)
    media.addEventListener('pointerleave', onLeave)
  }

  openDetail(item) {
    this.detailMedia.innerHTML = ''
    const gallery = item.gallery && item.gallery.length ? item.gallery : [{ src: item.src }]
    gallery.forEach((photo) => {
      const img = document.createElement('img')
      img.src = photo.src
      img.alt = item.title
      this.detailMedia.appendChild(img)
    })
    this.detailMedia.scrollLeft = 0

    this.detailTitle.textContent = item.title
    this.detailClient.textContent = item.client || '—'
    this.detailYear.textContent = item.year || '—'
    this.detailCategory.textContent = item.category || '—'
    this.detailDesc.textContent = item.description || ''
    this.detail.classList.add('is-open')
    this.detail.setAttribute('aria-hidden', 'false')
    document.body.classList.add('journal-detail-open')
  }

  closeDetail() {
    if (!this.detail.classList.contains('is-open')) return
    this.detail.classList.remove('is-open')
    this.detail.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('journal-detail-open')
  }

  _recomputeSize() {
    // Card size (4:3, 80% of viewport height) is set as CSS custom
    // properties so the stylesheet drives the actual box — this just
    // measures the resulting track width once that's applied, to know how
    // much extra scroll distance the sticky pin needs.
    const cardHeight = window.innerHeight * 0.8
    const cardWidth = cardHeight * (4 / 3)
    this.root.style.setProperty('--journal-card-width', `${cardWidth}px`)
    this.root.style.setProperty('--journal-card-height', `${cardHeight}px`)

    requestAnimationFrame(() => {
      // The track no longer spans the full viewport width — the label pinned
      // to its left (see .journal-label) eats into it — so the scrollable
      // distance only needs to cover what's left over for the track itself.
      const trackVisibleWidth = window.innerWidth - this.label.offsetWidth
      this.maxTranslate = Math.max(this.track.scrollWidth - trackVisibleWidth, 0)
      this.root.style.height = `${Math.round(window.innerHeight + this.maxTranslate)}px`
      // Cached once layout has settled at the new size — read as plain
      // numbers in update() below instead of a getBoundingClientRect() per
      // card per frame, since offsetLeft/offsetWidth don't change once the
      // track itself isn't being resized (only its transform moves).
      this.cardOffsets = this.cardEls.map((el) => ({ left: el.offsetLeft, width: el.offsetWidth }))
    })
  }

  // Called every frame from GalleryApp's own render loop while the gallery
  // (not full-text/3D — see .overview-active hiding the section in CSS) is
  // showing, the same way the fulltext tilt is piggybacked onto that loop —
  // cheap enough (one rect read + a transform) not to need its own rAF.
  update() {
    if (!this.maxTranslate) return
    const rect = this.root.getBoundingClientRect()

    // One-time reveal for the pinned label, the moment the section first
    // comes into view — independent of the scrollable/pin guard below,
    // which only concerns the track's horizontal progress.
    if (!this._labelRevealed && rect.top < window.innerHeight * 0.92) {
      this.label.classList.add('is-revealed')
      this._labelRevealed = true
    }

    const scrollable = rect.height - window.innerHeight
    if (scrollable <= 0) return
    const progress = clamp(-rect.top / scrollable, 0, 1)
    const translateX = -progress * this.maxTranslate
    this.track.style.transform = `translate3d(${translateX}px, 0, 0)`

    // Reveal a card via a clip-path wipe (toward the right, eased out) as it
    // travels in from the right edge of the viewport — instead of popping
    // fully visible the instant it crosses the edge. Position is derived
    // from the cached layout offset + this frame's translateX rather than a
    // live rect read, so no extra reflow per card.
    const viewportWidth = window.innerWidth
    this.cardEls.forEach((card, i) => {
      const offset = this.cardOffsets[i]
      if (!offset) return
      const left = offset.left + translateX
      const t = clamp((viewportWidth - left) / REVEAL_DISTANCE, 0, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      card.style.clipPath = `inset(0 ${(1 - eased) * 100}% 0 0)`
    })
  }

  dispose() {
    clearTimeout(this._resizeTimeout)
    window.removeEventListener('resize', this._onResize)
    this.detailClose.removeEventListener('click', this._onDetailClose)
    document.removeEventListener('keydown', this._onKeydown)
    this.detailMedia.removeEventListener('wheel', this._onDetailWheel)
  }
}
