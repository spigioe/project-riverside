import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  csmClient,
  meClient,
  ticketAiClient,
  ticketAttachmentsClient,
  ticketClient,
  ticketCustomFieldsClient,
  usersClient,
  AiClassifyResponse,
  AssignTicketRequest,
  ClickUpLinkDto,
  CreateClickUpLinkRequest,
  CsmAssignRequest,
  CustomFieldType,
  CustomFieldValueDto,
  MessageDirection,
  TicketDetailDto,
  TicketDetailView,
  TicketListView,
  TicketSource,
  TicketStatus,
  UpdateCustomFieldValueItem,
  UpdateTicketRequest,
  UpdateTicketStatusRequest,
  UpdateUserPreferenceRequest,
} from '../api'
import { Modal } from '../components/Modal/Modal'
import { StatusBadge } from '../components/Badge/StatusBadge'
import { PriorityBadge } from '../components/Badge/PriorityBadge'
import badgeStyles from '../components/Badge/Badge.module.css'
import shared from '../components/Settings/SettingsShared.module.css'
import { getErrorMessage } from '../lib/errors'
import { formatDateTime, formatTicketId } from '../lib/format'
import { plainTextToHtml } from '../lib/htmlText'
import { ReplyComposer } from './TicketDetail/ReplyComposer'
import { MessageThread } from './TicketDetail/MessageThread'
import { TicketInfoPanel } from './TicketDetail/TicketInfoPanel'
import { TicketActivityLog } from './TicketDetail/TicketActivityLog'
import { MergeModal } from './TicketDetail/MergeModal'
import { RelatedTicketsSection } from './TicketDetail/RelatedTicketsSection'
import styles from './TicketDetailPage.module.css'

