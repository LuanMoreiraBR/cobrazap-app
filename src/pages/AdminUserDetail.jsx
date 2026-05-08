import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminUserActionModal from '../components/AdminUserActionModal'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  LogOut,
  MessageCircle,
  RefreshCw,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import {
  getAdminUserDetail,
  runAdminUserAction,
} from '../services/adminService'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/format'

function Card({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-[#070D2D]">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF] ring-1 ring-[#5B4BFF]/20">
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function StatusPill({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-[#5B4BFF]/10 text-[#5B4BFF]',
    blue: 'bg-blue-100 text-blue-700',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR')
}

function getActionLabel(action) {
  const labels = {
    ADD_CREDITS: 'Adicionou créditos',
    CHANGE_PLAN: 'Alterou plano',
    SET_SUBSCRIPTION_STATUS: 'Alterou assinatura',
    BLOCK_USER: 'Bloqueou usuário',
    UNBLOCK_USER: 'Desbloqueou usuário',
  }

  return labels[action] || action
}

export default function AdminUserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionModalOpen, setActionModalOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function load() {
    setError('')
    setLoading(true)

    try {
      const result = await getAdminUserDetail(userId)
      setData(result)
    } catch (err) {
      setError(err.message || 'Erro ao carregar usuário.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [userId])

  async function runUserAction(payload) {
    setActionLoading(true)
    setError('')

    try {
      await runAdminUserAction({
        ...payload,
        target_user_id: userId,
      })

      setActionModalOpen(false)
      await load()
    } catch (err) {
      setError(err.message || 'Erro ao executar ação.')
    } finally {
      setActionLoading(false)
    }
  }

  const statusTone = useMemo(() => {
    if (data?.user?.is_blocked) return 'red'
    if (data?.subscription?.status === 'active') return 'green'
    if (data?.subscription?.status === 'trial') return 'purple'
    return 'slate'
  }, [data])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-[#5B4BFF]/20 border-t-[#5B4BFF]" />
          <p className="text-sm font-bold text-[#070D2D]">
            Carregando detalhes do usuário...
          </p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>

        <Link
          to="/admin"
          className="mt-4 inline-flex rounded-2xl bg-[#070D2D] px-5 py-3 text-sm font-black text-white"
        >
          Voltar ao admin
        </Link>
      </div>
    )
  }

  const user = data.user
  const subscription = data.subscription
  const usage = data.usage
  const financial = data.financial

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-[#070D2D] p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 text-sm font-bold text-violet-200 hover:text-white"
            >
              <ArrowLeft size={16} />
              Voltar ao painel admin
            </Link>

            <h1 className="mt-3 text-3xl font-black">
              {user.name || 'Sem nome'}
            </h1>

            <p className="mt-1 text-sm text-slate-300">{user.email}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone={statusTone}>
                {user.is_blocked ? 'Bloqueado' : subscription.plan_name}
              </StatusPill>

              <StatusPill tone="blue">{subscription.status}</StatusPill>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-100"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {user.is_blocked ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <strong>Usuário bloqueado.</strong>{' '}
            {user.blocked_reason || 'Sem motivo informado.'}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card
            title="Plano atual"
            value={subscription.plan_name}
            subtitle={
              subscription.current_period_end
                ? `Vence em ${formatDateTime(subscription.current_period_end)}`
                : 'Sem vencimento definido'
            }
            icon={UserCheck}
          />

          <Card
            title="Mensagens"
            value={`${usage.messages_used}/${usage.total_message_limit || '∞'}`}
            subtitle={`${usage.extra_credits} créditos extras`}
            icon={MessageCircle}
          />

          <Card
            title="Clientes"
            value={`${usage.clients_count}/${usage.client_limit || '∞'}`}
            subtitle="Clientes cadastrados"
            icon={Users}
          />

          <Card
            title="Créditos extras"
            value={usage.extra_credits}
            subtitle={`${data.credits.paid_count} compras pagas`}
            icon={CreditCard}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card
            title="Cobranças"
            value={financial.charges_count}
            subtitle={`${financial.open_charges_count} em aberto`}
            icon={Wallet}
          />

          <Card
            title="Atrasadas"
            value={financial.overdue_charges_count}
            subtitle="Cobranças vencidas"
            icon={Ban}
          />

          <Card
            title="Recebido"
            value={formatCurrency(financial.received_amount || 0)}
            subtitle="Total pago nas cobranças"
            icon={CheckCircle2}
          />

          <Card
            title="Em aberto"
            value={formatCurrency(financial.open_amount || 0)}
            subtitle="Pendente/atrasado"
            icon={Wallet}
          />
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-[#070D2D]">Ações rápidas</h2>

          <p className="mt-1 text-sm text-slate-500">
            Ajustes manuais para suporte e operação.
          </p>

          <div className="mt-5">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setActionModalOpen(true)}
              className="rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-black text-white hover:bg-[#4A3BE8] disabled:opacity-60"
            >
              Gerenciar usuário
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-[#070D2D]">
              Últimas cobranças
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-3">Cliente</th>
                    <th className="py-3">Descrição</th>
                    <th className="py-3">Valor</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Criado em</th>
                  </tr>
                </thead>

                <tbody>
                  {data.charges.slice(0, 20).map((charge) => (
                    <tr key={charge.id} className="border-b last:border-0">
                      <td className="py-3">{charge.client?.name || '-'}</td>
                      <td className="py-3">{charge.description || '-'}</td>
                      <td className="py-3">
                        {formatCurrency(charge.amount || 0)}
                      </td>
                      <td className="py-3">
                        <StatusPill
                          tone={
                            charge.computed_status === 'pago'
                              ? 'green'
                              : charge.computed_status === 'atrasado'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {charge.computed_status}
                        </StatusPill>
                      </td>
                      <td className="py-3">{formatDateTime(charge.created_at)}</td>
                    </tr>
                  ))}

                  {data.charges.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-5 text-slate-500">
                        Nenhuma cobrança encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-[#070D2D]">
              Compras de créditos
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-3">Quantidade</th>
                    <th className="py-3">Restante</th>
                    <th className="py-3">Valor</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Criado em</th>
                  </tr>
                </thead>

                <tbody>
                  {data.credits.purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b last:border-0">
                      <td className="py-3">{purchase.quantity}</td>
                      <td className="py-3">{purchase.remaining}</td>
                      <td className="py-3">
                        {formatCurrency(purchase.amount || 0)}
                      </td>
                      <td className="py-3">{purchase.status}</td>
                      <td className="py-3">{formatDateTime(purchase.created_at)}</td>
                    </tr>
                  ))}

                  {data.credits.purchases.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-5 text-slate-500">
                        Nenhuma compra de crédito encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-[#070D2D]">
              Clientes cadastrados
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-3">Nome</th>
                    <th className="py-3">Telefone</th>
                    <th className="py-3">Criado em</th>
                  </tr>
                </thead>

                <tbody>
                  {data.clients.slice(0, 20).map((client) => (
                    <tr key={client.id} className="border-b last:border-0">
                      <td className="py-3">{client.name}</td>
                      <td className="py-3">{client.phone || '-'}</td>
                      <td className="py-3">{formatDateTime(client.created_at)}</td>
                    </tr>
                  ))}

                  {data.clients.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-5 text-slate-500">
                        Nenhum cliente cadastrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-[#070D2D]">
              Histórico admin
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-3">Data</th>
                    <th className="py-3">Ação</th>
                    <th className="py-3">Detalhes</th>
                  </tr>
                </thead>

                <tbody>
                  {data.admin_actions.map((action) => (
                    <tr key={action.id} className="border-b last:border-0">
                      <td className="py-3">{formatDateTime(action.created_at)}</td>
                      <td className="py-3">
                        <StatusPill tone="purple">
                          {getActionLabel(action.action)}
                        </StatusPill>
                      </td>
                      <td className="py-3">
                        <pre className="max-w-md whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                          {JSON.stringify(action.payload || {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}

                  {data.admin_actions.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-5 text-slate-500">
                        Nenhuma ação administrativa registrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-[#070D2D]">
            Últimas mensagens registradas
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-3">Origem</th>
                  <th className="py-3">ID origem</th>
                  <th className="py-3">Criado em</th>
                </tr>
              </thead>

              <tbody>
                {data.usage_events.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="py-3">{event.source_table}</td>
                    <td className="py-3">{event.source_id}</td>
                    <td className="py-3">{formatDateTime(event.created_at)}</td>
                  </tr>
                ))}

                {data.usage_events.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-5 text-slate-500">
                      Nenhum envio registrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AdminUserActionModal
        open={actionModalOpen}
        user={user}
        loading={actionLoading}
        onClose={() => {
          if (actionLoading) return
          setActionModalOpen(false)
        }}
        onSubmit={runUserAction}
      />
    </div>
  )
}