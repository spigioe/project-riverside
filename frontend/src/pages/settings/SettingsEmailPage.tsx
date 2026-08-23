import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  settingsClient,
  TestEmailConnectionRequest,
  TestEmailConnectionResponse,
  UpdateEmailSettingsRequest,
} from '../../api'
import { getErrorMessage } from '../../lib/errors'
import shared from '../../components/Settings/SettingsShared.module.css'

const PROVIDERS = [
  { value: 'mailpit', label: 'Mailpit (fejlesztői)' },
  { value: 'imap', label: 'IMAP / Gmail' },
]

export function SettingsEmailPage() {
  const queryClient = useQueryClient()

  const emailQuery = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => settingsClient.getEmailSettings(),
  })

  const s = emailQuery.data

  // form state
  const [provider, setProvider] = useState<string>('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('')
  const [useSsl, setUseSsl] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pollInterval, setPollInterval] = useState('')
  const [fromAddress, setFromAddress] = useState('')

  const [editing, setEditing] = useState(false)
  const [testResult, setTestResult] = useState<TestEmailConnectionResponse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  function startEdit() {
    if (!s) return
    setProvider(s.provider ?? 'mailpit')
    setSmtpHost(s.smtpHost ?? '')
    setSmtpPort(String(s.smtpPort ?? ''))
    setApiBaseUrl(s.apiBaseUrl ?? '')
    setImapHost(s.imapHost ?? 'imap.gmail.com')
    setImapPort(String(s.imapPort ?? 993))
    setUseSsl(s.useSsl ?? true)
    setUsername(s.username ?? '')
    setPassword('')
    setPollInterval(String(s.pollIntervalSeconds ?? 60))
    setFromAddress(s.fromAddress ?? '')
    setTestResult(null)
    setSaveError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setTestResult(null)
    setSaveError(null)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsClient.updateEmailSettings(new UpdateEmailSettingsRequest({
        provider,
        smtpHost,
        smtpPort: Number(smtpPort),
        apiBaseUrl: provider === 'mailpit' ? apiBaseUrl : undefined,
        imapHost,
        imapPort: Number(imapPort),
        useSsl,
        username,
        password,
        pollIntervalSeconds: Number(pollInterval),
        fromAddress,
      })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
      setEditing(false)
      setSaveError(null)
    },
    onError: (err) => setSaveError(getErrorMessage(err, 'Nem sikerült menteni.')),
  })

  const testMutation = useMutation({
    mutationFn: () =>
      settingsClient.testEmailConnection(new TestEmailConnectionRequest({
        provider,
        smtpHost,
        smtpPort: Number(smtpPort),
        apiBaseUrl: provider === 'mailpit' ? apiBaseUrl : undefined,
        imapHost,
        imapPort: Number(imapPort),
        useSsl,
        username,
        password,
        fromAddress,
      })),
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ success: false, message: getErrorMessage(err, 'Hiba.') } as TestEmailConnectionResponse),
  })

  const isImap = (editing ? provider : s?.provider ?? '') === 'imap'

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Email konfiguráció</h1>
          <div className={shared.subtitle}>
            {s?.hasStoredConfig
              ? 'Adatbázisban tárolt konfiguráció (titkosítva)'
              : 'Alapértelmezett (appsettings.Development.json)'}
          </div>
        </div>
        {!editing && (
          <button type="button" className={shared.primaryButton} onClick={startEdit}>
            Szerkesztés
          </button>
        )}
      </div>

      {!editing ? (
        <ReadOnlyView s={s} isLoading={emailQuery.isLoading} />
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}
        >
          {saveError && <div className={shared.formError}>{saveError}</div>}

          <div className={shared.card}>
            <div className={shared.cardHeader}>
              <span className={shared.cardHeaderTitle}>Provider</span>
            </div>
            <div className={shared.cardBody}>
              <div className={shared.formGroup}>
                <label className={shared.formLabel}>Email provider *</label>
                <select
                  className={shared.formInput}
                  value={provider}
                  onChange={(e) => { setProvider(e.target.value); setTestResult(null) }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {provider === 'mailpit' && (
            <div className={shared.card}>
              <div className={shared.cardHeader}>
                <span className={shared.cardHeaderTitle}>Mailpit beállítások</span>
              </div>
              <div className={shared.cardBody}>
                <div className={shared.formGroup}>
                  <label className={shared.formLabel}>SMTP szerver *</label>
                  <input className={shared.formInput} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required />
                </div>
                <div className={shared.formGroup}>
                  <label className={shared.formLabel}>SMTP port *</label>
                  <input className={shared.formInput} type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} required />
                </div>
                <div className={shared.formGroup}>
                  <label className={shared.formLabel}>Mailpit HTTP API URL *</label>
                  <input className={shared.formInput} value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="http://localhost:8025" required />
                </div>
              </div>
            </div>
          )}

          {isImap && (
            <>
              <div className={shared.card}>
                <div className={shared.cardHeader}>
                  <span className={shared.cardHeaderTitle}>IMAP (bejövő email)</span>
                </div>
                <div className={shared.cardBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                    <div className={shared.formGroup}>
                      <label className={shared.formLabel}>IMAP szerver *</label>
                      <input className={shared.formInput} value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.gmail.com" required />
                    </div>
                    <div className={shared.formGroup}>
                      <label className={shared.formLabel}>Port *</label>
                      <input className={shared.formInput} type="number" value={imapPort} onChange={(e) => setImapPort(e.target.value)} required />
                    </div>
                  </div>
                  <div className={shared.formGroup}>
                    <label className={shared.formLabel}>SSL/TLS</label>
                    <select className={shared.formInput} value={useSsl ? 'true' : 'false'} onChange={(e) => setUseSsl(e.target.value === 'true')}>
                      <option value="true">Igen (ajánlott)</option>
                      <option value="false">Nem (STARTTLS)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={shared.card}>
                <div className={shared.cardHeader}>
                  <span className={shared.cardHeaderTitle}>SMTP (kimenő email)</span>
                </div>
                <div className={shared.cardBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                    <div className={shared.formGroup}>
                      <label className={shared.formLabel}>SMTP szerver *</label>
                      <input className={shared.formInput} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" required />
                    </div>
                    <div className={shared.formGroup}>
                      <label className={shared.formLabel}>Port *</label>
                      <input className={shared.formInput} type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} required />
                    </div>
                  </div>
                </div>
              </div>

              <div className={shared.card}>
                <div className={shared.cardHeader}>
                  <span className={shared.cardHeaderTitle}>Hitelesítés</span>
                </div>
                <div className={shared.cardBody}>
                  <div className={shared.formGroup}>
                    <label className={shared.formLabel}>Felhasználónév (email cím) *</label>
                    <input
                      className={shared.formInput}
                      type="email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="youremail@gmail.com"
                      required
                    />
                  </div>
                  <div className={shared.formGroup}>
                    <label className={shared.formLabel}>
                      Jelszó / App Password {s?.passwordMasked ? '(üresen hagyva = megtartja a tárolt jelszót)' : '*'}
                    </label>
                    <input
                      className={shared.formInput}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={s?.passwordMasked ? '••••••••' : 'Gmail App Password (16 karakter)'}
                      required={!s?.passwordMasked}
                    />
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      Gmail esetén: Fiókbeállítások → Biztonság → Alkalmazásjelszavak → App Password létrehozása
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className={shared.card}>
            <div className={shared.cardHeader}>
              <span className={shared.cardHeaderTitle}>Általános beállítások</span>
            </div>
            <div className={shared.cardBody}>
              <div className={shared.formGroup}>
                <label className={shared.formLabel}>Feladó email cím *</label>
                <input
                  className={shared.formInput}
                  type="email"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  required
                />
              </div>
              <div className={shared.formGroup} style={{ marginBottom: 0 }}>
                <label className={shared.formLabel}>Lekérdezési időköz (másodperc) *</label>
                <input
                  className={shared.formInput}
                  type="number"
                  min={10}
                  value={pollInterval}
                  onChange={(e) => setPollInterval(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Kapcsolat teszt */}
          <div className={shared.card}>
            <div className={shared.cardHeader}>
              <span className={shared.cardHeaderTitle}>Kapcsolat teszt</span>
            </div>
            <div className={shared.cardBody}>
              <button
                type="button"
                className={shared.secondaryButton}
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? 'Tesztelés…' : 'Kapcsolat tesztelése'}
              </button>
              {testResult && (
                <div style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  background: testResult.success ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: testResult.success ? 'var(--green-text)' : 'var(--red-text)',
                  border: `1px solid ${testResult.success ? 'var(--green-border)' : 'var(--red-border)'}`,
                  fontSize: 13,
                }}>
                  {testResult.success ? '✓ ' : '✗ '}{testResult.message}
                </div>
              )}
            </div>
          </div>

          <div className={shared.formActions}>
            <button type="button" className={shared.cancelButton} onClick={cancelEdit}>Mégse</button>
            <button type="submit" className={shared.primaryButton} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function ReadOnlyView({ s, isLoading }: { s: ReturnType<typeof Object.assign> | undefined; isLoading: boolean }) {
  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Jelenlegi konfiguráció</span>
      </div>
      <div className={shared.cardBody}>
        {isLoading && <div className={shared.emptyState}>Betöltés…</div>}
        {s && (
          <>
            <div className={shared.field}>
              <label>Provider</label>
              <input type="text" value={PROVIDERS.find((p) => p.value === s.provider)?.label ?? s.provider ?? '-'} readOnly disabled />
            </div>
            <div className={shared.field}>
              <label>Feladó cím</label>
              <input type="text" value={s.fromAddress ?? '-'} readOnly disabled />
            </div>
            <div className={shared.field}>
              <label>SMTP szerver</label>
              <input type="text" value={`${s.smtpHost ?? '-'}:${s.smtpPort ?? '-'}`} readOnly disabled />
            </div>
            {s.provider === 'imap' ? (
              <>
                <div className={shared.field}>
                  <label>IMAP szerver</label>
                  <input type="text" value={`${s.imapHost ?? '-'}:${s.imapPort ?? '-'}`} readOnly disabled />
                </div>
                <div className={shared.field}>
                  <label>Felhasználónév</label>
                  <input type="text" value={s.username ?? '-'} readOnly disabled />
                </div>
                <div className={shared.field}>
                  <label>Jelszó</label>
                  <input type="text" value={s.passwordMasked || '(nincs beállítva)'} readOnly disabled />
                </div>
              </>
            ) : (
              <div className={shared.field}>
                <label>Mailpit API URL</label>
                <input type="text" value={s.apiBaseUrl ?? '-'} readOnly disabled />
              </div>
            )}
            <div className={shared.field} style={{ marginBottom: 0 }}>
              <label>Lekérdezési időköz</label>
              <input type="text" value={`${s.pollIntervalSeconds ?? '-'} mp`} readOnly disabled />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
