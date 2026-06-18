import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  type AuthUser,
  buildGoogleLoginUrl,
  getCurrentAuth,
  logout as logoutRequest,
} from '@/api/auth'

type AuthStatus = 'anonymous' | 'authenticated' | 'loading'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  refresh: () => Promise<void>
  signInWithGoogle: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function currentReturnTo() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')

    try {
      const response = await getCurrentAuth()
      if (response.authenticated && response.user) {
        setUser(response.user)
        setStatus('authenticated')
        return
      }
    } catch {
      // Treat auth lookup failures as anonymous so the app remains usable.
    }

    setUser(null)
    setStatus('anonymous')
  }, [])

  const signInWithGoogle = useCallback(() => {
    window.location.assign(buildGoogleLoginUrl(currentReturnTo()))
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      status,
      user,
      refresh,
      signInWithGoogle,
      signOut,
    }),
    [refresh, signInWithGoogle, signOut, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }
  return context
}
