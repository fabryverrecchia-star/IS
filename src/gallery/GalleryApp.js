import * as THREE from 'three'
import { galleryItems, journalItems } from '../data/galleryData.js'
import { computeGalleryLayout } from './layout.js'
import { Tile } from './Tile.js'
import { DetailView } from './DetailView.js'
import { ProjectPage } from './ProjectPage.js'
import { JournalView } from './JournalView.js'
import { clamp, smoothstep, damp } from './math.js'

const CAMERA_DISTANCE = 1000
const MAGNET_RADIUS_FACTOR = 0.7 // multiple of cell width, kept close to the hovered tile
const MAX_PULL_PX = 12
const MAX_LIFT_PX = 16
const MAX_SCALE_BOOST = 0.028
const MAX_TILT = 0.085 // radians, ~5deg
const VIDEO_PLAY_MARGIN = 260 // px beyond viewport edges to start/stop playback
const MODE_REVEAL_MAX_STAGGER = 0.3 // s, matches the cap in _animateTilesReveal
const MODE_REVEAL_DURATION = 0.6 // s, matches Tile's _modeRevealDuration
const MODE_TRANSITION_MS = (MODE_REVEAL_MAX_STAGGER + MODE_REVEAL_DURATION) * 1000
const TILE_LABEL_OFFSET_Y = 14 // px below the tile's projected bottom edge

export class GalleryApp {
  constructor(root, { onProgress, onReady } = {}) {
    this.root = root
    this.onProgress = onProgress || (() => {})
    this.onReady = onReady || (() => {})

    this.items = galleryItems
    this.tiles = []
    this.loadedCount = 0
    this.readyFired = false

    this.viewMode = 'grid' // 'grid' (the hybrid gallery) | 'fulltext' (title list)
    this._dragScroll = null
    this._dragScrollMoved = false
    this._modeVisibilityTimer = null
    this._openedFromFulltext = false
    this._modeSwitching = false
    this.overviewToggle = document.getElementById('overview-toggle')
    this.fulltextView = document.getElementById('fulltext-view')
    this.fulltextList = document.getElementById('fulltext-list')
    this.fulltextPreview = document.getElementById('fulltext-preview')
    this.fulltextPreviewImg = document.getElementById('fulltext-preview-img')
    this.fulltextPreviewVideo = document.getElementById('fulltext-preview-video')
    this._buildFulltextList()

    this.viewportWidth = window.innerWidth
    this.viewportHeight = window.innerHeight

    this.scrollSmoothed = 0
    this.scrollPrev = 0
    this.tiltCurrent = 0

    this.mouseNDC = new THREE.Vector2(9999, 9999)
    this.mouseWorld = new THREE.Vector3()
    this.mouseLocal = new THREE.Vector3()
    this._labelProjectVec = new THREE.Vector3()
    this.mouseActive = false
    this.raycaster = new THREE.Raycaster()
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

    this._tmpDelta = new THREE.Vector2()
    this._tmpHoverUv = new THREE.Vector2()
    this._tmpPull = new THREE.Vector2()

    this.clock = new THREE.Clock()
    this.running = false
    this.rafId = null

    this._buildDom()
    this._initThree()
    this._buildLayout(true)
    this.detailView = new DetailView(this)
    this.detailView.onOpenComplete = (tile, rect) => this._handleProjectOpen(tile, rect)
    this.detailView.onCloseComplete = () => this._handleDetailCloseComplete()
    this.projectPage = new ProjectPage(this, {
      onClose: (tile) => this._handleProjectClose(tile),
    })
    this.journal = new JournalView({ items: journalItems, root: document.getElementById('journal') })
    this._bindEvents()

    // Safety net so the loader never hangs indefinitely on a slow asset.
    this._readyTimeout = setTimeout(() => this._fireReady(), 6000)

    this.start()
  }

