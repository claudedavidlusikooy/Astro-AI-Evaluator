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
{"intent":"full|partial|none","intent_reason":"1 sentence","prompt":"full|partial|none","prompt_reason":"1 sentence","html":"full|partial|none","html_reason":"1 sentence","overall":"good|review|fail","summary":"1-2 sentences","action":"what they should fix if not good, or empty string if good"}

SCORING:
intent: full=specific problem+why it matters clearly stated; partial=vague; none=no problem or all placeholders/links
prompt: full=shows iteration/numbered steps/multi-turn refinement or 200+ meaningful chars; partial=some effort <200 chars; none="-" or single line or just a URL
html: full=HTML on Google Drive OR real deployed URL (not chatgpt/claude.ai share link); partial=local file path or chat share link; none=nothing
overall: good=2+ full and ≤1 none; review=1+ full but not good; fail=2+ none or prompt is "-"/link only
action: if overall is "review" or "fail", give 1-2 specific actionable sentences on what to fix/resubmit. If "good", leave empty.

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
