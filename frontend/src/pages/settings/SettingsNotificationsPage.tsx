import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsClient, NotificationPreferenceDto, UpdateNotificationPreferencesRequest } from '../../api'
import { NOTIFICATION_TRIGGER_LABELS } from '../../lib/labels'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsNotificationsPage() {
  const queryClient = useQueryClient()
  const prefsQuery = useQuery({ queryKey: ['notification-preferences'], queryFn: () => notificationsClient.getPreferences() })
  const [prefs, setPrefs] = useState<NotificationPreferenceDto[]>([])

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data)
  }, [prefsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => notificationsClient.updatePreferences(new UpdateNotificationPreferencesRequest({ preferences: prefs })),
    onSuccess: (result) => queryClient.setQueryData(['notification-preferences'], result),
  })

  function toggle(triggerType: NotificationPreferenceDto['triggerType']) {
    setPrefs((prev) =>
      prev.map((p) =>
        p.triggerType === triggerType
          ? new NotificationPreferenceDto({ triggerType: p.triggerType, isEnabled: !p.isEnabled })
          : p,
      ),
    )
  }

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Értesítések</h1>
          <div className={shared.subtitle}>Mely eseményekről kapj értesítést</div>
        </div>
        <button type="button" className={shared.primaryButton} disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
        </button>
      </div>

      <div className={shared.card}>
        {prefsQuery.isLoading && <div className={shared.emptyState}>Betöltés…</div>}
        {prefs.map((p) => (
          <div
            key={p.triggerType}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 16px', borderBottom: '1px solid var(--border-light)',
            }}
          >
            <span style={{ fontSize: 13.5 }}>{NOTIFICATION_TRIGGER_LABELS[p.triggerType!]}</span>
            <button
              type="button"
              className={`${shared.toggle} ${p.isEnabled ? shared.toggleOn : ''}`}
              aria-pressed={p.isEnabled}
              onClick={() => toggle(p.triggerType)}
            >
              <span className={shared.toggleKnob} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
