import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { analyticsClient } from '../../api'
import type { ChartConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import styles from './widget.module.css'

interface Props {
  config: ChartConfig
}

function formatPeriod(period: string, groupBy: 'day' | 'hour'): string {
  if (!period) return period
  if (groupBy === 'hour') {
    // "2024-01-15T14" → "14:00"
    const parts = period.split('T')
    return parts[1] ? `${parts[1]}:00` : period
  }
  // "2024-01-15" → "jan. 15."
  try {
    const d = new Date(period)
    return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  } catch { return period }
}

export function ChartWidget({ config }: Props) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-volume', config.timeRange, config.groupBy, config.scope, config.dateFrom, config.dateTo],
    queryFn: () => analyticsClient.getTicketVolume(from, to, config.scope === 'mine' ? 'mine' : null, config.groupBy),
  })

  if (isLoading) {
    return <div className={styles.chartLoading}>Betöltés…</div>
  }

  const chartData = (data ?? []).map(item => ({
    period: formatPeriod(item.period ?? '', config.groupBy),
    beerkező: item.received ?? 0,
    megoldott: item.resolved ?? 0,
  }))

  if (chartData.length === 0) {
    return <div className={styles.chartEmpty}>Nincs adat a kiválasztott időszakban.</div>
  }

  const ChartComponent = config.chartType === 'line' ? LineChart : BarChart

  return (
    <div className={styles.chartContent}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-light)' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
          />
          {config.chartType === 'line' ? (
            <>
              <Line type="monotone" dataKey="beerkező" name="Beérkező" stroke="#4A6CF7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="megoldott" name="Megoldott" stroke="#22c55e" strokeWidth={2} dot={false} />
            </>
          ) : (
            <>
              <Bar dataKey="beerkező" name="Beérkező" fill="#4A6CF7" radius={[2, 2, 0, 0]} />
              <Bar dataKey="megoldott" name="Megoldott" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}
