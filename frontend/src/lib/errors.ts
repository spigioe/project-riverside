export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'title' in error && typeof error.title === 'string') {
    return error.title
  }
  return fallback
}
