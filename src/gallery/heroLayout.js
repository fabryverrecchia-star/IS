// Shared by DetailView (the WebGL entrance/exit transform) and ProjectPage
// (the DOM hand-off) so both agree pixel-for-pixel on where the hero ends
// up — otherwise the DOM hand-off would visibly pop.
//
// Most covers (landscape or moderately portrait) read well as a full-bleed
// banner flush with the top of the page. Very vertical media (a phone-shot
// video, aspect ~9:16) would turn into an absurdly tall banner at full
// width, so below the threshold it's shown centered in the viewport with
// breathing room instead.
const CONTAINED_ASPECT_THRESHOLD = 0.62

export function computeHeroLayout({ aspect, viewportWidth, viewportHeight }) {
  if (aspect < CONTAINED_ASPECT_THRESHOLD) {
    const maxW = Math.min(viewportWidth * 0.5, 640)
    const maxH = viewportHeight * 0.82
    let width
    let height
    if (aspect >= maxW / maxH) {
      width = maxW
      height = maxW / aspect
    } else {
      height = maxH
      width = maxH * aspect
    }
    return { mode: 'contained', x: 0, y: 0, width, height }
  }

  const width = viewportWidth
  const height = width / aspect
  return { mode: 'banner', x: 0, y: viewportHeight / 2 - height / 2, width, height }
}
