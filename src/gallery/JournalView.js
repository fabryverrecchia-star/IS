import { clamp } from './math.js'

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
export class JournalView {
  constructor({ items, root }) {
    this.items = items
    this.root = root
    this.track = root.querySelector('.journal-track')
    this.maxTranslate = 0

    this._buildDom()

    this._onResize = () => {
      clearTimeout(this._resizeTimeout)
      this._resizeTimeout = setTimeout(() => this._recomputeSize(), 150)
    }
    window.addEventListener('resize', this._onResize)
    this._recomputeSize()
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
      this.track.appendChild(card)
    })
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
      this.maxTranslate = Math.max(this.track.scrollWidth - window.innerWidth, 0)
      this.root.style.height = `${Math.round(window.innerHeight + this.maxTranslate)}px`
    })
  }

  // Called every frame from GalleryApp's own render loop while the gallery
  // (not full-text/3D — see .overview-active hiding the section in CSS) is
  // showing, the same way the fulltext tilt is piggybacked onto that loop —
  // cheap enough (one rect read + a transform) not to need its own rAF.
  update() {
    if (!this.maxTranslate) return
    const rect = this.root.getBoundingClientRect()
    const scrollable = rect.height - window.innerHeight
    if (scrollable <= 0) return
    const progress = clamp(-rect.top / scrollable, 0, 1)
    this.track.style.transform = `translate3d(${-progress * this.maxTranslate}px, 0, 0)`
  }

  dispose() {
    clearTimeout(this._resizeTimeout)
    window.removeEventListener('resize', this._onResize)
  }
}
