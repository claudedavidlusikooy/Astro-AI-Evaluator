import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sanitize(val) {
  if (!val) return ''
  return String(val).replace(/[\uD800-\uDFFF]/g, '').replace(/\u0000/g, '')
}

function getToolComplexity(s) {
  const how = s.how.toLowerCase()
  const tool = s.tool_name.toLowerCase()
  const deployed = s.deployed.toLowerCase()
  if (how.includes('chrome extension') || how.includes('browser extension') || how.includes('manifest') || tool.includes('extension')) return 'extension'
  if (how.includes('telegram') || how.includes('discord bot') || how.includes('whatsapp bot')) return 'bot'
  if (how.includes(' cli') || how.includes('command line') || how.includes('ai agent') || how.includes('automation script')) return 'cli_agent'
  if (s.deployed.startsWith('http') && !deployed.includes('localhost') && !deployed.includes('local') && !['chatgpt.com','suno.com','claude.ai'].some(x => deployed.includes(x))) return 'deployed'
  if (s.html_file.includes('drive.google') || (s.html_file.startsWith('http') && !s.html_file.includes('chatgpt'))) return 'html'
  if (how.includes('appsheet') || how.includes('n8n') || how.includes('streamlit') || how.includes('glide') || how.includes('google apps script') || how.includes('apps script')) return 'nocode'
  return 'basic'
}

// Detect if submission is just text/document output (not a reusable tool)
function isPureTextOutput(s) {
  const how = s.how.toLowerCase()
  const tool = s.tool_name.toLowerCase()
  const problem = s.problem.toLowerCase()

  const textSignals = [
    'generate text', 'generate document', 'generate list', 'generate template',
    'membuat list', 'membuat dokumen', 'membuat template', 'membuat teks',
    'summarize', 'merangkum', 'rangkuman', 'ringkasan',
    'translate', 'menerjemahkan', 'terjemahan',
    'write email', 'menulis email', 'draft email',
    'content creation', 'membuat konten',
    'chatbot conversation', 'tanya ai', 'tanya claude', 'tanya chatgpt',
    'prompt template', 'prompt generator',
  ]

  const toolSignals = [
    'app', 'dashboard', 'tool', 'system', 'automation', 'workflow',
    'script', 'bot', 'extension', 'website', 'web', 'form', 'tracker',
    'monitor', 'calculator', 'generator yang', 'aplikasi', 'sistem',
    'otomatis', 'integrasi', 'api', 'database',
  ]

  const hasTextSignal = textSignals.some(s => how.includes(s) || tool.includes(s))
  const hasToolSignal = toolSignals.some(s => how.includes(s) || tool.includes(s) || problem.includes(s))

  return hasTextSignal && !hasToolSignal
}

