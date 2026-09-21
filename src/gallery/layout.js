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

// The single gallery layout: an editorial magazine mix of a tidy aligned
// grid and a loose disordered mosaic. Columns stay clean, fixed-width lanes
// (the "ordered" half) and each item's height comes straight from its own
// source file's aspect ratio (columns fill whichever is currently shortest —
// classic masonry placement), but on top of that each cell is a little
// narrower than its column and nudged off-center by a controlled, per-item
// amount, with generous, slightly varied breathing room between items — a
// loosely hand-placed, editorial feel rather than a machine-aligned one.
// Cell aspect always matches the image's own aspect ratio exactly, so the
// tile shader's cover-fit math (see shaders.js) never has anything to crop —
// proportions are preserved as-is.
export function computeGalleryLayout(items, viewportWidth, viewportHeight) {
  const columns = getColumnCount(viewportWidth)

  const sideMargin = viewportWidth >= 820 ? viewportWidth * 0.07 : 24
  const gutter = viewportWidth >= 820 ? 40 : 22
  const rowGap = viewportWidth >= 820 ? 52 : 28

  const usableWidth = viewportWidth - sideMargin * 2 - gutter * (columns - 1)
  const columnWidth = usableWidth / columns

  const topMargin = Math.max(viewportHeight * 0.16, 100)
  const bottomMargin = Math.max(viewportHeight * 0.2, 130)

  const columnBottoms = new Array(columns).fill(topMargin)
  const positions = []

  items.forEach((item, index) => {
    let col = 0
    for (let c = 1; c < columns; c++) {
      if (columnBottoms[c] < columnBottoms[col]) col = c
    }

    // Controlled disorder: a little narrower than the full column (never
    // wider, so it can never spill into the next lane), nudged left/right
    // within the slack that frees up — both seeded by the item's own index.
    const widthJitter = 0.82 + seededRandom(index * 12.9898) * 0.18 // 0.82..1.0
    const cellWidth = columns === 1 ? columnWidth : columnWidth * widthJitter
    const freeSpace = columnWidth - cellWidth
    const offsetX = (seededRandom(index * 78.233 + 1) - 0.5) * freeSpace
    const extraGap = seededRandom(index * 37.719 + 2) * rowGap * 0.6

    const cellHeight = cellWidth / item.aspect
    const colLeft = sideMargin + col * (columnWidth + gutter)
    const x = colLeft + columnWidth / 2 + offsetX
    const y = columnBottoms[col] + cellHeight / 2

    positions.push({ x, y, width: cellWidth, height: cellHeight, col })
    columnBottoms[col] = y + cellHeight / 2 + rowGap + extraGap
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
