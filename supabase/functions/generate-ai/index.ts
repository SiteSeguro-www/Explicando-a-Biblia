
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, systemPrompt } = await req.json();

    // Security: Get Key from Server Environment Variables (Supabase Secrets)
    const apiKey = Deno.env.get('GROQ_API_KEY');

    if (!apiKey) {
        throw new Error("Server configuration error: Missing GROQ_API_KEY");
    }

    // GROQ FIX: The word "JSON" must appear in the prompt when response_format is json_object
    const safeSystemPrompt = systemPrompt.includes("JSON") 
        ? systemPrompt 
        : systemPrompt + " Responda exclusivamente em formato JSON válido.";

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: safeSystemPrompt },
          { role: "user", content: prompt + " (Responda em JSON)" } // Reinforce JSON requirement in user prompt
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    if (!response.ok) {
        const errData = await response.json();
        console.error("Groq API Error:", errData);
        throw new Error(`Groq API Error: ${response.status} - ${JSON.stringify(errData)}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Backend Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
