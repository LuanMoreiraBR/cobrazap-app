import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Pencil,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
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

function getStatusStyle(status) {
  if (status === 'pago') return 'bg-emerald-100 text-emerald-700'
  if (status === 'atrasado') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
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

  const pending = enrichedCharges.filter((item) => item.computedStatus === 'pendente')
  const overdue = enrichedCharges.filter((item) => item.computedStatus === 'atrasado')
  const paid = enrichedCharges.filter((item) => item.computedStatus === 'pago')

  const totalOpen = [...pending, ...overdue].reduce(
    (acc, item) => acc + Number(item.amount),
    0,
  )

  const totalPaid = paid.reduce((acc, item) => acc + Number(item.amount), 0)

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
      <div className="rounded-3xl bg-gradient-to-r from-[#070D2D] via-[#161B4D] to-[#5B4BFF] p-6 text-white shadow-sm">
        <p className="text-sm font-semibold text-[#AFA8FF]">
          Gestão de recebimentos
        </p>
        <h1 className="mt-2 text-3xl font-bold">Cobranças</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Crie cobranças, programe lembretes automáticos e envie mensagens
          profissionais pelo WhatsApp.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatBox
          title="Em aberto"
          value={pending.length}
          icon={Clock3}
          className="bg-amber-100 text-amber-700"
        />

        <StatBox
          title="Atrasadas"
          value={overdue.length}
          icon={AlertTriangle}
          className="bg-red-100 text-red-700"
        />

        <StatBox
          title="Pagas"
          value={paid.length}
          icon={CheckCircle2}
          className="bg-emerald-100 text-emerald-700"
        />

        <StatBox
          title="Total em aberto"
          value={formatCurrency(totalOpen)}
          icon={Wallet}
          className="bg-[#5B4BFF]/10 text-[#5B4BFF]"
        />
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              {editingId ? 'Editar cobrança' : 'Nova cobrança'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Informe o cliente, valor, vencimento e regras de lembrete.
            </p>
          </div>

          <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
            <Wallet size={22} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <div className="mt-5 rounded-3xl border border-[#5B4BFF]/20 bg-[#5B4BFF]/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
              <CalendarClock size={22} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#070D2D]">
                Automação de cobrança
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Escolha quando o sistema deve programar as mensagens.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ['oneMonthBefore', '30 dias antes'],
              ['fifteenDaysBefore', '15 dias antes'],
              ['fiveDaysBefore', '5 dias antes'],
              ['onDueDate', 'No dia do vencimento'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 transition hover:border-[#5B4BFF]/40 hover:bg-white"
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
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
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

      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              Lista de cobranças
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Filtre por status ou busque por cliente, descrição e data.
            </p>
          </div>

          <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[220px_1fr]">
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
        </div>

        <div className="mt-6">
          {loading ? (
            <p>Carregando cobranças...</p>
          ) : filteredCharges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <Wallet className="mx-auto text-[#5B4BFF]" size={34} />
              <p className="mt-3 font-semibold text-[#070D2D]">
                Nenhuma cobrança encontrada
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Crie uma nova cobrança para começar a acompanhar seus recebimentos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="rounded-2xl border border-slate-200 p-4 transition hover:border-[#5B4BFF]/40 hover:bg-[#5B4BFF]/5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#070D2D]">
                          {charge.client?.name || 'Cliente não informado'}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                            charge.computedStatus,
                          )}`}
                        >
                          {getStatusLabel(charge.computedStatus)}
                        </span>

                        <span className="rounded-full bg-[#5B4BFF]/10 px-3 py-1 text-xs font-semibold text-[#5B4BFF]">
                          {getMessageTypeLabel(charge.message_type || 'friendly')}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {charge.description}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Vence em {formatDate(charge.due_date)} •{' '}
                        <strong className="text-[#070D2D]">
                          {formatCurrency(charge.amount)}
                        </strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSend(charge)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#5B4BFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4A3BE8]"
                      >
                        <MessageCircle size={16} />
                        WhatsApp
                      </button>

                      {charge.computedStatus !== 'pago' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(charge.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <CheckCircle2 size={16} />
                          Pago
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleEdit(charge)}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-[#5B4BFF] transition hover:bg-[#5B4BFF]/10"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(charge.id)}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}