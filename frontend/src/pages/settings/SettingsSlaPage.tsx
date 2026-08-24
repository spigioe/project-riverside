import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  companiesClient,
  slaClient,
  BusinessHoursDayDto,
  CompanyDto,
  CreateSlaPolicyRequest,
  SlaPolicyDto,
  SlaPriorityRowRequest,
  UpdateBusinessHoursRequest,
  UpdateSlaPolicyRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import { DAY_LABELS, PRIORITY_LABELS } from '../../lib/labels'
import shared from '../../components/Settings/SettingsShared.module.css'

const PRIORITY_ORDER = ['Low', 'Medium', 'High', 'Urgent']

interface PriorityRow {
  priority: string
  responseHours: number
  resolutionHours: string
}

interface PolicyForm {
  name: string
  isDefault: boolean
  businessHoursOnly: boolean
  priorities: PriorityRow[]
  companyIds: number[]
}

function defaultPriorities(): PriorityRow[] {
  return [
    { priority: 'Low', responseHours: 8, resolutionHours: '' },
    { priority: 'Medium', responseHours: 4, resolutionHours: '' },
    { priority: 'High', responseHours: 1, resolutionHours: '' },
    { priority: 'Urgent', responseHours: 0.5, resolutionHours: '' },
  ]
}

function policyToForm(policy: SlaPolicyDto): PolicyForm {
  const priorities = PRIORITY_ORDER.map((p) => {
    const row = policy.priorities?.find((r) => r.priority === p)
    return {
      priority: p,
      responseHours: row ? row.responseTimeMinutes! / 60 : 1,
      resolutionHours: row?.resolutionTimeMinutes ? String(row.resolutionTimeMinutes / 60) : '',
    }
  })
  return {
    name: policy.name ?? '',
    isDefault: policy.isDefault ?? false,
    businessHoursOnly: policy.businessHoursOnly ?? false,
    priorities,
    companyIds: policy.companyIds ?? [],
  }
}

function formToCreateRequest(form: PolicyForm): CreateSlaPolicyRequest {
  return new CreateSlaPolicyRequest({
    name: form.name,
    isDefault: form.isDefault,
    businessHoursOnly: form.businessHoursOnly,
    priorities: form.priorities.map((p) =>
      new SlaPriorityRowRequest({
        priority: p.priority,
        responseTimeMinutes: Math.round(p.responseHours * 60),
        resolutionTimeMinutes: p.resolutionHours ? Math.round(Number(p.resolutionHours) * 60) : undefined,
      })
    ),
    companyIds: form.companyIds,
  })
}

function formToUpdateRequest(form: PolicyForm): UpdateSlaPolicyRequest {
  return new UpdateSlaPolicyRequest({
    name: form.name,
    isDefault: form.isDefault,
    businessHoursOnly: form.businessHoursOnly,
    priorities: form.priorities.map((p) =>
      new SlaPriorityRowRequest({
        priority: p.priority,
        responseTimeMinutes: Math.round(p.responseHours * 60),
        resolutionTimeMinutes: p.resolutionHours ? Math.round(Number(p.resolutionHours) * 60) : undefined,
      })
    ),
    companyIds: form.companyIds,
  })
}

/* ── Main page ─────────────────────────────────────────── */

