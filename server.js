import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createServer } from 'http'
import { resolve, normalize } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = resolve(__dirname, 'public')
const MAX_BODY_BYTES = 1024 * 1024 // 1MB para JSON admin

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CSP = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' http://localhost:3000 https://tfmcvjwhicvoouhoxzqz.supabase.co https://*.supabase.co https://*.google.com wss://tfmcvjwhicvoouhoxzqz.supabase.co wss://*.supabase.co; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://accounts.google.com;"
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'anacssanamum@gmail.com'

async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Não autorizado' }))
    return
  }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Token inválido' }))
    return
  }
  if (user.email === ADMIN_EMAIL) {
    req.user = user
    next()
    return
  }
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (userData?.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Acesso negado' }))
    return
  }
  req.user = user
  next()
}

function serveFile(res, pathname, contentType) {
  const normalized = normalize(pathname)
  const resolved = resolve(PUBLIC_DIR, normalized.replace(/^\//, ''))
  if (!resolved.startsWith(PUBLIC_DIR) || normalized.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS })
    res.end('Forbidden')
    return
  }
  try {
    const content = readFileSync(resolved)
    const headers = { 'Content-Type': contentType, ...SECURITY_HEADERS }
    if (contentType === 'text/html') headers['Content-Security-Policy'] = CSP
    res.writeHead(200, headers)
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS })
    res.end('Not found')
  }
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      if (body.length + chunk.length > maxBytes) {
        reject(new Error('Payload muito grande'))
        return
      }
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// Rotas da API (url pode conter query string)
async function handleAPI(req, res, url) {
  res.setHeader('Content-Type', 'application/json')
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
  const origin = req.headers.origin
  if (origin && (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000' || origin.endsWith('.supabase.co'))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }

  const parsed = new URL(url || req.url, 'http://localhost')

  // Rota de teste — confirma que o middleware funciona
  if (parsed.pathname === '/admin/api/ping' && req.method === 'GET') {
    return requireAdmin(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, message: 'Admin autenticado!', user: req.user.email }))
    })
  }

  // GET /admin/api/me — usado pela página inicial para mostrar botão Admin só para admin (sem expor email no front)
  if (parsed.pathname === '/admin/api/me' && req.method === 'GET') {
    return requireAdmin(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, isAdmin: true, email: req.user.email }))
    })
  }

  // GET /admin/api/stats
  if (parsed.pathname === '/admin/api/stats' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const [
        { count: totalUsers },
        { count: proUsers },
        { count: totalSessions },
        { data: recentUsers }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('email, name, plan, created_at').order('created_at', { ascending: false }).limit(5)
      ])
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        data: {
          totalUsers: totalUsers ?? 0,
          proUsers: proUsers ?? 0,
          freeUsers: (totalUsers ?? 0) - (proUsers ?? 0),
          totalSessions: totalSessions ?? 0,
          recentUsers: recentUsers ?? []
        }
      }))
    })
  }

  // GET /admin/api/simulados
  if (parsed.pathname === '/admin/api/simulados' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const { data, error } = await supabase
        .from('simulados')
        .select('id, slug, title, is_active, is_premium, passing_score')
        .order('created_at')
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data }))
    })
  }

  // GET /admin/api/exams?simulado_id= — exames de um simulado
  if (parsed.pathname === '/admin/api/exams' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const simuladoId = parsed.searchParams.get('simulado_id')
      if (!simuladoId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'simulado_id obrigatório' }))
      }
      const { data, error } = await supabase.from('exams').select('id, code, name, simulado_id').eq('simulado_id', simuladoId).order('code')
      if (error) {
        res.writeHead(500)
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: data || [] }))
    })
  }

  // GET /admin/api/questoes
  if (parsed.pathname === '/admin/api/questoes' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const page = Math.max(1, parseInt(parsed.searchParams.get('page') || '1', 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(parsed.searchParams.get('limit') || '20', 10) || 20))
      const offset = (page - 1) * limit

      const simuladoId = parsed.searchParams.get('simulado')
      const examCode = parsed.searchParams.get('exam')
      const topic = parsed.searchParams.get('topic')
      const type = parsed.searchParams.get('type')
      const difficulty = parsed.searchParams.get('difficulty')
      const status = parsed.searchParams.get('status')

      let query = supabase
        .from('questions')
        .select(`id, type, question, topic, difficulty, is_active, answer,
          exams!inner(code, simulado_id, simulados!inner(slug, title))`,
          { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (simuladoId) query = query.eq('exams.simulado_id', simuladoId)
      if (examCode) query = query.eq('exams.code', examCode)
      if (topic) {
        const escaped = String(topic).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
        query = query.ilike('topic', `%${escaped}%`)
      }
      if (type) query = query.eq('type', type)
      if (difficulty) query = query.eq('difficulty', difficulty)
      if (status === 'active') query = query.eq('is_active', true)
      if (status === 'inactive') query = query.eq('is_active', false)

      const { data, error, count } = await query
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data, total: count, page, limit }))
    })
  }

  // POST /admin/api/questoes/import — importar JSON em lote
  if (parsed.pathname === '/admin/api/questoes/import' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body
      try { body = await readBody(req) } catch (e) {
        const code = e.message === 'Payload muito grande' ? 413 : 400
        const msg = e.message === 'Payload muito grande' ? e.message : 'JSON inválido'
        res.writeHead(code, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: msg }))
      }
      const simuladoId = body.simulado_id
      let questions = Array.isArray(body.questions) ? body.questions : Array.isArray(body) ? body : null
      if (!questions) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Envie simulado_id e questions (array)' }))
      }
      if (!simuladoId && questions.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'simulado_id obrigatório para importação' }))
      }
      const { data: exams } = await supabase.from('exams').select('id, code').eq('simulado_id', simuladoId)
      const byCode = new Map((exams || []).map(e => [e.code, e.id]))
      const rows = []
      for (const q of questions) {
        const examCode = String(q.exam ?? q.exam_id ?? '').trim()
        const examId = byCode.get(examCode) || (exams && exams[0] ? exams[0].id : null)
        if (!examId) continue
        let answer = []
        if (q.type === 'multiple' && Array.isArray(q.options) && typeof q.correct === 'number') {
          const opt = q.options[q.correct]
          answer = opt != null ? [opt] : ['?']
        } else if ((q.type === 'text' || !q.type) && (q.answer != null || q.resposta != null)) {
          const a = q.answer ?? q.resposta
          answer = Array.isArray(a) ? a.filter(Boolean) : [String(a)]
          if (answer.length === 0) answer = ['?']
        } else {
          answer = ['?']
        }
        rows.push({
          exam_id: examId,
          type: q.type === 'text' ? 'text' : 'multiple',
          question: String(q.question ?? ''),
          options: Array.isArray(q.options) ? q.options : null,
          answer,
          topic: q.topic ? String(q.topic) : null,
          difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
          hint: q.hint ? String(q.hint) : null,
          is_active: true
        })
      }
      if (rows.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Nenhuma questão válida para importar' }))
      }
      const { error } = await supabase.from('questions').insert(rows)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, imported: rows.length }))
    })
  }

  // POST /admin/api/questoes — whitelist de colunas (evita mass assignment)
  if (parsed.pathname === '/admin/api/questoes' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body = ''
      req.on('data', chunk => {
        if (body === null) return
        if (body.length + chunk.length > MAX_BODY_BYTES) {
          body = null
          return
        }
        body += chunk
      })
      req.on('end', async () => {
        if (body === null) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Payload muito grande' }))
        }
        try {
          const q = JSON.parse(body || '{}')
          const allowed = ['exam_id', 'type', 'question', 'options', 'answer', 'topic', 'difficulty', 'hint', 'is_active']
          const row = {}
          for (const k of allowed) {
            if (q[k] !== undefined) row[k] = q[k]
          }
          if (!row.exam_id) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: 'exam_id obrigatório' }))
          }
          const { error } = await supabase.from('questions').insert(row)
          if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: error.message }))
          }
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
        }
      })
    })
  }

  // PUT /admin/api/questoes/:id — whitelist de colunas (evita mass assignment)
  if (parsed.pathname.match(/^\/admin\/api\/questoes\/[\w-]+$/) && req.method === 'PUT') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      let body = ''
      req.on('data', chunk => {
        if (body === null) return
        if (body.length + chunk.length > MAX_BODY_BYTES) {
          body = null
          return
        }
        body += chunk
      })
      req.on('end', async () => {
        if (body === null) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Payload muito grande' }))
        }
        try {
          const q = JSON.parse(body || '{}')
          const allowed = ['exam_id', 'type', 'question', 'options', 'answer', 'topic', 'difficulty', 'hint', 'is_active']
          const row = {}
          for (const k of allowed) {
            if (q[k] !== undefined) row[k] = q[k]
          }
          if (Object.keys(row).length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: true }))
          }
          const { error } = await supabase.from('questions').update(row).eq('id', id)
          if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: error.message }))
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
        }
      })
    })
  }

  // DELETE /admin/api/questoes/:id
  if (parsed.pathname.match(/^\/admin\/api\/questoes\/[\w-]+$/) && req.method === 'DELETE') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      const hard = parsed.searchParams.get('hard') === 'true'
      let error
      if (hard) {
        ({ error } = await supabase.from('questions').delete().eq('id', id))
      } else {
        ({ error } = await supabase.from('questions').update({ is_active: false }).eq('id', id))
      }
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // GET /api/simulados
  if (parsed.pathname === '/api/simulados') {
    const { data, error } = await supabase
      .from('simulados')
      .select('*')
      .eq('is_active', true)

    if (error) {
      res.writeHead(500)
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200)
    return res.end(JSON.stringify({ success: true, data }))
  }

  // GET /api/simulados/lpic1/questions?exam=101
  const questionsMatch = parsed.pathname.match(/^\/api\/simulados\/(\w+)\/questions\/?$/)
  if (questionsMatch) {
    const slug = questionsMatch[1]
    const examCode = parsed.searchParams.get('exam')

    // Buscar exam_id
    const { data: simulado } = await supabase
      .from('simulados')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!simulado) {
      res.writeHead(404)
      return res.end(JSON.stringify({ success: false, error: 'Simulado não encontrado' }))
    }

    let query = supabase
      .from('questions')
      .select(`
        id, type, question, options, answer, topic, difficulty, hint, weight,
        exams!inner(code, simulado_id)
      `)
      .eq('exams.simulado_id', simulado.id)
      .eq('is_active', true)

    if (examCode && examCode !== 'mixed') {
      query = query.eq('exams.code', examCode)
    }

    const { data: questions, error } = await query

    if (error) {
      res.writeHead(500)
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200)
    return res.end(JSON.stringify({ success: true, data: questions }))
  }

  res.writeHead(404)
  res.end(JSON.stringify({ success: false, error: 'Rota não encontrada' }))
}

// Servidor principal
const server = createServer(async (req, res) => {
  const fullUrl = req.url
  const pathname = fullUrl.split('?')[0]

  // Rotas da API (inclui /admin/api/*): usar URL completa para preservar query string
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin/api/')) {
    return handleAPI(req, res, fullUrl)
  }

  // Arquivos estáticos: pathname validado (sem path traversal)
  if (pathname === '/' || pathname === '/index.html') return serveFile(res, 'index.html', 'text/html')
  if (pathname.endsWith('.html')) return serveFile(res, pathname.slice(1), 'text/html')
  if (pathname.endsWith('.css')) return serveFile(res, pathname.slice(1), 'text/css')
  if (pathname.startsWith('/js/')) return serveFile(res, pathname.slice(1), 'application/javascript')
  if (pathname.endsWith('.js')) return serveFile(res, pathname.slice(1), 'application/javascript')

  res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS })
  res.end('Not found')
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`✅ LinuxGeek rodando em http://localhost:${PORT}`)
})