import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meClient, TicketListView, UpdateUserPreferenceRequest } from '../api'
import { getErrorMessage } from '../lib/errors'
import shared from '../components/Settings/SettingsShared.module.css'

export function PreferencesPage() {
  const queryClient = useQueryClient()

  const preferencesQuery = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => meClient.getPreferences(),
  })

  // Nincs effect: amíg a user nem érint egy mezőt sem, a szerkesztett érték a lekérdezett adatból
  // származik render közben; onChange-kor a draft állapot veszi át — így nincs setState-in-effect.
  const [draft, setDraft] = useState<{ autosave: boolean; listView: TicketListView } | null>(null)
  const autosave = draft?.autosave ?? preferencesQuery.data?.ticketPropertiesAutosave ?? true
  const listView = draft?.listView ?? preferencesQuery.data?.ticketListView ?? TicketListView.Table

  const saveMutation = useMutation({
    mutationFn: () =>
      meClient.updatePreferences(new UpdateUserPreferenceRequest({
        ticketPropertiesAutosave: autosave,
        ticketListView: listView,
      })),
    onSuccess: (result) => {
      queryClient.setQueryData(['user-preferences'], result)
      setDraft(null)
    },
  })

  return (
    <div style={{ padding: '28px', maxWidth: 560 }}>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Preferenciák</h1>
          <div className={shared.subtitle}>Személyes beállítások — csak rád vonatkoznak</div>
        </div>
      </div>

      <div className={shared.card}>
        <div className={shared.cardBody}>
          {preferencesQuery.isLoading && <div className={shared.emptyState}>Betöltés…</div>}

          {!preferencesQuery.isLoading && (
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}>
              {saveMutation.isError && (
                <div className={shared.formError}>{getErrorMessage(saveMutation.error, 'Nem sikerült menteni a preferenciákat.')}</div>
              )}

              <div className={shared.field}>
                <label htmlFor="pref-autosave" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id="pref-autosave"
                    type="checkbox"
                    checked={autosave}
                    onChange={(e) => setDraft({ autosave: e.target.checked, listView })}
                    style={{ width: 'auto' }}
                  />
                  Ticket tulajdonságok automatikus mentése
                </label>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Ha ki van kapcsolva, a ticket felelős/státusz módosítása a jobb oldali panelen csak a
                  "Mentés" gombra kattintva kerül elmentésre — addig szabadon módosíthatod meggondolás nélkül.
                </div>
              </div>

              <div className={shared.field}>
                <label htmlFor="pref-listview">Ticket lista nézet</label>
                <select
                  id="pref-listview"
                  value={listView}
                  onChange={(e) => setDraft({ autosave, listView: e.target.value as TicketListView })}
                >
                  <option value={TicketListView.Table}>Táblázat</option>
                  <option value={TicketListView.Card}>Kártyák</option>
                </select>
              </div>

              <div className={shared.formActions}>
                <button type="submit" className={shared.primaryButton} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
