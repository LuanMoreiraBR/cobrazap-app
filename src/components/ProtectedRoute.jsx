import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import UserPresenceReporter from './UserPresenceReporter'
import { getMyAccountStatus } from '../services/accountStatusService'

export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  const [checkingStatus, setCheckingStatus] = useState(true)
  const [accountStatus, setAccountStatus] = useState(null)

  useEffect(() => {
    async function checkAccount() {
      if (!isAuthenticated || !user?.id) {
        setCheckingStatus(false)
        return
      }

      try {
        const status = await getMyAccountStatus(user.id)
        setAccountStatus(status)
      } catch (error) {
        console.error('Erro ao verificar status da conta:', error)
      } finally {
        setCheckingStatus(false)
      }
    }

    if (!loading) {
      checkAccount()
    }
  }, [loading, isAuthenticated, user?.id])

  if (loading || checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Carregando...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  if (accountStatus?.is_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-[#070D2D]">
            Conta bloqueada
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sua conta foi bloqueada pela administração da Lembrei.
          </p>

          {accountStatus.blocked_reason ? (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {accountStatus.blocked_reason}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <UserPresenceReporter />
      {children}
    </>
  )
}