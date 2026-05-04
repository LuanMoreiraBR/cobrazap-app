import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signUp(form)
      alert('Conta criada com sucesso. Agora faça login.')
      navigate('/planos')
    } catch (err) {
      setError(err.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon-lembrei.png" alt="Lembrei" className="h-11 w-11 rounded-2xl" />
          <div>
            <h1 className="text-3xl font-bold text-[#070D2D]">Criar conta</h1>
            <p className="text-sm text-slate-500">Comece a organizar suas cobranças.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="text"
            placeholder="Seu nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />

          <input
            type="email"
            placeholder="Seu email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />

          <input
            type="password"
            placeholder="Crie uma senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-[#5B4BFF]">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}