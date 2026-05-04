import { useEffect, useState } from 'react'
import { MessageCircle, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserMonthlyUsage,
  getUserSubscription,
} from '../services/platformBillingService'

export default function UsageBadge() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    async function load() {
      const [subscriptionData, usageData] = await Promise.all([
        getUserSubscription(user.id),
        getUserMonthlyUsage(user.id),
      ])

      setSubscription(subscriptionData)
      setUsage(usageData)
    }

    if (user?.id) load()
  }, [user])

  if (!subscription || !usage) return null

  const plan = subscription.plan
  const maxMessages = plan?.max_messages_per_month
  const maxClients = plan?.max_clients

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
      <span className="text-[#5B4BFF]">
        Plano: {plan?.name || 'Sem plano'}
      </span>

      <span className="inline-flex items-center gap-1">
        <MessageCircle size={14} />
        {usage.messages_sent}/{maxMessages || '∞'} mensagens
      </span>

      <span className="inline-flex items-center gap-1">
        <Users size={14} />
        {maxClients ? `Até ${maxClients} clientes` : 'Clientes ilimitados'}
      </span>
    </div>
  )
}