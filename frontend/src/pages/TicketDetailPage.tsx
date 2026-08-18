import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ticketClient,
  usersClient,
  AssignTicketRequest,
  CreateTicketMessageRequest,
  MessageDirection,
  TicketSource,
  TicketStatus,
  UpdateTicketStatusRequest,
} from '../api'
import { StatusBadge } from '../components/Badge/StatusBadge'
import { PriorityBadge } from '../components/Badge/PriorityBadge'
import { formatDateTime, formatTicketId } from '../lib/format'
import styles from './TicketDetailPage.module.css'

const SOURCE_LABELS: Record<TicketSource, string> = {
  [TicketSource.Email]: 'Email',
  [TicketSource.Portal]: 'Portál',
  [TicketSource.Manual]: 'Kézi',
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: TicketStatus.New, label: 'Új' },
  { value: TicketStatus.Open, label: 'Nyitott' },
  { value: TicketStatus.Pending, label: 'Függőben' },
  { value: TicketStatus.Resolved, label: 'Megoldva' },
  { value: TicketStatus.Closed, label: 'Lezárva' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]]
  return initials.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [replyBody, setReplyBody] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)

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

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersClient.getUsers(),
  })

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      ticketClient.addMessage(ticketId, new CreateTicketMessageRequest({ body: replyBody, isInternalNote })),
    onSuccess: () => {
      setReplyBody('')
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      ticketClient.updateStatus(ticketId, new UpdateTicketStatusRequest({ status })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
  })

  const assignMutation = useMutation({
    mutationFn: (assignedToId: number | undefined) =>
      ticketClient.assignTicket(ticketId, new AssignTicketRequest({ assignedToId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
  })

  const csmMutation = useMutation({
    mutationFn: () => ticketClient.toggleCsm(ticketId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
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
    if (!replyBody.trim() || sendMessageMutation.isPending) return
    sendMessageMutation.mutate()
  }

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <button className={styles.backLink} onClick={() => navigate('/tickets')}>
          ← Vissza a jegyekhez
        </button>

        <h1 className={styles.title}>{ticket.subject}</h1>

        <div className={styles.metaRow}>
          <StatusBadge status={ticket.status!} />
          <PriorityBadge priority={ticket.priority!} />
          {ticket.categoryName && <span className={styles.sourceTag}>{ticket.categoryName}</span>}
          <span className={styles.sourceTag}>{SOURCE_LABELS[ticket.source!]}</span>
          <span className={styles.metaMono}>
            {formatTicketId(ticket.id!)} · {formatDateTime(ticket.createdAt)} · {ticket.requesterEmail}
          </span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardHeaderTitle}>Beszélgetés</span>
            <span className={styles.cardHeaderCount}>{messages.length} üzenet</span>
          </div>
          <div className={styles.thread}>
            {messages.length === 0 && (
              <div className={styles.emptyThread}>Még nincs üzenet ebben a jegyben.</div>
            )}
            {messages.map((msg) => {
              const isOutbound = msg.direction === MessageDirection.Outbound
              const author = isOutbound ? (msg.senderUserName ?? 'Ügyintéző') : ticket.requesterName!
              return (
                <div key={msg.id} className={`${styles.messageRow} ${isOutbound ? styles.outbound : styles.inbound}`}>
                  <div className={styles.messageMeta}>
                    <div className={styles.avatarSm}>{getInitials(author)}</div>
                    <span className={styles.authorName}>{author}</span>
                    <span className={styles.timeMono}>{formatDateTime(msg.createdAt)}</span>
                    {msg.isInternalNote && <span className={styles.internalTag}>Belső</span>}
                  </div>
                  <div className={styles.bubble}>{msg.body}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.composerTabs}>
            <button
              className={`${styles.tab} ${!isInternalNote ? styles.tabActive : ''}`}
              onClick={() => setIsInternalNote(false)}
            >
              Válasz
            </button>
            <button
              className={`${styles.tab} ${isInternalNote ? styles.tabActive : ''}`}
              onClick={() => setIsInternalNote(true)}
            >
              Belső jegyzet
            </button>
          </div>
          <textarea
            className={styles.textarea}
            placeholder={`Válasz írása ${ticket.requesterEmail} részére…`}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <div className={styles.composerFooter}>
            <button
              className={styles.sendButton}
              disabled={!replyBody.trim() || sendMessageMutation.isPending}
              onClick={handleSend}
            >
              Küldés →
            </button>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.card}>
          <div className={styles.panelHeader}>Tulajdonságok</div>
          <div className={styles.panelBody}>
            <div className={styles.field}>
              <label>Felelős</label>
              <select
                value={ticket.assignedToId ?? ''}
                onChange={(e) =>
                  assignMutation.mutate(e.target.value ? Number(e.target.value) : undefined)
                }
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
                value={ticket.status}
                onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>CSM jelölés</div>
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
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.panelHeader}>ClickUp feladatok</div>
          <div className={styles.emptyState}>Nincs összekapcsolt ClickUp feladat.</div>
        </div>

        <div className={styles.card}>
          <div className={styles.panelHeader}>Egyéni mezők</div>
          <div className={styles.emptyState}>Nincsenek egyéni mezők definiálva.</div>
        </div>
      </div>
    </div>
  )
}
