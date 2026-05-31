import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Sanitize: remove chars that break JSON serialization
function sanitize(val) {
  if (!val) return ''
  return String(val)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '') // remove all surrogate chars (safest approach)
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

    // Sanitize all fields
    const problem   = sanitize(s.problem)
    const how       = sanitize(s.how)
    const prompt    = sanitize(s.prompt)
    const tool_name = sanitize(s.tool_name)
    const html_file = sanitize(s.html_file)
    const deployed  = sanitize(s.deployed)
    const demo      = sanitize(s.demo)
    const purpose   = sanitize(s.purpose)

    // Detect submission type
    const howLower  = how.toLowerCase()
    const toolLower = tool_name.toLowerCase()

    const isBrowserExtension = howLower.includes('chrome extension') || howLower.includes('browser extension') || howLower.includes('manifest') || howLower.includes('content script') || toolLower.includes('extension')
    const isCLIorAgent = howLower.includes(' cli') || howLower.includes('command line') || howLower.includes('terminal') || howLower.includes('ai agent') || (howLower.includes('automation') && (howLower.includes('android') || howLower.includes('ios') || howLower.includes('test')))
    const isTelegramBot = howLower.includes('telegram') || howLower.includes('discord bot') || howLower.includes('whatsapp bot')
    const isLocalServer = deployed.toLowerCase().includes('local') || deployed.toLowerCase().includes('localhost') || deployed.startsWith('file://')
    const isNonHTMLTool = isBrowserExtension || isCLIorAgent || isTelegramBot
    const hasDemo = !!(demo && demo.includes('drive.google'))

    const probIsLinkOnly = !!(problem && problem.trim().startsWith('http') && !problem.trim().includes(' '))
    const howIsLinkOnly  = !!(how && how.trim().startsWith('http') && !how.trim().includes(' '))

    const hasHtmlFile = html_file.includes('drive.google') || (html_file.startsWith('http') && !html_file.includes('chatgpt') && !html_file.includes('claude.ai'))
    const hasDeployed = deployed.length > 3 && deployed !== '-' && deployed.startsWith('http') && !isLocalServer && !['chatgpt.com','suno.com','play.google','claude.ai'].some(x => deployed.includes(x))
    const hasDemoOnly = !hasHtmlFile && !hasDeployed && hasDemo

    const needsManualReview =
      ((probIsLinkOnly || howIsLinkOnly) && (hasHtmlFile || hasDeployed || hasDemo)) ||
      (hasDemoOnly && !isNonHTMLTool) ||
      (isLocalServer && hasDemo)

    const prompt_text = `You are evaluating a submission for Astro's Personal AI Challenge.
Output does NOT have to be HTML — CLI tools, browser extensions, bots, scripts, and agents are all valid.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"max 100 chars","prompt":"full|partial|none","prompt_reason":"max 100 chars","html":"full|partial|none","html_reason":"max 100 chars","verdict":"qualified|manual_review|not_qualified","summary":"2-3 sentences max 250 chars","action":"fix instructions or empty string","ai_score":3,"ai_score_reason":"max 100 chars"}

=== INTENT ===
full = specific problem stated, even if short — CONCISE IS NOT VAGUE. "Record operator work time" = full.
partial = genuinely vague, no specifics
none = empty, "-", or URL-only field${probIsLinkOnly ? '\nWARNING: Problem field contains only a URL — score none for intent' : ''}

=== PROMPT (AI Usage Evidence) ===
full = any real AI usage evidence: good prompt, conversation link, numbered steps, OR sophisticated tool implies iteration
partial = minimal but something exists
none = empty, "-", zero evidence of AI use

=== HTML/APP ===
full = HTML on Drive, deployed URL (vercel/railway/streamlit/github.io/script.google.com/netlify), browser extension + demo${isBrowserExtension ? ' [THIS IS AN EXTENSION — score full if demo exists]' : ''}, CLI/agent tool${isCLIorAgent ? ' [THIS IS CLI/AGENT — score full if demo exists]' : ''}, Telegram/Discord bot${isTelegramBot ? ' [THIS IS A BOT — score full if demo exists]' : ''}
partial = local server + demo, demo-only screenshot/video, AppSheet/n8n + demo
none = absolutely nothing — no file, no link, no demo

=== VERDICT ===
qualified = 2+ full AND zero none
manual_review = use INSTEAD of not_qualified when: URL-only description fields but tool exists, demo-only needing verification, local server + demo
not_qualified = clearly missing critical components

action: empty "" if qualified; else specific fix + "resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI"
ai_score 1-5: 5=exceptional; 4=good iteration; 3=adequate; 2=simple; 1=barely used

SUBMISSION:
Tool: ${tool_name}
Type: ${isBrowserExtension?'Browser Extension':isCLIorAgent?'CLI/Agent':isTelegramBot?'Bot':'Standard'}
Purpose: ${purpose}
Problem: ${probIsLinkOnly?`[URL ONLY: ${problem}]`:problem.substring(0,300)}
How it works: ${howIsLinkOnly?`[URL ONLY: ${how}]`:how.substring(0,300)}
Prompt (first 1200 chars): ${prompt.substring(0,1200)}
HTML file: ${hasHtmlFile?html_file:'NOT UPLOADED'}
Deployed: ${hasDeployed?deployed:'none'}
Has demo/screenshot: ${hasDemo?'YES: '+demo:'no'}
Local server only: ${isLocalServer?'YES':'no'}
Needs manual review: ${needsManualReview?'YES':'no'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt_text }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])

    // Force manual_review if flagged and Claude missed it
    if (needsManualReview && result.verdict === 'not_qualified') {
      result.verdict = 'manual_review'
      if (!result.action) result.action = 'People team: please review the external document or demo link. If content is adequate, mark as Qualified. Otherwise mark as Not Qualified and notify submitter to add text descriptions directly in the form fields.'
    }

    // Force action for not_qualified
    if (result.verdict === 'not_qualified' && (!result.action || !result.action.trim())) {
      const missing = []
      if (result.intent !== 'full') missing.push('provide a clear written problem statement')
      if (result.prompt !== 'full') missing.push('show your AI prompts or conversation')
      if (result.html !== 'full') missing.push('upload your tool or provide a working link/demo')
      result.action = `Please ${missing.join(', ')}. Resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI`
    }

    // Force qualified verdict if scores qualify
    const fulls = [result.intent, result.prompt, result.html].filter(x => x === 'full').length
    const nones = [result.intent, result.prompt, result.html].filter(x => x === 'none').length
    if (fulls >= 2 && nones === 0) {
      result.verdict = 'qualified'
      result.action = ''
    }

    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
