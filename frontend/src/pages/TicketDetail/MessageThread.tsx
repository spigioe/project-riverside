import { Fragment, useEffect, useMemo, useState } from 'react'
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

// Idézett tartalom elválasztása az aktuálistól.
// Sorrendben ellenőrzött minták: <blockquote>, "---" elválasztó, "On ... wrote:" sor.
function splitQuotedContent(html: string): { main: string; quoted: string | null } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  // 1. Ha van <blockquote> elem a gyökérben (vagy a gyökér első szintjén)
  const blockquote = body.querySelector('blockquote')
  if (blockquote) {
    // Az összes blockquote-ot és az előttük lévő szeparátort (tipikusan <p>---</p> v. <br>) is kiemeljük
    const quotedNodes: Node[] = []
    let node: Node | null = blockquote
    // Gyűjtsük össze a blockquote-ot és az összes utána következő testvér-csomópontot
    while (node) {
      quotedNodes.push(node)
      node = node.nextSibling
    }
    // Ha van egy közvetlenül megelőző üres/elválasztó szövegcsomópont, azt is idesoroljuk
    const prevSibling = blockquote.previousSibling
    if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && (prevSibling.textContent ?? '').trim() === '') {
      quotedNodes.unshift(prevSibling)
    }

    const quotedDiv = doc.createElement('div')
    quotedNodes.forEach((n) => quotedDiv.appendChild(n.cloneNode(true)))

    // Töröljük az eredeti dokumentumból a quoted részeket
    quotedNodes.forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n) })

    const mainHtml = body.innerHTML.trim()
    const quotedHtml = quotedDiv.innerHTML.trim()

    if (quotedHtml) return { main: mainHtml, quoted: quotedHtml }
  }

  // 2. "---" elválasztó szöveges sorként (plain-text emailek jellemzője)
  const rawText = body.textContent ?? ''
  const dashSepIdx = rawText.search(/\n[-]{3,}\n/)
  if (dashSepIdx !== -1) {
    // HTML-ben keressük meg a pozíciót közelítőleg a innerHTML alapján
    const plainHtml = body.innerHTML
    const sepIdx = plainHtml.indexOf('---')
    if (sepIdx !== -1) {
      return {
        main: plainHtml.slice(0, sepIdx).trim(),
        quoted: plainHtml.slice(sepIdx).trim(),
      }
    }
  }

  // 3. "On <dátum> ... wrote:" sor (Gmail / Outlook stílus)
  const onWrotePattern = /On .{10,120} wrote:/
  const onWroteMatch = rawText.match(onWrotePattern)
  if (onWroteMatch && onWroteMatch.index !== undefined) {
    const plainHtml = body.innerHTML
    const matchIdx = plainHtml.search(/On .{10,120} wrote:/)
    if (matchIdx !== -1) {
      return {
        main: plainHtml.slice(0, matchIdx).trim(),
        quoted: plainHtml.slice(matchIdx).trim(),
      }
    }
  }

  return { main: html, quoted: null }
}

interface EmailPartJson {
  from: string
  body: string
  sentAt: string
}

function parseRawEmailParts(raw: string | undefined): EmailPartJson[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as EmailPartJson[]
  } catch {
    // invalid JSON — ignore
  }
  return null
}

interface MessageThreadProps {
  ticket: TicketDetailDto
  messages: TicketMessageDto[]
  attachments: AttachmentDto[]
  detailed?: boolean
}

export function MessageThread({ ticket, messages, attachments, detailed = true }: MessageThreadProps) {
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
          <Fragment key={msg.id}>
            {msg.sourceTicketId != null && messages[idx - 1]?.sourceTicketId !== msg.sourceTicketId && (
              <div className={styles.mergeSeparator}>Beolvasztva a(z) #{msg.sourceTicketId} jegyből</div>
            )}
            <MessageBubble
              ticket={ticket}
              msg={msg}
              attachments={attachments.filter((a) => a.messageId === msg.id)}
              detailed={detailed}
            />
          </Fragment>
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
  const [quoteOpen, setQuoteOpen] = useState(false)

  const emailParts = useMemo(() => parseRawEmailParts(msg.rawEmailParts), [msg.rawEmailParts])

  const { main: mainHtml, quoted: quotedHtml } = useMemo(
    () => (emailParts ? { main: msg.body ?? '', quoted: null } : splitQuotedContent(msg.body ?? '')),
    [msg.body, emailParts],
  )

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

      {/* Multi-sender szétbontott rész (jövőbeli feature, most mindig null) */}
      {emailParts ? (
        <div className={styles.bubble}>
          <div className={styles.subBubbles}>
            {emailParts.map((part, i) => (
              <div key={i} className={styles.subBubble}>
                <div className={styles.subBubbleHeader}>
                  From: {part.from} · {formatDateTime(new Date(part.sentAt))}
                </div>
                <SafeHtml html={part.body} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.bubble}>
          <SafeHtml html={mainHtml} />
          {quotedHtml && (
            <>
              <button
                type="button"
                className={styles.quoteToggle}
                onClick={() => setQuoteOpen((o) => !o)}
                title={quoteOpen ? 'Idézett rész elrejtése' : 'Idézett rész megjelenítése'}
              >
                · · ·
              </button>
              {quoteOpen && (
                <div className={styles.quotedContent}>
                  <SafeHtml html={quotedHtml} />
                </div>
              )}
            </>
          )}
        </div>
      )}

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
