import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RemoveMemberRequest {
  company_id: string
  user_id: string
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

    // Parse request body
    const body: RemoveMemberRequest = await req.json()
    
    if (!body.company_id || !body.user_id) {
      return new Response(
        JSON.stringify({ error: 'company_id and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is a member of this company
    const { data: callerMembership } = await supabaseAdmin
      .from('company_members')
      .select('id')
      .eq('company_id', body.company_id)
      .eq('user_id', user.id)
      .single()

    if (!callerMembership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check member count
    const { count } = await supabaseAdmin
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', body.company_id)

    if (count && count <= 1) {
      return new Response(
        JSON.stringify({ error: 'Cannot remove the last member. Delete the company instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove the member
    const { error: deleteError } = await supabaseAdmin
      .from('company_members')
      .delete()
      .eq('company_id', body.company_id)
      .eq('user_id', body.user_id)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Failed to remove member', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
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

