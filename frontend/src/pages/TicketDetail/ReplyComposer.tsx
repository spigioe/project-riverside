import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cannedResponsesClient, CannedResponseDto } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { RichTextEditor } from '../../components/RichTextEditor/RichTextEditor'
import { plainTextToHtml, isHtmlEmpty } from '../../lib/htmlText'
import styles from '../TicketDetailPage.module.css'

interface ReplyComposerProps {
  requesterEmail: string
  body: string
  onBodyChange: (html: string) => void
  cc: string
  onCcChange: (value: string) => void
  bcc: string
  onBccChange: (value: string) => void
  isInternalNote: boolean
  onInternalNoteChange: (value: boolean) => void
  onSend: () => void
  sending: boolean
}

export function ReplyComposer({
  requesterEmail, body, onBodyChange, cc, onCcChange, bcc, onBccChange,
  isInternalNote, onInternalNoteChange, onSend, sending,
}: ReplyComposerProps) {
  const [ccBccOpen, setCcBccOpen] = useState(false)
  const [cannedOpen, setCannedOpen] = useState(false)

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
        </div>
      )}

      <RichTextEditor
        content={body}
        onChange={onBodyChange}
        placeholder={isInternalNote ? 'Belső jegyzet írása…' : `Válasz írása ${requesterEmail} részére…`}
        highlighted={isInternalNote}
        onCannedResponseClick={() => setCannedOpen(true)}
      />

      <div className={styles.composerFooter}>
        <button
          type="button"
          className={styles.sendButton}
          disabled={isHtmlEmpty(body) || sending}
          onClick={onSend}
        >
          {isInternalNote ? (sending ? 'Mentés…' : 'Mentés →') : (sending ? 'Küldés…' : 'Küldés →')}
        </button>
      </div>

      {cannedOpen && (
        <CannedResponseModal
          onClose={() => setCannedOpen(false)}
          onSelect={(text) => {
            onBodyChange(plainTextToHtml(text))
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
