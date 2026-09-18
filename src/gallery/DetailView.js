import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shaders.js'
import { lerp, easeInOutCubic, clamp } from './math.js'
import { computeHeroLayout } from './heroLayout.js'

const LIFT_Z_OFFSET = 80 // world units, a brief "picked up toward camera" flourish — always 0 at rest
const OPEN_DURATION = 0.7
const CLOSE_DURATION = 0.55

// Drives the click-to-zoom WebGL transition only: a hero plane that tweens
// from a clicked tile's exact on-screen transform to a full-bleed, top-
// aligned banner (and back again), lifting slightly toward the camera
// mid-move (a brief, subtle zoom-forward flourish, like picking the photo
// up) before settling flat into place. It lives directly in the scene (not
// the scrolling content group) so it stays put regardless of scroll, and
// it's built once and reused for every open/close rather than allocated
// per click. The actual project content (scrolling body, captions, extra
// images) is owned by ProjectPage — this class just hands off to it via
// onOpenComplete once the entrance animation lands, and picks back up for
// the reverse animation when asked to close().
export class DetailView {
  constructor(app) {
    this.app = app
    this.state = 'idle' // idle | opening | project | closing
    this.activeTile = null
    this.progress = 0
    this.onOpenComplete = null
    this.onCloseComplete = null

    this.start = { x: 0, y: 0, z: 0, width: 1, height: 1 }
    this.end = { x: 0, y: 0, z: 0, width: 1, height: 1 }
    this.current = { x: 0, y: 0, z: 0, width: 1, height: 1 }

    this._tmpWorld = new THREE.Vector3()
    this._tmpLocal = new THREE.Vector3()

    this._buildMesh()
    this._bindKeys()
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
      depthTest: false,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.visible = false
    this.mesh.renderOrder = 10
    this.app.scene.add(this.mesh)
  }

  _bindKeys() {
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

    this.start.x = worldPos.x
    this.start.y = worldPos.y
    this.start.z = worldPos.z
    this.start.width = tile.cell.width
    this.start.height = tile.cell.height

    // End target — banner (full-bleed, top-aligned) or contained (centered,
    // with margins) depending on aspect; see heroLayout.js. z stays 0 so
    // world units equal CSS pixels exactly, which ProjectPage relies on to
    // hand off to a pixel-identical DOM element with no pop.
    const { viewportWidth, viewportHeight } = this.app
    const aspect = tile.item.aspect
    const layout = computeHeroLayout({ aspect, viewportWidth, viewportHeight })

    this.end.x = layout.x
    this.end.y = layout.y
    this.end.z = 0
    this.end.width = layout.width
    this.end.height = layout.height

    const u = this.material.uniforms
    u.uMap.value = tile.uniforms.uMap.value
    u.uImageAspect.value = aspect
    u.uHoverStrength.value = 0
    u.uDim.value = 0
    u.uRevealProgress.value = 1

    tile.mesh.visible = false
    this.mesh.visible = true
    this._applyTransform(this.start)

    this._lockScroll()
  }

  // Hides the hero mesh — called once the DOM project page actually has a
  // frame ready to paint (see GalleryApp._handleProjectOpen), so the swap
  // is a hard cut between two identical-looking pixels rather than a gap.
  hideMesh() {
    this.mesh.visible = false
  }

  // Re-shows the hero mesh at the transform ProjectPage left it at, so
  // control can hand back from DOM to WebGL with no visible pop.
  showAtCurrent() {
    this.mesh.visible = true
    this._applyTransform(this.current)
  }

  close() {
    if (this.state !== 'project' && this.state !== 'opening') return

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
    this._lockScroll()
  }

  // Blocks background scrolling only for the duration of the WebGL
  // open/close transitions, where the gallery's own scroll would move the
  // grid tiles the animation math is based on. Not used while the project
  // page is showing — that page has its own scroll.
  _lockScroll() {
    window.addEventListener('wheel', this._onWheelLock, { passive: false })
    window.addEventListener('touchmove', this._onTouchLock, { passive: false })
    window.addEventListener('keydown', this._onKeyLock, { passive: false })
  }

  _unlockScroll() {
    window.removeEventListener('wheel', this._onWheelLock)
    window.removeEventListener('touchmove', this._onTouchLock)
    window.removeEventListener('keydown', this._onKeyLock)
  }

  _applyTransform(t) {
    this.mesh.position.set(t.x, t.y, t.z)
    this.mesh.scale.set(t.width, t.height, 1)
    this.material.uniforms.uPlaneAspect.value = t.width / t.height
    this.current.x = t.x
    this.current.y = t.y
    this.current.z = t.z
    this.current.width = t.width
    this.current.height = t.height
  }

  update(dt) {
    if (this.state === 'idle' || this.state === 'project') return

    const duration = this.state === 'opening' ? OPEN_DURATION : CLOSE_DURATION
    this.progress = clamp(this.progress + dt / duration, 0, 1)
    const easedT = easeInOutCubic(this.progress)
    // Peaks at mid-move and is back to exactly 0 by progress 1, so the end
    // position (z: 0, the pixel-identical handoff to ProjectPage's DOM) is
    // never disturbed — only the journey there bulges slightly toward camera.
    const liftZ = Math.sin(this.progress * Math.PI) * LIFT_Z_OFFSET

    this._applyTransform({
      x: lerp(this.start.x, this.end.x, easedT),
      y: lerp(this.start.y, this.end.y, easedT),
      z: lerp(this.start.z, this.end.z, easedT) + liftZ,
      width: lerp(this.start.width, this.end.width, easedT),
      height: lerp(this.start.height, this.end.height, easedT),
    })

    if (this.progress >= 1) {
      if (this.state === 'opening') {
        this.state = 'project'
        // The mesh stays visible until the caller confirms the DOM hand-
        // off is ready to paint (see hideMesh()) — hiding it here would
        // leave a gap of bare background before that.
        // The project page has its own scroll — only the brief WebGL
        // open/close transitions need the background locked.
        this._unlockScroll()
        this.onOpenComplete && this.onOpenComplete(this.activeTile, { ...this.current })
      } else {
        this.mesh.visible = false
        this.activeTile.mesh.visible = true
        const closedTile = this.activeTile
        this.activeTile = null
        this.state = 'idle'
        this._unlockScroll()
        this.onCloseComplete && this.onCloseComplete(closedTile)
      }
    }
  }

  dispose() {
    this._unlockScroll()
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
