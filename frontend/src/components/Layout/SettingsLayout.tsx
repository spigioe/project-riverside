import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import styles from './SettingsLayout.module.css'

const MENU_ITEMS = [
  { to: '/settings/users', label: 'Felhasználók és szerepkörök' },
  { to: '/settings/sla', label: 'SLA konfiguráció' },
  { to: '/settings/email', label: 'Email konfiguráció' },
  { to: '/settings/notifications', label: 'Értesítések' },
  { to: '/settings/tickets', label: 'Ticket beállítások' },
  { to: '/settings/csm', label: 'CSM kezelés' },
  { to: '/settings/contacts', label: 'Kontaktok' },
  { to: '/settings/companies', label: 'Cégek' },
  { to: '/settings/integration', label: 'Integráció' },
]

export function SettingsLayout() {
  const user = useAuthStore((state) => state.user)
  const isMasterAdmin = user?.role === 'MasterAdmin'

  return (
    <div className={styles.wrap}>
      <aside className={styles.submenu}>
        <div className={styles.submenuTitle}>Beállítások</div>
        <nav>
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.submenuLink} ${isActive ? styles.submenuLinkActive : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          {isMasterAdmin && (
            <NavLink
              to="/settings/system"
              className={({ isActive }) => `${styles.submenuLink} ${isActive ? styles.submenuLinkActive : ''}`}
            >
              Rendszer
            </NavLink>
          )}
        </nav>
      </aside>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
