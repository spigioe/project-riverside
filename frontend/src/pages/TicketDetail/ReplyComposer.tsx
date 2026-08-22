import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cannedResponsesClient, CannedResponseDto } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { RichTextEditor, type RichTextEditorHandle } from '../../components/RichTextEditor/RichTextEditor'
import rteStyles from '../../components/RichTextEditor/RichTextEditor.module.css'
import { EmailPreviewModal } from './EmailPreviewModal'
import { useAuthStore } from '../../store/useAuthStore'
import { plainTextToHtml, isHtmlEmpty, buildSignatureHtml, buildQuoteHtml } from '../../lib/htmlText'
import { formatFileSize } from '../../lib/format'
import shared from '../../components/Settings/SettingsShared.module.css'
import styles from '../TicketDetailPage.module.css'

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

interface ReplyComposerProps {
  ticketSubject: string
  requesterEmail: string
  body: string
  onBodyChange: (html: string) => void
  cc: string
  onCcChange: (value: string) => void
  bcc: string
  onBccChange: (value: string) => void
  isInternalNote: boolean
  onInternalNoteChange: (value: boolean) => void
  attachments: File[]
  onAttachmentsChange: (files: File[]) => void
  onSend: () => void
  sending: boolean
  editorMinHeight?: number
  // undefined = a preferenciák/üzenetek még töltődnek, még nem tudjuk eldönteni mit szúrjunk be
  signature?: string
  lastInboundBody?: string | null
}

