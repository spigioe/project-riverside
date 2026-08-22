import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ticketClient } from '../../api'
import { StatusBadge } from '../../components/Badge/StatusBadge'
import { formatDateTime } from '../../lib/format'
import styles from '../TicketDetailPage.module.css'

export function RelatedTicketsSection({ ticketId }: { ticketId: number }) {
  const relatedQuery = useQuery({
    queryKey: ['ticket-related', ticketId],
    queryFn: () => ticketClient.getRelated(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const related = relatedQuery.data ?? []

  return (
    <div className={styles.card}>
      <div className={styles.panelHeader}>Kapcsolódó jegyek</div>

      {!relatedQuery.isLoading && related.length === 0 && (
        <div className={styles.emptyState}>Nincs más jegy ettől a kérelmezőtől.</div>
      )}

      {related.length > 0 && (
        <div className={styles.clickUpList}>
          {related.map((r) => (
            <Link key={r.id} to={`/tickets/${r.id}`} className={styles.clickUpItem} style={{ display: 'block' }}>
              <div className={styles.clickUpItemHeader}>
                <span className={styles.clickUpTaskLink}>#{r.id} — {r.subject}</span>
                <StatusBadge status={r.status!} />
              </div>
              <div className={styles.clickUpMeta}>{formatDateTime(r.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
