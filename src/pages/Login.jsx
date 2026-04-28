
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(form)
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <style>{`
        .login-card {
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
          animation-delay: 0.05s;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .logo-wrap {
          animation: logoIn 0.65s cubic-bezier(0.22,1,0.36,1) both;
          animation-delay: 0.2s;
        }
        @keyframes logoIn {
          from { opacity: 0; transform: scale(0.65); }
          to   { opacity: 1; transform: scale(1); }
        }
        .logo-ring {
          position: absolute;
          inset: -7px;
          border-radius: 24px;
          border: 2px solid rgba(7,13,45,0.12);
          animation: ringPulse 2.8s ease-in-out infinite;
          animation-delay: 0.8s;
          pointer-events: none;
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.1); opacity: 0; }
        }
        .fade-1 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.35s; }
        .fade-2 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.45s; }
        .fade-3 { animation: fadeUp 0.5s both; animation-delay: 0.55s; }
        .fade-4 { animation: fadeUp 0.5s both; animation-delay: 0.72s; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="login-card w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

        {/* Logo centralizado em destaque */}
        <div className="flex flex-col items-center mb-6">
          <a
            href="https://www.uselembrei.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer"
          >
            <div className="logo-wrap relative">
              <div className="logo-ring" />
              <img
                src="/icon-lembrei.png"
                alt="Lembrei"
                className="h-[72px] w-[72px] rounded-[18px]"
              />
            </div>
          </a>
          <h1 className="fade-1 mt-3 text-3xl font-bold text-[#070D2D]">Entrar</h1>
          <p className="fade-2 text-sm text-slate-500">Acesse sua conta Lembrei</p>
        </div>

        <form onSubmit={handleSubmit} className="fade-3 mt-6 space-y-4">
          <input
            type="email"
            placeholder="Seu email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="fade-4 mt-6 text-sm text-slate-600">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-[#5B4BFF]">
            Criar conta
          </Link>
        </p>

      </div>
    </div>
  )
}