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

  // Cobrança única ou parcelada
  payment_type = 'single',
  installment_group_id = null,
  installment_number = null,
  installment_total = null,
  original_amount = null,

  // Métodos de pagamento
  payment_methods = ['pix'],
  credit_card_enabled = false,
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

        payment_type,
        installment_group_id,
        installment_number,
        installment_total,
        original_amount: original_amount ?? amount,

        payment_methods,
        credit_card_enabled,
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

  // Cobrança única ou parcelada
  payment_type = 'single',
  installment_group_id = null,
  installment_number = null,
  installment_total = null,
  original_amount = null,

  // Métodos de pagamento
  payment_methods = ['pix'],
  credit_card_enabled = false,
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

      payment_type,
      installment_group_id,
      installment_number,
      installment_total,
      original_amount: original_amount ?? amount,

      payment_methods,
      credit_card_enabled,
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

  if (error) {
    console.error('Erro bruto da Edge Function:', error)

    if (error.context) {
      try {
        const errorBody = await error.context.json()
        console.error('Resposta da Edge Function:', errorBody)
        throw new Error(errorBody?.error || 'Erro ao gerar pagamento.')
      } catch {
        throw new Error(error.message || 'Erro ao chamar função de pagamento.')
      }
    }

    throw new Error(error.message || 'Erro ao chamar função de pagamento.')
  }

  if (!data?.ok) {
    console.error('Erro retornado pela função:', data)
    throw new Error(data?.error || 'Erro ao gerar pagamento.')
  }

  return data.charge
}