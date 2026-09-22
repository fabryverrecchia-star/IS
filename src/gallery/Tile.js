import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shaders.js'
import { damp } from './math.js'

export class Tile {
  constructor({
    item,
    cell,
    index,
    viewportWidth,
    viewportHeight,
    textureLoader,
    videoContainer,
    onAssetReady,
  }) {
    this.item = item
    this.index = index
    this.ready = false

    this.hoverStrength = 0
    this.hoverTarget = 0
    this.hoverPoint = new THREE.Vector2()
    this.hoverPointTarget = new THREE.Vector2()
    this.pullOffset = new THREE.Vector2()
    this.pullTarget = new THREE.Vector2()
    this.liftZ = 0
    this.liftTarget = 0
    this.scaleCurrent = 1
    this.scaleTarget = 1
    this.dimCurrent = 0
    this.dimTarget = 0

    this.restX = 0
    this.restY = 0
    this.restZ = index % 2 === 0 ? -8 : 8

    this.group = new THREE.Group()

    this.geometry = null
    this.uniforms = {
      uMap: { value: null },
      uPlaneAspect: { value: 1 },
      uImageAspect: { value: item.aspect },
      uHoverPoint: { value: this.hoverPoint },
      uHoverStrength: { value: 0 },
      uPlaneSize: { value: new THREE.Vector2(1, 1) },
      uRevealProgress: { value: 0 },
      uDim: { value: 0 },
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
    })

    this.mesh = new THREE.Mesh(undefined, this.material)
    this.mesh.visible = false
    this.group.add(this.mesh)

    this.applyCell(cell, viewportWidth, viewportHeight)

    this.revealDelay = 0.25 + index * 0.045
    this.revealStart = null
    this.revealDuration = 0.85
    this._initialRevealDone = false

    // Reusable reveal-progress tween for the grid<->full-text mode switch
    // (see GalleryApp._enterFulltext/_exitFulltextToGrid): 0 wipes the tile
    // away top-down, 1 reveals it bottom-up again — the exact same visual
    // as the one-shot load-in above, just re-triggerable on demand.
    this._modeRevealTarget = null
    this._modeRevealFrom = 1
    this._modeRevealStart = null
    this._modeRevealDelay = 0
    this._modeRevealDuration = 0.6

    this.video = null

