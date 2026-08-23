import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  customStatusesClient,
  CreateCustomStatusRequest,
  CustomStatusDto,
  UpdateCustomStatusRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import shared from '../../components/Settings/SettingsShared.module.css'

export const CUSTOM_STATUS_COLOR_OPTIONS = [
  { value: 'gray',    label: 'Szürke' },
  { value: 'primary', label: 'Kék' },
  { value: 'amber',   label: 'Narancssárga' },
  { value: 'green',   label: 'Zöld' },
  { value: 'dark',    label: 'Sötét' },
  { value: 'purple',  label: 'Lila' },
  { value: 'red',     label: 'Piros' },
]

export const CUSTOM_STATUS_ICON_OPTIONS = [
  { value: 'circle-dot',    label: '● Aktív' },
  { value: 'clock',         label: '⏰ Várakozik' },
  { value: 'circle-check',  label: '✅ Kész' },
  { value: 'lock',          label: '🔒 Lezárva' },
  { value: 'inbox',         label: '📥 Beérkezett' },
  { value: 'hourglass',     label: '⏳ Függőben' },
  { value: 'wrench',        label: '🔧 Folyamatban' },
  { value: 'ban',           label: '🚫 Blokkolt' },
  { value: 'arrow-right',   label: '→ Eszkalálva' },
  { value: 'star',          label: '⭐ Fontos' },
  { value: 'phone',         label: '📞 Telefonos' },
  { value: 'comment',       label: '💬 Válaszra vár' },
  { value: 'fire',          label: '🔥 Sürgős' },
  { value: 'circle-question', label: '❓ Kérdés' },
]

export function SettingsCustomStatusesPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editStatus, setEditStatus] = useState<CustomStatusDto | null>(null)

  const statusesQuery = useQuery({
    queryKey: ['custom-statuses'],
    queryFn: () => customStatusesClient.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customStatusesClient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-statuses'] }),
  })

  const statuses = statusesQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Egyéni státuszok</h1>
          <div className={shared.subtitle}>
            {statuses.length} státusz — a beépített státuszok (Új, Nyitott, Függőben, Megoldva, Lezárva) mellett jelennek meg
          </div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={() => setCreateOpen(true)}>
          + Új státusz
        </button>
      </div>

      {deleteMutation.isError && (
        <div className={shared.formError}>{getErrorMessage(deleteMutation.error, 'Nem sikerült törölni.')}</div>
      )}

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Ikon</th>
                <th>Megnevezés</th>
                <th>Kulcs</th>
                <th>Szín</th>
                <th>Sorrend</th>
                <th>Státusz</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statusesQuery.isLoading && (
                <tr><td colSpan={7} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {!statusesQuery.isLoading && statuses.length === 0 && (
                <tr><td colSpan={7} className={shared.emptyState}>Még nincs egyéni státusz.</td></tr>
              )}
              {statuses.map((s) => {
                const iconOpt = CUSTOM_STATUS_ICON_OPTIONS.find((o) => o.value === s.iconKey)
                const colorOpt = CUSTOM_STATUS_COLOR_OPTIONS.find((o) => o.value === s.colorVariant)
                return (
                  <tr key={s.id}>
                    <td style={{ fontSize: 18, textAlign: 'center' }}>{iconOpt?.label.split(' ')[0]}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className={shared.mono}>{s.key}</td>
                    <td className={shared.muted}>{colorOpt?.label ?? s.colorVariant}</td>
                    <td className={shared.muted}>{s.displayOrder}</td>
                    <td>
                      {s.isActive
                        ? <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>Aktív</span>
                        : <span style={{ color: 'var(--text-muted)' }}>Inaktív</span>}
                    </td>
                    <td>
                      <div className={shared.rowActions}>
                        <button type="button" className={shared.editButton} onClick={() => setEditStatus(s)}>
                          Szerkesztés
                        </button>
                        <button
                          type="button"
                          className={shared.deleteButton}
                          onClick={() => {
                            if (confirm(`Biztosan törlöd a "${s.name}" státuszt? Az összes hozzá rendelt ticketről eltávolításra kerül.`))
                              deleteMutation.mutate(s.id!)
                          }}
                        >
                          Törlés
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CustomStatusModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: ['custom-statuses'] })
          }}
          nextOrder={statuses.length > 0 ? Math.max(...statuses.map((s) => s.displayOrder ?? 0)) + 1 : 0}
        />
      )}
      {editStatus && (
        <CustomStatusModal
          status={editStatus}
          onClose={() => setEditStatus(null)}
          onSaved={() => {
            setEditStatus(null)
            queryClient.invalidateQueries({ queryKey: ['custom-statuses'] })
          }}
        />
      )}
    </div>
  )
}

