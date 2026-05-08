import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isPlatformAdmin } from '../services/adminService'

export default function AdminRoute({ children }) {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    async function check() {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const admin = await isPlatformAdmin(user.id)
        setAllowed(Boolean(admin))
      } catch (error) {
        console.error('Erro ao verificar admin:', error)
        setAllowed(false)
      } finally {
        setLoading(false)
      }
    }

    check()
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
          Verificando acesso administrativo...
        </div>
      </div>
    )
  }

  if (!allowed) {
    return <Navigate to="/app" replace />
  }

  return children
}