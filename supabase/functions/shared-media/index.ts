// Supabase Edge Function: shared-media
// Returns a time-limited signed download URL for media attached to a
// publicly shared item.  The caller only needs the share_token — no
// auth required, because the function itself uses the service-role key
// to verify the token and generate the signed URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { shareToken } = await req.json();
    if (!shareToken) {
      return new Response(
        JSON.stringify({ error: 'shareToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service-role client bypasses RLS — we need this to look up any
    // item by its share_token regardless of user ownership.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('storage_key, type')
      .eq('share_token', shareToken)
      .single();

    if (itemError || !item?.storage_key) {
      return new Response(
        JSON.stringify({ error: 'Item not found or has no media' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from('media')
      .createSignedUrl(item.storage_key, 3600); // 1 hour

    if (signError || !signedData) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: signedData.signedUrl, type: item.type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
