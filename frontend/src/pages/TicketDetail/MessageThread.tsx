import { useEffect, useState } from 'react'
import { AttachmentDto, MessageDirection, TicketDetailDto, TicketMessageDto, ticketAttachmentsClient } from '../../api'
import { SafeHtml } from '../../components/SafeHtml/SafeHtml'
import { formatDateTime, formatFileSize } from '../../lib/format'
import styles from '../TicketDetailPage.module.css'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]]
  return initials.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function attachmentIcon(mimeType: string | undefined): string {
  if (!mimeType) return '📎'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('zip')) return '📦'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (mimeType === 'text/plain') return '📃'
  return '📎'
}

async function triggerDownload(attachment: AttachmentDto) {
  const result = await ticketAttachmentsClient.download(attachment.id!)
  const url = URL.createObjectURL(result.data)
  const link = document.createElement('a')
  link.href = url
  link.download = result.fileName ?? attachment.originalFilename ?? 'file'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

interface MessageThreadProps {
  ticket: TicketDetailDto
  messages: TicketMessageDto[]
  attachments: AttachmentDto[]
  detailed?: boolean
}

export function MessageThread({ ticket, messages, attachments, detailed = false }: MessageThreadProps) {
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
        {messages.map((msg, idx) => (
          <div key={msg.id}>
            {msg.sourceTicketId != null && messages[idx - 1]?.sourceTicketId !== msg.sourceTicketId && (
              <div className={styles.mergeSeparator}>Beolvasztva a(z) #{msg.sourceTicketId} jegyből</div>
            )}
            <MessageBubble
              ticket={ticket}
              msg={msg}
              attachments={attachments.filter((a) => a.messageId === msg.id)}
              detailed={detailed}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  ticket, msg, attachments, detailed,
}: { ticket: TicketDetailDto; msg: TicketMessageDto; attachments: AttachmentDto[]; detailed: boolean }) {
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
      {attachments.length > 0 && (
        <div className={styles.attachmentList}>
          {attachments.map((a) => <AttachmentItem key={a.id} attachment={a} />)}
        </div>
      )}
    </div>
  )
}

function AttachmentItem({ attachment }: { attachment: AttachmentDto }) {
  const isImage = (attachment.mimeType ?? '').startsWith('image/')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    let objectUrl: string | null = null
    let cancelled = false

    ticketAttachmentsClient.download(attachment.id!).then((result) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(result.data)
      setThumbnailUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id, isImage])

  return (
    <button type="button" className={styles.attachmentItem} onClick={() => triggerDownload(attachment)}>
      {isImage && thumbnailUrl ? (
        <img src={thumbnailUrl} alt={attachment.originalFilename} className={styles.attachmentThumbnail} />
      ) : (
        <span className={styles.attachmentItemIcon}>{attachmentIcon(attachment.mimeType)}</span>
      )}
      <span className={styles.attachmentItemName}>{attachment.originalFilename}</span>
      <span className={styles.attachmentItemSize}>{formatFileSize(attachment.fileSize)}</span>
    </button>
  )
}
