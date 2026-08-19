import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  slaClient,
  BusinessHoursDayDto,
  CreateSlaDomainRequest,
  SlaPolicyDto,
  UpdateBusinessHoursRequest,
  UpdateSlaPolicyRequest,
} from '../../api'
import { getErrorMessage } from '../../lib/errors'
import { DAY_LABELS, PRIORITY_LABELS } from '../../lib/labels'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsSlaPage() {
  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>SLA konfiguráció</h1>
          <div className={shared.subtitle}>Válaszidők, megoldási idők, domain kivételek és munkaidő</div>
        </div>
      </div>

      <PolicyTable />
      <DomainExceptions />
      <BusinessHoursGrid />
    </div>
  )
}

function PolicyTable() {
  const queryClient = useQueryClient()
  const policiesQuery = useQuery({ queryKey: ['sla-policies'], queryFn: () => slaClient.getPolicies() })
  const [rows, setRows] = useState<SlaPolicyDto[]>([])
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (policiesQuery.data) setRows(policiesQuery.data)
  }, [policiesQuery.data])

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpdateSlaPolicyRequest }) =>
      slaClient.updatePolicy(id, request),
    onMutate: ({ id }) => { setSavingId(id); setError(null) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült menteni az SLA policyt.')),
    onSettled: () => setSavingId(null),
  })

  function patchRow(id: number, patch: Partial<SlaPolicyDto>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as SlaPolicyDto : r)))
  }

  function saveRow(row: SlaPolicyDto) {
    updateMutation.mutate({
      id: row.id!,
      request: new UpdateSlaPolicyRequest({
        responseTimeMinutes: row.responseTimeMinutes,
        resolutionTimeMinutes: row.resolutionTimeMinutes,
        businessHoursOnly: row.businessHoursOnly,
      }),
    })
  }

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Master SLA policy</span>
      </div>
      {error && <div className={shared.formError} style={{ margin: '0 16px', marginTop: 12 }}>{error}</div>}
      <div className={shared.tableScroll}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Prioritás</th>
              <th>Válaszidő (perc)</th>
              <th>Megoldási idő (perc)</th>
              <th>Csak munkaidőben</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{PRIORITY_LABELS[row.priority!] ?? row.priority}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    className={shared.inlineInputSm}
                    value={row.responseTimeMinutes ?? 0}
                    onChange={(e) => patchRow(row.id!, { responseTimeMinutes: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    className={shared.inlineInputSm}
                    value={row.resolutionTimeMinutes ?? 0}
                    onChange={(e) => patchRow(row.id!, { resolutionTimeMinutes: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.businessHoursOnly ?? false}
                    onChange={(e) => patchRow(row.id!, { businessHoursOnly: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={shared.linkButton}
                    disabled={savingId === row.id}
                    onClick={() => saveRow(row)}
                  >
                    {savingId === row.id ? 'Mentés…' : 'Mentés'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DomainExceptions() {
  const queryClient = useQueryClient()
  const domainsQuery = useQuery({ queryKey: ['sla-domains'], queryFn: () => slaClient.getDomains() })
  const policiesQuery = useQuery({ queryKey: ['sla-policies'], queryFn: () => slaClient.getPolicies() })

  const [slaPolicyId, setSlaPolicyId] = useState<number>(0)
  const [emailDomain, setEmailDomain] = useState('')

  const domains = domainsQuery.data ?? []
  const policies = policiesQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: () => slaClient.createDomain(new CreateSlaDomainRequest({ slaPolicyId, emailDomain })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-domains'] })
      setEmailDomain('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => slaClient.deleteDomain(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-domains'] }),
  })

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Domain kivételek</span>
      </div>
      <div className={shared.tableScroll}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Domain</th>
              <th>SLA policy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 && (
              <tr><td colSpan={3} className={shared.emptyState}>Nincs domain kivétel.</td></tr>
            )}
            {domains.map((d) => (
              <tr key={d.id}>
                <td className={shared.mono}>{d.emailDomain}</td>
                <td>{d.slaPolicyName} ({PRIORITY_LABELS[policies.find((p) => p.id === d.slaPolicyId)?.priority ?? '']})</td>
                <td>
                  <button
                    type="button"
                    className={shared.dangerButton}
                    onClick={() => deleteMutation.mutate(d.id!)}
                  >
                    Törlés
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className={shared.cardBody}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end', borderTop: '1px solid var(--border-light)' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (slaPolicyId && emailDomain.trim()) createMutation.mutate()
        }}
      >
        <div className={shared.field} style={{ margin: 0, flex: 1 }}>
          <label>Domain</label>
          <input
            type="text"
            placeholder="pelda.hu"
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
          />
        </div>
        <div className={shared.field} style={{ margin: 0, flex: 1 }}>
          <label>SLA policy</label>
          <select value={slaPolicyId} onChange={(e) => setSlaPolicyId(Number(e.target.value))}>
            <option value={0}>Válassz…</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>{PRIORITY_LABELS[p.priority!] ?? p.priority}</option>
            ))}
          </select>
        </div>
        <button type="submit" className={shared.primaryButton} disabled={createMutation.isPending}>
          Hozzáadás
        </button>
      </form>
    </div>
  )
}

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
    onSuccess: (result) => {
      queryClient.setQueryData(['business-hours'], result)
    },
  })

  function patchDay(dayOfWeek: string, patch: Partial<BusinessHoursDayDto>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } as BusinessHoursDayDto : d)))
  }

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Munkaidő</span>
        <button type="button" className={shared.primaryButton} disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
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
