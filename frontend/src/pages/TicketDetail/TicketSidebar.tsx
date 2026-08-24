import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  categoriesClient,
  csmClient,
  contactsClient,
  meClient,
  ticketClient,
  ticketCustomFieldsClient,
  usersClient,
  AssignCustomStatusRequest,
  AssignTicketContactRequest,
  AssignTicketRequest,
  CategoryDto,
  ClickUpLinkDto,
  CreateClickUpLinkRequest,
  CsmAssignRequest,
  CustomFieldType,
  CustomFieldValueDto,
  TicketDetailDto,
  TicketListView,
  TicketPriority,
  TicketStatus,
  TicketType,
  UpdateCustomFieldValueItem,
  UpdateTicketPriorityRequest,
  UpdateTicketRequest,
  UpdateTicketStatusRequest,
  UpdateTicketTypeRequest,
} from '../../api'
import { useCustomStatuses } from '../../lib/customStatuses'
import { Modal } from '../../components/Modal/Modal'
import { PriorityBadge } from '../../components/Badge/PriorityBadge'
import badgeStyles from '../../components/Badge/Badge.module.css'
import shared from '../../components/Settings/SettingsShared.module.css'
import { formatDateTime } from '../../lib/format'
import { getErrorMessage } from '../../lib/errors'
import styles from './TicketSidebar.module.css'

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: TicketPriority.Low, label: 'Alacsony' },
  { value: TicketPriority.Medium, label: 'Közepes' },
  { value: TicketPriority.High, label: 'Magas' },
  { value: TicketPriority.Urgent, label: 'Sürgős' },
]

const TYPE_OPTIONS: { value: TicketType; label: string }[] = [
  { value: TicketType.Question, label: 'Kérdés' },
  { value: TicketType.Incident, label: 'Incidens' },
  { value: TicketType.Problem, label: 'Probléma' },
  { value: TicketType.FeatureRequest, label: 'Funkció kérés' },
]

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: TicketStatus.New, label: 'Új' },
  { value: TicketStatus.Open, label: 'Nyitott' },
  { value: TicketStatus.Pending, label: 'Függőben' },
  { value: TicketStatus.Resolved, label: 'Megoldva' },
  { value: TicketStatus.Closed, label: 'Lezárva' },
]

function findParentCat(catId: number | undefined, tree: CategoryDto[]): CategoryDto | undefined {
  if (!catId) return undefined
  for (const root of tree) {
    if (root.id === catId) return root
    if (root.children?.some((c) => c.id === catId)) return root
  }
  return undefined
}

function clickUpStatusVariant(status: string | undefined): string {
  if (!status) return badgeStyles.gray
  const s = status.toLowerCase()
  if (s.includes('progress')) return badgeStyles.primary
  if (s.includes('complete') || s.includes('done') || s.includes('closed')) return badgeStyles.green
  if (s.includes('block')) return badgeStyles.red
  return badgeStyles.gray
}

