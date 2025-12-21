import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ANTHROPIC_API_KEY environment variable is not set',
          message: 'Please add your Anthropic API key as a secret in Supabase Dashboard → Project Settings → Edge Functions → Secrets',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Say "OK" if you can read this.',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Unknown error';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
      } catch {
        errorMessage = errorText;
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Anthropic API request failed',
          statusCode: response.status,
          message: errorMessage,
          hint: response.status === 401
            ? 'Invalid API key. Please check your ANTHROPIC_API_KEY secret in Supabase.'
            : 'API request failed. Check the error message for details.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Anthropic API key is configured correctly!',
        model: 'claude-3-7-sonnet-20250219',
        response: data.content[0].text,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Test failed',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});