import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getScheduledMessages } from '../services/automationService'
import { formatCurrency, formatDate, formatPhone } from '../utils/format'

export default function Automations() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadItems() {
      try {
        if (!user?.id) return
        const data = await getScheduledMessages(user.id)
        setItems(data)
      } catch (err) {
        setError(err.message || 'Erro ao carregar automações')
      } finally {
        setLoading(false)
      }
    }

    loadItems()
  }, [user])

  function getStatusLabel(status) {
    if (status === 'sent') return 'Enviada'
    if (status === 'failed') return 'Falhou'
    if (status === 'cancelled') return 'Cancelada'
    return 'Pendente'
  }

  function getMessageLabel(type) {
    if (type === 'professional') return 'Profissional'
    if (type === 'urgent') return 'Urgente'
    return 'Amigável'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Automações</h1>
        <p className="mt-2 text-slate-500">
          Veja todas as mensagens programadas para envio.
        </p>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {loading ? (
          <p>Carregando automações...</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500">Nenhuma automação programada ainda.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{item.client?.name}</p>
                    <p className="text-sm text-slate-600">
                      {item.charge?.description}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatPhone(item.client?.phone || '')}
                    </p>
                  </div>

                  <div className="text-sm text-slate-500">
                    <p>
                      Agendado para:{' '}
                      {item.scheduled_for
                        ? formatDate(item.scheduled_for.slice(0, 10))
                        : '-'}
                    </p>
                    <p>Valor: {formatCurrency(item.charge?.amount || 0)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {getStatusLabel(item.status)}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    {getMessageLabel(item.message_type)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}