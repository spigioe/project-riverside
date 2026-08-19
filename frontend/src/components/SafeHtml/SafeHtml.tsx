import { useMemo } from 'react'
import { sanitizeHtml } from '../../lib/sanitizeHtml'

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
