import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  cancelPlatformAutoSubscription,
  createPlatformAutoSubscription,
  createPlatformCheckout,
} from '../services/platformBillingService'
import { getUsageSummary } from '../services/usageService'
import { formatCurrency } from '../utils/format'

function formatDate(value) {
  if (!value) return 'Sem vencimento definido'

  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getDaysUntil(value) {
  if (!value) return null

  const now = new Date()
  const end = new Date(value)

  now.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diff = end.getTime() - now.getTime()

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function StatCard({ title, value, subtitle, icon: Icon, tone = 'purple' }) {
  const tones = {
    purple: 'bg-[#5B4BFF]/10 text-[#5B4BFF] ring-[#5B4BFF]/20',
    green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-[#070D2D]">{value}</p>

          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className={`rounded-2xl p-3 ring-1 ${tones[tone] || tones.purple}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

export default function MyPlan() {
  const { user } = useAuth()

  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [renewing, setRenewing] = useState(false)
  const [activatingAutoRenew, setActivatingAutoRenew] = useState(false)
  const [cancellingAutoRenew, setCancellingAutoRenew] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const result = await getUsageSummary(user.id)
      setSummary(result)
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados do plano.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user])

  const subscription = summary?.subscription || null
  const plan = summary?.plan || subscription?.plan || null

  const daysUntilEnd = useMemo(() => {
    return getDaysUntil(subscription?.current_period_end)
  }, [subscription?.current_period_end])

  const isExpiringSoon =
    summary?.hasActivePlan &&
    daysUntilEnd !== null &&
    daysUntilEnd >= 0 &&
    daysUntilEnd <= 3

  const isExpired =
    subscription?.current_period_end &&
    new Date(subscription.current_period_end) <= new Date()

  const autoRenewActive =
    Boolean(subscription?.auto_renew) &&
    subscription?.auto_renew_status === 'authorized'

  const autoRenewPending = subscription?.auto_renew_status === 'pending'

  const autoRenewCancelled = subscription?.auto_renew_status === 'cancelled'

  async function handleRenewCurrentPlan() {
    if (!user?.id) return

    if (!plan?.id) {
      window.location.href = '/planos'
      return
    }

    setRenewing(true)
    setError('')

    try {
      const checkout = await createPlatformCheckout({
        userId: user.id,
        planId: plan.id,
        installments: subscription?.selected_installments || 1,
      })

      if (!checkout?.payment_url) {
        throw new Error('Checkout criado, mas sem URL de pagamento.')
      }

      window.location.href = checkout.payment_url
    } catch (err) {
      setError(err.message || 'Erro ao renovar plano.')
    } finally {
      setRenewing(false)
    }
  }

  async function handleActivateAutoRenew() {
    if (!user?.id) return

    if (!plan?.id) {
      window.location.href = '/planos'
      return
    }

    setActivatingAutoRenew(true)
    setError('')

    try {
      const result = await createPlatformAutoSubscription({
        userId: user.id,
        planId: plan.id,
      })

      if (!result?.payment_url) {
        throw new Error('Assinatura criada, mas sem URL de pagamento.')
      }

      window.location.href = result.payment_url
    } catch (err) {
      setError(err.message || 'Erro ao ativar renovação automática.')
    } finally {
      setActivatingAutoRenew(false)
    }
  }

  async function handleCancelAutoRenew() {
    if (!user?.id) return

    const confirmCancel = window.confirm(
      'Cancelar a renovação automática? Seu plano atual continuará ativo até o vencimento.',
    )

    if (!confirmCancel) return

    setCancellingAutoRenew(true)
    setError('')

    try {
      await cancelPlatformAutoSubscription({
        userId: user.id,
      })

      await load()
    } catch (err) {
      setError(err.message || 'Erro ao cancelar renovação automática.')
    } finally {
      setCancellingAutoRenew(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-[#5B4BFF]/20 border-t-[#5B4BFF]" />

        <p className="font-bold text-slate-600">Carregando seu plano...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5B4BFF]">
              Minha assinatura
            </p>

            <h1 className="mt-2 text-3xl font-black text-[#070D2D]">
              Plano
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Acompanhe seu plano atual, vencimento, limites e renovação.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-200"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {isExpiringSoon ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={22} />

            <div>
              <p className="font-black">
                Seu plano vence em {daysUntilEnd}{' '}
                {daysUntilEnd === 1 ? 'dia' : 'dias'}.
              </p>

              <p className="mt-1 text-sm">
                Renove agora para manter seu acesso sem interrupção.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isExpired ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={22} />

            <div>
              <p className="font-black">Seu plano venceu.</p>

              <p className="mt-1 text-sm">
                Renove para voltar a usar todos os recursos do Lembrei.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-[#070D2D] p-6 text-white shadow-xl lg:col-span-2">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold text-violet-200">Plano atual</p>

              <h2 className="mt-2 text-4xl font-black">
                {plan?.name || 'Teste grátis'}
              </h2>

              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                {summary?.hasActivePlan
                  ? 'Sua assinatura está ativa. Você pode renovar antes do vencimento para manter a continuidade.'
                  : 'Você está usando o período de teste grátis. Escolha um plano para liberar mais mensagens e clientes.'}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black">
              {summary?.hasActivePlan ? 'Ativo' : 'Teste grátis'}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">Vencimento</p>

              <p className="mt-2 text-2xl font-black">
                {formatDate(subscription?.current_period_end)}
              </p>

              {daysUntilEnd !== null ? (
                <p className="mt-1 text-sm text-slate-300">
                  {daysUntilEnd > 0
                    ? `Restam ${daysUntilEnd} dias`
                    : daysUntilEnd === 0
                      ? 'Vence hoje'
                      : 'Vencido'}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">Valor mensal</p>

              <p className="mt-2 text-2xl font-black">
                {plan?.price ? formatCurrency(plan.price) : 'R$ 0,00'}
              </p>

              <p className="mt-1 text-sm text-slate-300">
                Cobrança mensal via Mercado Pago
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {summary?.hasActivePlan ? (
              <button
                type="button"
                onClick={handleRenewCurrentPlan}
                disabled={renewing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-100 disabled:opacity-60"
              >
                <CreditCard size={18} />
                {renewing ? 'Gerando pagamento...' : 'Renovar plano'}
              </button>
            ) : (
              <a
                href="/planos"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-100"
              >
                <CreditCard size={18} />
                Escolher plano
              </a>
            )}

            <a
              href="/planos"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              <Wallet size={18} />
              Alterar plano
            </a>
          </div>

          <div className="mt-4 rounded-2xl bg-white/10 p-4">
            <p className="text-sm font-black text-white">
              Renovação automática
            </p>

            <p className="mt-1 text-sm text-slate-300">
              {autoRenewActive
                ? 'Ativa. O Mercado Pago tentará renovar automaticamente no próximo ciclo.'
                : autoRenewPending
                  ? 'Pendente. Conclua o cadastro do meio de pagamento no Mercado Pago.'
                  : autoRenewCancelled
                    ? 'Cancelada. Você pode ativar novamente quando quiser.'
                    : 'Desativada. Ative para renovar automaticamente com cartão pelo Mercado Pago.'}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {!autoRenewActive ? (
                <button
                  type="button"
                  onClick={handleActivateAutoRenew}
                  disabled={activatingAutoRenew}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {activatingAutoRenew
                    ? 'Criando assinatura...'
                    : autoRenewPending
                      ? 'Concluir ativação automática'
                      : 'Ativar renovação automática'}
                </button>
              ) : null}

              {autoRenewActive || autoRenewPending ? (
                <button
                  type="button"
                  onClick={handleCancelAutoRenew}
                  disabled={cancellingAutoRenew}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15 disabled:opacity-60"
                >
                  {cancellingAutoRenew
                    ? 'Cancelando...'
                    : 'Cancelar renovação automática'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">
            <CheckCircle2 size={24} />

            <p className="mt-3 font-black">
              {summary?.hasActivePlan ? 'Plano ativo' : 'Teste grátis'}
            </p>

            <p className="mt-1 text-sm">
              {summary?.hasActivePlan
                ? 'Sua conta está liberada conforme os limites do plano.'
                : 'Seu teste grátis possui limites reduzidos.'}
            </p>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="text-slate-500">Status</span>
              <strong className="text-[#070D2D]">
                {subscription?.status || 'trial'}
              </strong>
            </div>

            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="text-slate-500">Início do período</span>
              <strong className="text-[#070D2D]">
                {formatDate(subscription?.current_period_start)}
              </strong>
            </div>

            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="text-slate-500">Fim do período</span>
              <strong className="text-[#070D2D]">
                {formatDate(subscription?.current_period_end)}
              </strong>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Renovação automática</span>
              <strong className="text-[#070D2D]">
                {autoRenewActive
                  ? 'Ativa'
                  : autoRenewPending
                    ? 'Pendente'
                    : autoRenewCancelled
                      ? 'Cancelada'
                      : 'Desativada'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Mensagens do mês"
          value={`${summary?.messagesUsed || 0}/${summary?.messageLimit || 0}`}
          subtitle={
            Number(summary?.extraCredits || 0) > 0
              ? `+${summary.extraCredits} mensagens extras disponíveis`
              : 'Limite mensal do plano'
          }
          icon={MessageCircle}
          tone="purple"
        />

        <StatCard
          title="Clientes cadastrados"
          value={`${summary?.clientsUsed || 0}/${summary?.clientLimit || 0}`}
          subtitle="Limite disponível no plano"
          icon={Users}
          tone="blue"
        />

        <StatCard
          title="Mensagens disponíveis"
          value={
            summary?.messagesAvailable === null
              ? 'Ilimitado'
              : summary?.messagesAvailable || 0
          }
          subtitle="Considerando plano + créditos extras"
          icon={CalendarClock}
          tone="green"
        />
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-black text-[#070D2D]">
          Como funciona a renovação?
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-black text-[#070D2D]">1. Clique em renovar</p>
            <p className="mt-1 text-sm text-slate-500">
              O sistema gera um checkout do seu plano atual.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-black text-[#070D2D]">2. Pague no Mercado Pago</p>
            <p className="mt-1 text-sm text-slate-500">
              Você pode pagar com Pix ou cartão conforme disponibilidade.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-black text-[#070D2D]">3. Período estendido</p>
            <p className="mt-1 text-sm text-slate-500">
              Após aprovado, sua assinatura ganha mais 30 dias.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
