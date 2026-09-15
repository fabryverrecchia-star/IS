// Pure layout math: turns a viewport width + item count into a responsive
// grid definition. Hard-capped at 4 columns per the design brief.

export function getColumnCount(viewportWidth) {
  if (viewportWidth >= 1100) return 4
  if (viewportWidth >= 820) return 3
  if (viewportWidth >= 560) return 2
  return 1
}

// Cell height is derived from width via a fixed ratio so the grid stays a
// clean, even rhythm regardless of each item's native media aspect ratio
// (tiles crop with object-fit: cover in the shader).
const CELL_RATIO = 1.2 // height = width * CELL_RATIO

export function computeGridLayout(itemCount, viewportWidth, viewportHeight) {
  const columns = getColumnCount(viewportWidth)
  const rows = Math.ceil(itemCount / columns)

  const sideMargin = viewportWidth >= 820 ? viewportWidth * 0.06 : 20
  const gutter = viewportWidth >= 820 ? 28 : 16

  const usableWidth = viewportWidth - sideMargin * 2 - gutter * (columns - 1)
  const cellWidth = usableWidth / columns
  const cellHeight = cellWidth * CELL_RATIO

  const topMargin = Math.max(viewportHeight * 0.14, 90)
  const bottomMargin = Math.max(viewportHeight * 0.18, 120)

  const totalHeight =
    topMargin + rows * cellHeight + (rows - 1) * gutter + bottomMargin

  const positions = []
  for (let i = 0; i < itemCount; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = sideMargin + col * (cellWidth + gutter) + cellWidth / 2
    const y = topMargin + row * (cellHeight + gutter) + cellHeight / 2
    positions.push({ x, y, width: cellWidth, height: cellHeight, row, col })
  }

  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    gutter,
    sideMargin,
    topMargin,
    totalHeight,
    positions,
  }
}
