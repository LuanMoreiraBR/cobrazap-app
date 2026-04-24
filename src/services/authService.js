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
    },
  })

  if (error) throw error

  if (data.user?.id) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      name: cleanName || 'Usuário',
      email,
    })

    if (profileError) throw profileError
  }

  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
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