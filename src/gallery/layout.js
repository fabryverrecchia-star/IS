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

// A much denser alternate layout for the overview toggle: the header
// logo/subtitle and footer step out of the way while this is active (see
// GalleryApp.toggleOverview), so margins shrink accordingly and columns
// start well past the curated 4-column cap — a small contact-sheet of
// every project, not just "the same grid, but it fits".
export function computeOverviewLayout(itemCount, viewportWidth, viewportHeight) {
  const sideMargin = viewportWidth >= 820 ? viewportWidth * 0.015 : 10
  const gutter = viewportWidth >= 820 ? 6 : 4
  const topMargin = Math.max(viewportHeight * 0.05, 44)
  const bottomMargin = Math.max(viewportHeight * 0.025, 16)
  const availableWidth = viewportWidth - sideMargin * 2
  const availableHeight = viewportHeight - topMargin - bottomMargin

  const maxColumns = Math.min(itemCount, 14)
  let columns = Math.min(Math.max(getColumnCount(viewportWidth) * 3, 8), maxColumns) || 1
  let rows = Math.ceil(itemCount / columns)
  let cellWidth = (availableWidth - gutter * (columns - 1)) / columns
  let cellHeight = cellWidth * CELL_RATIO
  let gridHeight = rows * cellHeight + (rows - 1) * gutter

  while (gridHeight > availableHeight && columns < maxColumns) {
    columns += 1
    rows = Math.ceil(itemCount / columns)
    cellWidth = (availableWidth - gutter * (columns - 1)) / columns
    cellHeight = cellWidth * CELL_RATIO
    gridHeight = rows * cellHeight + (rows - 1) * gutter
  }

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
    totalHeight: topMargin + gridHeight + bottomMargin,
    positions,
  }
}
