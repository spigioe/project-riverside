import { TicketDetailDto } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { StatusBadge } from '../../components/Badge/StatusBadge'
import { PriorityBadge } from '../../components/Badge/PriorityBadge'
import { formatDateTime, formatTicketId } from '../../lib/format'
import styles from '../TicketDetailPage.module.css'

function InfoRow({ label, value, mono }: { label: string; value: string | undefined; mono?: boolean }) {
  if (!value) return null
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={`${styles.infoRowValue} ${mono ? styles.infoRowValueMono : ''}`}>{value}</span>
    </div>
  )
}

export function TicketInfoModal({ ticket, sourceLabel, onClose }: {
  ticket: TicketDetailDto
  sourceLabel: string
  onClose: () => void
}) {
  return (
    <Modal title="Ticket adatok" onClose={onClose} maxWidth={400}>
      <div className={styles.infoPanelBadges}>
        <StatusBadge status={ticket.status!} />
        <PriorityBadge priority={ticket.priority!} />
        {ticket.categoryName && <span className={styles.sourceTag}>{ticket.categoryName}</span>}
      </div>
      <InfoRow label="Azonosító" value={formatTicketId(ticket.id!)} mono />
      <InfoRow label="Tárgy" value={ticket.subject} />
      <InfoRow label="Forrás" value={sourceLabel} />
      <InfoRow label="Létrehozva" value={formatDateTime(ticket.createdAt)} mono />
      <InfoRow label="Kérelmező" value={ticket.requesterName} />
    </Modal>
  )
}