export function SettingsSlaPage() {
  const queryClient = useQueryClient()
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editPolicy, setEditPolicy] = useState<SlaPolicyDto | null>(null)

  const policiesQuery = useQuery({
    queryKey: ['sla-policies'],
    queryFn: () => slaClient.getPolicies(),
  })

  const companiesQuery = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesClient.getAllCompanies(),
  })

  const policies = policiesQuery.data ?? []
  const companies = companiesQuery.data ?? []
  const hasDefault = policies.some((p) => p.isDefault)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => slaClient.deletePolicy(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
  })

  function openCreate() {
    setEditPolicy(null)
    setModalMode('create')
  }

  function openEdit(policy: SlaPolicyDto) {
    setEditPolicy(policy)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditPolicy(null)
  }

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>SLA konfiguráció</h1>
          <div className={shared.subtitle}>Válaszidők, megoldási idők, cég hozzárendelés és munkaidő</div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={openCreate}>
          + Új SLA policy
        </button>
      </div>

      {!hasDefault && policies.length > 0 && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)',
          background: 'var(--amber-bg, #fffbeb)', border: '1px solid var(--amber-border, #fcd34d)',
          fontSize: 13, color: 'var(--amber-text, #92400e)',
        }}>
          Nincs alapértelmezett (Master SLA) policy beállítva. A ticketek SLA-ja nem kerül kiszámításra.
        </div>
      )}

      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <span className={shared.cardHeaderTitle}>SLA policyk</span>
        </div>
        {policiesQuery.isPending && (
          <div className={shared.emptyState} style={{ padding: '24px 16px' }}>Betöltés…</div>
        )}
        {!policiesQuery.isPending && policies.length === 0 && (
          <div className={shared.emptyState} style={{ padding: '24px 16px' }}>Nincs SLA policy.</div>
        )}
        {policies.length > 0 && (
          <div className={shared.tableScroll}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Név</th>
                  <th>Típus</th>
                  <th>Hozzárendelt cégek</th>
                  <th>Prioritások</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <PolicyRow
                    key={policy.id}
                    policy={policy}
                    companies={companies}
                    onEdit={() => openEdit(policy)}
                    onDelete={() => {
                      if (confirm(`Biztosan törlöd a(z) "${policy.name}" policy-t?`))
                        deleteMutation.mutate(policy.id!)
                    }}
                    deleteDisabled={policy.isDefault ?? false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BusinessHoursGrid />

      {modalMode && (
        <PolicyModal
          mode={modalMode}
          policy={editPolicy}
          companies={companies}
          onClose={closeModal}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['sla-policies'] })
            closeModal()
          }}
        />
      )}
    </div>
  )
}

/* ── Policy table row ──────────────────────────────────── */

