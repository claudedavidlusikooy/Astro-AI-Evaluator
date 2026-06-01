import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sanitize(val) {
  if (!val) return ''
  return String(val).replace(/[\uD800-\uDFFF]/g, '').replace(/\u0000/g, '')
}

// Detect tool complexity from submission fields
function getToolComplexity(s) {
  const how = s.how.toLowerCase()
  const tool = s.tool_name.toLowerCase()
  const deployed = s.deployed.toLowerCase()

  if (how.includes('chrome extension') || how.includes('browser extension') ||
      how.includes('manifest') || tool.includes('extension')) return 'extension'
  if (how.includes('telegram') || how.includes('discord bot') ||
      how.includes('whatsapp bot')) return 'bot'
  if (how.includes(' cli') || how.includes('command line') ||
      how.includes('ai agent') || how.includes('automation script')) return 'cli_agent'
  if (s.deployed.startsWith('http') && !deployed.includes('localhost') &&
      !deployed.includes('local') && !['chatgpt.com','suno.com','claude.ai'].some(x => deployed.includes(x)))
    return 'deployed'
  if (s.html_file.includes('drive.google') ||
      (s.html_file.startsWith('http') && !s.html_file.includes('chatgpt'))) return 'html'
  if (how.includes('appsheet') || how.includes('n8n') ||
      how.includes('streamlit') || how.includes('glide')) return 'nocode'
  return 'basic'
}

