import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { submission } = await request.json()
    if (!submission) return Response.json({ error: 'No submission provided' }, { status: 400 })
    const s = submission

    const hasHtmlFile = (s.html_file||'').includes('drive.google') || ((s.html_file||'').startsWith('http') && !(s.html_file||'').includes('chatgpt') && !(s.html_file||'').includes('claude.ai'))
    const hasDeployed = (s.deployed||'').length > 3 && s.deployed !== '-' && (s.deployed||'').startsWith('http') && !['file://','chatgpt.com','suno.com','play.google','claude.ai'].some(x => (s.deployed||'').includes(x))
    const problemIsLink = s.problem && s.problem.trim().startsWith('http') && !s.problem.includes(' ')
    const howIsLink = s.how && s.how.trim().startsWith('http') && !s.how.includes(' ')

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Employees must build an AI-powered tool that solves a real problem.

Return ONLY valid JSON, no markdown, no extra text:
{"intent":"full|partial|none","intent_reason":"1 sentence","prompt":"full|partial|none","prompt_reason":"1 sentence","html":"full|partial|none","html_reason":"1 sentence","summary":"2-3 sentences describing what this tool does and who it helps","action":"specific fix instructions or empty string if qualified","ai_score":1,"ai_score_reason":"1 sentence"}

SCORING CRITERIA:

1. intent (Clear Intent):
- "full" = specific problem + why it matters clearly stated
- "partial" = problem vague or generic
- "none" = no problem stated, or field contains only a URL link${problemIsLink ? '\n⚠️ NOTE: The problem field contains only a URL link — score as "none" for intent since no actual problem description was provided.' : ''}

2. prompt (Multi-Conversation Prompt):
- "full" = clear iteration: numbered steps, multiple exchanges, refinements, OR 300+ meaningful chars
- "partial" = some effort, short single prompt under 300 chars
- "none" = just "-", single word/line, URL only, or empty

3. html (Working HTML/App):
- "full" = HTML on Google Drive OR real deployed URL (vercel, github.io, railway, streamlit, script.google.com, netlify, etc.) — A LIVE DEPLOYED APP COUNTS AS FULL EVEN WITHOUT HTML FILE UPLOAD
- "partial" = local file:// path only, or link is a chat share link
- "none" = no HTML file AND no deployed link

summary: Write 2-3 clear sentences describing: (1) what the tool does, (2) what problem it solves, (3) who benefits. Be specific and concrete. If fields contain only links, note that description is in external document.

OVERALL QUALIFICATION (used externally, not in JSON):
Qualified = 2+ "full" AND zero "none"
Not Qualified = everything else

action:
- If qualified (2+ full, zero none): empty string ""
- If not qualified: 1-2 specific sentences on exactly what to fix and resubmit by 1 June 2026

ai_score (1-5):
5 = Exceptional: complex multi-step AI, clear iteration, production-quality, real business impact
4 = Strong: good AI integration, clear iteration, functional deployed tool
3 = Adequate: AI used properly, decent prompting, tool works
2 = Minimal: simple single prompt, basic output
1 = Weak: AI barely used, unclear contribution, placeholder submission

SUBMISSION:
Tool Name: ${s.tool_name}
Purpose: ${s.purpose}
Problem: ${problemIsLink ? '[EXTERNAL LINK - no description provided: ' + s.problem + ']' : (s.problem||'').substring(0,400)}
How it works: ${howIsLink ? '[EXTERNAL LINK - no description provided: ' + s.how + ']' : (s.how||'').substring(0,400)}
Prompt (first 1500 chars): ${(s.prompt||'').substring(0,1500)}
HTML file uploaded: ${hasHtmlFile ? s.html_file : 'NOT UPLOADED'}
Deployed/live link: ${hasDeployed ? s.deployed : 'none'}`

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
