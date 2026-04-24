import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'
import PeriodFilter, {
  getTodayInputDate,
  isInsidePeriod,
} from '../components/ui/PeriodFilter'
import { useAuth } from '../contexts/AuthContext'
import {
  getScheduledMessages,
  retryScheduledMessage,
  runScheduledWhatsAppSender,
} from '../services/automationService'
import { supabase } from '../services/supabaseClient'
import { formatCurrency, formatDate, formatPhone } from '../utils/format'

function getStatusConfig(status) {
  if (status === 'sent') {
    return {
      label: 'Enviado',
      icon: CheckCircle2,
      className: 'bg-emerald-100 text-emerald-700',
      cardClass: 'border-emerald-200 bg-emerald-50/40',
    }
  }

  if (status === 'failed') {
    return {
      label: 'Falhou',
      icon: AlertCircle,
      className: 'bg-red-100 text-red-700',
      cardClass: 'border-red-200 bg-red-50/40',
    }
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelado',
      icon: XCircle,
      className: 'bg-slate-200 text-slate-600',
      cardClass: 'border-slate-200 bg-slate-50',
    }
  }

  return {
    label: 'Pendente',
    icon: Clock3,
    className: 'bg-amber-100 text-amber-700',
    cardClass: 'border-amber-200 bg-amber-50/40',
  }
}

function getMessageLabel(type) {
  if (type === 'professional') return 'Profissional'
  if (type === 'urgent') return 'Urgente'
  return 'Amigável'
}

