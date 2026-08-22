import { TicketPriority } from '../../api'
import { PRIORITY_LABELS } from '../../lib/ticketLabels'
import styles from './Badge.module.css'

const VARIANTS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: styles.green,
  [TicketPriority.Medium]: styles.primary,
  [TicketPriority.High]: styles.amber,
  [TicketPriority.Urgent]: styles.red,
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`${styles.badge} ${VARIANTS[priority]}`}>{PRIORITY_LABELS[priority]}</span>
}
