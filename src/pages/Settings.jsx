import { useEffect, useState } from 'react'
import { CheckCircle2, Link2, PlugZap, Trash2, Wallet } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  disconnectMercadoPago,
  getPaymentAccount,
  startMercadoPagoConnection,
} from '../services/paymentAccountService'

export default function Settings() {
  const { user } = useAuth()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadAccount() {
    try {
      if (!user?.id) return

      const data = await getPaymentAccount(user.id)
      setAccount(data)
    } catch (err) {
      setError(err.message || 'Erro ao carregar configuração')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccount()

    const params = new URLSearchParams(window.location.search)

    if (params.get('mp') === 'connected') {
      setSuccess('Mercado Pago conectado com sucesso.')
    }

    if (params.get('mp') === 'error') {
      setError(params.get('message') || 'Erro ao conectar Mercado Pago.')
    }
  }, [user])

  async function handleConnect() {
    setError('')
    setSuccess('')
    setConnecting(true)

    try {
      await startMercadoPagoConnection(user.id)
    } catch (err) {
      setError(err.message || 'Erro ao conectar Mercado Pago')
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm('Deseja desconectar o Mercado Pago?')
    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      await disconnectMercadoPago(user.id)
      setAccount(null)
      setSuccess('Mercado Pago desconectado.')
    } catch (err) {
      setError(err.message || 'Erro ao desconectar Mercado Pago')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
            Integrações
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#070D2D]">
            Configurações
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Conecte sua conta Mercado Pago para receber Pix diretamente na sua conta.
          </p>
        </div>

        <div className="hidden rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF] md:block">
          <PlugZap size={22} />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
              <Wallet size={24} />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#070D2D]">
                Mercado Pago
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Necessário para gerar Pix individual para cada cobrança.
              </p>

              {loading ? (
                <p className="mt-3 text-sm text-slate-500">Carregando...</p>
              ) : account ? (
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    Conectado
                  </p>

                  <p>ID Mercado Pago: {account.provider_user_id || '-'}</p>

                  <p>
                    Ambiente:{' '}
                    {account.live_mode ? 'Produção' : 'Teste'}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-amber-700">
                  Mercado Pago ainda não conectado.
                </p>
              )}
            </div>
          </div>

          {account ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <Trash2 size={16} />
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4A3BE8] disabled:opacity-60"
            >
              <Link2 size={16} />
              {connecting ? 'Conectando...' : 'Conectar Mercado Pago'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}