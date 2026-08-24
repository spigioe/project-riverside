import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { CategoryBreakdownConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import styles from './widget.module.css'

export function CategoryBreakdownWidget({ config }: { config: CategoryBreakdownConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-category-breakdown', config],
    queryFn: () => analyticsClient.getTicketsByCategory(from ?? undefined, to ?? undefined, config.scope, config.limit),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data || data.length === 0) return <div className={styles.empty}>Nincs adat az időszakban</div>

  const chartData = data.map(d => ({ name: d.categoryName ?? 'Ismeretlen', count: d.count ?? 0 }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid horizontal={false} vertical={true} strokeOpacity={0.4} />
        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + '…' : v}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [`${v} jegy`, 'Jegyek']}
          contentStyle={{ fontSize: 12, borderRadius: 4 }}
        />
        <Bar dataKey="count" name="Jegyek" fill="#4A6CF7" maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
