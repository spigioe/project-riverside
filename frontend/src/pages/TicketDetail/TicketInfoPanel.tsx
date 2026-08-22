import { useState } from 'react'
import { CustomFieldType, CustomFieldValueDto, TicketDetailDto } from '../../api'
import { StatusBadge } from '../../components/Badge/StatusBadge'
import { PriorityBadge } from '../../components/Badge/PriorityBadge'
import { formatDateTime, formatTicketId, getRequesterCompany } from '../../lib/format'
import styles from '../TicketDetailPage.module.css'

interface TicketInfoPanelProps {
  ticket: TicketDetailDto
  customFields: CustomFieldValueDto[]
  sourceLabel: string
  collapsible?: boolean
}

function formatCustomFieldValue(field: CustomFieldValueDto): string {
  if (field.fieldType === CustomFieldType.Boolean) return field.value === 'true' ? 'Igen' : 'Nem'
  return field.value ?? ''
}

function InfoRow({ label, value, mono }: { label: string | undefined; value: string | undefined; mono?: boolean }) {
  if (!value || !label) return null
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={`${styles.infoRowValue} ${mono ? styles.infoRowValueMono : ''}`}>{value}</span>
    </div>
  )
}

export function TicketInfoPanel({ ticket, customFields, sourceLabel, collapsible = false }: TicketInfoPanelProps) {
  const [open, setOpen] = useState(true)
  const company = getRequesterCompany(ticket.requesterEmail)
  const filledCustomFields = customFields.filter((f) => f.value)
  const showBody = !collapsible || open

  return (
    <div className={styles.infoPanel}>
      <div
        className={`${styles.infoPanelHeader} ${collapsible ? styles.infoPanelHeaderClickable : ''}`}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        role={collapsible ? 'button' : undefined}
      >
        <span>Ticket adatok</span>
        {collapsible && <span className={styles.infoPanelToggle}>{open ? '▾' : '▸'}</span>}
      </div>
      {showBody && (
        <div className={styles.infoPanelBody}>
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
          
        </div>
      )}
    </div>
  )
}
