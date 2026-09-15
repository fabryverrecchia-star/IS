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

  // `rect` (the hero's hand-off transform) is intentionally unused for
  // positioning: #project-page is a normal scrollable flow container
  // scrolled to top, so its first child (the hero, width:100%) lands at
  // the exact same pixel rect the WebGL hero ended at with no extra math.
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

    let heroEl
    if (item.type === 'video' && tile.video) {
      heroEl = tile.video
      heroEl.controls = false
      if (heroEl.paused) heroEl.play().catch(() => {})
    } else {
      heroEl = document.createElement('img')
      heroEl.src = item.src
      heroEl.alt = item.title
      heroEl.decoding = 'async'
    }
    heroEl.className = 'project-hero-media'
    this.heroSlot.appendChild(heroEl)

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
    this.root.classList.add('is-visible')
  }

  close() {
    if (this.tile && this.tile.video) {
      const pool = document.querySelector('.gallery-video-pool')
      if (pool) pool.appendChild(this.tile.video)
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