function extractClickUpTaskId(url: string): string {
  const match = url.match(/\/t\/([a-zA-Z0-9]+)/)
  if (match) return match[1]
  const segments = url.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

interface Props {
  ticket: TicketDetailDto
  ticketId: number
  inline?: boolean
}

export function TicketSidebar({ ticket, ticketId, inline = false }: Props) {
  const queryClient = useQueryClient()

  const preferencesQuery = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => meClient.getPreferences(),
  })
  const autosave = preferencesQuery.data?.ticketPropertiesAutosave ?? true

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersClient.getUsers() })
  const users = usersQuery.data ?? []

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => categoriesClient.getTree() })
  const categoryTree = categoriesQuery.data ?? []

  const csmListQuery = useQuery({ queryKey: ['settings-csm'], queryFn: () => csmClient.getAll() })

  const customStatusesQuery = useCustomStatuses()
  const customStatuses = customStatusesQuery.data ?? []

  const customFieldsQuery = useQuery({
    queryKey: ['ticket-custom-fields', ticketId],
    queryFn: () => ticketCustomFieldsClient.getValues(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  /* ── Draft state (manual save mode) ───────────────── */
  const [draftAssignedToId, setDraftAssignedToId] = useState<number | undefined>()
  const [draftStatus, setDraftStatus] = useState<TicketStatus | undefined>()
  const [draftCustomStatusKey, setDraftCustomStatusKey] = useState<string | null>(null)
  const [draftCsmId, setDraftCsmId] = useState<number | undefined>()
  const [draftPriority, setDraftPriority] = useState<TicketPriority | undefined>()
  const [draftType, setDraftType] = useState<TicketType | undefined>()
  const [draftCategoryId, setDraftCategoryId] = useState<number | undefined>()
  const [propertiesDirty, setPropertiesDirty] = useState(false)

  useEffect(() => {
    setDraftAssignedToId(ticket.assignedToId)
    setDraftStatus(ticket.status)
    setDraftCustomStatusKey(ticket.customStatusKey ?? null)
    setDraftCsmId(ticket.csmId)
    setDraftPriority(ticket.priority)
    setDraftType(ticket.type)
    setDraftCategoryId(ticket.categoryId ?? undefined)
    setPropertiesDirty(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id])

  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string | undefined>>({})
  const customFieldsInitRef = useRef<number | null>(null)
  const customFieldTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (customFieldsQuery.data && customFieldsInitRef.current !== ticketId) {
      const values: Record<number, string | undefined> = {}
      customFieldsQuery.data.forEach((f) => { values[f.definitionId!] = f.value ?? undefined })
      setCustomFieldValues(values)
      customFieldsInitRef.current = ticketId
    }
  }, [customFieldsQuery.data, ticketId])

  function handleCustomFieldChange(definitionId: number, value: string | undefined) {
    setCustomFieldValues((prev) => ({ ...prev, [definitionId]: value }))
    if (autosave) {
      clearTimeout(customFieldTimers.current[definitionId])
      customFieldTimers.current[definitionId] = setTimeout(() => {
        customFieldMutation.mutate(new UpdateCustomFieldValueItem({ definitionId, value }))
      }, 500)
    } else {
      setPropertiesDirty(true)
    }
  }

  /* ── Mutations ─────────────────────────────────────── */
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
  }

  const assignMutation = useMutation({
    mutationFn: (assignedToId: number | undefined) =>
      ticketClient.assignTicket(ticketId, new AssignTicketRequest({ assignedToId })),
    onSuccess: invalidate,
  })

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      ticketClient.updateStatus(ticketId, new UpdateTicketStatusRequest({ status })),
    onSuccess: invalidate,
  })

  const customStatusMutation = useMutation({
    mutationFn: (key: string | null) =>
      ticketClient.assignCustomStatus(ticketId, new AssignCustomStatusRequest({ key: key ?? undefined })),
    onSuccess: invalidate,
  })

  const priorityMutation = useMutation({
    mutationFn: (priority: TicketPriority) =>
      ticketClient.updatePriority(ticketId, new UpdateTicketPriorityRequest({ priority })),
    onSuccess: invalidate,
  })

  const typeMutation = useMutation({
    mutationFn: (type: TicketType | undefined) =>
      ticketClient.updateType(ticketId, new UpdateTicketTypeRequest({ type })),
    onSuccess: invalidate,
  })

  const categoryMutation = useMutation({
    mutationFn: (categoryId: number | undefined) =>
      ticketClient.updateTicket(ticketId, new UpdateTicketRequest({
        subject: ticket.subject,
        body: ticket.body,
        priority: ticket.priority,
        categoryId,
        requesterEmail: ticket.requesterEmail,
        requesterName: ticket.requesterName,
      })),
    onSuccess: invalidate,
  })

  const csmAssignMutation = useMutation({
    mutationFn: (csmId: number | undefined) =>
      ticketClient.assignCsm(ticketId, new CsmAssignRequest({ csmId })),
    onSuccess: invalidate,
  })

  const customFieldMutation = useMutation({
    mutationFn: (item: UpdateCustomFieldValueItem) =>
      ticketCustomFieldsClient.updateValues(ticketId, [item]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-custom-fields', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const savePropertiesMutation = useMutation({
    mutationFn: async () => {
      const tasks: Promise<unknown>[] = []
      if (draftAssignedToId !== ticket.assignedToId)
        tasks.push(ticketClient.assignTicket(ticketId, new AssignTicketRequest({ assignedToId: draftAssignedToId })))
      if (draftCustomStatusKey !== (ticket.customStatusKey ?? null))
        tasks.push(ticketClient.assignCustomStatus(ticketId, new AssignCustomStatusRequest({ key: draftCustomStatusKey ?? undefined })))
      if (draftCustomStatusKey === null && draftStatus !== ticket.status)
        tasks.push(ticketClient.updateStatus(ticketId, new UpdateTicketStatusRequest({ status: draftStatus! })))
      if (draftCsmId !== ticket.csmId)
        tasks.push(ticketClient.assignCsm(ticketId, new CsmAssignRequest({ csmId: draftCsmId })))
      if (draftPriority !== ticket.priority && draftPriority)
        tasks.push(ticketClient.updatePriority(ticketId, new UpdateTicketPriorityRequest({ priority: draftPriority })))
      if (draftType !== ticket.type)
        tasks.push(ticketClient.updateType(ticketId, new UpdateTicketTypeRequest({ type: draftType })))
      if (draftCategoryId !== (ticket.categoryId ?? undefined))
        tasks.push(ticketClient.updateTicket(ticketId, new UpdateTicketRequest({
          subject: ticket.subject,
          body: ticket.body,
          priority: ticket.priority,
          categoryId: draftCategoryId,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requesterName,
        })))
      const changedCustomFields = (customFieldsQuery.data ?? [])
        .filter((f) => (customFieldValues[f.definitionId!] ?? '') !== (f.value ?? ''))
        .map((f) => new UpdateCustomFieldValueItem({ definitionId: f.definitionId, value: customFieldValues[f.definitionId!] }))
      if (changedCustomFields.length > 0)
        tasks.push(ticketCustomFieldsClient.updateValues(ticketId, changedCustomFields))
      await Promise.all(tasks)
    },
    onSuccess: () => {
      setPropertiesDirty(false)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-custom-fields', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const customFields = customFieldsQuery.data ?? []

  return (
    <aside className={inline ? styles.sidebarInline : styles.sidebar}>
      {/* ── 1. KONTAKT ─────────────────────────────────── */}
      <div className={styles.sectionHeader}>Kontakt</div>
      <div className={styles.sectionBody}>
        <ContactSection ticket={ticket} ticketId={ticketId} />
      </div>

      <div className={styles.divider} />

      {/* ── 2. TULAJDONSÁGOK ───────────────────────────── */}
      <div className={styles.sectionHeader}>Tulajdonságok</div>
      <div className={styles.sectionBody}>
        {/* SLA státusz */}
        <SlaStatusRow ticket={ticket} />

        {/* ── STÁTUSZ & PRIORITÁS ── */}
        <div className={styles.propGroup}>
          <span className={styles.propGroupHeader}>Státusz &amp; Prioritás</span>

          <div className={styles.propRow}>
            <label className={styles.propLabel}>Státusz</label>
            <select
              className={styles.propSelect}
              value={autosave
                ? (ticket.customStatusKey ?? ticket.status)
                : (draftCustomStatusKey ?? draftStatus ?? ticket.status)}
              onChange={(e) => {
                const v = e.target.value
                const isBuiltIn = (Object.values(TicketStatus) as string[]).includes(v)
                if (autosave) {
                  if (isBuiltIn) {
                    statusMutation.mutate(v as TicketStatus)
                    if (ticket.customStatusKey) customStatusMutation.mutate(null)
                  } else {
                    customStatusMutation.mutate(v)
                  }
                } else {
                  if (isBuiltIn) { setDraftStatus(v as TicketStatus); setDraftCustomStatusKey(null) }
                  else { setDraftCustomStatusKey(v) }
                  setPropertiesDirty(true)
                }
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              {customStatuses.filter((cs) => cs.isActive).map((cs) => (
                <option key={cs.key} value={cs.key!}>{cs.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.propRow}>
            <label className={styles.propLabel}>Prioritás</label>
            <select
              className={styles.propSelect}
              value={(autosave ? ticket.priority : draftPriority) ?? ''}
              onChange={(e) => {
                const value = e.target.value as TicketPriority
                if (autosave) priorityMutation.mutate(value)
                else { setDraftPriority(value); setPropertiesDirty(true) }
              }}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.propRow}>
            <label className={styles.propLabel}>Típus</label>
            <select
              className={styles.propSelect}
              value={(autosave ? ticket.type : draftType) ?? ''}
              onChange={(e) => {
                const value = e.target.value ? (e.target.value as TicketType) : undefined
                if (autosave) typeMutation.mutate(value)
                else { setDraftType(value); setPropertiesDirty(true) }
              }}
            >
              <option value="">— nincs megadva —</option>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.propGroupDivider} />

        {/* ── HOZZÁRENDELÉS ── */}
        <div className={styles.propGroup}>
          <span className={styles.propGroupHeader}>Hozzárendelés</span>

          <div className={styles.propRow}>
            <label className={styles.propLabel}>Felelős</label>
            <select
              className={styles.propSelect}
              value={(autosave ? ticket.assignedToId : draftAssignedToId) ?? ''}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined
                if (autosave) assignMutation.mutate(value)
                else { setDraftAssignedToId(value); setPropertiesDirty(true) }
              }}
            >
              <option value="">Nincs hozzárendelve</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>

          <div className={styles.propRow}>
            <label className={styles.propLabel}>CSM felelős</label>
            <select
              className={styles.propSelect}
              value={(autosave ? ticket.csmId : draftCsmId) ?? ''}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined
                if (autosave) csmAssignMutation.mutate(value)
                else { setDraftCsmId(value); setPropertiesDirty(true) }
              }}
            >
              <option value="">Nincs hozzárendelve</option>
              {(csmListQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.propGroupDivider} />

        {/* ── KATEGORIZÁLÁS ── */}
        {(() => {
          const currentCatId = autosave ? (ticket.categoryId ?? undefined) : draftCategoryId
          const parentCat = findParentCat(currentCatId, categoryTree)
          const selectedParentId = parentCat?.id
          const subCats = parentCat?.children ?? []
          const selectedSubId = subCats.some((c) => c.id === currentCatId) ? currentCatId : undefined

          function handleParentChange(newParentIdStr: string) {
            const newParentId = newParentIdStr ? Number(newParentIdStr) : undefined
            const newParentCat = categoryTree.find((r) => r.id === newParentId)
            const children = newParentCat?.children ?? []
            let leafId: number | undefined
            if (!newParentId) {
              leafId = undefined
            } else if (children.length === 1) {
              leafId = children[0].id!
            } else {
              leafId = newParentId
            }
            if (autosave) categoryMutation.mutate(leafId)
            else { setDraftCategoryId(leafId); setPropertiesDirty(true) }
          }

          function handleSubChange(newSubIdStr: string) {
            const newSubId = newSubIdStr ? Number(newSubIdStr) : undefined
            if (autosave) categoryMutation.mutate(newSubId)
            else { setDraftCategoryId(newSubId); setPropertiesDirty(true) }
          }

          return (
            <div className={styles.propGroup}>
              <span className={styles.propGroupHeader}>Kategorizálás</span>

              <div className={styles.propRow}>
                <label className={styles.propLabel}>Kategória</label>
                <select
                  className={styles.propSelect}
                  value={selectedParentId ?? ''}
                  onChange={(e) => handleParentChange(e.target.value)}
                >
                  <option value="">— nincs megadva —</option>
                  {categoryTree.map((c) => (
                    <option key={c.id} value={c.id!}>{c.name}</option>
                  ))}
                </select>
              </div>

              {subCats.length > 0 && (
                <div className={styles.propRow}>
                  <label className={styles.propLabel}>Alkategória</label>
                  <select
                    className={styles.propSelect}
                    value={selectedSubId ?? ''}
                    disabled={subCats.length === 1}
                    onChange={(e) => handleSubChange(e.target.value)}
                  >
                    {subCats.length > 1 && <option value="">— válassz —</option>}
                    {subCats.map((c) => (
                      <option key={c.id} value={c.id!}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )
        })()}

        {customFields.length > 0 && (
          <>
            <div className={styles.propGroupDivider} />
            {/* ── EGYÉNI MEZŐK ── */}
            <div className={styles.propGroup}>
              <span className={styles.propGroupHeader}>Egyéni mezők</span>
              {customFields.map((field) => (
                <CustomFieldRow
                  key={field.definitionId}
                  field={field}
                  value={customFieldValues[field.definitionId!]}
                  onChange={(value) => handleCustomFieldChange(field.definitionId!, value)}
                />
              ))}
            </div>
          </>
        )}

        {/* Mentés gomb (manuális mód) */}
        {!autosave && (
          <div style={{ paddingTop: 2 }}>
            <button
              type="button"
              className={shared.primaryButton}
              style={{ width: '100%' }}
              disabled={!propertiesDirty || savePropertiesMutation.isPending}
              onClick={() => savePropertiesMutation.mutate()}
            >
              {savePropertiesMutation.isPending ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* ── 3. CLICKUP ─────────────────────────────────── */}
      <ClickUpSection ticketId={ticketId} />
    </aside>
  )
}

/* ── Contact sub-section ───────────────────────────────── */

function ContactSection({ ticket, ticketId }: { ticket: TicketDetailDto; ticketId: number }) {
  const queryClient = useQueryClient()
  const [assignMode, setAssignMode] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')

  const contactDetailQuery = useQuery({
    queryKey: ['contact-detail', ticket.contactId],
    queryFn: () => contactsClient.getContact(ticket.contactId!),
    enabled: !!ticket.contactId,
  })

  const contactSearchQuery = useQuery({
    queryKey: ['contact-search', searchEmail],
    queryFn: () => contactsClient.getContacts(searchEmail, undefined, undefined, undefined),
    enabled: assignMode && searchEmail.length >= 2,
  })

  const assignMutation = useMutation({
    mutationFn: (contactId: number) =>
      ticketClient.assignContact(ticketId, new AssignTicketContactRequest({ contactId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      setAssignMode(false)
      setSearchEmail('')
    },
  })

  const contact = contactDetailQuery.data

  if (!ticket.contactId) {
    if (!assignMode) {
      return (
        <>
          <span className={styles.emptyState}>Ismeretlen kontakt</span>
          <button
            type="button"
            className={shared.primaryButton}
            style={{ fontSize: 12 }}
            onClick={() => setAssignMode(true)}
          >
            Hozzárendelés
          </button>
        </>
      )
    }
    return (
      <>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Email keresés…"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          autoFocus
        />
        {(contactSearchQuery.data?.items ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.searchResultBtn}
            onClick={() => assignMutation.mutate(c.id!)}
          >
            <span className={styles.searchResultName}>{c.name}</span>
            <span className={styles.searchResultEmail}>{c.email}</span>
          </button>
        ))}
        {searchEmail.length >= 2 && (contactSearchQuery.data?.items ?? []).length === 0 && !contactSearchQuery.isLoading && (
          <span className={styles.emptyState}>Nincs találat.</span>
        )}
        <button
          type="button"
          className={shared.secondaryButton}
          style={{ marginTop: 4, fontSize: 12 }}
          onClick={() => { setAssignMode(false); setSearchEmail('') }}
        >
          Mégse
        </button>
      </>
    )
  }

  if (contactDetailQuery.isLoading) return <span className={styles.emptyState}>Betöltés…</span>
  if (!contact) return null

  const recentTickets = (contact.recentTickets ?? []).slice(0, 3)

  return (
    <>
      <div>
        <Link to="/settings/contacts" className={styles.contactName}>
          {contact.name}
          {!contact.isActive && (
            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(inaktív)</span>
          )}
        </Link>
        <div className={styles.contactEmail}>{contact.email}</div>
        {contact.companyName && (
          <span className={styles.companyBadge}>{contact.companyName}</span>
        )}
      </div>

      {recentTickets.length > 0 && (
        <div>
          <div className={styles.prevTicketsLabel}>Korábbi jegyek</div>
          <div className={styles.prevTicketsList}>
            {recentTickets.map((t) => (
              <Link key={t.id} to={`/tickets/${t.id}`} className={styles.prevTicketLink}>
                #{t.id} – {t.subject}
              </Link>
            ))}
          </div>
          {(contact.recentTickets ?? []).length > 3 && (
            <Link to="/settings/contacts" className={styles.allTicketsLink}>
              Összes megtekintése →
            </Link>
          )}
        </div>
      )}
    </>
  )
}

/* ── Custom field row ──────────────────────────────────── */

function CustomFieldRow({
  field, value, onChange,
}: { field: CustomFieldValueDto; value: string | undefined; onChange: (v: string | undefined) => void }) {
  if (field.fieldType === CustomFieldType.Boolean) {
    const checked = value === 'true'
    return (
      <div className={styles.propRow}>
        <div className={styles.toggleRow}>
          <span className={styles.propLabel}>{field.name}</span>
          <button
            type="button"
            className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
            onClick={() => onChange(checked ? 'false' : 'true')}
            aria-pressed={checked}
            aria-label={field.name ?? ''}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </div>
    )
  }
  if (field.fieldType === CustomFieldType.Select) {
    return (
      <div className={styles.propRow}>
        <label className={styles.propLabel}>{field.name}</label>
        <select
          className={styles.propSelect}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">— válassz —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <div className={styles.propRow}>
      <label className={styles.propLabel}>{field.name}</label>
      <input
        type="text"
        className={styles.propInput}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </div>
  )
}

/* ── SLA status row ────────────────────────────────────── */

function SlaStatusRow({ ticket }: { ticket: TicketDetailDto }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!ticket.slaDueAt) return null

  const diffMins = Math.round((ticket.slaDueAt.getTime() - now) / 60_000)
  const breached = ticket.slaBreach || diffMins < 0

  let bg = '#dcfce7'
  let color = '#166534'
  let border = '#86efac'
  let label: string

  if (breached) {
    bg = '#fef2f2'; color = '#991b1b'; border = '#fca5a5'
    const absMins = Math.abs(diffMins)
    const h = Math.floor(absMins / 60)
    const m = absMins % 60
    label = `SLA lejárt${h > 0 ? ` (${h}ó ${m}p)` : ` (${m}p)`}`
  } else if (diffMins < 120) {
    bg = '#fffbeb'; color = '#92400e'; border = '#fcd34d'
    const h = Math.floor(diffMins / 60)
    const m = diffMins % 60
    label = `SLA: ${h > 0 ? `${h}ó ` : ''}${m}p van hátra`
  } else {
    const h = Math.floor(diffMins / 60)
    const m = diffMins % 60
    label = `SLA: ${h > 0 ? `${h}ó ` : ''}${m}p van hátra`
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <span
        title={`SLA határidő: ${ticket.slaDueAt.toLocaleString('hu-HU')}`}
        style={{
          display: 'inline-block', fontSize: 11.5, fontWeight: 600,
          padding: '3px 9px', borderRadius: 'var(--radius)',
          background: bg, color, border: `1px solid ${border}`,
        }}
      >
        {label}
      </span>
    </div>
  )
}

/* ── ClickUp sub-section ───────────────────────────────── */

function ClickUpSection({ ticketId }: { ticketId: number }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const linksQuery = useQuery({
    queryKey: ['ticket-clickup', ticketId],
    queryFn: () => ticketClient.getClickUpLinks(ticketId),
    enabled: Number.isFinite(ticketId),
  })
  const links = linksQuery.data ?? []

  const syncMutation = useMutation({
    mutationFn: (linkId: number) => ticketClient.syncClickUpLink(ticketId, linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-clickup', ticketId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: number) => ticketClient.deleteClickUpLink(ticketId, linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-clickup', ticketId] }),
  })

  return (
    <>
      <div className={styles.sectionHeader}>
        <span>ClickUp feladatok</span>
        <button type="button" className={styles.sectionAddBtn} onClick={() => setAddOpen(true)}>
          + Link hozzáadása
        </button>
      </div>
      <div className={styles.sectionBody}>
        {links.length === 0 ? (
          <span className={styles.emptyState}>Nincs összekapcsolt feladat.</span>
        ) : (
          <div className={styles.clickUpList}>
            {links.map((link: ClickUpLinkDto) => (
              <div key={link.id} className={styles.clickUpItem}>
                <div className={styles.clickUpItemHeader}>
                  <a
                    href={link.clickUpTaskUrl ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.clickUpTaskLink}
                  >
                    {link.clickUpTaskTitle ?? link.clickUpTaskId}
                  </a>
                  <span className={`${badgeStyles.badge} ${clickUpStatusVariant(link.clickUpStatus)}`}>
                    {link.clickUpStatus ?? '—'}
                  </span>
                </div>
                <div className={styles.clickUpMeta}>
                  {link.statusSyncedAt
                    ? `Szinkr.: ${formatDateTime(link.statusSyncedAt)}`
                    : 'Még nem szinkronizált'}
                </div>
                {link.notes && <div className={styles.clickUpMeta}>{link.notes}</div>}
                <div className={styles.clickUpActions}>
                  <button
                    type="button"
                    className={shared.secondaryButton}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    disabled={syncMutation.isPending && syncMutation.variables === link.id}
                    onClick={() => syncMutation.mutate(link.id!)}
                  >
                    {syncMutation.isPending && syncMutation.variables === link.id ? '…' : 'Szinkron'}
                  </button>
                  <button
                    type="button"
                    className={shared.dangerButton}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    disabled={deleteMutation.isPending && deleteMutation.variables === link.id}
                    onClick={() => {
                      if (confirm('Biztosan törlöd ezt a ClickUp linket?')) deleteMutation.mutate(link.id!)
                    }}
                  >
                    Törlés
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {addOpen && <AddClickUpLinkModal ticketId={ticketId} onClose={() => setAddOpen(false)} />}
    </>
  )
}

/* ── Add ClickUp link modal ────────────────────────────── */

function AddClickUpLinkModal({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [taskUrl, setTaskUrl] = useState('')
  const [taskId, setTaskId] = useState('')
  const [notes, setNotes] = useState('')

  const addMutation = useMutation({
    mutationFn: () =>
      ticketClient.addClickUpLink(ticketId, new CreateClickUpLinkRequest({
        clickUpTaskId: taskId,
        clickUpTaskUrl: taskUrl,
        notes: notes || undefined,
      })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-clickup', ticketId] })
      onClose()
    },
  })

  function handleUrlChange(value: string) {
    setTaskUrl(value)
    if (!taskId) setTaskId(extractClickUpTaskId(value))
  }

  return (
    <Modal title="ClickUp link hozzáadása" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate() }}>
        {addMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(addMutation.error, 'Nem sikerült hozzáadni a linket.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="cu-url">Task URL</label>
          <input
            id="cu-url"
            type="text"
            placeholder="https://app.clickup.com/t/..."
            value={taskUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            required
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="cu-id">Task ID</label>
          <input
            id="cu-id"
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            required
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="cu-notes">Megjegyzés</label>
          <textarea id="cu-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button
            type="submit"
            className={shared.primaryButton}
            disabled={addMutation.isPending || !taskUrl.trim() || !taskId.trim()}
          >
            {addMutation.isPending ? 'Mentés…' : 'Hozzáadás'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
