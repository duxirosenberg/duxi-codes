import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateCompanyRequest {
  name: string
  base_currency?: string
  jurisdiction?: string | null
  incorporation_date?: string | null
  authorized_shares?: number | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Create client with user's JWT to get their ID
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
    const body: CreateCompanyRequest = await req.json()
    
    if (!body.name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert the company using service role (bypasses RLS)
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: body.name.trim(),
        base_currency: body.base_currency || 'USD',
        jurisdiction: body.jurisdiction || null,
        incorporation_date: body.incorporation_date || null,
        authorized_shares: body.authorized_shares || null,
      })
      .select()
      .single()

    if (companyError) {
      console.error('Failed to create company:', companyError)
      return new Response(
        JSON.stringify({ error: 'Failed to create company', details: companyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add the user as a member using service role
    const { error: memberError } = await supabaseAdmin
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: user.id,
      })

    if (memberError) {
      console.error('Failed to add member:', memberError)
      // Rollback: delete the company
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      return new Response(
        JSON.stringify({ error: 'Failed to add member', details: memberError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return the created company
    return new Response(
      JSON.stringify({
        id: company.id,
        name: company.name,
        base_currency: company.base_currency,
        jurisdiction: company.jurisdiction,
        incorporation_date: company.incorporation_date,
        authorized_shares: company.authorized_shares,
        created_at: company.created_at,
        updated_at: company.updated_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

