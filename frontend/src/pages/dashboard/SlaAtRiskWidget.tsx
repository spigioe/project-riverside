import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analyticsClient } from '../../api'
import type { SlaAtRiskConfig } from './types'
import { formatMinutes } from './widgetUtils'
import styles from './widget.module.css'

function RemainingBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className={styles.slaBadgeBreach}>Lejárt</span>
  if (minutes < 60) return <span className={styles.slaBadgeBreach}>{formatMinutes(minutes)}</span>
  if (minutes < 240) return <span className={styles.slaBadgeWarning}>{formatMinutes(minutes)}</span>
  return <span className={styles.slaBadgeOk}>{formatMinutes(minutes)}</span>
}

export function SlaAtRiskWidget({ config }: { config: SlaAtRiskConfig }) {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-sla-at-risk', config],
    queryFn: () => analyticsClient.getSlaAtRisk(config.scope, config.hours, config.limit),
    refetchInterval: 60_000,
  })

  if (isLoading) return <div className={styles.loading}>Betöltés…</div>
  if (!data || data.length === 0) {
    return <div className={styles.empty}>Nincs SLA-veszélyben lévő jegy a következő {config.hours} órában ✅</div>
  }

  return (
    <div className={`${styles.ticketList} ${styles.atRiskList}`}>
      {data.map(ticket => (
        <div
          key={ticket.id}
          className={styles.ticketRow}
          onClick={() => navigate(`/tickets/${ticket.id}`)}
          title={`${ticket.subject ?? ''}${ticket.assignedToName ? ` — ${ticket.assignedToName}` : ' — nincs felelős'}`}
        >
          <span className={styles.ticketMeta}>T-{ticket.id}</span>
          <span className={styles.ticketSubject}>{ticket.subject}</span>
          <span className={styles.ticketAssignee}>{ticket.assignedToName ?? '—'}</span>
          <RemainingBadge minutes={ticket.minutesRemaining ?? 0} />
        </div>
      ))}
    </div>
  )
}
