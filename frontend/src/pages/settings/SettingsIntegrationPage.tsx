import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiKeysClient, integrationClient, ApiKeyDto, CreateApiKeyRequest, UpdateClickUpConfigRequest } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsIntegrationPage() {
  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Integráció</h1>
          <div className={shared.subtitle}>ClickUp kapcsolat és fejlesztői API kulcsok</div>
        </div>
      </div>

      <ClickUpSection />
      <ApiKeysSection />
    </div>
  )
}

function ClickUpSection() {
  const queryClient = useQueryClient()
  const configQuery = useQuery({ queryKey: ['clickup-config'], queryFn: () => integrationClient.getConfig() })
  const [apiKey, setApiKey] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const config = configQuery.data

  const saveMutation = useMutation({
    mutationFn: () => integrationClient.updateConfig(new UpdateClickUpConfigRequest({ apiKey, workspaceId })),
    onSuccess: (result) => {
      queryClient.setQueryData(['clickup-config'], result)
      setApiKey('')
    },
  })

  const testMutation = useMutation({
    mutationFn: () => integrationClient.testConnection(),
    onSuccess: (result) => setTestResult({ success: result.success!, message: result.message! }),
  })

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>ClickUp konfiguráció</span>
        {config?.isConfigured && (
          <span className={shared.mono}>Frissítve: {formatDateTime(config.updatedAt)}</span>
        )}
      </div>
      <div className={shared.cardBody}>
        {saveMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(saveMutation.error, 'Nem sikerült menteni a beállítást.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="clickup-key">API kulcs {config?.apiKeyMasked && <span className={shared.mono}>(jelenlegi: {config.apiKeyMasked})</span>}</label>
          <input
            id="clickup-key"
            type="password"
            placeholder={config?.isConfigured ? 'Új kulcs megadásához írj ide' : 'pk_...'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="clickup-workspace">Workspace ID</label>
          <input
            id="clickup-workspace"
            type="text"
            placeholder={config?.workspaceId ?? ''}
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          />
        </div>
        {testResult && (
          <div
            className={shared.formError}
            style={{
              background: testResult.success ? 'var(--green-bg)' : 'var(--red-bg)',
              color: testResult.success ? 'var(--green-text)' : 'var(--red-text)',
              borderColor: testResult.success ? 'var(--green-border)' : 'var(--red-border)',
            }}
          >
            {testResult.message}
          </div>
        )}
        <div className={shared.formActions} style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className={shared.primaryButton}
            disabled={saveMutation.isPending || !apiKey.trim() || !workspaceId.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
          <button
            type="button"
            className={shared.secondaryButton}
            disabled={testMutation.isPending || !config?.isConfigured}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? 'Tesztelés…' : 'Kapcsolat tesztelése'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApiKeysSection() {
  const queryClient = useQueryClient()
  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => apiKeysClient.getKeys() })
  const [createOpen, setCreateOpen] = useState(false)
  const [revealedKey, setRevealedKey] = useState<{ name: string; plainKey: string } | null>(null)

  const keys = keysQuery.data ?? []

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiKeysClient.revokeKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Fejlesztői API kulcsok</span>
        <button type="button" className={shared.primaryButton} onClick={() => setCreateOpen(true)}>
          + Új kulcs
        </button>
      </div>
      <div className={shared.tableScroll}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Név</th>
              <th>Létrehozva</th>
              <th>Utoljára használva</th>
              <th>Lejárat</th>
              <th>Állapot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={6} className={shared.emptyState}>Nincs API kulcs.</td></tr>}
            {keys.map((k: ApiKeyDto) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className={shared.mono}>{formatDateTime(k.createdAt)}</td>
                <td className={shared.mono}>{formatDateTime(k.lastUsedAt)}</td>
                <td className={shared.mono}>{k.expiresAt ? formatDateTime(k.expiresAt) : '—'}</td>
                <td className={shared.muted}>{k.isActive ? 'Aktív' : 'Visszavonva'}</td>
                <td>
                  {k.isActive && (
                    <button
                      type="button"
                      className={shared.dangerButton}
                      onClick={() => {
                        if (confirm(`Biztosan visszavonod a(z) "${k.name}" kulcsot?`)) revokeMutation.mutate(k.id!)
                      }}
                    >
                      Visszavonás
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateApiKeyModal
          onClose={() => setCreateOpen(false)}
          onCreated={(name, plainKey) => setRevealedKey({ name, plainKey })}
        />
      )}
      {revealedKey && (
        <Modal title="Új API kulcs" onClose={() => setRevealedKey(null)}>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            A(z) <strong>{revealedKey.name}</strong> kulcs csak most jelenik meg — mentsd el biztonságos helyre, mert később nem lesz újra megjeleníthető.
          </p>
          <div className={shared.field} style={{ marginBottom: 0 }}>
            <input type="text" readOnly value={revealedKey.plainKey} onFocus={(e) => e.target.select()} className={shared.mono} />
          </div>
          <div className={shared.formActions}>
            <button type="button" className={shared.primaryButton} onClick={() => setRevealedKey(null)}>Bezárás</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateApiKeyModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (name: string, plainKey: string) => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const createMutation = useMutation({
    mutationFn: () => apiKeysClient.createKey(new CreateApiKeyRequest({ name })),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      onCreated(result.apiKey!.name!, result.plainKey!)
      onClose()
    },
  })

  return (
    <Modal title="Új API kulcs" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
        {createMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(createMutation.error, 'Nem sikerült létrehozni a kulcsot.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="key-name">Kulcs neve</label>
          <input id="key-name" type="text" placeholder="pl. Integráció szerver" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Létrehozás…' : 'Létrehozás'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
