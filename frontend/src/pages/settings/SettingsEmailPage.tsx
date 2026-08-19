import { useQuery } from '@tanstack/react-query'
import { settingsClient } from '../../api'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsEmailPage() {
  const emailQuery = useQuery({ queryKey: ['email-settings'], queryFn: () => settingsClient.getEmailSettings() })
  const s = emailQuery.data

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Email konfiguráció</h1>
          <div className={shared.subtitle}>Csak megjelenítés — a szerkesztés egy későbbi lépésben lesz elérhető</div>
        </div>
      </div>

      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <span className={shared.cardHeaderTitle}>SMTP / IMAP beállítások</span>
        </div>
        <div className={shared.cardBody}>
          {emailQuery.isLoading && <div className={shared.emptyState}>Betöltés…</div>}
          {s && (
            <>
              <div className={shared.field}>
                <label>SMTP szerver</label>
                <input type="text" value={s.smtpHost} readOnly disabled />
              </div>
              <div className={shared.field}>
                <label>SMTP port</label>
                <input type="text" value={s.smtpPort} readOnly disabled />
              </div>
              <div className={shared.field}>
                <label>Bejövő email API (Mailpit)</label>
                <input type="text" value={s.apiBaseUrl} readOnly disabled />
              </div>
              <div className={shared.field}>
                <label>Lekérdezési időköz (mp)</label>
                <input type="text" value={s.pollIntervalSeconds} readOnly disabled />
              </div>
              <div className={shared.field} style={{ marginBottom: 0 }}>
                <label>Feladó email cím</label>
                <input type="text" value={s.fromAddress} readOnly disabled />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
