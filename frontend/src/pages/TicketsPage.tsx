import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { meClient, ticketClient, TicketListView, TicketStatus, TicketPriority } from '../api'
import { StatusBadge } from '../components/Badge/StatusBadge'
import { PriorityBadge } from '../components/Badge/PriorityBadge'
import { formatDateTime, formatTicketId } from '../lib/format'
import styles from './TicketsPage.module.css'

const PAGE_SIZE = 20

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const status = (searchParams.get('status') as TicketStatus | null) ?? undefined
  const priority = (searchParams.get('priority') as TicketPriority | null) ?? undefined
  const search = searchParams.get('search') ?? ''
  const page = Number(searchParams.get('page') ?? '1')

  const [searchInput, setSearchInput] = useState(search)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [view, setView] = useState<TicketListView>(TicketListView.Table)
  const [viewInitialized, setViewInitialized] = useState(false)

  const preferencesQuery = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => meClient.getPreferences(),
  })

  useEffect(() => {
    if (!viewInitialized && preferencesQuery.data) {
      setView(preferencesQuery.data.ticketListView!)
      setViewInitialized(true)
    }
  }, [preferencesQuery.data, viewInitialized])

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput || null, page: null })
      }
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tickets', status, priority, search, page],
    queryFn: () =>
      ticketClient.getTickets(status, priority, undefined, search || undefined, undefined, undefined, page, PAGE_SIZE),
  })

  const tickets = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  function toggleAll() {
    if (selected.size === tickets.length) setSelected(new Set())
    else setSelected(new Set(tickets.map((t) => t.id!)))
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Jegyek</h1>
          <div className={styles.subtitle}>{totalCount} jegy összesen</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <select
          className={styles.select}
          value={status ?? ''}
          onChange={(e) => updateParams({ status: e.target.value || null, page: null })}
        >
          <option value="">Minden státusz</option>
          <option value={TicketStatus.New}>Új</option>
          <option value={TicketStatus.Open}>Nyitott</option>
          <option value={TicketStatus.Pending}>Függőben</option>
          <option value={TicketStatus.Resolved}>Megoldva</option>
          <option value={TicketStatus.Closed}>Lezárva</option>
        </select>
        <select
          className={styles.select}
          value={priority ?? ''}
          onChange={(e) => updateParams({ priority: e.target.value || null, page: null })}
        >
          <option value="">Minden prioritás</option>
          <option value={TicketPriority.Low}>Alacsony</option>
          <option value={TicketPriority.Medium}>Közepes</option>
          <option value={TicketPriority.High}>Magas</option>
          <option value={TicketPriority.Urgent}>Sürgős</option>
        </select>
        <div className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Keresés tárgy, email, név szerint…"
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${view === TicketListView.Table ? styles.viewToggleButtonActive : ''}`}
            onClick={() => setView(TicketListView.Table)}
          >
            Táblázat
          </button>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${view === TicketListView.Card ? styles.viewToggleButtonActive : ''}`}
            onClick={() => setView(TicketListView.Card)}
          >
            Kártyák
          </button>
        </div>
      </div>

      <div className={styles.tableCard}>
        {view === TicketListView.Table ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCol}>
                    <input
                      type="checkbox"
                      checked={tickets.length > 0 && selected.size === tickets.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>#ID</th>
                  <th>Tárgy</th>
                  <th>Kérelmező</th>
                  <th>Státusz</th>
                  <th>Prioritás</th>
                  <th>Felelős</th>
                  <th>Kategória</th>
                  <th>Dátum</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className={styles.emptyCell}>Betöltés…</td></tr>
                )}
                {isError && (
                  <tr><td colSpan={9} className={styles.emptyCell}>Hiba történt a jegyek betöltésekor.</td></tr>
                )}
                {!isLoading && !isError && tickets.length === 0 && (
                  <tr><td colSpan={9} className={styles.emptyCell}>Nincs a szűrésnek megfelelő jegy.</td></tr>
                )}
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={selected.has(ticket.id!)}
                        onChange={() => toggleOne(ticket.id!)}
                      />
                    </td>
                    <td className={styles.mono}>{formatTicketId(ticket.id!)}</td>
                    <td className={styles.subjectCell}>
                      <Link to={`/tickets/${ticket.id}`} className={styles.subjectLink}>{ticket.subject}</Link>
                    </td>
                    <td className={styles.muted}>{ticket.requesterEmail}</td>
                    <td><StatusBadge status={ticket.status!} isMerged={ticket.isMerged} /></td>
                    <td><PriorityBadge priority={ticket.priority!} /></td>
                    <td>{ticket.assignedToName ?? '—'}</td>
                    <td className={styles.muted}>{ticket.categoryName ?? '—'}</td>
                    <td className={styles.mono}>{formatDateTime(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {isLoading && <div className={styles.emptyCell}>Betöltés…</div>}
            {isError && <div className={styles.emptyCell}>Hiba történt a jegyek betöltésekor.</div>}
            {!isLoading && !isError && tickets.length === 0 && (
              <div className={styles.emptyCell}>Nincs a szűrésnek megfelelő jegy.</div>
            )}
            {tickets.map((ticket) => (
              <Link key={ticket.id} to={`/tickets/${ticket.id}`} className={styles.ticketCard}>
                <div className={styles.ticketCardHeader}>
                  <span className={styles.mono}>{formatTicketId(ticket.id!)}</span>
                  <StatusBadge status={ticket.status!} isMerged={ticket.isMerged} />
                </div>
                <div className={styles.ticketCardSubject}>{ticket.subject}</div>
                <div className={styles.ticketCardMeta}>
                  {ticket.requesterName}
                  {ticket.requesterCompany && <span className={styles.muted}> · {ticket.requesterCompany}</span>}
                </div>
                {ticket.lastMessageBody && (
                  <div className={styles.ticketCardLastMessage}>
                    {ticket.lastMessageBody.length > 140 ? `${ticket.lastMessageBody.slice(0, 140)}…` : ticket.lastMessageBody}
                  </div>
                )}
                <div className={styles.ticketCardFooter}>
                  <PriorityBadge priority={ticket.priority!} />
                  <span className={styles.muted}>{ticket.assignedToName ?? 'Nincs hozzárendelve'}</span>
                </div>
                <div className={styles.mono}>{formatDateTime(ticket.lastMessageAt ?? ticket.createdAt)}</div>
              </Link>
            ))}
          </div>
        )}
        <div className={styles.pager}>
          <span className={styles.mono}>{rangeStart}–{rangeEnd} / {totalCount}</span>
          <div className={styles.pagerButtons}>
            <button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>‹</button>
            <span className={styles.pagerCurrent}>{page}</span>
            <span className={styles.muted}>/ {totalPages || 1}</span>
            <button disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>›</button>
          </div>
        </div>
      </div>
    </div>
  )
}
