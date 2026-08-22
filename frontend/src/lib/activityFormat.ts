import { TicketActivityDto, TicketPriority, TicketStatus } from '../api'
import { PRIORITY_LABELS, STATUS_LABELS } from './ticketLabels'

function statusLabel(value: string | undefined): string {
  if (!value) return '—'
  return STATUS_LABELS[value as TicketStatus] ?? value
}

function priorityLabel(value: string | undefined): string {
  if (!value) return '—'
  return PRIORITY_LABELS[value as TicketPriority] ?? value
}

function parseCustomFieldValue(json: string | undefined): { fieldName: string; value: string } | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    return { fieldName: parsed.fieldName ?? '?', value: parsed.value ?? '—' }
  } catch {
    return null
  }
}

// Az AuditLog OldValue/NewValue mezőit action-önként eltérően kell értelmezni (lásd
// TicketService/CustomFieldService/ClickUpLinkService LogAsync hívásait a backendben) — ez a
// formázó ismeri az egyes action-ökhöz tartozó payload-alakot és fordítja magyarra.
export function formatActivityAction(entry: TicketActivityDto): string {
  const { action, oldValue, newValue } = entry

  switch (action) {
    case 'created':
      return 'Jegy létrehozva'
    case 'status_changed':
      return `Státusz módosítva: ${statusLabel(oldValue)} → ${statusLabel(newValue)}`
    case 'priority_changed':
      return `Prioritás módosítva: ${priorityLabel(oldValue)} → ${priorityLabel(newValue)}`
    case 'category_changed':
      if (!oldValue) return `Kategória beállítva: ${newValue}`
      if (!newValue) return `Kategória eltávolítva: ${oldValue}`
      return `Kategória módosítva: ${oldValue} → ${newValue}`
    case 'assigned':
      if (!oldValue && newValue) return `Felelős hozzárendelve: ${newValue}`
      if (oldValue && !newValue) return `Felelős eltávolítva: ${oldValue}`
      return `Felelős módosítva: ${oldValue} → ${newValue}`
    case 'csm_assigned':
      if (!oldValue && newValue) return `CSM hozzárendelve: ${newValue}`
      if (oldValue && !newValue) return `CSM eltávolítva: ${oldValue}`
      return `CSM módosítva: ${oldValue} → ${newValue}`
    case 'csm_flagged':
      return newValue?.toLowerCase() === 'true' ? 'CSM jelölés bekapcsolva' : 'CSM jelölés kikapcsolva'
    case 'custom_field_changed': {
      const oldField = parseCustomFieldValue(oldValue)
      const newField = parseCustomFieldValue(newValue)
      const fieldName = newField?.fieldName ?? oldField?.fieldName ?? 'Egyéni mező'
      const oldText = oldField?.value ?? '—'
      const newText = newField?.value ?? '—'
      return `Egyéni mező módosítva: ${fieldName}: ${oldText} → ${newText}`
    }
    case 'message_sent':
      return newValue === 'internal_note' ? 'Belső jegyzet hozzáadva' : 'Üzenet elküldve'
    case 'clickup_link_added':
      return `ClickUp link hozzáadva: ${newValue}`
    case 'clickup_link_removed':
      return `ClickUp link törölve: ${oldValue}`
    default:
      return action ?? 'Ismeretlen esemény'
  }
}
