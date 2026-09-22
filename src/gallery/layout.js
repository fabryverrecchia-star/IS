// Pure layout math: turns the gallery items + a viewport size into a
// responsive layout. Hard-capped at 4 columns per the design brief.

export function getColumnCount(viewportWidth) {
  if (viewportWidth >= 1100) return 4
  if (viewportWidth >= 820) return 3
  if (viewportWidth >= 560) return 2
  return 1
}

// Deterministic pseudo-random in [0, 1) — seeded by the item's own index (not
// Math.random()) so the "disorder" below is stable across re-layouts/resizes
// instead of reshuffling every time.
function seededRandom(seed) {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

// A landscape item (aspect > this) sized to a single column would render
// much shorter than its portrait neighbors — same width, far less height —
// and read as an afterthought. Letting it span two columns instead gives it
// back a comparable footprint, the same way a magazine spread breaks a wide
// shot across the fold rather than shrinking it into one column.
const LANDSCAPE_SPAN_THRESHOLD = 1.2

// The single gallery layout: an editorial magazine mix of a tidy aligned
// grid and a loose disordered mosaic. Columns stay clean, fixed-width lanes
// (the "ordered" half) and each item's height comes straight from its own
// source file's aspect ratio (columns fill whichever pair/single is
// currently shortest — classic masonry placement, with wide items spanning
// two lanes), but on top of that each cell is a little narrower than its
// slot and nudged off-center by a controlled, per-item amount, with
// generous, slightly varied breathing room between items — a loosely
// hand-placed, editorial feel rather than a machine-aligned one. Cell
// aspect always matches the image's own aspect ratio exactly, so the tile
// shader's cover-fit math (see shaders.js) never has anything to crop —
// proportions are preserved as-is.
export function computeGalleryLayout(items, viewportWidth, viewportHeight) {
  const columns = getColumnCount(viewportWidth)

  const sideMargin = viewportWidth >= 820 ? viewportWidth * 0.07 : 24
  const gutter = viewportWidth >= 820 ? 52 : 28
  const rowGap = viewportWidth >= 820 ? 68 : 36

  const usableWidth = viewportWidth - sideMargin * 2 - gutter * (columns - 1)
  const columnWidth = usableWidth / columns

  const topMargin = Math.max(viewportHeight * 0.16, 100)
  const bottomMargin = Math.max(viewportHeight * 0.2, 130)

  // Columns start a little staggered rather than all flush on one exact
  // line — otherwise the very first row is the one place the "controlled
  // disorder" never actually shows (every item after it inherits whatever
  // stagger its column has already picked up from height differences, but
  // the top row has none yet to inherit).
  const columnBottoms = Array.from({ length: columns }, (_, c) => topMargin + seededRandom(c * 91.345) * rowGap * 1.5)
  const positions = []

  items.forEach((item, index) => {
    const span = item.aspect > LANDSCAPE_SPAN_THRESHOLD && columns >= 2 ? 2 : 1

    // Find the span-wide slot that's currently shortest — for span 1 that's
    // just the shortest single column, for span 2 the pair of adjacent
    // columns whose taller side is smallest (so the item sits right below
    // whichever of the two already has more content, same as CSS masonry).
    let col = 0
    let colBottom = Infinity
    for (let c = 0; c <= columns - span; c++) {
      let bottom = columnBottoms[c]
      for (let s = 1; s < span; s++) bottom = Math.max(bottom, columnBottoms[c + s])
      if (bottom < colBottom) {
        col = c
        colBottom = bottom
      }
    }

    const slotWidth = columnWidth * span + gutter * (span - 1)

    // Controlled disorder: a little narrower than the full slot (never
    // wider, so it can never spill past it), nudged left/right within the
    // slack that frees up — both seeded by the item's own index. Spanned
    // (wide) items get only a token amount of shrink — the point of the
    // span is to give them real presence, not to immediately give it back.
    const jitterRange = span > 1 ? 0.06 : 0.18
    const widthJitter = 1 - jitterRange + seededRandom(index * 12.9898) * jitterRange
    const cellWidth = columns === 1 ? slotWidth : slotWidth * widthJitter
    const freeSpace = slotWidth - cellWidth
    const offsetX = (seededRandom(index * 78.233 + 1) - 0.5) * freeSpace
    const extraGap = seededRandom(index * 37.719 + 2) * rowGap * 0.6

    const cellHeight = cellWidth / item.aspect
    const colLeft = sideMargin + col * (columnWidth + gutter)
    const x = colLeft + slotWidth / 2 + offsetX
    const y = colBottom + cellHeight / 2

    positions.push({ x, y, width: cellWidth, height: cellHeight, col })
    for (let s = 0; s < span; s++) columnBottoms[col + s] = y + cellHeight / 2 + rowGap + extraGap
  })

  const totalHeight = Math.max(...columnBottoms) - rowGap + bottomMargin

  return {
    columns,
    cellWidth: columnWidth,
    gutter,
    sideMargin,
    topMargin,
    totalHeight,
    positions,
  }
}
