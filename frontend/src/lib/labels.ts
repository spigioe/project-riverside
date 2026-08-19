import { NotificationTrigger, UserRole } from '../api'

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MasterAdmin]: 'Rendszergazda',
  [UserRole.Admin]: 'Admin',
  [UserRole.Agent]: 'Ügyintéző',
  [UserRole.Viewer]: 'Megtekintő',
}

export const NOTIFICATION_TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  [NotificationTrigger.NewTicket]: 'Új jegy érkezett',
  [NotificationTrigger.Assigned]: 'Hozzád rendeltek',
  [NotificationTrigger.CsmFlagged]: 'CSM jelölés történt',
  [NotificationTrigger.NewMessage]: 'Új üzenet érkezett',
  [NotificationTrigger.StatusChanged]: 'Státusz megváltozott',
  [NotificationTrigger.SlaWarning]: 'SLA figyelmeztetés',
  [NotificationTrigger.SlaBreached]: 'SLA határidő túllépve',
}

export const DAY_LABELS: Record<string, string> = {
  Monday: 'Hétfő',
  Tuesday: 'Kedd',
  Wednesday: 'Szerda',
  Thursday: 'Csütörtök',
  Friday: 'Péntek',
  Saturday: 'Szombat',
  Sunday: 'Vasárnap',
}

export const PRIORITY_LABELS: Record<string, string> = {
  Low: 'Alacsony',
  Medium: 'Közepes',
  High: 'Magas',
  Urgent: 'Sürgős',
}
