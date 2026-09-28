import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { VolumeHeatmapConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import styles from './widget.module.css'

const DAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const DAY_NAMES = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
const HOURS = Array.from({ length: 24 }, (_, h) => h)

export function VolumeHeatmapWidget({ config }: { config: VolumeHeatmapConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)
  const tzOffsetMinutes = -new Date().getTimezoneOffset()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-volume-heatmap', config, tzOffsetMinutes],
    queryFn: () => analyticsClient.getVolumeHeatmap(from ?? undefined, to ?? undefined, config.scope, tzOffsetMinutes),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data) return null

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const c of data) grid[c.dayOfWeek ?? 0][c.hour ?? 0] = c.count ?? 0
  const max = Math.max(0, ...grid.flat())
  const total = grid.flat().reduce((a, b) => a + b, 0)

  if (total === 0) return <div className={styles.empty}>Nincs beérkező jegy az időszakban</div>

  let peak = { day: 0, hour: 0, count: 0 }
  grid.forEach((row, d) => row.forEach((count, h) => { if (count > peak.count) peak = { day: d, hour: h, count } }))

  return (
    <div className={styles.heatmapRoot}>
      <div className={styles.heatmapGrid}>
        <div />
        {HOURS.map(h => (
          <div key={h} className={styles.heatmapHourLabel}>{h % 3 === 0 ? h : ''}</div>
        ))}
        {grid.map((row, d) => (
          <div key={d} className={styles.heatmapRow}>
            <div className={styles.heatmapDayLabel}>{DAY_LABELS[d]}</div>
            {row.map((count, h) => (
              <div
                key={h}
                className={styles.heatmapCell}
                style={{ '--intensity': max > 0 ? count / max : 0 } as React.CSSProperties}
                title={`${DAY_NAMES[d]} ${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 — ${count} jegy`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.heatmapFooter}>
        <span>Csúcs: <strong>{DAY_NAMES[peak.day]} {String(peak.hour).padStart(2, '0')}:00</strong> ({peak.count} jegy)</span>
        <span className={styles.heatmapScale}>
          kevés <span className={styles.heatmapScaleBar} /> sok
        </span>
      </div>
    </div>
  )
}
