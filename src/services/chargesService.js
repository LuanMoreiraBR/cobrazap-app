import { supabase } from './supabaseClient'

export async function getCharges(userId) {
  const { data, error } = await supabase
    .from('charges')
    .select(`
      *,
      client:clients (
        id,
        name,
        phone
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createCharge({
  user_id,
  client_id,
  description,
  amount,
  due_date,
  status = 'pendente',
  message_type = 'friendly',
}) {
  const { data, error } = await supabase
    .from('charges')
    .insert([
      {
        user_id,
        client_id,
        description,
        amount,
        due_date,
        status,
        message_type,
      },
    ])
    .select(`
      *,
      client:clients (
        id,
        name,
        phone
      )
    `)
    .single()

  if (error) throw error
  return data
}

export async function updateCharge({
  id,
  user_id,
  client_id,
  description,
  amount,
  due_date,
  status,
  message_type = 'friendly',
}) {
  const { data, error } = await supabase
    .from('charges')
    .update({
      client_id,
      description,
      amount,
      due_date,
      status,
      message_type,
    })
    .eq('id', id)
    .eq('user_id', user_id)
    .select(`
      *,
      client:clients (
        id,
        name,
        phone
      )
    `)
    .single()

  if (error) throw error
  return data
}

export async function markChargeAsPaid(id, userId) {
  const { data, error } = await supabase
    .from('charges')
    .update({ status: 'pago' })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCharge(id, userId) {
  const { error } = await supabase
    .from('charges')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
export async function createPixPaymentForCharge(chargeId, userId) {
  const { data, error } = await supabase.functions.invoke('create-pix-payment', {
    body: {
      charge_id: chargeId,
      user_id: userId,
    },
  })

  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Erro ao gerar Pix.')

  return data.charge
}