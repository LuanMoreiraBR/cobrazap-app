import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import {
  getSession,
  signIn as signInService,
  signOut as signOutService,
  signUp as signUpService,
} from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Erro ao carregar sessão:', error.message)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(credentials) {
    return signUpService(credentials)
  }

  async function signIn(credentials) {
    return signInService(credentials)
  }

  async function signOut() {
    await signOutService()
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      signUp,
      signIn,
      signOut,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}