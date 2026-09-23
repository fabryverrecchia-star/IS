// Shared by DetailView (the WebGL entrance/exit transform) and ProjectPage
// (the DOM hand-off) so both land the hero at the exact same rect —
// otherwise the DOM hand-off would visibly pop.
//
// The hero is sized to its own native aspect ratio — never cropped: it
// fills the full viewport height when that fits within the width (the
// common case, most covers here are portrait), or fills the full width
// instead — letterboxed shorter than the viewport — when the ratio is too
// wide for that to fit, landscape video being the main case. It docks to
// the left, top-aligned, with the info panel taking whatever width is left
// over as a fixed sidebar — except a square or vertical video (aspect <=
// 1), which reads better centered with its own details below rather than
// squeezed to one side of a wide sidebar: those force the same centered/
// stacked treatment as the full-width case regardless of how much room a
// sidebar would actually have. Once stacked either way, the caller
// (ProjectPage) drops the info panel into normal document flow below.
const MIN_INFO_WIDTH = 300 // px — below this, the sidebar stops making sense

export function computeHeroLayout({ viewportWidth, viewportHeight, aspect, isVideo }) {
  let width = viewportHeight * aspect
  let height = viewportHeight
  if (width > viewportWidth) {
    width = viewportWidth
    height = width / aspect
  }

  const infoWidth = viewportWidth - width
  const stacked = infoWidth < MIN_INFO_WIDTH || (isVideo && aspect <= 1)

  return {
    x: stacked ? 0 : -viewportWidth / 2 + width / 2,
    y: viewportHeight / 2 - height / 2,
    width,
    height,
    stacked,
    infoWidth: stacked ? viewportWidth : infoWidth,
  }
}