function extractClickUpTaskId(url: string): string {
  const match = url.match(/\/t\/([a-zA-Z0-9]+)/)
  if (match) return match[1]
  const segments = url.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

function clickUpStatusVariant(status: string | undefined): string {
  if (!status) return badgeStyles.gray
  const s = status.toLowerCase()
  if (s.includes('progress')) return badgeStyles.primary
  if (s.includes('complete') || s.includes('done') || s.includes('closed')) return badgeStyles.green
  if (s.includes('block')) return badgeStyles.red
  return badgeStyles.gray
}

const SOURCE_LABELS: Record<TicketSource, string> = {
  [TicketSource.Email]: 'Email',
  [TicketSource.Portal]: 'Portál',
  [TicketSource.Manual]: 'Kézi',
  [TicketSource.Api]: 'API',
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: TicketStatus.New, label: 'Új' },
  { value: TicketStatus.Open, label: 'Nyitott' },
  { value: TicketStatus.Pending, label: 'Függőben' },
  { value: TicketStatus.Resolved, label: 'Megoldva' },
  { value: TicketStatus.Closed, label: 'Lezárva' },
]

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [replyBody, setReplyBody] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [mergeModalOpen, setMergeModalOpen] = useState(false)

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketClient.getTicket(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const messagesQuery = useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: () => ticketClient.getMessages(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const attachmentsQuery = useQuery({
    queryKey: ['ticket-attachments', ticketId],
    queryFn: () => ticketAttachmentsClient.getAttachments(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersClient.getUsers(),
  })

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      ticketClient.addMessage(
        ticketId,
        replyBody,
        isInternalNote,
        cc.trim() || undefined,
        bcc.trim() || undefined,
        attachments.length > 0 ? attachments.map((f) => ({ data: f, fileName: f.name })) : undefined,
      ),
    onSuccess: () => {
      setReplyBody('')
      setCc('')
      setBcc('')
      setAttachments([])
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      ticketClient.updateStatus(ticketId, new UpdateTicketStatusRequest({ status })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: (assignedToId: number | undefined) =>
      ticketClient.assignTicket(ticketId, new AssignTicketRequest({ assignedToId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const csmMutation = useMutation({
    mutationFn: () => ticketClient.toggleCsm(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const csmListQuery = useQuery({
    queryKey: ['settings-csm'],
    queryFn: () => csmClient.getAll(),
  })

  const csmAssignMutation = useMutation({
    mutationFn: (csmId: number | undefined) => ticketClient.assignCsm(ticketId, new CsmAssignRequest({ csmId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const customFieldsQuery = useQuery({
    queryKey: ['ticket-custom-fields', ticketId],
    queryFn: () => ticketCustomFieldsClient.getValues(ticketId),
    enabled: Number.isFinite(ticketId),
  })

  const customFieldMutation = useMutation({
    mutationFn: (item: UpdateCustomFieldValueItem) => ticketCustomFieldsClient.updateValues(ticketId, [item]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-custom-fields', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  // "Ticket tulajdonságok automatikus mentése" preferencia: ha ki van kapcsolva, a Felelős/Státusz
  // mezők nem mentenek azonnal onChange-kor, hanem helyi draft állapotba kerülnek, és csak a
  // "Mentés" gombra kattintva íródnak ki (két külön hívással, csak azt ami valóban változott).
  const preferencesQuery = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => meClient.getPreferences(),
  })
  const autosave = preferencesQuery.data?.ticketPropertiesAutosave ?? true
  const detailView = preferencesQuery.data?.ticketDetailView ?? TicketDetailView.Classic
  const splitReversed = preferencesQuery.data?.ticketDetailSplitReversed ?? false

  // Nézet váltó / csere gomb: a teljes preferencia objektumot küldi vissza (a PUT replace-all), a nem
  // érintett mezőket a jelenlegi (lekérdezett) értékről veszi.
  const detailViewMutation = useMutation({
    mutationFn: (next: { ticketDetailView?: TicketDetailView; ticketDetailSplitReversed?: boolean }) =>
      meClient.updatePreferences(new UpdateUserPreferenceRequest({
        ticketPropertiesAutosave: preferencesQuery.data?.ticketPropertiesAutosave ?? true,
        ticketListView: preferencesQuery.data?.ticketListView ?? TicketListView.Table,
        ticketDetailView: next.ticketDetailView ?? detailView,
        ticketDetailSplitReversed: next.ticketDetailSplitReversed ?? splitReversed,
      })),
    onSuccess: (result) => queryClient.setQueryData(['user-preferences'], result),
  })

  const [draftAssignedToId, setDraftAssignedToId] = useState<number | undefined>(undefined)
  const [draftStatus, setDraftStatus] = useState<TicketStatus | undefined>(undefined)
  const [draftCsmId, setDraftCsmId] = useState<number | undefined>(undefined)
  const [propertiesDirty, setPropertiesDirty] = useState(false)

  useEffect(() => {
    if (ticketQuery.data) {
      setDraftAssignedToId(ticketQuery.data.assignedToId)
      setDraftStatus(ticketQuery.data.status)
      setDraftCsmId(ticketQuery.data.csmId)
      setPropertiesDirty(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketQuery.data?.id])

  // Az egyéni mező értékek mindig ebben a local state-ben élnek (autosave alatt is) — így gépelés
  // közben nem "ugrik vissza" az input a debounce-olt mentés lezárultáig tartó szerver-válaszra várva.
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

  const savePropertiesMutation = useMutation({
    mutationFn: async () => {
      const tasks: Promise<unknown>[] = []
      if (draftAssignedToId !== ticketQuery.data?.assignedToId) {
        tasks.push(ticketClient.assignTicket(ticketId, new AssignTicketRequest({ assignedToId: draftAssignedToId })))
      }
      if (draftStatus !== ticketQuery.data?.status) {
        tasks.push(ticketClient.updateStatus(ticketId, new UpdateTicketStatusRequest({ status: draftStatus! })))
      }
      if (draftCsmId !== ticketQuery.data?.csmId) {
        tasks.push(ticketClient.assignCsm(ticketId, new CsmAssignRequest({ csmId: draftCsmId })))
      }
      const changedCustomFields = (customFieldsQuery.data ?? [])
        .filter((f) => (customFieldValues[f.definitionId!] ?? '') !== (f.value ?? ''))
        .map((f) => new UpdateCustomFieldValueItem({ definitionId: f.definitionId, value: customFieldValues[f.definitionId!] }))
      if (changedCustomFields.length > 0) {
        tasks.push(ticketCustomFieldsClient.updateValues(ticketId, changedCustomFields))
      }
      await Promise.all(tasks)
    },
    onSuccess: () => {
      setPropertiesDirty(false)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-custom-fields', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  if (ticketQuery.isLoading) {
    return <div className={styles.page}><div className={styles.left}>Betöltés…</div></div>
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <div className={styles.page}>
        <div className={styles.left}>
          <button className={styles.backLink} onClick={() => navigate('/tickets')}>← Vissza a jegyekhez</button>
          <p>A jegy nem található.</p>
        </div>
      </div>
    )
  }

  const ticket = ticketQuery.data
  const messages = messagesQuery.data ?? []
  const users = usersQuery.data ?? []

  function handleSend() {
    if (sendMessageMutation.isPending) return
    sendMessageMutation.mutate()
  }

  const customFields = customFieldsQuery.data ?? []

  // undefined amíg az adott lekérdezés még tölt — a ReplyComposer csak akkor szúrja be az
  // aláírást/idézetet mount-kor, ha mindkettő eldőlt (lásd ReplyComposer effect).
  const signature = preferencesQuery.data ? (preferencesQuery.data.emailSignature ?? '') : undefined
  const lastInboundMessage = [...messages].reverse().find((m) => m.direction === MessageDirection.Inbound)
  const lastInboundBody = messagesQuery.isLoading ? undefined : (lastInboundMessage?.body ?? null)

  const composer = (
    <ReplyComposer
      ticketSubject={ticket.subject ?? ''}
      requesterEmail={ticket.requesterEmail!}
      body={replyBody}
      onBodyChange={setReplyBody}
      cc={cc}
      onCcChange={setCc}
      bcc={bcc}
      onBccChange={setBcc}
      isInternalNote={isInternalNote}
      onInternalNoteChange={setIsInternalNote}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      onSend={handleSend}
      sending={sendMessageMutation.isPending}
      editorMinHeight={detailView === TicketDetailView.Split ? 300 : undefined}
      signature={signature}
      lastInboundBody={lastInboundBody}
      disabled={ticket.isMerged}
    />
  )

  const infoPanel = (collapsible: boolean) => (
    <TicketInfoPanel
      ticket={ticket}
      customFields={customFields}
      sourceLabel={SOURCE_LABELS[ticket.source!]}
      collapsible={collapsible}
    />
  )

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <button className={styles.backLink} onClick={() => navigate('/tickets')}>
          ← Vissza a jegyekhez
        </button>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>{ticket.subject}</h1>
          <div className={styles.viewToggleRow}>
            {!ticket.isMerged && (
              <button
                type="button"
                className={shared.secondaryButton}
                onClick={() => setMergeModalOpen(true)}
              >
                Összevonás
              </button>
            )}
            {ticket.status !== TicketStatus.Closed && ticket.status !== TicketStatus.Resolved && (
              <button
                type="button"
                className={shared.secondaryButton}
                disabled={statusMutation.isPending}
                onClick={() => {
                  if (confirm('Biztosan le szeretnéd zárni ezt a ticketet?')) statusMutation.mutate(TicketStatus.Closed)
                }}
              >
                Lezárás
              </button>
            )}
            {detailView === TicketDetailView.Split && (
              <button
                type="button"
                className={styles.swapButton}
                onClick={() => detailViewMutation.mutate({ ticketDetailSplitReversed: !splitReversed })}
                title="Panelek felcserélése"
              >
                ⇄ Csere
              </button>
            )}
            <button
              type="button"
              className={`${styles.viewToggleButton} ${detailView === TicketDetailView.Classic ? styles.viewToggleButtonActive : ''}`}
              onClick={() => detailViewMutation.mutate({ ticketDetailView: TicketDetailView.Classic })}
            >
              Classic
            </button>
            <button
              type="button"
              className={`${styles.viewToggleButton} ${detailView === TicketDetailView.Split ? styles.viewToggleButtonActive : ''}`}
              onClick={() => detailViewMutation.mutate({ ticketDetailView: TicketDetailView.Split })}
            >
              Split
            </button>
          </div>
        </div>

        {ticket.isMerged && ticket.mergedIntoTicketId && (
          <div className={styles.mergedBanner}>
            ⚠ Ez a jegy összevonásra került a(z) #{ticket.mergedIntoTicketId} jeggyel.
            <Link to={`/tickets/${ticket.mergedIntoTicketId}`} className={styles.mergedBannerLink}>
              → Megnyitás
            </Link>
          </div>
        )}

        <div className={styles.metaRow}>
          {ticket.isMerged && ticket.mergedIntoTicketId && (
            <Link
              to={`/tickets/${ticket.mergedIntoTicketId}`}
              className={`${badgeStyles.badge} ${badgeStyles.dark} ${styles.mergedBadge}`}
            >
              ÖSSZEVONVA → #{ticket.mergedIntoTicketId}
            </Link>
          )}
          <StatusBadge status={ticket.status!} />
          <PriorityBadge priority={ticket.priority!} />
          {ticket.isCsmFlagged && (
            <span className={`${badgeStyles.badge} ${badgeStyles.purple}`}>CSM jelölt</span>
          )}
          {ticket.categoryName && <span className={styles.sourceTag}>{ticket.categoryName}</span>}
          <span className={styles.sourceTag}>{SOURCE_LABELS[ticket.source!]}</span>
          <span className={styles.metaMono}>
            {formatTicketId(ticket.id!)} · {formatDateTime(ticket.createdAt)} · {ticket.requesterEmail}
          </span>
        </div>

        {detailView === TicketDetailView.Classic ? (
          <>
            {composer}
            <MessageThread ticket={ticket} messages={messages} attachments={attachmentsQuery.data ?? []} />
            <TicketActivityLog ticketId={ticketId} />
          </>
        ) : (
          <div className={styles.splitLayout}>
            {splitReversed ? (
              <>
                <div className={styles.splitPanel}>
                  {composer}
                  <div className={styles.splitInfoPanel}>{infoPanel(false)}</div>
                </div>
                <div className={styles.splitPanel}>
                  <MessageThread ticket={ticket} messages={messages} attachments={attachmentsQuery.data ?? []} detailed />
                  <TicketActivityLog ticketId={ticketId} />
                </div>
              </>
            ) : (
              <>
                <div className={styles.splitPanel}>
                  <MessageThread ticket={ticket} messages={messages} attachments={attachmentsQuery.data ?? []} detailed />
                  <TicketActivityLog ticketId={ticketId} />
                </div>
                <div className={styles.splitPanel}>
                  {composer}
                  <div className={styles.splitInfoPanel}>{infoPanel(false)}</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.right}>
        {detailView === TicketDetailView.Classic && infoPanel(true)}

        <div className={styles.card}>
          <div className={styles.panelHeader}>Tulajdonságok</div>
          <div className={styles.panelBody}>
            <div className={styles.field}>
              <label>Felelős</label>
              <select
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
            <div className={styles.field}>
              <label>Státusz</label>
              <select
                value={autosave ? ticket.status : draftStatus}
                onChange={(e) => {
                  const value = e.target.value as TicketStatus
                  if (autosave) statusMutation.mutate(value)
                  else { setDraftStatus(value); setPropertiesDirty(true) }
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {!autosave && (
              <div className={shared.formActions} style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className={shared.primaryButton}
                  disabled={!propertiesDirty || savePropertiesMutation.isPending}
                  onClick={() => savePropertiesMutation.mutate()}
                >
                  {savePropertiesMutation.isPending ? 'Mentés…' : 'Mentés'}
                </button>
              </div>
            )}
            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>
                  CSM jelölés
                  {ticket.isCsmFlagged && (
                    <span className={`${badgeStyles.badge} ${badgeStyles.purple}`}>Aktív</span>
                  )}
                </div>
                <div className={styles.toggleSub}>Eszkalálás CSM felé</div>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${ticket.isCsmFlagged ? styles.toggleOn : ''}`}
                onClick={() => csmMutation.mutate()}
                aria-pressed={ticket.isCsmFlagged}
                aria-label="CSM jelölés váltása"
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
            <div className={styles.field}>
              <label>CSM felelős</label>
              <select
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
        </div>

        <div className={styles.card}>
          <div className={styles.panelHeader}>Egyéni mezők</div>
          <div className={styles.panelBody}>
            {customFieldsQuery.isLoading && <div className={styles.emptyState}>Betöltés…</div>}
            {!customFieldsQuery.isLoading && (customFieldsQuery.data ?? []).length === 0 && (
              <div className={styles.emptyState}>Nincsenek egyéni mezők definiálva.</div>
            )}
            {(customFieldsQuery.data ?? []).map((field) => (
              <CustomFieldField
                key={field.definitionId}
                field={field}
                value={customFieldValues[field.definitionId!]}
                onChange={(value) => handleCustomFieldChange(field.definitionId!, value)}
              />
            ))}
            {!autosave && (customFieldsQuery.data ?? []).length > 0 && (
              <div className={shared.formActions} style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className={shared.primaryButton}
                  disabled={!propertiesDirty || savePropertiesMutation.isPending}
                  onClick={() => savePropertiesMutation.mutate()}
                >
                  {savePropertiesMutation.isPending ? 'Mentés…' : 'Mentés'}
                </button>
              </div>
            )}
          </div>
        </div>

        <AiSection ticket={ticket} onSuggestedReply={(body) => { setReplyBody(plainTextToHtml(body)); setIsInternalNote(false) }} />

        <ClickUpSection ticketId={ticketId} />

        <RelatedTicketsSection ticketId={ticketId} />
      </div>

      {mergeModalOpen && <MergeModal ticketId={ticketId} onClose={() => setMergeModalOpen(false)} />}
    </div>
  )
}

function CustomFieldField({
  field, value, onChange,
}: { field: CustomFieldValueDto; value: string | undefined; onChange: (value: string | undefined) => void }) {
  if (field.fieldType === CustomFieldType.Boolean) {
    const checked = value === 'true'
    return (
      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>{field.name}</div>
        <button
          type="button"
          className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
          onClick={() => onChange(checked ? 'false' : 'true')}
          aria-pressed={checked}
          aria-label={field.name}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
    )
  }

  if (field.fieldType === CustomFieldType.Select) {
    return (
      <div className={styles.field}>
        <label>{field.name}</label>
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— válassz —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={styles.field}>
      <label>{field.name}</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </div>
  )
}

function AiSection({
  ticket, onSuggestedReply,
}: { ticket: TicketDetailDto; onSuggestedReply: (body: string) => void }) {
  const queryClient = useQueryClient()
  const ticketId = ticket.id!
  const [summary, setSummary] = useState<string | null>(null)
  const [classification, setClassification] = useState<AiClassifyResponse | null>(null)

  const summarizeMutation = useMutation({
    mutationFn: () => ticketAiClient.summarize(ticketId),
    onSuccess: (result) => setSummary(result.summary ?? null),
  })

  const suggestReplyMutation = useMutation({
    mutationFn: () => ticketAiClient.suggestReply(ticketId),
    onSuccess: (result) => {
      if (result.suggestedReply) onSuggestedReply(result.suggestedReply)
    },
  })

  const classifyMutation = useMutation({
    mutationFn: () => ticketAiClient.classify(ticketId),
    onSuccess: (result) => setClassification(result),
  })

  const applyClassificationMutation = useMutation({
    mutationFn: () =>
      ticketClient.updateTicket(ticketId, new UpdateTicketRequest({
        subject: ticket.subject,
        body: ticket.body,
        priority: classification!.suggestedPriority,
        categoryId: classification?.suggestedCategoryId ?? undefined,
        requesterEmail: ticket.requesterEmail,
        requesterName: ticket.requesterName,
      })),
    onSuccess: () => {
      setClassification(null)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
  })

  function errorText(error: unknown) {
    return getErrorMessage(error, 'Az AI szolgáltatás jelenleg nem érhető el.')
  }

  return (
    <div className={styles.card}>
      <div className={styles.panelHeader}>AI asszisztens</div>
      <div className={styles.aiPanelBody}>
        <div className={styles.aiButtonRow}>
          <button
            type="button"
            className={styles.aiButton}
            disabled={summarizeMutation.isPending}
            onClick={() => summarizeMutation.mutate()}
          >
            {summarizeMutation.isPending ? 'Összefoglalás…' : 'Összefoglaló'}
          </button>
          <button
            type="button"
            className={styles.aiButton}
            disabled={suggestReplyMutation.isPending}
            onClick={() => suggestReplyMutation.mutate()}
          >
            {suggestReplyMutation.isPending ? 'Javaslat…' : 'Válasz javaslat'}
          </button>
          <button
            type="button"
            className={styles.aiButton}
            disabled={classifyMutation.isPending}
            onClick={() => classifyMutation.mutate()}
          >
            {classifyMutation.isPending ? 'Kategorizálás…' : 'Kategorizálás'}
          </button>
        </div>

        {summarizeMutation.isError && <div className={styles.aiError}>{errorText(summarizeMutation.error)}</div>}
        {summary && <div className={styles.aiResult}>{summary}</div>}

        {suggestReplyMutation.isError && <div className={styles.aiError}>{errorText(suggestReplyMutation.error)}</div>}
        {suggestReplyMutation.isSuccess && (
          <div className={styles.aiResult}>A válasz javaslat betöltve a válasz szövegdobozba — szerkesztheted küldés előtt.</div>
        )}

        {classifyMutation.isError && <div className={styles.aiError}>{errorText(classifyMutation.error)}</div>}
        {classification && (
          <div className={styles.aiResult}>
            <div className={styles.aiClassificationRow}>
              <span>Javasolt kategória:</span>
              <strong>{classification.suggestedCategoryName ?? 'nincs javaslat'}</strong>
            </div>
            <div className={styles.aiClassificationRow}>
              <span>Javasolt prioritás:</span>
              <PriorityBadge priority={classification.suggestedPriority!} />
            </div>
            <div className={styles.clickUpActions}>
              <button
                type="button"
                className={shared.primaryButton}
                disabled={applyClassificationMutation.isPending}
                onClick={() => applyClassificationMutation.mutate()}
              >
                {applyClassificationMutation.isPending ? 'Alkalmazás…' : 'Elfogadás'}
              </button>
              <button type="button" className={shared.secondaryButton} onClick={() => setClassification(null)}>
                Elvetés
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
    <div className={styles.card}>
      <div className={styles.panelHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>ClickUp feladatok</span>
        <button type="button" className={shared.linkButton} style={{ padding: 0 }} onClick={() => setAddOpen(true)}>
          + Link hozzáadása
        </button>
      </div>

      {links.length === 0 && <div className={styles.emptyState}>Nincs összekapcsolt ClickUp feladat.</div>}

      {links.length > 0 && (
        <div className={styles.clickUpList}>
          {links.map((link: ClickUpLinkDto) => (
            <div key={link.id} className={styles.clickUpItem}>
              <div className={styles.clickUpItemHeader}>
                <a href={link.clickUpTaskUrl} target="_blank" rel="noreferrer" className={styles.clickUpTaskLink}>
                  {link.clickUpTaskTitle ?? link.clickUpTaskId}
                </a>
                <span className={`${badgeStyles.badge} ${clickUpStatusVariant(link.clickUpStatus)}`}>
                  {link.clickUpStatus ?? 'nincs szinkronizálva'}
                </span>
              </div>
              <div className={styles.clickUpMeta}>
                {link.statusSyncedAt ? `Utoljára szinkronizálva: ${formatDateTime(link.statusSyncedAt)}` : 'Még nem szinkronizált'}
              </div>
              {link.notes && <div className={styles.clickUpMeta}>{link.notes}</div>}
              <div className={styles.clickUpActions}>
                <button
                  type="button"
                  className={shared.secondaryButton}
                  disabled={syncMutation.isPending && syncMutation.variables === link.id}
                  onClick={() => syncMutation.mutate(link.id!)}
                >
                  {syncMutation.isPending && syncMutation.variables === link.id ? 'Szinkronizálás…' : 'Szinkronizálás'}
                </button>
                <button
                  type="button"
                  className={shared.dangerButton}
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

      {addOpen && <AddClickUpLinkModal ticketId={ticketId} onClose={() => setAddOpen(false)} />}
    </div>
  )
}

function AddClickUpLinkModal({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [taskUrl, setTaskUrl] = useState('')
  const [taskId, setTaskId] = useState('')
  const [notes, setNotes] = useState('')

  const addMutation = useMutation({
    mutationFn: () =>
      ticketClient.addClickUpLink(
        ticketId,
        new CreateClickUpLinkRequest({
          clickUpTaskId: taskId,
          clickUpTaskUrl: taskUrl,
          notes: notes || undefined,
        }),
      ),
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
          <label htmlFor="clickup-url">Task URL</label>
          <input
            id="clickup-url"
            type="text"
            placeholder="https://app.clickup.com/t/..."
            value={taskUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            required
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="clickup-task-id">Task ID</label>
          <input
            id="clickup-task-id"
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            required
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="clickup-notes">Megjegyzés</label>
          <textarea id="clickup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={addMutation.isPending || !taskUrl.trim() || !taskId.trim()}>
            {addMutation.isPending ? 'Mentés…' : 'Hozzáadás'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
