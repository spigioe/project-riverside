import { useQuery } from '@tanstack/react-query'
import { analyticsClient } from '../../api'
import type { MyOpenTicketsConfig } from './types'
import { useNavigate } from 'react-router-dom'
import styles from './widget.module.css'

function SlaBadge({ slaDueAt, slaBreach }: { slaDueAt?: string | null; slaBreach?: boolean }) {
  if (slaBreach) return <span className={styles.slaBadgeBreach}>SLA!</span>
  if (!slaDueAt) return null

  const due = new Date(slaDueAt)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffH = diffMs / 3600000

  if (diffH < 0) return <span className={styles.slaBadgeBreach}>Lejárt</span>
  if (diffH < 2) return <span className={styles.slaBadgeWarning}>{Math.round(diffH * 60)}p</span>
  return <span className={styles.slaBadgeOk}>{Math.round(diffH)}ó</span>
}

export function MyOpenTicketsWidget({ config }: { config: MyOpenTicketsConfig }) {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-my-open-tickets', config],
    queryFn: () => analyticsClient.getMyOpenTickets(config.limit),
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data || data.length === 0) return <div className={styles.empty}>Nincs nyitott jegyed 🎉</div>

  return (
    <div className={styles.ticketList}>
      {data.map(ticket => (
        <div
          key={ticket.id}
          className={styles.ticketRow}
          onClick={() => navigate(`/tickets/${ticket.id}`)}
          title={ticket.subject ?? ''}
        >
          <span className={styles.ticketSubject}>{ticket.subject}</span>
          <SlaBadge slaDueAt={ticket.slaDueAt?.toString()} slaBreach={ticket.slaBreach ?? false} />
        </div>
      ))}
    </div>
  )
}
