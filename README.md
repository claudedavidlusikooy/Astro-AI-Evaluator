# Astro AI Challenge Evaluator

Tool untuk People team evaluate submissions Astro Personal AI Challenge secara otomatis.

## Deploy ke Vercel (step by step)

### Step 1 — Upload ke GitHub
1. Buka github.com → login
2. Klik **"New repository"** (tombol hijau kanan atas)
3. Nama repo: `astro-ai-evaluator` → klik **Create repository**
4. Di halaman repo yang baru dibuat, klik **"uploading an existing file"**
5. Upload **semua file** dari folder ini (drag semua sekaligus)
6. Klik **Commit changes**

### Step 2 — Deploy di Vercel
1. Buka vercel.com → login pakai GitHub
2. Klik **"Add New Project"**
3. Pilih repo `astro-ai-evaluator` → klik **Import**
4. Di bagian **"Environment Variables"**, tambahkan:
   - Key: `ANTHROPIC_API_KEY`
   - Value: (paste API key lo, format: `sk-ant-api03-...`)
5. Klik **Deploy**
6. Tunggu ~2 menit → dapat URL seperti `astro-ai-evaluator.vercel.app`

### Step 3 — Share ke People Team
Share URL-nya ke Amanda dan tim. Done!

## Cara pakai (untuk People team)
1. Buka URL
2. Export CSV dari Google Sheets form responses (File → Download → CSV)
3. Upload CSV ke app
4. Klik **"Evaluate All"**
5. Tunggu ~2 menit
6. Lihat hasil: ✅ Good to Go / ⚠️ Needs Revision / ❌ Incomplete
7. Klik tiap row untuk lihat detail + apa yang perlu diperbaiki
8. Export ke CSV kalau perlu

## Update submissions baru
Kapanpun ada submissions baru masuk → export CSV baru dari GSheets → upload ke app → evaluate lagi.

## Tech stack
- Next.js 14 (App Router)
- Anthropic Claude API (claude-sonnet)
- Deployed on Vercel
