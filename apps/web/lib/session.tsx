'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, type SessionUser } from './api'

type SessionState = {
  user: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionState>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: SessionUser }>('/auth/me')
      setUser(res.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}
