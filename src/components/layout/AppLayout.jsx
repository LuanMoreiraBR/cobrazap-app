import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabaseClient'
import { getPaymentAccount } from '../../services/paymentAccountService'
import { getUserSubscription } from '../../services/platformBillingService'
import {
  getNotificationPermission,
  isPushSupported,
  subscribeToPushNotifications,
} from '../../services/pushNotificationService'
import UsageBadge from '../UsageBadge'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()

  const [profileName, setProfileName] = useState('')
  const [mpConnected, setMpConnected] = useState(null)
  const [hasPaidPlan, setHasPaidPlan] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle()
      setProfileName(data?.name || '')
    }

    async function checkMpAccount() {
      if (!user?.id) return
      try {
        const account = await getPaymentAccount(user.id)
        setMpConnected(!!account)
      } catch {
        setMpConnected(false)
      }
    }

    async function checkSubscription() {
      if (!user?.id) return
      try {
        const sub = await getUserSubscription(user.id)
        setHasPaidPlan(sub !== null && Number(sub?.plan?.price ?? 0) > 0)
      } catch {
        setHasPaidPlan(false)
      }
    }

    async function requestPushPermission() {
      if (!user?.id || !isPushSupported()) return
      if (getNotificationPermission() !== 'denied') {
        await subscribeToPushNotifications(user.id)
      }
    }

    loadProfile()
    checkMpAccount()
    checkSubscription()
    requestPushPermission()
  }, [user])

  const userName =
    profileName ||
    user?.user_metadata?.name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email ||
    'Usuário'

  const userInitial = userName?.charAt(0)?.toUpperCase() || 'U'

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <style>{`
        @keyframes plan-attention {
          0%, 80%, 100% { transform: rotate(0deg); }
          82% { transform: rotate(-14deg); }
          84% { transform: rotate(14deg); }
          86% { transform: rotate(-10deg); }
          88% { transform: rotate(10deg); }
          90% { transform: rotate(-6deg); }
          92% { transform: rotate(6deg); }
          94% { transform: rotate(-3deg); }
          96% { transform: rotate(3deg); }
        }
        .plan-shake { animation: plan-attention 3.5s ease-in-out infinite; }
      `}</style>

      <Sidebar userName={userName} hasPaidPlan={hasPaidPlan} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
        <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
                Painel
              </p>
              <h2 className="text-xl font-bold text-[#070D2D]">Olá, {userName}</h2>
            </div>
            <div className="flex justify-start md:justify-end">
              <UsageBadge />
            </div>
          </div>

          {mpConnected === false && location.pathname !== '/app/configuracoes' && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="shrink-0 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                  Você ainda não conectou sua conta Mercado Pago. Sem isso, não é possível gerar
                  PIX para as cobranças.
                </p>
              </div>
              <Link
                to="/app/configuracoes"
                className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Conectar agora
              </Link>
            </div>
          )}

          <Outlet />
        </div>
      </main>

      <BottomNav
        userName={userName}
        userInitial={userInitial}
        hasPaidPlan={hasPaidPlan}
        onLogout={handleLogout}
      />
    </div>
  )
}
