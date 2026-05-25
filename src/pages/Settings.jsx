import { useEffect, useState } from 'react'
import { Bell, BellRing, CheckCircle2, Link2, PlugZap, Trash2, Wallet } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  disconnectMercadoPago,
  getPaymentAccount,
  startMercadoPagoConnection,
} from '../services/paymentAccountService'
import {
  getNotificationPermission,
  isPushSupported,
  subscribeToPushNotifications,
} from '../services/pushNotificationService'
import { supabase } from '../services/supabaseClient'

export default function Settings() {
  const { user } = useAuth()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notifPhone, setNotifPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [pushPermission, setPushPermission] = useState('default')

  async function loadAccount() {
    try {
      if (!user?.id) return

      const data = await getPaymentAccount(user.id)
      setAccount(data)

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle()

      setNotifPhone(profile?.phone || '')
    } catch (err) {
      setError(err.message || 'Erro ao carregar configuração')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePhone() {
    if (!user?.id) return
    setSavingPhone(true)
    setError('')
    setSuccess('')
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ phone: notifPhone.trim() || null })
        .eq('id', user.id)
      if (updateError) throw updateError
      setSuccess('WhatsApp de notificação salvo com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao salvar telefone.')
    } finally {
      setSavingPhone(false)
    }
  }

  useEffect(() => {
    setPushPermission(getNotificationPermission())
  }, [])

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
      await startMercadoPagoConnection()
    } catch (err) {
      setError(err.message || 'Erro ao conectar Mercado Pago')
      setConnecting(false)
    }
  }

  async function handleEnablePush() {
    if (!user?.id) return
    const granted = await subscribeToPushNotifications(user.id)
    setPushPermission(getNotificationPermission())
    if (granted) setSuccess('Notificações ativadas com sucesso.')
    else setError('Permissão negada ou navegador incompatível.')
  }

  async function handleTestPush() {
    if (!user?.id) return
    setTestingPush(true)
    setError('')
    setSuccess('')
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: 'Teste de notificação ✅',
          body: 'As notificações push estão funcionando!',
          url: '/app',
        }),
      })
      const data = await res.json()
      if (data.sent > 0) {
        setSuccess('Notificação de teste enviada! Verifique seu dispositivo.')
      } else {
        // Inscrição sumiu — tenta re-registrar automaticamente
        const resubscribed = await subscribeToPushNotifications(user.id)
        if (resubscribed) {
          setSuccess('Inscrição re-registrada. Clique em "Simular notificação" novamente.')
        } else {
          setError('Não foi possível registrar a inscrição. Verifique as permissões do navegador.')
        }
      }
    } catch (err) {
      setError('Erro ao enviar notificação de teste.')
    } finally {
      setTestingPush(false)
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
            <Bell size={24} />
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[#070D2D]">
              WhatsApp para notificações
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Receba um aviso no WhatsApp quando seu plano estiver próximo do vencimento (7, 3 e 1 dia antes).
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="tel"
                placeholder="Ex: 11999990000"
                value={notifPhone}
                onChange={(e) => setNotifPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#070D2D] focus:border-[#5B4BFF] focus:outline-none sm:max-w-xs"
              />

              <button
                type="button"
                onClick={handleSavePhone}
                disabled={savingPhone}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B4BFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4A3BE8] disabled:opacity-60"
              >
                {savingPhone ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Só DDD + número, sem espaços. Ex: 11999990000
            </p>
          </div>
        </div>
      </div>

      {isPushSupported() ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
              <BellRing size={24} />
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-semibold text-[#070D2D]">
                Notificações push
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Receba uma notificação no dispositivo sempre que um pagamento for confirmado.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {pushPermission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#5B4BFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4A3BE8]"
                  >
                    <BellRing size={16} />
                    Ativar notificações
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    Notificações ativas
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleTestPush}
                  disabled={testingPush || pushPermission !== 'granted'}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testingPush ? 'Enviando...' : 'Simular notificação'}
                </button>
              </div>
            </div>
          </div>
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