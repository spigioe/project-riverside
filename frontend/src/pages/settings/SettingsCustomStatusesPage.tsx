import { useEffect, useRef, useState } from 'react'
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

const LS_BUILTIN_ORDER_KEY = 'custom-statuses-builtin-order'

type BuiltinStatus = { key: string; name: string; icon: string; color: string }

const BUILTIN_STATUSES: BuiltinStatus[] = [
  { key: 'new',      name: 'Új',       icon: '📥', color: 'primary' },
  { key: 'open',     name: 'Nyitott',  icon: '● ', color: 'green' },
  { key: 'pending',  name: 'Függőben', icon: '⏳', color: 'amber' },
  { key: 'resolved', name: 'Megoldva', icon: '✅', color: 'gray' },
  { key: 'closed',   name: 'Lezárva',  icon: '🔒', color: 'dark' },
]

type ListItem =
  | { kind: 'builtin'; status: BuiltinStatus; listIdx: number }
  | { kind: 'custom'; status: CustomStatusDto; listIdx: number }

function loadBuiltinOrder(): string[] {
  try {
    const raw = localStorage.getItem(LS_BUILTIN_ORDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return BUILTIN_STATUSES.map((s) => s.key)
}

function saveBuiltinOrder(keys: string[]) {
  try { localStorage.setItem(LS_BUILTIN_ORDER_KEY, JSON.stringify(keys)) } catch { /* ignore */ }
}

function buildCombinedList(builtinOrder: string[], customs: CustomStatusDto[]): ListItem[] {
  const builtinMap = new Map(BUILTIN_STATUSES.map((s) => [s.key, s]))
  const orderedBuiltins = builtinOrder
    .map((k) => builtinMap.get(k))
    .filter((s): s is BuiltinStatus => !!s)

  // Add any missing builtins at end (safety)
  for (const s of BUILTIN_STATUSES) {
    if (!orderedBuiltins.find((b) => b.key === s.key)) orderedBuiltins.push(s)
  }

  const items: ListItem[] = []
  let listIdx = 0

  const sortedCustoms = [...customs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

  // Interleave: we keep builtins first for simplicity, then customs
  // The combined list allows drag-and-drop across all items
  for (const s of orderedBuiltins) {
    items.push({ kind: 'builtin', status: s, listIdx: listIdx++ })
  }
  for (const s of sortedCustoms) {
    items.push({ kind: 'custom', status: s, listIdx: listIdx++ })
  }

  return items
}

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

  const [builtinOrder, setBuiltinOrder] = useState<string[]>(loadBuiltinOrder)
  const [combinedList, setCombinedList] = useState<ListItem[]>([])
  const dragIndex = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    const customs = statusesQuery.data ?? []
    setCombinedList(buildCombinedList(builtinOrder, customs))
  }, [statusesQuery.data, builtinOrder])

  const reorderMutation = useMutation({
    mutationFn: async (items: CustomStatusDto[]) => {
      await Promise.all(items.map((s) =>
        customStatusesClient.update(s.id!, new UpdateCustomStatusRequest({
          key: s.key!, name: s.name!, colorVariant: s.colorVariant!,
          iconKey: s.iconKey!, displayOrder: s.displayOrder!, isActive: s.isActive!,
        }))
      ))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-statuses'] }),
  })

  function handleDragStart(idx: number) {
    dragIndex.current = idx
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(dropIdx: number) {
    setDragOverIdx(null)
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === dropIdx) return

    const next = [...combinedList]
    const [moved] = next.splice(from, 1)
    next.splice(dropIdx, 0, moved)

    // Reassign listIdx
    const reindexed = next.map((item, i) => ({ ...item, listIdx: i }))
    setCombinedList(reindexed)

    // Save builtin order to localStorage
    const newBuiltinOrder = reindexed
      .filter((item): item is ListItem & { kind: 'builtin' } => item.kind === 'builtin')
      .map((item) => item.status.key)
    setBuiltinOrder(newBuiltinOrder)
    saveBuiltinOrder(newBuiltinOrder)

    // Update custom status display orders
    const customItems = reindexed
      .filter((item): item is ListItem & { kind: 'custom' } => item.kind === 'custom')
    const origMap = new Map((statusesQuery.data ?? []).map((s) => [s.id, s.displayOrder]))
    const updated = customItems.map((item, i) =>
      CustomStatusDto.fromJS({ ...item.status, displayOrder: i })
    )
    const changed = updated.filter((s) => origMap.get(s.id) !== s.displayOrder)
    if (changed.length) reorderMutation.mutate(changed)
  }

  const statuses = statusesQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Egyéni státuszok</h1>
          <div className={shared.subtitle}>
            {statuses.length} egyéni státusz — a beépített státuszok (Új, Nyitott, Függőben, Megoldva, Lezárva) mellett jelennek meg
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
                <th style={{ width: 32 }}></th>
                <th>Ikon</th>
                <th>Megnevezés</th>
                <th>Kulcs</th>
                <th>Szín</th>
                <th>Típus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statusesQuery.isLoading && (
                <tr><td colSpan={7} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {combinedList.map((item, idx) => {
                if (item.kind === 'builtin') {
                  const s = item.status
                  return (
                    <tr
                      key={`builtin-${s.key}`}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { setDragOverIdx(null); dragIndex.current = null }}
                      style={{ borderTop: dragOverIdx === idx && dragIndex.current !== idx ? '2px solid var(--primary)' : undefined }}
                    >
                      <td style={{ textAlign: 'center', cursor: 'grab', color: 'var(--text-muted)', userSelect: 'none', fontSize: 14 }}>⠿</td>
                      <td style={{ fontSize: 18, textAlign: 'center' }}>{s.icon}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td className={shared.mono}>{s.key}</td>
                      <td className={shared.muted}>{CUSTOM_STATUS_COLOR_OPTIONS.find((o) => o.value === s.color)?.label ?? s.color}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 10,
                          fontWeight: 700, background: 'var(--bg-alt)', color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid var(--border-light)',
                        }}>
                          Rendszer
                        </span>
                      </td>
                      <td></td>
                    </tr>
                  )
                }

                const s = item.status
                const iconOpt = CUSTOM_STATUS_ICON_OPTIONS.find((o) => o.value === s.iconKey)
                const colorOpt = CUSTOM_STATUS_COLOR_OPTIONS.find((o) => o.value === s.colorVariant)
                return (
                  <tr
                    key={`custom-${s.id}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => { setDragOverIdx(null); dragIndex.current = null }}
                    style={{ borderTop: dragOverIdx === idx && dragIndex.current !== idx ? '2px solid var(--primary)' : undefined }}
                  >
                    <td style={{ textAlign: 'center', cursor: 'grab', color: 'var(--text-muted)', userSelect: 'none', fontSize: 14 }}>⠿</td>
                    <td style={{ fontSize: 18, textAlign: 'center' }}>{iconOpt?.label.split(' ')[0]}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className={shared.mono}>{s.key}</td>
                    <td className={shared.muted}>{colorOpt?.label ?? s.colorVariant}</td>
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
          nextOrder={statuses.length}
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
  const displayOrder = status?.displayOrder ?? nextOrder
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
