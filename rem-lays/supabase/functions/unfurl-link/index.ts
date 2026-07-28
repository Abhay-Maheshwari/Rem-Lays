// Edge Function: unfurl-link
// Given a pasted URL, fetches it server-side (avoids the client-side CORS
// problems most sites' Open Graph tags run into) and extracts a title,
// image, and domain for the LinkCardComponent to render.
//
// This is a deliberately minimal regex-based extractor to get something
// working end to end. Swap in a real HTML parser (e.g. deno-dom) once
// you hit a page whose markup this doesn't handle.
//
// Deploy: supabase functions deploy unfurl-link

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: corsHeaders });
  }

  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; RemLaysBot/0.1)" } });
    html = await res.text();
  } catch (err) {
    return new Response(JSON.stringify({ error: `Fetch failed: ${err}` }), { status: 502, headers: corsHeaders });
  }

  const grab = (prop: string) => {
    const match = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
    return match?.[1] ?? null;
  };

  const titleTagMatch = html.match(/<title>([^<]*)<\/title>/i);

  const domain = new URL(url).hostname.replace(/^www\./, "");

  return new Response(
    JSON.stringify({
      title: grab("og:title") ?? titleTagMatch?.[1] ?? domain,
      image: grab("og:image"),
      domain,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
