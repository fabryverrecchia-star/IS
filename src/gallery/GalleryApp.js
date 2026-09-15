import * as THREE from 'three'
import { galleryItems } from '../data/galleryData.js'
import { computeGridLayout } from './layout.js'
import { Tile } from './Tile.js'
import { DetailView } from './DetailView.js'
import { clamp, smoothstep, damp } from './math.js'

const CAMERA_DISTANCE = 1000
const MAGNET_RADIUS_FACTOR = 0.7 // multiple of cell width, kept close to the hovered tile
const MAX_PULL_PX = 12
const MAX_LIFT_PX = 16
const MAX_SCALE_BOOST = 0.028
const MAX_TILT = 0.085 // radians, ~5deg
const VIDEO_PLAY_MARGIN = 260 // px beyond viewport edges to start/stop playback

export class GalleryApp {
  constructor(root, { onProgress, onReady } = {}) {
    this.root = root
    this.onProgress = onProgress || (() => {})
    this.onReady = onReady || (() => {})

    this.items = galleryItems
    this.tiles = []
    this.loadedCount = 0
    this.readyFired = false

    this.viewportWidth = window.innerWidth
    this.viewportHeight = window.innerHeight

    this.scrollSmoothed = 0
    this.scrollPrev = 0
    this.tiltCurrent = 0

    this.mouseNDC = new THREE.Vector2(9999, 9999)
    this.mouseWorld = new THREE.Vector3()
    this.mouseLocal = new THREE.Vector3()
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
    this.layout = computeGridLayout(this.items.length, this.viewportWidth, this.viewportHeight)
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
    this._onPointerMove = (e) => this._handlePointerMove(e)
    this._onPointerLeave = () => {
      this.mouseActive = false
    }
    this._onClick = () => this._handleClick()
    this._onVisibility = () => {
      if (document.hidden) this.stop()
      else this.start()
    }

    window.addEventListener('resize', this._onResize)
    window.addEventListener('pointermove', this._onPointerMove, { passive: true })
    window.addEventListener('pointerdown', this._onPointerMove, { passive: true })
    window.addEventListener('click', this._onClick)
    document.addEventListener('mouseleave', this._onPointerLeave)
    document.addEventListener('visibilitychange', this._onVisibility)
  }

  _handleClick() {
    const dv = this.detailView
    if (dv.state === 'idle') {
      const tile = dv.pick(this.mouseNDC)
      if (tile) dv.open(tile)
    } else if (dv.state === 'detail') {
      dv.close()
    }
  }

  _handleResize() {
    this.viewportWidth = window.innerWidth
    this.viewportHeight = window.innerHeight
    this._updateCameraFov()
    this.renderer.setSize(this.viewportWidth, this.viewportHeight)
    this._buildLayout(false)
  }

  _handlePointerMove(e) {
    this.mouseActive = true
    this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
    this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
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

    const speedFactor = clamp(Math.abs(velocity) * 0.00006, 0, 0.035)
    const targetScale = 1 - speedFactor
    this.contentGroup.scale.setScalar(damp(this.contentGroup.scale.x, targetScale, 6, dt))

    // --- detail (click-to-zoom) transition ---
    this.detailView.update(dt)
    const detailActive = this.detailView.isActive
    const activeTile = this.detailView.activeTile

    // --- mouse -> world -> content-local ---
    if (this.mouseActive && !detailActive) {
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

      if (this.mouseActive && !detailActive) {
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
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerdown', this._onPointerMove)
    window.removeEventListener('click', this._onClick)
    document.removeEventListener('mouseleave', this._onPointerLeave)
    document.removeEventListener('visibilitychange', this._onVisibility)
    this.detailView.dispose()
    this.tiles.forEach((t) => t.dispose())
    this.renderer.dispose()
  }
}
