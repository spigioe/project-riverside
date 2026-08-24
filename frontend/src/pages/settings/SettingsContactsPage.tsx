import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { companiesClient, contactsClient, BuildFromTicketsResult, CompanyDto, ContactDto, CreateContactRequest, UpdateContactRequest } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { useAuthStore } from '../../store/useAuthStore'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsContactsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canEdit = user?.role !== 'Viewer'
  const [createOpen, setCreateOpen] = useState(false)
  const [editContact, setEditContact] = useState<ContactDto | null>(null)
  const [search, setSearch] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState<number | null>(null)
  const [buildResult, setBuildResult] = useState<BuildFromTicketsResult | null>(null)

  const buildMutation = useMutation({
    mutationFn: () => contactsClient.buildFromTickets(),
    onSuccess: (result) => {
      setBuildResult(result)
      queryClient.invalidateQueries({ queryKey: ['settings-contacts'] })
    },
  })

  const contactsQuery = useQuery({
    queryKey: ['settings-contacts', search, filterCompanyId],
    queryFn: () => contactsClient.getContacts(
      search || undefined, filterCompanyId ?? undefined, undefined, undefined),
  })

  const companiesQuery = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesClient.getAllCompanies(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contactsClient.deleteContact(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-contacts'] }),
  })

  const contacts = contactsQuery.data?.items ?? []
  const companies = companiesQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Kontaktok</h1>
          <div className={shared.subtitle}>{contactsQuery.data?.totalCount ?? 0} kontakt</div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className={shared.secondaryButton}
              onClick={() => {
                if (confirm('Végigmegy az összes ticketen és kontaktokat generál a feladók alapján. Folytatod?'))
                  buildMutation.mutate()
              }}
              disabled={buildMutation.isPending}
              title="Kontaktok és cégkapcsolatok generálása a meglévő ticketek feladói alapján"
            >
              {buildMutation.isPending ? 'Generálás…' : '⟳ Generálás ticketekből'}
            </button>
            <button type="button" className={shared.primaryButton} onClick={() => setCreateOpen(true)}>
              + Új kontakt
            </button>
          </div>
        )}
      </div>

      {buildResult && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)',
          background: 'var(--green-bg, #f0fdf4)', border: '1px solid var(--green-border, #86efac)',
          fontSize: 13, color: 'var(--green-text, #166534)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>
            Kész — {buildResult.contactsCreated} új kontakt létrehozva, {buildResult.contactsLinked} már létező egyeztetve,
            {' '}{buildResult.ticketsUpdated} ticket frissítve.
          </span>
          <button
            type="button"
            onClick={() => setBuildResult(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {buildMutation.isError && (
        <div className={shared.formError}>Nem sikerült a generálás. Próbáld újra.</div>
      )}

      <div className={shared.filterRow}>
        <input
          className={shared.searchInput}
          placeholder="Keresés név vagy email alapján…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={shared.filterSelect}
          value={filterCompanyId ?? ''}
          onChange={(e) => setFilterCompanyId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Összes cég</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {deleteMutation.isError && (
        <div className={shared.formError}>{getErrorMessage(deleteMutation.error, 'Nem sikerült törölni a kontaktot.')}</div>
      )}

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Név</th>
                <th>Email</th>
                <th>Cég</th>
                <th>Státusz</th>
                <th>Létrehozva</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contactsQuery.isLoading && (
                <tr><td colSpan={6} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {!contactsQuery.isLoading && contacts.length === 0 && (
                <tr><td colSpan={6} className={shared.emptyState}>Nincs találat.</td></tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className={shared.muted}>{c.email}</td>
                  <td className={shared.muted}>{c.companyName ?? '—'}</td>
                  <td>
                    {c.isActive
                      ? <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>Aktív</span>
                      : <span style={{ color: 'var(--text-muted)' }}>Inaktív</span>}
                  </td>
                  <td className={shared.muted}>{formatDateTime(c.createdAt)}</td>
                  <td>
                    {canEdit && (
                      <div className={shared.rowActions}>
                        <button type="button" className={shared.editButton} onClick={() => setEditContact(c)}>
                          Szerkesztés
                        </button>
                        <button
                          type="button"
                          className={shared.deleteButton}
                          onClick={() => {
                            if (confirm(`Biztosan törlöd a(z) "${c.name}" kontaktot?`))
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
        <ContactModal
          companies={companies}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: ['settings-contacts'] })
          }}
        />
      )}

      {editContact && (
        <ContactModal
          contact={editContact}
          companies={companies}
          onClose={() => setEditContact(null)}
          onSaved={() => {
            setEditContact(null)
            queryClient.invalidateQueries({ queryKey: ['settings-contacts'] })
          }}
        />
      )}
    </div>
  )
}

function ContactModal({
  contact, companies, onClose, onSaved,
}: {
  contact?: ContactDto
  companies: CompanyDto[]
  onClose: () => void
  onSaved: () => void
}) {
  const [email, setEmail] = useState(contact?.email ?? '')
  const [name, setName] = useState(contact?.name ?? '')
  const [companyId, setCompanyId] = useState<number | ''>(contact?.companyId ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (contact) {
        await contactsClient.updateContact(contact.id!, new UpdateContactRequest({ email, name, companyId: companyId || undefined }))
      } else {
        await contactsClient.createContact(new CreateContactRequest({ email, name, companyId: companyId || undefined }))
      }
    },
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült menteni a kontaktot.')),
  })

  return (
    <Modal title={contact ? 'Kontakt szerkesztése' : 'Új kontakt'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
        {error && <div className={shared.formError}>{error}</div>}
        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Email cím *</label>
          <input
            className={shared.formInput}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Teljes név *</label>
          <input
            className={shared.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Cég (opcionális)</label>
          <select
            className={shared.formInput}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— nincs hozzárendelve —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
