
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mercado Pago Config
    // SECURITY: Only uses the environment variable set in Supabase Secrets.
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');
    
    if (!mpAccessToken) {
      throw new Error('Server configuration error: Missing MP_ACCESS_TOKEN');
    }
    
    const body = {
      items: [
        {
          id: "premium_plan",
          title: "Plano Premium - Explicando a Bíblia",
          description: "Acesso ilimitado a explicações e orações.",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 4.99
        }
      ],
      back_urls: {
        success: "https://siteseguro-www.github.io/Explicando-a-Biblia/?status=approved", 
        failure: "https://siteseguro-www.github.io/Explicando-a-Biblia/?status=failure",
        pending: "https://siteseguro-www.github.io/Explicando-a-Biblia/?status=pending"
      },
      auto_return: "approved",
      external_reference: user.id, // Link payment to user ID
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const preference = await response.json();

    if (!response.ok) {
      throw new Error(preference.message || 'Failed to create preference');
    }

    return new Response(JSON.stringify({ init_point: preference.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})