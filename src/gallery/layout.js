// Pure layout math: turns the gallery items + a viewport size into a
// responsive layout. Hard-capped at 4 columns per the design brief.

export function getColumnCount(viewportWidth) {
  if (viewportWidth >= 1100) return 4
  if (viewportWidth >= 820) return 3
  if (viewportWidth >= 560) return 2
  return 1
}

// The single gallery layout: a mix between a tidy aligned grid and a loose
// disordered mosaic. Columns stay clean, fixed-width lanes (the "ordered"
// half), but each item's height comes straight from its own source file's
// aspect ratio rather than a uniform cell ratio, and items are dropped into
// whichever column is currently shortest (classic masonry placement) — so
// row baselines drift and stagger on their own from the real mix of
// portrait/landscape photos (the "disordered" half), without any random
// jitter. Cell aspect always matches the image's own aspect ratio exactly,
// so the tile shader's cover-fit math (see shaders.js) never has anything
// to crop — proportions are preserved as-is.
export function computeGalleryLayout(items, viewportWidth, viewportHeight) {
  const columns = getColumnCount(viewportWidth)

  const sideMargin = viewportWidth >= 820 ? viewportWidth * 0.06 : 20
  const gutter = viewportWidth >= 820 ? 28 : 16

  const usableWidth = viewportWidth - sideMargin * 2 - gutter * (columns - 1)
  const cellWidth = usableWidth / columns

  const topMargin = Math.max(viewportHeight * 0.14, 90)
  const bottomMargin = Math.max(viewportHeight * 0.18, 120)

  const columnBottoms = new Array(columns).fill(topMargin)
  const positions = []

  items.forEach((item) => {
    let col = 0
    for (let c = 1; c < columns; c++) {
      if (columnBottoms[c] < columnBottoms[col]) col = c
    }

    const cellHeight = cellWidth / item.aspect
    const x = sideMargin + col * (cellWidth + gutter) + cellWidth / 2
    const y = columnBottoms[col] + cellHeight / 2

    positions.push({ x, y, width: cellWidth, height: cellHeight, col })
    columnBottoms[col] = y + cellHeight / 2 + gutter
  })

  const totalHeight = Math.max(...columnBottoms) - gutter + bottomMargin

  return {
    columns,
    cellWidth,
    gutter,
    sideMargin,
    topMargin,
    totalHeight,
    positions,
  }
}
