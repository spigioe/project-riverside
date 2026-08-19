import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rolesClient, usersClient, CreateUserRequest, UpdateUserRequest, UserAdminDto, UserRole } from '../../api'
import badgeStyles from '../../components/Badge/Badge.module.css'
import { Modal } from '../../components/Modal/Modal'
import { getErrorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/labels'
import shared from '../../components/Settings/SettingsShared.module.css'

const ROLE_BADGE_VARIANT: Record<UserRole, string> = {
  [UserRole.MasterAdmin]: badgeStyles.dark,
  [UserRole.Admin]: badgeStyles.primary,
  [UserRole.Agent]: badgeStyles.green,
  [UserRole.Viewer]: badgeStyles.gray,
}

export function SettingsUsersPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserAdminDto | null>(null)

  const usersQuery = useQuery({
    queryKey: ['settings-users'],
    queryFn: () => usersClient.getAllUsers(),
  })

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesClient.getRoles(),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersClient.deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-users'] }),
  })

  const users = usersQuery.data ?? []
  const roles = rolesQuery.data ?? []

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Felhasználók és szerepkörök</h1>
          <div className={shared.subtitle}>{users.length} felhasználó</div>
        </div>
        <button type="button" className={shared.primaryButton} onClick={() => setCreateOpen(true)}>
          + Új felhasználó
        </button>
      </div>

      <div className={shared.card}>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Név</th>
                <th>Email</th>
                <th>Szerepkör</th>
                <th>Állapot</th>
                <th>Utolsó belépés</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading && (
                <tr><td colSpan={6} className={shared.emptyState}>Betöltés…</td></tr>
              )}
              {!usersQuery.isLoading && users.length === 0 && (
                <tr><td colSpan={6} className={shared.emptyState}>Nincs felhasználó.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td className={shared.muted}>{u.email}</td>
                  <td>
                    <span className={`${badgeStyles.badge} ${ROLE_BADGE_VARIANT[u.roleName!]}`}>
                      {ROLE_LABELS[u.roleName!]}
                    </span>
                  </td>
                  <td>
                    <span className={`${badgeStyles.badge} ${u.isActive ? badgeStyles.green : badgeStyles.gray}`}>
                      {u.isActive ? 'Aktív' : 'Inaktív'}
                    </span>
                  </td>
                  <td className={shared.mono}>{formatDateTime(u.lastLoginAt)}</td>
                  <td>
                    <div className={shared.actionsCell}>
                      <button type="button" className={shared.linkButton} onClick={() => setEditUser(u)}>
                        Szerkesztés
                      </button>
                      {u.isActive && (
                        <button
                          type="button"
                          className={shared.dangerButton}
                          disabled={deactivateMutation.isPending}
                          onClick={() => {
                            if (confirm(`Biztosan deaktiválod ${u.fullName} felhasználót?`)) {
                              deactivateMutation.mutate(u.id!)
                            }
                          }}
                        >
                          Deaktiválás
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CreateUserModal roles={roles} onClose={() => setCreateOpen(false)} />
      )}
      {editUser && (
        <EditUserModal user={editUser} roles={roles} onClose={() => setEditUser(null)} />
      )}
    </div>
  )
}

function CreateUserModal({ roles, onClose }: { roles: { id?: number; name?: UserRole }[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState(roles[0]?.id ?? 0)
  const [password, setPassword] = useState('')

  const createMutation = useMutation({
    mutationFn: () => usersClient.createUser(new CreateUserRequest({ email, fullName, roleId, password })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] })
      onClose()
    },
  })

  return (
    <Modal title="Új felhasználó" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
      >
        {createMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(createMutation.error, 'Nem sikerült létrehozni a felhasználót.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="new-email">Email cím</label>
          <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="new-name">Teljes név</label>
          <input id="new-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="new-role">Szerepkör</label>
          <select id="new-role" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{ROLE_LABELS[r.name!]}</option>
            ))}
          </select>
        </div>
        <div className={shared.field}>
          <label htmlFor="new-password">Jelszó</label>
          <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Létrehozás…' : 'Létrehozás'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({
  user, roles, onClose,
}: { user: UserAdminDto; roles: { id?: number; name?: UserRole }[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [roleId, setRoleId] = useState(user.roleId ?? 0)
  const [isActive, setIsActive] = useState(user.isActive ?? true)

  const updateMutation = useMutation({
    mutationFn: () => usersClient.updateUser(user.id!, new UpdateUserRequest({ fullName, roleId, isActive })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] })
      onClose()
    },
  })

  return (
    <Modal title={`${user.fullName} szerkesztése`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          updateMutation.mutate()
        }}
      >
        {updateMutation.isError && (
          <div className={shared.formError}>{getErrorMessage(updateMutation.error, 'Nem sikerült menteni a módosítást.')}</div>
        )}
        <div className={shared.field}>
          <label htmlFor="edit-name">Teljes név</label>
          <input id="edit-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className={shared.field}>
          <label htmlFor="edit-role">Szerepkör</label>
          <select id="edit-role" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{ROLE_LABELS[r.name!]}</option>
            ))}
          </select>
        </div>
        <div className={shared.field}>
          <label htmlFor="edit-active">Állapot</label>
          <select id="edit-active" value={isActive ? '1' : '0'} onChange={(e) => setIsActive(e.target.value === '1')}>
            <option value="1">Aktív</option>
            <option value="0">Inaktív</option>
          </select>
        </div>
        <div className={shared.formActions}>
          <button type="button" className={shared.secondaryButton} onClick={onClose}>Mégse</button>
          <button type="submit" className={shared.primaryButton} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
