'use client'
import { useState, useRef, useCallback } from 'react'

// ── CSV Parser ──────────────────────────────────────────────
function parseCSV(txt) {
  const rows = []
  let line = [], field = '', inQ = false
  for (let i = 0; i <= txt.length; i++) {
    const ch = txt[i]
    if (i === txt.length || (ch === '\n' && !inQ)) {
      line.push(field); field = ''
      if (line.some(f => f.trim())) rows.push(line)
      line = []
    } else if (ch === '"') {
      if (inQ && txt[i+1] === '"') { field += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) { line.push(field); field = '' }
    else if (ch !== '\r') field += ch
  }
  if (!rows.length) return []
  const hdrs = rows[0].map(h => h.trim())
  return rows.slice(1).map(r => {
    const o = {}
    hdrs.forEach((h, i) => o[h] = (r[i] || '').trim())
    return o
  })
}

function pick(row, ...keys) {
  for (const k of keys) {
    const found = Object.keys(row).find(h => h.toLowerCase().includes(k.toLowerCase()))
    if (found && row[found]) return row[found]
  }
  return ''
}

function mapRow(row) {
  return {
    timestamp: pick(row,'timestamp','time'),
    email:     pick(row,'email'),
    dept:      pick(row,'function','team','dept','divisi'),
    purpose:   pick(row,'purpose','tujuan'),
    tool_name: pick(row,'tool name','tool_name','nama tool','nama aplikasi'),
    problem:   pick(row,'problem','solve','masalah','kendala'),
    how:       pick(row,'how does it work','how it works','cara kerja','brief description'),
    prompt:    pick(row,'prompt','copy paste'),
    html_file: pick(row,'upload','html file','ai submission'),
    demo:      pick(row,'demo','screenshot','documentation'),
    deployed:  pick(row,'deployed','share your ai submission link'),
  }
}

function hasHtml(s) {
  const h = s.html_file || ''
  return h.length > 4 && (h.includes('drive.google') || (h.startsWith('http') && !h.includes('chatgpt') && !h.includes('claude.ai')))
}
function hasDeployed(s) {
  const d = s.deployed || ''
  return d.length > 3 && d !== '-' && d.startsWith('http') && !d.startsWith('file://') && !['chatgpt.com','suno.com','play.google','claude.ai'].some(x => d.includes(x))
}
function getName(email) {
  return (email || '').split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Styles ─────────────────────────────────────────────────
const S = {
  header: { background: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)', color: 'white', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: 600, margin: 0 },
  hsub: { fontSize: 12, opacity: 0.6, marginTop: 3 },
  setupWrap: { maxWidth: 620, margin: '48px auto', padding: '0 24px' },
  card: { background: 'white', borderRadius: 14, border: '1px solid #e4e9f0', padding: 32 },
  cardTitle: { fontSize: 17, fontWeight: 600, marginBottom: 6 },
  cardSub: { fontSize: 13, color: '#777', marginBottom: 28 },
  step: { display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: '50%', background: '#0f3460', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  stepBody: { flex: 1 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 },
  hint: { fontSize: 11, color: '#aaa', marginTop: 5 },
  input: { width: '100%', border: '1px solid #dde3ec', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: 'white' },
  dropZone: (drag) => ({ border: `2px dashed ${drag ? '#0f3460' : '#d0d9e8'}`, borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', background: drag ? '#f0f4fa' : '#fafbfd', transition: 'all 0.2s' }),
  dropIcon: { fontSize: 28, marginBottom: 8 },
  dropText: { fontSize: 13, color: '#777', margin: 0 },
  fileName: { fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 6 },
  btnPrimary: (disabled) => ({ padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', background: '#0f3460', color: 'white', opacity: disabled ? 0.4 : 1, width: '100%', marginTop: 4, transition: 'all 0.15s' }),
  btnSmall: { padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 7, cursor: 'pointer', border: '1px solid #dde3ec', background: 'white', color: '#444' },
  toolbar: { background: 'white', borderBottom: '1px solid #e4e9f0', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statsBar: { display: 'flex', gap: 10, padding: '16px 28px', flexWrap: 'wrap' },
  statCard: { background: 'white', border: '1px solid #e4e9f0', borderRadius: 10, padding: '12px 18px', textAlign: 'center', minWidth: 110 },
  statNum: (color) => ({ fontSize: 26, fontWeight: 700, color }),
  statLbl: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  mainBody: { padding: '0 28px 40px' },
  filterRow: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', padding: '14px 0 10px' },
  filterBtn: (active) => ({ border: `1px solid ${active ? '#0f3460' : '#dde3ec'}`, background: active ? '#0f3460' : 'white', padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: active ? 'white' : '#666' }),
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e4e9f0', fontSize: 13 },
  th: { padding: '9px 13px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#aaa', borderBottom: '1px solid #e4e9f0', whiteSpace: 'nowrap', background: '#f7f9fc' },
  td: { padding: '10px 13px', borderBottom: '1px solid #f0f4f8', verticalAlign: 'middle' },
  logWrap: { background: 'white', border: '1px solid #e4e9f0', borderRadius: 10, padding: '14px 16px', marginBottom: 14 },
  log: { maxHeight: 110, overflowY: 'auto', fontSize: 11, color: '#555', fontFamily: 'monospace', background: '#f7f9fc', borderRadius: 6, padding: 8, lineHeight: 1.65, whiteSpace: 'pre-wrap' },
  progBg: { background: '#e4e9f0', borderRadius: 10, height: 6, width: 180 },
  progFg: (pct) => ({ background: '#0f3460', borderRadius: 10, height: 6, width: `${pct}%`, transition: 'width 0.3s' }),
  resetBtn: { background: 'none', border: 'none', fontSize: 12, color: '#0f3460', cursor: 'pointer', textDecoration: 'underline' },
  detailWrap: { background: '#f7faff', padding: '14px 13px 18px' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
  dCard: { background: 'white', border: '1px solid #e4e9f0', borderRadius: 8, padding: '10px 12px' },
  dCardTitle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#bbb', marginBottom: 6 },
  dReason: { fontSize: 12, color: '#555', lineHeight: 1.45, marginTop: 5 },
  dSummary: { background: 'white', border: '1px solid #e4e9f0', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: '#444', lineHeight: 1.5, marginBottom: 8 },
  dAction: { background: '#fff8ee', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: '#92400e', lineHeight: 1.5, marginBottom: 8 },
  dLinks: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  dLink: { fontSize: 11, color: '#0f3460', textDecoration: 'none' },
}

const BADGE = {
  good:    { background: '#dcfce7', color: '#15803d', label: '✅ Good to Go' },
  review:  { background: '#fef3c7', color: '#92400e', label: '⚠️ Needs Revision' },
  fail:    { background: '#fee2e2', color: '#991b1b', label: '❌ Incomplete' },
  pending: { background: '#f1f5f9', color: '#64748b', label: 'Pending' },
}
const SCORE_COLORS = {
  full:    { background: '#dcfce7', color: '#166534', icon: '✓' },
  partial: { background: '#fef3c7', color: '#854d0e', icon: '~' },
  none:    { background: '#fee2e2', color: '#991b1b', icon: '✗' },
}

function Badge({ verdict }) {
  const b = BADGE[verdict] || BADGE.pending
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: b.background, color: b.color }}>{b.label}</span>
}
function ScorePill({ score, label }) {
  const c = SCORE_COLORS[score] || SCORE_COLORS.none
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, margin: 1, background: c.background, color: c.color }}>{c.icon} {label}</span>
}
function ScoreLabel({ score }) {
  const c = SCORE_COLORS[score] || SCORE_COLORS.none
  const labels = { full: 'Fully Demonstrated', partial: 'Partially Demonstrated', none: 'Not Demonstrated' }
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c.background, color: c.color }}>{labels[score] || '—'}</span>
}

// ── Main Component ──────────────────────────────────────────
export default function Home() {
  const [screen, setScreen] = useState('setup') // setup | main
  const [subs, setSubs] = useState([])
  const [results, setResults] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [drag, setDrag] = useState(false)
  const [fileName, setFileName] = useState('')
  const [csvRaw, setCsvRaw] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [logs, setLogs] = useState([])
  const [showLog, setShowLog] = useState(false)
  const [expandedRows, setExpandedRows] = useState({})
  const fileRef = useRef()
  const logRef = useRef()

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, msg])
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 50)
  }, [])

  function handleFileRead(file) {
    if (!file || !file.name.endsWith('.csv')) return
    const reader = new FileReader()
    reader.onload = e => { setCsvRaw(e.target.result); setFileName(file.name) }
    reader.readAsText(file)
  }

  function initApp() {
    const rows = parseCSV(csvRaw)
    const mapped = rows.map(mapRow).filter(s => s.email && s.tool_name)
    setSubs(mapped)
    setResults(new Array(mapped.length).fill(null))
    setScreen('main')
    setLogs([])
    setShowLog(false)
    setExpandedRows({})
  }

  function resetApp() {
    setCsvRaw(null); setFileName(''); setSubs([]); setResults([])
    setLogs([]); setShowLog(false); setScreen('setup')
  }

  async function runEval() {
    if (running) return
    setRunning(true)
    setShowLog(true)
    setLogs([])
    const newRes = new Array(subs.length).fill(null)
    setResults([...newRes])
    let done = 0

    for (let i = 0; i < subs.length; i += 3) {
      const batch = subs.slice(i, Math.min(i+3, subs.length))
      await Promise.all(batch.map(async (s, bi) => {
        const idx = i + bi
        addLog(`[${idx+1}/${subs.length}] ${s.tool_name.substring(0,45)}…`)
        try {
          const resp = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission: s })
          })
          const data = await resp.json()
          if (data.error) throw new Error(data.error)
          newRes[idx] = data.result
          const icon = data.result.overall === 'good' ? '✅' : data.result.overall === 'review' ? '⚠️' : '❌'
          addLog(`  ${icon} ${data.result.overall.toUpperCase()}`)
        } catch(e) {
          newRes[idx] = { intent:'none', intent_reason:'Error', prompt:'none', prompt_reason:'Error', html:'none', html_reason:'Error', overall:'fail', summary:'Evaluation error: '+e.message, action:'' }
          addLog(`  ⚠️ Error: ${e.message}`)
        }
        done++
        setProgress({ done, total: subs.length })
        setResults([...newRes])
      }))
      if (i+3 < subs.length) await sleep(300)
    }
    setRunning(false)
    addLog('\n✅ Selesai!')
  }

  // Stats
  const counts = results.reduce((acc, r) => {
    if (!r) acc.pending++
    else acc[r.overall] = (acc[r.overall] || 0) + 1
    return acc
  }, { good: 0, review: 0, fail: 0, pending: 0 })

  // Filter + search
  const visible = subs.filter((s, i) => {
    const r = results[i]
    const verdict = r ? r.overall : 'pending'
    if (filter !== 'all' && verdict !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (getName(s.email)+s.email+s.dept+s.tool_name).toLowerCase().includes(q)
    }
    return true
  })

  function toggleRow(i) {
    setExpandedRows(prev => ({ ...prev, [i]: !prev[i] }))
  }

  function doExport() {
    const hdrs = ['#','Email','Name','Function','Tool Name','Purpose','HTML','Deployed','Verdict','Intent','Prompt','HTML Score','Intent Reason','Prompt Reason','HTML Reason','Summary','Action Required']
    const rows = subs.map((s, i) => {
      const r = results[i]
      return [i+1,s.email,getName(s.email),s.dept,s.tool_name,s.purpose,hasHtml(s)?'Yes':'No',hasDeployed(s)?'Yes':'No',r?r.overall:'pending',r?r.intent:'',r?r.prompt:'',r?r.html:'',r?r.intent_reason:'',r?r.prompt_reason:'',r?r.html_reason:'',r?r.summary:'',r?r.action:''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')
    })
    const blob = new Blob([[hdrs.join(','),...rows].join('\n')], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'astro_ai_challenge_results.csv'
    a.click()
  }

  // ── Setup Screen ────────────────────────────────────────
  if (screen === 'setup') return (
    <div>
      <div style={S.header}>
        <div><h1 style={S.h1}>Astro Personal AI Challenge</h1><p style={S.hsub}>Submission Evaluator · People Team</p></div>
      </div>
      <div style={S.setupWrap}>
        <div style={S.card}>
          <h2 style={S.cardTitle}>Upload Submissions</h2>
          <p style={S.cardSub}>Upload CSV dari Google Sheets form responses, lalu Claude akan evaluate semua submissions secara otomatis.</p>

          <div style={S.step}>
            <div style={S.stepNum}>1</div>
            <div style={S.stepBody}>
              <label style={S.label}>Upload CSV Google Sheets Responses</label>
              <div
                style={S.dropZone(drag)}
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFileRead(e.dataTransfer.files[0]) }}
              >
                <div style={S.dropIcon}>📄</div>
                <p style={S.dropText}><strong style={{color:'#0f3460'}}>Klik untuk pilih file</strong> atau drag & drop</p>
                <p style={S.dropText}>Export dari GSheets: File → Download → CSV</p>
                {fileName && <div style={S.fileName}>✅ {fileName}</div>}
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={e => handleFileRead(e.target.files[0])} />
              <p style={S.hint}>Kapanpun ada submissions baru, export CSV lagi dan upload ulang</p>
            </div>
          </div>

          <button style={S.btnPrimary(!csvRaw)} onClick={csvRaw ? initApp : null} disabled={!csvRaw}>
            Load Submissions →
          </button>
          <p style={{fontSize:11,color:'#ccc',textAlign:'center',marginTop:10}}>~1–2 menit untuk 50 submissions · Bisa dipakai berulang kali</p>
        </div>
      </div>
    </div>
  )

  // ── Main Screen ─────────────────────────────────────────
  return (
    <div>
      <div style={S.header}>
        <div><h1 style={S.h1}>Astro Personal AI Challenge</h1><p style={S.hsub}>Submission Evaluator · People Team</p></div>
        <span style={{fontSize:12,opacity:.7}}>{subs.length} submissions loaded</span>
      </div>

      <div style={S.toolbar}>
        <button style={{...S.btnPrimary(running), width:'auto', marginTop:0, padding:'8px 18px'}} onClick={runEval} disabled={running}>
          {running ? '⏳ Evaluating…' : '▶ Evaluate All'}
        </button>
        {running && (
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={S.progBg}><div style={S.progFg(Math.round(progress.done/progress.total*100))}></div></div>
            <span style={{fontSize:12,color:'#888'}}>{progress.done}/{progress.total}</span>
          </div>
        )}
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input type="text" placeholder="Cari nama, email, function…" style={{...S.input, width:200}} value={search} onChange={e=>setSearch(e.target.value)} />
          <button style={S.btnSmall} onClick={doExport}>Export CSV</button>
          <button style={S.resetBtn} onClick={resetApp}>↩ Ganti CSV</button>
        </div>
      </div>

      <div style={S.statsBar}>
        {[
          { key:'total', label:'Total', val: subs.length, color:'#0f3460' },
          { key:'good', label:'Good to Go ✅', val: counts.good||'—', color:'#16a34a' },
          { key:'review', label:'Needs Revision ⚠️', val: counts.review||'—', color:'#d97706' },
          { key:'fail', label:'Incomplete ❌', val: counts.fail||'—', color:'#dc2626' },
          { key:'pending', label:'Pending', val: counts.pending, color:'#94a3b8' },
        ].map(s => (
          <div key={s.key} style={S.statCard}>
            <div style={S.statNum(s.color)}>{s.val}</div>
            <div style={S.statLbl}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={S.mainBody}>
        {showLog && (
          <div style={S.logWrap}>
            <h4 style={{fontSize:12,fontWeight:600,marginBottom:8}}>{running ? 'Evaluating submissions…' : '✅ Evaluation selesai!'}</h4>
            <div ref={logRef} style={S.log}>{logs.join('\n')}</div>
          </div>
        )}

        <div style={S.filterRow}>
          <span style={{fontSize:12,color:'#bbb',marginRight:2}}>Filter:</span>
          {[
            { val:'all', label:'Semua' },
            { val:'good', label:`✅ Good to Go (${counts.good})` },
            { val:'review', label:`⚠️ Needs Revision (${counts.review})` },
            { val:'fail', label:`❌ Incomplete (${counts.fail})` },
            { val:'pending', label:`⏳ Pending (${counts.pending})` },
          ].map(f => (
            <button key={f.val} style={S.filterBtn(filter===f.val)} onClick={()=>setFilter(f.val)}>{f.label}</button>
          ))}
        </div>

        <table style={S.table}>
          <thead>
            <tr>
              {['#','Submitter','Function','Tool Name','Purpose','HTML','Deployed','Verdict','Scores',''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={10} style={{textAlign:'center',padding:36,color:'#bbb',fontSize:13}}>Tidak ada data yang cocok.</td></tr>
            )}
            {visible.map((s, vi) => {
              const i = subs.indexOf(s)
              const r = results[i]
              const verdict = r ? r.overall : 'pending'
              const expanded = expandedRows[i]
              const name = getName(s.email)
              return [
                <tr key={`row-${i}`} style={{cursor:'pointer'}} onClick={()=>toggleRow(i)}>
                  <td style={{...S.td,color:'#ccc',fontSize:12}}>{i+1}</td>
                  <td style={S.td}>
                    <div style={{fontWeight:500,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
                    <div style={{color:'#aaa',fontSize:11}}>{s.email}</div>
                  </td>
                  <td style={{...S.td,fontSize:12,color:'#888',whiteSpace:'nowrap'}}>{s.dept}</td>
                  <td style={S.td}><div style={{maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12}} title={s.tool_name}>{s.tool_name}</div></td>
                  <td style={S.td}><span style={{background:'#f0f4f8',color:'#777',fontSize:10,padding:'3px 8px',borderRadius:10,fontWeight:600}}>{s.purpose||'—'}</span></td>
                  <td style={S.td}>
                    {hasHtml(s)
                      ? <a href={s.html_file} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:'#0f3460'}}>Drive ↗</a>
                      : <span style={{color:'#ddd',fontSize:11}}>—</span>}
                  </td>
                  <td style={S.td}>
                    {hasDeployed(s)
                      ? <a href={s.deployed} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:'#16a34a'}}>✅ Live</a>
                      : <span style={{color:'#ddd',fontSize:11}}>—</span>}
                  </td>
                  <td style={S.td}><Badge verdict={verdict} /></td>
                  <td style={S.td}>
                    {r ? (
                      <div>
                        <ScorePill score={r.intent} label="Intent" />
                        <ScorePill score={r.prompt} label="Prompt" />
                        <ScorePill score={r.html} label="HTML" />
                      </div>
                    ) : <span style={{color:'#ddd',fontSize:11}}>—</span>}
                  </td>
                  <td style={S.td}><span style={{fontSize:11,color:'#0f3460'}}>{expanded ? '▲' : '▼'}</span></td>
                </tr>,
                expanded && (
                  <tr key={`detail-${i}`}>
                    <td colSpan={10} style={S.detailWrap}>
                      <div style={S.detailGrid}>
                        {[
                          { label:'Clear Intent', sk:'intent', rk:'intent_reason' },
                          { label:'Multi-Conversation Prompt', sk:'prompt', rk:'prompt_reason' },
                          { label:'Working HTML', sk:'html', rk:'html_reason' },
                        ].map(c => (
                          <div key={c.sk} style={S.dCard}>
                            <div style={S.dCardTitle}>{c.label}</div>
                            {r ? <ScoreLabel score={r[c.sk]} /> : <span style={{fontSize:12,color:'#ccc'}}>Not evaluated</span>}
                            <div style={S.dReason}>{r ? r[c.rk] : '—'}</div>
                          </div>
                        ))}
                      </div>
                      {r?.summary && <div style={S.dSummary}><strong>Overall:</strong> {r.summary}</div>}
                      {r?.action && r.overall !== 'good' && (
                        <div style={S.dAction}><strong>🔧 Yang perlu diperbaiki:</strong> {r.action}</div>
                      )}
                      <div style={S.dLinks}>
                        {hasHtml(s) && <a href={s.html_file} target="_blank" rel="noreferrer" style={S.dLink}>📁 HTML File</a>}
                        {hasDeployed(s) && <a href={s.deployed} target="_blank" rel="noreferrer" style={S.dLink}>🚀 Deployed App</a>}
                        {s.demo?.startsWith('http') && <a href={s.demo} target="_blank" rel="noreferrer" style={S.dLink}>📸 Demo</a>}
                      </div>
                      {s.problem && <div style={{marginTop:8,fontSize:11,color:'#aaa',lineHeight:1.5}}><strong style={{color:'#888'}}>Problem stated:</strong> {s.problem.substring(0,220)}{s.problem.length>220?'…':''}</div>}
                    </td>
                  </tr>
                )
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
