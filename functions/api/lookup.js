// Cloudflare Pages Function — proxies the Airtable lookup so the API token
// stays server-side. Configure these in the Cloudflare Pages project's
// Settings → Environment variables (never commit them):
//   AIRTABLE_TOKEN     - the Airtable Personal Access Token (mark as "secret")
//   AIRTABLE_BASE_ID    - defaults to app6N6wbWgCv0KZkD if unset
//   AIRTABLE_TABLE      - defaults to "Reviews" if unset
export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[A-Za-z0-9-]+$/.test(slug)) {
    return Response.json({ jotform_url: null }, { status: 400 });
  }

  // Airtable's own response time (~500-650ms) is the dominant cost of this
  // lookup. slug -> jotform_url mappings are set once at onboarding and
  // almost never change, so cache hits at Cloudflare's edge instead of
  // re-querying Airtable on every visit.
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const baseId = env.AIRTABLE_BASE_ID || "app6N6wbWgCv0KZkD";
  const table = env.AIRTABLE_TABLE || "Reviews";
  const formula = encodeURIComponent(`{slug}="${slug}"`);
  const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${formula}&maxRecords=1&fields[]=jotform_url`;

  const airtableRes = await fetch(airtableUrl, {
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
  });
  const data = await airtableRes.json();
  const record = data.records && data.records[0];

  const response = Response.json(
    { jotform_url: record ? record.fields.jotform_url : null },
    { headers: { "Cache-Control": "public, max-age=1800" } }
  );

  // Only cache confirmed matches — never cache a "not found", in case the
  // slug was just added in Airtable and hasn't replicated yet.
  if (record) {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
