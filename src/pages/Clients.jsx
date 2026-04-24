import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Pencil,
  Phone,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
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

  const clientsWithNotes = useMemo(() => {
    return clients.filter((client) => client.notes?.trim()).length
  }, [clients])

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
      <div className="rounded-3xl bg-gradient-to-r from-[#070D2D] via-[#161B4D] to-[#5B4BFF] p-6 text-white shadow-sm">
        <p className="text-sm font-semibold text-[#AFA8FF]">
          Base de relacionamento
        </p>
        <h1 className="mt-2 text-3xl font-bold">Clientes</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Organize seus contatos, telefones e observações para enviar cobranças
          com mais controle e profissionalismo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatBox
          title="Total de clientes"
          value={clients.length}
          icon={Users}
          className="bg-[#5B4BFF]/10 text-[#5B4BFF]"
        />

        <StatBox
          title="Com telefone"
          value={clients.filter((client) => onlyDigits(client.phone).length >= 10).length}
          icon={Phone}
          className="bg-emerald-100 text-emerald-700"
        />

        <StatBox
          title="Com observações"
          value={clientsWithNotes}
          icon={ClipboardList}
          className="bg-blue-100 text-blue-700"
        />
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              {editingId ? 'Editar cliente' : 'Novo cliente'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Preencha os dados básicos do cliente.
            </p>
          </div>

          <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
            <UserPlus size={22} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              Lista de clientes
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Busque, edite ou remova clientes cadastrados.
            </p>
          </div>

          <div className="relative w-full lg:max-w-md">
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

        <div className="mt-6">
          {loading ? (
            <p>Carregando clientes...</p>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <Users className="mx-auto text-[#5B4BFF]" size={34} />
              <p className="mt-3 font-semibold text-[#070D2D]">
                Nenhum cliente encontrado
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre seu primeiro cliente para começar a criar cobranças.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-2xl border border-slate-200 p-4 transition hover:border-[#5B4BFF]/40 hover:bg-[#5B4BFF]/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5B4BFF]/10 font-bold text-[#5B4BFF]">
                          {client.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>

                        <div>
                          <h3 className="font-semibold text-[#070D2D]">
                            {client.name}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {formatPhone(client.phone)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(client)}
                        className="rounded-xl border border-slate-200 p-2 text-[#5B4BFF] transition hover:bg-[#5B4BFF]/10"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(client.id)}
                        className="rounded-xl border border-slate-200 p-2 text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Observações
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {client.notes || 'Sem observações.'}
                    </p>
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