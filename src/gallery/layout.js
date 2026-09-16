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

// An intentionally *un*-aligned alternate layout for the overview toggle:
// tiles fall into a handful of loose vertical lanes (left/center/right/…),
// each running independently at its own pace with randomized size and
// gaps — a scattered, editorial collage rather than a tidy grid, and
// (unlike the old dense-grid version) explicitly meant to run long and
// scroll, not fit on one screen.
export function computeOverviewLayout(itemCount, viewportWidth, viewportHeight) {
  const laneCount = viewportWidth >= 1100 ? 4 : viewportWidth >= 700 ? 3 : 2
  const laneWidth = viewportWidth / laneCount
  const minCellWidth = Math.max(laneWidth * 0.42, 90)
  const maxCellWidth = Math.max(laneWidth * 0.72, 150)
  const topMargin = Math.max(viewportHeight * 0.08, 64)
  const bottomMargin = Math.max(viewportHeight * 0.12, 100)
  const edgeMargin = 16

  const laneCursorY = new Array(laneCount).fill(topMargin)
  const positions = []

  for (let i = 0; i < itemCount; i++) {
    const lane = i % laneCount
    const cellWidth = minCellWidth + Math.random() * (maxCellWidth - minCellWidth)
    const cellHeight = cellWidth * (0.85 + Math.random() * 0.75)

    const laneCenterX = laneWidth * lane + laneWidth / 2
    const jitterRange = Math.max(laneWidth / 2 - cellWidth / 2 - edgeMargin, 0)
    const x = laneCenterX + (Math.random() - 0.5) * 2 * jitterRange

    const gapBefore = 20 + Math.random() * 130
    const y = laneCursorY[lane] + gapBefore + cellHeight / 2
    laneCursorY[lane] = y + cellHeight / 2

    positions.push({ x, y, width: cellWidth, height: cellHeight })
  }

  const totalHeight = Math.max(...laneCursorY) + bottomMargin
  const avgCellWidth = (minCellWidth + maxCellWidth) / 2

  return {
    columns: laneCount,
    rows: Math.ceil(itemCount / laneCount),
    cellWidth: avgCellWidth,
    cellHeight: avgCellWidth * CELL_RATIO,
    gutter: 0,
    sideMargin: edgeMargin,
    topMargin,
    totalHeight,
    positions,
  }
}
