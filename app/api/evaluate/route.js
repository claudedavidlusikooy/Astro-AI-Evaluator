import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const body = await request.json()

    // ── Insights mode ──────────────────────────────────────
    if (body.insightPrompt) {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: body.insightPrompt + '\n\nIMPORTANT: Keep each text field under 150 characters. Be concise. Return valid JSON only.' }]
      })
      const raw = msg.content[0].text.trim()
      // Extract JSON robustly
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      const result = JSON.parse(jsonMatch[0])
      return Response.json({ result })
    }

    // ── Submission evaluation mode ─────────────────────────
    const s = body.submission
    if (!s) return Response.json({ error: 'No submission provided' }, { status: 400 })

    const hasHtmlFile = (s.html_file||'').includes('drive.google') ||
      ((s.html_file||'').startsWith('http') && !(s.html_file||'').includes('chatgpt') && !(s.html_file||'').includes('claude.ai'))
    const hasDeployed = (s.deployed||'').length > 3 && s.deployed !== '-' &&
      (s.deployed||'').startsWith('http') && !s.deployed.startsWith('file://') &&
      !['chatgpt.com','suno.com','play.google','claude.ai'].some(x => (s.deployed||'').includes(x))
    const probIsLink = !!(s.problem && s.problem.trim().startsWith('http') && !s.problem.includes(' '))
    const howIsLink  = !!(s.how    && s.how.trim().startsWith('http')    && !s.how.includes(' '))

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Return ONLY valid JSON, no markdown, no preamble:
{"intent":"full|partial|none","intent_reason":"1 sentence max 100 chars","prompt":"full|partial|none","prompt_reason":"1 sentence max 100 chars","html":"full|partial|none","html_reason":"1 sentence max 100 chars","summary":"2-3 sentences max 250 chars total","action":"1-2 sentences max 200 chars or empty string","ai_score":3,"ai_score_reason":"1 sentence max 100 chars"}

SCORING:
intent: full=specific problem+why it matters clearly; partial=vague; none=no problem or field is a URL only${probIsLink ? ' [FIELD IS URL ONLY — score none]' : ''}
prompt: full=clear iteration/numbered steps/300+ meaningful chars; partial=some effort<300 chars; none="-"/URL/empty
html: full=Google Drive HTML OR real deployed URL (vercel/github.io/railway/streamlit/script.google.com/netlify) — DEPLOYED APP COUNTS AS FULL; partial=local file:// or chat share link; none=nothing submitted

action: empty "" if (2+ full AND zero none); else 1-2 sentences what to fix, resubmit by 1 June 2026
ai_score 1-5: 5=exceptional complex AI; 4=good iteration+deployed; 3=adequate; 2=simple prompt; 1=barely used

SUBMISSION:
Tool: ${s.tool_name}
Purpose: ${s.purpose}
Problem: ${probIsLink ? `[URL ONLY: ${s.problem}]` : (s.problem||'').substring(0,300)}
How it works: ${howIsLink ? `[URL ONLY: ${s.how}]` : (s.how||'').substring(0,300)}
Prompt: ${(s.prompt||'').substring(0,1200)}
HTML file: ${hasHtmlFile ? s.html_file : 'NOT UPLOADED'}
Deployed: ${hasDeployed ? s.deployed : 'none'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])
    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
