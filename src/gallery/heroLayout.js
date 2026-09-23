// Shared by DetailView (the WebGL entrance/exit transform) and ProjectPage
// (the DOM hand-off) so both land the hero at the exact same rect —
// otherwise the DOM hand-off would visibly pop.
//
// The hero is sized to its own native aspect ratio — never cropped: it
// fills the full viewport height when that fits within the width (the
// common case, most covers here are portrait), or fills the full width
// instead — letterboxed shorter than the viewport — when the ratio is too
// wide for that to fit, landscape video being the main case. It always
// docks to the left, top-aligned. The info panel then either takes
// whatever width is left over as a fixed sidebar, or — once that leftover
// is too narrow for real content, including the full-width case where
// there's none left at all — the caller (ProjectPage) drops it into normal
// document flow below the hero instead.
const MIN_INFO_WIDTH = 300 // px — below this, the sidebar stops making sense

export function computeHeroLayout({ viewportWidth, viewportHeight, aspect }) {
  let width = viewportHeight * aspect
  let height = viewportHeight
  if (width > viewportWidth) {
    width = viewportWidth
    height = width / aspect
  }

  const infoWidth = viewportWidth - width
  const stacked = infoWidth < MIN_INFO_WIDTH

  return {
    x: -viewportWidth / 2 + width / 2,
    y: viewportHeight / 2 - height / 2,
    width,
    height,
    stacked,
    infoWidth: stacked ? viewportWidth : infoWidth,
  }
}
