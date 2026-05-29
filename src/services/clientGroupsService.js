import { supabase } from './supabaseClient'

export async function getGroups(userId) {
  const { data, error } = await supabase
    .from('client_groups')
    .select(`
      *,
      members:client_group_members(
        client_id,
        client:clients(id, name, phone)
      )
    `)
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function createGroup({ user_id, name, clientIds }) {
  const { data: group, error: groupError } = await supabase
    .from('client_groups')
    .insert([{ user_id, name }])
    .select()
    .single()

  if (groupError) throw groupError

  if (clientIds.length > 0) {
    const { error: membersError } = await supabase
      .from('client_group_members')
      .insert(clientIds.map((client_id) => ({ group_id: group.id, client_id })))

    if (membersError) throw membersError
  }

  return group
}

export async function updateGroup({ id, user_id, name, clientIds }) {
  const { error: updateError } = await supabase
    .from('client_groups')
    .update({ name })
    .eq('id', id)
    .eq('user_id', user_id)

  if (updateError) throw updateError

  const { error: deleteError } = await supabase
    .from('client_group_members')
    .delete()
    .eq('group_id', id)

  if (deleteError) throw deleteError

  if (clientIds.length > 0) {
    const { error: insertError } = await supabase
      .from('client_group_members')
      .insert(clientIds.map((client_id) => ({ group_id: id, client_id })))

    if (insertError) throw insertError
  }
}

export async function deleteGroup(id, userId) {
  const { error } = await supabase
    .from('client_groups')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
