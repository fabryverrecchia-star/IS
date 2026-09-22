// Shared by DetailView (the WebGL entrance/exit transform) and ProjectPage
// (the DOM hand-off) so both land the hero at the exact same rect —
// otherwise the DOM hand-off would visibly pop.
//
// Every cover lands the same way regardless of its own aspect ratio: a
// full-height, crop-fit panel covering the left 75% of the viewport — the
// same footprint as the Journal detail panel's media pane (see
// JournalView.js's .journal-detail-media), with a matching info panel
// filling the remaining 25% (see ProjectPage). The crop itself comes for
// free from the tile shader's existing cover-fit UV math (see shaders.js),
// the same one every grid tile already uses.
const HERO_WIDTH_RATIO = 0.75

export function computeHeroLayout({ viewportWidth, viewportHeight }) {
  const width = viewportWidth * HERO_WIDTH_RATIO
  return { x: -viewportWidth / 2 + width / 2, y: 0, width, height: viewportHeight }
}
