import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogClient } from '../../api'
import { formatDateTime } from '../../lib/format'
import shared from '../../components/Settings/SettingsShared.module.css'

const PAGE_SIZE = 20

export function SettingsSystemPage() {
  const [entityType, setEntityType] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log', entityType, page],
    queryFn: () => auditLogClient.getAuditLog(entityType || undefined, page, PAGE_SIZE),
  })

  const items = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Rendszer</h1>
          <div className={shared.subtitle}>{totalCount} audit bejegyzés</div>
        </div>
      </div>

      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <span className={shared.cardHeaderTitle}>Audit napló</span>
          <input
            type="text"
            placeholder="Szűrés entitás típus szerint…"
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1) }}
            style={{
              padding: '6px 10px', background: 'var(--bg-alt)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius)', fontSize: 12.5,
            }}
          />
        </div>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Időpont</th>
                <th>Felhasználó</th>
                <th>Entitás</th>
                <th>Művelet</th>
                <th>Változás</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className={shared.emptyState}>Betöltés…</td></tr>}
              {isError && <tr><td colSpan={5} className={shared.emptyState}>Hiba történt a napló betöltésekor.</td></tr>}
              {!isLoading && !isError && items.length === 0 && (
                <tr><td colSpan={5} className={shared.emptyState}>Nincs a szűrésnek megfelelő bejegyzés.</td></tr>
              )}
              {items.map((log) => (
                <tr key={log.id}>
                  <td className={shared.mono}>{formatDateTime(log.createdAt)}</td>
                  <td>{log.userName ?? '—'}</td>
                  <td className={shared.mono}>{log.entityType} #{log.entityId}</td>
                  <td>{log.action}</td>
                  <td style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', maxWidth: 320 }}>
                    {log.oldValue && <div className={shared.muted}>− {log.oldValue}</div>}
                    {log.newValue && <div>+ {log.newValue}</div>}
                    {!log.oldValue && !log.newValue && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
          <button className={shared.secondaryButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <span className={shared.mono}>{page} / {totalPages || 1}</span>
          <button className={shared.secondaryButton} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      </div>
    </div>
  )
}
