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

    this.video = null

    if (item.type === 'image') {
      textureLoader.load(item.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
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
  }

  setMagnet({ strength, hoverUv, pull, lift, scale }) {
    this.hoverTarget = strength
    this.hoverPointTarget.set(hoverUv.x, hoverUv.y)
    this.pullTarget.set(pull.x, pull.y)
    this.liftTarget = lift
    this.scaleTarget = scale
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

    this.group.position.x = this.restX + this.pullOffset.x
    this.group.position.y = this.restY + this.pullOffset.y
    this.group.position.z = this.restZ + this.liftZ
    this.group.scale.setScalar(this.scaleCurrent)

    this.uniforms.uHoverStrength.value = this.hoverStrength

    if (this.ready && this.uniforms.uRevealProgress.value < 1) {
      if (this.revealStart === null) this.revealStart = elapsed + this.revealDelay
      const t = (elapsed - this.revealStart) / this.revealDuration
      if (t >= 0) {
        this.mesh.visible = true
        const clamped = Math.min(t, 1)
        this.uniforms.uRevealProgress.value = 1 - Math.pow(1 - clamped, 3)
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
