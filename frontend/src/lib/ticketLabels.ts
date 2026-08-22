import { TicketPriority, TicketStatus } from '../api'

export const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.New]: 'Új',
  [TicketStatus.Open]: 'Nyitott',
  [TicketStatus.Pending]: 'Függőben',
  [TicketStatus.Resolved]: 'Megoldva',
  [TicketStatus.Closed]: 'Lezárva',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.Low]: 'Alacsony',
  [TicketPriority.Medium]: 'Közepes',
  [TicketPriority.High]: 'Magas',
  [TicketPriority.Urgent]: 'Sürgős',
}
