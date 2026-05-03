import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  HelpCircle,
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
  createPixPaymentForCharge,
  deleteCharge,
  getCharges,
  markChargeAsPaid,
  updateCharge,
} from '../services/chargesService'
import {
  buildDefaultRules,
  cancelPendingMessagesForCharge,
  replaceAutomationForCharge,
} from '../services/automationService'
import { formatCurrency, formatDate } from '../utils/format'
import { buildMessage, buildPixMessage, openWhatsApp } from '../utils/whatsapp'

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function createInstallmentGroupId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function addMonthsKeepingDueDay(dateString, monthsToAdd) {
  const originalDate = new Date(dateString + 'T00:00:00')
  const originalDay = originalDate.getDate()

  const targetYear = originalDate.getFullYear()
  const targetMonth = originalDate.getMonth() + monthsToAdd

  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate()

  const finalDay = Math.min(originalDay, lastDayOfTargetMonth)
  const finalDate = new Date(targetYear, targetMonth, finalDay)

  const year = finalDate.getFullYear()
  const month = String(finalDate.getMonth() + 1).padStart(2, '0')
  const day = String(finalDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function generateInstallments({ amount, dueDate, installments }) {
  const totalAmount = Number(amount)
  const totalInstallments = Number(installments)

  if (!totalAmount || totalAmount <= 0 || !dueDate || totalInstallments < 2) {
    return []
  }

  const installmentAmount = Math.floor((totalAmount / totalInstallments) * 100) / 100
  const totalCalculated = installmentAmount * totalInstallments
  const difference = Number((totalAmount - totalCalculated).toFixed(2))

  return Array.from({ length: totalInstallments }, (_, index) => {
    const isLast = index === totalInstallments - 1

    return {
      installment_number: index + 1,
      installment_total: totalInstallments,
      amount: isLast
        ? Number((installmentAmount + difference).toFixed(2))
        : installmentAmount,
      due_date: addMonthsKeepingDueDay(dueDate, index),
    }
  })
}

const automationTips = {
  oneMonthBefore: 'Programa uma mensagem para 30 dias antes da data de vencimento.',
  fifteenDaysBefore: 'Programa uma mensagem para 15 dias antes da data de vencimento.',
  fiveDaysBefore: 'Programa uma mensagem para 5 dias antes da data de vencimento.',
  onDueDate: 'Programa uma mensagem para o próprio dia do vencimento.',
  afterDueDays:
    'Informe quantos dias depois do vencimento o sistema deve enviar uma nova cobrança. Exemplo: 3 envia 3 dias após vencer.',
  dueDate:
    'Essa é a data base da cobrança. Todos os lembretes automáticos serão calculados a partir dela.',
}

function InfoTooltip({ text }) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle
        size={15}
        className="cursor-help text-slate-400 transition hover:text-[#5B4BFF]"
      />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-2xl bg-[#070D2D] px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  )
}

function createInitialForm() {
  return {
    client_id: '',
    description: '',
    amount: '',
    due_date: getTodayInputDate(),
    message_type: 'friendly',
    payment_type: 'single',
    installments: 2,
    automation: {
      oneMonthBefore: false,
      fifteenDaysBefore: false,
      fiveDaysBefore: false,
      onDueDate: true,
      afterDueDays: '',
    },
  }
}

const initialForm = createInitialForm()

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

function getPaymentTypeLabel(charge) {
  if (charge.payment_type === 'installment') {
    return `Parcela ${charge.installment_number}/${charge.installment_total}`
  }

  return 'À vista'
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
  const [generatingPixId, setGeneratingPixId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(() => createInitialForm())

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

  const installmentPreview = useMemo(() => {
    if (editingId) return []
    if (form.payment_type !== 'installment') return []

    return generateInstallments({
      amount: Number(form.amount),
      dueDate: form.due_date,
      installments: Number(form.installments),
    })
  }, [editingId, form.payment_type, form.amount, form.due_date, form.installments])

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
        formatDate(charge.due_date).includes(term) ||
        getPaymentTypeLabel(charge).toLowerCase().includes(term)

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

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function resetForm() {
    setForm(createInitialForm())
    setEditingId(null)
  }

  function validateForm() {
    if (!form.client_id) return 'Selecione um cliente.'
    if (!form.description.trim()) return 'Informe a descrição.'
    if (!form.amount || Number(form.amount) <= 0) return 'Informe um valor válido.'
    if (!form.due_date) return 'Informe a data de vencimento.'
    if (!form.message_type) return 'Selecione o tom da mensagem.'

    if (!editingId && form.payment_type === 'installment') {
      if (!form.installments || Number(form.installments) < 2) {
        return 'Informe pelo menos 2 parcelas.'
      }

      if (Number(form.installments) > 36) {
        return 'O limite máximo é de 36 parcelas.'
      }
    }

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

  async function createSingleCharge() {
    const newCharge = await createCharge({
      user_id: user.id,
      client_id: form.client_id,
      description: form.description.trim(),
      amount: Number(form.amount),
      due_date: form.due_date,
      message_type: form.message_type,
      payment_type: 'single',
      original_amount: Number(form.amount),
      installment_group_id: null,
      installment_number: null,
      installment_total: null,
    })

    const chargeWithPix = await createPixPaymentForCharge(newCharge.id, user.id)

    await syncAutomation(chargeWithPix)

    setCharges((current) => [chargeWithPix, ...current])
    setSuccess('Cobrança criada, Pix gerado e automações programadas.')
  }

  async function createInstallmentCharges() {
    const installmentGroupId = createInstallmentGroupId()
    const originalAmount = Number(form.amount)

    const generatedInstallments = generateInstallments({
      amount: originalAmount,
      dueDate: form.due_date,
      installments: Number(form.installments),
    })

    const createdCharges = []

    for (const installment of generatedInstallments) {
      const newCharge = await createCharge({
        user_id: user.id,
        client_id: form.client_id,
        description: `${form.description.trim()} - Parcela ${installment.installment_number}/${installment.installment_total}`,
        amount: installment.amount,
        due_date: installment.due_date,
        message_type: form.message_type,
        payment_type: 'installment',
        installment_group_id: installmentGroupId,
        installment_number: installment.installment_number,
        installment_total: installment.installment_total,
        original_amount: originalAmount,
      })

      const chargeWithPix = await createPixPaymentForCharge(newCharge.id, user.id)

      await syncAutomation(chargeWithPix)

      createdCharges.push(chargeWithPix)
    }

    setCharges((current) => [...createdCharges, ...current])
    setSuccess(
      `Parcelamento criado com sucesso: ${generatedInstallments.length} parcelas com Pix e automações programadas.`,
    )
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
          payment_type: existing?.payment_type || 'single',
          installment_group_id: existing?.installment_group_id || null,
          installment_number: existing?.installment_number || null,
          installment_total: existing?.installment_total || null,
          original_amount: existing?.original_amount || Number(form.amount),
        })

        const chargeWithPix = updated.pix_qr_code
          ? updated
          : await createPixPaymentForCharge(updated.id, user.id)

        await syncAutomation(chargeWithPix)

        setCharges((current) =>
          current.map((charge) =>
            charge.id === editingId ? chargeWithPix : charge,
          ),
        )

        setSuccess('Cobrança atualizada, Pix gerado e automações recriadas.')
      } else if (form.payment_type === 'installment') {
        await createInstallmentCharges()
      } else {
        await createSingleCharge()
      }

      resetForm()
    } catch (err) {
      setError(err.message || 'Erro ao salvar cobrança')
    } finally {
      setSaving(false)
    }
  }

  async function handleGeneratePix(charge) {
    resetMessages()
    setGeneratingPixId(charge.id)

    try {
      const updatedCharge = await createPixPaymentForCharge(charge.id, user.id)

      setCharges((current) =>
        current.map((item) =>
          item.id === charge.id ? { ...item, ...updatedCharge } : item,
        ),
      )

      setSuccess('Pix gerado com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao gerar Pix')
    } finally {
      setGeneratingPixId(null)
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
      payment_type: charge.payment_type ?? 'single',
      installments: charge.installment_total ?? 2,
      automation: createInitialForm().automation,
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
      await cancelPendingMessagesForCharge(id, user.id)

      setCharges((current) =>
        current.map((charge) =>
          charge.id === id ? { ...charge, status: 'pago' } : charge,
        ),
      )

      setSuccess('Cobrança marcada como paga. Lembretes pendentes foram cancelados.')
    } catch (err) {
      setError(err.message || 'Erro ao atualizar cobrança')
    }
  }

  function handleSend(charge) {
    if (!charge.client) return

    const message = charge.pix_qr_code
      ? buildPixMessage(charge)
      : buildMessage(
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
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
            Gestão de recebimentos
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#070D2D]">Cobranças</h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie cobranças, parcele dívidas, programe lembretes automáticos e envie mensagens profissionais.
          </p>
        </div>

        <div className="hidden rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF] md:block">
          <Wallet size={22} />
        </div>
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
              Informe o cliente, valor, vencimento, forma de cobrança e regras de lembrete.
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
            placeholder="Valor total da dívida"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input"
          />

          {!editingId ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#070D2D]">
                  Forma de cobrança
                </label>

                <select
                  value={form.payment_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payment_type: e.target.value,
                      installments: e.target.value === 'single' ? 2 : form.installments,
                    })
                  }
                  className="input"
                >
                  <option value="single">Cobrança à vista</option>
                  <option value="installment">Parcelar dívida</option>
                </select>
              </div>

              {form.payment_type === 'installment' ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#070D2D]">
                    Quantidade de parcelas
                  </label>

                  <input
                    type="number"
                    min="2"
                    max="36"
                    value={form.installments}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        installments: e.target.value,
                      })
                    }
                    className="input"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Durante a edição, o sistema altera apenas esta cobrança específica.
              Para criar novas parcelas, cancele a edição e cadastre uma nova cobrança parcelada.
            </div>
          )}

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-semibold text-[#070D2D]">
                Data de vencimento
              </label>
              <InfoTooltip text={automationTips.dueDate} />
            </div>

            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="input"
            />

            <p className="mt-2 text-xs text-slate-500">
              Na cobrança parcelada, esta será a data da primeira parcela. As próximas serão criadas nos meses seguintes.
            </p>
          </div>
        </div>

        {installmentPreview.length > 0 ? (
          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-[#070D2D]">
                Prévia do parcelamento
              </h3>
              <p className="text-sm text-slate-600">
                O sistema criará {installmentPreview.length} cobranças futuras, cada uma com seu próprio Pix, vencimento e automação.
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
              {installmentPreview.map((item) => (
                <div
                  key={item.installment_number}
                  className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-3"
                >
                  <span className="font-semibold text-[#070D2D]">
                    Parcela {item.installment_number}/{item.installment_total}
                  </span>

                  <span className="text-slate-600">
                    {formatCurrency(item.amount)}
                  </span>

                  <span className="text-slate-600">
                    Vence em {formatDate(item.due_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 transition hover:border-[#5B4BFF]/40"
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

                <span className="flex items-center gap-2">
                  {label}
                  <InfoTooltip text={automationTips[key]} />
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-slate-700">
                Dias após o vencimento
              </label>
              <InfoTooltip text={automationTips.afterDueDays} />
            </div>

            <input
              type="number"
              min="0"
              placeholder="Ex: 3 dias depois do vencimento"
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
                : form.payment_type === 'installment'
                  ? 'Salvar parcelamento'
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
              Filtre por status ou busque por cliente, descrição, data e parcela.
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
                placeholder="Buscar por cliente, descrição, parcela ou data"
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
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
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

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {getPaymentTypeLabel(charge)}
                        </span>

                        {charge.pix_qr_code ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Pix gerado
                          </span>
                        ) : null}
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

                      {charge.payment_type === 'installment' ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Dívida original:{' '}
                          <strong className="text-[#070D2D]">
                            {formatCurrency(charge.original_amount || charge.amount)}
                          </strong>
                        </p>
                      ) : null}

                      {charge.pix_qr_code ? (
                        <div className="mt-3 rounded-2xl border border-[#5B4BFF]/20 bg-[#5B4BFF]/5 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-[#070D2D]">
                            Pix disponível
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            O WhatsApp enviará o código Pix copia e cola junto com a cobrança.
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                navigator.clipboard.writeText(charge.pix_qr_code)
                              }
                              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#5B4BFF] ring-1 ring-[#5B4BFF]/20 hover:bg-[#5B4BFF]/10"
                            >
                              Copiar Pix
                            </button>

                            {charge.payment_url ? (
                              <a
                                href={charge.payment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                              >
                                Abrir pagamento
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      {charge.computedStatus !== 'pago' ? (
                        <button
                          type="button"
                          onClick={() => handleGeneratePix(charge)}
                          disabled={generatingPixId === charge.id || !!charge.pix_qr_code}
                          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                            charge.pix_qr_code
                              ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-[#5B4BFF]/20 bg-[#5B4BFF]/10 text-[#5B4BFF] hover:bg-[#5B4BFF]/15'
                          } disabled:opacity-70`}
                        >
                          {generatingPixId === charge.id
                            ? 'Gerando...'
                            : charge.pix_qr_code
                              ? 'Pix gerado'
                              : 'Gerar Pix'}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleSend(charge)}
                        disabled={charge.computedStatus === 'pago'}
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                          charge.computedStatus === 'pago'
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-[#5B4BFF] text-white hover:bg-[#4A3BE8]'
                        }`}
                      >
                        <MessageCircle size={16} />
                        {charge.computedStatus === 'pago' ? 'Pago' : 'WhatsApp'}
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