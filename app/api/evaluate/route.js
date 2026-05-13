import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const body = await request.json()

    // ── Insights mode ──────────────────────────────────────
    if (body.insightPrompt) {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: body.insightPrompt }]
      })
      const text = msg.content[0].text.trim().replace(/```json|```/g,'').trim()
      const result = JSON.parse(text)
      return Response.json({ result })
    }

    // ── Submission evaluation mode ─────────────────────────
    const s = body.submission
    if (!s) return Response.json({ error: 'No submission provided' }, { status: 400 })

    const hasHtmlFile = (s.html_file||'').includes('drive.google') || ((s.html_file||'').startsWith('http') && !(s.html_file||'').includes('chatgpt') && !(s.html_file||'').includes('claude.ai'))
    const hasDeployed = (s.deployed||'').length>3 && s.deployed!=='-' && (s.deployed||'').startsWith('http') && !['file://','chatgpt.com','suno.com','play.google','claude.ai'].some(x=>(s.deployed||'').includes(x))
    const probIsLink = s.problem && s.problem.trim().startsWith('http') && !s.problem.includes(' ')
    const howIsLink = s.how && s.how.trim().startsWith('http') && !s.how.includes(' ')

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Employees must build an AI-powered tool that solves a real problem.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"1 sentence","prompt":"full|partial|none","prompt_reason":"1 sentence","html":"full|partial|none","html_reason":"1 sentence","summary":"2-3 sentences","action":"fix instructions or empty if qualified","ai_score":1,"ai_score_reason":"1 sentence"}

SCORING:
1. intent: full=specific problem+why it matters; partial=vague; none=no problem or field is only a URL link${probIsLink?'\n⚠️ Problem field contains only a URL — score as "none" for intent.':''}
2. prompt: full=iteration/numbered steps/300+ meaningful chars; partial=some effort <300 chars; none="-"/single word/URL/empty
3. html: full=HTML on Google Drive OR real deployed URL (vercel/github.io/railway/streamlit/script.google.com/netlify/etc) — DEPLOYED APP = FULL EVEN WITHOUT HTML UPLOAD; partial=local file:// or chat share link; none=nothing

summary: 2-3 sentences: (1) what tool does, (2) problem solved, (3) who benefits. Be specific.${(probIsLink||howIsLink)?'\nNote: description fields contain external links — base summary on tool name and available context only.':''}

action: if 2+ full AND zero none → empty string ""; otherwise 1-2 sentences on what to fix, resubmit by 1 June 2026.

ai_score 1-5: 5=exceptional complex AI+production quality; 4=good iteration+functional; 3=adequate AI usage; 2=simple single prompt; 1=AI barely used

SUBMISSION:
Tool: ${s.tool_name}
Purpose: ${s.purpose}
Problem: ${probIsLink?`[LINK ONLY: ${s.problem}]`:(s.problem||'').substring(0,400)}
How it works: ${howIsLink?`[LINK ONLY: ${s.how}]`:(s.how||'').substring(0,400)}
Prompt (first 1500 chars): ${(s.prompt||'').substring(0,1500)}
HTML file: ${hasHtmlFile?s.html_file:'NOT UPLOADED'}
Deployed link: ${hasDeployed?s.deployed:'none'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = msg.content[0].text.trim().replace(/```json|```/g,'').trim()
    const result = JSON.parse(text)
    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
