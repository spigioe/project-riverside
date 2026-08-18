export function formatDateTime(date: Date | undefined): string {
  if (!date) return '—'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatTicketId(id: number): string {
  return `T-${id}`
}
