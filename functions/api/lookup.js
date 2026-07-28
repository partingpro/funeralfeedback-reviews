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

  const baseId = env.AIRTABLE_BASE_ID || "app6N6wbWgCv0KZkD";
  const table = env.AIRTABLE_TABLE || "Reviews";
  const formula = encodeURIComponent(`{slug}="${slug}"`);
  const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${formula}&maxRecords=1&fields[]=jotform_url`;

  const airtableRes = await fetch(airtableUrl, {
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
  });
  const data = await airtableRes.json();
  const record = data.records && data.records[0];

  return Response.json({ jotform_url: record ? record.fields.jotform_url : null });
}
