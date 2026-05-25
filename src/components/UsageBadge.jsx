import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getExtraMessageCredits,
  getUserMonthlyUsage,
  getUserSubscription,
  isSubscriptionActive,
} from '../services/platformBillingService'

const FREE_TRIAL_MESSAGE_LIMIT = 10
const FREE_TRIAL_CLIENT_LIMIT = 10

export default function UsageBadge() {
  const { user } = useAuth()

  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [extraCredits, setExtraCredits] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user?.id) return

      setLoading(true)

      try {
        const [subscriptionData, usageData, extraCreditsData] = await Promise.all([
          getUserSubscription(user.id),
          getUserMonthlyUsage(user.id),
          getExtraMessageCredits(user.id),
        ])

        setSubscription(subscriptionData)
        setUsage(usageData)
        setExtraCredits(Number(extraCreditsData || 0))
      } catch (error) {
        console.error('Erro ao carregar uso do plano:', error)
      } finally {
        setLoading(false)
      }
    }

    load()

    const interval = setInterval(load, 60_000)

    function onVisibility() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user?.id])

  const badgeData = useMemo(() => {
    const active = isSubscriptionActive(subscription)

    if (!active) {
      return {
        planName: 'Teste grátis',
        messagesUsed: Number(usage?.messages_sent || 0),
        maxMessages: FREE_TRIAL_MESSAGE_LIMIT,
        maxClients: FREE_TRIAL_CLIENT_LIMIT,
        extraCredits: 0,
      }
    }

    const plan = subscription?.plan
    const planMessageLimit = Number(plan?.max_messages_per_month || 0)
    const totalMessageLimit =
      planMessageLimit > 0 ? planMessageLimit + Number(extraCredits || 0) : null

    return {
      planName: plan?.name || 'Plano ativo',
      messagesUsed: Number(usage?.messages_sent || 0),
      maxMessages: totalMessageLimit,
      maxClients: plan?.max_clients || null,
      extraCredits: Number(extraCredits || 0),
    }
  }, [subscription, usage, extraCredits])

  if (loading || !user?.id) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
      <span className="text-[#5B4BFF]">
        Plano: {badgeData.planName}
      </span>

      <span className="inline-flex items-center gap-1">
        <MessageCircle size={14} />
        {badgeData.messagesUsed}/{badgeData.maxMessages || '∞'} mensagens
      </span>

      {badgeData.extraCredits > 0 ? (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
          +{badgeData.extraCredits} extras
        </span>
      ) : null}

      <span className="inline-flex items-center gap-1">
        <Users size={14} />
        {badgeData.maxClients
          ? `Até ${badgeData.maxClients} clientes`
          : 'Clientes ilimitados'}
      </span>
    </div>
  )
}