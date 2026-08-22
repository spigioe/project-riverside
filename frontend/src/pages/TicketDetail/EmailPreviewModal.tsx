import { Modal } from '../../components/Modal/Modal'
import { SafeHtml } from '../../components/SafeHtml/SafeHtml'
import shared from '../../components/Settings/SettingsShared.module.css'
import styles from '../TicketDetailPage.module.css'

interface EmailPreviewModalProps {
  subject: string
  fromName: string
  fromEmail: string
  toEmail: string
  cc: string
  bcc: string
  bodyHtml: string
  sending: boolean
  onClose: () => void
  onSend: () => void
}

// A body HTML-je már tartalmazza az aláírást (és az idézetet, ha be volt kapcsolva) — ezek
// ugyanis valódi, szerkeszthető editor-tartalomként lettek beszúrva (lásd ReplyComposer), nem
// a küldés/előnézet pillanatában hozzáfűzött külön darabok.
export function EmailPreviewModal({
  subject, fromName, fromEmail, toEmail, cc, bcc, bodyHtml, sending, onClose, onSend,
}: EmailPreviewModalProps) {
  return (
    <Modal title="Email előnézet" onClose={onClose} maxWidth={700}>
      <div className={styles.previewHeader}>
        <div className={styles.infoRow}>
          <span className={styles.infoRowLabel}>Tárgy</span>
          <span className={styles.infoRowValue}>{subject}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoRowLabel}>Tól</span>
          <span className={styles.infoRowValue}>{fromName} &lt;{fromEmail}&gt;</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoRowLabel}>Nek</span>
          <span className={styles.infoRowValue}>{toEmail}</span>
        </div>
        {cc.trim() && (
          <div className={styles.infoRow}>
            <span className={styles.infoRowLabel}>CC</span>
            <span className={styles.infoRowValue}>{cc}</span>
          </div>
        )}
        {bcc.trim() && (
          <div className={styles.infoRow}>
            <span className={styles.infoRowLabel}>BCC</span>
            <span className={styles.infoRowValue}>{bcc}</span>
          </div>
        )}
      </div>

      <SafeHtml html={bodyHtml} className={styles.previewBody} />

      <div className={styles.previewActions}>
        <button type="button" className={shared.secondaryButton} onClick={onClose}>
          Bezárás
        </button>
        <button
          type="button"
          className={shared.primaryButton}
          disabled={sending}
          onClick={() => { onSend(); onClose() }}
        >
          {sending ? 'Küldés…' : 'Küldés'}
        </button>
      </div>
    </Modal>
  )
}
