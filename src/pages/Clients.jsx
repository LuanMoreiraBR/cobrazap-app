import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList,
  Download,
  Pencil,
  Phone,
  Search,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  createClient,
  createClientsBatch,
  deleteClient,
  getClients,
  updateClient,
} from '../services/clientsService'
import { getUsageSummary } from '../services/usageService'
import { formatPhone, onlyDigits } from '../utils/format'

const initialForm = { name: '', phone: '', notes: '' }

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

function normalizePhone(raw) {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) d = d.slice(1)
  return d
}

function parseCSV(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim())
  if (lines.length < 2) return []

  return lines
    .slice(1)
    .map((line, i) => {
      const parts = []
      let cur = ''
      let inQ = false
      for (const ch of line) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) {
          parts.push(cur.trim())
          cur = ''
        } else {
          cur += ch
        }
      }
      parts.push(cur.trim())
      return {
        name: parts[0] || '',
        phone: normalizePhone(parts[1] || ''),
        notes: parts[2] || '',
        _key: i,
      }
    })
    .filter((c) => c.name && c.phone.length >= 10)
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
  const [usage, setUsage] = useState(null)

  // Import state
  const [importContacts, setImportContacts] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const csvInputRef = useRef(null)

  const hasContactPicker = typeof navigator !== 'undefined' && 'contacts' in navigator

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

    async function loadUsage() {
      try {
        const summary = await getUsageSummary(user.id)
        setUsage(summary)
      } catch {
        // non-critical
      }
    }

    if (user?.id) {
      loadClients()
      loadUsage()
    }
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

  const clientsWithNotes = useMemo(
    () => clients.filter((c) => c.notes?.trim()).length,
    [clients],
  )

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
    if (validationError) { setError(validationError); return }

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
        setClients((curr) => curr.map((c) => (c.id === editingId ? updated : c)))
        setSuccess('Cliente atualizado com sucesso.')
      } else {
        const newClient = await createClient({
          user_id: user.id,
          name: form.name.trim(),
          phone: onlyDigits(form.phone),
          notes: form.notes.trim(),
        })
        setClients((curr) => [newClient, ...curr])
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
    setForm({ name: client.name ?? '', phone: formatPhone(client.phone ?? ''), notes: client.notes ?? '' })
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Deseja realmente excluir este cliente?')
    if (!confirmed) return
    resetMessages()
    try {
      await deleteClient(id, user.id)
      setClients((curr) => curr.filter((c) => c.id !== id))
      if (editingId === id) resetForm()
      setSuccess('Cliente excluído com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao excluir cliente')
    }
  }

  // ── Import ──────────────────────────────────────────────

  function downloadTemplate() {
    const csv =
      'Nome,Telefone,Observações\nJoão Silva,11999990000,Cliente VIP\nMaria Santos,21988887777,'
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-clientes-lembrei.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleContactPicker() {
    try {
      const results = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      const parsed = results
        .flatMap((c, i) =>
          (c.tel || []).slice(0, 1).map((tel) => ({
            name: (c.name || [])[0] || '',
            phone: normalizePhone(tel),
            notes: '',
            _key: `cp-${i}`,
          })),
        )
        .filter((c) => c.name && c.phone.length >= 10)

      if (parsed.length) {
        setImportContacts(parsed)
        setImportError('')
      } else {
        setError('Nenhum contato com telefone válido selecionado.')
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError('Erro ao acessar contatos do dispositivo.')
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      if (parsed.length) {
        setImportContacts(parsed)
        setImportError('')
      } else {
        setError('Nenhum contato válido encontrado. Verifique o formato do arquivo.')
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  function removeImportContact(key) {
    setImportContacts((curr) => curr.filter((c) => c._key !== key))
  }

  async function handleImportConfirm() {
    if (!user?.id || !importContacts.length) return
    setImportLoading(true)
    setImportError('')
    try {
      const { data, imported, truncated } = await createClientsBatch(user.id, importContacts)
      setClients((curr) => [...data, ...curr])
      setImportContacts([])
      let msg = `${imported} cliente(s) importado(s) com sucesso!`
      if (truncated > 0) msg += ` (${truncated} ignorado(s) por limite do plano)`
      setSuccess(msg)
    } catch (err) {
      setImportError(err.message || 'Erro ao importar clientes.')
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
            Base de relacionamento
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#070D2D]">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie seus clientes e organize seus contatos.
          </p>
        </div>
        <div className="hidden rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF] md:block">
          <Users size={22} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatBox title="Total de clientes" value={clients.length} icon={Users} className="bg-[#5B4BFF]/10 text-[#5B4BFF]" />
        <StatBox title="Com telefone" value={clients.filter((c) => onlyDigits(c.phone).length >= 10).length} icon={Phone} className="bg-emerald-100 text-emerald-700" />
        <StatBox title="Com observações" value={clientsWithNotes} icon={ClipboardList} className="bg-blue-100 text-blue-700" />
      </div>

      {/* Importação em lote */}
      <div className="card">
        <div className="mb-4 flex items-center gap-4">
          <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
            <Upload size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">Importação em lote</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Importe vários clientes de uma vez via contatos do celular ou planilha.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {hasContactPicker && (
            <button
              type="button"
              onClick={handleContactPicker}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5B4BFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4A3BE8]"
            >
              <Smartphone size={16} />
              Importar contatos do celular
            </button>
          )}

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download size={16} />
            Baixar modelo CSV
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Upload size={16} />
            Importar planilha
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {!hasContactPicker && (
          <p className="mt-3 text-xs text-slate-400">
            Importação via contatos está disponível apenas no Android. Use o CSV para outros dispositivos.
          </p>
        )}
      </div>

      {/* Individual client form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              {editingId ? 'Editar cliente' : 'Novo cliente'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Preencha os dados básicos do cliente.</p>
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
            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
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

        {!editingId && usage && !usage.canCreateClient ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Limite de clientes atingido ({usage.clientsUsed}/{usage.clientLimit}).{' '}
            <a href="/planos" className="font-semibold underline hover:text-amber-900">
              Faça upgrade do plano
            </a>{' '}
            para cadastrar mais clientes.
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || (!editingId && usage !== null && !usage?.canCreateClient)}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando...' : editingId ? 'Atualizar cliente' : 'Salvar cliente'}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="btn-secondary inline-flex items-center gap-2">
              <X size={16} />
              Cancelar edição
            </button>
          ) : null}
        </div>
      </form>

      {/* Client list */}
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">Lista de clientes</h2>
            <p className="mt-1 text-sm text-slate-500">Busque, edite ou remova clientes cadastrados.</p>
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
              <p className="mt-3 font-semibold text-[#070D2D]">Nenhum cliente encontrado</p>
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
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5B4BFF]/10 font-bold text-[#5B4BFF]">
                        {client.name?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#070D2D]">{client.name}</h3>
                        <p className="text-sm text-slate-500">{formatPhone(client.phone)}</p>
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
                    <p className="mt-1 text-sm text-slate-600">{client.notes || 'Sem observações.'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import preview modal */}
      {importContacts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#070D2D]">Revisar importação</h3>
                <p className="text-sm text-slate-500">{importContacts.length} contato(s) encontrado(s)</p>
              </div>
              <button
                type="button"
                onClick={() => setImportContacts([])}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contact list */}
            <ul className="max-h-72 overflow-y-auto px-5 py-3 space-y-2">
              {importContacts.map((c) => (
                <li
                  key={c._key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF]/10 text-sm font-bold text-[#5B4BFF]">
                      {c.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#070D2D]">{c.name}</p>
                      <p className="text-xs text-slate-500">{formatPhone(c.phone)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImportContact(c._key)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>

            {/* Modal footer */}
            <div className="border-t border-slate-100 px-5 py-4">
              {importError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {importError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleImportConfirm}
                  disabled={importLoading || importContacts.length === 0}
                  className="flex-1 rounded-xl bg-[#5B4BFF] py-2.5 text-sm font-semibold text-white transition hover:bg-[#4A3BE8] disabled:opacity-60"
                >
                  {importLoading ? 'Importando...' : `Importar ${importContacts.length} cliente(s)`}
                </button>
                <button
                  type="button"
                  onClick={() => setImportContacts([])}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
