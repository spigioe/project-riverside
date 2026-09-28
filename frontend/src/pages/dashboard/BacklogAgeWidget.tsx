import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analyticsClient, TicketPriority } from '../../api'
import { PRIORITY_LABELS } from '../../lib/ticketLabels'
import type { BacklogAgeConfig } from './types'
import { formatHours } from './widgetUtils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import styles from './widget.module.css'

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: '#22c55e',
  [TicketPriority.Medium]: '#4A6CF7',
  [TicketPriority.High]: '#f59e0b',
  [TicketPriority.Urgent]: '#ef4444',
}

const PRIORITY_KEYS: { key: 'low' | 'medium' | 'high' | 'urgent'; priority: TicketPriority }[] = [
  { key: 'low', priority: TicketPriority.Low },
  { key: 'medium', priority: TicketPriority.Medium },
  { key: 'high', priority: TicketPriority.High },
  { key: 'urgent', priority: TicketPriority.Urgent },
]

export function BacklogAgeWidget({ config }: { config: BacklogAgeConfig }) {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-backlog-age', config],
    queryFn: () => analyticsClient.getBacklogAge(config.scope),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data || (data.totalOpen ?? 0) === 0) return <div className={styles.empty}>Nincs nyitott jegy 🎉</div>

  const chartData = (data.buckets ?? []).map(b => ({
    name: b.label ?? '',
    low: b.low ?? 0,
    medium: b.medium ?? 0,
    high: b.high ?? 0,
    urgent: b.urgent ?? 0,
  }))

  return (
    <div className={styles.backlogRoot}>
      <div className={styles.kpiStrip}>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{data.totalOpen}</span>
          <span className={styles.kpiLabel}>nyitott</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{formatHours(data.averageAgeHours)}</span>
          <span className={styles.kpiLabel}>átlagos kor</span>
        </div>
        {data.oldestTicketId != null && (
          <div
            className={`${styles.kpi} ${styles.kpiLink}`}
            onClick={() => navigate(`/tickets/${data.oldestTicketId}`)}
            title="Legrégebbi nyitott jegy megnyitása"
          >
            <span className={styles.kpiValue}>{formatHours(data.oldestAgeHours)}</span>
            <span className={styles.kpiLabel}>legrégebbi (T-{data.oldestTicketId})</span>
          </div>
        )}
      </div>
      <div className={styles.backlogChart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.4} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4 }} cursor={{ fillOpacity: 0.3 }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {PRIORITY_KEYS.map(({ key, priority }) => (
              <Bar
                key={key}
                dataKey={key}
                name={PRIORITY_LABELS[priority]}
                stackId="age"
                fill={PRIORITY_COLORS[priority]}
                maxBarSize={48}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
