// Edge Function: presign-upload
// Called by the client before uploading media. Verifies the caller's
// Supabase session, then issues a short-lived signed upload URL scoped to
// a path under that user's own id in the `media` bucket.
//
// Deploy: supabase functions deploy presign-upload

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { contentType, sizeBytes } = await req.json();

  // TODO: pick a real ceiling before Phase 5 — Supabase Storage's free
  // tier is 1GB total, so a single upload cap (e.g. 200MB) protects
  // against one large video eating the whole bucket.
  const MAX_BYTES = 200 * 1024 * 1024;
  if (typeof sizeBytes === "number" && sizeBytes > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "File too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const objectPath = `${userData.user.id}/${crypto.randomUUID()}`;

  const { data, error } = await supabase.storage
    .from("media")
    .createSignedUploadUrl(objectPath);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ uploadUrl: data.signedUrl, token: data.token, storageKey: objectPath, contentType }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
