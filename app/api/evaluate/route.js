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
      return Response.json({ result: JSON.parse(jsonMatch[0]) })
    }

    const s = body.submission
    if (!s) return Response.json({ error: 'No submission provided' }, { status: 400 })

    // ── Detect submission type ─────────────────────────────
    const howLower = (s.how||'').toLowerCase()
    const toolLower = (s.tool_name||'').toLowerCase()
    const deployedVal = (s.deployed||'')

    const isBrowserExtension = howLower.includes('chrome extension') || howLower.includes('browser extension') || howLower.includes('manifest') || howLower.includes('content script') || toolLower.includes('extension')
    const isCLIorAgent = howLower.includes(' cli') || howLower.includes('command line') || howLower.includes('terminal') || howLower.includes('ai agent') || howLower.includes('automation test') || howLower.includes('android') || howLower.includes('ios') && howLower.includes('test')
    const isTelegramBot = howLower.includes('telegram') || howLower.includes('discord bot') || howLower.includes('whatsapp bot')
    const isLocalServer = deployedVal.toLowerCase().includes('local') || deployedVal.toLowerCase().includes('localhost') || deployedVal.startsWith('file://')
    const isNonHTMLTool = isBrowserExtension || isCLIorAgent || isTelegramBot
    const hasDemo = !!(s.demo && s.demo.includes('drive.google'))

    // Detect if problem/how fields are link-only (Otniel/Benny case)
    const probIsLinkOnly = !!(s.problem && s.problem.trim().startsWith('http') && !s.problem.trim().includes(' '))
    const howIsLinkOnly = !!(s.how && s.how.trim().startsWith('http') && !s.how.trim().includes(' '))
    const hasExternalDocs = probIsLinkOnly || howIsLinkOnly

    // Detect HTML/app submission
    const hasHtmlFile = (s.html_file||'').includes('drive.google') ||
      ((s.html_file||'').startsWith('http') && !(s.html_file||'').includes('chatgpt') && !(s.html_file||'').includes('claude.ai'))
    const hasDeployed = (deployedVal).length > 3 && deployedVal !== '-' &&
      deployedVal.startsWith('http') && !isLocalServer &&
      !['chatgpt.com','suno.com','play.google','claude.ai'].some(x => deployedVal.includes(x))
    const hasWorkingSubmission = hasHtmlFile || hasDeployed || (isNonHTMLTool && hasDemo)
    const hasDemoOnly = !hasHtmlFile && !hasDeployed && hasDemo

    // ── Manual review trigger ──────────────────────────────
    // Flag for manual review instead of auto not-qualified when there's evidence
    // but it can't be auto-verified
    const needsManualReview = (hasExternalDocs && hasWorkingSubmission) ||
      (hasDemoOnly && !isNonHTMLTool) ||
      (isLocalServer && hasDemo)

    const prompt = `You are evaluating a submission for Astro's Personal AI Challenge.
Employees must build an AI-powered tool. Output does NOT have to be HTML — CLI tools, browser extensions, bots, automation scripts, and agents are all valid.

Return ONLY valid JSON, no markdown:
{"intent":"full|partial|none","intent_reason":"1 sentence max 100 chars","prompt":"full|partial|none","prompt_reason":"1 sentence max 100 chars","html":"full|partial|none","html_reason":"1 sentence max 100 chars","verdict":"qualified|manual_review|not_qualified","summary":"2-3 sentences max 250 chars","action":"specific fix or empty if qualified","ai_score":3,"ai_score_reason":"1 sentence max 100 chars"}

=== INTENT SCORING (Clear Intent) ===
full = clearly states a specific problem, even if SHORT — concise is NOT vague. "Record work time of operator" = full. "Fuzzing and vulnerability analysis" = full.
partial = genuinely vague or generic with no specifics
none = literally empty, just "-", or field contains ONLY a URL link with no text${probIsLinkOnly ? '\n⚠️ Problem field is URL-only — score none for intent, flag for manual review' : ''}

=== PROMPT SCORING (AI Usage Evidence) ===
full = ANY evidence of real AI usage: good single prompt, numbered steps, conversation link (claude.ai/share, chatgpt share), summary of AI interaction, OR tool complexity implies iteration
partial = minimal evidence — very generic single line but something is there
none = literally empty, just "-", no evidence of AI usage at all
IMPORTANT: Short prompts are OK if clear. Cross-reference with tool complexity — sophisticated deployed tool implies real AI usage even if prompt is brief.${howIsLinkOnly ? '\n⚠️ How it works field is URL-only' : ''}

=== HTML/APP SCORING (Working Output) ===
full = ANY of:
  - HTML file on Google Drive
  - Real deployed URL (vercel/github.io/railway/streamlit/script.google.com/netlify/etc)
  - Browser extension with demo evidence${isBrowserExtension ? ' ← THIS IS A BROWSER EXTENSION — score full if demo exists' : ''}
  - CLI tool / AI agent (by nature cannot be deployed as HTML)${isCLIorAgent ? ' ← THIS IS A CLI/AGENT TOOL — score full if demo exists' : ''}
  - Telegram/Discord/WhatsApp bot${isTelegramBot ? ' ← THIS IS A BOT — score full if demo exists' : ''}
partial = local server with demo, OR demo-only (video/screenshot) without deployed URL, OR Streamlit/AppSheet/n8n with demo
none = absolutely nothing — no file, no link, no demo

=== VERDICT ===
qualified = 2+ "full" AND zero "none"
manual_review = use this INSTEAD of not_qualified when: (1) description fields contain only URLs but tool exists, (2) demo-only submission needing human verification, (3) local server tool with demo, (4) any case where tool likely works but cannot be auto-verified
not_qualified = clearly missing critical components, no evidence of working tool

action:
- qualified: empty string ""
- manual_review: explain what People team should verify and what submitter should add if not passing
- not_qualified: specific fix instructions, resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI

ai_score 1-5: 5=exceptional; 4=good iteration+deployed; 3=adequate; 2=simple; 1=barely used

SUBMISSION CONTEXT:
Tool: ${s.tool_name}
Type detected: ${isBrowserExtension?'Browser Extension':isCLIorAgent?'CLI/Agent Tool':isTelegramBot?'Bot':isNonHTMLTool?'Non-HTML Tool':'Standard'}
Purpose: ${s.purpose}
Problem: ${probIsLinkOnly?`[URL-ONLY: ${s.problem}]`:(s.problem||'').substring(0,300)}
How it works: ${howIsLinkOnly?`[URL-ONLY: ${s.how}]`:(s.how||'').substring(0,300)}
Prompt: ${(s.prompt||'').substring(0,1200)}
HTML file: ${hasHtmlFile?s.html_file:'NOT UPLOADED'}
Deployed: ${hasDeployed?deployedVal:'none'}
Has demo/screenshot: ${hasDemo?'YES — '+s.demo:'no'}
Local server only: ${isLocalServer?'YES':'no'}
Needs manual review: ${needsManualReview?'YES — human verification needed':'no'}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')
    const result = JSON.parse(jsonMatch[0])

    // Safety nets
    const fulls = [result.intent,result.prompt,result.html].filter(x=>x==='full').length
    const nones = [result.intent,result.prompt,result.html].filter(x=>x==='none').length
    const isQualified = fulls>=2 && nones===0

    // Force manual_review if conditions met and Claude missed it
    if (needsManualReview && result.verdict==='not_qualified') {
      result.verdict = 'manual_review'
      result.action = result.action || 'People team: please review the external document/demo link submitted. If content is adequate, mark as Qualified. If not, mark as Not Qualified and notify submitter to provide text descriptions in the form fields directly.'
    }

    // Force action for not_qualified
    if (result.verdict==='not_qualified' && (!result.action || result.action.trim()==='')) {
      const missing=[]
      if(result.intent!=='full') missing.push('provide a clear written problem statement')
      if(result.prompt!=='full') missing.push('show your AI prompts or conversation')
      if(result.html!=='full') missing.push('upload your tool file or provide a working link/demo')
      result.action=`Please ${missing.join(', ')}. Resubmit by 1 June 2026 via https://bit.ly/AstroPersonalAI`
    }

    // Clear action if qualified
    if (isQualified) result.action = ''

    return Response.json({ result })
  } catch (err) {
    console.error('Evaluate error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
