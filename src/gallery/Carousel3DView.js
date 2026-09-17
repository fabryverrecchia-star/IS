import { loadGsap } from './loadGsap.js'

// 4th view mode: a scroll-driven 3D carousel per project, adapted from a
// Codrops "On-Scroll 3D Carousel" demo (GSAP ScrollSmoother/ScrollTrigger/
// SplitText). Fully self-contained — its own fixed wrapper/content that
// ScrollSmoother owns while active, created fresh on every entry and fully
// killed on exit so it never leaves normalizeScroll's global wheel/touch
// interception running behind the other 3 (plain window-scroll) modes.
//
// Unlike the reference demo, clicking a scene's title doesn't open a
// separate preview grid — it hands off to the site's own ProjectPage (see
// GalleryApp._handleCarousel3DOpen), so there's only one "view a project in
// full" implementation to maintain.
export class Carousel3DView {
  constructor({ items, onOpenItem }) {
    this.items = items
    this.onOpenItem = onOpenItem
    this.built = false
    this.active = false
    this.smoother = null
    this.splits = []
    this.timelines = []

    this.root = document.getElementById('carousel3d-view')
    this.sceneWrapper = document.getElementById('c3d-scene-wrapper')

    this._onTitleClick = (e) => {
      const title = e.currentTarget
      e.preventDefault()
      const index = Number(title.dataset.index)
      this.onOpenItem(this.items[index])
    }
  }

  // Picks the images shown as rotating carousel faces for one project: its
  // own real cover + extra photos when it has them, a single poster frame
  // for a video project, or just the cover alone when the extras on file
  // are only the repeated-cover placeholder (see galleryData.js) — 4 copies
  // of the same photo spinning would just look like a bug, not a feature.
  _getCardSources(item) {
    if (item.type === 'video') return [item.poster || item.src]
    const extras = (item.images || []).map((im) => im.src)
    const isPlaceholderRepeat = extras.length > 0 && extras.every((src) => src === item.src)
    const sources = isPlaceholderRepeat ? [item.src] : [item.src, ...extras]
    return [...new Set(sources)].slice(0, 6)
  }

  _buildDom() {
    this.items.forEach((item, index) => {
      const sources = this._getCardSources(item)

      const scene = document.createElement('div')
      scene.className = 'c3d-scene'

      const title = document.createElement('button')
      title.type = 'button'
      title.className = 'c3d-scene__title'
      title.dataset.index = String(index)
      title.dataset.speed = '0.75'
      title.innerHTML = `<span>${item.title}</span>`
      title.addEventListener('click', this._onTitleClick)
      scene.appendChild(title)

      const carousel = document.createElement('div')
      carousel.className = 'c3d-carousel'
      carousel._radius = sources.length <= 1 ? 0 : Math.max(420, sources.length * 90)

      sources.forEach((src) => {
        const cell = document.createElement('div')
        cell.className = 'c3d-carousel__cell'
        const card = document.createElement('div')
        card.className = 'c3d-card'
        const front = document.createElement('div')
        front.className = 'c3d-card__face c3d-card__face--front'
        front.style.backgroundImage = `url(${src})`
        const back = document.createElement('div')
        back.className = 'c3d-card__face c3d-card__face--back'
        back.style.backgroundImage = `url(${src})`
        card.appendChild(front)
        card.appendChild(back)
        cell.appendChild(card)
        carousel.appendChild(cell)
      })

      scene.appendChild(carousel)
      this.sceneWrapper.appendChild(scene)
    })

    this.built = true
  }

  _setupCarouselCells(carousel) {
    const cells = carousel.querySelectorAll('.c3d-carousel__cell')
    const count = cells.length
    const radius = carousel._radius
    const angleStep = 360 / count
    cells.forEach((cell, i) => {
      cell.style.transform = `rotateY(${i * angleStep}deg) translateZ(${radius}px)`
    })
  }

  _animateChars(gsap, chars, direction, opts = {}) {
    const base = {
      autoAlpha: direction === 'in' ? 1 : 0,
      duration: 0.02,
      ease: 'none',
      stagger: { each: 0.04, from: direction === 'in' ? 'start' : 'end' },
      ...opts,
    }
    gsap.fromTo(chars, { autoAlpha: direction === 'in' ? 0 : 1 }, base)
  }

