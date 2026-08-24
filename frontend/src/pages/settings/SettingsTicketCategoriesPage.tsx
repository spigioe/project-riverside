import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  categoriesClient,
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import shared from '../../components/Settings/SettingsShared.module.css'

type ModalState =
  | { kind: 'create-parent' }
  | { kind: 'create-child'; parentId: number; parentName: string }
  | { kind: 'edit'; category: CategoryDto; parentName: string | null }

export function SettingsTicketCategoriesPage() {
  const queryClient = useQueryClient()
  const treeQuery = useQuery({ queryKey: ['categories'], queryFn: () => categoriesClient.getTree() })
  const [modalState, setModalState] = useState<ModalState | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const tree = treeQuery.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesClient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err) => setDeleteError(getErrorMessage(err, 'Nem sikerült törölni a kategóriát.')),
  })

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSaved() {
    setModalState(null)
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Kategóriák</h1>
          <div className={shared.subtitle}>Ticket kategóriák és alkategóriák kezelése</div>
        </div>
        <button
          type="button"
          className={shared.primaryButton}
          onClick={() => setModalState({ kind: 'create-parent' })}
        >
          + Új kategória
        </button>
      </div>

      {deleteError && (
        <div className={shared.formError} style={{ marginBottom: 12 }}>{deleteError}</div>
      )}

      <div className={shared.card}>
        {treeQuery.isLoading && <div className={shared.emptyState}>Betöltés…</div>}
        {!treeQuery.isLoading && tree.length === 0 && (
          <div className={shared.emptyState}>Nincs kategória. Kattints a „+ Új kategória" gombra.</div>
        )}

        {tree.map((parent) => {
          const isExpanded = expanded.has(parent.id!)
          const children = parent.children ?? []

          return (
            <div key={parent.id}>
              {/* Parent sor */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px', borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(parent.id!)}
                    style={{
                      background: 'none', border: 'none', cursor: children.length > 0 ? 'pointer' : 'default',
                      padding: '0 4px', color: 'var(--text-muted)', fontSize: 12, width: 20,
                    }}
                    disabled={children.length === 0}
                  >
                    {children.length > 0 ? (isExpanded ? '▾' : '▸') : ''}
                  </button>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{parent.name}</span>
                  {children.length > 0 && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {children.length} alkategória
                    </span>
                  )}
                </div>
                <div className={shared.actionsCell}>
                  <button
                    type="button"
                    className={shared.linkButton}
                    onClick={() => {
                      setModalState({ kind: 'create-child', parentId: parent.id!, parentName: parent.name! })
                      setExpanded((p) => new Set([...p, parent.id!]))
                    }}
                  >
                    + Alkategória
                  </button>
                  <button
                    type="button"
                    className={shared.editButton}
                    onClick={() => setModalState({ kind: 'edit', category: parent, parentName: null })}
                  >
                    Szerkesztés
                  </button>
                  <button
                    type="button"
                    className={shared.deleteButton}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      setDeleteError(null)
                      if (confirm(`Biztosan törlöd a(z) „${parent.name}" kategóriát?`))
                        deleteMutation.mutate(parent.id!)
                    }}
                  >
                    Törlés
                  </button>
                </div>
              </div>

              {/* Alkategóriák (kihajtva) */}
              {isExpanded && children.map((child) => (
                <div
                  key={child.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px 9px 48px', borderBottom: '1px solid var(--border-light)',
                    background: 'var(--bg-alt)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>↳</span>
                    {child.name}
                  </span>
                  <div className={shared.actionsCell}>
                    <button
                      type="button"
                      className={shared.editButton}
                      onClick={() => setModalState({ kind: 'edit', category: child, parentName: parent.name! })}
                    >
                      Szerkesztés
                    </button>
                    <button
                      type="button"
                      className={shared.deleteButton}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        setDeleteError(null)
                        if (confirm(`Biztosan törlöd a(z) „${child.name}" alkategóriát?`))
                          deleteMutation.mutate(child.id!)
                      }}
                    >
                      Törlés
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {modalState && (
        <CategoryModal state={modalState} onClose={() => setModalState(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

function CategoryModal({
  state,
  onClose,
  onSaved,
}: {
  state: ModalState
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = state.kind === 'edit'
  const isCreateChild = state.kind === 'create-child'
  const category = isEdit ? (state as Extract<ModalState, { kind: 'edit' }>).category : undefined
  const parentName = isEdit
    ? (state as Extract<ModalState, { kind: 'edit' }>).parentName
    : isCreateChild
    ? (state as Extract<ModalState, { kind: 'create-child' }>).parentName
    : null
  const parentId = isCreateChild
    ? (state as Extract<ModalState, { kind: 'create-child' }>).parentId
    : category?.parentId

  const [name, setName] = useState(category?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  const title = isEdit
    ? (parentName ? 'Alkategória szerkesztése' : 'Kategória szerkesztése')
    : isCreateChild ? 'Új alkategória' : 'Új kategória'

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await categoriesClient.update(
          category!.id!,
          new UpdateCategoryRequest({ name, parentId: category?.parentId }),
        )
      } else {
        await categoriesClient.create(new CreateCategoryRequest({ name, parentId }))
      }
    },
    onSuccess: onSaved,
    onError: (err) => setError(getErrorMessage(err, 'Nem sikerült menteni.')),
  })

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}>
        {error && <div className={shared.formError}>{error}</div>}

        {parentName && (
          <div className={shared.formGroup}>
            <label className={shared.formLabel}>Szülő kategória</label>
            <div
              style={{
                padding: '8px 11px',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)',
                fontSize: 13.5,
                color: 'var(--text-muted)',
              }}
            >
              {parentName}
            </div>
          </div>
        )}

        <div className={shared.formGroup}>
          <label className={shared.formLabel}>Név *</label>
          <input
            className={shared.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className={shared.formActions}>
          <button type="button" className={shared.cancelButton} onClick={onClose}>Mégse</button>
          <button
            type="submit"
            className={shared.primaryButton}
            disabled={saveMutation.isPending || !name.trim()}
          >
            {saveMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
