import { clamp } from './math.js'

const PARALLAX_RANGE = 24 // px, the image's total pan headroom on hover — kept light

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
// the cursor within its own frame) and opens a click-through detail panel —
// photo full-bleed at 70% width on the left, classic project info in an
// editorial, lined layout on the right 30% (see openDetail below).
export class JournalView {
  constructor({ items, root }) {
    this.items = items
    this.root = root
    this.track = root.querySelector('.journal-track')
    this.maxTranslate = 0

    this.detail = document.getElementById('journal-detail')
    this.detailImg = document.getElementById('journal-detail-img')
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
    this.detailImg.src = item.src
    this.detailImg.alt = item.title
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
    this.detailClose.removeEventListener('click', this._onDetailClose)
    document.removeEventListener('keydown', this._onKeydown)
  }
}
