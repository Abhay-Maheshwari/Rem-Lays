// Edge Function: revoke-device
// Uses the SERVICE ROLE key (never exposed to any client) to log out one
// specific device without affecting the user's other sessions.
//
// Honest flag for whoever implements this fully: Supabase's admin API
// signs out by user id + scope ('global' | 'local' | 'others'), not by an
// arbitrary session id in isolation. To revoke exactly one device among
// several, you need the session id Supabase returns at sign-in time
// stored on that device's `devices` row (add a `session_id` column), then
// check the current Supabase Admin API docs for the call that accepts it —
// this may have changed by the time you build this in Phase 7, so verify
// against https://supabase.com/docs/reference/javascript/auth-admin-api
// rather than trusting this comment.
//
// Deploy: supabase functions deploy revoke-device --no-verify-jwt=false

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

  const { deviceId } = await req.json();
  if (!deviceId) return new Response(JSON.stringify({ error: "Missing deviceId" }), { status: 400 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Confirm the device actually belongs to the caller before touching it.
  const { data: device, error: deviceErr } = await admin
    .from("devices")
    .select("id, user_id")
    .eq("id", deviceId)
    .single();

  if (deviceErr || !device || device.user_id !== userData.user.id) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  await admin.from("devices").update({ revoked_at: new Date().toISOString() }).eq("id", deviceId);

  // TODO: also invalidate that device's actual session/refresh token —
  // see the honest flag in the comment above before wiring this up for real.

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
