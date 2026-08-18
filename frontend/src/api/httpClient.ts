import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/useAuthStore'

export const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

export const httpClient = axios.create({ baseURL })

const AUTH_PATHS = ['/api/portal/auth/login', '/api/portal/auth/refresh']

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

httpClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

// A folyamatban lévő refresh Promise-a — konkurens 401 válaszok ugyanarra várnak,
// mert a backend a refresh tokent rotálja (egyszer használatos), így egyidejű
// refresh hívások közül csak az első sikerülne.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState()
  if (!refreshToken) return null

  try {
    const response = await axios.post(`${baseURL}/api/portal/auth/refresh`, { refreshToken })
    const { accessToken, refreshToken: newRefreshToken, user } = response.data
    setTokens(accessToken, newRefreshToken, user)
    return accessToken
  } catch {
    logout()
    return null
  }
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined
    const isAuthPath = config && AUTH_PATHS.some((path) => config.url?.includes(path))

    if (error.response?.status !== 401 || !config || config._retry || isAuthPath) {
      throw error
    }

    config._retry = true

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })

    const newAccessToken = await refreshPromise
    if (!newAccessToken) {
      window.location.assign('/login')
      throw error
    }

    config.headers.set('Authorization', `Bearer ${newAccessToken}`)
    return httpClient(config)
  },
)
