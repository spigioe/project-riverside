import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cannedResponsesClient,
  CannedResponseDto,
  CreateCannedResponseFolderRequest,
  CreateCannedResponseRequest,
  UpdateCannedResponseRequest,
} from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import shared from '../../components/Settings/SettingsShared.module.css'

export function SettingsTicketTemplatesPage() {
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
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Válaszsablonok</h1>
          <div className={shared.subtitle}>Canned response-ok kezelése mappák szerint</div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={() => setFolderModalOpen(true)}>
          + Új mappa
        </button>
      </div>

      <div className={shared.card}>
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
                    if (confirm(`Biztosan törlöd a(z) „${f.name}" mappát?`)) deleteFolderMutation.mutate(f.id!)
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
                {responses.length === 0 && (
                  <div className={shared.emptyState}>Nincs válaszsablon ebben a mappában.</div>
                )}
                {responses.map((r) => (
                  <div key={r.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</span>
                      <div className={shared.actionsCell}>
                        <button
                          type="button"
                          className={shared.editButton}
                          onClick={() => setResponseModal({ mode: 'edit', response: r })}
                        >
                          Szerkesztés
                        </button>
                        <button
                          type="button"
                          className={shared.deleteButton}
                          onClick={() => {
                            if (confirm(`Biztosan törlöd a(z) „${r.title}" választ?`))
                              deleteResponseMutation.mutate(r.id!)
                          }}
                        >
                          Törlés
                        </button>
                      </div>
                    </div>
                    <div className={shared.muted} style={{ fontSize: 12.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {r.body}
                    </div>
                  </div>
                ))}
              </>
            )}
            {activeFolderId === null && folders.length > 0 && (
              <div className={shared.emptyState}>Válassz egy mappát.</div>
            )}
          </div>
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
    mutationFn: () =>
      cannedResponsesClient.createFolder(new CreateCannedResponseFolderRequest({ name, displayOrder: 0 })),
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
      await cannedResponsesClient.updateResponse(
        response!.id!,
        new UpdateCannedResponseRequest({ title, body, isActive: true }),
      )
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
