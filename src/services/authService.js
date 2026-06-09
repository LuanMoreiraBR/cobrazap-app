import { supabase } from './supabaseClient'

export async function signUp({ name, email, password }) {
  const cleanName = name?.trim()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: cleanName,
        full_name: cleanName,
      },
      // Com confirmação de email ativada, o link do email redireciona o
      // cliente para a tela de login (e não para a home do app).
      emailRedirectTo: `${window.location.origin}/login`,
    },
  })

  if (error) throw error

  // Quando a confirmação de email está ativada, o signUp NÃO retorna uma
  // sessão, então um insert em `profiles` rodaria sem autenticação e seria
  // bloqueado pelo RLS — o que fazia o cadastro exibir "erro" mesmo tendo
  // criado a conta. Só criamos o perfil aqui quando já há sessão; caso
  // contrário ele é garantido no primeiro login (ensureProfile).
  if (data.session && data.user?.id) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      name: cleanName || 'Usuário',
      email,
    })

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError.message)
    }
  }

  return data
}

async function ensureProfile(user) {
  if (!user?.id) return

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      name:
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        'Usuário',
      email: user.email,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  if (error) {
    console.error('Erro ao garantir perfil:', error.message)
  }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  // Garante o perfil para contas criadas enquanto a confirmação de email
  // estava pendente (quando o insert no cadastro foi pulado).
  await ensureProfile(data.user)

  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/nova-senha`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}