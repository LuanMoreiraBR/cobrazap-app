import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createPlatformCheckout,
  getPlatformPlans,
  getUserSubscription,
} from '../services/platformBillingService'
import { formatCurrency } from '../utils/format'

export default function Plans() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [installments, setInstallments] = useState(1)
  const [loading, setLoading] = useState(true)
  const [processingPlanId, setProcessingPlanId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [plansData, subscriptionData] = await Promise.all([
          getPlatformPlans(),
          getUserSubscription(user.id),
        ])

        setPlans(plansData)
        setSubscription(subscriptionData)
      } catch (err) {
        setError(err.message || 'Erro ao carregar planos.')
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) load()
  }, [user])

  async function handleChoosePlan(planId) {
    setError('')
    setProcessingPlanId(planId)

    try {
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

  function isCurrentPlan(plan) {
    return subscription?.status === 'active' && subscription?.plan?.id === plan.id
  }

  function isHighlightedPlan(plan) {
    const name = plan.name?.toLowerCase() || ''

    return (
      name.includes('ilimitado') ||
      name.includes('premium') ||
      name.includes('pro') ||
      !plan.max_clients ||
      !plan.max_messages_per_month
    )
  }

  function getPlanLabel(plan) {
    if (isCurrentPlan(plan)) return 'Plano atual'
    if (isHighlightedPlan(plan)) return 'Mais completo'
    return 'Essencial'
  }

  function getPlanSubtitle(plan) {
    if (plan.description) return plan.description

    if (isHighlightedPlan(plan)) {
      return 'Para quem quer usar sem limites e escalar a operação de cobrança.'
    }

    return 'Para começar com controle, organização e previsibilidade.'
  }

  if (loading) {
    return (
      <div className="plans-page flex min-h-[75vh] items-center justify-center">
        <style>{`
          .plans-page {
            background:
              radial-gradient(circle at top, rgba(91,75,255,0.16), transparent 36%),
              linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
          }

          .loader {
            width: 44px;
            height: 44px;
            border-radius: 999px;
            border: 4px solid rgba(91,75,255,0.15);
            border-top-color: #5B4BFF;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="loader mx-auto mb-5" />
          <p className="text-sm font-extrabold text-[#070D2D]">
            Carregando planos
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Preparando as opções disponíveis.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="plans-page relative -m-4 min-h-screen overflow-hidden p-4 md:-m-6 md:p-6">
      <style>{`
        .plans-page {
          background:
            radial-gradient(circle at 50% -10%, rgba(91,75,255,0.20), transparent 32%),
            radial-gradient(circle at 100% 28%, rgba(91,75,255,0.12), transparent 28%),
            radial-gradient(circle at 0% 78%, rgba(15,23,42,0.08), transparent 26%),
            linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%);
        }

        .glass-panel {
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(255,255,255,0.72);
          box-shadow: 0 24px 80px rgba(15,23,42,0.08);
          backdrop-filter: blur(18px);
        }

        .hero-shell {
          background:
            radial-gradient(circle at 18% 12%, rgba(255,255,255,0.18), transparent 20%),
            radial-gradient(circle at 88% 16%, rgba(91,75,255,0.45), transparent 28%),
            linear-gradient(135deg, #070D2D 0%, #111A45 52%, #5B4BFF 140%);
        }

        .orb {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(44px);
        }

        .plan-card {
          transition:
            transform 0.28s cubic-bezier(.22,1,.36,1),
            box-shadow 0.28s cubic-bezier(.22,1,.36,1),
            border-color 0.28s cubic-bezier(.22,1,.36,1);
        }

        .plan-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 34px 90px rgba(15,23,42,0.14);
        }

        .plan-card-highlight {
          background:
            radial-gradient(circle at 90% 0%, rgba(91,75,255,0.42), transparent 30%),
            linear-gradient(145deg, #070D2D 0%, #101844 58%, #1A2158 100%);
        }

        .plan-card-highlight:hover {
          box-shadow: 0 36px 100px rgba(91,75,255,0.28);
        }

        .premium-border {
          position: relative;
          isolation: isolate;
        }

        .premium-border::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(91,75,255,1), rgba(255,255,255,0.28), rgba(91,75,255,0.4));
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: -1;
        }

        .shine {
          position: relative;
          overflow: hidden;
        }

        .shine::after {
          content: "";
          position: absolute;
          top: -60%;
          left: -55%;
          width: 90px;
          height: 220%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent);
          transform: rotate(15deg);
          transition: left 0.75s cubic-bezier(.22,1,.36,1);
          pointer-events: none;
        }

        .shine:hover::after {
          left: 130%;
        }

        .pay-card {
          transition:
            transform 0.22s cubic-bezier(.22,1,.36,1),
            box-shadow 0.22s cubic-bezier(.22,1,.36,1),
            border-color 0.22s cubic-bezier(.22,1,.36,1);
        }

        .pay-card:hover {
          transform: translateY(-4px) scale(1.02);
          border-color: rgba(91,75,255,0.28);
          box-shadow: 0 18px 44px rgba(15,23,42,0.10);
        }

        .payment-img {
          max-width: 100%;
          object-fit: contain;
          transition: transform 0.2s ease, filter 0.2s ease;
        }

        .pay-card:hover .payment-img {
          transform: scale(1.04);
          filter: saturate(1.08);
        }

        .soft-icon {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background:
            radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), transparent 24%),
            linear-gradient(135deg, rgba(91,75,255,0.16), rgba(91,75,255,0.05));
          border: 1px solid rgba(91,75,255,0.14);
        }

        .soft-icon::before {
          content: "";
          position: absolute;
          inset: 12px;
          border-radius: 10px;
          border: 2px solid #5B4BFF;
          opacity: 0.9;
        }

        .soft-icon::after {
          content: "";
          position: absolute;
          right: 10px;
          top: 10px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #5B4BFF;
          box-shadow: 0 0 0 5px rgba(91,75,255,0.12);
        }

        .soft-icon.line::before {
          inset: 14px 10px;
          height: 2px;
          border: none;
          background: #5B4BFF;
          box-shadow: 0 8px 0 rgba(91,75,255,0.55), 0 16px 0 rgba(91,75,255,0.25);
        }

        .soft-icon.line::after {
          left: 10px;
          top: 12px;
          width: 6px;
          height: 6px;
        }

        .soft-icon.chart::before {
          left: 12px;
          right: auto;
          top: 22px;
          bottom: 10px;
          width: 4px;
          border: none;
          background: #5B4BFF;
          border-radius: 999px;
          box-shadow: 8px -7px 0 rgba(91,75,255,0.7), 16px -14px 0 rgba(91,75,255,0.4);
        }

        .soft-icon.chart::after {
          right: 9px;
          top: 9px;
        }

        .soft-icon.lock::before {
          left: 12px;
          top: 20px;
          right: 12px;
          bottom: 10px;
          border: none;
          background: #5B4BFF;
          border-radius: 8px;
        }

        .soft-icon.lock::after {
          left: 15px;
          top: 11px;
          width: 14px;
          height: 14px;
          border-radius: 999px 999px 4px 4px;
          border: 2px solid #5B4BFF;
          background: transparent;
          box-shadow: none;
        }

        .feature-card {
          transition: transform 0.22s ease, background 0.22s ease, border-color 0.22s ease;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          background: #ffffff;
          border-color: rgba(91,75,255,0.22);
        }

        .mobile-press {
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-press:active {
          transform: scale(0.985);
        }

        @media (max-width: 768px) {
          .plan-card:hover,
          .pay-card:hover,
          .feature-card:hover {
            transform: none;
          }

          .shine::after {
            display: none;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#5B4BFF]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-36 top-72 h-[380px] w-[380px] rounded-full bg-[#5B4BFF]/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-36 bottom-20 h-[380px] w-[380px] rounded-full bg-[#070D2D]/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <section className="hero-shell relative overflow-hidden rounded-[32px] p-6 text-white shadow-[0_30px_100px_rgba(7,13,45,0.28)] md:rounded-[44px] md:p-10 lg:p-12">
          <div className="orb -right-20 -top-20 h-80 w-80 bg-[#5B4BFF]/45" />
          <div className="orb bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 translate-y-1/2 bg-white/12" />

          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-100 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#5B4BFF] shadow-[0_0_0_5px_rgba(91,75,255,0.22)]" />
                Planos Lembrei
              </div>

              <h1 className="mt-6 max-w-4xl text-3xl font-black leading-[1.04] tracking-tight md:text-5xl lg:text-6xl">
                Escolha o plano ideal para profissionalizar suas cobranças.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-lg md:leading-8">
                Ative sua conta, organize clientes, acompanhe pagamentos e envie cobranças com uma experiência simples, segura e comercial.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-black text-white">Pix</p>
                  <p className="mt-1 text-xs text-slate-300">
                    pagamento rápido
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-black text-white">12x</p>
                  <p className="mt-1 text-xs text-slate-300">
                    no cartão
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-black text-white">Seguro</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Mercado Pago
                  </p>
                </div>
              </div>
            </div>

            <div className="premium-border relative rounded-[30px] bg-white/10 p-4 backdrop-blur-xl md:p-5">
              <div className="rounded-[24px] bg-white p-5 text-[#070D2D] shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Checkout
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      Pagamento seguro
                    </h2>
                  </div>

                  <span className="rounded-full bg-[#5B4BFF]/10 px-3 py-1.5 text-xs font-black text-[#5B4BFF]">
                    Online
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="pay-card flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img
                      src="/payments/visa.png"
                      alt="Visa"
                      className="payment-img max-h-8"
                    />
                  </div>

                  <div className="pay-card flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img
                      src="/payments/mastercard.png"
                      alt="Mastercard"
                      className="payment-img max-h-8"
                    />
                  </div>

                  <div className="pay-card flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img
                      src="/payments/pix.png"
                      alt="Pix"
                      className="payment-img max-h-8"
                    />
                  </div>

                  <div className="pay-card flex h-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <img
                      src="/payments/mercadopago.png"
                      alt="Mercado Pago"
                      className="payment-img max-h-8"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-[#070D2D] p-4 text-white">
                  <p className="text-sm font-black">
                    Finalização pelo Mercado Pago
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Você será redirecionado para concluir com Pix ou cartão em ambiente seguro.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {subscription?.status === 'active' ? (
          <section className="glass-panel rounded-[28px] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5B4BFF] text-sm font-black text-white">
                  OK
                </div>

                <div>
                  <p className="text-base font-black text-[#070D2D]">
                    Seu plano está ativo
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Plano atual:{' '}
                    <strong>{subscription.plan?.name || 'Plano ativo'}</strong>
                  </p>
                </div>
              </div>

              <Link
                to="/app"
                className="mobile-press inline-flex items-center justify-center rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#5B4BFF]/20 transition hover:bg-[#4A3BE8]"
              >
                Acessar plataforma
              </Link>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="glass-panel rounded-[30px] p-6">
            <div className="soft-icon" />

            <h2 className="mt-5 text-2xl font-black tracking-tight text-[#070D2D]">
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
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none transition focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  {item}x no cartão
                </option>
              ))}
            </select>

            <div className="mt-6 rounded-2xl border border-slate-100 bg-white/70 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Formas aceitas
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="pay-card flex h-11 w-[76px] items-center justify-center rounded-xl border border-slate-100 bg-white px-3">
                  <img src="/payments/visa.png" alt="Visa" className="payment-img max-h-5" />
                </div>

                <div className="pay-card flex h-11 w-[76px] items-center justify-center rounded-xl border border-slate-100 bg-white px-3">
                  <img src="/payments/mastercard.png" alt="Mastercard" className="payment-img max-h-5" />
                </div>

                <div className="pay-card flex h-11 w-[76px] items-center justify-center rounded-xl border border-slate-100 bg-white px-3">
                  <img src="/payments/pix.png" alt="Pix" className="payment-img max-h-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-[30px] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#070D2D]">
                  O que sua assinatura libera
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Uma estrutura simples para transformar cobranças manuais em um processo mais organizado e profissional.
                </p>
              </div>

              <div className="w-fit rounded-full bg-[#5B4BFF]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#5B4BFF]">
                Acesso completo
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="feature-card rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="soft-icon line" />
                <p className="mt-4 text-sm font-black text-[#070D2D]">
                  Clientes organizados
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Cadastre clientes e acompanhe a situação de cada cobrança.
                </p>
              </div>

              <div className="feature-card rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="soft-icon" />
                <p className="mt-4 text-sm font-black text-[#070D2D]">
                  Cobranças pelo WhatsApp
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Gere mensagens profissionais para enviar com mais agilidade.
                </p>
              </div>

              <div className="feature-card rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="soft-icon chart" />
                <p className="mt-4 text-sm font-black text-[#070D2D]">
                  Controle financeiro
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Veja pendências, recebimentos e atrasos com mais clareza.
                </p>
              </div>

              <div className="feature-card rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="soft-icon lock" />
                <p className="mt-4 text-sm font-black text-[#070D2D]">
                  Pagamento seguro
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Finalização via Mercado Pago com Pix ou cartão.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5B4BFF]">
                Planos disponíveis
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#070D2D] md:text-4xl">
                Escolha seu plano
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Comece com limite mensal ou libere uso ilimitado.
              </p>
            </div>

            <div className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm">
              Pix ou cartão
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => {
              const highlighted = isHighlightedPlan(plan)
              const current = isCurrentPlan(plan)

              return (
                <div
                  key={plan.id}
                  className={`plan-card mobile-press ${
                    highlighted
                      ? 'plan-card-highlight premium-border text-white'
                      : 'glass-panel text-[#070D2D]'
                  } relative rounded-[34px] p-6 md:p-8`}
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div
                          className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                            highlighted
                              ? 'bg-white/10 text-violet-100'
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
                      </div>
                    </div>

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
                          : 'border border-slate-100 bg-white/70'
                      }`}
                    >
                      <p
                        className={`text-[11px] font-black uppercase tracking-[0.16em] ${
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

                          <strong className={highlighted ? 'text-white' : 'text-[#070D2D]'}>
                            {plan.max_clients ? `Até ${plan.max_clients}` : 'Ilimitado'}
                          </strong>
                        </li>

                        <li className="flex items-center justify-between gap-4">
                          <span className={highlighted ? 'text-slate-300' : 'text-slate-500'}>
                            Mensagens/mês
                          </span>

                          <strong className={highlighted ? 'text-white' : 'text-[#070D2D]'}>
                            {plan.max_messages_per_month
                              ? `Até ${plan.max_messages_per_month}`
                              : 'Ilimitado'}
                          </strong>
                        </li>
                      </ul>
                    </div>

                    <ul
                      className={`mt-7 space-y-3 text-sm ${
                        highlighted ? 'text-slate-200' : 'text-slate-600'
                      }`}
                    >
                      <li className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF] text-[10px] font-black text-white">
                          ✓
                        </span>
                        Painel completo de cobranças
                      </li>

                      <li className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF] text-[10px] font-black text-white">
                          ✓
                        </span>
                        Cadastro e organização de clientes
                      </li>

                      <li className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF] text-[10px] font-black text-white">
                          ✓
                        </span>
                        Mensagens profissionais para WhatsApp
                      </li>

                      <li className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF] text-[10px] font-black text-white">
                          ✓
                        </span>
                        Controle de pagamentos pendentes e recebidos
                      </li>
                    </ul>

                    <button
                      type="button"
                      onClick={() => handleChoosePlan(plan.id)}
                      disabled={processingPlanId === plan.id || current}
                      className={`mobile-press mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-black transition ${
                        current
                          ? 'cursor-not-allowed bg-emerald-100 text-emerald-700'
                          : highlighted
                            ? 'shine bg-[#5B4BFF] text-white shadow-xl shadow-[#5B4BFF]/30 hover:bg-[#4A3BE8]'
                            : 'bg-[#070D2D] text-white shadow-lg shadow-slate-900/10 hover:bg-[#111A45]'
                      }`}
                    >
                      {current
                        ? 'Plano atual'
                        : processingPlanId === plan.id
                          ? 'Gerando checkout...'
                          : 'Escolher este plano'}
                    </button>

                    <div className="mt-5 flex items-center justify-center gap-3">
                      <img
                        src="/payments/visa.png"
                        alt="Visa"
                        className={`h-5 object-contain ${highlighted ? 'opacity-85' : 'opacity-70'}`}
                      />

                      <img
                        src="/payments/mastercard.png"
                        alt="Mastercard"
                        className={`h-5 object-contain ${highlighted ? 'opacity-85' : 'opacity-70'}`}
                      />

                      <img
                        src="/payments/pix.png"
                        alt="Pix"
                        className={`h-5 object-contain ${highlighted ? 'opacity-85' : 'opacity-70'}`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="glass-panel rounded-[30px] p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="feature-card rounded-2xl border border-slate-100 bg-white/65 p-5">
              <div className="soft-icon lock" />
              <p className="mt-4 text-sm font-black text-[#070D2D]">
                Pagamento protegido
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                A transação acontece em ambiente seguro pelo Mercado Pago.
              </p>
            </div>

            <div className="feature-card rounded-2xl border border-slate-100 bg-white/65 p-5">
              <div className="soft-icon chart" />
              <p className="mt-4 text-sm font-black text-[#070D2D]">
                Liberação simples
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Após a confirmação, seu acesso segue as regras do plano contratado.
              </p>
            </div>

            <div className="feature-card rounded-2xl border border-slate-100 bg-white/65 p-5">
              <div className="soft-icon line" />
              <p className="mt-4 text-sm font-black text-[#070D2D]">
                Experiência profissional
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Uma área de planos mais clara, comercial e pronta para mobile.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}