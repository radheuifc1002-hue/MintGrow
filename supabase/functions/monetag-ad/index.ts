import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const publisherId = Deno.env.get('MONETAG_PUBLISHER_ID') ?? '';
    const zoneId = Deno.env.get('MONETAG_ZONE_ID') ?? '';

    if (!publisherId || !zoneId) {
      return new Response(
        JSON.stringify({ error: 'Monetag credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json().catch(() => ({ action: 'get_config' }));

    if (action === 'get_config') {
      // Return config securely — never expose raw keys to client
      return new Response(
        JSON.stringify({
          publisherId,
          zoneId,
          scriptUrl: `https://a.monetag.com/tag/?pub=${publisherId}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('monetag-ad error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
