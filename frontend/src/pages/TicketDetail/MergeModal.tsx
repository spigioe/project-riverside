import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MergeTicketRequest, TicketSearchResultDto, ticketClient } from '../../api'
import { Modal } from '../../components/Modal/Modal'
import { StatusBadge } from '../../components/Badge/StatusBadge'
import shared from '../../components/Settings/SettingsShared.module.css'
import { useToastStore } from '../../store/useToastStore'
import { getErrorMessage } from '../../lib/errors'
import styles from '../TicketDetailPage.module.css'

interface MergeModalProps {
  ticketId: number
  onClose: () => void
}

export function MergeModal({ ticketId, onClose }: MergeModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selected, setSelected] = useState<TicketSearchResultDto | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const searchQuery = useQuery({
    queryKey: ['ticket-search', debouncedQuery],
    queryFn: () => ticketClient.searchTickets(debouncedQuery, 10),
    enabled: debouncedQuery.length > 0,
  })

  const results = (searchQuery.data ?? []).filter((r) => r.id !== ticketId)

  const mergeMutation = useMutation({
    mutationFn: () => ticketClient.mergeTicket(ticketId, new MergeTicketRequest({ targetTicketId: selected!.id })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selected!.id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      addToast({ message: `#${ticketId} összevonva a(z) #${selected!.id} tickettel.`, ticketId: selected!.id })
      navigate(`/tickets/${selected!.id}`)
    },
  })

  return (
    <Modal title="Ticket összevonása" onClose={onClose} maxWidth={560}>
      {!selected ? (
        <>
          <div className={shared.field}>
            <label htmlFor="merge-search">Keresés ticket ID vagy tárgy alapján</label>
            <input
              id="merge-search"
              type="text"
              autoFocus
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="pl. 42 vagy „nem tölt be”"
            />
          </div>
          {searchQuery.isLoading && <div className={styles.emptyState}>Keresés…</div>}
          {debouncedQuery.length > 0 && !searchQuery.isLoading && results.length === 0 && (
            <div className={styles.emptyState}>Nincs találat.</div>
          )}
          {results.length > 0 && (
            <div className={styles.clickUpList}>
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={styles.searchResultItem}
                  onClick={() => setSelected(r)}
                >
                  <div className={styles.clickUpItemHeader}>
                    <span className={styles.clickUpTaskLink}>#{r.id} — {r.subject}</span>
                    <StatusBadge status={r.status!} />
                  </div>
                  <div className={styles.clickUpMeta}>{r.requesterEmail}</div>
                </button>
              ))}
            </div>
          )}
          <div className={shared.formActions}>
            <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          </div>
        </>
      ) : (
        <>
          {mergeMutation.isError && (
            <div className={shared.formError}>{getErrorMessage(mergeMutation.error, 'Nem sikerült összevonni a jegyeket.')}</div>
          )}
          <p>
            Ez a ticket (#{ticketId}) összevonásra kerül a(z) #{selected.id} tickettel. Az összevont ticket lezárul.
          </p>
          <div className={shared.formActions}>
            <button
              type="button"
              className={shared.secondaryButton}
              onClick={() => setSelected(null)}
              disabled={mergeMutation.isPending}
            >
              Vissza
            </button>
            <button
              type="button"
              className={shared.primaryButton}
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
            >
              {mergeMutation.isPending ? 'Összevonás…' : 'Összevonás'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
