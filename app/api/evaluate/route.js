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
        messages: [{ role: 'user', content: body.insightPrompt + '\n\nIMPORTANT: Keep ALL text fields under 120 characters. Return valid JSON only, no markdown.' }]
      })
      const raw = msg.content[0].text.trim()
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
    const howIsLink  = !!(s.how && s.how.trim().startsWith('http') && !s.how.includes(' '))

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Return ONLY valid JSON, no markdown, no preamble:
{"intent":"full|partial|none","intent_reason":"1 sentence max 100 chars","prompt":"full|partial|none","prompt_reason":"1 sentence max 100 chars","html":"full|partial|none","html_reason":"1 sentence max 100 chars","summary":"2-3 sentences max 250 chars","action":"REQUIRED if not qualified - 1-2 sentences exactly what to fix, resubmit by 1 June 2026","ai_score":3,"ai_score_reason":"1 sentence max 100 chars"}

SCORING:
intent: full=specific problem+why it matters; partial=vague/generic; none=no problem or URL only${probIsLink?' [FIELD IS URL ONLY - score none]':''}
prompt: full=iteration/numbered steps/300+ meaningful chars; partial=some effort <300 chars; none="-"/URL/single line/empty
html: full=Google Drive HTML OR real deployed URL (vercel/github.io/railway/streamlit/script.google.com/netlify) — DEPLOYED APP = FULL EVEN WITHOUT HTML UPLOAD; partial=local file:// or chat share link; none=nothing

QUALIFICATION RULE:
- Qualified = 2+ "full" AND zero "none" → action MUST be empty string ""
- Not Qualified = everything else → action MUST be specific non-empty fix instructions

CRITICAL: If verdict is Not Qualified, action field MUST contain specific actionable instructions. Never leave action empty for Not Qualified submissions. Always tell them exactly what to improve and to resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI

ai_score 1-5: 5=exceptional complex AI+production; 4=good iteration+deployed; 3=adequate; 2=simple prompt; 1=barely used

SUBMISSION:
Tool: ${s.tool_name}
Purpose: ${s.purpose}
Problem: ${probIsLink?`[URL ONLY: ${s.problem}]`:(s.problem||'').substring(0,300)}
How it works: ${howIsLink?`[URL ONLY: ${s.how}]`:(s.how||'').substring(0,300)}
Prompt: ${(s.prompt||'').substring(0,1200)}
HTML file: ${hasHtmlFile?s.html_file:'NOT UPLOADED'}
Deployed: ${hasDeployed?s.deployed:'none'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])

    // Safety net: enforce non-empty action for not_qualified
    const fulls = [result.intent, result.prompt, result.html].filter(x=>x==='full').length
    const nones = [result.intent, result.prompt, result.html].filter(x=>x==='none').length
    const isQualified = fulls >= 2 && nones === 0
    if (!isQualified && (!result.action || result.action.trim() === '')) {
      const missing = []
      if (result.intent !== 'full') missing.push('provide a clearer problem statement explaining why it matters')
      if (result.prompt !== 'full') missing.push('show more detailed prompting with iteration and refinement')
      if (result.html !== 'full') missing.push('upload your HTML file to Google Drive or deploy your app')
      result.action = `Please ${missing.join(', and ')}. Resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI`
    }

    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
