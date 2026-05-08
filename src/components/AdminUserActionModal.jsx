import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const PLAN_OPTIONS = [
  {
    id: 'basic',
    name: 'Inicial',
  },
  {
    id: 'unlimited',
    name: 'Pro',
  },
  {
    id: 'scale',
    name: 'Scale',
  },
]

const ACTION_OPTIONS = [
  {
    id: 'ADD_CREDITS',
    label: 'Adicionar créditos',
    description: 'Adiciona mensagens extras manualmente para o usuário.',
  },
  {
    id: 'CHANGE_PLAN',
    label: 'Alterar plano',
    description: 'Ativa ou troca o plano do usuário por um período definido.',
  },
  {
    id: 'SET_SUBSCRIPTION_STATUS',
    label: 'Alterar status da assinatura',
    description: 'Ativa, inativa, cancela ou marca a assinatura como vencida.',
  },
  {
    id: 'BLOCK_USER',
    label: 'Bloquear usuário',
    description: 'Impede o usuário de acessar a plataforma.',
  },
  {
    id: 'UNBLOCK_USER',
    label: 'Desbloquear usuário',
    description: 'Libera novamente o acesso do usuário.',
  },
]

export default function AdminUserActionModal({
  open,
  user,
  loading = false,
  onClose,
  onSubmit,
}) {
  const [action, setAction] = useState('ADD_CREDITS')
  const [quantity, setQuantity] = useState(50)
  const [planId, setPlanId] = useState('scale')
  const [days, setDays] = useState(30)
  const [status, setStatus] = useState('inactive')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return

    setAction('ADD_CREDITS')
    setQuantity(50)
    setPlanId('scale')
    setDays(30)
    setStatus('inactive')
    setReason('')
    setNote('')
  }, [open, user?.user_id])

  if (!open || !user) return null

  function handleSubmit(e) {
    e.preventDefault()

    const payload = {
      action,
      target_user_id: user.user_id,
    }

    if (action === 'ADD_CREDITS') {
      payload.quantity = Number(quantity || 0)
      payload.note = note || 'Crédito manual pelo painel admin.'
    }

    if (action === 'CHANGE_PLAN') {
      payload.plan_id = planId
      payload.days = Number(days || 30)
    }

    if (action === 'SET_SUBSCRIPTION_STATUS') {
      payload.status = status
      payload.days = Number(days || 30)
    }

    if (action === 'BLOCK_USER') {
      payload.reason = reason || 'Bloqueado manualmente pela administração.'
    }

    onSubmit(payload)
  }

  const selectedAction = ACTION_OPTIONS.find((item) => item.id === action)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070D2D]/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5B4BFF]">
              Ação administrativa
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#070D2D]">
              Gerenciar usuário
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {user.name || 'Sem nome'} — {user.email}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl bg-slate-100 p-3 text-slate-500 hover:bg-slate-200 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="text-sm font-black text-[#070D2D]">
              Tipo de ação
            </label>

            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
            >
              {ACTION_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>

            {selectedAction?.description ? (
              <p className="mt-2 text-xs text-slate-500">
                {selectedAction.description}
              </p>
            ) : null}
          </div>

          {action === 'ADD_CREDITS' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-black text-[#070D2D]">
                  Quantidade de créditos
                </label>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                />
              </div>

              <div>
                <label className="text-sm font-black text-[#070D2D]">
                  Observação interna
                </label>

                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: bônus comercial"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                />
              </div>
            </div>
          ) : null}

          {action === 'CHANGE_PLAN' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-black text-[#070D2D]">
                  Plano
                </label>

                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                >
                  {PLAN_OPTIONS.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-black text-[#070D2D]">
                  Dias de validade
                </label>

                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                />
              </div>
            </div>
          ) : null}

          {action === 'SET_SUBSCRIPTION_STATUS' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-black text-[#070D2D]">
                  Status
                </label>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="past_due">Vencido</option>
                </select>
              </div>

              {status === 'active' ? (
                <div>
                  <label className="text-sm font-black text-[#070D2D]">
                    Dias de validade
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {action === 'BLOCK_USER' ? (
            <div>
              <label className="text-sm font-black text-[#070D2D]">
                Motivo do bloqueio
              </label>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: inadimplência, uso indevido, solicitação do titular..."
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
              />
            </div>
          ) : null}

          {action === 'UNBLOCK_USER' ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
              Esta ação vai liberar novamente o acesso do usuário à plataforma.
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-200 disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-black text-white hover:bg-[#4A3BE8] disabled:opacity-60"
            >
              {loading ? 'Executando...' : 'Confirmar ação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}