import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Ban,
  CreditCard,
  FileText,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Settings2,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import AdminUserActionModal from '../components/AdminUserActionModal'
import {
  getAdminDashboard,
  getAdminEventLogs,
  getAdminHealth,
  getAdminPlans,
  runAdminScheduledMessageAction,
  runAdminUserAction,
  updateAdminPlan,
} from '../services/adminService'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/format'

const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'health', label: 'Saúde', icon: HeartPulse },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'operation', label: 'Operação', icon: Activity },
  { id: 'credits', label: 'Compras', icon: CreditCard },
  { id: 'pricing', label: 'Preços', icon: Tag },
  { id: 'history', label: 'Histórico admin', icon: History },
  { id: 'logs', label: 'Logs', icon: FileText },
]

function AdminCard({ title, value, subtitle, icon: Icon, tone = 'purple' }) {
  const tones = {
    purple: 'bg-[#5B4BFF]/10 text-[#5B4BFF] ring-[#5B4BFF]/20',
    green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-[#070D2D]">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>

        <div className={`rounded-2xl p-3 ring-1 ${tones[tone] || tones.purple}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function SimpleBars({ data }) {
  const safeData = data || []
  const max = Math.max(...safeData.map((item) => Number(item.value || 0)), 1)

  if (safeData.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados para exibir.</p>
  }

  return (
    <div className="space-y-2">
      {safeData.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>

          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-[#5B4BFF]"
              style={{
                width: `${Math.max((Number(item.value || 0) / max) * 100, 3)}%`,
              }}
            />
          </div>
        </div>
      ))}
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
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  )
}

function AdminSidebar({ activeSection, setActiveSection, onLogout }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
      <div className="flex items-center gap-3">
        <img
          src="/icon-lembrei.png"
          alt="Lembrei"
          className="h-11 w-11 rounded-2xl"
        />

        <div>
          <p className="text-lg font-black text-[#070D2D]">Lembrei</p>
          <p className="text-xs font-bold text-slate-400">Admin Master</p>
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                active
                  ? 'bg-[#5B4BFF] text-white shadow-lg shadow-[#5B4BFF]/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#070D2D]'
              }`}
            >
              <Icon size={18} />
              {section.label}
            </button>
          )
        })}
      </nav>

      <div className="absolute bottom-5 left-5 right-5">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-200"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}

function AdminMobileTabs({ activeSection, setActiveSection }) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200 lg:hidden">
      <div className="flex min-w-max gap-2">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
                active ? 'bg-[#5B4BFF] text-white' : 'bg-slate-50 text-slate-600'
              }`}
            >
              <Icon size={16} />
              {section.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getActionLabel(action) {
  const labels = {
    ADD_CREDITS: 'Adicionou créditos',
    CHANGE_PLAN: 'Alterou plano',
    SET_SUBSCRIPTION_STATUS: 'Alterou assinatura',
    BLOCK_USER: 'Bloqueou usuário',
    UNBLOCK_USER: 'Desbloqueou usuário',
    RESET_PROCESSING_TO_PENDING: 'Voltou mensagem para pending',
    REPROCESS_FAILED: 'Reprocessou mensagem failed',
    CANCEL_MESSAGE: 'Cancelou mensagem',
  }

  return labels[action] || action
}

function formatAdminDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR')
}

function getProviderLabel(provider) {
  if (provider === 'twilio') return 'Twilio'
  if (provider === 'mercado_pago') return 'Mercado Pago'
  if (provider === 'admin') return 'Admin'
  return provider || '-'
}

function getLogStatusTone(status) {
  if (status === 'success') return 'green'
  if (status === 'error') return 'red'
  if (status === 'ignored') return 'amber'
  if (status === 'info') return 'blue'
  return 'slate'
}

function getHealthSeverityTone(severity) {
  if (severity === 'ok') return 'green'
  if (severity === 'warning') return 'amber'
  if (severity === 'critical') return 'red'
  return 'slate'
}

function getHealthSeverityLabel(severity) {
  if (severity === 'ok') return 'Operação OK'
  if (severity === 'warning') return 'Atenção'
  if (severity === 'critical') return 'Crítico'
  return 'Indefinido'
}

function getRecommendationTone(severity) {
  if (severity === 'ok') return 'green'
  if (severity === 'info') return 'blue'
  if (severity === 'warning') return 'amber'
  if (severity === 'critical') return 'red'
  return 'slate'
}

function OverviewSection({ data, summary, funnel, twilioBalance }) {
  return (
    <>
      {(Number(summary.scheduled_failed || 0) > 0 ||
        Number(summary.users_at_limit || 0) > 0 ||
        data.twilio?.error) ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={20} />

            <div>
              <p className="font-black">Atenção operacional</p>

              <p className="mt-1">
                {Number(summary.scheduled_failed || 0) > 0
                  ? `${summary.scheduled_failed} mensagens agendadas falharam. `
                  : ''}
                {Number(summary.users_at_limit || 0) > 0
                  ? `${summary.users_at_limit} usuários atingiram o limite. `
                  : ''}
                {data.twilio?.error ? `Twilio: ${data.twilio.error}` : ''}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard
          title="MRR estimado"
          value={formatCurrency(summary.mrr_estimated || 0)}
          subtitle="Soma dos planos ativos"
          icon={TrendingUp}
          tone="green"
        />

        <AdminCard
          title="Receita mês"
          value={formatCurrency(summary.revenue_month_total || 0)}
          subtitle={`${formatCurrency(summary.plan_revenue_month || 0)} planos + ${formatCurrency(summary.credit_revenue_month || 0)} créditos`}
          icon={CreditCard}
          tone="purple"
        />

        <AdminCard
          title="Pagamentos pendentes"
          value={
            Number(summary.platform_payments_pending || 0) +
            Number(summary.credit_purchases_pending || 0)
          }
          subtitle="Planos e créditos aguardando pagamento"
          icon={Wallet}
          tone="amber"
        />

        <AdminCard
          title="Saldo Twilio"
          value={twilioBalance}
          subtitle={data.twilio?.error || 'Saldo da conta principal'}
          icon={Wallet}
          tone={data.twilio?.available ? 'blue' : 'red'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard
          title="Usuários totais"
          value={summary.total_users || 0}
          subtitle={`${summary.users_created_month || 0} criados este mês`}
          icon={Users}
        />

        <AdminCard
          title="Online agora"
          value={summary.online_users || 0}
          subtitle="Ativos nos últimos 5 minutos"
          icon={Activity}
          tone="green"
        />

        <AdminCard
          title="Assinaturas ativas"
          value={summary.active_subscriptions || 0}
          subtitle={`${summary.trial_users || 0} em teste grátis/inativos`}
          icon={UserCheck}
          tone="blue"
        />

        <AdminCard
          title="Usuários no limite"
          value={summary.users_at_limit || 0}
          subtitle={`${summary.users_near_limit || 0} próximos do limite`}
          icon={AlertTriangle}
          tone={Number(summary.users_at_limit || 0) > 0 ? 'red' : 'amber'}
        />
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-black text-[#070D2D]">Funil de ativação</h2>

        <p className="mt-1 text-sm text-slate-500">
          Mostra onde os usuários estão avançando ou travando.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Contas', funnel.accounts_created],
            ['Com clientes', funnel.users_with_clients],
            ['Com cobranças', funnel.users_with_charges],
            ['Enviaram mensagens', funnel.users_with_messages],
            ['Receberam pagamento', funnel.users_with_payments_received],
            ['Assinaram', funnel.active_subscriptions],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-[#070D2D]">{value || 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:col-span-2">
          <h2 className="text-xl font-black text-[#070D2D]">Mensagens por dia</h2>

          <p className="mt-1 text-sm text-slate-500">Últimos 30 dias.</p>

          <div className="mt-6">
            <SimpleBars data={data.charts?.messages_by_day || []} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-[#070D2D]">Planos ativos</h2>

          <p className="mt-1 text-sm text-slate-500">
            Distribuição atual por plano.
          </p>

          <div className="mt-6">
            <SimpleBars
              data={(data.charts?.plan_stats || []).map((item) => ({
                label: item.plan,
                value: item.total,
              }))}
            />
          </div>
        </div>
      </div>
    </>
  )
}


function HealthActionButton({ children, disabled, onClick, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    green: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    red: 'bg-red-100 text-red-700 hover:bg-red-200',
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-black disabled:opacity-60 ${
        tones[tone] || tones.blue
      }`}
    >
      {children}
    </button>
  )
}

