import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { RecentTicketsConfig } from './types'
import { timeRangeToDates } from './widgetUtils'
import { useNavigate } from 'react-router-dom'
import styles from './widget.module.css'

const STATUS_COLORS: Record<string, string> = {
  New: '#6366f1',
  Open: '#3b82f6',
  Pending: '#f59e0b',
  Resolved: '#22c55e',
  Closed: '#6b7280',
}

export function RecentTicketsWidget({ config }: { config: RecentTicketsConfig }) {
  const { from, to } = timeRangeToDates(config.timeRange, config.dateFrom, config.dateTo)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-recent-tickets', config],
    queryFn: () => analyticsClient.getRecentTickets(from ?? undefined, to ?? undefined, undefined, config.limit),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data || data.length === 0) return <div className={styles.empty}>Nincs jegy az időszakban</div>

  return (
    <div className={styles.ticketList}>
      {data.map(ticket => (
        <div
          key={ticket.id}
          className={styles.ticketRow}
          onClick={() => navigate(`/tickets/${ticket.id}`)}
          title={ticket.subject ?? ''}
        >
          <span
            className={styles.ticketStatusDot}
            style={{ background: STATUS_COLORS[ticket.status ?? ''] ?? '#9ca3af' }}
          />
          <span className={styles.ticketSubject}>{ticket.subject}</span>
          <span className={styles.ticketMeta}>{ticket.requesterName}</span>
        </div>
      ))}
    </div>
  )
}