export async function POST(request) {
  try {
    const body = await request.json()

    // ── Insights mode ──────────────────────────────────────────────
    if (body.insightPrompt) {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: sanitize(body.insightPrompt) + '\n\nIMPORTANT: Keep ALL text fields under 120 characters. Return valid JSON only, no markdown.' }]
      })
      const raw = msg.content[0].text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      return Response.json({ result: JSON.parse(jsonMatch[0]) })
    }

    const s = body.submission
    if (!s) return Response.json({ error: 'No submission provided' }, { status: 400 })

    // Sanitize all fields
    s.problem   = sanitize(s.problem)
    s.how       = sanitize(s.how)
    s.prompt    = sanitize(s.prompt)
    s.tool_name = sanitize(s.tool_name)
    s.html_file = sanitize(s.html_file)
    s.deployed  = sanitize(s.deployed)
    s.demo      = sanitize(s.demo)
    s.purpose   = sanitize(s.purpose)

    const complexity = getToolComplexity(s)
    const isComplex = ['extension','bot','cli_agent','deployed'].includes(complexity)
    const hasAnyOutput = s.html_file.length > 3 || s.deployed.length > 3 || (s.demo && s.demo.includes('drive.google'))
    const probIsLinkOnly = !!(s.problem && s.problem.trim().startsWith('http') && !s.problem.trim().includes(' '))
    const howIsLinkOnly  = !!(s.how && s.how.trim().startsWith('http') && !s.how.trim().includes(' '))

    const prompt = `You are evaluating submissions for Astro's Personal AI Challenge.

SPIRIT OF THIS CHALLENGE: Cultural change — we want EVERYONE to try AI, regardless of tech background.
This is NOT a competition. Simple tools are as valid as complex ones.
The goal: did they CREATE something new using AI?

CRITICAL PHILOSOPHY:
- Short description ≠ vague. "Track operator work time" is FULL intent. Brevity is OK.
- Empty prompt field ≠ didn't use AI. They may not know how to document prompts.
- GDrive link = valid output. Treat same as deployed URL.
- Benefit of the doubt ALWAYS goes to the submitter.
- NOT_QUALIFIED bar is VERY HIGH — only for truly empty submissions.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"max 100 chars","prompt":"full|partial|none","prompt_reason":"max 100 chars","html":"full|partial|none","html_reason":"max 100 chars","verdict":"qualified|manual_review|not_qualified","summary":"2-3 sentences max 250 chars","action":"empty if qualified, else specific fix","ai_score":3,"ai_score_reason":"max 100 chars"}

=== INTENT (Did they identify a problem to solve?) ===
full = ANY specific problem mentioned, even 1 sentence. "Biar gak lupa jadwal" = full. Short = OK.
partial = genuinely impossible to understand what they're trying to solve
none = completely empty or just "-"
${probIsLinkOnly ? 'NOTE: Problem field contains only a URL — this is likely a documentation issue, score partial not none unless truly empty' : ''}

=== PROMPT (Did they use AI to build it?) ===
full = ANY evidence of AI usage: prompt text (any length), conversation link, "I used Claude/ChatGPT to...", 
       OR tool is complex enough (${isComplex ? 'THIS TOOL IS COMPLEX — score full even with minimal prompt evidence' : 'deployed app, extension, bot = implied AI iteration'})
partial = something exists but very minimal
none = absolutely zero evidence of AI involvement — completely empty field
${howIsLinkOnly ? 'NOTE: How field contains only a URL — treat as partial at minimum, likely has context at that link' : ''}

=== HTML/APP (Did they make something?) ===
full = ANY working output: HTML file, deployed URL, GDrive link (VALID — treat same as deployed), 
       extension, bot, AppSheet, n8n, Streamlit, script — ANYTHING THAT EXISTS
partial = demo/screenshot only, local server with demo
none = absolutely nothing — no file, no link, no demo, truly empty
NOTE: GDrive links are FULL — this is a form limitation, not submitter's fault

=== VERDICT ===
qualified = 2+ full AND zero none — when in doubt, qualify
manual_review = has some evidence but needs human eyes — PREFER this over not_qualified
not_qualified = ONLY when all three are none/empty. Extremely rare.

=== AI SCORE (1-5) ===
5 = deployed app OR extension OR bot OR agent — complex tool showing real AI mastery
4 = working HTML + good prompt evidence OR nocode tool (AppSheet/n8n) + deployed
3 = working output + some prompt evidence  
2 = basic output, minimal AI evidence
1 = barely any evidence of AI use
${isComplex ? `BOOST: This appears to be a ${complexity} — score at least 4` : ''}

action: "" if qualified. If not qualified: specific actionable fix only.

SUBMISSION:
Tool: ${s.tool_name}
Complexity type: ${complexity}
Purpose: ${s.purpose}
Problem: ${probIsLinkOnly ? `[URL: ${s.problem}]` : s.problem.substring(0, 400)}
How it works: ${howIsLinkOnly ? `[URL: ${s.how}]` : s.how.substring(0, 400)}
Prompt evidence (first 1500 chars): ${s.prompt.substring(0, 1500)}
HTML/File: ${s.html_file || 'NOT PROVIDED'}
Deployed URL: ${s.deployed || 'none'}
Demo/Screenshot: ${s.demo || 'none'}
Has any output: ${hasAnyOutput ? 'YES' : 'NO'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])

    // Safety nets — enforce philosophy
    // 1. If has any output, never score html as none
    if (hasAnyOutput && result.html === 'none') {
      result.html = 'partial'
      result.html_reason = 'Has output — bumped from none'
    }

    // 2. Complex tools get prompt boost
    if (isComplex && result.prompt === 'none' && s.prompt.length > 10) {
      result.prompt = 'partial'
      result.prompt_reason = `${complexity} tool implies AI usage`
    }

    // 3. Never not_qualified if has any output
    if (hasAnyOutput && result.verdict === 'not_qualified') {
      result.verdict = 'manual_review'
      result.action = 'Has output — please review manually. Mark as Qualified if tool is valid.'
    }

    // 4. Force qualified if scores qualify
    const fulls = [result.intent, result.prompt, result.html].filter(x => x === 'full').length
    const nones = [result.intent, result.prompt, result.html].filter(x => x === 'none').length
    if (fulls >= 2 && nones === 0) {
      result.verdict = 'qualified'
      result.action = ''
    }

    // 5. Force action for not_qualified
    if (result.verdict === 'not_qualified' && (!result.action || !result.action.trim())) {
      const missing = []
      if (result.intent === 'none') missing.push('describe the problem your tool solves')
      if (result.prompt === 'none') missing.push('share your AI prompts or conversation link')
      if (result.html === 'none') missing.push('upload your tool file or provide a working link')
      result.action = `Please ${missing.join(', ')}. Resubmit by 4 June 2026 via https://bit.ly/AstroPersonalAI`
    }

    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
