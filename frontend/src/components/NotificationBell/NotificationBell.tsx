import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDateTime } from '../../lib/format'
import styles from './NotificationBell.module.css'

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleItemClick(id: number, ticketId: number | undefined) {
    markAsRead(id)
    setIsOpen(false)
    if (ticketId) navigate(`/tickets/${ticketId}`)
  }

  const visible = notifications.slice(0, 10)

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Értesítések"
      >
        <svg width="19" height="19" viewBox="0 0 19 19" fill="none" stroke="#585C6D" strokeWidth="1.5" strokeLinecap="round">
          <path d="M9.5 2a5.5 5.5 0 015.5 5.5c0 3.3.8 5.1 1.4 6H2.6C3.2 12.6 4 10.8 4 7.5A5.5 5.5 0 019.5 2z" />
          <path d="M7.8 15a2 2 0 003.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Értesítések</span>
            {notifications.length > 0 && (
              <button type="button" className={styles.markAllButton} onClick={() => markAllAsRead()}>
                Mindet olvasottnak jelöl
              </button>
            )}
          </div>
          <div className={styles.list}>
            {visible.length === 0 && <div className={styles.empty}>Nincs új értesítés.</div>}
            {visible.map((n) => (
              <button
                key={n.id}
                type="button"
                className={styles.item}
                onClick={() => handleItemClick(n.id!, n.ticketId)}
              >
                <span className={styles.itemDot} />
                <span className={styles.itemBody}>
                  <span className={styles.itemMessage}>{n.message}</span>
                  <span className={styles.itemTime}>{formatDateTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
