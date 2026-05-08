import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  checkAutoRenewReturn,
  checkChargeReturn,
  checkMessageCreditsReturn,
  checkPlanReturn,
} from '../services/paymentReturnService'

const MAX_ATTEMPTS = 12
const POLL_INTERVAL = 3500

function getFlowLabel(flow) {
  switch (flow) {
    case 'plan':
      return 'assinatura do plano'
    case 'auto-renew':
      return 'renovação automática'
    case 'credits':
      return 'pacote de mensagens'
    case 'charge':
      return 'pagamento da cobrança'
    default:
      return 'pagamento'
  }
}

function getSuccessRedirect(flow) {
  switch (flow) {
    case 'plan':
    case 'auto-renew':
      return '/app/plano'
    case 'credits':
      return '/app'
    case 'charge':
      return '/app/cobrancas'
    default:
      return '/app'
  }
}

export default function PaymentReturn() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const flow = searchParams.get('flow') || 'plan'
  const initialStatus = searchParams.get('status') || 'pending'
  const chargeId = searchParams.get('charge_id') || ''

  const [phase, setPhase] = useState(
    initialStatus === 'failure' ? 'failed' : 'checking',
  )
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState(
    'Estamos confirmando seu pagamento com segurança. Isso pode levar alguns segundos.',
  )

  const redirectTo = useMemo(() => getSuccessRedirect(flow), [flow])
  const flowLabel = getFlowLabel(flow)

  useEffect(() => {
    if (!user?.id) return
    if (initialStatus === 'failure') return

    let cancelled = false
    let timeoutId = null
    let currentAttempt = 0

    async function verify() {
      if (cancelled) return

      currentAttempt += 1
      setAttempt(currentAttempt)

      try {
        let result = { confirmed: false }

        if (flow === 'plan') {
          result = await checkPlanReturn(user.id)
        } else if (flow === 'auto-renew') {
          result = await checkAutoRenewReturn(user.id)
        } else if (flow === 'credits') {
          result = await checkMessageCreditsReturn(user.id)
        } else if (flow === 'charge') {
          result = await checkChargeReturn(user.id, chargeId)
        }

        if (cancelled) return

        if (result.confirmed) {
          setPhase('success')
          setMessage('Pagamento confirmado com sucesso! Redirecionando...')

          timeoutId = window.setTimeout(() => {
            navigate(redirectTo, { replace: true })
          }, 2200)

          return
        }

        if (currentAttempt >= MAX_ATTEMPTS) {
          setPhase('timeout')
          setMessage(
            'Ainda não recebemos a confirmação final. Você pode aguardar mais um pouco ou voltar ao aplicativo.',
          )
          return
        }

        timeoutId = window.setTimeout(verify, POLL_INTERVAL)
      } catch (error) {
        console.error('Erro ao confirmar retorno do pagamento:', error)

        if (cancelled) return

        if (currentAttempt >= MAX_ATTEMPTS) {
          setPhase('timeout')
          setMessage(
            'Tivemos um problema ao consultar a confirmação. Se o pagamento já foi realizado, aguarde alguns instantes e tente novamente.',
          )
          return
        }

        timeoutId = window.setTimeout(verify, POLL_INTERVAL)
      }
    }

    verify()

    return () => {
      cancelled = true

      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [user?.id, flow, chargeId, initialStatus, navigate, redirectTo])

  const title =
    phase === 'checking'
      ? 'Estamos confirmando seu pagamento'
      : phase === 'success'
        ? 'Pagamento confirmado'
        : phase === 'failed'
          ? 'Pagamento não concluído'
          : 'Confirmação pendente'

  const description =
    phase === 'checking'
      ? `Estamos validando a ${flowLabel} com nossos sistemas e com o provedor de pagamento.`
      : phase === 'success'
        ? `Recebemos a confirmação da ${flowLabel}. Em instantes você será redirecionado.`
        : phase === 'failed'
          ? `A ${flowLabel} não foi concluída. Você pode tentar novamente quando quiser.`
          : `A ${flowLabel} ainda está aguardando confirmação. Em alguns casos o provedor pode levar alguns segundos ou minutos para enviar a atualização.`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] md:p-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
              {phase === 'checking' ? (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#5B4BFF]" />
                  <div className="absolute inset-3 animate-pulse rounded-full bg-violet-50 blur-md" />
                </>
              ) : null}

              {phase === 'success' ? (
                <div className="absolute inset-0 rounded-full bg-emerald-50" />
              ) : null}

              {phase === 'failed' ? (
                <div className="absolute inset-0 rounded-full bg-rose-50" />
              ) : null}

              {phase === 'timeout' ? (
                <div className="absolute inset-0 rounded-full bg-amber-50" />
              ) : null}

              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#070D2D] shadow-lg">
                <img
                  src="/icon-lembrei.png"
                  alt="Lembrei"
                  className={`h-14 w-14 object-contain ${
                    phase === 'checking' ? 'animate-pulse' : ''
                  }`}
                />
              </div>
            </div>

            <div className="mb-5 flex items-center gap-2">
              {phase === 'checking' ? (
                <LoaderCircle className="h-6 w-6 animate-spin text-[#5B4BFF]" />
              ) : null}

              {phase === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : null}

              {phase === 'failed' ? (
                <XCircle className="h-6 w-6 text-rose-600" />
              ) : null}

              {phase === 'timeout' ? (
                <Clock3 className="h-6 w-6 text-amber-600" />
              ) : null}

              <h1 className="text-2xl font-bold tracking-tight text-[#070D2D] md:text-3xl">
                {title}
              </h1>
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-600 md:text-base">
              {description}
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
              {message}
            </div>

            {phase === 'checking' ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#5B4BFF]" />
                <span
                  className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#7C6BFF]"
                  style={{ animationDelay: '120ms' }}
                />
                <span
                  className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#A194FF]"
                  style={{ animationDelay: '240ms' }}
                />
                <span className="ml-2">
                  Tentativa {Math.min(attempt, MAX_ATTEMPTS)} de {MAX_ATTEMPTS}
                </span>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {phase === 'success' ? (
                <button
                  type="button"
                  onClick={() => navigate(redirectTo, { replace: true })}
                  className="rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  Ir agora
                </button>
              ) : null}

              {phase === 'failed' ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                  >
                    Tentar novamente
                  </button>

                  <Link
                    to="/app"
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Voltar ao app
                  </Link>
                </>
              ) : null}

              {phase === 'timeout' ? (
                <>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                  >
                    <RefreshCw size={16} />
                    Atualizar status
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(redirectTo)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Continuar no app
                  </button>
                </>
              ) : null}
            </div>

            <div className="mt-10 w-full rounded-3xl border border-violet-100 bg-violet-50/70 p-5 text-left">
              <h2 className="text-sm font-semibold text-[#070D2D]">
                O que está acontecendo agora?
              </h2>

              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>
                  • O Lembrei está aguardando a confirmação oficial do pagamento.
                </li>
                <li>
                  • Quando o provedor confirmar, seu plano/crédito/cobrança será atualizado automaticamente.
                </li>
                <li>
                  • Você não precisa refazer o pagamento se ele já foi concluído.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}