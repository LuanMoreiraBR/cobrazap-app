import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  activateFreePlan,
  createMessageCreditCheckout,
  createPlatformCheckout,
  getPlatformPlans,
  getUserSubscription,
  MESSAGE_CREDIT_PACKAGES,
} from '../services/platformBillingService'
import { formatCurrency } from '../utils/format'

function isSubscriptionActive(subscription) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false
  if (!subscription.current_period_end) return true

  return new Date(subscription.current_period_end) > new Date()
}

export default function Plans() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [installments, setInstallments] = useState(1)
  const [loading, setLoading] = useState(true)
  const [processingPlanId, setProcessingPlanId] = useState(null)
  const [processingCreditPackage, setProcessingCreditPackage] = useState(null)
  const [error, setError] = useState('')

  const wantsCredits = searchParams.get('buy') === 'credits'
  const hasActiveSubscription = isSubscriptionActive(subscription)
  const hasFreePlan = hasActiveSubscription && Number(subscription?.plan?.price ?? -1) === 0
  const showPlanCards = !hasActiveSubscription || hasFreePlan

  useEffect(() => {
    async function load() {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const [plansData, subscriptionData] = await Promise.all([
          getPlatformPlans(),
          getUserSubscription(user.id),
        ])

        setPlans(plansData || [])
        setSubscription(subscriptionData)
      } catch (err) {
        setError(err.message || 'Erro ao carregar planos.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  async function handleChoosePlan(planId) {
    setError('')
    setProcessingPlanId(planId)

    try {
      const plan = plans.find((p) => p.id === planId)

      if (Number(plan?.price ?? -1) === 0) {
        await activateFreePlan()
        navigate('/app', { replace: true })
        return
      }

      const result = await createPlatformCheckout({
        userId: user.id,
        planId,
        installments,
      })

      window.location.href = result.payment_url
    } catch (err) {
      setError(err.message || 'Erro ao criar checkout.')
    } finally {
      setProcessingPlanId(null)
    }
  }

  async function handleBuyCredits(quantity) {
    setError('')
    setProcessingCreditPackage(quantity)

    try {
      const result = await createMessageCreditCheckout({
        userId: user.id,
        quantity,
        installments,
      })

      window.location.href = result.payment_url
    } catch (err) {
      setError(err.message || 'Erro ao comprar mensagens extras.')
    } finally {
      setProcessingCreditPackage(null)
    }
  }

  function isCurrentPlan(plan) {
    return hasActiveSubscription && subscription?.plan?.id === plan.id
  }

  function isHighlightedPlan(plan) {
    const name = plan.name?.toLowerCase() || ''
    return name.includes('pro')
  }

  function getPlanLabel(plan) {
    if (isCurrentPlan(plan)) return 'Plano atual'
    if (Number(plan.price) === 0) return 'Experimente grátis'
    if (isHighlightedPlan(plan)) return 'Mais recomendado'
    return 'Disponível'
  }

  function getPlanSubtitle(plan) {
    if (plan.description) return plan.description

    return 'Para organizar cobranças, clientes e pagamentos pelo WhatsApp.'
  }

  if (loading) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-[#5B4BFF]/20 border-t-[#5B4BFF]" />
          <p className="text-sm font-bold text-[#070D2D]">Carregando planos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative -m-4 min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-indigo-50 to-slate-50 p-4 md:-m-6 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#070D2D] via-[#111A45] to-[#5B4BFF] p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-violet-100">
                Planos Lembrei
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-6xl">
                Escolha o plano ideal para profissionalizar suas cobranças.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-lg">
                Ative sua conta, organize clientes, acompanhe pagamentos e envie cobranças com uma experiência simples, segura e comercial.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-2xl font-black">Pix</p>
                  <p className="mt-1 text-xs text-slate-300">pagamento rápido</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-2xl font-black">12x</p>
                  <p className="mt-1 text-xs text-slate-300">no cartão</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-2xl font-black">Seguro</p>
                  <p className="mt-1 text-xs text-slate-300">Mercado Pago</p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="rounded-[24px] bg-white p-5 text-[#070D2D] shadow-2xl">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Checkout
                </p>

                <h2 className="mt-2 text-2xl font-black">Pagamento seguro</h2>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img src="/payments/visa.png" alt="Visa" className="max-h-8 object-contain" />
                  </div>

                  <div className="flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img src="/payments/mastercard.png" alt="Mastercard" className="max-h-8 object-contain" />
                  </div>

                  <div className="flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img src="/payments/pix.png" alt="Pix" className="max-h-8 object-contain" />
                  </div>

                  <div className="flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img src="/payments/mercadopago.png" alt="Mercado Pago" className="max-h-8 object-contain" />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-[#070D2D] p-4 text-white">
                  <p className="text-sm font-black">Finalização pelo Mercado Pago</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Você será redirecionado para concluir com Pix ou cartão em ambiente seguro.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {hasActiveSubscription ? (
          <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-black text-[#070D2D]">
                  Seu plano está ativo
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Plano atual:{' '}
                  <strong>{subscription?.plan?.name || 'Plano ativo'}</strong>
                </p>
              </div>

              <Link
                to="/app"
                className="inline-flex items-center justify-center rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-black text-white hover:bg-[#4A3BE8]"
              >
                Acessar plataforma
              </Link>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-[#070D2D]">
              Parcelamento
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Escolha a quantidade de parcelas. As condições finais aparecem no checkout do Mercado Pago.
            </p>

            <label className="mt-6 block text-sm font-black text-[#070D2D]">
              Parcelas no cartão
            </label>

            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  {item}x no cartão
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#070D2D]">
                  O que sua assinatura libera
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Uma estrutura simples para transformar cobranças manuais em um processo organizado e profissional.
                </p>
              </div>

              <div className="w-fit rounded-full bg-[#5B4BFF]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#5B4BFF]">
                Acesso completo
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Clientes organizados', 'Cadastre clientes e acompanhe a situação de cada cobrança.'],
                ['Cobranças pelo WhatsApp', 'Envie cobranças profissionais e automáticas.'],
                ['Controle financeiro', 'Veja pendências, recebimentos e atrasos com clareza.'],
                ['Pagamento seguro', 'Finalização via Mercado Pago com Pix ou cartão.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-black text-[#070D2D]">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {hasActiveSubscription ? (
          <section
            id="credits"
            className={`rounded-[30px] border bg-white/90 p-6 shadow-sm ${
              wantsCredits ? 'border-[#5B4BFF]' : 'border-white/70'
            }`}
          >
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5B4BFF]">
                  Mensagens extras
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#070D2D] md:text-4xl">
                  Compre pacotes adicionais
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Use quando as mensagens do seu plano acabarem. Os créditos extras são consumidos somente quando você passa do limite mensal.
                </p>
              </div>

              <div className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm">
                Plano atual: {subscription?.plan?.name}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {MESSAGE_CREDIT_PACKAGES.map((quantity) => {
                const unitPrice = Number(subscription?.plan?.extra_message_price || 0)
                const total = quantity * unitPrice

                return (
                  <div
                    key={quantity}
                    className="rounded-[30px] border border-slate-200 bg-white p-6 text-[#070D2D] shadow-sm"
                  >
                    <div className="inline-flex rounded-full bg-[#5B4BFF]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#5B4BFF]">
                      Pacote extra
                    </div>

                    <h3 className="mt-4 text-3xl font-black">
                      {quantity} mensagens
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Ideal para continuar enviando cobranças quando seu limite mensal acabar.
                    </p>

                    <p className="mt-6 text-4xl font-black tracking-tight text-[#5B4BFF]">
                      {formatCurrency(total)}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {formatCurrency(unitPrice)} por mensagem no plano {subscription?.plan?.name}.
                    </p>

                    <button
                      type="button"
                      onClick={() => handleBuyCredits(quantity)}
                      disabled={processingCreditPackage === quantity}
                      className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-[#070D2D] px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:bg-[#111A45] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {processingCreditPackage === quantity
                        ? 'Gerando checkout...'
                        : 'Obter Créditos'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {showPlanCards ? (
        <section>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5B4BFF]">
                Planos disponíveis
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#070D2D] md:text-4xl">
                Escolha seu plano
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Comece com limite mensal e compre créditos extras quando precisar.
              </p>
            </div>

            <div className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm">
              Pix ou cartão
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const highlighted = isHighlightedPlan(plan)
              const current = isCurrentPlan(plan)

              return (
                <div
                  key={plan.id}
                  className={`rounded-[34px] p-6 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-xl md:p-8 ${
                    highlighted
                      ? 'bg-[#070D2D] text-white ring-[#070D2D]'
                      : 'bg-white text-[#070D2D] ring-slate-200'
                  }`}
                >
                  <div
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${
                      highlighted
                        ? 'bg-white/10 text-violet-100'
                        : Number(plan.price) === 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-[#5B4BFF]/10 text-[#5B4BFF]'
                    }`}
                  >
                    {getPlanLabel(plan)}
                  </div>

                  <h3 className="mt-4 text-2xl font-black tracking-tight">
                    {plan.name}
                  </h3>

                  <p
                    className={`mt-2 text-sm leading-6 ${
                      highlighted ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {getPlanSubtitle(plan)}
                  </p>

                  <div className="mt-8">
                    <p
                      className={`text-5xl font-black tracking-tight ${
                        highlighted ? 'text-white' : 'text-[#5B4BFF]'
                      }`}
                    >
                      {formatCurrency(plan.price)}
                      <span
                        className={`ml-1 text-sm font-bold ${
                          highlighted ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        /mês
                      </span>
                    </p>

                    <p
                      className={`mt-2 text-xs ${
                        highlighted ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      Pagamento via Pix ou cartão pelo Mercado Pago.
                    </p>
                  </div>

                  <div
                    className={`mt-7 rounded-3xl p-5 ${
                      highlighted
                        ? 'border border-white/10 bg-white/10'
                        : 'border border-slate-100 bg-slate-50'
                    }`}
                  >
                    <p
                      className={`text-xs font-black uppercase tracking-[0.16em] ${
                        highlighted ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      Limites do plano
                    </p>

                    <ul className="mt-4 space-y-3 text-sm">
                      <li className="flex items-center justify-between gap-4">
                        <span className={highlighted ? 'text-slate-300' : 'text-slate-500'}>
                          Clientes
                        </span>

                        <strong>{plan.max_clients ? `Até ${plan.max_clients}` : 'Ilimitado'}</strong>
                      </li>

                      <li className="flex items-center justify-between gap-4">
                        <span className={highlighted ? 'text-slate-300' : 'text-slate-500'}>
                          Mensagens/mês
                        </span>

                        <strong>
                          {plan.max_messages_per_month
                            ? `Até ${plan.max_messages_per_month}`
                            : 'Ilimitado'}
                        </strong>
                      </li>

                      <li className="flex items-center justify-between gap-4">
                        <span className={highlighted ? 'text-slate-300' : 'text-slate-500'}>
                          Mensagem extra
                        </span>

                        <strong>{formatCurrency(plan.extra_message_price || 0)}</strong>
                      </li>
                    </ul>
                  </div>

                  <ul
                    className={`mt-7 space-y-3 text-sm ${
                      highlighted ? 'text-slate-200' : 'text-slate-600'
                    }`}
                  >
                    <li>✓ Painel completo de cobranças</li>
                    <li>✓ Cadastro e organização de clientes</li>
                    <li>✓ Mensagens profissionais pelo WhatsApp</li>
                    <li>✓ Controle de pagamentos pendentes e recebidos</li>
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleChoosePlan(plan.id)}
                    disabled={processingPlanId === plan.id || current}
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      current
                        ? 'bg-emerald-100 text-emerald-700'
                        : Number(plan.price) === 0
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : highlighted
                            ? 'bg-[#5B4BFF] text-white hover:bg-[#4A3BE8]'
                            : 'bg-[#070D2D] text-white hover:bg-[#111A45]'
                    }`}
                  >
                    {current
                      ? 'Plano atual'
                      : processingPlanId === plan.id
                        ? (Number(plan.price) === 0 ? 'Ativando...' : 'Gerando checkout...')
                        : Number(plan.price) === 0
                          ? 'Começar gratuitamente'
                          : 'Escolher este plano'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
        ) : null}

        <section className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <p className="text-sm font-black text-[#070D2D]">
                Pagamento protegido
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                A transação acontece em ambiente seguro pelo Mercado Pago.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <p className="text-sm font-black text-[#070D2D]">
                Liberação simples
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Após a confirmação, seu acesso segue as regras do plano contratado.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <p className="text-sm font-black text-[#070D2D]">
                Créditos extras
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Usuários com plano ativo podem comprar mensagens extras quando precisarem.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}