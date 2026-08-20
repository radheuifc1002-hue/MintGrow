import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_MONETAG_ZONE_ID = '11613357';
const MONETAG_SCRIPT_URL = 'https://libtl.com/sdk.js';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action } = await req.json().catch(() => ({ action: 'get_config' }));

    if (action === 'get_config') {
      const zoneId = Deno.env.get('MONETAG_ZONE_ID') || DEFAULT_MONETAG_ZONE_ID;

      return new Response(
        JSON.stringify({
          zoneId,
          sdkFunction: `show_${zoneId}`,
          scriptUrl: MONETAG_SCRIPT_URL,
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
      JSON.stringify({ error: 'Unable to load Monetag configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
