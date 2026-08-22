import { TicketStatus } from '../../api'
import { STATUS_LABELS } from '../../lib/ticketLabels'
import styles from './Badge.module.css'

const VARIANTS: Record<TicketStatus, string> = {
  [TicketStatus.New]: styles.gray,
  [TicketStatus.Open]: styles.primary,
  [TicketStatus.Pending]: styles.amber,
  [TicketStatus.Resolved]: styles.green,
  [TicketStatus.Closed]: styles.dark,
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${styles.badge} ${VARIANTS[status]}`}>{STATUS_LABELS[status]}</span>
}
