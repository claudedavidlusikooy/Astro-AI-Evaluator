const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN
const STORE_KEY = 'astro_eval_shared'

export async function GET() {
  try {
    if (!KV_URL || !KV_TOKEN) return Response.json({ error: 'KV not configured' }, { status: 500 })
    const resp = await fetch(`${KV_URL}/get/${STORE_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store'
    })
    const data = await resp.json()
    if (!data.result) return Response.json({ data: null })
    // Handle both single and double encoded data
    let result = JSON.parse(data.result)
    if (typeof result === 'string') result = JSON.parse(result)
    return Response.json({ data: result })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    if (!KV_URL || !KV_TOKEN) return Response.json({ error: 'KV not configured' }, { status: 500 })
    const body = await request.json()
    await fetch(`${KV_URL}/set/${STORE_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(body))
    })
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
