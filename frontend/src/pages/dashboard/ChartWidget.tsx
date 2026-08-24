import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { analyticsClient } from '../../api'
import type { ChartConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import styles from './widget.module.css'

interface Props {
  config: ChartConfig
}

interface PeriodItem {
  period: string
  beerkező: number
  megoldott: number
}

function formatPeriodKey(date: Date, groupBy: 'day' | 'hour'): string {
  if (groupBy === 'hour') {
    // same format the backend returns: "2024-01-15T14"
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    return `${y}-${m}-${d}T${h}`
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatPeriodLabel(period: string, groupBy: 'day' | 'hour'): string {
  if (!period) return period
  try {
    if (groupBy === 'hour') {
      // "2024-01-15T14" → parse as local hour
      const parts = period.split('T')
      const [y, mo, d] = (parts[0] ?? '').split('-').map(Number)
      const h = Number(parts[1] ?? '0')
      const date = new Date(y, mo - 1, d, h)
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
    }
    const [y, mo, d] = period.split('-').map(Number)
    const date = new Date(y, mo - 1, d)
    return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  } catch { return period }
}

function fillMissingPeriods(
  rawData: { period?: string; received?: number; resolved?: number }[],
  from: Date | null,
  to: Date | null,
  groupBy: 'day' | 'hour',
): PeriodItem[] {
  const byKey = new Map<string, { received: number; resolved: number }>()
  for (const item of rawData) {
    if (item.period) byKey.set(item.period, { received: item.received ?? 0, resolved: item.resolved ?? 0 })
  }

  const start = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const end = to ?? new Date()
  const result: PeriodItem[] = []
  const cursor = new Date(start)

  if (groupBy === 'hour') {
    cursor.setMinutes(0, 0, 0)
    while (cursor <= end) {
      const key = formatPeriodKey(cursor, 'hour')
      const vals = byKey.get(key) ?? { received: 0, resolved: 0 }
      result.push({ period: key, beerkező: vals.received, megoldott: vals.resolved })
      cursor.setHours(cursor.getHours() + 1)
    }
  } else {
    cursor.setHours(0, 0, 0, 0)
    while (cursor <= end) {
      const key = formatPeriodKey(cursor, 'day')
      const vals = byKey.get(key) ?? { received: 0, resolved: 0 }
      result.push({ period: key, beerkező: vals.received, megoldott: vals.resolved })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return result
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

  const chartData = fillMissingPeriods(data ?? [], from, to, config.groupBy)
  const tickInterval = chartData.length > 6 ? Math.floor(chartData.length / 6) : 0

  const ChartComponent = config.chartType === 'line' ? LineChart : BarChart

  return (
    <div className={styles.chartContent}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData}>
          <CartesianGrid
            horizontal={true}
            vertical={false}
            strokeDasharray="3 3"
            stroke="var(--border-light)"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="period"
            tickFormatter={(v: string) => formatPeriodLabel(v, config.groupBy)}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            angle={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              fontSize: 12,
              boxShadow: 'var(--shadow-pop-sm)',
            }}
            labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
            labelFormatter={(v) => formatPeriodLabel(String(v ?? ''), config.groupBy)}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
            formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
          />
          {config.chartType === 'line' ? (
            <>
              <Line
                type="monotone"
                dataKey="beerkező"
                name="Beérkező"
                stroke="var(--primary)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="megoldott"
                name="Megoldott"
                stroke="var(--green, #22c55e)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </>
          ) : (
            <>
              <Bar
                dataKey="beerkező"
                name="Beérkező"
                fill="var(--primary)"
                radius={[2, 2, 0, 0]}
                maxBarSize={32}
                isAnimationActive={false}
              />
              <Bar
                dataKey="megoldott"
                name="Megoldott"
                fill="var(--green, #22c55e)"
                radius={[2, 2, 0, 0]}
                maxBarSize={32}
                isAnimationActive={false}
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}
