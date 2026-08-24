import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { companiesClient, CompanyDto, CreateCompanyRequest, UpdateCompanyRequest } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { useAuthStore } from '../../store/useAuthStore'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsCompaniesPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canEdit = user?.role !== 'Viewer'
  const [createOpen, setCreateOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<CompanyDto | null>(null)

  const companiesQuery = useQuery({
    queryKey: ['settings-companies'],
    queryFn: () => companiesClient.getAllCompanies(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companiesClient.deleteCompany(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-companies'] }),
  })

  const companies = companiesQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Cégek</h1>
          <div className={shared.subtitle}>{companies.length} cég</div>
        </div>
        {canEdit && (
          <button type="button" className={shared.primaryButton} onClick={() => setCreateOpen(true)}>
            + Új cég
          </button>
        )}
      </div>

      {deleteMutation.isError && (
        <div className={shared.formError}>{getErrorMessage(deleteMutation.error, 'Nem sikerült törölni a céget.')}</div>
      )}

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Cég neve</th>
                <th>Domain</th>
                <th>Kontaktok</th>
                <th>Létrehozva</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companiesQuery.isLoading && (
                <tr><td colSpan={5} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {!companiesQuery.isLoading && companies.length === 0 && (
                <tr><td colSpan={5} className={shared.emptyState}>Nincs felvett cég.</td></tr>
              )}
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className={shared.muted}>{c.domain ?? '—'}</td>
                  <td>{c.contactCount}</td>
                  <td className={shared.muted}>{formatDateTime(c.createdAt)}</td>
                  <td>
                    {canEdit && (
                      <div className={shared.rowActions}>
                        <button type="button" className={shared.editButton} onClick={() => setEditCompany(c)}>
                          Szerkesztés
                        </button>
                        <button
                          type="button"
                          className={shared.deleteButton}
                          onClick={() => {
                            if (confirm(`Biztosan törlöd a(z) "${c.name}" céget?`))
                              deleteMutation.mutate(c.id!)
                          }}
                        >
                          Törlés
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CompanyModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: ['settings-companies'] })
          }}
        />
      )}

      {editCompany && (
        <CompanyModal
          company={editCompany}
          onClose={() => setEditCompany(null)}
          onSaved={() => {
            setEditCompany(null)
            queryClient.invalidateQueries({ queryKey: ['settings-companies'] })
          }}
        />
      )}
    </div>
  )
}

function CompanyModal({
  company, onClose, onSaved,
}: { company?: CompanyDto; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(company?.name ?? '')
  const [domain, setDomain] = useState(company?.domain ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (company) {
        await companiesClient.updateCompany(company.id!, new UpdateCompanyRequest({ name, domain: domain.trim() || undefined }))
      } else {
        await companiesClient.createCompany(new CreateCompanyRequest({ name, domain: domain.trim() || undefined }))
      }
    },
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült menteni a céget.')),
  })

  return (
    <Modal title={company ? 'Cég szerkesztése' : 'Új cég'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
        {error && <div className={shared.formError}>{error}</div>}
        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Cég neve *</label>
          <input
            className={shared.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pl. Acme Kft."
            required
          />
        </div>
        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Domain (opcionális)</label>
          <input
            className={shared.formInput}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Pl. acme.hu"
          />
          <div className={shared.formHint}>Automatikus kontakt-hozzárendeléshez (email domain alapján)</div>
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.cancelButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={mutation.isPending}>
            {mutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
