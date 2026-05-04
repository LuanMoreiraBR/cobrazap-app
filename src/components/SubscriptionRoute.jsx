import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserSubscription,
  isSubscriptionActive,
} from '../services/platformBillingService'

export default function SubscriptionRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)

  useEffect(() => {
    async function checkSubscription() {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const subscription = await getUserSubscription(user.id)
        setHasActiveSubscription(isSubscriptionActive(subscription))
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error)
        setHasActiveSubscription(false)
      } finally {
        setLoading(false)
      }
    }

    checkSubscription()
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
          Verificando assinatura...
        </div>
      </div>
    )
  }

  if (!hasActiveSubscription) {
    return <Navigate to="/planos" replace state={{ from: location }} />
  }

  return children
}