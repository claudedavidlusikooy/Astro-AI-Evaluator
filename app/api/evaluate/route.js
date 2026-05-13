import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { submission } = await request.json()
    if (!submission) return Response.json({ error: 'No submission provided' }, { status: 400 })

    const s = submission
    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Employees must build an AI-powered tool that solves a real problem. Output must be an HTML file.

Return ONLY valid JSON — no markdown, no extra text:
{"intent":"full|partial|none","intent_reason":"1 sentence","prompt":"full|partial|none","prompt_reason":"1 sentence","html":"full|partial|none","html_reason":"1 sentence","overall":"good|review|fail","summary":"1-2 sentences","action":"specific fix instructions or empty if good"}

SCORING CRITERIA:

1. intent (Clear Intent):
- "full" = clearly states a SPECIFIC problem AND explains why it matters or how it impacts their work
- "partial" = problem is mentioned but vague, generic, or lacks context on why it matters
- "none" = no problem stated, or all fields contain only links/placeholders

2. prompt (Multi-Conversation Prompt):
- "full" = shows clear iteration: numbered steps, multiple exchanges, refinements, OR a single detailed prompt of 300+ meaningful chars
- "partial" = some effort but minimal — short single prompt under 300 chars, or light iteration without refinement
- "none" = just "-", a single word/line, a URL only, or empty

3. html (Working HTML):
- "full" = HTML file on Google Drive OR real deployed URL (vercel, github.io, railway, streamlit, script.google.com, netlify, etc.)
- "partial" = local file:// path, or deployed link is just a claude.ai/chatgpt share link
- "none" = no HTML file and no deployed link at all

OVERALL VERDICT:
- "good" = 2+ "full" AND zero "none"
- "review" = at least 1 "full" but doesn't qualify for good — person clearly tried, something real exists but has gaps
- "fail" = html is "none" AND (prompt is "none" OR intent is "none") — critical components missing; OR all 3 are "none"

KEY DISTINCTION:
- "review" = built something real, needs improvement
- "fail" = critical components missing, not enough to evaluate

action field:
- "good": empty string
- "review": 1-2 sentences on what specifically to improve, resubmit by 1 June 2026
- "fail": 1-2 sentences on what critical items are missing, must submit by 1 June 2026

SUBMISSION:
Tool: ${s.tool_name}
Purpose: ${s.purpose}
Problem: ${(s.problem||'').substring(0,400)}
How it works: ${(s.how||'').substring(0,400)}
Prompt (first 1500 chars): ${(s.prompt||'').substring(0,1500)}
HTML file: ${s.html_file||'not submitted'}
Deployed link: ${s.deployed||'not submitted'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
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
