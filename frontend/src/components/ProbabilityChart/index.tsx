import type { MovementPoint } from '@/store/features/dashboard/types'

import styles from './ProbabilityChart.module.scss'

interface ProbabilityChartProps {
  points: MovementPoint[]
}

type SeriesKey = 'home' | 'draw' | 'away'

const series = [
  { key: 'home', label: 'Brazil', className: 'home' },
  { key: 'draw', label: 'Hòa', className: 'draw' },
  { key: 'away', label: 'Pháp', className: 'away' },
] satisfies Array<{ key: SeriesKey; label: string; className: string }>

const width = 560
const height = 260
const paddingX = 36
const paddingY = 28
const minValue = 15
const maxValue = 65

function getCoordinate(points: MovementPoint[], index: number, key: SeriesKey) {
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const x = paddingX + (chartWidth / Math.max(points.length - 1, 1)) * index
  const y =
    paddingY +
    chartHeight -
    ((points[index][key] - minValue) / (maxValue - minValue)) * chartHeight

  return { x, y }
}

function getPath(points: MovementPoint[], key: SeriesKey) {
  return points
    .map((_, index) => {
      const { x, y } = getCoordinate(points, index, key)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function getAreaPath(points: MovementPoint[], key: SeriesKey) {
  if (!points.length) {
    return ''
  }

  const first = getCoordinate(points, 0, key)
  const last = getCoordinate(points, points.length - 1, key)
  const baseline = height - paddingY

  return `${getPath(points, key)} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(
    1,
  )} ${baseline} Z`
}

export function ProbabilityChart({ points }: ProbabilityChartProps) {
  const latest = points.at(-1)

  return (
    <section className={styles.panel} aria-labelledby="movement-title">
      <div className={styles.header}>
        <div>
          <span>Biến động xác suất</span>
          <h2 id="movement-title">6 giờ qua</h2>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ biến động xác suất">
          <defs>
            <linearGradient id="homeProbabilityFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[25, 40, 55].map((tick) => {
            const y =
              paddingY +
              (height - paddingY * 2) -
              ((tick - minValue) / (maxValue - minValue)) * (height - paddingY * 2)

            return (
              <g key={tick}>
                <line
                  className={styles.gridLine}
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                />
                <text className={styles.axisText} x={10} y={y + 4}>
                  {tick}%
                </text>
              </g>
            )
          })}

          <path className={styles.homeArea} d={getAreaPath(points, 'home')} />

          {series.map((item) => (
            <path
              key={item.key}
              className={styles[item.className]}
              d={getPath(points, item.key)}
              fill="none"
            />
          ))}

          {series.map((item) =>
            points.map((_, index) => {
              const { x, y } = getCoordinate(points, index, item.key)

              return (
                <circle
                  key={`${item.key}-${index}`}
                  className={styles[item.className]}
                  cx={x}
                  cy={y}
                  r={index === points.length - 1 ? 4.5 : 3}
                />
              )
            }),
          )}

          {points.map((point, index) => {
            const { x } = getCoordinate(points, index, 'home')
            return (
              <text key={point.label} className={styles.axisText} x={x - 16} y={height - 6}>
                {point.label}
              </text>
            )
          })}
        </svg>
      </div>

      {latest ? (
        <div className={styles.legend}>
          {series.map((item) => (
            <div key={item.key}>
              <span className={styles[item.className]} />
              <strong>{latest[item.key]}%</strong>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
