import * as THREE from 'three'
import { damp, clamp } from './math.js'

// A single small WebGL layer (one renderer/scene, two meshes) sitting
// behind the two real <button> elements in the project info panel's
// action row — the buttons themselves stay plain DOM (text, click target,
// a11y), this only paints the animated fill/border/shine underneath, kept
// perfectly in sync with each button's live layout rect. Self-contained
// and runs its own rAF loop, started/stopped by ProjectPage.show()/close()
// rather than piggybacking on the gallery's own loop, which is paused for
// the whole time this page is open anyway.

// Deliberately no per-vertex magnet pull here (unlike the grid tiles, see
// shaders.js): the fragment shader below draws the rounded-rect shape as
// an SDF mask evaluated in flat UV space, so warping vertex positions
// independently of that mask doesn't bend the image — it bends the
// straight-edged shape itself into a warped blob, since the mask has no
// idea the triangles under it moved. The button's motion reads entirely
// through the fragment effects (fill sweep, shine) instead.
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec2 uHoverPoint;
  uniform float uHoverStrength;
  uniform float uFillAmount; // 0..1 ink-fill sweep from the cursor (outline buttons)
  uniform float uOutline;    // 0 = solid button, 1 = outline button
  uniform vec2 uPlaneSize;
  uniform vec3 uColor;

  varying vec2 vUv;

  float roundedBoxSDF(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uPlaneSize;
    vec2 halfSize = uPlaneSize * 0.5;
    float radius = min(halfSize.x, halfSize.y) * 0.12;
    float d = roundedBoxSDF(p, halfSize, radius);

    float shape = smoothstep(1.0, -1.0, d);
    float strokeWidth = 2.5;
    float borderShape = shape - smoothstep(1.0, -1.0, d + strokeWidth);

    // Ink-fill sweep, growing outward from wherever the cursor entered —
    // the outline button's border fills solid instead of a flat cross-fade.
    // Sized off the full diagonal (the farthest any point can be from the
    // cursor, e.g. the opposite corner) so a wide, short button actually
    // reaches full coverage instead of stalling part-way across.
    vec2 cursorPx = uHoverPoint * uPlaneSize;
    float distFromCursor = length(p - cursorPx);
    float diag = length(uPlaneSize);
    float fillRadius = uFillAmount * diag * 1.05;
    float fill = smoothstep(fillRadius, fillRadius - diag * 0.35, distFromCursor);

    float outlineAlpha = mix(borderShape, shape, fill);
    float alpha = mix(outlineAlpha, shape, 1.0 - uOutline);

    // Soft specular shine tracking the cursor on the solid button only.
    float shine = smoothstep(diag * 0.45, 0.0, distFromCursor) * uHoverStrength * (1.0 - uOutline) * 0.4;
    vec3 rgb = uColor + shine;

    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
  }
