import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { SlaBreakdownConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import styles from './widget.module.css'

const COLORS = ['#22c55e', '#ef4444']

export function SlaBreakdownWidget({ config }: { config: SlaBreakdownConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-sla-breakdown', config],
    queryFn: () => analyticsClient.getSlaBreakdown(from ?? undefined, to ?? undefined, config.scope),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data) return null

  const compliant = data.compliant ?? 0
  const breached = data.breached ?? 0
  const total = data.totalWithSla ?? 0
  const pct = data.compliancePercentage ?? 0

  if (total === 0) {
    return <div className={styles.empty}>Nincs SLA-val rendelkező jegy az időszakban</div>
  }

  const pieData = [
    { name: 'Teljesített', value: compliant },
    { name: 'Megszegett', value: breached },
  ]

  return (
    <div className={styles.slaBreakdownRoot}>
      <div className={styles.slaBreakdownChart}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              isAnimationActive={false}
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [`${v} jegy`]}
              contentStyle={{ fontSize: 12, borderRadius: 4 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.slaBreakdownCenter}>
          <div className={styles.slaBreakdownPct}>{Math.round(pct)}%</div>
          <div className={styles.slaBreakdownLabel}>teljesített</div>
        </div>
      </div>
      <div className={styles.slaBreakdownLegend}>
        <div className={styles.slaBreakdownItem}>
          <span className={styles.slaBreakdownDot} style={{ background: COLORS[0] }} />
          <span>Teljesített: {compliant}</span>
        </div>
        <div className={styles.slaBreakdownItem}>
          <span className={styles.slaBreakdownDot} style={{ background: COLORS[1] }} />
          <span>Megszegett: {breached}</span>
        </div>
      </div>
    </div>
  )
}
