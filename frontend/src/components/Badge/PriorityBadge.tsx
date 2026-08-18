import { TicketPriority } from '../../api'
import styles from './Badge.module.css'

const LABELS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: 'Alacsony',
  [TicketPriority.Medium]: 'Közepes',
  [TicketPriority.High]: 'Magas',
  [TicketPriority.Urgent]: 'Sürgős',
}

const VARIANTS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: styles.green,
  [TicketPriority.Medium]: styles.primary,
  [TicketPriority.High]: styles.amber,
  [TicketPriority.Urgent]: styles.red,
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`${styles.badge} ${VARIANTS[priority]}`}>{LABELS[priority]}</span>
}
