import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Remove invalid Unicode surrogates that break JSON serialization
function sanitize(str) {
  if (!str) return ''
  return String(str)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]/g, '')
    .replace(/\u0000/g, '')
}

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
      return Response.json({ result: JSON.parse(jsonMatch[0]) })
    }

    const s = body.submission
    if (!s) return Response.json({ error: 'No submission provided' }, { status: 400 })

    // Sanitize all text fields to prevent JSON encoding errors
    s.problem   = sanitize(s.problem)
    s.how       = sanitize(s.how)
    s.prompt    = sanitize(s.prompt)
    s.tool_name = sanitize(s.tool_name)
    s.html_file = sanitize(s.html_file)
    s.deployed  = sanitize(s.deployed)
    s.demo      = sanitize(s.demo)

    // ── Detect submission type ─────────────────────────────
    const howLower = s.how.toLowerCase()
    const toolLower = s.tool_name.toLowerCase()
    const deployedVal = s.deployed

    const isBrowserExtension = howLower.includes('chrome extension') || howLower.includes('browser extension') || howLower.includes('manifest') || howLower.includes('content script') || toolLower.includes('extension')
    const isCLIorAgent = howLower.includes(' cli') || howLower.includes('command line') || howLower.includes('terminal') || howLower.includes('ai agent') || (howLower.includes('automation') && (howLower.includes('android') || howLower.includes('ios') || howLower.includes('test')))
    const isTelegramBot = howLower.includes('telegram') || howLower.includes('discord bot') || howLower.includes('whatsapp bot')
    const isLocalServer = deployedVal.toLowerCase().includes('local') || deployedVal.toLowerCase().includes('localhost') || deployedVal.startsWith('file://')
    const isNonHTMLTool = isBrowserExtension || isCLIorAgent || isTelegramBot
    const hasDemo = !!(s.demo && s.demo.includes('drive.google'))

    const probIsLinkOnly = !!(s.problem && s.problem.trim().startsWith('http') && !s.problem.trim().includes(' '))
    const howIsLinkOnly = !!(s.how && s.how.trim().startsWith('http') && !s.how.trim().includes(' '))

    const hasHtmlFile = s.html_file.includes('drive.google') || (s.html_file.startsWith('http') && !s.html_file.includes('chatgpt') && !s.html_file.includes('claude.ai'))
    const hasDeployed = deployedVal.length > 3 && deployedVal !== '-' && deployedVal.startsWith('http') && !isLocalServer && !['chatgpt.com','suno.com','play.google','claude.ai'].some(x => deployedVal.includes(x))
    const hasDemoOnly = !hasHtmlFile && !hasDeployed && hasDemo
    const needsManualReview = (hasExternalDocs(s) && (hasHtmlFile || hasDeployed || hasDemo)) || (hasDemoOnly && !isNonHTMLTool) || (isLocalServer && hasDemo)

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Output does NOT have to be HTML — CLI tools, browser extensions, bots, automation scripts, and agents are all valid.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"1 sentence max 100 chars","prompt":"full|partial|none","prompt_reason":"1 sentence max 100 chars","html":"full|partial|none","html_reason":"1 sentence max 100 chars","verdict":"qualified|manual_review|not_qualified","summary":"2-3 sentences max 250 chars","action":"specific fix or empty if qualified","ai_score":3,"ai_score_reason":"1 sentence max 100 chars"}

=== INTENT (Clear Intent) ===
full = specific problem stated, even if SHORT — concise is NOT vague
partial = genuinely vague with no specifics
none = empty, just "-", or field contains only a URL${probIsLinkOnly ? '\n⚠️ Problem field is URL-only — score none' : ''}

=== PROMPT (AI Usage Evidence) ===
full = any evidence of real AI usage: good single prompt, link to conversation, numbered steps, summary of interaction, OR complex tool implies iteration
partial = minimal — very generic single line but something exists
none = empty, just "-", zero evidence

=== HTML/APP (Working Output) ===
full = HTML on Drive, real deployed URL, browser extension + demo${isBrowserExtension ? ' ← BROWSER EXTENSION — score full if demo exists' : ''}, CLI/agent tool${isCLIorAgent ? ' ← CLI/AGENT — score full if demo exists' : ''}, bot${isTelegramBot ? ' ← BOT — score full if demo exists' : ''}
partial = local server + demo, demo-only video/screenshot, AppSheet/n8n/Streamlit + demo
none = absolutely nothing

=== VERDICT ===
qualified = 2+ full AND zero none
manual_review = use INSTEAD of not_qualified when: description fields are URL-only but tool exists, demo-only needing verification, local server + demo, tool clearly exists but can't auto-verify
not_qualified = clearly missing critical components

action: "" if qualified; else specific fix + "resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI"
ai_score 1-5: 5=exceptional; 4=good; 3=adequate; 2=simple; 1=barely used

Tool: ${s.tool_name}
Type: ${isBrowserExtension?'Browser Extension':isCLIorAgent?'CLI/Agent':isTelegramBot?'Bot':'Standard'}
Purpose: ${s.purpose}
Problem: ${probIsLinkOnly?`[URL-ONLY: ${s.problem}]`:s.problem.substring(0,300)}
How: ${howIsLinkOnly?`[URL-ONLY: ${s.how}]`:s.how.substring(0,300)}
Prompt: ${s.prompt.substring(0,1200)}
HTML file: ${hasHtmlFile?s.html_file:'NOT UPLOADED'}
Deployed: ${hasDeployed?deployedVal:'none'}
Demo: ${hasDemo?'YES — '+s.demo:'no'}
Local only: ${isLocalServer?'YES':'no'}
Needs manual review: ${needsManualReview?'YES':'no'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])

    // Force manual_review if conditions met
    if (needsManualReview && result.verdict === 'not_qualified') {
      result.verdict = 'manual_review'
      result.action = result.action || 'People team: please review the external document/demo link. If adequate, mark as Qualified. Otherwise mark as Not Qualified and notify submitter to add text descriptions directly in the form.'
    }

    // Force action for not_qualified
    if (result.verdict === 'not_qualified' && (!result.action || result.action.trim() === '')) {
      const missing = []
      if (result.intent !== 'full') missing.push('provide a clear written problem statement')
      if (result.prompt !== 'full') missing.push('show your AI prompts or conversation')
      if (result.html !== 'full') missing.push('upload your tool file or provide a working link/demo')
      result.action = `Please ${missing.join(', ')}. Resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI`
    }

    // Clear action if qualified
    const fulls = [result.intent, result.prompt, result.html].filter(x => x === 'full').length
    const nones = [result.intent, result.prompt, result.html].filter(x => x === 'none').length
    if (fulls >= 2 && nones === 0) result.action = ''

    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function hasExternalDocs(s) {
  const probIsLink = !!(s.problem && s.problem.trim().startsWith('http') && !s.problem.trim().includes(' '))
  const howIsLink = !!(s.how && s.how.trim().startsWith('http') && !s.how.trim().includes(' '))
  return probIsLink || howIsLink
}
