import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isPlatformAdmin } from '../services/adminService'
import { requestPasswordReset } from '../services/authService'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, isAuthenticated, loading: authLoading } = useAuth()

  // Mantém o usuário logado: se já existe sessão (ex.: reabriu o PWA), vai
  // direto para o app em vez de mostrar o formulário de login de novo.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(location.state?.from || '/app', { replace: true })
    }
  }, [authLoading, isAuthenticated, location.state, navigate])

  // Vindo do cadastro (/login?created=1): mostra aviso para confirmar o email.
  const justCreated =
    new URLSearchParams(location.search).get('created') === '1'

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn(form)

      const loggedUser =
        result?.user ||
        result?.data?.user ||
        result?.session?.user ||
        result?.data?.session?.user

      const userId = loggedUser?.id

      if (userId) {
        const admin = await isPlatformAdmin(userId)
        if (admin) {
          navigate('/admin', { replace: true })
          return
        }
      }

      const redirectTo = location.state?.from || '/app'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    setError('')
    setResetLoading(true)

    try {
      await requestPasswordReset(resetEmail)
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Erro ao enviar email de recuperação.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon-lembrei.png" alt="Lembrei" className="h-11 w-11 rounded-2xl" />
          <div>
            <h1 className="text-3xl font-bold text-[#070D2D]">
              {forgotMode ? 'Recuperar senha' : 'Entrar'}
            </h1>
            <p className="text-sm text-slate-500">
              {forgotMode
                ? 'Enviaremos um link para redefinir sua senha.'
                : 'Acesse sua conta da Lembrei.'}
            </p>
          </div>
        </div>

        {forgotMode ? (
          resetSent ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                Email enviado! Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </div>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                className="w-full text-center text-sm font-semibold text-[#5B4BFF] hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="mt-8 space-y-4">
              <input
                type="email"
                placeholder="Seu email cadastrado"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input"
                required
              />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button type="submit" disabled={resetLoading} className="btn-primary w-full">
                {resetLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <button
                type="button"
                onClick={() => { setForgotMode(false); setError('') }}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Voltar para o login
              </button>
            </form>
          )
        ) : (
          <>
            {justCreated ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <strong>Conta criada com sucesso!</strong> Enviamos um link de
                confirmação para o seu email. Confirme para acessar sua conta.
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <input
                type="email"
                placeholder="Seu email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                required
              />

              <div className="space-y-1">
                <input
                  type="password"
                  placeholder="Sua senha"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(''); setResetEmail(form.email) }}
                    className="text-xs text-slate-500 hover:text-[#5B4BFF]"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="mt-6 text-sm text-slate-600">
              Ainda não tem conta?{' '}
              <Link to="/cadastro" className="font-semibold text-[#5B4BFF]">
                Criar conta
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}