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
  const [draft, setDraft] = useState<{ autosave: boolean; listView: TicketListView; signature: string } | null>(null)
  const autosave = draft?.autosave ?? preferencesQuery.data?.ticketPropertiesAutosave ?? true
  const listView = draft?.listView ?? preferencesQuery.data?.ticketListView ?? TicketListView.Table
  const signature = draft?.signature ?? preferencesQuery.data?.emailSignature ?? ''

  const saveMutation = useMutation({
    mutationFn: () =>
      meClient.updatePreferences(new UpdateUserPreferenceRequest({
        ticketPropertiesAutosave: autosave,
        ticketListView: listView,
        // A ticketDetailView/ticketDetailSplitReversed mezőket a ticket detail nézetváltó gombjai
        // írják, itt csak megőrizzük a jelenlegi értéküket, hogy a mentés ne írja őket felül.
        ticketDetailView: preferencesQuery.data?.ticketDetailView,
        ticketDetailSplitReversed: preferencesQuery.data?.ticketDetailSplitReversed,
        emailSignature: signature.trim() === '' ? undefined : signature,
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
                    onChange={(e) => setDraft({ autosave: e.target.checked, listView, signature })}
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
                  onChange={(e) => setDraft({ autosave, listView: e.target.value as TicketListView, signature })}
                >
                  <option value={TicketListView.Table}>Táblázat</option>
                  <option value={TicketListView.Card}>Kártyák</option>
                </select>
              </div>

              <div className={shared.field}>
                <label htmlFor="pref-signature">Email aláírás</label>
                <textarea
                  id="pref-signature"
                  rows={4}
                  value={signature}
                  onChange={(e) => setDraft({ autosave, listView, signature: e.target.value })}
                  placeholder="Pl.: Üdvözlettel,&#10;Kovács Anna&#10;Support Portál"
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Új válasz írásakor automatikusan bekerül a szerkesztő aljára, "--" elválasztóval.
                  Ha törlöd az adott válaszból, az nem áll vissza automatikusan.
                </div>
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
