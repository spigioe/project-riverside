import { CustomStatusDto, TicketStatus } from '../../api'
import { STATUS_LABELS } from '../../lib/ticketLabels'
import { CUSTOM_STATUS_EMOJI } from '../../lib/customStatuses'
import styles from './Badge.module.css'

const VARIANTS: Record<TicketStatus, string> = {
  [TicketStatus.New]: styles.gray,
  [TicketStatus.Open]: styles.primary,
  [TicketStatus.Pending]: styles.amber,
  [TicketStatus.Resolved]: styles.green,
  [TicketStatus.Closed]: styles.dark,
}

interface StatusBadgeProps {
  status: TicketStatus
  isMerged?: boolean
  customStatusKey?: string | null
  customStatuses?: CustomStatusDto[]
}

export function StatusBadge({ status, isMerged, customStatusKey, customStatuses }: StatusBadgeProps) {
  if (isMerged) return <span className={`${styles.badge} ${styles.gray}`}>Összevonva</span>

  if (customStatusKey && customStatuses) {
    const cs = customStatuses.find((s) => s.key === customStatusKey && s.isActive)
    if (cs) {
      const variant = styles[cs.colorVariant as keyof typeof styles] ?? styles.gray
      const emoji = CUSTOM_STATUS_EMOJI[cs.iconKey ?? ''] ?? ''
      return (
        <span className={`${styles.badge} ${variant}`}>
          {emoji && <span style={{ marginRight: 3 }}>{emoji}</span>}
          {cs.name}
        </span>
      )
    }
  }

  return <span className={`${styles.badge} ${VARIANTS[status]}`}>{STATUS_LABELS[status]}</span>
}