    if (item.type === 'image') {
      textureLoader.load(item.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        // Plain bilinear sampling, no mipmap chain — mipmapping was tried
        // here to avoid aliasing on minified tiles, but the extra blur pass
        // it does at every mip level softens fine detail and reads as a
        // washed-out filter next to the crisp, unfiltered source (visible
        // once the same photo opens full-size). Renders should always match
        // the original file's own colors/contrast/sharpness exactly.
        tex.minFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        this.uniforms.uMap.value = tex
        this.ready = true
        onAssetReady && onAssetReady(this)
      })
    } else {
      const video = document.createElement('video')
      video.muted = true
      video.defaultMuted = true
      video.loop = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.preload = 'auto'
      this.video = video
      ;(videoContainer || document.body).appendChild(video)

      // WebM/VP9 first (royalty-free, smaller, what stock Chromium builds
      // decode) with an H.264 MP4 fallback for browsers without VP9 support.
      const webmSource = document.createElement('source')
      webmSource.src = item.src.replace(/\.mp4$/, '.webm')
      webmSource.type = 'video/webm; codecs="vp9"'
      const mp4Source = document.createElement('source')
      mp4Source.src = item.src
      mp4Source.type = 'video/mp4; codecs="avc1.42E01E"'
      video.appendChild(webmSource)
      video.appendChild(mp4Source)

      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      this.uniforms.uMap.value = tex

      const markReady = () => {
        if (this.ready) return
        this.ready = true
        onAssetReady && onAssetReady(this)
      }
      video.addEventListener('loadeddata', markReady, { once: true })
      video.addEventListener('error', markReady, { once: true })
      video.load()
    }
  }

  applyCell(cell, viewportWidth, viewportHeight) {
    this.cell = cell
    this.restX = cell.x - viewportWidth / 2
    this.restY = viewportHeight / 2 - cell.y

    if (this.geometry) this.geometry.dispose()
    const segX = Math.max(14, Math.round(cell.width / 22))
    const segY = Math.max(14, Math.round(cell.height / 22))
    this.geometry = new THREE.PlaneGeometry(cell.width, cell.height, segX, segY)
    this.mesh.geometry = this.geometry

    this.uniforms.uPlaneAspect.value = cell.width / cell.height
    this.uniforms.uPlaneSize.value.set(cell.width, cell.height)

    this.group.position.set(this.restX, this.restY, this.restZ)

    // Bottom-left corner of the tile, in the same world units as
    // restX/restY — the anchor GalleryApp projects to screen space each
    // frame to position this tile's DOM title underneath it (see
    // GalleryApp._updateTileLabels). Kept in local (pre-transform) space
    // since the projection already applies contentGroup's own scroll/tilt.
    this.labelAnchorX = this.restX - cell.width / 2
    this.labelAnchorY = this.restY - cell.height / 2
  }

  setMagnet({ strength, hoverUv, pull, lift, scale }) {
    this.hoverTarget = strength
    this.hoverPointTarget.set(hoverUv.x, hoverUv.y)
    this.pullTarget.set(pull.x, pull.y)
    this.liftTarget = lift
    this.scaleTarget = scale
  }

  setDim(target) {
    this.dimTarget = target
  }

  setModeReveal(target, delay = 0) {
    this._modeRevealFrom = this.uniforms.uRevealProgress.value
    this._modeRevealTarget = target
    this._modeRevealDelay = delay
    this._modeRevealStart = null
  }

  setVideoPlaying(playing) {
    if (!this.video) return
    if (playing) {
      if (this.video.paused && this.ready) {
        this.video.play().catch(() => {})
      }
    } else if (!this.video.paused) {
      this.video.pause()
    }
  }

  update(dt, elapsed) {
    this.hoverStrength = damp(this.hoverStrength, this.hoverTarget, 10, dt)
    this.hoverPoint.x = damp(this.hoverPoint.x, this.hoverPointTarget.x, 10, dt)
    this.hoverPoint.y = damp(this.hoverPoint.y, this.hoverPointTarget.y, 10, dt)
    this.pullOffset.x = damp(this.pullOffset.x, this.pullTarget.x, 8, dt)
    this.pullOffset.y = damp(this.pullOffset.y, this.pullTarget.y, 8, dt)
    this.liftZ = damp(this.liftZ, this.liftTarget, 8, dt)
    this.scaleCurrent = damp(this.scaleCurrent, this.scaleTarget, 8, dt)
    this.dimCurrent = damp(this.dimCurrent, this.dimTarget, 9, dt)

    this.group.position.x = this.restX + this.pullOffset.x
    this.group.position.y = this.restY + this.pullOffset.y
    this.group.position.z = this.restZ + this.liftZ
    this.group.scale.setScalar(this.scaleCurrent)

    this.uniforms.uHoverStrength.value = this.hoverStrength
    this.uniforms.uDim.value = this.dimCurrent

    if (this.ready && !this._initialRevealDone) {
      if (this.revealStart === null) this.revealStart = elapsed + this.revealDelay
      const t = (elapsed - this.revealStart) / this.revealDuration
      if (t >= 0) {
        this.mesh.visible = true
        const clamped = Math.min(t, 1)
        this.uniforms.uRevealProgress.value = 1 - Math.pow(1 - clamped, 3)
        if (clamped >= 1) this._initialRevealDone = true
      }
    }

    if (this._modeRevealTarget !== null) {
      if (this._modeRevealStart === null) this._modeRevealStart = elapsed + this._modeRevealDelay
      const t = (elapsed - this._modeRevealStart) / this._modeRevealDuration
      if (t >= 0) {
        const clamped = Math.min(t, 1)
        // Ease out (decelerate) revealing back in, ease in (accelerate)
        // wiping away — reads as "settling in" vs. "dismissed with intent".
        const eased =
          this._modeRevealTarget > this._modeRevealFrom
            ? 1 - Math.pow(1 - clamped, 3)
            : clamped * clamped * clamped
        this.uniforms.uRevealProgress.value =
          this._modeRevealFrom + (this._modeRevealTarget - this._modeRevealFrom) * eased
        if (clamped >= 1) {
          this.uniforms.uRevealProgress.value = this._modeRevealTarget
          this._modeRevealTarget = null
        }
      }
    }
  }

  dispose() {
    this.geometry && this.geometry.dispose()
    this.material.dispose()
    if (this.uniforms.uMap.value) this.uniforms.uMap.value.dispose()
    if (this.video) {
      this.video.pause()
      this.video.removeAttribute('src')
      this.video.load()
      this.video.remove()
    }
  }
}
