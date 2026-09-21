import { loadGsap } from './loadGsap.js'

// 3rd view mode: a scroll-driven 3D carousel per project, adapted from a
// Codrops "On-Scroll 3D Carousel" demo (GSAP ScrollSmoother/ScrollTrigger/
// SplitText). Fully self-contained — its own fixed wrapper/content that
// ScrollSmoother owns while active, created fresh on every entry and fully
// killed on exit so it never leaves normalizeScroll's global wheel/touch
// interception running behind the other 3 (plain window-scroll) modes.
//
// Unlike the reference demo, clicking a scene's title doesn't open a
// separate preview grid — it plays the same dramatic carousel-flies-away
// animation the demo used for that transition, then hands off to the
// site's own ProjectPage instead of the demo's own grid (see
// GalleryApp._handleCarousel3DOpen), so there's only one "view a project in
// full" implementation to maintain.
const CARDS_PER_SCENE = 4
// Must match .c3d-carousel's own `translateZ()` in style.css — the resting
// depth a carousel sits at before any scroll-driven rotation is applied.
const CAROUSEL_REST_Z = -550

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
      e.preventDefault()
      this.onOpenItem(Number(e.currentTarget.dataset.index))
    }
  }

  // Picks the images shown as the carousel's rotating faces: a project's
  // own real photos (cover + extras) first, then that same set repeated
  // in order to fill out a full CARDS_PER_SCENE-card carousel for every
  // project, even ones with only a single real photo on file (a video's
  // poster frame, or an image project without its own extras yet).
  _getCardSources(item) {
    const distinct =
      item.type === 'video'
        ? [item.poster || item.src]
        : [...new Set([item.src, ...(item.images || []).map((im) => im.src)])]
    return Array.from({ length: CARDS_PER_SCENE }, (_, i) => distinct[i % distinct.length])
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
    // Radius tracks the carousel's own current (fluid, clamp()'d) width
    // rather than a fixed px value — the fixed value used to describe a
    // fine desktop-sized carousel but left cards on narrower viewports
    // hugely over-projected and spilling off screen, since the perspective
    // math didn't know the card had shrunk. Same ratio (420/400) as the
    // original fixed desktop numbers, just computed instead of hardcoded.
    const radius = carousel.offsetWidth * 1.05
    const angleStep = 360 / count
    cells.forEach((cell, i) => {
      cell.style.transform = `rotateY(${i * angleStep}deg) translateZ(${radius}px)`
    })
  }

  // Called on window resize while this mode is active (see
  // GalleryApp._handleResize) — the fluid clamp()'d card size changes with
  // viewport width, so the radius each cell sits at has to be recomputed
  // to match, or cards drift out of alignment with their own carousel.
  handleResize() {
    if (!this.active) return
    this.sceneWrapper.querySelectorAll('.c3d-carousel').forEach((carousel) => {
      this._setupCarouselCells(carousel)
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

    // The wobble/tilt below is meant to be a fleeting mid-scroll effect —
    // fine to rest anywhere in its ±3/±10 range for a middle scene, since
    // the user only ever sees it in motion, passing through on their way
    // to the next scene. isFirst/isLast scenes are different: whichever
    // end of the scrub range is their *permanent, no-more-scroll-available*
    // resting position (progress 0 for isFirst, 1 for isLast) is a state
    // real visitors sit on and look at, so it's zeroed to a flat, straight
    // card there instead of the ordinary tilted extreme.
    const wobbleFrom = isFirst ? 0 : 3
    const wobbleTo = isLast ? 0 : -3
    const cardRotFrom = isFirst ? 0 : 10
    const cardRotTo = isLast ? 0 : -10

    timeline
      .fromTo(carousel, { rotationY: 0 }, { rotationY: -180 }, 0)
      .fromTo(carousel, { rotationZ: wobbleFrom, rotationX: wobbleFrom }, { rotationZ: wobbleTo, rotationX: wobbleTo }, 0)
      .fromTo(cards, { filter: 'brightness(100%)' }, { filter: 'brightness(80%)', ease: 'power3' }, 0)
      .fromTo(cards, { rotationZ: cardRotFrom }, { rotationZ: cardRotTo, ease: 'none' }, 0)

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
    this._gsap = gsap
    this._ScrollTrigger = ScrollTrigger

    if (!this.built) this._buildDom()

    document.body.classList.add('carousel3d-active')
    this.root.setAttribute('aria-hidden', 'false')
    // Undo whatever a previous playOpenTransition() left behind — the scene
    // DOM persists across enter/exit cycles, only the scroll-triggered
    // timelines below are rebuilt fresh. clearProps wipes the inline style
    // *attribute*, but GSAP still renders transforms from its own per-
    // property cache on the element (x/y/z/rotationX/Y/Z), not by reading
    // that attribute back — and the resting scrub timeline below never
    // touches `z` at all (only the fly-away does), so a stale cached z
    // would otherwise render forever once anything else nudges the
    // transform. Reset every property the fly-away actually touches, back
    // to the *CSS resting values* (z: CAROUSEL_REST_Z), not z: 0 — zeroing
    // it out entirely used to drag every carousel ~550px toward the camera,
    // wildly amplifying the perspective-projected size of the front card.
    gsap.set(this.root, { clearProps: 'all' })
    gsap.set(this.sceneWrapper.querySelectorAll('.c3d-carousel'), {
      z: CAROUSEL_REST_Z,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    })
    gsap.set(this.sceneWrapper.querySelectorAll('.c3d-card'), { rotationZ: 0 })

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

  // The reference demo's own carousel -> preview-grid transition: scroll
  // the clicked scene to center screen, fade its title out character by
  // character, then send the carousel spinning and flying off toward the
  // camera. Reused as-is for the "open a project" moment even though what
  // follows is the site's ProjectPage rather than the demo's grid — resolves
  // once the fly-away finishes so the caller can cut to it right after.
  playOpenTransition(index) {
    const gsap = this._gsap
    const ScrollTrigger = this._ScrollTrigger
    const scene = this.sceneWrapper.children[index]
    const carousel = scene.querySelector('.c3d-carousel')
    const cards = scene.querySelectorAll('.c3d-card')
    const titleSpan = scene.querySelector('.c3d-scene__title span')
    const chars = this.splits.find((s) => s.el === titleSpan)?.split.chars || []

    const offsetTop = scene.getBoundingClientRect().top + window.scrollY
    const targetY = offsetTop - window.innerHeight / 2 + scene.offsetHeight / 2

    ScrollTrigger.getAll().forEach((t) => t.disable(false))

    // Resolves once the view has visibly faded out (~2.2s in) rather than
    // waiting for the full 3.2s the carousel's fly-away tween keeps running
    // underneath — that tail end is invisible anyway once the root's opacity
    // hits 0, so cutting to the project page there avoids a dead blank beat.
    return new Promise((resolve) => {
      this._openTimeline = gsap
        .timeline({ defaults: { duration: 1.5, ease: 'power2.inOut' } })
        .to(window, { scrollTo: { y: targetY, autoKill: true } }, 0)
        .to(chars, { autoAlpha: 0, duration: 0.02, ease: 'none', stagger: { each: 0.04, from: 'end' } }, 0)
        .to(carousel, { rotationX: 90, rotationY: -360, z: -2000 }, 0)
        .to(carousel, { duration: 2.5, ease: 'power3.inOut', z: 1500, rotationZ: 270 }, 0.7)
        .to(cards, { rotationZ: 0 }, 0)
        .to(this.root, { autoAlpha: 0, duration: 0.6, onComplete: resolve }, '<+=1.6')
    })
  }

  exit() {
    if (!this.active) return
    this.active = false

    this.timelines.forEach((tl) => tl.scrollTrigger && tl.scrollTrigger.kill())
    this.timelines.forEach((tl) => tl.kill())
    this.timelines = []

    // playOpenTransition's fly-away resolves before its own tail end (the
    // carousel still mid-flight) actually finishes — stop it here rather
    // than let it keep writing transform values in the background.
    if (this._openTimeline) {
      this._openTimeline.kill()
      this._openTimeline = null
    }

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
