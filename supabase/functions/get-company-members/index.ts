import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get company_id from query params
    const url = new URL(req.url)
    const companyId = url.searchParams.get('company_id')
    
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is a member of this company
    const { data: membership } = await supabaseAdmin
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all members with their emails
    const { data: members, error: membersError } = await supabaseAdmin
      .from('company_members')
      .select('id, company_id, user_id, created_at')
      .eq('company_id', companyId)

    if (membersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to get members', details: membersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get emails for all member user_ids
    const userIds = members.map(m => m.user_id)
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    
    const emailMap = new Map(
      users.users
        .filter(u => userIds.includes(u.id))
        .map(u => [u.id, u.email])
    )

    const result = members.map(m => ({
      id: m.id,
      company_id: m.company_id,
      user_id: m.user_id,
      created_at: m.created_at,
      email: emailMap.get(m.user_id) || 'Unknown',
    }))

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

