import { useQuery } from '@tanstack/react-query'
import { ticketClient } from '../../api'
import { formatDateTime } from '../../lib/format'
import { formatActivityAction } from '../../lib/activityFormat'
import { Modal } from '../../components/Modal/Modal'
import styles from '../TicketDetailPage.module.css'

export function ActivityLogModal({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const activityQuery = useQuery({
    queryKey: ['ticket-activity', ticketId],
    queryFn: () => ticketClient.getActivity(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const activity = activityQuery.data ?? []

  return (
    <Modal title={`Tevékenységnapló · ${activity.length} esemény`} onClose={onClose} maxWidth={700}>
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
    </Modal>
  )
}
