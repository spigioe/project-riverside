import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cannedResponsesClient,
  categoriesClient,
  CannedResponseDto,
  CategoryDto,
  CreateCannedResponseFolderRequest,
  CreateCannedResponseRequest,
  CreateCategoryRequest,
  UpdateCannedResponseRequest,
  UpdateCategoryRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsTicketsPage() {
  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Ticket beállítások</h1>
          <div className={shared.subtitle}>Kategóriák és válaszsablonok kezelése</div>
        </div>
      </div>

      <CategoriesSection />
      <CannedResponsesSection />
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