  _buildDom() {
    this.canvasRoot = document.createElement('div')
    this.canvasRoot.className = 'gallery-canvas-root'
    this.root.appendChild(this.canvasRoot)

    this.spacer = document.createElement('div')
    this.spacer.className = 'gallery-spacer'
    this.root.appendChild(this.spacer)

    // Video elements must be attached to the document to reliably decode,
    // but they're never seen directly — the WebGL canvas paints their frames.
    this.videoContainer = document.createElement('div')
    this.videoContainer.className = 'gallery-video-pool'
    this.root.appendChild(this.videoContainer)

    // Each tile's title lives here as plain DOM text, not baked into the
    // WebGL scene — positioned every frame from the tile's own projected
    // screen position (see _updateTileLabels) so it tracks the canvas's
    // scroll/tilt/scale exactly without needing a texture per title.
    this.tileLabels = document.createElement('div')
    this.tileLabels.className = 'gallery-tile-labels'
    this.root.appendChild(this.tileLabels)
  }

  // Builds the magazine-style title list once at startup (kept in the DOM,
  // hidden via CSS until viewMode === 'fulltext' — see toggleViewMode).
  _buildFulltextList() {
    this.items.forEach((item, index) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'fulltext-item'
      btn.dataset.index = String(index)
      btn.textContent = item.title
      // Staggered entrance (see .fulltext-list.is-revealed in style.css) —
      // fixed per item so it doesn't need recomputing on every toggle.
      btn.style.transitionDelay = `${Math.min(index * 0.035, 0.35)}s`
      this.fulltextList.appendChild(btn)
    })
  }

  _initThree() {
    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.viewportWidth / this.viewportHeight,
      10,
      4000
    )
    this.camera.position.set(0, 0, CAMERA_DISTANCE)
    this._updateCameraFov()

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0xffffff, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.setSize(this.viewportWidth, this.viewportHeight)
    this.canvasRoot.appendChild(this.renderer.domElement)

    this.contentGroup = new THREE.Group()
    this.scene.add(this.contentGroup)

    this.textureLoader = new THREE.TextureLoader()
  }

  _updateCameraFov() {
    const fovRad = 2 * Math.atan(this.viewportHeight / 2 / CAMERA_DISTANCE)
    this.camera.fov = THREE.MathUtils.radToDeg(fovRad)
    this.camera.aspect = this.viewportWidth / this.viewportHeight
    this.camera.updateProjectionMatrix()
  }

  _buildLayout(initial) {
    this.layout = computeGalleryLayout(this.items, this.viewportWidth, this.viewportHeight)
    this.spacer.style.height = `${Math.round(this.layout.totalHeight)}px`

    if (initial) {
      this.items.forEach((item, index) => {
        const cell = { ...this.layout.positions[index] }
        const tile = new Tile({
          item,
          cell,
          index,
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
          textureLoader: this.textureLoader,
          videoContainer: this.videoContainer,
          onAssetReady: () => this._handleAssetReady(),
        })
        this.tiles.push(tile)
        this.contentGroup.add(tile.group)

        const label = document.createElement('span')
        label.className = 'gallery-tile-label'
        label.textContent = item.title
        this.tileLabels.appendChild(label)
        tile.labelEl = label
      })
    } else {
      this.tiles.forEach((tile, index) => {
        tile.applyCell({ ...this.layout.positions[index] }, this.viewportWidth, this.viewportHeight)
      })
    }
  }

  _handleAssetReady() {
    this.loadedCount += 1
    this.onProgress(this.loadedCount / this.items.length)
    if (this.loadedCount >= this.items.length) this._fireReady()
  }

  _fireReady() {
    if (this.readyFired) return
    this.readyFired = true
    clearTimeout(this._readyTimeout)
    this.onReady()
  }

  _bindEvents() {
    this._onResize = () => {
      clearTimeout(this._resizeTimeout)
      this._resizeTimeout = setTimeout(() => this._handleResize(), 150)
    }
    this._onPointerMove = (e) => {
      this._handlePointerMove(e)
      this._updateDragScroll(e)
    }
    this._onPointerDown = (e) => {
      this._handlePointerMove(e)
      this._startDragScroll(e)
    }
    this._onPointerLeave = () => {
      this.mouseActive = false
    }
    // Touch has no hover state: a tap fires pointerdown (which flips
    // mouseActive on, same as a mouse) but never a mouseleave, so on phone
    // the magnet warp/dim effect was getting stuck on the last-tapped tile
    // forever. Clear it as soon as the finger lifts (or the touch is
    // cancelled by a scroll) for any non-mouse pointer.
    this._onPointerUp = (e) => {
      if (e.pointerType !== 'mouse') this.mouseActive = false
      this._endDragScroll()
    }
    this._onClick = (e) => {
      // A click that ends a press-and-drag scroll (see _startDragScroll)
      // shouldn't also open the tile sitting under the cursor.
      if (this._dragScrollMoved) {
        this._dragScrollMoved = false
        return
      }
      this._handleClick()
    }
    this._onOverviewToggle = (e) => {
      e.stopPropagation()
      this.toggleViewMode()
    }
    this._onFulltextClick = (e) => {
      const item = e.target.closest('.fulltext-item')
      if (!item) return
      e.stopPropagation()
      this._handleFulltextOpen(Number(item.dataset.index))
    }
    this._onFulltextOver = (e) => {
      const item = e.target.closest('.fulltext-item')
      if (!item) return
      const galleryItem = this.items[Number(item.dataset.index)]
      if (galleryItem.type === 'video') {
        this.fulltextPreviewImg.classList.remove('is-active')
        this.fulltextPreviewVideo.classList.add('is-active')
        if (this.fulltextPreviewVideo.getAttribute('src') !== galleryItem.src) {
          this.fulltextPreviewVideo.src = galleryItem.src
        }
        this.fulltextPreviewVideo.play().catch(() => {})
      } else {
        this.fulltextPreviewVideo.pause()
        this.fulltextPreviewVideo.classList.remove('is-active')
        this.fulltextPreviewImg.classList.add('is-active')
        this.fulltextPreviewImg.src = galleryItem.src
      }
      this.fulltextPreview.classList.add('is-visible')
    }
    this._onFulltextLeave = () => {
      this.fulltextPreview.classList.remove('is-visible')
      this.fulltextPreviewVideo.pause()
    }
    this._onFulltextMove = (e) => {
      this.fulltextPreview.style.transform = `translate(${e.clientX + 28}px, ${e.clientY - 162}px)`
    }
    this._onVisibility = () => {
      if (document.hidden) this.stop()
      else this.start()
    }
    // Escape needs to know which side owns the current state: mid-transition
    // the gallery loop is still running so DetailView can reverse itself
    // directly, but once handed off to the project page the loop is
    // stopped, so closing has to go through ProjectPage.close() to resume
    // it first (same path as clicking the back link).
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return
      if (this.detailView.state === 'project') this.projectPage.close()
      else if (this.detailView.state === 'opening') this.detailView.close()
    }

    window.addEventListener('resize', this._onResize)
    window.addEventListener('pointermove', this._onPointerMove, { passive: true })
    window.addEventListener('pointerdown', this._onPointerDown, { passive: true })
    window.addEventListener('pointerup', this._onPointerUp, { passive: true })
    window.addEventListener('pointercancel', this._onPointerUp, { passive: true })
    window.addEventListener('click', this._onClick)
    document.addEventListener('mouseleave', this._onPointerLeave)
    document.addEventListener('visibilitychange', this._onVisibility)
    document.addEventListener('keydown', this._onKeydown)
    this.overviewToggle.addEventListener('click', this._onOverviewToggle)
    this.fulltextList.addEventListener('click', this._onFulltextClick)
    this.fulltextList.addEventListener('pointerover', this._onFulltextOver)
    this.fulltextList.addEventListener('pointerleave', this._onFulltextLeave)
    this.fulltextList.addEventListener('pointermove', this._onFulltextMove)
  }

  // Toggles the header button between the two view modes: the hybrid
  // gallery (computeGalleryLayout — a mix of aligned columns and
  // masonry-packed, proportion-true cell heights) and the full-text
  // magazine list. Entering/leaving full text just swaps the WebGL canvas
  // for the DOM list since the tiles are fully hidden either way, so a
  // snap is unnoticeable.
  toggleViewMode() {
    if (this.detailView.isActive || this._modeSwitching) return
    if (this.viewMode === 'grid') this._enterFulltext()
    else this._exitFulltextToGrid()
  }

  _setMode(mode) {
    this.viewMode = mode
    this.overviewToggle.setAttribute('data-mode', mode)
    document.body.classList.toggle('overview-active', mode !== 'grid')
  }

  // Staggered per-tile wipe (see Tile.setModeReveal): target 0 hides tiles
  // top-down for the switch into full text, target 1 reveals them back
  // bottom-up (the same look as the initial page load-in) coming back.
  _animateTilesReveal(target) {
    this.tiles.forEach((tile, i) => {
      tile.setModeReveal(target, Math.min(i * 0.03, MODE_REVEAL_MAX_STAGGER))
    })
  }

  // Tiles wipe away (top-down) while the title list fades/slides in line by
  // line on the same beat — the canvas itself stays visible and rendering
  // until that finishes (see MODE_TRANSITION_MS) so the wipe is seen, then
  // gets hidden entirely rather than left rendering nothing underneath.
  _enterFulltext() {
    this._setMode('fulltext')
    clearTimeout(this._modeVisibilityTimer)
    document.body.classList.add('fulltext-active')
    window.scrollTo(0, 0)
    // The list's own rendered height (its content grows with clamp()'d
    // font sizes) is what should drive the real scrollbar range while
    // it's showing, not whatever the mosaic layout last computed.
    this.spacer.style.height = `${Math.round(this.fulltextView.offsetHeight)}px`

    this._animateTilesReveal(0)
    // One frame so the list's default (hidden) state actually paints
    // before .is-revealed flips it — otherwise there's nothing to
    // transition *from* and the reveal would just snap in instantly.
    requestAnimationFrame(() => this.fulltextList.classList.add('is-revealed'))

    this._modeVisibilityTimer = setTimeout(() => {
      if (this.viewMode === 'fulltext') this.canvasRoot.classList.add('is-hidden')
    }, MODE_TRANSITION_MS)
  }

  // Reverse of the above: canvas reappears immediately and tiles reveal
  // back in while the title lines fade out; the list's container is only
  // actually torn down (display: none) once that fade has had time to play
  // — the delayed class removal only fires once nothing has re-entered
  // fulltext in the meantime.
  _leaveFulltext() {
    clearTimeout(this._modeVisibilityTimer)
    this.fulltextList.classList.remove('is-revealed')
    this.fulltextList.style.transform = ''
    this.fulltextPreview.classList.remove('is-visible')
    this.fulltextPreviewVideo.pause()
    this._modeVisibilityTimer = setTimeout(() => {
      if (this.viewMode !== 'fulltext') document.body.classList.remove('fulltext-active')
    }, MODE_TRANSITION_MS)
  }

  _exitFulltextToGrid() {
    this._setMode('grid')
    window.scrollTo(0, 0)
    this._leaveFulltext()

    this.canvasRoot.classList.remove('is-hidden')
    // Tiles were hidden the whole time fulltext was showing, so there's
    // nothing to tween position from — snap them straight to the grid
    // layout, then reveal them back in.
    this._buildLayout(false)
    this._animateTilesReveal(1)
  }

  // Opening a project from a title has no on-screen tile to zoom from, so
  // the clicked tile is temporarily repositioned to whatever's actually
  // visible at that moment — the hover-preview thumbnail if one was showing
  // (the common case on desktop), or the title row itself otherwise (touch,
  // or a click with no prior hover) — before running the exact same zoom
  // DetailView already does for a normal grid click. The list is only faded
  // out, not torn down, and viewMode stays 'fulltext' throughout so closing
  // (_handleDetailCloseComplete) returns to the list instead of the grid.
  _handleFulltextOpen(index) {
    if (this.detailView.isActive) return
    const tile = this.tiles[index]
    if (!tile) return

    const itemEl = this.fulltextList.querySelector(`.fulltext-item[data-index="${index}"]`)
    const previewVisible = this.fulltextPreview.classList.contains('is-visible')
    const rect = previewVisible ? this.fulltextPreview.getBoundingClientRect() : itemEl.getBoundingClientRect()

    tile.applyCell(
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height },
      this.viewportWidth,
      this.viewportHeight
    )

    clearTimeout(this._modeVisibilityTimer)
    this._openedFromFulltext = true
    this.fulltextView.classList.add('is-hidden-for-project')
    this.fulltextPreview.classList.remove('is-visible')
    this.canvasRoot.classList.remove('is-hidden')

    this.detailView.open(tile)
  }

  // Mirror image of _handleFulltextOpen once the closing zoom lands: hide
  // the canvas again and bring the (never-torn-down) list back.
  _handleDetailCloseComplete() {
    if (!this._openedFromFulltext) return
    this._openedFromFulltext = false
    this.canvasRoot.classList.add('is-hidden')
    this.fulltextView.classList.remove('is-hidden-for-project')
  }

  _handleClick() {
    if (this.viewMode === 'fulltext') return
    if (this.detailView.state !== 'idle') return
    const tile = this.detailView.pick(this.mouseNDC)
    if (tile) this.detailView.open(tile)
  }

  // Called once the WebGL entrance animation lands: hand off to the real
  // scrollable project page and pause the gallery's own render loop since
  // it's fully hidden behind an opaque page until the user navigates back.
  // The WebGL hero stays visible (render loop still running) until the DOM
  // page's own hero element actually has a frame ready — only then do we
  // swap, so it's a hard cut between identical pixels instead of a gap of
  // bare background (the "white flash", worse for video since it has to
  // buffer a frame before it can paint anything at all).
  _handleProjectOpen(tile) {
    this.projectPage.open(tile).then(() => {
      this.projectPage.show()
      this.detailView.hideMesh()
      this.stop()
    })
  }

  _handleProjectClose() {
    // Mesh must be visible and positioned *before* the loop resumes —
    // start() renders synchronously, so doing this after it would render
    // one frame with neither the mesh nor the DOM page visible (a flash).
    this.detailView.showAtCurrent()
    this.detailView.close()
    this.start()
  }

  _handleResize() {
    const nextWidth = window.innerWidth
    const nextHeight = window.innerHeight

    // Mobile Safari/Chrome fire `resize` when their address bar/toolbar
    // collapses or expands on scroll — the width doesn't change and the
    // height only moves by the bar's height. Rebuilding the whole layout
    // on every one of those made the grid jump mid-scroll on phone. Only
    // react when it's an actual resize: width changed, or height moved by
    // more than a toolbar-sized amount (covers real orientation changes).
    const widthChanged = nextWidth !== this.viewportWidth
    const heightDelta = Math.abs(nextHeight - this.viewportHeight)
    if (!widthChanged && heightDelta < 150) return

    this.viewportWidth = nextWidth
    this.viewportHeight = nextHeight
    this._updateCameraFov()
    this.renderer.setSize(this.viewportWidth, this.viewportHeight)

    if (this.viewMode === 'fulltext') {
      // Tiles stay hidden and wherever they were — only the list's own
      // (now reflowed) height needs to keep driving the scroll range.
      this.spacer.style.height = `${Math.round(this.fulltextView.offsetHeight)}px`
    } else {
      this._buildLayout(false)
    }
  }

  _handlePointerMove(e) {
    this.mouseActive = true
    this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
    this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
  }

  // Press-and-drag scroll for the gallery layout: mouse only (touch already
  // scrolls natively — dragging there would double up and fight the
  // browser's own momentum scroll). Dragging follows the same "grab the
  // page" convention as touch: drag down to move the content down (i.e.
  // scroll to an earlier point), drag up to scroll further in.
  _startDragScroll(e) {
    if (e.pointerType !== 'mouse' || this.viewMode !== 'grid' || this.detailView.isActive) return
    this._dragScroll = { startClientY: e.clientY, startScrollY: window.scrollY }
    this._dragScrollMoved = false
    document.body.classList.add('is-drag-scrolling')
  }

  _updateDragScroll(e) {
    if (!this._dragScroll) return
    const deltaY = e.clientY - this._dragScroll.startClientY
    if (Math.abs(deltaY) > 4) this._dragScrollMoved = true
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, clamp(this._dragScroll.startScrollY - deltaY, 0, Math.max(maxScroll, 0)))
  }

  _endDragScroll() {
    if (!this._dragScroll) return
    this._dragScroll = null
    document.body.classList.remove('is-drag-scrolling')
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.start()
    this._loop()
  }

  stop() {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.tiles.forEach((t) => t.setVideoPlaying(false))
  }

  _loop() {
    if (!this.running) return
    this.rafId = requestAnimationFrame(() => this._loop())
    const dt = Math.min(this.clock.getDelta(), 1 / 15)
    const elapsed = this.clock.getElapsedTime()
    this._update(dt, elapsed)
    this.renderer.render(this.scene, this.camera)
  }

  // Projects each tile's bottom-left corner (see Tile.applyCell) through
  // the same camera/contentGroup transform the WebGL scene itself uses, so
  // the DOM title underneath tracks the tile exactly through scroll, the
  // idle tilt and the speed-scale — without needing a canvas-baked texture
  // per title. Opacity is tied to the tile's own reveal/dim state so a
  // title never floats in ahead of its thumb or stays crisp over a
  // detail-dimmed one.
  _updateTileLabels() {
    this.contentGroup.updateMatrixWorld()
    const vw = this.viewportWidth
    const vh = this.viewportHeight
    this.tiles.forEach((tile) => {
      if (!tile.labelEl) return
      const v = this._labelProjectVec.set(tile.labelAnchorX, tile.labelAnchorY, 0)
      v.applyMatrix4(this.contentGroup.matrixWorld)
      v.project(this.camera)
      const x = (v.x * 0.5 + 0.5) * vw
      const y = (1 - (v.y * 0.5 + 0.5)) * vh + TILE_LABEL_OFFSET_Y
      tile.labelEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      tile.labelEl.style.opacity = tile.uniforms.uRevealProgress.value * (1 - tile.dimCurrent)
    })
  }

  _update(dt, elapsed) {
    // --- scroll ---
    const rawScroll = window.scrollY || window.pageYOffset || 0
    this.scrollSmoothed = damp(this.scrollSmoothed, rawScroll, 9, dt)
    const velocity = (this.scrollSmoothed - this.scrollPrev) / Math.max(dt, 1 / 120)
    this.scrollPrev = this.scrollSmoothed

    const tiltTarget = clamp(velocity * -0.00022, -MAX_TILT, MAX_TILT)
    this.tiltCurrent = damp(this.tiltCurrent, tiltTarget, 6, dt)

    this.contentGroup.position.y = this.scrollSmoothed
    this.contentGroup.rotation.x = this.tiltCurrent

    // Full-text view has no WebGL content of its own — same scroll-velocity
    // tilt value, just applied as a CSS transform on the title list instead.
    if (this.viewMode === 'fulltext') {
      this.fulltextList.style.transform = `rotateX(${this.tiltCurrent}rad)`
    }
    // The journal strip sits in normal document flow below whichever of
    // the two modes is showing (grid or fulltext both scroll straight
    // into it now — see the toggleViewMode change dropping the old 3rd
    // mode), so it needs updating in either case, not just grid.
    this.journal.update(dt)

    const speedFactor = clamp(Math.abs(velocity) * 0.00006, 0, 0.035)
    const targetScale = 1 - speedFactor
    this.contentGroup.scale.setScalar(damp(this.contentGroup.scale.x, targetScale, 6, dt))

    // Titles track their tile's actual projected screen position (scroll,
    // tilt and the speed-scale above all bend it slightly), so this has to
    // run after every contentGroup transform for the frame is final —
    // grid-only, same as the journal strip just above.
    if (this.viewMode === 'grid') this._updateTileLabels()

    // --- detail (click-to-zoom) transition ---
    this.detailView.update(dt)
    const detailActive = this.detailView.isActive
    const activeTile = this.detailView.activeTile
    // Magnet math below reads tile.restX/restY/cell, which are being
    // rewritten every frame by the layout tween above — skip it while
    // that's in flight rather than chase a moving target. Also skip while
    // the full-text list covers the (hidden) tiles entirely.
    const fulltextActive = this.viewMode === 'fulltext'
    const magnetSuppressed = detailActive || fulltextActive

    // --- mouse -> world -> content-local ---
    if (this.mouseActive && !magnetSuppressed) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera)
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.mouseWorld)
      if (hit) {
        this.mouseLocal.copy(this.mouseWorld)
        this.contentGroup.worldToLocal(this.mouseLocal)
      }
    }

    // --- magnet field across tiles (disabled while a detail view is open) ---
    const influenceRadius = this.layout.cellWidth * MAGNET_RADIUS_FACTOR

    for (const tile of this.tiles) {
      let strength = 0
      let pullX = 0
      let pullY = 0
      this._tmpHoverUv.set(0, 0)

      if (this.mouseActive && !magnetSuppressed) {
        this._tmpDelta.set(this.mouseLocal.x - tile.restX, this.mouseLocal.y - tile.restY)
        const dist = this._tmpDelta.length()
        strength = smoothstep(influenceRadius, 0, dist)

        if (strength > 0.001) {
          this._tmpHoverUv.set(
            this._tmpDelta.x / tile.cell.width,
            this._tmpDelta.y / tile.cell.height
          )
          if (dist > 0.001) {
            pullX = (this._tmpDelta.x / dist) * strength * MAX_PULL_PX
            pullY = (this._tmpDelta.y / dist) * strength * MAX_PULL_PX
          }
        }
      }

      this._tmpPull.set(pullX, pullY)
      tile.setMagnet({
        strength,
        hoverUv: this._tmpHoverUv,
        pull: this._tmpPull,
        lift: strength * MAX_LIFT_PX,
        scale: 1 + strength * MAX_SCALE_BOOST,
      })
      tile.setDim(detailActive && tile !== activeTile ? 1 : 0)

      tile.update(dt, elapsed)

      // play/pause video based on whether the tile is near the viewport;
      // the tile open in detail view always plays, others pause while it's open
      if (tile.video) {
        let withinView
        if (detailActive) {
          withinView = tile === activeTile
        } else if (fulltextActive) {
          withinView = false
        } else {
          const worldY = tile.restY + this.scrollSmoothed
          withinView =
            worldY > -this.viewportHeight / 2 - VIDEO_PLAY_MARGIN &&
            worldY < this.viewportHeight / 2 + VIDEO_PLAY_MARGIN
        }
        tile.setVideoPlaying(withinView)
      }
    }
  }

  dispose() {
    this.stop()
    clearTimeout(this._resizeTimeout)
    clearTimeout(this._modeVisibilityTimer)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerdown', this._onPointerDown)
    window.removeEventListener('pointerup', this._onPointerUp)
    window.removeEventListener('pointercancel', this._onPointerUp)
    window.removeEventListener('click', this._onClick)
    document.removeEventListener('mouseleave', this._onPointerLeave)
    document.removeEventListener('visibilitychange', this._onVisibility)
    document.removeEventListener('keydown', this._onKeydown)
    this.overviewToggle.removeEventListener('click', this._onOverviewToggle)
    this.fulltextList.removeEventListener('click', this._onFulltextClick)
    this.fulltextList.removeEventListener('pointerover', this._onFulltextOver)
    this.fulltextList.removeEventListener('pointerleave', this._onFulltextLeave)
    this.fulltextList.removeEventListener('pointermove', this._onFulltextMove)
    this.detailView.dispose()
    this.journal.dispose()
    this.tiles.forEach((t) => t.dispose())
    this.tileLabels.remove()
    this.renderer.dispose()
  }
}
