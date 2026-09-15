import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shaders.js'
import { lerp, easeOutExpo, easeInOutCubic, clamp } from './math.js'

const HERO_Z = 60
const MAX_TURN_ANGLE = 0.45 // radians (~26deg), a flourish during the move only — always 0 at rest
const OPEN_DURATION = 0.7
const CLOSE_DURATION = 0.55

// Manages the single "hero" mesh used for the click-to-zoom detail
// transition: a plane that tweens from a clicked tile's exact on-screen
// transform to a centered, uncropped view, and back again. It lives
// directly in the scene (not the scrolling content group) so it stays
// put regardless of scroll, and it's built once and reused for every
// open/close rather than allocated per click.
export class DetailView {
  constructor(app) {
    this.app = app
    this.state = 'idle' // idle | opening | detail | closing
    this.activeTile = null
    this.progress = 0
    this.rotSign = 1

    this.start = { x: 0, y: 0, z: 0, width: 1, height: 1 }
    this.end = { x: 0, y: 0, z: 0, width: 1, height: 1 }
    this.current = { x: 0, y: 0, z: 0, width: 1, height: 1 }

    this._tmpWorld = new THREE.Vector3()
    this._tmpLocal = new THREE.Vector3()

    this._buildMesh()
    this._bindDom()
  }

  get isActive() {
    return this.state !== 'idle'
  }

