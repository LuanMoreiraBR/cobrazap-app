import { supabase } from './supabaseClient'

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

export function normalizeSupportPhone(phone) {
  const digits = onlyDigits(phone)

  if (!digits) return ''

  return digits.startsWith('55') ? digits : `55${digits}`
}

export function formatSupportContactLabel(contact) {
  const nameOrLabel = contact.name || contact.label || 'Atendimento'
  const phone = normalizeSupportPhone(contact.phone)

  return `${nameOrLabel}: +${phone}`
}

export async function getWhatsappSupportContacts(userId) {
  const { data, error } = await supabase
    .from('whatsapp_support_contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  return data || []
}

export async function createWhatsappSupportContact(userId, payload) {
  const phone = normalizeSupportPhone(payload.phone)

  if (!phone) {
    throw new Error('Informe um WhatsApp válido.')
  }

  const { data, error } = await supabase
    .from('whatsapp_support_contacts')
    .insert({
      user_id: userId,
      label: payload.label || payload.name || 'Contato',
      name: payload.name || null,
      phone,
      is_default: Boolean(payload.is_default),
      is_active: true,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function updateWhatsappSupportContact(id, payload) {
  const updatePayload = {
    updated_at: new Date().toISOString(),
  }

  if ('label' in payload) updatePayload.label = payload.label
  if ('name' in payload) updatePayload.name = payload.name
  if ('phone' in payload) updatePayload.phone = normalizeSupportPhone(payload.phone)
  if ('is_default' in payload) updatePayload.is_default = Boolean(payload.is_default)
  if ('is_active' in payload) updatePayload.is_active = Boolean(payload.is_active)

  const { data, error } = await supabase
    .from('whatsapp_support_contacts')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function deleteWhatsappSupportContact(id) {
  const { error } = await supabase
    .from('whatsapp_support_contacts')
    .delete()
    .eq('id', id)

  if (error) throw error
}