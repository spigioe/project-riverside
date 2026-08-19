import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

interface RequireRoleProps {
  roles: string[]
}

export function RequireRole({ roles }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user)

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/tickets" replace />
  }

  return <Outlet />
}
