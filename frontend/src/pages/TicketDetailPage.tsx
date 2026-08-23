import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  meClient,
  ticketAttachmentsClient,
  ticketClient,
  MessageDirection,
  TicketDetailView,
  TicketListView,
  TicketSource,
  TicketStatus,
  UpdateTicketStatusRequest,
  UpdateUserPreferenceRequest,
} from '../api'
import { useCustomStatuses } from '../lib/customStatuses'
import { StatusBadge } from '../components/Badge/StatusBadge'
import { PriorityBadge } from '../components/Badge/PriorityBadge'
import badgeStyles from '../components/Badge/Badge.module.css'
import shared from '../components/Settings/SettingsShared.module.css'
import { formatDateTime, formatTicketId } from '../lib/format'
import { ReplyComposer } from './TicketDetail/ReplyComposer'
import { MessageThread } from './TicketDetail/MessageThread'
import { ActivityLogModal } from './TicketDetail/ActivityLogModal'
import { TicketInfoModal } from './TicketDetail/TicketInfoModal'
import { MergeModal } from './TicketDetail/MergeModal'
import { TicketSidebar } from './TicketDetail/TicketSidebar'
import styles from './TicketDetailPage.module.css'

function formatSlaDuration(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes)
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60
  if (days > 0) return hours > 0 ? `${days} nap ${hours} óra` : `${days} nap`
  if (hours > 0) return mins > 0 ? `${hours} óra és ${mins} perc` : `${hours} óra`
  return `${mins}p`
}

function useSlaCountdown(slaDueAt: Date | undefined): { text: string; variant: 'ok' | 'warning' | 'breach' } | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  if (!slaDueAt) return null
  const diffMs = slaDueAt.getTime() - now
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 0) return { text: `SLA lejárt ennyi ideje: ${formatSlaDuration(diffMins)}`, variant: 'breach' }
  if (diffMins < 60) return { text: `SLA: ${formatSlaDuration(diffMins)} van hátra`, variant: 'warning' }
  return { text: `SLA: ${formatSlaDuration(diffMins)} van hátra`, variant: 'ok' }
}

const SOURCE_LABELS: Record<TicketSource, string> = {
  [TicketSource.Email]: 'Email',
  [TicketSource.Portal]: 'Portál',
  [TicketSource.Manual]: 'Kézi',
  [TicketSource.Api]: 'API',
}

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
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [ticketInfoOpen, setTicketInfoOpen] = useState(false)

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
  const ticketAttachments = useMemo(() => attachmentsQuery.data ?? [], [attachmentsQuery.data])

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

  const closeMutation = useMutation({
    mutationFn: () =>
      ticketClient.updateStatus(ticketId, new UpdateTicketStatusRequest({ status: TicketStatus.Closed })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-activity', ticketId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => ticketClient.deleteTicket(ticketId),
    onSuccess: () => navigate('/tickets'),
  })

  const preferencesQuery = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => meClient.getPreferences(),
  })
  const detailView = preferencesQuery.data?.ticketDetailView ?? TicketDetailView.Classic
  const splitReversed = preferencesQuery.data?.ticketDetailSplitReversed ?? false

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

  const customStatusesQuery = useCustomStatuses()
  const customStatuses = customStatusesQuery.data ?? []

  const slaCountdown = useSlaCountdown(ticketQuery.data?.slaDueAt)

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

  function handleSend() {
    if (sendMessageMutation.isPending) return
    sendMessageMutation.mutate()
  }

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
      
      signature={signature}
      lastInboundBody={lastInboundBody}
      disabled={ticket.isMerged}
    />
  )

  return (
    <div className={styles.page}>
      <div className={`${styles.left} ${detailView === TicketDetailView.Split ? styles.leftSplit : ''}`}>
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
                disabled={closeMutation.isPending}
                onClick={() => {
                  if (confirm('Biztosan le szeretnéd zárni ezt a ticketet?')) closeMutation.mutate()
                }}
              >
                Lezárás
              </button>
            )}
            <button
              type="button"
              className={shared.dangerButton}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Biztosan törölni szeretnéd a(z) #${ticketId} jegyet? Ez a művelet nem vonható vissza.`)) deleteMutation.mutate()
              }}
            >
              Törlés
            </button>
            <button type="button" className={shared.secondaryButton} onClick={() => setActivityLogOpen(true)}>
              Napló
            </button>
            <button type="button" className={shared.secondaryButton} onClick={() => setTicketInfoOpen(true)}>
              Adatok
            </button>
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
          <StatusBadge status={ticket.status!} customStatusKey={ticket.customStatusKey} customStatuses={customStatuses} />
          <PriorityBadge priority={ticket.priority!} />
          {ticket.isCsmFlagged && (
            <span className={`${badgeStyles.badge} ${badgeStyles.purple}`}>CSM jelölt</span>
          )}
          {ticket.categoryName && <span className={styles.sourceTag}>{ticket.categoryName}</span>}
          <span className={styles.sourceTag}>{SOURCE_LABELS[ticket.source!]}</span>
          <span className={styles.metaMono}>
            {formatTicketId(ticket.id!)} · {formatDateTime(ticket.createdAt)} · {ticket.requesterEmail}
          </span>
          {slaCountdown && (
            <span
              className={`${styles.slaCountdown} ${styles[`slaCountdown_${slaCountdown.variant}`]}`}
              style={{ marginLeft: 'auto' }}
              title={ticket.slaDueAt ? `SLA határidő: ${ticket.slaDueAt.toLocaleString('hu-HU')}` : undefined}
            >
              {slaCountdown.text}
            </span>
          )}
        </div>

        {detailView === TicketDetailView.Classic ? (
          <>
            {composer}
            <MessageThread ticket={ticket} messages={messages} attachments={ticketAttachments} />
          </>
        ) : (
          <div className={`${styles.splitLayout} ${styles.splitLayoutActive}`}>
            {splitReversed ? (
              <>
                <div className={`${styles.splitPanel} ${styles.splitPanelComposer}`}>
                  {composer}
                </div>
                <div className={`${styles.splitPanel} ${styles.splitPanelThread}`}>
                  <MessageThread ticket={ticket} messages={messages} attachments={ticketAttachments} detailed />
                </div>
              </>
            ) : (
              <>
                <div className={`${styles.splitPanel} ${styles.splitPanelThread}`}>
                  <MessageThread ticket={ticket} messages={messages} attachments={ticketAttachments} detailed />
                </div>
                <div className={`${styles.splitPanel} ${styles.splitPanelComposer}`}>
                  {composer}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.right}>
        <TicketSidebar ticket={ticket} ticketId={ticketId} />
      </div>

      {mergeModalOpen && <MergeModal ticketId={ticketId} onClose={() => setMergeModalOpen(false)} />}
      {activityLogOpen && <ActivityLogModal ticketId={ticketId} onClose={() => setActivityLogOpen(false)} />}
      {ticketInfoOpen && <TicketInfoModal ticket={ticket} sourceLabel={SOURCE_LABELS[ticket.source!]} onClose={() => setTicketInfoOpen(false)} />}
    </div>
  )
}
