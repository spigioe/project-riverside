import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { CustomerActivityConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useNavigate } from 'react-router-dom'
import styles from './widget.module.css'

export function CustomerActivityWidget({ config }: { config: CustomerActivityConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-customer-activity', config],
    queryFn: () => analyticsClient.getCustomerActivity(from ?? undefined, to ?? undefined, undefined, config.limit),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data || data.length === 0) return <div className={styles.empty}>Nincs adat az időszakban</div>

  const chartData = data.map(d => ({
    name: d.companyName ?? 'Ismeretlen',
    count: d.ticketCount ?? 0,
    companyId: d.companyId,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
        <CartesianGrid horizontal={true} vertical={false} strokeOpacity={0.4} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10 }}
          interval={0}
          tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 8) + '…' : v}
          angle={-30}
          textAnchor="end"
        />
        <YAxis width={32} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [`${v} jegy`, 'Jegyek']}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => `Cég: ${label}`}
          contentStyle={{ fontSize: 12, borderRadius: 4 }}
        />
        <Bar
          dataKey="count"
          name="Jegyek"
          fill="#6D3FC7"
          maxBarSize={32}
          isAnimationActive={false}
          cursor="pointer"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(d: any) => {
            if (d?.companyId) navigate(`/companies/${d.companyId}`)
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
