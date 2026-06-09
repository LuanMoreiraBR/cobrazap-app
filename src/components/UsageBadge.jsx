import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getUsageSummary } from '../services/usageService'

export default function UsageBadge() {
  const { user } = useAuth()

  const [summary, setSummary] = useState(null)

  useEffect(() => {
    async function load() {
      if (!user?.id) return

      try {
        const data = await getUsageSummary(user.id)
        setSummary(data)
      } catch (error) {
        console.error('Erro ao carregar uso do plano:', error)
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
    if (!summary) return null

    const planName = summary.hasActivePlan
      ? summary.plan?.name || 'Plano ativo'
      : 'Teste grátis'

    return {
      planName,
      // messagesUsed já vem acumulado (vitalício) para o plano gratuito.
      messagesUsed: Number(summary.messagesUsed || 0),
      maxMessages: Number(summary.totalMessageLimit || 0), // 0 = ilimitado
      maxClients: Number(summary.clientLimit || 0) || null,
      extraCredits: Number(summary.extraCredits || 0),
    }
  }, [summary])

  if (!user?.id || !badgeData) return null

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
