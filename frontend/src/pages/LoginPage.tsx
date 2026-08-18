import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authClient, LoginRequest } from '../api'
import { useAuthStore } from '../store/useAuthStore'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: () => authClient.login(new LoginRequest({ email, password, rememberMe })),
    onSuccess: (result) => {
      setTokens(result.accessToken!, result.refreshToken!, {
        id: result.user!.id!,
        email: result.user!.email!,
        fullName: result.user!.fullName!,
        role: result.user!.role!,
      })
      navigate('/tickets', { replace: true })
    },
    onError: () => setError('Hibás email cím vagy jelszó.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    loginMutation.mutate()
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>S</div>
            <div>
              <div className={styles.brandName}>Support Portál</div>
              <div className={styles.brandSub}>Belső ügyfélszolgálati portál</div>
            </div>
          </div>

          <h1 className={styles.title}>Bejelentkezés a fiókjába</h1>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email">Email cím</label>
              <input
                id="email"
                type="email"
                placeholder="te@ceg.hu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Jelszó</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className={styles.rememberRow}>
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember">Megjegyez</label>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.submit} disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Bejelentkezés...' : 'Bejelentkezés →'}
            </button>
          </form>
        </div>
        <div className={styles.footer}>TLS 1.3 által védve · Csak belső használatra</div>
      </div>
    </div>
  )
}
