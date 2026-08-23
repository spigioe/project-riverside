import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cannedResponsesClient,
  categoriesClient,
  customFieldDefinitionsClient,
  CannedResponseDto,
  CategoryDto,
  CreateCannedResponseFolderRequest,
  CreateCannedResponseRequest,
  CreateCategoryRequest,
  CreateCustomFieldDefinitionRequest,
  CustomFieldDefinitionDto,
  CustomFieldType,
  UpdateCannedResponseRequest,
  UpdateCategoryRequest,
  UpdateCustomFieldDefinitionRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import badgeStyles from '../../components/Badge/Badge.module.css'
import { getErrorMessage } from '../../lib/errors'
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

export function SettingsTicketsPage() {
  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Ticket beállítások</h1>
          <div className={shared.subtitle}>Kategóriák, válaszsablonok és egyéni mezők kezelése</div>
        </div>
      </div>

      <CategoriesSection />
      <CannedResponsesSection />
      <CustomFieldsSection />
    </div>
  )
}

function flattenCategories(nodes: CategoryDto[], depth = 0): { id: number; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id!, label: `${'— '.repeat(depth)}${n.name}` },
    ...flattenCategories(n.children ?? [], depth + 1),
  ])
}

function CategoriesSection() {
  const queryClient = useQueryClient()
  const treeQuery = useQuery({ queryKey: ['categories'], queryFn: () => categoriesClient.getTree() })
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; category?: CategoryDto } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tree = treeQuery.data ?? []
  const flat = flattenCategories(tree)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesClient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült törölni a kategóriát.')),
  })

  function renderRows(nodes: CategoryDto[], depth = 0): ReactNode[] {
    return nodes.flatMap((node) => [
      <div
        key={node.id}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--border-light)',
        }}
      >
        <span style={{ paddingLeft: depth * 20, fontSize: 13.5 }}>{node.name}</span>
        <div className={shared.actionsCell}>
          <button type="button" className={shared.linkButton} onClick={() => setModalState({ mode: 'create', category: node })}>
            + Alkategória
          </button>
          <button type="button" className={shared.linkButton} onClick={() => setModalState({ mode: 'edit', category: node })}>
            Szerkesztés
          </button>
          <button
            type="button"
            className={shared.dangerButton}
            onClick={() => {
              setError(null)
              if (confirm(`Biztosan törlöd a(z) "${node.name}" kategóriát?`)) deleteMutation.mutate(node.id!)
            }}
          >
            Törlés
          </button>
        </div>
      </div>,
      ...renderRows(node.children ?? [], depth + 1),
    ])
  }

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Kategóriák</span>
        <button type="button" className={shared.primaryButton} onClick={() => setModalState({ mode: 'create' })}>
          + Új kategória
        </button>
      </div>
      {error && <div className={shared.formError} style={{ margin: '12px 16px 0' }}>{error}</div>}
      {treeQuery.isLoading && <div className={shared.emptyState}>Betöltés…</div>}
      {!treeQuery.isLoading && tree.length === 0 && <div className={shared.emptyState}>Nincs kategória.</div>}
      {renderRows(tree)}

      {modalState && (
        <CategoryModal
          mode={modalState.mode}
          category={modalState.category}
          parentOptions={flat}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}

function CategoryModal({
  mode, category, parentOptions, onClose,
}: {
  mode: 'create' | 'edit'
  category?: CategoryDto
  parentOptions: { id: number; label: string }[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const isSubcategoryOf = mode === 'create' ? category?.id : undefined
  const [name, setName] = useState(mode === 'edit' ? category?.name ?? '' : '')
  const [parentId, setParentId] = useState<number>(
    mode === 'edit' ? category?.parentId ?? 0 : isSubcategoryOf ?? 0,
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        await categoriesClient.create(new CreateCategoryRequest({ name, parentId: parentId || undefined }))
        return
      }
      await categoriesClient.update(category!.id!, new UpdateCategoryRequest({ name, parentId: parentId || undefined }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
  })

  return (
    <Modal title={mode === 'create' ? 'Új kategória' : 'Kategória szerkesztése'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}>
        {saveMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(saveMutation.error, 'Nem sikerült menteni a kategóriát.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="cat-name">Név</label>
          <input id="cat-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="cat-parent">Szülő kategória</label>
          <select id="cat-parent" value={parentId} onChange={(e) => setParentId(Number(e.target.value))}>
            <option value={0}>— Nincs (gyökér) —</option>
            {parentOptions.filter((p) => p.id !== category?.id).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CannedResponsesSection() {
  const queryClient = useQueryClient()
  const foldersQuery = useQuery({ queryKey: ['canned-folders'], queryFn: () => cannedResponsesClient.getFolders() })
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [responseModal, setResponseModal] = useState<{ mode: 'create' | 'edit'; response?: CannedResponseDto } | null>(null)

  const folders = foldersQuery.data ?? []
  const activeFolderId = selectedFolderId ?? folders[0]?.id ?? null

  const responsesQuery = useQuery({
    queryKey: ['canned-responses', activeFolderId],
    queryFn: () => cannedResponsesClient.getResponses(activeFolderId!),
    enabled: activeFolderId !== null,
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => cannedResponsesClient.deleteFolder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canned-folders'] }),
  })

  const deleteResponseMutation = useMutation({
    mutationFn: (id: number) => cannedResponsesClient.deleteResponse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canned-responses', activeFolderId] }),
  })

  const responses = responsesQuery.data ?? []

  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Válaszsablonok</span>
        <button type="button" className={shared.primaryButton} onClick={() => setFolderModalOpen(true)}>
          + Új mappa
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 200 }}>
        <div style={{ borderRight: '1px solid var(--border-light)' }}>
          {folders.length === 0 && <div className={shared.emptyState}>Nincs mappa.</div>}
          {folders.map((f) => (
            <div
              key={f.id}
              onClick={() => setSelectedFolderId(f.id!)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                background: f.id === activeFolderId ? 'var(--primary-tint-bg)' : undefined,
                color: f.id === activeFolderId ? 'var(--primary)' : 'var(--text)',
                fontWeight: f.id === activeFolderId ? 600 : 400,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid var(--border-light)',
              }}
            >
              <span>{f.name}</span>
              <button
                type="button"
                className={shared.linkButton}
                style={{ padding: 2 }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Biztosan törlöd a(z) "${f.name}" mappát?`)) deleteFolderMutation.mutate(f.id!)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div>
          {activeFolderId !== null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px' }}>
                <button type="button" className={shared.linkButton} onClick={() => setResponseModal({ mode: 'create' })}>
                  + Új válasz
                </button>
              </div>
              {responses.length === 0 && <div className={shared.emptyState}>Nincs válaszsablon ebben a mappában.</div>}
              {responses.map((r) => (
                <div key={r.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</span>
                    <div className={shared.actionsCell}>
                      <button type="button" className={shared.linkButton} onClick={() => setResponseModal({ mode: 'edit', response: r })}>
                        Szerkesztés
                      </button>
                      <button
                        type="button"
                        className={shared.dangerButton}
                        onClick={() => {
                          if (confirm(`Biztosan törlöd a(z) "${r.title}" választ?`)) deleteResponseMutation.mutate(r.id!)
                        }}
                      >
                        Törlés
                      </button>
                    </div>
                  </div>
                  <div className={shared.muted} style={{ fontSize: 12.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.body}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {folderModalOpen && <FolderModal onClose={() => setFolderModalOpen(false)} />}
      {responseModal && activeFolderId !== null && (
        <ResponseModal
          mode={responseModal.mode}
          response={responseModal.response}
          folderId={activeFolderId}
          onClose={() => setResponseModal(null)}
        />
      )}
    </div>
  )
}

function FolderModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const createMutation = useMutation({
    mutationFn: () => cannedResponsesClient.createFolder(new CreateCannedResponseFolderRequest({ name, displayOrder: 0 })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-folders'] })
      onClose()
    },
  })

  return (
    <Modal title="Új mappa" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
        {createMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(createMutation.error, 'Nem sikerült létrehozni a mappát.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="folder-name">Mappa neve</label>
          <input id="folder-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={createMutation.isPending}>Létrehozás</button>
        </div>
      </form>
    </Modal>
  )
}

function ResponseModal({
  mode, response, folderId, onClose,
}: { mode: 'create' | 'edit'; response?: CannedResponseDto; folderId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(response?.title ?? '')
  const [body, setBody] = useState(response?.body ?? '')

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        await cannedResponsesClient.createResponse(new CreateCannedResponseRequest({ folderId, title, body }))
        return
      }
      await cannedResponsesClient.updateResponse(response!.id!, new UpdateCannedResponseRequest({ title, body, isActive: true }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses', folderId] })
      onClose()
    },
  })

  return (
    <Modal title={mode === 'create' ? 'Új válaszsablon' : 'Válaszsablon szerkesztése'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}>
        {saveMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(saveMutation.error, 'Nem sikerült menteni a választ.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="resp-title">Cím</label>
          <input id="resp-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="resp-body">Szöveg</label>
          <textarea id="resp-body" value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CustomFieldsSection() {
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
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <span className={shared.cardHeaderTitle}>Egyéni mezők</span>
        <button type="button" className={shared.primaryButton} onClick={() => setModalState({ mode: 'create' })}>
          + Új mező
        </button>
      </div>
      {error && <div className={shared.formError} style={{ margin: '12px 16px 0' }}>{error}</div>}
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
                  <div className={shared.actionsCell}>
                    <button type="button" className={shared.linkButton} onClick={() => setModalState({ mode: 'edit', field: f })}>
                      Szerkesztés
                    </button>
                    <button
                      type="button"
                      className={shared.dangerButton}
                      disabled={deactivateMutation.isPending}
                      onClick={() => {
                        setError(null)
                        if (confirm(`Biztosan deaktiválod a(z) "${f.name}" mezőt?`)) deactivateMutation.mutate(f.id!)
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
          <select
            id="cf-type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
          >
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
          <input
            id="cf-required"
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
          />
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
