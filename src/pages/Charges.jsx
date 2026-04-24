import { useEffect, useMemo, useState } from 'react'
import { Pencil, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getClients } from '../services/clientsService'
import {
  createCharge,
  deleteCharge,
  getCharges,
  markChargeAsPaid,
  updateCharge,
} from '../services/chargesService'
import {
  buildDefaultRules,
  replaceAutomationForCharge,
} from '../services/automationService'
import { formatCurrency, formatDate } from '../utils/format'
import { buildMessage, openWhatsApp } from '../utils/whatsapp'

const initialForm = {
  client_id: '',
  description: '',
  amount: '',
  due_date: '',
  message_type: 'friendly',
  automation: {
    oneMonthBefore: false,
    fifteenDaysBefore: false,
    fiveDaysBefore: false,
    onDueDate: true,
    afterDueDays: '',
  },
}

function getStatusLabel(status) {
  if (status === 'pago') return 'Pago'
  if (status === 'atrasado') return 'Atrasado'
  return 'Pendente'
}

function getMessageTypeLabel(type) {
  if (type === 'professional') return 'Profissional'
  if (type === 'urgent') return 'Urgente'
  return 'Amigável'
}

function isOverdue(charge) {
  if (charge.status === 'pago') return false
  const today = new Date()
  const due = new Date(charge.due_date + 'T00:00:00')
  return due < new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

export default function Charges() {
  const { user } = useAuth()

  const [clients, setClients] = useState([])
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsData, chargesData] = await Promise.all([
          getClients(user.id),
          getCharges(user.id),
        ])

        setClients(clientsData)
        setCharges(chargesData)
      } catch (err) {
        setError(err.message || 'Erro ao carregar cobranças')
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) loadData()
  }, [user])

  const enrichedCharges = useMemo(() => {
    return charges.map((charge) => ({
      ...charge,
      computedStatus:
        charge.status === 'pago'
          ? 'pago'
          : isOverdue(charge)
          ? 'atrasado'
          : 'pendente',
    }))
  }, [charges])

  const filteredCharges = useMemo(() => {
    const term = search.trim().toLowerCase()

    return enrichedCharges.filter((charge) => {
      const matchesStatus =
        statusFilter === 'todos' || charge.computedStatus === statusFilter

      const matchesSearch =
        term === '' ||
        charge.client?.name?.toLowerCase().includes(term) ||
        charge.description?.toLowerCase().includes(term) ||
        formatDate(charge.due_date).includes(term)

      return matchesStatus && matchesSearch
    })
  }, [enrichedCharges, statusFilter, search])

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function validateForm() {
    if (!form.client_id) return 'Selecione um cliente.'
    if (!form.description.trim()) return 'Informe a descrição.'
    if (!form.amount || Number(form.amount) <= 0) return 'Informe um valor válido.'
    if (!form.due_date) return 'Informe a data de vencimento.'
    if (!form.message_type) return 'Selecione o tom da mensagem.'
    return ''
  }

  async function syncAutomation(charge) {
    const rules = buildDefaultRules(form.automation)

    await replaceAutomationForCharge({
      user_id: user.id,
      charge,
      rules,
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    resetMessages()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        const existing = charges.find((charge) => charge.id === editingId)

        const updated = await updateCharge({
          id: editingId,
          user_id: user.id,
          client_id: form.client_id,
          description: form.description.trim(),
          amount: Number(form.amount),
          due_date: form.due_date,
          status: existing?.status || 'pendente',
          message_type: form.message_type,
        })

        await syncAutomation(updated)

        setCharges((current) =>
          current.map((charge) => (charge.id === editingId ? updated : charge)),
        )
        setSuccess('Cobrança atualizada com sucesso.')
      } else {
        const newCharge = await createCharge({
          user_id: user.id,
          client_id: form.client_id,
          description: form.description.trim(),
          amount: Number(form.amount),
          due_date: form.due_date,
          message_type: form.message_type,
        })

        await syncAutomation(newCharge)

        setCharges((current) => [newCharge, ...current])
        setSuccess('Cobrança criada com sucesso.')
      }

      resetForm()
    } catch (err) {
      setError(err.message || 'Erro ao salvar cobrança')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(charge) {
    resetMessages()
    setEditingId(charge.id)
    setForm({
      client_id: charge.client?.id ?? charge.client_id ?? '',
      description: charge.description ?? '',
      amount: String(charge.amount ?? ''),
      due_date: charge.due_date ?? '',
      message_type: charge.message_type ?? 'friendly',
      automation: initialForm.automation,
    })
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Deseja realmente excluir esta cobrança?')
    if (!confirmed) return

    resetMessages()

    try {
      await deleteCharge(id, user.id)
      setCharges((current) => current.filter((charge) => charge.id !== id))
      if (editingId === id) resetForm()
      setSuccess('Cobrança excluída com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao excluir cobrança')
    }
  }

  async function handleMarkAsPaid(id) {
    resetMessages()

    try {
      await markChargeAsPaid(id, user.id)
      setCharges((current) =>
        current.map((charge) =>
          charge.id === id ? { ...charge, status: 'pago' } : charge,
        ),
      )
      setSuccess('Cobrança marcada como paga.')
    } catch (err) {
      setError(err.message || 'Erro ao atualizar cobrança')
    }
  }

  function handleSend(charge) {
    if (!charge.client) return

    const message = buildMessage(
      charge.message_type || 'friendly',
      charge.client.name,
      charge.description,
      charge.amount,
      charge.due_date,
    )

    openWhatsApp(charge.client.phone, message)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Cobranças</h1>
        <p className="page-subtitle">
          Crie cobranças, programe lembretes e envie mensagens profissionais.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid gap-4 md:grid-cols-2">
        <select
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          className="input"
        >
          <option value="">Selecione um cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <select
          value={form.message_type}
          onChange={(e) => setForm({ ...form, message_type: e.target.value })}
          className="input"
        >
          <option value="friendly">Tom amigável</option>
          <option value="professional">Tom profissional</option>
          <option value="urgent">Tom urgente</option>
        </select>

        <input
          type="text"
          placeholder="Descrição"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input"
        />

        <input
          type="number"
          step="0.01"
          placeholder="Valor"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="input"
        />

        <input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          className="input md:col-span-2"
        />

        <div className="rounded-3xl border border-[#5B4BFF]/20 bg-[#5B4BFF]/5 p-4 md:col-span-2">
          <h3 className="text-lg font-semibold text-[#070D2D]">
            Automação de cobrança
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Escolha quando o sistema deve programar as mensagens.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ['oneMonthBefore', '30 dias antes'],
              ['fifteenDaysBefore', '15 dias antes'],
              ['fiveDaysBefore', '5 dias antes'],
              ['onDueDate', 'No dia do vencimento'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={form.automation[key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      automation: {
                        ...form.automation,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 accent-[#5B4BFF]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Dias após o vencimento
            </label>
            <input
              type="number"
              min="0"
              placeholder="Ex: 3"
              value={form.automation.afterDueDays}
              onChange={(e) =>
                setForm({
                  ...form,
                  automation: {
                    ...form.automation,
                    afterDueDays: e.target.value,
                  },
                })
              }
              className="input mt-2"
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600 md:col-span-2">{error}</p>
        ) : null}

        {success ? (
          <p className="text-sm text-[#5B4BFF] md:col-span-2">{success}</p>
        ) : null}

        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-2xl bg-[#5B4BFF] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#4A3BE8] disabled:opacity-60">
            {saving
              ? 'Salvando...'
              : editingId
              ? 'Atualizar cobrança'
              : 'Salvar cobrança'}
          </button>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <X size={16} />
              Cancelar edição
            </button>
          ) : null}
        </div>
      </form>

      <div className="card grid gap-4 lg:grid-cols-[220px_1fr]">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="atrasado">Atrasadas</option>
          <option value="pago">Pagas</option>
        </select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, descrição ou data"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11"
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Carregando cobranças...</p>
        ) : filteredCharges.length === 0 ? (
          <p className="text-slate-500">Nenhuma cobrança encontrada.</p>
        ) : (
          <div className="space-y-3">
            {filteredCharges.map((charge) => (
              <div
                key={charge.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-[#070D2D]">{charge.client?.name}</p>
                  <p className="text-sm text-slate-600">{charge.description}</p>
                  <p className="text-sm text-slate-500">
                    {formatDate(charge.due_date)} • {formatCurrency(charge.amount)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="badge">{getStatusLabel(charge.computedStatus)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {getMessageTypeLabel(charge.message_type || 'friendly')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSend(charge)}
                    className="rounded-2xl bg-[#5B4BFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4A3BE8]"
                  >
                    Enviar WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkAsPaid(charge.id)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Marcar como pago
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEdit(charge)}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-[#5B4BFF] hover:bg-[#5B4BFF]/10"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(charge.id)}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}