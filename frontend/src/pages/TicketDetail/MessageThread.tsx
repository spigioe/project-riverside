import { useState } from 'react'
import { MessageDirection, TicketDetailDto, TicketMessageDto } from '../../api'
import { SafeHtml } from '../../components/SafeHtml/SafeHtml'
import { formatDateTime } from '../../lib/format'
import styles from '../TicketDetailPage.module.css'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]]
  return initials.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

interface MessageThreadProps {
  ticket: TicketDetailDto
  messages: TicketMessageDto[]
  detailed?: boolean
}

export function MessageThread({ ticket, messages, detailed = false }: MessageThreadProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardHeaderTitle}>Beszélgetés</span>
        <span className={styles.cardHeaderCount}>{messages.length} üzenet</span>
      </div>
      <div className={styles.thread}>
        {messages.length === 0 && (
          <div className={styles.emptyThread}>Még nincs üzenet ebben a jegyben.</div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} ticket={ticket} msg={msg} detailed={detailed} />
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ ticket, msg, detailed }: { ticket: TicketDetailDto; msg: TicketMessageDto; detailed: boolean }) {
  const isOutbound = msg.direction === MessageDirection.Outbound
  const author = isOutbound ? (msg.senderUserName ?? 'Ügyintéző') : (ticket.requesterName ?? msg.senderEmail ?? 'Ismeretlen')
  const authorEmail = isOutbound ? undefined : (msg.senderEmail ?? ticket.requesterEmail)
  const hasCcBcc = Boolean(msg.cc || msg.bcc)
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <div className={`${styles.messageRow} ${isOutbound ? styles.outbound : styles.inbound}`}>
      <div className={styles.messageMeta}>
        <div className={styles.avatarSm}>{getInitials(author)}</div>
        {detailed && (
          <span className={styles.directionIcon} title={isOutbound ? 'Kimenő' : 'Bejövő'}>
            {isOutbound ? '↑' : '↓'}
          </span>
        )}
        <span className={styles.authorName}>{author}</span>
        {detailed && authorEmail && <span className={styles.authorEmail}>{authorEmail}</span>}
        <span className={styles.timeMono}>{formatDateTime(msg.createdAt)}</span>
        {msg.isInternalNote && <span className={styles.internalTag}>Belső</span>}
      </div>
      {detailed && (isOutbound || hasCcBcc) && (
        <div className={styles.headerLine}>
          {isOutbound && <span>Címzett: {ticket.requesterEmail}</span>}
          {hasCcBcc && (
            <button type="button" className={styles.detailsToggle} onClick={() => setDetailsOpen((o) => !o)}>
              {detailsOpen ? 'Részletek elrejtése' : 'Részletek (CC/BCC)'}
            </button>
          )}
        </div>
      )}
      {detailed && detailsOpen && hasCcBcc && (
        <div className={styles.headerDetails}>
          {msg.cc && <div>CC: {msg.cc}</div>}
          {msg.bcc && <div>BCC: {msg.bcc}</div>}
        </div>
      )}
      <SafeHtml html={msg.body ?? ''} className={styles.bubble} />
    </div>
  )
}
