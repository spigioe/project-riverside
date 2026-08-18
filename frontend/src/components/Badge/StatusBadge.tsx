import { TicketStatus } from '../../api'
import styles from './Badge.module.css'

const LABELS: Record<TicketStatus, string> = {
  [TicketStatus.New]: 'Új',
  [TicketStatus.Open]: 'Nyitott',
  [TicketStatus.Pending]: 'Függőben',
  [TicketStatus.Resolved]: 'Megoldva',
  [TicketStatus.Closed]: 'Lezárva',
}

const VARIANTS: Record<TicketStatus, string> = {
  [TicketStatus.New]: styles.gray,
  [TicketStatus.Open]: styles.primary,
  [TicketStatus.Pending]: styles.amber,
  [TicketStatus.Resolved]: styles.green,
  [TicketStatus.Closed]: styles.dark,
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${styles.badge} ${VARIANTS[status]}`}>{LABELS[status]}</span>
}
