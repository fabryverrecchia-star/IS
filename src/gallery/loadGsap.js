// Lazy-loads the vendored GSAP Club bundle (classic UMD scripts, not npm —
// see public/vendor/gsap/) only when the 3D carousel view is first opened,
// so the ~140kb of plugins never touch the initial page load for anyone
// who never switches to that mode. Scripts are plain globals (window.gsap,
// window.ScrollTrigger, etc.), same as the reference demo's own <script>
// tags — loaded in dependency order since ScrollSmoother/SplitText each
// register themselves against the already-global gsap on load.
const SCRIPTS = [
  '/vendor/gsap/gsap.min.js',
  '/vendor/gsap/ScrollTrigger.min.js',
  '/vendor/gsap/ScrollSmoother.min.js',
  '/vendor/gsap/ScrollToPlugin.min.js',
  '/vendor/gsap/SplitText.min.js',
]

let loadPromise = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

export function loadGsap() {
  if (!loadPromise) {
    loadPromise = SCRIPTS.reduce(
      (chain, src) => chain.then(() => loadScript(src)),
      Promise.resolve()
    ).then(() => {
      window.gsap.registerPlugin(
        window.ScrollTrigger,
        window.ScrollSmoother,
        window.ScrollToPlugin,
        window.SplitText
      )
      return window.gsap
    })
  }
  return loadPromise
}