  _buildMesh() {
    const geometry = new THREE.PlaneGeometry(1, 1, 24, 24)
    const uniforms = {
      uMap: { value: null },
      uPlaneAspect: { value: 1 },
      uImageAspect: { value: 1 },
      uHoverPoint: { value: new THREE.Vector2() },
      uHoverStrength: { value: 0 },
      uPlaneSize: { value: new THREE.Vector2(1, 1) },
      uRevealProgress: { value: 1 },
      uDim: { value: 0 },
    }
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    })
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.visible = false
    this.mesh.renderOrder = 10
    this.app.scene.add(this.mesh)
  }

  _bindDom() {
    this.overlay = document.getElementById('detail-overlay')
    this.closeButton = document.getElementById('detail-close')
    this.captionIndex = document.getElementById('detail-caption-index')
    this.captionTitle = document.getElementById('detail-caption-title')

    this.closeButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.close()
    })

    this._onKeydown = (e) => {
      if (e.key === 'Escape') this.close()
    }
    this._onWheelLock = (e) => e.preventDefault()
    this._onTouchLock = (e) => e.preventDefault()
    const lockedKeys = new Set([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
    this._onKeyLock = (e) => {
      if (lockedKeys.has(e.key)) e.preventDefault()
    }
  }

  // Hit-tests the tile grid at the given NDC point (same technique as the
  // hover magnet field: intersect a world-space ground plane, then test
  // each tile's rectangle in the content group's local space).
  pick(ndc) {
    const { raycaster, camera, groundPlane, contentGroup, tiles } = this.app
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.ray.intersectPlane(groundPlane, this._tmpWorld)
    if (!hit) return null

    this._tmpLocal.copy(this._tmpWorld)
    contentGroup.worldToLocal(this._tmpLocal)

    for (const tile of tiles) {
      if (!tile.ready) continue
      const dx = this._tmpLocal.x - tile.restX
      const dy = this._tmpLocal.y - tile.restY
      if (Math.abs(dx) <= tile.cell.width / 2 && Math.abs(dy) <= tile.cell.height / 2) {
        return tile
      }
    }
    return null
  }

  open(tile) {
    if (this.state !== 'idle') return

    this.activeTile = tile
    this.state = 'opening'
    this.progress = 0

    const worldPos = tile.group.getWorldPosition(new THREE.Vector3())
    this.rotSign = worldPos.x < 0 ? 1 : -1

    this.start.x = worldPos.x
    this.start.y = worldPos.y
    this.start.z = worldPos.z
    this.start.width = tile.cell.width
    this.start.height = tile.cell.height

    const { viewportWidth, viewportHeight } = this.app
    const maxW = Math.min(viewportWidth * 0.82, 1100)
    const maxH = viewportHeight * 0.78
    const aspect = tile.item.aspect
    let heroW
    let heroH
    if (aspect >= maxW / maxH) {
      heroW = maxW
      heroH = maxW / aspect
    } else {
      heroH = maxH
      heroW = maxH * aspect
    }

    this.end.x = 0
    this.end.y = 0
    this.end.z = HERO_Z
    this.end.width = heroW
    this.end.height = heroH

    const u = this.material.uniforms
    u.uMap.value = tile.uniforms.uMap.value
    u.uImageAspect.value = aspect
    u.uHoverStrength.value = 0
    u.uDim.value = 0
    u.uRevealProgress.value = 1

    tile.mesh.visible = false
    this.mesh.visible = true
    this._applyTransform(this.start, 0)

    this._setChromeVisible(true)
    this._lockScroll()
  }

  close() {
    if (this.state !== 'detail' && this.state !== 'opening') return

    this.start = { ...this.current }
    const tile = this.activeTile
    this.end = {
      x: tile.restX,
      y: tile.restY,
      z: tile.restZ,
      width: tile.cell.width,
      height: tile.cell.height,
    }

    this.state = 'closing'
    this.progress = 0
    this._setChromeVisible(false)
  }

  _setChromeVisible(visible) {
    this.overlay.classList.toggle('is-visible', visible)
    if (visible) {
      const items = this.app.items
      const index = items.indexOf(this.activeTile.item) + 1
      this.captionIndex.textContent = `${String(index).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`
      this.captionTitle.textContent = this.activeTile.item.title
    }
  }

  _lockScroll() {
    window.addEventListener('wheel', this._onWheelLock, { passive: false })
    window.addEventListener('touchmove', this._onTouchLock, { passive: false })
    window.addEventListener('keydown', this._onKeyLock, { passive: false })
    document.addEventListener('keydown', this._onKeydown)
  }

  _unlockScroll() {
    window.removeEventListener('wheel', this._onWheelLock)
    window.removeEventListener('touchmove', this._onTouchLock)
    window.removeEventListener('keydown', this._onKeyLock)
    document.removeEventListener('keydown', this._onKeydown)
  }

  _applyTransform(t, rotY) {
    this.mesh.position.set(t.x, t.y, t.z)
    this.mesh.rotation.y = rotY
    this.mesh.scale.set(t.width, t.height, 1)
    this.material.uniforms.uPlaneAspect.value = t.width / t.height
    this.current.x = t.x
    this.current.y = t.y
    this.current.z = t.z
    this.current.width = t.width
    this.current.height = t.height
  }

  update(dt) {
    if (this.state === 'idle' || this.state === 'detail') return

    const duration = this.state === 'opening' ? OPEN_DURATION : CLOSE_DURATION
    this.progress = clamp(this.progress + dt / duration, 0, 1)
    const easedT =
      this.state === 'opening' ? easeOutExpo(this.progress) : easeInOutCubic(this.progress)
    const rotY = Math.sin(this.progress * Math.PI) * this.rotSign * MAX_TURN_ANGLE

    this._applyTransform(
      {
        x: lerp(this.start.x, this.end.x, easedT),
        y: lerp(this.start.y, this.end.y, easedT),
        z: lerp(this.start.z, this.end.z, easedT),
        width: lerp(this.start.width, this.end.width, easedT),
        height: lerp(this.start.height, this.end.height, easedT),
      },
      rotY
    )

    if (this.progress >= 1) {
      if (this.state === 'opening') {
        this.state = 'detail'
      } else {
        this.mesh.visible = false
        this.activeTile.mesh.visible = true
        this.activeTile = null
        this.state = 'idle'
        this._unlockScroll()
      }
    }
  }

  dispose() {
    this._unlockScroll()
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
