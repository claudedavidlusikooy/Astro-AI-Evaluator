import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { submission } = await request.json()
    if (!submission) return Response.json({ error: 'No submission provided' }, { status: 400 })
    const s = submission

    const hasHtmlFile = (s.html_file || '').includes('drive.google') || ((s.html_file || '').startsWith('http') && !(s.html_file || '').includes('chatgpt') && !(s.html_file || '').includes('claude.ai'))
    const hasDeployed = (s.deployed || '').length > 3 && s.deployed !== '-' && (s.deployed || '').startsWith('http') && !['file://','chatgpt.com','suno.com','play.google','claude.ai'].some(x => (s.deployed||'').includes(x))
    const hasWorkingApp = hasHtmlFile || hasDeployed

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Employees must build an AI-powered tool that solves a real problem.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"1 sentence","prompt":"full|partial|none","prompt_reason":"1 sentence","html":"full|partial|none","html_reason":"1 sentence","overall":"good|review|fail","summary":"1-2 sentences","action":"fix instructions or empty if good","ai_score":1-5,"ai_score_reason":"1 sentence"}

SCORING CRITERIA:

1. intent (Clear Intent):
- "full" = specific problem + why it matters clearly stated
- "partial" = problem vague or generic, lacks context
- "none" = no problem stated, all placeholders/links

2. prompt (Multi-Conversation Prompt):
- "full" = clear iteration: numbered steps, multiple exchanges, refinements, OR 300+ meaningful chars
- "partial" = some effort but short/minimal, under 300 chars
- "none" = just "-", single word/line, URL only, or empty

3. html (Working HTML/App):
- "full" = HTML on Google Drive OR real deployed URL (vercel, github.io, railway, streamlit, script.google.com, netlify, etc.) — DEPLOYED APP COUNTS AS FULL EVEN WITHOUT HTML FILE UPLOAD
- "partial" = local file:// path only, or link is just a chat share link
- "none" = no HTML file AND no deployed link

OVERALL:
- "good" = 2+ "full" AND zero "none"
- "review" = at least 1 "full" but not qualifying for good — real effort but gaps
- "fail" = html is "none" AND (prompt or intent is "none") — OR all 3 are "none"

ai_score (1-5 stars — AI Implementation Quality):
- 5 = Exceptional: multi-step AI, complex prompting, clear iteration, production-quality tool, real business impact
- 4 = Strong: good AI integration, clear iteration, functional deployed tool, solid prompting
- 3 = Adequate: AI used properly, decent prompting, tool works as intended
- 2 = Minimal: simple single prompt, basic output, limited AI sophistication
- 1 = Weak: AI barely used, unclear contribution, mostly manual, or submission is a placeholder

action:
- "good": empty string
- "review": 1-2 specific sentences on what to improve, resubmit by 1 June 2026
- "fail": 1-2 sentences on critical missing items, must submit by 1 June 2026

SUBMISSION:
Tool: ${s.tool_name}
Purpose: ${s.purpose}
Problem: ${(s.problem||'').substring(0,400)}
How it works: ${(s.how||'').substring(0,400)}
Prompt (first 1500 chars): ${(s.prompt||'').substring(0,1500)}
HTML file uploaded: ${hasHtmlFile ? s.html_file : 'NOT UPLOADED'}
Deployed/live link: ${hasDeployed ? s.deployed : 'none'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = msg.content[0].text.trim().replace(/```json|```/g, '').trim()
    const result = JSON.parse(text)
    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
