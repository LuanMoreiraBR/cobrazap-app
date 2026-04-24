import { useEffect, useMemo, useState } from 'react'
import { Pencil, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  createClient,
  deleteClient,
  getClients,
  updateClient,
} from '../services/clientsService'
import { formatPhone, onlyDigits } from '../utils/format'

const initialForm = {
  name: '',
  phone: '',
  notes: '',
}

export default function Clients() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    async function loadClients() {
      try {
        const data = await getClients(user.id)
        setClients(data)
      } catch (err) {
        setError(err.message || 'Erro ao carregar clientes')
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) loadClients()
  }, [user])

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()

    return clients.filter((client) => {
      if (!term) return true
      return (
        client.name?.toLowerCase().includes(term) ||
        client.phone?.includes(term) ||
        client.notes?.toLowerCase().includes(term)
      )
    })
  }, [clients, search])

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function validateForm() {
    if (!form.name.trim()) return 'Informe o nome do cliente.'
    if (!onlyDigits(form.phone).trim()) return 'Informe o telefone.'
    if (onlyDigits(form.phone).length < 10) return 'Telefone inválido.'
    return ''
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
        const updated = await updateClient({
          id: editingId,
          user_id: user.id,
          name: form.name.trim(),
          phone: onlyDigits(form.phone),
          notes: form.notes.trim(),
        })

        setClients((current) =>
          current.map((client) => (client.id === editingId ? updated : client)),
        )
        setSuccess('Cliente atualizado com sucesso.')
      } else {
        const newClient = await createClient({
          user_id: user.id,
          name: form.name.trim(),
          phone: onlyDigits(form.phone),
          notes: form.notes.trim(),
        })

        setClients((current) => [newClient, ...current])
        setSuccess('Cliente criado com sucesso.')
      }

      resetForm()
    } catch (err) {
      setError(err.message || 'Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(client) {
    resetMessages()
    setEditingId(client.id)
    setForm({
      name: client.name ?? '',
      phone: formatPhone(client.phone ?? ''),
      notes: client.notes ?? '',
    })
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Deseja realmente excluir este cliente?')
    if (!confirmed) return

    resetMessages()

    try {
      await deleteClient(id, user.id)
      setClients((current) => current.filter((client) => client.id !== id))
      if (editingId === id) resetForm()
      setSuccess('Cliente excluído com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao excluir cliente')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Clientes</h1>
        <p className="page-subtitle">
          Cadastre e acompanhe seus clientes em um só lugar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid gap-4 md:grid-cols-2">
        <input
          type="text"
          placeholder="Nome do cliente"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input"
        />

        <input
          type="text"
          placeholder="Telefone"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: formatPhone(e.target.value) })
          }
          className="input"
        />

        <textarea
          placeholder="Observações"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input md:col-span-2"
          rows={4}
        />

        {error ? (
          <p className="text-sm text-red-600 md:col-span-2">{error}</p>
        ) : null}

        {success ? (
          <p className="text-sm text-[#5B4BFF] md:col-span-2">{success}</p>
        ) : null}

        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? 'Salvando...'
              : editingId
              ? 'Atualizar cliente'
              : 'Salvar cliente'}
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou observação"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p>Carregando clientes...</p>
        ) : filteredClients.length === 0 ? (
          <div className="card">
            <p className="text-slate-500">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div key={client.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#070D2D]">
                    {client.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatPhone(client.phone)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(client)}
                    className="rounded-xl border border-slate-200 p-2 text-[#5B4BFF] hover:bg-[#5B4BFF]/10"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(client.id)}
                    className="rounded-xl border border-slate-200 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {client.notes || 'Sem observações.'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}