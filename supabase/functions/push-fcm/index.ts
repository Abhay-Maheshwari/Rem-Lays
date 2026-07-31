// Edge Function: push-fcm
// Triggered by a Database Webhook on `items` INSERT. Looks up the
// recipient's other devices' FCM tokens and pushes a notification so a
// backgrounded Android app gets woken up even without an open Realtime
// socket (see the design doc's §2/§6 for why this exists at all).
//
// Required secrets (set via `supabase secrets set`):
//   FIREBASE_PROJECT_ID       — your Firebase project ID
//   FIREBASE_SERVICE_ACCOUNT  — the full JSON contents of your Firebase
//                               service account key file
//
// Deploy: supabase functions deploy push-fcm

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@^9.0.0";

// Cache the token in memory — it's valid for ~1 hour, so we refresh at 55 min
// to avoid mid-request expiry. Each Edge Function cold start resets this.
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);

  const auth = new GoogleAuth({
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
    scopes: "https://www.googleapis.com/auth/firebase.messaging",
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  cachedToken = tokenResponse.token!;
  // Refresh 5 minutes before the 1-hour expiry
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;

  return cachedToken;
}

Deno.serve(async (req) => {
  const payload = await req.json();
  // Postgres webhook payloads from Supabase look like: { type: "INSERT", table: "items", record: {...} }
  const item = payload.record;
  if (!item) return new Response("No record in payload", { status: 400 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: devices, error } = await admin
    .from("devices")
    .select("id, fcm_token")
    .eq("user_id", item.user_id)
    .neq("id", item.source_device_id ?? "")
    .not("fcm_token", "is", null)
    .is("revoked_at", null);

  if (error || !devices?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
  const accessToken = await getAccessToken();

  let sent = 0;
  for (const device of devices) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: device.fcm_token,
          notification: {
            title: "New item in Rem-Lays",
            body: item.type === "text" ? "A note was shared" : `A ${item.type} was shared`,
          },
          android: {
            notification: {
              channel_id: "rem_lays_fcm_channel",
              sound: "mixkit_long_pop_2358",
            }
          }
        },
      }),
    });
    if (res.ok) sent += 1;
  }

  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
