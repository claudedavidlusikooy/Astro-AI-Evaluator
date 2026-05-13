export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  return Response.json({ status: 'ok', api_key_configured: hasKey })
}
