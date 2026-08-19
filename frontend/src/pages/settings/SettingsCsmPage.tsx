import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { csmClient, CreateCsmRequest, CsmDto, UpdateCsmRequest } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import badgeStyles from '../../components/Badge/Badge.module.css'
import { getErrorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import shared from '../../components/Settings/SettingsShared.module.css'

function parseDomains(input: string): string[] {
  return input
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
}

export function SettingsCsmPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCsm, setEditCsm] = useState<CsmDto | null>(null)

  const csmQuery = useQuery({
    queryKey: ['settings-csm'],
    queryFn: () => csmClient.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => csmClient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-csm'] }),
  })

  const csms = csmQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>CSM kezelés</h1>
          <div className={shared.subtitle}>{csms.length} ügyfélkapcsolati menedzser</div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={() => setCreateOpen(true)}>
          + Új CSM
        </button>
      </div>

      {deleteMutation.isError && (
        <div className={shared.formError}>{getErrorMessage(deleteMutation.error, 'Nem sikerült törölni a CSM-et.')}</div>
      )}

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Név</th>
                <th>Email</th>
                <th>Domainek</th>
                <th>Létrehozva</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {csmQuery.isLoading && (
                <tr><td colSpan={5} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {!csmQuery.isLoading && csms.length === 0 && (
                <tr><td colSpan={5} className={shared.emptyState}>Nincs felvett CSM.</td></tr>
              )}
              {csms.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className={shared.muted}>{c.email}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {c.domains!.length === 0 && <span className={shared.muted}>—</span>}
                      {c.domains!.map((d) => (
                        <span key={d} className={`${badgeStyles.badge} ${badgeStyles.gray}`}>{d}</span>
                      ))}
                    </div>
                  </td>
                  <td className={shared.mono}>{formatDateTime(c.createdAt)}</td>
                  <td>
                    <div className={shared.actionsCell}>
                      <button type="button" className={shared.linkButton} onClick={() => setEditCsm(c)}>
                        Szerkesztés
                      </button>
                      <button
                        type="button"
                        className={shared.dangerButton}
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Biztosan törlöd "${c.name}"-t?`)) deleteMutation.mutate(c.id!)
                        }}
                      >
                        Törlés
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && <CreateCsmModal onClose={() => setCreateOpen(false)} />}
      {editCsm && <EditCsmModal csm={editCsm} onClose={() => setEditCsm(null)} />}
    </div>
  )
}

function CreateCsmModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [domainsInput, setDomainsInput] = useState('')

  const createMutation = useMutation({
    mutationFn: () => csmClient.create(new CreateCsmRequest({ name, email, domains: parseDomains(domainsInput) })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-csm'] })
      onClose()
    },
  })

  return (
    <Modal title="Új CSM" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
        {createMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(createMutation.error, 'Nem sikerült létrehozni a CSM-et.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="csm-name">Név</label>
          <input id="csm-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="csm-email">Email cím</label>
          <input id="csm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="csm-domains">Domainek (vesszővel elválasztva)</label>
          <input
            id="csm-domains"
            type="text"
            placeholder="mol.hu, mol-group.hu"
            value={domainsInput}
            onChange={(e) => setDomainsInput(e.target.value)}
          />
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

function EditCsmModal({ csm, onClose }: { csm: CsmDto; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(csm.name ?? '')
  const [email, setEmail] = useState(csm.email ?? '')
  const [domainsInput, setDomainsInput] = useState((csm.domains ?? []).join(', '))

  const updateMutation = useMutation({
    mutationFn: () => csmClient.update(csm.id!, new UpdateCsmRequest({ name, email, domains: parseDomains(domainsInput) })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-csm'] })
      onClose()
    },
  })

  return (
    <Modal title={`${csm.name} szerkesztése`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }}>
        {updateMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(updateMutation.error, 'Nem sikerült menteni a módosítást.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="edit-csm-name">Név</label>
          <input id="edit-csm-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="edit-csm-email">Email cím</label>
          <input id="edit-csm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="edit-csm-domains">Domainek (vesszővel elválasztva)</label>
          <input
            id="edit-csm-domains"
            type="text"
            placeholder="mol.hu, mol-group.hu"
            value={domainsInput}
            onChange={(e) => setDomainsInput(e.target.value)}
          />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