function CustomStatusModal({
  status, onClose, onSaved, nextOrder = 0,
}: {
  status?: CustomStatusDto
  onClose: () => void
  onSaved: () => void
  nextOrder?: number
}) {
  const [key, setKey] = useState(status?.key ?? '')
  const [name, setName] = useState(status?.name ?? '')
  const [colorVariant, setColorVariant] = useState(status?.colorVariant ?? 'gray')
  const [iconKey, setIconKey] = useState(status?.iconKey ?? 'circle-dot')
  const [displayOrder, setDisplayOrder] = useState(status?.displayOrder ?? nextOrder)
  const [isActive, setIsActive] = useState(status?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (status) {
        await customStatusesClient.update(
          status.id!,
          new UpdateCustomStatusRequest({ key, name, colorVariant, iconKey, displayOrder, isActive }),
        )
      } else {
        await customStatusesClient.create(
          new CreateCustomStatusRequest({ key, name, colorVariant, iconKey, displayOrder }),
        )
      }
    },
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült menteni.')),
  })

  const selectedIcon = CUSTOM_STATUS_ICON_OPTIONS.find((o) => o.value === iconKey)

  return (
    <Modal title={status ? 'Státusz szerkesztése' : 'Új egyéni státusz'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}>
        {error && <div className={shared.formError}>{error}</div>}

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Megnevezés *</label>
          <input
            className={shared.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Szállítóra vár"
            required
          />
        </div>

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Kulcs * <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(egyedi azonosító, csak kisbetű, szám, kötőjel)</span></label>
          <input
            className={shared.formInput}
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="pl. waiting-vendor"
            required
            pattern="[a-z0-9-]+"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className={shared.formGroup}>
            <label className={shared.formLabel}>Ikon</label>
            <select
              className={shared.formInput}
              value={iconKey}
              onChange={(e) => setIconKey(e.target.value)}
            >
              {CUSTOM_STATUS_ICON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={shared.formGroup}>
            <label className={shared.formLabel}>Szín</label>
            <select
              className={shared.formInput}
              value={colorVariant}
              onChange={(e) => setColorVariant(e.target.value)}
            >
              {CUSTOM_STATUS_COLOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Megjelenítési előnézet</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <CustomStatusBadgePreview name={name || 'Példa'} colorVariant={colorVariant} iconEmoji={selectedIcon?.label.split(' ')[0] ?? ''} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className={shared.formGroup}>
            <label className={shared.formLabel}>Sorrend</label>
            <input
              className={shared.formInput}
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              min={0}
            />
          </div>
          {status && (
            <div className={shared.formGroup}>
              <label className={shared.formLabel}>Aktív</label>
              <select
                className={shared.formInput}
                value={isActive ? 'true' : 'false'}
                onChange={(e) => setIsActive(e.target.value === 'true')}
              >
                <option value="true">Igen</option>
                <option value="false">Nem</option>
              </select>
            </div>
          )}
        </div>

        <div className={shared.formActions}>
          <button type="button" className={shared.cancelButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={mutation.isPending}>
            {mutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CustomStatusBadgePreview({ name, colorVariant, iconEmoji }: { name: string; colorVariant: string; iconEmoji: string }) {
  const bg: Record<string, string> = {
    gray: 'var(--bg-alt)',
    primary: 'var(--primary-light, #e8eeff)',
    amber: 'var(--amber-bg, #fffbeb)',
    green: 'var(--green-bg, #f0fdf4)',
    dark: 'var(--navy)',
    purple: 'var(--purple-bg, #f3e8ff)',
    red: 'var(--red-bg, #fef2f2)',
  }
  const color: Record<string, string> = {
    gray: 'var(--text)',
    primary: 'var(--primary)',
    amber: 'var(--amber-text, #92400e)',
    green: 'var(--green-text, #166534)',
    dark: '#fff',
    purple: 'var(--purple)',
    red: 'var(--red-text)',
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
      background: bg[colorVariant] ?? 'var(--bg-alt)',
      color: color[colorVariant] ?? 'var(--text)',
    }}>
      {iconEmoji} {name}
    </span>
  )
}