function StatBox({ title, value, icon: Icon, className }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#070D2D]">{value}</p>
        </div>

        <div className={`rounded-2xl p-3 ${className}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

export default function Automations() {
  const { user } = useAuth()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [retryingId, setRetryingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [period, setPeriod] = useState('month')
  const [referenceDate, setReferenceDate] = useState(getTodayInputDate())

  async function loadItems() {
    try {
      if (!user?.id) return

      const data = await getScheduledMessages(user.id)
      setItems(data || [])
    } catch (err) {
      setError(err.message || 'Erro ao carregar automações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(() => {
      loadItems()
    }, 5000)

    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('scheduled-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_messages',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadItems()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const periodItems = useMemo(() => {
    return items.filter((item) =>
      isInsidePeriod(item.created_at || item.scheduled_for, period, referenceDate),
    )
  }, [items, period, referenceDate])

  const stats = useMemo(() => {
    return {
      total: periodItems.length,
      pending: periodItems.filter((item) => item.status === 'pending').length,
      sent: periodItems.filter((item) => item.status === 'sent').length,
      failed: periodItems.filter((item) => item.status === 'failed').length,
      cancelled: periodItems.filter((item) => item.status === 'cancelled').length,
    }
  }, [periodItems])

  const filteredItems = useMemo(() => {
    if (statusFilter === 'todos') return periodItems
    return periodItems.filter((item) => item.status === statusFilter)
  }, [periodItems, statusFilter])

  async function handleRunSender() {
    setError('')
    setSuccess('')
    setSending(true)

    try {
      const result = await runScheduledWhatsAppSender()
      await loadItems()

      setSuccess(
        `Processamento concluído. ${result?.found || 0} mensagem(ns) encontrada(s).`,
      )
    } catch (err) {
      setError(err.message || 'Erro ao processar envios')
    } finally {
      setSending(false)
    }
  }

  async function handleRetry(item) {
    setError('')
    setSuccess('')
    setRetryingId(item.id)

    try {
      await retryScheduledMessage(item.id, user.id)
      await runScheduledWhatsAppSender()
      await loadItems()

      setSuccess('Mensagem reenviada para processamento.')
    } catch (err) {
      setError(err.message || 'Erro ao reenviar mensagem')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
            Central de envios
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#070D2D]">
            Automações
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe mensagens pendentes, enviadas, canceladas e falhas.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunSender}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4A3BE8] disabled:opacity-60"
        >
          {sending ? (
            <RefreshCw className="animate-spin" size={18} />
          ) : (
            <Send size={18} />
          )}
          {sending ? 'Processando...' : 'Processar agora'}
        </button>
      </div>

      <PeriodFilter
        period={period}
        setPeriod={setPeriod}
        referenceDate={referenceDate}
        setReferenceDate={setReferenceDate}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatBox
          title="Total"
          value={stats.total}
          icon={BellRing}
          className="bg-[#5B4BFF]/10 text-[#5B4BFF]"
        />

        <StatBox
          title="Pendentes"
          value={stats.pending}
          icon={Clock3}
          className="bg-amber-100 text-amber-700"
        />

        <StatBox
          title="Enviadas"
          value={stats.sent}
          icon={CheckCircle2}
          className="bg-emerald-100 text-emerald-700"
        />

        <StatBox
          title="Falharam"
          value={stats.failed}
          icon={AlertCircle}
          className="bg-red-100 text-red-700"
        />

        <StatBox
          title="Canceladas"
          value={stats.cancelled}
          icon={XCircle}
          className="bg-slate-200 text-slate-600"
        />
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              Logs de envio
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Histórico completo das mensagens do período selecionado.
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input lg:max-w-xs"
          >
            <option value="todos">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="sent">Enviadas</option>
            <option value="failed">Falharam</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className="mt-6">
          {loading ? (
            <p>Carregando automações...</p>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <CalendarClock className="mx-auto text-[#5B4BFF]" size={34} />
              <p className="mt-3 font-semibold text-[#070D2D]">
                Nenhuma mensagem encontrada
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Não há mensagens para o período e status selecionados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const status = getStatusConfig(item.status)
                const StatusIcon = status.icon

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition ${status.cardClass}`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                          >
                            <StatusIcon size={13} />
                            {status.label}
                          </span>

                          <span className="rounded-full bg-[#5B4BFF]/10 px-3 py-1 text-xs font-semibold text-[#5B4BFF]">
                            {getMessageLabel(item.message_type)}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            Tentativas: {item.attempts || 0}
                          </span>
                        </div>

                        <h3 className="mt-3 font-semibold text-[#070D2D]">
                          {item.client?.name || 'Cliente não informado'}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600">
                          {item.charge?.description || 'Cobrança sem descrição'}
                        </p>

                        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                          <p>
                            <strong>Telefone:</strong>{' '}
                            {formatPhone(item.client?.phone || item.phone || '')}
                          </p>

                          <p>
                            <strong>Valor:</strong>{' '}
                            {formatCurrency(item.charge?.amount || 0)}
                          </p>

                          <p>
                            <strong>Agendado:</strong>{' '}
                            {item.scheduled_for
                              ? formatDate(item.scheduled_for.slice(0, 10))
                              : '-'}
                          </p>

                          <p>
                            <strong>Enviado:</strong>{' '}
                            {item.sent_at
                              ? new Date(item.sent_at).toLocaleString('pt-BR')
                              : '-'}
                          </p>
                        </div>

                        <div className="mt-4 rounded-2xl bg-white/80 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Mensagem
                          </p>
                          <p className="mt-1">{item.message_text}</p>
                        </div>

                        {item.error_message ? (
                          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <strong>Erro:</strong> {item.error_message}
                          </div>
                        ) : null}

                        {item.provider_message_id ? (
                          <p className="mt-3 text-xs text-slate-400">
                            ID provedor: {item.provider_message_id}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {item.status === 'failed' ? (
                          <button
                            type="button"
                            onClick={() => handleRetry(item)}
                            disabled={retryingId === item.id}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#5B4BFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4A3BE8] disabled:opacity-60"
                          >
                            <RefreshCw
                              size={16}
                              className={
                                retryingId === item.id ? 'animate-spin' : ''
                              }
                            />
                            {retryingId === item.id ? 'Reenviando...' : 'Reenviar'}
                          </button>
                        ) : null}

                        {item.status === 'pending' ? (
                          <span className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                            <Clock3 size={16} />
                            Aguardando envio
                          </span>
                        ) : null}

                        {item.status === 'sent' ? (
                          <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 size={16} />
                            Enviado
                          </span>
                        ) : null}

                        {item.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                            <XCircle size={16} />
                            Cancelado
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}