  _createScrollAnimation(gsap, ScrollTrigger, carousel) {
    const scene = carousel.closest('.c3d-scene')
    const cards = carousel.querySelectorAll('.c3d-card')
    const titleSpan = scene.querySelector('.c3d-scene__title span')
    const split = this.splits.find((s) => s.el === titleSpan)
    const chars = split?.split.chars || []

    // The natural 'top bottom' -> 'bottom top' range spans a full viewport
    // height *before* and *after* the scene, so the very first scene (no
    // room above it) and the very last (no room below) land exactly
    // halfway through their rotation at rest — which happens to be the
    // perfectly edge-on angle, i.e. invisible on both faces. Clamping their
    // one unreachable boundary to the scene's own edge gives them a full,
    // reachable range that rests at a flat, visible front/back face instead.
    const isFirst = scene === this.sceneWrapper.firstElementChild
    const isLast = scene === this.sceneWrapper.lastElementChild

    const timeline = gsap.timeline({
      defaults: { ease: 'sine.inOut' },
      scrollTrigger: {
        trigger: scene,
        start: isFirst ? 'top top' : 'top bottom',
        end: isLast ? 'bottom bottom' : 'bottom top',
        scrub: true,
      },
    })

    timeline
      .fromTo(carousel, { rotationY: 0 }, { rotationY: -180 }, 0)
      .fromTo(carousel, { rotationZ: 3, rotationX: 3 }, { rotationZ: -3, rotationX: -3 }, 0)
      .fromTo(cards, { filter: 'brightness(100%)' }, { filter: 'brightness(80%)', ease: 'power3' }, 0)
      .fromTo(cards, { rotationZ: 10 }, { rotationZ: -10, ease: 'none' }, 0)

    if (chars.length > 0) {
      this._animateChars(gsap, chars, 'in', {
        scrollTrigger: { trigger: scene, start: 'top center', toggleActions: 'play none none reverse' },
      })
    }

    this.timelines.push(timeline)
  }

  async enter() {
    const gsap = await loadGsap()
    const { ScrollTrigger, ScrollSmoother, SplitText } = window

    if (!this.built) this._buildDom()

    document.body.classList.add('carousel3d-active')
    this.root.setAttribute('aria-hidden', 'false')

    // SplitText re-splits fresh each entry (chars are plain spans, cheap)
    // rather than trying to keep instances alive across a full kill/create
    // cycle of the whole ScrollTrigger world below.
    this.splits = Array.from(this.sceneWrapper.querySelectorAll('.c3d-scene__title span')).map(
      (el) => ({ el, split: SplitText.create(el, { type: 'chars', charsClass: 'c3d-char', autoSplit: true }) })
    )

    this.sceneWrapper.querySelectorAll('.c3d-carousel').forEach((carousel) => {
      this._setupCarouselCells(carousel)
    })

    this.smoother = ScrollSmoother.create({
      wrapper: '#c3d-wrapper',
      content: '#c3d-content',
      smooth: 1,
      effects: true,
      normalizeScroll: true,
    })

    this.sceneWrapper.querySelectorAll('.c3d-carousel').forEach((carousel) => {
      this._createScrollAnimation(gsap, ScrollTrigger, carousel)
    })

    this.active = true
  }

  exit() {
    if (!this.active) return
    this.active = false

    this.timelines.forEach((tl) => tl.scrollTrigger && tl.scrollTrigger.kill())
    this.timelines.forEach((tl) => tl.kill())
    this.timelines = []

    this.splits.forEach(({ split }) => split.revert())
    this.splits = []

    if (this.smoother) {
      this.smoother.kill()
      this.smoother = null
    }

    document.body.classList.remove('carousel3d-active')
    this.root.setAttribute('aria-hidden', 'true')
  }

  dispose() {
    this.exit()
    if (this.built) {
      this.sceneWrapper
        .querySelectorAll('.c3d-scene__title')
        .forEach((title) => title.removeEventListener('click', this._onTitleClick))
    }
  }
}