export function ReplyComposer({
  ticketSubject, requesterEmail, body, onBodyChange, cc, onCcChange, bcc, onBccChange,
  isInternalNote, onInternalNoteChange, attachments, onAttachmentsChange, onSend, sending, editorMinHeight,
  signature, lastInboundBody,
}: ReplyComposerProps) {
  const [ccBccOpen, setCcBccOpen] = useState(false)
  const [cannedOpen, setCannedOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [autoQuoteEnabled, setAutoQuoteEnabled] = useState(true)
  const editorRef = useRef<RichTextEditorHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)
  const authUser = useAuthStore((s) => s.user)

  // Mount-kori automatikus tartalom: idézet (ha be van kapcsolva és van bejövő üzenet) + aláírás,
  // a kurzor a dokumentum elejére kerül. Csak EGYSZER fut le (ref guard), amint mindkét async adat
  // (preferenciák, üzenetlista) betöltött — ha közben a user már írt valamit, nem nyúlunk hozzá.
  useEffect(() => {
    if (initializedRef.current) return
    if (signature === undefined || lastInboundBody === undefined) return
    initializedRef.current = true
    if (!isHtmlEmpty(body)) return

    const parts: string[] = []
    if (autoQuoteEnabled && lastInboundBody) parts.push(buildQuoteHtml(lastInboundBody))
    if (signature.trim()) parts.push(buildSignatureHtml(signature, rteStyles.emailSignatureLine))
    if (parts.length === 0) return

    const html = '<p></p>' + parts.join('')
    editorRef.current?.setContentAndFocusStart(html)
    onBodyChange(html)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, lastInboundBody, autoQuoteEnabled])

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (selected.length === 0) return

    const oversized = selected.filter((f) => f.size > MAX_ATTACHMENT_SIZE)
    const valid = selected.filter((f) => f.size <= MAX_ATTACHMENT_SIZE)
    const combined = [...attachments, ...valid]
    const capped = combined.slice(0, MAX_ATTACHMENTS)

    if (oversized.length > 0) {
      setAttachmentError(`Egy fájl mérete legfeljebb 10 MB lehet — kimaradt: ${oversized.map((f) => f.name).join(', ')}`)
    } else if (combined.length > MAX_ATTACHMENTS) {
      setAttachmentError('Legfeljebb 5 fájl csatolható egyszerre.')
    } else {
      setAttachmentError(null)
    }

    onAttachmentsChange(capped)
  }

  return (
    <div className={styles.card}>
      <div className={styles.composerTabs}>
        <button
          type="button"
          className={`${styles.tab} ${!isInternalNote ? styles.tabActive : ''}`}
          onClick={() => onInternalNoteChange(false)}
        >
          Válasz
        </button>
        <button
          type="button"
          className={`${styles.tab} ${isInternalNote ? styles.tabActive : ''}`}
          onClick={() => onInternalNoteChange(true)}
        >
          Belső jegyzet
        </button>
      </div>

      {!isInternalNote && (
        <div className={styles.emailFields}>
          <div className={styles.emailField}>
            <label>Címzett</label>
            <input type="text" value={requesterEmail} readOnly />
          </div>
          {!ccBccOpen && (
            <button type="button" className={styles.ccBccToggle} onClick={() => setCcBccOpen(true)}>
              + CC / BCC
            </button>
          )}
          {ccBccOpen && (
            <>
              <div className={styles.emailField}>
                <label>CC</label>
                <input
                  type="text"
                  value={cc}
                  placeholder="pelda1@ceg.hu, pelda2@ceg.hu"
                  onChange={(e) => onCcChange(e.target.value)}
                />
              </div>
              <div className={styles.emailField}>
                <label>BCC</label>
                <input
                  type="text"
                  value={bcc}
                  placeholder="pelda1@ceg.hu, pelda2@ceg.hu"
                  onChange={(e) => onBccChange(e.target.value)}
                />
              </div>
            </>
          )}
          {lastInboundBody && (
            <label className={styles.previewCheckboxRow}>
              <input
                type="checkbox"
                checked={autoQuoteEnabled}
                onChange={(e) => setAutoQuoteEnabled(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Eredeti üzenet idézése a válaszban
            </label>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />

      <RichTextEditor
        ref={editorRef}
        content={body}
        onChange={onBodyChange}
        placeholder={isInternalNote ? 'Belső jegyzet írása…' : `Válasz írása ${requesterEmail} részére…`}
        highlighted={isInternalNote}
        minHeight={editorMinHeight}
        onCannedResponseClick={() => setCannedOpen(true)}
        onAttachClick={() => fileInputRef.current?.click()}
      />

      {attachments.length > 0 && (
        <div className={styles.attachmentChips}>
          {attachments.map((file, idx) => (
            <span key={`${file.name}-${idx}`} className={styles.attachmentChip}>
              <span className={styles.attachmentChipName}>{file.name}</span>
              <span className={styles.attachmentChipSize}>({formatFileSize(file.size)})</span>
              <button
                type="button"
                className={styles.attachmentChipRemove}
                onClick={() => onAttachmentsChange(attachments.filter((_, i) => i !== idx))}
                aria-label={`${file.name} eltávolítása`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {attachmentError && <div className={styles.attachmentError}>{attachmentError}</div>}

      <div className={styles.composerFooter}>
        {!isInternalNote && (
          <button
            type="button"
            className={shared.secondaryButton}
            disabled={isHtmlEmpty(body)}
            onClick={() => setPreviewOpen(true)}
          >
            Előnézet
          </button>
        )}
        <button
          type="button"
          className={styles.sendButton}
          disabled={isHtmlEmpty(body) || sending}
          onClick={onSend}
        >
          {isInternalNote ? (sending ? 'Mentés…' : 'Mentés →') : (sending ? 'Küldés…' : 'Küldés →')}
        </button>
      </div>

      {previewOpen && (
        <EmailPreviewModal
          subject={ticketSubject}
          fromName={authUser?.fullName ?? ''}
          fromEmail={authUser?.email ?? ''}
          toEmail={requesterEmail}
          cc={cc}
          bcc={bcc}
          bodyHtml={body}
          sending={sending}
          onClose={() => setPreviewOpen(false)}
          onSend={onSend}
        />
      )}

      {cannedOpen && (
        <CannedResponseModal
          onClose={() => setCannedOpen(false)}
          onSelect={(text) => {
            editorRef.current?.insertContent(plainTextToHtml(text))
            setCannedOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CannedResponseModal({ onClose, onSelect }: { onClose: () => void; onSelect: (body: string) => void }) {
  const responsesQuery = useQuery({
    queryKey: ['canned-responses'],
    queryFn: () => cannedResponsesClient.getResponses(),
  })

  const responses = responsesQuery.data ?? []

  return (
    <Modal title="Válaszsablon kiválasztása" onClose={onClose}>
      {responsesQuery.isLoading && <div className={styles.emptyState}>Betöltés…</div>}
      {!responsesQuery.isLoading && responses.length === 0 && (
        <div className={styles.emptyState}>Nincs elérhető válaszsablon.</div>
      )}
      <div className={styles.cannedList}>
        {responses.map((r: CannedResponseDto) => (
          <button
            key={r.id}
            type="button"
            className={styles.cannedItem}
            onClick={() => onSelect(r.body ?? '')}
          >
            <div className={styles.cannedItemTitle}>{r.title}</div>
            <div className={styles.cannedItemPreview}>{(r.body ?? '').slice(0, 140)}</div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
