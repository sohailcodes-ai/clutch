'use client'

import type { RatingHistoryEntry } from '@/lib/api'

const WIDTH = 600
const HEIGHT = 120
const PADDING = { top: 10, right: 10, bottom: 20, left: 40 }
const INNER_W = WIDTH - PADDING.left - PADDING.right
const INNER_H = HEIGHT - PADDING.top - PADDING.bottom

function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const m = (r1 - r0) / (d1 - d0 || 1)
  return (v: number) => r0 + (v - d0) * m
}

export function RatingHistoryChart({
  entries,
  className,
}: {
  entries: RatingHistoryEntry[]
  className?: string
}) {
  if (entries.length === 0) return null

  // Chronological order (oldest first)
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const ratings = sorted.map((e) => e.ratingAfter)
  const minR = Math.min(...ratings)
  const maxR = Math.max(...ratings)
  const pad = Math.max((maxR - minR) * 0.15, 10)

  const xScale = linearScale([0, sorted.length - 1], [0, INNER_W])
  const yScale = linearScale([minR - pad, maxR + pad], [INNER_H, 0])

  const points = sorted.map(
    (e, i) => `${PADDING.left + xScale(i)},${PADDING.top + yScale(e.ratingAfter)}`,
  )

  // Area fill (closed polygon)
  const areaPoints = [
    `${PADDING.left},${PADDING.top + INNER_H}`,
    ...points,
    `${PADDING.left + xScale(sorted.length - 1)},${PADDING.top + INNER_H}`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`w-full ${className ?? ''}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Rating history chart"
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PADDING.left}
          y1={PADDING.top + INNER_H * f}
          x2={PADDING.left + INNER_W}
          y2={PADDING.top + INNER_H * f}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={0.5}
        />
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill="currentColor" fillOpacity={0.06} />

      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Y-axis labels */}
      <text
        x={PADDING.left - 4}
        y={PADDING.top + yScale(maxR + pad)}
        textAnchor="end"
        fontSize={8}
        fill="currentColor"
        fillOpacity={0.5}
      >
        {Math.round(maxR + pad)}
      </text>
      <text
        x={PADDING.left - 4}
        y={PADDING.top + yScale(minR - pad) + 3}
        textAnchor="end"
        fontSize={8}
        fill="currentColor"
        fillOpacity={0.5}
      >
        {Math.round(minR - pad)}
      </text>
    </svg>
  )
}

export default RatingHistoryChart
