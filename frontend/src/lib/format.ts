export function formatDateTime(date: Date | undefined): string {
  if (!date) return '—'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatTicketId(id: number): string {
  return `T-${id}`
}

export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getRequesterCompany(email: string | undefined): string | undefined {
  if (!email) return undefined
  const at = email.indexOf('@')
  if (at === -1) return undefined
  return email.slice(at + 1)
}
