import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastStore, type Toast } from '../../store/useToastStore'
import styles from './Toast.module.css'

const AUTO_DISMISS_MS = 5000

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const navigate = useNavigate()

  useEffect(() => {
    const timeout = setTimeout(() => removeToast(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timeout)
  }, [toast.id, removeToast])

  function handleClick() {
    if (toast.ticketId) navigate(`/tickets/${toast.ticketId}`)
    removeToast(toast.id)
  }

  return (
    <div className={styles.toast} onClick={handleClick}>
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        className={styles.closeButton}
        onClick={(e) => {
          e.stopPropagation()
          removeToast(toast.id)
        }}
        aria-label="Bezárás"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
