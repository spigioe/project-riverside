import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  customFieldDefinitionsClient,
  CreateCustomFieldDefinitionRequest,
  CustomFieldDefinitionDto,
  CustomFieldType,
  UpdateCustomFieldDefinitionRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import badgeStyles from '../../components/Badge/Badge.module.css'
import shared from '../../components/Settings/SettingsShared.module.css'

const CUSTOM_FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: CustomFieldType.Text, label: 'Szöveg' },
  { value: CustomFieldType.Select, label: 'Legördülő' },
  { value: CustomFieldType.Boolean, label: 'Jelölőnégyzet' },
]

const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  [CustomFieldType.Text]: 'SZÖVEG',
  [CustomFieldType.Number]: 'SZÁM',
  [CustomFieldType.Date]: 'DÁTUM',
  [CustomFieldType.Boolean]: 'JELÖLŐNÉGYZET',
  [CustomFieldType.Select]: 'LEGÖRDÜLŐ',
}

export function SettingsTicketPropertiesPage() {
  const queryClient = useQueryClient()
  const definitionsQuery = useQuery({
    queryKey: ['custom-field-definitions'],
    queryFn: () => customFieldDefinitionsClient.getDefinitions(),
  })
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; field?: CustomFieldDefinitionDto } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [orderedDefs, setOrderedDefs] = useState<CustomFieldDefinitionDto[]>([])
  const dragIndex = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    if (definitionsQuery.data) {
      setOrderedDefs([...definitionsQuery.data].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)))
    }
  }, [definitionsQuery.data])

  const reorderMutation = useMutation({
    mutationFn: async (items: CustomFieldDefinitionDto[]) => {
      await Promise.all(items.map((f) =>
        customFieldDefinitionsClient.updateDefinition(f.id!, new UpdateCustomFieldDefinitionRequest({
          name: f.name!,
          fieldType: f.fieldType!,
          isRequired: f.isRequired ?? false,
          options: f.fieldType === CustomFieldType.Select ? (f.options ?? undefined) : undefined,
          displayOrder: f.displayOrder!,
        }))
      ))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] }),
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
    const next = [...orderedDefs]
    const [moved] = next.splice(from, 1)
    next.splice(dropIdx, 0, moved)
    const updated = next.map((f, i) => CustomFieldDefinitionDto.fromJS({ ...f, displayOrder: i }))
    setOrderedDefs(updated)
    const origMap = new Map((definitionsQuery.data ?? []).map((f) => [f.id, f.displayOrder]))
    const changed = updated.filter((f) => origMap.get(f.id) !== f.displayOrder)
    if (changed.length) reorderMutation.mutate(changed)
  }

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => customFieldDefinitionsClient.deactivateDefinition(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] }),
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült deaktiválni a mezőt.')),
  })

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Egyéni mezők</h1>
          <div className={shared.subtitle}>Ticket tulajdonságok és egyéni mezők kezelése</div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={() => setModalState({ mode: 'create' })}>
          + Új mező
        </button>
      </div>

      {error && <div className={shared.formError} style={{ marginBottom: 12 }}>{error}</div>}

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Név</th>
                <th>Típus</th>
                <th>Kötelező</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {definitionsQuery.isLoading && (
                <tr><td colSpan={5} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {!definitionsQuery.isLoading && orderedDefs.length === 0 && (
                <tr><td colSpan={5} className={shared.emptyState}>Nincs egyéni mező definiálva.</td></tr>
              )}
              {orderedDefs.map((f, idx) => (
                <tr
                  key={f.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragOverIdx(null); dragIndex.current = null }}
                  style={{ borderTop: dragOverIdx === idx && dragIndex.current !== idx ? '2px solid var(--primary)' : undefined }}
                >
                  <td style={{ textAlign: 'center', cursor: 'grab', color: 'var(--text-muted)', userSelect: 'none', fontSize: 14 }}>⠿</td>
                  <td>{f.name}</td>
                  <td>
                    <span className={`${badgeStyles.badge} ${badgeStyles.gray}`}>{CUSTOM_FIELD_TYPE_LABELS[f.fieldType!]}</span>
                  </td>
                  <td className={shared.muted}>{f.isRequired ? 'Igen' : 'Nem'}</td>
                  <td>
                    <div className={shared.rowActions}>
                      <button type="button" className={shared.editButton} onClick={() => setModalState({ mode: 'edit', field: f })}>
                        Szerkesztés
                      </button>
                      <button
                        type="button"
                        className={shared.deleteButton}
                        disabled={deactivateMutation.isPending}
                        onClick={() => {
                          setError(null)
                          if (confirm(`Biztosan deaktiválod a(z) „${f.name}" mezőt?`)) deactivateMutation.mutate(f.id!)
                        }}
                      >
                        Deaktiválás
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalState && (
        <CustomFieldModal
          mode={modalState.mode}
          field={modalState.field}
          nextOrder={orderedDefs.length}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}

function CustomFieldModal({
  mode, field, nextOrder = 0, onClose,
}: { mode: 'create' | 'edit'; field?: CustomFieldDefinitionDto; nextOrder?: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(field?.name ?? '')
  const [fieldType, setFieldType] = useState<CustomFieldType>(field?.fieldType ?? CustomFieldType.Text)
  const [optionsInput, setOptionsInput] = useState((field?.options ?? []).join(', '))
  const [isRequired, setIsRequired] = useState(field?.isRequired ?? false)
  const displayOrder = field?.displayOrder ?? nextOrder

  const options = optionsInput.split(',').map((o) => o.trim()).filter(Boolean)

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        await customFieldDefinitionsClient.createDefinition(new CreateCustomFieldDefinitionRequest({
          name,
          fieldKey: undefined,
          fieldType,
          isRequired,
          options: fieldType === CustomFieldType.Select ? options : undefined,
          displayOrder,
        }))
        return
      }
      await customFieldDefinitionsClient.updateDefinition(field!.id!, new UpdateCustomFieldDefinitionRequest({
        name,
        fieldType,
        isRequired,
        options: fieldType === CustomFieldType.Select ? options : undefined,
        displayOrder,
      }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] })
      onClose()
    },
  })

  return (
    <Modal title={mode === 'create' ? 'Új egyéni mező' : `${field?.name} szerkesztése`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}>
        {saveMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(saveMutation.error, 'Nem sikerült menteni az egyéni mezőt.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="cf-name">Név</label>
          <input id="cf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="cf-type">Típus</label>
          <select id="cf-type" value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>
            {CUSTOM_FIELD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {fieldType === CustomFieldType.Select && (
          <div className={shared.field}>
            <label htmlFor="cf-options">Opciók (vesszővel elválasztva)</label>
            <input
              id="cf-options"
              type="text"
              placeholder="Alacsony, Közepes, Magas"
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
            />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="cf-required" type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          <label htmlFor="cf-required" style={{ margin: 0 }}>Kötelező mező</label>
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button
            type="submit"
            className={shared.primaryButton}
            disabled={saveMutation.isPending || !name.trim() || (fieldType === CustomFieldType.Select && options.length === 0)}
          >
            {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