`

function makeButtonMesh(color, outline) {
  const geometry = new THREE.PlaneGeometry(1, 1, 12, 12)
  const uniforms = {
    uHoverPoint: { value: new THREE.Vector2(0, -1) },
    uHoverStrength: { value: 0 },
    uFillAmount: { value: 0 },
    uOutline: { value: outline ? 1 : 0 },
    uPlaneSize: { value: new THREE.Vector2(1, 1) },
    uColor: { value: new THREE.Color(color) },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    // The camera below deliberately runs top: 0 / bottom: height (so mesh
    // position can be plain screen-space pixels) — that inverts the
    // projected winding of every triangle versus the standard top > bottom
    // orthographic convention, which flips default front-face culling and
    // discards them all silently (draw calls succeed, nothing paints).
    // DoubleSide sidesteps it; there's no cost worth avoiding on a couple
    // of small flat UI planes.
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  return { mesh, uniforms }
}

export class ProjectButtons {
  constructor(container) {
    this.container = container
    if (!container) return

    this.els = Array.from(container.querySelectorAll('.project-btn'))
    if (this.els.length === 0) return

    this.canvas = container.querySelector('.project-btn-canvas')
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.scene = new THREE.Scene()
    // near/far are positive distances along the camera's -Z view direction
    // (standard convention, unlike left/right/top/bottom) — the meshes sit
    // at z: 0 with the camera at z: 1, one unit of camera-space depth away,
    // so near must be < 1 < far or every triangle gets near/far-clipped
    // and nothing renders at all despite draw calls reporting success.
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10)
    this.camera.position.z = 1

    this.buttons = this.els.map((el) => {
      const outline = el.classList.contains('project-btn--outline')
      const { mesh, uniforms } = makeButtonMesh('#14140f', outline)
      this.scene.add(mesh)

      const state = {
        el,
        mesh,
        uniforms,
        hoverStrength: 0,
        hoverTarget: 0,
        fillAmount: 0,
        fillTarget: 0,
        hoverPoint: new THREE.Vector2(0, -1),
        hoverPointTarget: new THREE.Vector2(0, -1),
      }

      el.addEventListener('pointerenter', (e) => {
        state.hoverTarget = 1
        state.fillTarget = 1
        this._setHoverPoint(state, e)
        el.classList.add('is-hovering')
      })
      el.addEventListener('pointermove', (e) => this._setHoverPoint(state, e))
      el.addEventListener('pointerleave', () => {
        state.hoverTarget = 0
        state.fillTarget = 0
        el.classList.remove('is-hovering')
      })

      return state
    })

    this.clock = new THREE.Clock()
    this.running = false
    this._loop = this._loop.bind(this)
  }

  // Local plane space here tracks screen pixels directly (see
  // handleResize's camera: top: 0, bottom: height, matching mesh.position
  // set from screen-space rects with no extra flip) — so unlike a texture
  // UV, +y here is down, same as clientY.
  _setHoverPoint(state, e) {
    const rect = state.el.getBoundingClientRect()
    state.hoverPointTarget.set(
      (e.clientX - rect.left) / rect.width - 0.5,
      (e.clientY - rect.top) / rect.height - 0.5,
    )
  }

  // Sizes the canvas and repositions each mesh to its button's live rect —
  // called on open() and on every resize (see ProjectPage._applyHeroLayout).
  handleResize() {
    if (!this.canvas) return
    const rect = this.container.getBoundingClientRect()
    const width = Math.max(rect.width, 1)
    const height = Math.max(rect.height, 1)
    this.renderer.setSize(width, height)
    this.camera.right = width
    this.camera.bottom = height
    this.camera.top = 0
    this.camera.left = 0
    this.camera.updateProjectionMatrix()

    this.buttons.forEach(({ el, mesh, uniforms }) => {
      const btnRect = el.getBoundingClientRect()
      const w = btnRect.width
      const h = btnRect.height
      const x = btnRect.left - rect.left + w / 2
      const y = btnRect.top - rect.top + h / 2
      mesh.scale.set(w, h, 1)
      mesh.position.set(x, y, 0)
      uniforms.uPlaneSize.value.set(w, h)
    })
  }

  enable() {
    if (!this.canvas || this.running) return
    this.running = true
    this.handleResize()
    this.clock.start()
    this._loop()
  }

  disable() {
    this.running = false
    if (this._rafId) cancelAnimationFrame(this._rafId)
  }

  _loop() {
    if (!this.running) return
    this._rafId = requestAnimationFrame(this._loop)
    const dt = Math.min(this.clock.getDelta(), 1 / 15)

    this.buttons.forEach((state) => {
      state.hoverStrength = damp(state.hoverStrength, state.hoverTarget, 10, dt)
      state.fillAmount = damp(state.fillAmount, state.fillTarget, 6, dt)
      state.hoverPoint.x = damp(state.hoverPoint.x, state.hoverPointTarget.x, 14, dt)
      state.hoverPoint.y = damp(state.hoverPoint.y, state.hoverPointTarget.y, 14, dt)
      state.uniforms.uHoverStrength.value = clamp(state.hoverStrength, 0, 1)
      state.uniforms.uFillAmount.value = clamp(state.fillAmount, 0, 1)
      state.uniforms.uHoverPoint.value.copy(state.hoverPoint)
    })

    this.renderer.render(this.scene, this.camera)
  }
}
