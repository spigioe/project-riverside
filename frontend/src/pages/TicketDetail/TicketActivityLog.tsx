import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ticketClient } from '../../api'
import { formatDateTime } from '../../lib/format'
import { formatActivityAction } from '../../lib/activityFormat'
import styles from '../TicketDetailPage.module.css'

export function TicketActivityLog({ ticketId }: { ticketId: number }) {
  const [open, setOpen] = useState(false)

  const activityQuery = useQuery({
    queryKey: ['ticket-activity', ticketId],
    queryFn: () => ticketClient.getActivity(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const activity = activityQuery.data ?? []

  return (
    <div className={styles.card}>
      <button type="button" className={styles.activityHeader} onClick={() => setOpen((o) => !o)}>
        <span className={styles.cardHeaderTitle}>Tevékenységnapló · {activity.length} esemény</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={styles.activityBody}>
          {activityQuery.isLoading && <div className={styles.emptyState}>Betöltés…</div>}
          {!activityQuery.isLoading && activity.length === 0 && (
            <div className={styles.emptyState}>Nincs rögzített esemény.</div>
          )}
          {activity.map((entry) => (
            <div key={entry.id} className={styles.activityRow}>
              <span className={styles.activityTime}>{formatDateTime(entry.createdAt)}</span>
              <span className={styles.activityUser}>{entry.userName ?? 'Rendszer'}</span>
              <span className={styles.activityAction}>{formatActivityAction(entry)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