function PolicyRow({
  policy, companies, onEdit, onDelete, deleteDisabled,
}: {
  policy: SlaPolicyDto
  companies: CompanyDto[]
  onEdit: () => void
  onDelete: () => void
  deleteDisabled: boolean
}) {
  const assignedCompanies = companies.filter((c) => policy.companyIds?.includes(c.id!))

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{policy.name}</span>
          {policy.isDefault && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              background: 'var(--primary)', color: '#fff',
              borderRadius: 'var(--radius)', letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Master SLA
            </span>
          )}
        </div>
      </td>
      <td>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {policy.businessHoursOnly ? 'Munkaidős' : 'Naptári'}
        </span>
      </td>
      <td>
        {assignedCompanies.length === 0 ? (
          <span className={shared.muted} style={{ fontSize: 12 }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {assignedCompanies.map((c) => (
              <span key={c.id} style={{
                fontSize: 11, padding: '2px 8px',
                background: 'var(--bg-alt)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)', color: 'var(--text)',
              }}>
                {c.name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRIORITY_ORDER.map((p) => {
            const row = policy.priorities?.find((r) => r.priority === p)
            if (!row) return null
            return (
              <span key={p} style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                <b style={{ color: 'var(--text)' }}>{PRIORITY_LABELS[p]}:</b> {row.responseTimeMinutes! / 60}ó
                {row.resolutionTimeMinutes ? ` / ${row.resolutionTimeMinutes / 60}ó` : ''}
              </span>
            )
          })}
        </div>
      </td>
      <td>
        <div className={shared.rowActions}>
          <button type="button" className={shared.editButton} onClick={onEdit}>
            Szerkesztés
          </button>
          <button
            type="button"
            className={shared.dangerButton}
            onClick={onDelete}
            disabled={deleteDisabled}
            title={deleteDisabled ? 'Az alapértelmezett policy nem törölhető.' : undefined}
          >
            Törlés
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ── Policy modal ──────────────────────────────────────── */

function PolicyModal({
  mode, policy, companies, onClose, onSaved,
}: {
  mode: 'create' | 'edit'
  policy: SlaPolicyDto | null
  companies: CompanyDto[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<PolicyForm>(() =>
    policy ? policyToForm(policy) : {
      name: '',
      isDefault: false,
      businessHoursOnly: false,
      priorities: defaultPriorities(),
      companyIds: [],
    }
  )
  const [companySearch, setCompanySearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (policy) setForm(policyToForm(policy))
    else setForm({ name: '', isDefault: false, businessHoursOnly: false, priorities: defaultPriorities(), companyIds: [] })
    setError(null)
  }, [policy])

  const createMutation = useMutation({
    mutationFn: () => slaClient.createPolicy(formToCreateRequest(form)),
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült létrehozni az SLA policyt.')),
  })

  const updateMutation = useMutation({
    mutationFn: () => slaClient.updatePolicy(policy!.id!, formToUpdateRequest(form)),
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült menteni az SLA policyt.')),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function patchPriority(priority: string, patch: Partial<PriorityRow>) {
    setForm((prev) => ({
      ...prev,
      priorities: prev.priorities.map((r) => r.priority === priority ? { ...r, ...patch } : r),
    }))
  }

  function toggleCompany(id: number) {
    setForm((prev) => ({
      ...prev,
      companyIds: prev.companyIds.includes(id)
        ? prev.companyIds.filter((c) => c !== id)
        : [...prev.companyIds, id],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('A policy neve kötelező.'); return }
    setError(null)
    if (mode === 'create') createMutation.mutate()
    else updateMutation.mutate()
  }

  const filteredCompanies = companies.filter((c) =>
    c.name?.toLowerCase().includes(companySearch.toLowerCase())
  )

  return (
    <Modal title={mode === 'create' ? 'Új SLA policy' : 'SLA policy szerkesztése'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className={shared.formError}>{error}</div>}

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Név</label>
          <input
            className={shared.formInput}
            placeholder="pl. Prémium SLA"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            autoFocus
          />
        </div>

        <div className={shared.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />
            <span style={{ fontSize: 13 }}>Master SLA (alapértelmezett)</span>
          </label>
          <div className={shared.formHint}>
            Ha be van jelölve, ez a policy lesz az alap minden ticketre, amelyhez nincs cégspecifikus policy.
          </div>
        </div>

        <div className={shared.formGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.businessHoursOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, businessHoursOnly: e.target.checked }))}
            />
            <span style={{ fontSize: 13 }}>Munkaidő alapú számítás</span>
          </label>
          <div className={shared.formHint}>
            Ha be van jelölve, az SLA határidő csak a munkaidő-beállításokban szereplő órákat számolja.
          </div>
        </div>

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Prioritások (órában)</label>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-alt)' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prioritás</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Válaszidő (óra)</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Megoldási idő (óra)</th>
              </tr>
            </thead>
            <tbody>
              {form.priorities.map((row) => (
                <tr key={row.priority} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 13 }}>{PRIORITY_LABELS[row.priority]}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      className={shared.inlineInputSm}
                      style={{ width: 90 }}
                      value={row.responseHours}
                      onChange={(e) => patchPriority(row.priority, { responseHours: Number(e.target.value) })}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      className={shared.inlineInputSm}
                      style={{ width: 90 }}
                      placeholder="—"
                      value={row.resolutionHours}
                      onChange={(e) => patchPriority(row.priority, { resolutionHours: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Hozzárendelt cégek</label>
          <input
            className={shared.formInput}
            placeholder="Keresés cégek között…"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          {form.companyIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {form.companyIds.map((id) => {
                const c = companies.find((c) => c.id === id)
                return (
                  <span key={id} style={{
                    fontSize: 11, padding: '2px 8px',
                    background: 'var(--primary)', color: '#fff',
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                  }} onClick={() => toggleCompany(id)}>
                    {c?.name ?? `#${id}`} ×
                  </span>
                )
              })}
            </div>
          )}
          <div style={{
            maxHeight: 140, overflowY: 'auto',
            border: '1px solid var(--border-light)', borderRadius: 'var(--radius)',
          }}>
            {filteredCompanies.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Nincs találat.</div>
            ) : filteredCompanies.map((c) => (
              <label key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid var(--border-light)',
                background: form.companyIds.includes(c.id!) ? 'var(--bg-alt)' : undefined,
              }}>
                <input
                  type="checkbox"
                  checked={form.companyIds.includes(c.id!)}
                  onChange={() => toggleCompany(c.id!)}
                />
                {c.name}
                {c.domain && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.domain}</span>}
              </label>
            ))}
          </div>
          <div className={shared.formHint}>
            Ezek a cégek ehhez a policy-hoz lesznek rendelve (e-mail domain alapján is egyeztetve).
          </div>
        </div>

        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose} disabled={isPending}>
            Mégse
          </button>
          <button type="submit" className={shared.primaryButton} disabled={isPending}>
            {isPending ? 'Mentés…' : (mode === 'create' ? 'Létrehozás' : 'Mentés')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Business hours grid ───────────────────────────────── */

const ORDERED_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function BusinessHoursGrid() {
  const queryClient = useQueryClient()
  const hoursQuery = useQuery({ queryKey: ['business-hours'], queryFn: () => slaClient.getBusinessHours() })
  const [days, setDays] = useState<BusinessHoursDayDto[]>([])

  useEffect(() => {
    if (hoursQuery.data) {
      const sorted = [...hoursQuery.data].sort(
        (a, b) => ORDERED_DAYS.indexOf(a.dayOfWeek!) - ORDERED_DAYS.indexOf(b.dayOfWeek!),
      )
      setDays(sorted)
    }
  }, [hoursQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => slaClient.updateBusinessHours(new UpdateBusinessHoursRequest({ days })),
    onSuccess: (result) => queryClient.setQueryData(['business-hours'], result),
  })

  function patchDay(dayOfWeek: string, patch: Partial<BusinessHoursDayDto>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } as BusinessHoursDayDto : d)))
  }

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Munkaidő</span>
        <button
          type="button"
          className={shared.primaryButton}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
        </button>
      </div>
      <div className={shared.tableScroll}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Nap</th>
              <th>Bekapcsolva</th>
              <th>Nyitás</th>
              <th>Zárás</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.dayOfWeek}>
                <td>{DAY_LABELS[d.dayOfWeek!] ?? d.dayOfWeek}</td>
                <td>
                  <button
                    type="button"
                    className={`${shared.toggle} ${d.isEnabled ? shared.toggleOn : ''}`}
                    aria-pressed={d.isEnabled}
                    onClick={() =>
                      patchDay(d.dayOfWeek!, {
                        isEnabled: !d.isEnabled,
                        startTime: d.startTime ?? '08:00:00',
                        endTime: d.endTime ?? '17:00:00',
                      })
                    }
                  >
                    <span className={shared.toggleKnob} />
                  </button>
                </td>
                <td>
                  <input
                    type="time"
                    disabled={!d.isEnabled}
                    className={shared.inlineInputSm}
                    value={d.startTime?.slice(0, 5) ?? '08:00'}
                    onChange={(e) => patchDay(d.dayOfWeek!, { startTime: `${e.target.value}:00` })}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    disabled={!d.isEnabled}
                    className={shared.inlineInputSm}
                    value={d.endTime?.slice(0, 5) ?? '17:00'}
                    onChange={(e) => patchDay(d.dayOfWeek!, { endTime: `${e.target.value}:00` })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