export async function POST(request) {
  try {
    const body = await request.json()

    // Insights mode
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

    s.problem   = sanitize(s.problem)
    s.how       = sanitize(s.how)
    s.prompt    = sanitize(s.prompt)
    s.tool_name = sanitize(s.tool_name)
    s.html_file = sanitize(s.html_file)
    s.deployed  = sanitize(s.deployed)
    s.demo      = sanitize(s.demo)
    s.purpose   = sanitize(s.purpose)

    const complexity = getToolComplexity(s)
    const isComplex = ['extension','bot','cli_agent','deployed','nocode'].includes(complexity)
    const hasAnyOutput = s.html_file.length > 3 || s.deployed.length > 3 || (s.demo && s.demo.includes('drive.google'))
    const pureText = isPureTextOutput(s)
    const probIsLinkOnly = !!(s.problem && s.problem.trim().startsWith('http') && !s.problem.trim().includes(' '))
    const howIsLinkOnly  = !!(s.how && s.how.trim().startsWith('http') && !s.how.trim().includes(' '))

    const prompt = `You are evaluating submissions for Astro's Personal AI Challenge.

CORE REQUIREMENT: Participants must CREATE a working tool/app/automation using AI — not just ask AI to generate text, documents, or lists.

VALID submissions = reusable artifact: web app, dashboard, HTML tool, AppSheet app, n8n workflow, Google Apps Script, bot, browser extension, automation script, spreadsheet with real functionality.

INVALID submissions = pure text output: AI-generated documents, templates, email drafts, summaries, translations, or "I used ChatGPT to write X" with no reusable tool.

SPIRIT: Cultural change — everyone should TRY. Simple tools are as valid as complex ones. Short descriptions are OK. GDrive = valid output.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"max 100 chars","prompt":"full|partial|none","prompt_reason":"max 100 chars","html":"full|partial|none","html_reason":"max 100 chars","verdict":"qualified|manual_review|not_qualified","summary":"2-3 sentences max 250 chars","action":"empty if qualified, else specific fix","ai_score":3,"ai_score_reason":"max 100 chars","enhancement":"1-2 concrete ideas to improve or expand this tool, starting with you could explore..."}

=== INTENT ===
full = specific problem to solve, any length. "Track operator attendance" = full.
partial = genuinely unclear what they're solving
none = empty or "-"
${probIsLinkOnly ? 'NOTE: URL-only — score partial' : ''}

=== PROMPT ===
full = any AI usage evidence, OR complex tool implies iteration${isComplex ? ` [THIS IS ${complexity.toUpperCase()} — score full]` : ''}
partial = minimal but something exists  
none = zero evidence

=== HTML/APP ===
full = WORKING REUSABLE TOOL: functional HTML, deployed app, AppSheet, n8n, bot, extension, GDrive HTML file, Google Apps Script
partial = demo/screenshot only, local server, OR tool exists but appears to be text/document output
none = nothing at all
${pureText ? '⚠️ SIGNALS SUGGEST TEXT OUTPUT — if this is just AI-generated text/document (not a reusable tool), score partial or none' : ''}
${howIsLinkOnly ? 'NOTE: URL-only how field — treat as partial minimum' : ''}

=== VERDICT ===
qualified = 2+ full AND zero none AND has reusable tool (not just text output)
manual_review = has output but unclear if reusable tool, OR pure text output with good effort, OR needs human verification
not_qualified = no output at all, OR clearly just asked AI to write something

=== AI SCORE ===
5 = complex deployed app/extension/bot/agent
4 = working HTML + good prompts OR nocode tool deployed
3 = working output + some AI evidence
2 = basic output, minimal evidence
1 = barely any evidence
${isComplex ? `BOOST: ${complexity} — score minimum 4` : ''}
${pureText ? 'REDUCE: appears to be text output — score maximum 2' : ''}

=== ENHANCEMENT ===
Always provide 1-2 specific ideas to improve or expand the tool. Be encouraging and concrete.
Start with "You could explore..." Examples:
- "You could explore deploying this to Vercel so the whole team can access it"
- "You could explore adding an export to PDF/Excel feature"
- "You could explore integrating this with Slack for real-time notifications"
- "You could explore adding user authentication so multiple team members can use it"
Even for qualified submissions — everyone can improve further.

SUBMISSION:
Tool: ${s.tool_name}
Type: ${complexity}${pureText ? ' [POSSIBLE TEXT OUTPUT]' : ''}
Purpose: ${s.purpose}
Problem: ${probIsLinkOnly ? `[URL: ${s.problem}]` : s.problem.substring(0,400)}
How: ${howIsLinkOnly ? `[URL: ${s.how}]` : s.how.substring(0,400)}
Prompt: ${s.prompt.substring(0,1500)}
File: ${s.html_file||'none'}
Deployed: ${s.deployed||'none'}
Demo: ${s.demo||'none'}
Has output: ${hasAnyOutput?'YES':'NO'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])

    // Safety nets
    if (hasAnyOutput && result.html === 'none') {
      result.html = 'partial'
      result.html_reason = 'Has output — bumped from none'
    }
    if (isComplex && result.prompt === 'none' && s.prompt.length > 10) {
      result.prompt = 'partial'
      result.prompt_reason = `${complexity} implies AI usage`
    }
    if (hasAnyOutput && result.verdict === 'not_qualified') {
      result.verdict = 'manual_review'
      result.action = 'Has output — please review manually.'
    }
    const fulls = [result.intent, result.prompt, result.html].filter(x => x === 'full').length
    const nones = [result.intent, result.prompt, result.html].filter(x => x === 'none').length
    if (fulls >= 2 && nones === 0 && !pureText) {
      result.verdict = 'qualified'
      result.action = ''
    }
    if (result.verdict === 'not_qualified' && (!result.action || !result.action.trim())) {
      const missing = []
      if (result.intent === 'none') missing.push('describe the problem your tool solves')
      if (result.prompt === 'none') missing.push('share your AI prompts or conversation')
      if (result.html === 'none') missing.push('upload your working tool or provide a link')
      result.action = `Please ${missing.join(', ')}. Resubmit by 4 June 2026 via https://bit.ly/AstroPersonalAI`
    }

    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