function HealthSection({
  healthData,
  healthLoading,
  healthError,
  loadHealth,
  scheduledMessageActionLoadingId,
  handleScheduledMessageAction,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5B4BFF]">
              Saúde operacional
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#070D2D]">
              Monitoramento da plataforma
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Twilio, Mercado Pago, mensagens agendadas, pagamentos, assinaturas e limites.
            </p>
          </div>

          <button
            type="button"
            onClick={loadHealth}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-black text-white hover:bg-[#4A3BE8]"
          >
            <RefreshCw size={16} />
            Atualizar saúde
          </button>
        </div>

        {healthError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {healthError}
          </div>
        ) : null}

        {healthLoading && !healthData ? (
          <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
            Carregando saúde operacional...
          </div>
        ) : null}

        {healthData ? (
          <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">Status geral</p>

                <div className="mt-2 flex items-center gap-3">
                  <StatusPill tone={getHealthSeverityTone(healthData.severity)}>
                    {getHealthSeverityLabel(healthData.severity)}
                  </StatusPill>

                  <span className="text-xs text-slate-500">
                    Última verificação: {formatAdminDate(healthData.checked_at)}
                  </span>
                </div>
              </div>

              {healthLoading ? (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                  Atualizando...
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {healthData ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminCard
              title="Erros Twilio 24h"
              value={healthData.summary?.twilio_errors_24h || 0}
              subtitle="Falhas registradas em logs"
              icon={MessageCircle}
              tone={Number(healthData.summary?.twilio_errors_24h || 0) > 0 ? 'red' : 'green'}
            />

            <AdminCard
              title="Erros Mercado Pago 24h"
              value={healthData.summary?.mercado_pago_errors_24h || 0}
              subtitle="Falhas em webhooks/pagamentos"
              icon={CreditCard}
              tone={Number(healthData.summary?.mercado_pago_errors_24h || 0) > 0 ? 'red' : 'green'}
            />

            <AdminCard
              title="Mensagens failed"
              value={healthData.summary?.scheduled_failed || 0}
              subtitle="Agendamentos com falha"
              icon={AlertTriangle}
              tone={Number(healthData.summary?.scheduled_failed || 0) > 0 ? 'red' : 'green'}
            />

            <AdminCard
              title="Processing travado"
              value={healthData.summary?.scheduled_stuck || 0}
              subtitle="Há mais de 15 minutos"
              icon={Activity}
              tone={Number(healthData.summary?.scheduled_stuck || 0) > 0 ? 'red' : 'green'}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminCard
              title="Planos pendentes antigos"
              value={healthData.summary?.old_pending_payments || 0}
              subtitle="Pendentes há mais de 30 minutos"
              icon={Wallet}
              tone={Number(healthData.summary?.old_pending_payments || 0) > 0 ? 'amber' : 'green'}
            />

            <AdminCard
              title="Créditos pendentes antigos"
              value={healthData.summary?.old_pending_credit_purchases || 0}
              subtitle="Compras há mais de 30 minutos"
              icon={CreditCard}
              tone={Number(healthData.summary?.old_pending_credit_purchases || 0) > 0 ? 'amber' : 'green'}
            />

            <AdminCard
              title="Assinaturas vencidas"
              value={healthData.summary?.expired_subscriptions || 0}
              subtitle="Status active com período vencido"
              icon={UserCheck}
              tone={Number(healthData.summary?.expired_subscriptions || 0) > 0 ? 'amber' : 'green'}
            />

            <AdminCard
              title="Vencem em 3 dias"
              value={healthData.summary?.expiring_subscriptions_3d || 0}
              subtitle="Assinaturas próximas do fim"
              icon={UserCheck}
              tone="blue"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AdminCard
              title="Usuários no limite"
              value={healthData.summary?.users_at_limit || 0}
              subtitle="Mensagens usadas >= limite"
              icon={Users}
              tone={Number(healthData.summary?.users_at_limit || 0) > 0 ? 'amber' : 'green'}
            />

            <AdminCard
              title="Usuários bloqueados"
              value={healthData.summary?.blocked_users || 0}
              subtitle="Bloqueios manuais ativos"
              icon={Ban}
              tone={Number(healthData.summary?.blocked_users || 0) > 0 ? 'amber' : 'green'}
            />
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-black text-[#070D2D]">Ações recomendadas</h3>

            <p className="mt-1 text-sm text-slate-500">
              Próximas ações sugeridas com base nos alertas atuais.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(healthData.recommendations || []).map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <StatusPill tone={getRecommendationTone(item.severity)}>
                        {item.severity}
                      </StatusPill>

                      <h4 className="mt-3 font-black text-[#070D2D]">{item.title}</h4>

                      <p className="mt-1 text-sm text-slate-500">
                        {item.description}
                      </p>
                    </div>

                    <HeartPulse className="shrink-0 text-[#5B4BFF]" size={22} />
                  </div>

                  <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#5B4BFF]">
                    {item.action}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HealthTable
              title="Erros recentes"
              subtitle="Últimos erros registrados nas últimas 24h."
              empty="Nenhum erro recente."
              columns={['Data', 'Provider', 'Evento', 'Usuário', 'Erro']}
              rows={healthData.details?.recent_errors || []}
              renderRow={(item) => (
                <tr key={item.id} className="border-b align-top last:border-0">
                  <td className="py-3 text-xs text-slate-500">{formatAdminDate(item.created_at)}</td>
                  <td className="py-3"><StatusPill tone="purple">{getProviderLabel(item.provider)}</StatusPill></td>
                  <td className="py-3 font-bold text-[#070D2D]">{item.event_type}</td>
                  <td className="py-3">{item.user_name || item.user_email || item.user_id || '-'}</td>
                  <td className="py-3">
                    <p className="max-w-xs whitespace-pre-wrap rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                      {item.error_message || item.message || '-'}
                    </p>
                  </td>
                </tr>
              )}
            />

            <HealthTable
              title="Usuários no limite"
              subtitle="Usuários que chegaram ao limite mensal de mensagens."
              empty="Nenhum usuário no limite."
              columns={['Usuário', 'Plano', 'Uso']}
              rows={healthData.details?.users_at_limit || []}
              renderRow={(item) => (
                <tr key={item.user_id} className="border-b last:border-0">
                  <td className="py-3">{item.user_name || item.user_email || item.user_id}</td>
                  <td className="py-3">{item.plan_name || '-'}</td>
                  <td className="py-3">{item.messages_used}/{item.message_limit}</td>
                </tr>
              )}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HealthTable
              title="Mensagens failed"
              subtitle="Mensagens agendadas com erro."
              empty="Nenhuma mensagem failed."
              columns={['Usuário', 'Tentativas', 'Erro', 'Ações']}
              rows={healthData.details?.failed_messages || []}
              renderRow={(item) => (
                <tr key={item.id} className="border-b align-top last:border-0">
                  <td className="py-3">{item.user_name || item.user_email || item.user_id}</td>
                  <td className="py-3">{item.attempts || 0}</td>
                  <td className="py-3">
                    <p className="max-w-xs whitespace-pre-wrap rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                      {item.error_message || '-'}
                    </p>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <HealthActionButton
                        tone="green"
                        disabled={scheduledMessageActionLoadingId === item.id}
                        onClick={() =>
                          handleScheduledMessageAction({
                            messageId: item.id,
                            action: 'REPROCESS_FAILED',
                          })
                        }
                      >
                        Reprocessar
                      </HealthActionButton>

                      <HealthActionButton
                        tone="red"
                        disabled={scheduledMessageActionLoadingId === item.id}
                        onClick={() =>
                          handleScheduledMessageAction({
                            messageId: item.id,
                            action: 'CANCEL_MESSAGE',
                          })
                        }
                      >
                        Cancelar
                      </HealthActionButton>
                    </div>
                  </td>
                </tr>
              )}
            />

            <HealthTable
              title="Mensagens presas"
              subtitle="Processing travado há mais de 15 minutos."
              empty="Nenhuma mensagem presa."
              columns={['Usuário', 'Tentativas', 'Desde', 'Ações']}
              rows={healthData.details?.stuck_messages || []}
              renderRow={(item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">{item.user_name || item.user_email || item.user_id}</td>
                  <td className="py-3">{item.attempts || 0}</td>
                  <td className="py-3">{formatAdminDate(item.processing_started_at)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <HealthActionButton
                        tone="blue"
                        disabled={scheduledMessageActionLoadingId === item.id}
                        onClick={() =>
                          handleScheduledMessageAction({
                            messageId: item.id,
                            action: 'RESET_PROCESSING_TO_PENDING',
                          })
                        }
                      >
                        Voltar pending
                      </HealthActionButton>

                      <HealthActionButton
                        tone="red"
                        disabled={scheduledMessageActionLoadingId === item.id}
                        onClick={() =>
                          handleScheduledMessageAction({
                            messageId: item.id,
                            action: 'CANCEL_MESSAGE',
                          })
                        }
                      >
                        Cancelar
                      </HealthActionButton>
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <HealthTable
              title="Planos pendentes antigos"
              subtitle="Planos pendentes há mais de 30 minutos."
              empty="Nenhum plano pendente antigo."
              columns={['Usuário', 'Plano', 'Valor', 'Criado em']}
              rows={healthData.details?.old_pending_payments || []}
              renderRow={(item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">{item.user_name || item.user_email || item.user_id}</td>
                  <td className="py-3">{item.plan_id}</td>
                  <td className="py-3">{formatCurrency(item.amount || 0)}</td>
                  <td className="py-3">{formatAdminDate(item.created_at)}</td>
                </tr>
              )}
            />

            <HealthTable
              title="Créditos pendentes antigos"
              subtitle="Compras de créditos pendentes há mais de 30 minutos."
              empty="Nenhuma compra de créditos pendente antiga."
              columns={['Usuário', 'Qtd', 'Valor', 'Criado em']}
              rows={healthData.details?.old_pending_credit_purchases || []}
              renderRow={(item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">{item.user_name || item.user_email || item.user_id}</td>
                  <td className="py-3">{item.quantity}</td>
                  <td className="py-3">{formatCurrency(item.amount || 0)}</td>
                  <td className="py-3">{formatAdminDate(item.created_at)}</td>
                </tr>
              )}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

function HealthTable({ title, subtitle, empty, columns, rows, renderRow }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-xl font-black text-[#070D2D]">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
              {columns.map((column) => (
                <th key={column} className="py-3">{column}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(rows || []).length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-5 text-slate-500">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UsersSection({
  data,
  filteredUsers,
  planOptions,
  searchTerm,
  setSearchTerm,
  planFilter,
  setPlanFilter,
  statusFilter,
  setStatusFilter,
  specialFilter,
  setSpecialFilter,
  actionLoadingUserId,
  openActionModal,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#070D2D]">Usuários da plataforma</h2>

            <p className="mt-1 text-sm text-slate-500">
              Filtros por nome, e-mail, plano, status, limite e créditos.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar usuário"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
              />
            </label>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
            >
              <option value="all">Todos os planos</option>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="trial">Teste grátis</option>
              <option value="inactive">Inativo</option>
              <option value="pending">Pendente</option>
              <option value="blocked">Bloqueado</option>
            </select>

            <select
              value={specialFilter}
              onChange={(e) => setSpecialFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
            >
              <option value="all">Todos</option>
              <option value="blocked">Bloqueados</option>
              <option value="near_limit">Perto do limite</option>
              <option value="at_limit">No limite</option>
              <option value="with_credits">Com créditos extras</option>
              <option value="without_messages">Sem mensagens</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setPlanFilter('all')
                setStatusFilter('all')
                setSpecialFilter('all')
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-200"
            >
              <Settings2 size={16} />
              Limpar
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm font-bold text-slate-500">
          Exibindo {filteredUsers.length} de {(data.users_detailed || []).length} usuários.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1350px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3">Usuário</th>
                <th className="py-3">Plano</th>
                <th className="py-3">Clientes</th>
                <th className="py-3">Mensagens</th>
                <th className="py-3">Créditos</th>
                <th className="py-3">Cobranças</th>
                <th className="py-3">Recebido</th>
                <th className="py-3">Em aberto</th>
                <th className="py-3">Última atividade</th>
                <th className="py-3">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-5 text-slate-500">
                    Nenhum usuário encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => (
                  <tr key={item.user_id} className="border-b last:border-0">
                    <td className="py-3">
                      <p className="font-bold text-[#070D2D]">{item.name || 'Sem nome'}</p>
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </td>

                    <td className="py-3">
                      <div className="space-y-1">
                        <StatusPill
                          tone={
                            item.is_blocked
                              ? 'red'
                              : item.subscription_status === 'active'
                                ? 'green'
                                : 'slate'
                          }
                        >
                          {item.is_blocked ? 'Bloqueado' : item.plan}
                        </StatusPill>

                        <p className="text-xs text-slate-400">
                          {item.is_blocked
                            ? item.blocked_reason || 'Usuário bloqueado'
                            : item.subscription_status}
                        </p>
                      </div>
                    </td>

                    <td className="py-3">{item.clients_count}/{item.client_limit || '∞'}</td>

                    <td className="py-3">
                      <div className="space-y-1">
                        <p>{item.messages_used}/{item.message_limit || '∞'}</p>

                        {item.at_limit ? (
                          <StatusPill tone="red">limite atingido</StatusPill>
                        ) : item.near_limit ? (
                          <StatusPill tone="amber">perto do limite</StatusPill>
                        ) : null}
                      </div>
                    </td>

                    <td className="py-3">{item.extra_credits}</td>
                    <td className="py-3">{item.charges_count}</td>
                    <td className="py-3">{formatCurrency(item.received_amount || 0)}</td>
                    <td className="py-3">{formatCurrency(item.open_amount || 0)}</td>

                    <td className="py-3">
                      {item.last_seen_at
                        ? new Date(item.last_seen_at).toLocaleString('pt-BR')
                        : '-'}
                    </td>

                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/admin/users/${item.user_id}`}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-[#070D2D] hover:bg-slate-200"
                        >
                          Ver detalhes
                        </Link>

                        <button
                          type="button"
                          disabled={actionLoadingUserId === item.user_id}
                          onClick={() => openActionModal(item)}
                          className="rounded-xl bg-[#5B4BFF]/10 px-3 py-2 text-xs font-black text-[#5B4BFF] hover:bg-[#5B4BFF]/20 disabled:opacity-60"
                        >
                          Gerenciar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OperationSection({ summary, data }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard title="Mensagens hoje" value={summary.messages_today || 0} subtitle="Envios registrados hoje" icon={MessageCircle} />
        <AdminCard title="Mensagens no mês" value={summary.messages_month || 0} subtitle="Envios registrados no mês" icon={MessageCircle} />
        <AdminCard title="Mensagens no ano" value={summary.messages_year || 0} subtitle="Envios registrados no ano" icon={MessageCircle} />
        <AdminCard
          title="Falhas agendadas"
          value={summary.scheduled_failed || 0}
          subtitle={`${summary.scheduled_pending || 0} pendentes, ${summary.scheduled_processing || 0} processando`}
          icon={AlertTriangle}
          tone={Number(summary.scheduled_failed || 0) > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard title="Clientes totais" value={summary.total_clients || 0} subtitle="Clientes cadastrados na plataforma" icon={Users} />
        <AdminCard title="Cobranças totais" value={summary.total_charges || 0} subtitle="Cobranças criadas" icon={CreditCard} />
        <AdminCard title="Recebido pelos usuários" value={formatCurrency(summary.total_received || 0)} subtitle="Soma das cobranças pagas" icon={Wallet} tone="green" />
        <AdminCard title="Em aberto" value={formatCurrency(summary.total_open || 0)} subtitle="Soma das cobranças pendentes/atrasadas" icon={Wallet} tone="amber" />
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-black text-[#070D2D]">Mensagens por dia</h2>
        <p className="mt-1 text-sm text-slate-500">Últimos 30 dias.</p>
        <div className="mt-6">
          <SimpleBars data={data.charts?.messages_by_day || []} />
        </div>
      </div>
    </div>
  )
}

function CreditsSection({ data }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-black text-[#070D2D]">Últimas compras de mensagens</h2>

      <p className="mt-1 text-sm text-slate-500">
        Pacotes comprados e créditos manuais adicionados.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
              <th className="py-3">Usuário</th>
              <th className="py-3">Quantidade</th>
              <th className="py-3">Restante</th>
              <th className="py-3">Valor</th>
              <th className="py-3">Status</th>
              <th className="py-3">Criado em</th>
            </tr>
          </thead>

          <tbody>
            {(data.credit_purchases || []).length === 0 ? (
              <tr>
                <td colSpan="6" className="py-5 text-slate-500">
                  Nenhuma compra de mensagens encontrada.
                </td>
              </tr>
            ) : (
              (data.credit_purchases || []).map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">
                    <p className="font-bold text-[#070D2D]">{item.user_name || 'Sem nome'}</p>
                    <p className="text-xs text-slate-500">{item.user_email || item.user_id}</p>
                  </td>
                  <td className="py-3">{item.quantity}</td>
                  <td className="py-3">{item.remaining}</td>
                  <td className="py-3">{formatCurrency(item.amount || 0)}</td>
                  <td className="py-3">{item.status}</td>
                  <td className="py-3">{formatAdminDate(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HistorySection({ data }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-black text-[#070D2D]">
        Histórico de ações administrativas
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Auditoria das alterações manuais feitas por administradores.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
              <th className="py-3">Data</th>
              <th className="py-3">Admin</th>
              <th className="py-3">Usuário afetado</th>
              <th className="py-3">Ação</th>
              <th className="py-3">Detalhes</th>
            </tr>
          </thead>

          <tbody>
            {(data.admin_actions || []).length === 0 ? (
              <tr>
                <td colSpan="5" className="py-5 text-slate-500">
                  Nenhuma ação administrativa registrada ainda.
                </td>
              </tr>
            ) : (
              (data.admin_actions || []).map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">{formatAdminDate(item.created_at)}</td>

                  <td className="py-3">
                    <p className="font-bold text-[#070D2D]">{item.admin_name || 'Admin'}</p>
                    <p className="text-xs text-slate-500">{item.admin_email || item.admin_user_id}</p>
                  </td>

                  <td className="py-3">
                    <p className="font-bold text-[#070D2D]">{item.target_name || 'Sem usuário'}</p>
                    <p className="text-xs text-slate-500">{item.target_email || item.target_user_id || '-'}</p>
                  </td>

                  <td className="py-3">
                    <StatusPill tone="purple">{getActionLabel(item.action)}</StatusPill>
                  </td>

                  <td className="py-3">
                    <pre className="max-w-md whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                      {JSON.stringify(item.payload || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LogsSection({
  logsData,
  logsLoading,
  logsError,
  logProviderFilter,
  setLogProviderFilter,
  logStatusFilter,
  setLogStatusFilter,
  logRangeFilter,
  setLogRangeFilter,
  logSearchTerm,
  setLogSearchTerm,
  loadLogs,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#070D2D]">Logs da plataforma</h2>

            <p className="mt-1 text-sm text-slate-500">
              Eventos de Twilio, Mercado Pago, erros, ignorados e sucessos.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={logProviderFilter}
              onChange={(e) => {
                setLogProviderFilter(e.target.value)
                loadLogs({ provider: e.target.value })
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
            >
              <option value="all">Todos provedores</option>
              <option value="twilio">Twilio</option>
              <option value="mercado_pago">Mercado Pago</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={logStatusFilter}
              onChange={(e) => {
                setLogStatusFilter(e.target.value)
                loadLogs({ status: e.target.value })
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
            >
              <option value="all">Todos status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="ignored">Ignored</option>
              <option value="info">Info</option>
            </select>

            <select
              value={logRangeFilter}
              onChange={(e) => {
                setLogRangeFilter(e.target.value)
                loadLogs({ range: e.target.value })
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
            >
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>

            <label className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={logSearchTerm}
                onChange={(e) => setLogSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadLogs({ search: logSearchTerm })
                  }
                }}
                placeholder="Buscar erro/mensagem"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
              />
            </label>

            <button
              type="button"
              onClick={() => loadLogs({ search: logSearchTerm })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5B4BFF] px-4 py-3 text-sm font-black text-white hover:bg-[#4A3BE8]"
            >
              <RefreshCw size={16} />
              Buscar
            </button>
          </div>
        </div>

        {logsError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {logsError}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <AdminCard title="Total" value={logsData?.summary?.total || 0} subtitle="Eventos filtrados" icon={FileText} />
          <AdminCard title="Success" value={logsData?.summary?.success || 0} subtitle="Eventos concluídos" icon={FileText} tone="green" />
          <AdminCard title="Error" value={logsData?.summary?.error || 0} subtitle="Eventos com falha" icon={AlertTriangle} tone="red" />
          <AdminCard title="Ignored" value={logsData?.summary?.ignored || 0} subtitle="Eventos ignorados" icon={AlertTriangle} tone="amber" />
          <AdminCard title="Twilio" value={logsData?.summary?.twilio || 0} subtitle="Eventos WhatsApp" icon={MessageCircle} tone="blue" />
          <AdminCard title="Mercado Pago" value={logsData?.summary?.mercado_pago || 0} subtitle="Eventos pagamento" icon={CreditCard} tone="purple" />
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#070D2D]">Eventos recentes</h3>
            <p className="mt-1 text-sm text-slate-500">Resultado dos filtros selecionados.</p>
          </div>

          {logsLoading ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
              Carregando...
            </span>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3">Data</th>
                <th className="py-3">Provider</th>
                <th className="py-3">Status</th>
                <th className="py-3">Evento</th>
                <th className="py-3">Usuário</th>
                <th className="py-3">Mensagem</th>
                <th className="py-3">Erro</th>
                <th className="py-3">Relacionado</th>
              </tr>
            </thead>

            <tbody>
              {logsLoading && !logsData ? (
                <tr>
                  <td colSpan="8" className="py-5 text-slate-500">Carregando logs...</td>
                </tr>
              ) : null}

              {!logsLoading && (logsData?.logs || []).length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-5 text-slate-500">
                    Nenhum log encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : null}

              {(logsData?.logs || []).map((log) => (
                <tr key={log.id} className="border-b align-top last:border-0">
                  <td className="py-3 text-xs text-slate-500">{formatAdminDate(log.created_at)}</td>
                  <td className="py-3"><StatusPill tone="purple">{getProviderLabel(log.provider)}</StatusPill></td>
                  <td className="py-3"><StatusPill tone={getLogStatusTone(log.status)}>{log.status}</StatusPill></td>
                  <td className="py-3"><p className="font-bold text-[#070D2D]">{log.event_type}</p></td>
                  <td className="py-3">
                    {log.user_id ? (
                      <div>
                        <p className="font-bold text-[#070D2D]">{log.user_name || 'Sem nome'}</p>
                        <p className="text-xs text-slate-500">{log.user_email || log.user_id}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3">
                    <p className="max-w-xs whitespace-pre-wrap text-slate-600">{log.message || '-'}</p>
                  </td>
                  <td className="py-3">
                    {log.error_message ? (
                      <p className="max-w-xs whitespace-pre-wrap rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                        {log.error_message}
                      </p>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3">
                    {log.related_table || log.related_id ? (
                      <div>
                        <p className="font-bold text-[#070D2D]">{log.related_table || '-'}</p>
                        <p className="max-w-[180px] truncate text-xs text-slate-500">{log.related_id || '-'}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PricingField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
    </div>
  )
}

function PricingSection() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [local, setLocal] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await getAdminPlans()
        setPlans(data)
        const initial = {}
        data.forEach((plan) => {
          initial[plan.id] = {
            name: plan.name ?? '',
            price: plan.price ?? '',
            max_clients: plan.max_clients ?? '',
            max_messages_per_month: plan.max_messages_per_month ?? '',
            extra_message_price: plan.extra_message_price ?? '',
            description: plan.description ?? '',
            is_active: plan.is_active ?? true,
          }
        })
        setLocal(initial)
      } catch (err) {
        setLoadError(err.message || 'Erro ao carregar planos.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleChange(planId, field, value) {
    setLocal((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }))
  }

  async function handleSave(planId) {
    setSavingId(planId)
    setSaveError('')
    try {
      const f = local[planId]
      await updateAdminPlan(planId, {
        name: f.name,
        price: Number(f.price),
        max_clients: f.max_clients === '' ? null : Number(f.max_clients),
        max_messages_per_month:
          f.max_messages_per_month === '' ? null : Number(f.max_messages_per_month),
        extra_message_price: Number(f.extra_message_price),
        description: f.description || null,
        is_active: f.is_active,
      })
      setSavedId(planId)
      setTimeout(() => setSavedId(null), 3000)
    } catch (err) {
      setSaveError(err.message || 'Erro ao salvar plano.')
    } finally {
      setSavingId(null)
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#070D2D] outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10'

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#5B4BFF]/20 border-t-[#5B4BFF]" />
        <p className="text-sm font-bold text-slate-500">Carregando planos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5B4BFF]">
          Configuração de preços
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#070D2D]">
          Planos e valores
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Altere nome, preço, limites e preço por mensagem extra de cada plano.
          Os valores são refletidos imediatamente na página pública de planos.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {loadError}
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {saveError}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const fields = local[plan.id] || {}
          const isSaving = savingId === plan.id
          const isSaved = savedId === plan.id

          return (
            <div
              key={plan.id}
              className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    ID: {plan.id}
                  </p>
                  <h3 className="mt-1 text-xl font-black text-[#070D2D]">
                    {plan.name}
                  </h3>
                </div>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fields.is_active ?? true}
                    onChange={(e) =>
                      handleChange(plan.id, 'is_active', e.target.checked)
                    }
                    className="h-4 w-4 accent-[#5B4BFF]"
                  />
                  <span className="text-xs font-bold text-slate-500">Ativo</span>
                </label>
              </div>

              <div className="space-y-4">
                <PricingField label="Nome do plano">
                  <input
                    type="text"
                    value={fields.name ?? ''}
                    onChange={(e) =>
                      handleChange(plan.id, 'name', e.target.value)
                    }
                    className={inputClass}
                  />
                </PricingField>

                <PricingField label="Preço mensal (R$)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fields.price ?? ''}
                    onChange={(e) =>
                      handleChange(plan.id, 'price', e.target.value)
                    }
                    className={inputClass}
                  />
                </PricingField>

                <PricingField label="Limite de clientes (vazio = ilimitado)">
                  <input
                    type="number"
                    min="0"
                    value={fields.max_clients ?? ''}
                    onChange={(e) =>
                      handleChange(plan.id, 'max_clients', e.target.value)
                    }
                    placeholder="Ilimitado"
                    className={inputClass}
                  />
                </PricingField>

                <PricingField label="Mensagens/mês (vazio = ilimitado)">
                  <input
                    type="number"
                    min="0"
                    value={fields.max_messages_per_month ?? ''}
                    onChange={(e) =>
                      handleChange(
                        plan.id,
                        'max_messages_per_month',
                        e.target.value,
                      )
                    }
                    placeholder="Ilimitado"
                    className={inputClass}
                  />
                </PricingField>

                <PricingField label="Preço por mensagem extra (R$)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fields.extra_message_price ?? ''}
                    onChange={(e) =>
                      handleChange(
                        plan.id,
                        'extra_message_price',
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </PricingField>

                <PricingField label="Descrição (opcional)">
                  <input
                    type="text"
                    value={fields.description ?? ''}
                    onChange={(e) =>
                      handleChange(plan.id, 'description', e.target.value)
                    }
                    placeholder="Ex.: Ideal para pequenos negócios"
                    className={inputClass}
                  />
                </PricingField>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(plan.id)}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSaved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#5B4BFF] text-white hover:bg-[#4A3BE8]'
                }`}
              >
                {isSaving ? 'Salvando...' : isSaved ? 'Salvo!' : 'Salvar alterações'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-black text-amber-800">Sobre os pacotes de créditos</p>
        <p className="mt-1 text-sm text-amber-700">
          Os pacotes de créditos (50, 100 e 250 mensagens) têm preço calculado automaticamente:
          quantidade × preço por mensagem extra do plano ativo do usuário.
          Para alterar o valor dos pacotes, ajuste o campo{' '}
          <strong>Preço por mensagem extra</strong> do plano correspondente.
        </p>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const [activeSection, setActiveSection] = useState('overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoadingUserId, setActionLoadingUserId] = useState(null)
  const [selectedActionUser, setSelectedActionUser] = useState(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [specialFilter, setSpecialFilter] = useState('all')

  const [logsData, setLogsData] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [logProviderFilter, setLogProviderFilter] = useState('all')
  const [logStatusFilter, setLogStatusFilter] = useState('all')
  const [logRangeFilter, setLogRangeFilter] = useState('7d')
  const [logSearchTerm, setLogSearchTerm] = useState('')

  const [healthData, setHealthData] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')
  const [scheduledMessageActionLoadingId, setScheduledMessageActionLoadingId] =
    useState(null)

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function load() {
    setError('')
    setLoading(true)

    try {
      const result = await getAdminDashboard()
      setData(result)
    } catch (err) {
      setError(err.message || 'Erro ao carregar painel admin.')
    } finally {
      setLoading(false)
    }
  }

  async function loadHealth() {
    setHealthError('')
    setHealthLoading(true)

    try {
      const result = await getAdminHealth()
      setHealthData(result)
    } catch (err) {
      setHealthError(err.message || 'Erro ao carregar saúde operacional.')
    } finally {
      setHealthLoading(false)
    }
  }

  async function handleScheduledMessageAction({ messageId, action }) {
    const messages = {
      RESET_PROCESSING_TO_PENDING:
        'Voltar esta mensagem presa em processing para pending?',
      REPROCESS_FAILED:
        'Reprocessar esta mensagem failed? Ela voltará para pending.',
      CANCEL_MESSAGE:
        'Cancelar esta mensagem? Ela não será mais enviada.',
    }

    if (!window.confirm(messages[action] || 'Executar ação nesta mensagem?')) {
      return
    }

    setScheduledMessageActionLoadingId(messageId)
    setHealthError('')

    try {
      await runAdminScheduledMessageAction({
        messageId,
        action,
      })

      await loadHealth()
    } catch (err) {
      setHealthError(err.message || 'Erro ao executar ação na mensagem.')
    } finally {
      setScheduledMessageActionLoadingId(null)
    }
  }

  async function loadLogs(overrides = {}) {
    setLogsError('')
    setLogsLoading(true)

    const filters = {
      provider: logProviderFilter,
      status: logStatusFilter,
      range: logRangeFilter,
      search: logSearchTerm,
      limit: 100,
      ...overrides,
    }

    try {
      const result = await getAdminEventLogs(filters)
      setLogsData(result)
    } catch (err) {
      setLogsError(err.message || 'Erro ao carregar logs.')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (activeSection === 'logs') {
      loadLogs()
    }

    if (activeSection === 'health') {
      loadHealth()
    }
  }, [activeSection])

  function openActionModal(user) {
    setSelectedActionUser(user)
    setActionModalOpen(true)
  }

  async function runUserAction(payload) {
    setActionLoadingUserId(payload.target_user_id)
    setError('')

    try {
      await runAdminUserAction(payload)
      setActionModalOpen(false)
      setSelectedActionUser(null)
      await load()

      if (activeSection === 'health') await loadHealth()
      if (activeSection === 'logs') await loadLogs()
    } catch (err) {
      setError(err.message || 'Erro ao executar ação.')
    } finally {
      setActionLoadingUserId(null)
    }
  }

  const twilioBalance = useMemo(() => {
    if (!data?.twilio?.available) return 'Indisponível'
    return `${data.twilio.currency || ''} ${data.twilio.balance}`
  }, [data])

  const planOptions = useMemo(() => {
    const users = data?.users_detailed || []
    const plans = new Set(users.map((item) => item.plan).filter(Boolean))
    return Array.from(plans)
  }, [data])

  const filteredUsers = useMemo(() => {
    const users = data?.users_detailed || []
    const search = searchTerm.trim().toLowerCase()

    return users.filter((item) => {
      const matchesSearch =
        !search ||
        item.name?.toLowerCase().includes(search) ||
        item.email?.toLowerCase().includes(search)

      const matchesPlan = planFilter === 'all' || item.plan === planFilter

      const matchesStatus =
        statusFilter === 'all' ||
        item.subscription_status === statusFilter ||
        (statusFilter === 'blocked' && item.is_blocked)

      const matchesSpecial =
        specialFilter === 'all' ||
        (specialFilter === 'blocked' && item.is_blocked) ||
        (specialFilter === 'near_limit' && item.near_limit) ||
        (specialFilter === 'at_limit' && item.at_limit) ||
        (specialFilter === 'with_credits' && Number(item.extra_credits || 0) > 0) ||
        (specialFilter === 'without_messages' && Number(item.messages_used || 0) === 0)

      return matchesSearch && matchesPlan && matchesStatus && matchesSpecial
    })
  }, [data, searchTerm, planFilter, statusFilter, specialFilter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-[#5B4BFF]/20 border-t-[#5B4BFF]" />
          <p className="text-sm font-bold text-[#070D2D]">
            Carregando painel administrativo...
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
      </div>
    )
  }

  const summary = data?.summary || {}
  const funnel = data?.funnel || {}

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 rounded-3xl bg-[#070D2D] p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                Lembrei Admin
              </p>

              <h1 className="mt-2 text-3xl font-black">Painel administrativo</h1>

              <p className="mt-1 text-sm text-slate-300">
                Usuários, receita, mensagens, créditos, Twilio e saúde operacional.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  load()
                  if (activeSection === 'health') loadHealth()
                  if (activeSection === 'logs') loadLogs()
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-100"
              >
                <RefreshCw size={16} />
                Atualizar
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15 lg:hidden"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>

          <AdminMobileTabs
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          />

          {error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          {activeSection === 'overview' ? (
            <OverviewSection
              data={data}
              summary={summary}
              funnel={funnel}
              twilioBalance={twilioBalance}
            />
          ) : null}

          {activeSection === 'health' ? (
            <HealthSection
              healthData={healthData}
              healthLoading={healthLoading}
              healthError={healthError}
              loadHealth={loadHealth}
              scheduledMessageActionLoadingId={scheduledMessageActionLoadingId}
              handleScheduledMessageAction={handleScheduledMessageAction}
            />
          ) : null}

          {activeSection === 'users' ? (
            <UsersSection
              data={data}
              filteredUsers={filteredUsers}
              planOptions={planOptions}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              planFilter={planFilter}
              setPlanFilter={setPlanFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              specialFilter={specialFilter}
              setSpecialFilter={setSpecialFilter}
              actionLoadingUserId={actionLoadingUserId}
              openActionModal={openActionModal}
            />
          ) : null}

          {activeSection === 'operation' ? (
            <OperationSection summary={summary} data={data} />
          ) : null}

          {activeSection === 'credits' ? (
            <CreditsSection data={data} />
          ) : null}

          {activeSection === 'pricing' ? (
            <PricingSection />
          ) : null}

          {activeSection === 'history' ? (
            <HistorySection data={data} />
          ) : null}

          {activeSection === 'logs' ? (
            <LogsSection
              logsData={logsData}
              logsLoading={logsLoading}
              logsError={logsError}
              logProviderFilter={logProviderFilter}
              setLogProviderFilter={setLogProviderFilter}
              logStatusFilter={logStatusFilter}
              setLogStatusFilter={setLogStatusFilter}
              logRangeFilter={logRangeFilter}
              setLogRangeFilter={setLogRangeFilter}
              logSearchTerm={logSearchTerm}
              setLogSearchTerm={setLogSearchTerm}
              loadLogs={loadLogs}
            />
          ) : null}
        </div>

        <AdminUserActionModal
          open={actionModalOpen}
          user={selectedActionUser}
          loading={
            selectedActionUser
              ? actionLoadingUserId === selectedActionUser.user_id
              : false
          }
          onClose={() => {
            if (actionLoadingUserId) return
            setActionModalOpen(false)
            setSelectedActionUser(null)
          }}
          onSubmit={runUserAction}
        />
      </main>
    </div>
  )
}
