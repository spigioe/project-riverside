import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { authClient, RefreshRequest } from '../../api'
import { useAuthStore } from '../../store/useAuthStore'
import { NotificationBell } from '../NotificationBell/NotificationBell'
import { ToastContainer } from '../Toast/ToastContainer'
import styles from './AppLayout.module.css'

const ROLE_LABELS: Record<string, string> = {
  MasterAdmin: 'Rendszergazda',
  Admin: 'Admin',
  Agent: 'Ügyintéző',
  Viewer: 'Megtekintő',
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]]
  return initials.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function TicketsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
      <line x1="4" y1="5" x2="10" y2="5" />
      <line x1="4" y1="7.5" x2="10" y2="7.5" />
      <line x1="4" y1="10" x2="7" y2="10" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1.5v1.5M7 11v1.5M1.5 7H3M11 7h1.5M3.2 3.2l1 1M9.8 9.8l1 1M3.2 10.8l1-1M9.8 4.2l1-1" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6" cy="6" r="4.5" />
      <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" />
    </svg>
  )
}

export function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    try {
      await authClient.logout(new RefreshRequest({ refreshToken: refreshToken ?? undefined }))
    } catch {
      // a kijelentkezés helyi állapotát a szerver hívás sikerétől függetlenül töröljük
    }
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>S</div>
          <div>
            <div className={styles.brandName}>Support Portál</div>
            <div className={styles.brandSub}>agent console</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <div className={styles.navSection}>Menü</div>
          <NavLink
            to="/tickets"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            <span className={styles.navIcon}><TicketsIcon /></span>
            Jegyek
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            <span className={styles.navIcon}><SettingsIcon /></span>
            Beállítások
          </NavLink>
        </nav>
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input type="text" placeholder="Keresés jegyek, azonosítók, bejelentők között…" className={styles.searchInput} />
          </div>
          <div className={styles.topbarActions}>
            <NotificationBell />
            {user && (
              <div className={styles.userMenuWrap} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.userBlock}
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  aria-label="Felhasználói menü"
                >
                  <div className={styles.avatar}>{getInitials(user.fullName)}</div>
                  <div>
                    <div className={styles.userName}>{user.fullName}</div>
                    <div className={styles.userRole}>{ROLE_LABELS[user.role] ?? user.role}</div>
                  </div>
                </button>
                {isUserMenuOpen && (
                  <div className={styles.userDropdown}>
                    <button
                      type="button"
                      className={styles.userDropdownItem}
                      onClick={handleLogout}
                    >
                      Kijelentkezés
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
