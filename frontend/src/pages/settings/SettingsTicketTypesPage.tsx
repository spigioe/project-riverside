import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ticketTypesClient,
  CreateTicketTypeRequest,
  TicketTypeDto,
  UpdateTicketTypeDefinitionRequest,
  ReorderTicketTypesRequest,
  ReorderTicketTypeItem,
} from '../../api'
import { useTicketTypes } from '../../lib/ticketTypes'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import badgeStyles from '../../components/Badge/Badge.module.css'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsTicketTypesPage() {
  const queryClient = useQueryClient()
  const typesQuery = useTicketTypes()

  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; type?: TicketTypeDto } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [orderedTypes, setOrderedTypes] = useState<TicketTypeDto[]>([])
  const dragIndex = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    if (typesQuery.data) {
      setOrderedTypes([...typesQuery.data].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)))
    }
  }, [typesQuery.data])

  const reorderMutation = useMutation({
    mutationFn: (items: TicketTypeDto[]) => {
      const request = new ReorderTicketTypesRequest({
        items: items.map((t, i) => new ReorderTicketTypeItem({ id: t.id!, displayOrder: i })),
      })
      return ticketTypesClient.reorder(request)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ticketTypesClient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült törölni.')),
  })

  function handleDragStart(idx: number) { dragIndex.current = idx }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(dropIdx: number) {
    setDragOverIdx(null)
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === dropIdx) return
    const next = [...orderedTypes]
    const [moved] = next.splice(from, 1)
    next.splice(dropIdx, 0, moved)
    setOrderedTypes(next)
    const origMap = new Map((typesQuery.data ?? []).map((t) => [t.id, t.displayOrder]))
    const changed = next.filter((t, i) => origMap.get(t.id) !== i)
    if (changed.length) reorderMutation.mutate(next)
  }

  const types = typesQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Ticket típusok</h1>
          <div className={shared.subtitle}>
            {types.filter((t) => !t.isSystem).length} egyéni típus — a rendszer típusok mindig elérhetők
          </div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={() => setModalState({ mode: 'create' })}>
          + Új típus
        </button>
      </div>

      {error && (
        <div className={shared.formError}>{error}</div>
      )}

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Név</th>
                <th>Leírás</th>
                <th>Típus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orderedTypes.map((type, idx) => (
                <tr
                  key={type.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => setDragOverIdx(null)}
                  style={dragOverIdx === idx ? { background: 'var(--bg-hover)' } : undefined}
                >
                  <td style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: 16, textAlign: 'center' }}>⠿</td>
                  <td>{type.name}</td>
                  <td className={shared.muted}>{type.description ?? '—'}</td>
                  <td>
                    {type.isSystem && (
                      <span className={`${badgeStyles.badge} ${badgeStyles.gray}`} style={{ fontSize: 10 }}>RENDSZER</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!type.isSystem && (
                        <>
                          <button
                            type="button"
                            className={shared.secondaryButton}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => setModalState({ mode: 'edit', type })}
                          >
                            Szerkesztés
                          </button>
                          <button
                            type="button"
                            className={shared.dangerButton}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            disabled={deleteMutation.isPending && deleteMutation.variables === type.id}
                            onClick={() => {
                              if (confirm(`Biztosan törlöd a(z) "${type.name}" típust?`)) {
                                setError(null)
                                deleteMutation.mutate(type.id!)
                              }
                            }}
                          >
                            Törlés
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orderedTypes.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                    Nincsenek ticket típusok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalState && (
        <TicketTypeModal
          mode={modalState.mode}
          existing={modalState.type}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null)
            queryClient.invalidateQueries({ queryKey: ['ticket-types'] })
          }}
        />
      )}
    </div>
  )
}

interface TicketTypeModalProps {
  mode: 'create' | 'edit'
  existing?: TicketTypeDto
  onClose: () => void
  onSaved: () => void
}

function TicketTypeModal({ mode, existing, onClose, onSaved }: TicketTypeModalProps) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => ticketTypesClient.create(new CreateTicketTypeRequest({ name: name.trim(), description: description.trim() || undefined })),
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült létrehozni.')),
  })

  const updateMutation = useMutation({
    mutationFn: () => ticketTypesClient.update(existing!.id!, new UpdateTicketTypeDefinitionRequest({ name: name.trim(), description: description.trim() || undefined })),
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült frissíteni.')),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'create') createMutation.mutate()
    else updateMutation.mutate()
  }

  return (
    <Modal title={mode === 'create' ? 'Új ticket típus' : 'Típus szerkesztése'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className={shared.formError}>{error}</div>}
        <div className={shared.field}>
          <label htmlFor="tt-name">Név *</label>
          <input
            id="tt-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoFocus
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="tt-desc">Leírás</label>
          <textarea
            id="tt-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={isPending || !name.trim()}>
            {isPending ? 'Mentés…' : mode === 'create' ? 'Létrehozás' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
