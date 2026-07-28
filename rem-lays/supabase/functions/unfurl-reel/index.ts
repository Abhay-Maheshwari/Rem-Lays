// Edge Function: unfurl-reel
// Fetches Instagram's oEmbed data for a public reel/post URL, using
// Meta's tokenless oEmbed endpoint. Confirmed current as of this
// writing: Meta reversed their 2020 access-token requirement on
// June 15, 2026, so this works with a plain GET, no Facebook app or
// App Review needed. This is a recent policy reversal though — worth a
// quick check if it stops working, since Meta has changed this exact
// endpoint's rules before and could again.
//
// Only works for PUBLIC posts/reels — private accounts and profile URLs
// (as opposed to individual post/reel URLs) aren't supported.
//
// Deploy: supabase functions deploy unfurl-reel

Deno.serve(async (req) => {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
  }

  // omitscript=true: we load Instagram's embed.js once ourselves on the
  // client (InstagramEmbedService) rather than per-card, since a feed can
  // show many reels at once — that's the documented recommended pattern
  // for embedding more than one item on a page.
  const oembedUrl = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(url)}&omitscript=true`;

  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `oEmbed fetch failed: ${res.status}` }), { status: 502 });
    }
    const data = await res.json();
    return new Response(
      JSON.stringify({ authorName: data.author_name ?? null, html: data.html ?? null }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `${err}` }), { status: 502 });
  }
});
