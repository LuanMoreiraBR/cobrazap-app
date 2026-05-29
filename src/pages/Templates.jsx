import { useEffect, useState } from 'react'
import { FileText, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
} from '../services/templatesService'

const initialForm = { name: '', content: '' }

export default function Templates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    async function load() {
      try {
        const data = await getTemplates(user.id)
        setTemplates(data)
      } catch (err) {
        setError(err.message || 'Erro ao carregar templates')
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) load()
  }, [user])

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    resetMessages()

    if (!form.name.trim()) { setError('Informe o nome do template.'); return }
    if (!form.content.trim()) { setError('Informe o texto do template.'); return }

    setSaving(true)
    try {
      if (editingId) {
        const updated = await updateTemplate({
          id: editingId,
          user_id: user.id,
          name: form.name.trim(),
          content: form.content.trim(),
        })
        setTemplates((curr) => curr.map((t) => (t.id === editingId ? updated : t)))
        setSuccess('Template atualizado.')
      } else {
        const created = await createTemplate({
          user_id: user.id,
          name: form.name.trim(),
          content: form.content.trim(),
        })
        setTemplates((curr) => [...curr, created].sort((a, b) => a.name.localeCompare(b.name)))
        setSuccess('Template criado.')
      }
      resetForm()
    } catch (err) {
      setError(err.message || 'Erro ao salvar template')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(template) {
    resetMessages()
    setEditingId(template.id)
    setForm({ name: template.name, content: template.content })
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Deseja excluir este template?')
    if (!confirmed) return
    resetMessages()
    try {
      await deleteTemplate(id, user.id)
      setTemplates((curr) => curr.filter((t) => t.id !== id))
      if (editingId === id) resetForm()
      setSuccess('Template excluído.')
    } catch (err) {
      setError(err.message || 'Erro ao excluir template')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
            Textos rápidos
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#070D2D]">Templates de descrição</h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie textos prontos para usar na descrição das cobranças sem digitar toda vez.
          </p>
        </div>
        <div className="hidden rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF] md:block">
          <FileText size={22} />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              {editingId ? 'Editar template' : 'Novo template'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Dê um nome para identificar e escreva o texto que aparecerá na cobrança.
            </p>
          </div>
          <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
            <Plus size={22} />
          </div>
        </div>

        <div className="grid gap-4">
          <input
            type="text"
            placeholder='Nome do template. Ex: "Mensalidade", "Aluguel"'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
          <textarea
            placeholder='Texto da descrição. Ex: "Mensalidade referente ao mês de outubro"'
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="input"
            rows={3}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando...' : editingId ? 'Atualizar template' : 'Salvar template'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <X size={16} />
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div className="card">
        <h2 className="mb-4 text-xl font-semibold text-[#070D2D]">Templates salvos</h2>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <FileText className="mx-auto text-[#5B4BFF]" size={34} />
            <p className="mt-3 font-semibold text-[#070D2D]">Nenhum template criado</p>
            <p className="mt-1 text-sm text-slate-500">
              Crie templates para preencher a descrição das cobranças com um clique.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-[#5B4BFF]/40 hover:bg-[#5B4BFF]/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#070D2D]">{t.name}</p>
                  <p className="mt-1 text-sm text-slate-500 break-words">{t.content}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(t)}
                    className="rounded-xl border border-slate-200 p-2 text-[#5B4BFF] transition hover:bg-[#5B4BFF]/10"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="rounded-xl border border-slate-200 p-2 text-red-600 transition hover:bg-red-50"
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
