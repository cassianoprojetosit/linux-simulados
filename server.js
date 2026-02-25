import { createClient } from '@supabase/supabase-js'
import { createClient as createRedisClient } from 'redis'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { createServer } from 'http'
import { resolve, normalize } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = resolve(__dirname, 'public')
const UPLOADS_ARTIGOS_DIR = resolve(PUBLIC_DIR, 'uploads', 'artigos')
const UPLOADS_LINKS_DIR = resolve(PUBLIC_DIR, 'uploads', 'links')
const MAX_BODY_BYTES = 1024 * 1024 // 1MB para JSON admin
const MAX_IMAGE_UPLOAD_BYTES = 200 * 1024 // 200KB por imagem (servidor free)

if (!existsSync(UPLOADS_ARTIGOS_DIR)) mkdirSync(UPLOADS_ARTIGOS_DIR, { recursive: true })
if (!existsSync(UPLOADS_LINKS_DIR)) mkdirSync(UPLOADS_LINKS_DIR, { recursive: true })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

const CSP = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 https://*.supabase.co https://*.google.com https://accounts.google.com https://www.googleapis.com wss://*.supabase.co; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://accounts.google.com;"
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

// CORS: em produção defina ALLOWED_ORIGINS (origens separadas por vírgula). Ex.: https://seusite.com,https://www.seusite.com
const ALLOWED_ORIGINS_RAW = process.env.ALLOWED_ORIGINS || ''
const ALLOWED_ORIGINS_LIST = ALLOWED_ORIGINS_RAW ? ALLOWED_ORIGINS_RAW.split(',').map((o) => o.trim()).filter(Boolean) : null

// Rate limiting: requisições por IP por janela (1 minuto). Limites: admin API 40/min; demais APIs 120/min.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_ADMIN = 40
const RATE_LIMIT_API = 120
const rateLimitMap = new Map()

// Rate limiting distribuído (opcional) via Redis — útil quando houver múltiplas instâncias
const REDIS_URL = process.env.REDIS_URL || ''
let redisClient = null
if (REDIS_URL) {
  redisClient = createRedisClient({ url: REDIS_URL })
  redisClient.on('error', (err) => {
    console.warn('[rate-limit] Erro Redis:', err?.message || err)
  })
  redisClient.connect().catch((err) => {
    console.warn('[rate-limit] Falha ao conectar no Redis, usando rate limit em memória:', err?.message || err)
    redisClient = null
  })
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
}

async function checkRateLimit(req, isAdmin) {
  const ip = getClientIp(req)
  const keyType = isAdmin ? 'admin' : 'api'
  const limit = isAdmin ? RATE_LIMIT_ADMIN : RATE_LIMIT_API
  const windowSec = Math.floor(RATE_LIMIT_WINDOW_MS / 1000)

  // Se Redis estiver configurado, usar rate limit distribuído
  if (redisClient) {
    try {
      const key = `rl:${keyType}:${ip}`
      const count = await redisClient.incr(key)
      if (count === 1) {
        await redisClient.expire(key, windowSec)
      }
      return count <= limit
    } catch (e) {
      console.warn('[rate-limit] erro ao usar Redis, fazendo fallback para memória:', e?.message || e)
    }
  }

  // Fallback/local: rate limit em memória (apenas por instância)
  const now = Date.now()
  let entry = rateLimitMap.get(ip)
  if (!entry) {
    entry = { admin: [], api: [] }
    rateLimitMap.set(ip, entry)
  }
  const list = entry[keyType]
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  while (list.length && list[0] < cutoff) list.shift()
  if (list.length >= limit) return false
  list.push(now)
  // Limpar entradas vazias para evitar crescimento indefinido da memória
  const other = entry[isAdmin ? 'api' : 'admin']
  const otherCutoff = now - RATE_LIMIT_WINDOW_MS
  while (other.length && other[0] < otherCutoff) other.shift()
  if (entry.admin.length === 0 && entry.api.length === 0) rateLimitMap.delete(ip)
  return true
}

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
  if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) {
    req.user = user
    next()
    return
  }
  // Usar client com service_role quando existir, para não depender de RLS em public.users
  const db = supabaseAdmin || supabase
  const { data: userData } = await db
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
  const parsed = new URL(url || req.url, 'http://localhost')
  const pathname = parsed.pathname
  const isAdminRoute = pathname.startsWith('/admin/api/')
  if (isAdminRoute) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  const origin = req.headers.origin
  if (origin) {
    const allowed = ALLOWED_ORIGINS_LIST
      ? ALLOWED_ORIGINS_LIST.includes(origin)
      : (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000' || origin.endsWith('.supabase.co'))
    if (allowed) res.setHeader('Access-Control-Allow-Origin', origin)
  }

  if (!(await checkRateLimit(req, isAdminRoute))) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' })
    res.end(JSON.stringify({ error: 'Muitas requisições. Tente novamente em 1 minuto.' }))
    return
  }

  // Configuração pública do Supabase para o frontend (URL + chave anon)
  if (parsed.pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_KEY
    }))
  }

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

  // GET /admin/api/stats (usa Auth como fonte para totais e últimos 5 quando há service_role)
  if (parsed.pathname === '/admin/api/stats' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const db = supabaseAdmin || supabase
      let totalUsers = 0
      let proUsers = 0
      let totalSessions = 0
      let recentUsers = []

      // Últimos 5 e total: do Auth quando disponível (mesma fonte que a página Usuários)
      if (supabaseAdmin) {
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 })
          const users = authData?.users ?? []
          totalUsers = typeof authData?.total === 'number' ? authData.total : users.length
          if (users.length > 0) {
            // Ordenar por created_at (mais recentes primeiro) e pegar os 5 últimos cadastrados
            const sorted = [...users].sort((a, b) => {
              const ta = (a.created_at && new Date(a.created_at).getTime()) || 0
              const tb = (b.created_at && new Date(b.created_at).getTime()) || 0
              return tb - ta
            })
            const last5 = sorted.slice(0, 5)
            const ids = last5.map((u) => u.id)
            const { data: profileRows } = await db.from('users').select('id, plan, created_at').in('id', ids)
            const byId = new Map((profileRows || []).map((r) => [r.id, r]))
            recentUsers = last5.map((u) => {
              const profile = byId.get(u.id) || {}
              return {
                id: u.id,
                email: u.email ?? '',
                name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
                plan: profile.plan ?? 'free',
                created_at: profile.created_at ?? u.created_at ?? null
              }
            })
          }
        } catch (_) {}
      }

      // Fallback: só public.users
      if (recentUsers.length === 0) {
        const [usersRes, recentRes] = await Promise.all([
          db.from('users').select('id', { count: 'exact', head: true }),
          db.from('users').select('id, email, name, plan, created_at').order('created_at', { ascending: false }).limit(5)
        ])
        totalUsers = usersRes.count ?? 0
        recentUsers = recentRes.data ?? []
      }

      const sessionsRes = await db.from('sessions').select('*', { count: 'exact', head: true })
      totalSessions = sessionsRes.count ?? 0

      try {
        const proRes = await db.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'pro')
        proUsers = proRes.count ?? 0
      } catch (_) {
        proUsers = 0
      }

      const freeUsers = Math.max(0, totalUsers - proUsers)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        data: {
          totalUsers,
          proUsers,
          freeUsers,
          totalSessions,
          recentUsers: recentUsers.map(u => ({ ...u, plan: u.plan ?? 'free' }))
        }
      }))
    })
  }

  // GET /admin/api/users?search=&page=&limit=
  // Sem busca: lista da API Auth (fonte da verdade) + merge com public.users. Com busca: sync Auth→public.users e consulta public.users.
  if (parsed.pathname === '/admin/api/users' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const db = supabaseAdmin || supabase
      const page = Math.max(1, parseInt(parsed.searchParams.get('page') || '1', 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(parsed.searchParams.get('limit') || '10', 10) || 10))
      const offset = (page - 1) * limit
      const search = (parsed.searchParams.get('search') || '').trim()

      let list = []
      let total = 0

      // Sync: trazer usuários do Auth que ainda não estão em public.users (para busca e relatórios)
      if (supabaseAdmin) {
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
          const users = authData?.users ?? []
          if (users.length > 0) {
            const ids = users.map((u) => u.id)
            const { data: existing } = await db.from('users').select('id').in('id', ids)
            const existingIds = new Set((existing || []).map((r) => r.id))
            const toInsert = users
              .filter((u) => !existingIds.has(u.id))
              .map((u) => ({
                id: u.id,
                email: u.email ?? '',
                name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null
              }))
            if (toInsert.length > 0) {
              const { error: insertErr } = await db.from('users').upsert(toInsert, { onConflict: 'id' })
              if (insertErr) console.warn('[admin/api/users] sync public.users:', insertErr.message)
            }
          }
        } catch (e) {
          console.warn('[admin/api/users] sync listUsers:', e?.message || e)
        }
      }

      // Sem busca: listar direto do Auth (garante que todos que fizeram login apareçam) e enriquecer com public.users
      if (supabaseAdmin && !search) {
        try {
          const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: limit
          })
          if (!authErr && authData?.users?.length) {
            const users = authData.users
            total = typeof authData.total === 'number' ? authData.total : users.length
            const ids = users.map((u) => u.id)
            const { data: profileRows } = await db.from('users').select('id, role, plan, last_login_at, created_at').in('id', ids)
            const byId = new Map((profileRows || []).map((r) => [r.id, r]))
            list = users.map((u) => {
              const profile = byId.get(u.id) || {}
              return {
                id: u.id,
                email: u.email ?? '',
                name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
                role: profile.role ?? null,
                plan: profile.plan ?? 'free',
                last_login_at: profile.last_login_at ?? null,
                created_at: profile.created_at ?? u.created_at ?? null
              }
            })
          }
        } catch (e) {
          console.warn('[admin/api/users] listUsers:', e?.message || e)
        }
      }

      // Com busca ou quando Auth não retornou: listar de public.users
      if (list.length === 0) {
        let query = db
          .from('users')
          .select('id, email, name, role, plan, last_login_at, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
        if (search) {
          const escaped = String(search).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
          query = query.or(`email.ilike.%${escaped}%,name.ilike.%${escaped}%`)
        }
        const { data, error, count } = await query
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: error.message }))
        }
        list = data ?? []
        total = count ?? 0
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: list, total, page, limit }))
    })
  }

  // PUT /admin/api/users/:id — atualizar role/plan
  if (parsed.pathname.match(/^\/admin\/api\/users\/[\w-]+$/) && req.method === 'PUT') {
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
          const payload = JSON.parse(body || '{}')
          const update = {}
          if (payload.role !== undefined) {
            const r = payload.role === null || payload.role === 'admin' ? payload.role : null
            if (payload.role !== r) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              return res.end(JSON.stringify({ success: false, error: 'role inválido (use "admin" ou null)' }))
            }
            update.role = r
          }
          if (payload.plan !== undefined) {
            const plan = ['free', 'pro'].includes(payload.plan) ? payload.plan : 'free'
            update.plan = plan
          }
          if (Object.keys(update).length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: true }))
          }
          const db = supabaseAdmin || supabase
          const { error } = await db.from('users').update(update).eq('id', id)
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

  // DELETE /admin/api/users/:id — remove metadados do usuário (não mexe em auth.users)
  if (parsed.pathname.match(/^\/admin\/api\/users\/[\w-]+$/) && req.method === 'DELETE') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      const db = supabaseAdmin || supabase
      // Apaga histórico associado e o registro em public.users
      const { error } = await db.from('users').delete().eq('id', id)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // GET /admin/api/simulados
  if (parsed.pathname === '/admin/api/simulados' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const db = supabaseAdmin || supabase
      const { data, error } = await db
        .from('simulados')
        .select('id, slug, title, is_active, is_premium, passing_score, created_at')
        .order('created_at', { ascending: false })
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: data || [] }))
    })
  }

  // POST /admin/api/simulados — criar simulado
  if (parsed.pathname === '/admin/api/simulados' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        if (body.length > MAX_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Payload muito grande' }))
        }
        try {
          const p = JSON.parse(body || '{}')
          const slug = typeof p.slug === 'string' ? p.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
          const title = typeof p.title === 'string' ? p.title.trim().slice(0, 200) : ''
          if (!slug || slug.length < 2) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: 'Slug inválido (mín. 2 caracteres, apenas a-z, 0-9 e hífen)' }))
          }
          if (!title) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: 'Título obrigatório' }))
          }
          const passingScore = Math.min(100, Math.max(0, parseInt(p.passing_score, 10) || 70))
          const row = {
            slug,
            title,
            is_active: p.is_active !== false,
            is_premium: p.is_premium === true,
            passing_score: passingScore
          }
          const db = supabaseAdmin || supabase
          const { data: inserted, error } = await db.from('simulados').insert(row).select('id, slug, title, is_active, is_premium, passing_score, created_at').single()
          if (error) {
            if (error.code === '23505') {
              res.writeHead(409, { 'Content-Type': 'application/json' })
              return res.end(JSON.stringify({ success: false, error: 'Slug já existe' }))
            }
            res.writeHead(500, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: error.message }))
          }
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, data: inserted }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
        }
      })
    })
  }

  // PUT /admin/api/simulados/:id
  if (parsed.pathname.match(/^\/admin\/api\/simulados\/[\w-]+$/) && req.method === 'PUT') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        if (body.length > MAX_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Payload muito grande' }))
        }
        try {
          const p = JSON.parse(body || '{}')
          const update = {}
          if (typeof p.slug === 'string') {
            const slug = p.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            if (slug.length >= 2) update.slug = slug
          }
          if (typeof p.title === 'string' && p.title.trim()) update.title = p.title.trim().slice(0, 200)
          if (p.is_active !== undefined) update.is_active = !!p.is_active
          if (p.is_premium !== undefined) update.is_premium = !!p.is_premium
          if (p.passing_score !== undefined) update.passing_score = Math.min(100, Math.max(0, parseInt(p.passing_score, 10) || 70))
          if (Object.keys(update).length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: true }))
          }
          const db = supabaseAdmin || supabase
          const { error } = await db.from('simulados').update(update).eq('id', id)
          if (error) {
            if (error.code === '23505') {
              res.writeHead(409, { 'Content-Type': 'application/json' })
              return res.end(JSON.stringify({ success: false, error: 'Slug já existe' }))
            }
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

  // DELETE /admin/api/simulados/:id
  if (parsed.pathname.match(/^\/admin\/api\/simulados\/[\w-]+$/) && req.method === 'DELETE') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      const db = supabaseAdmin || supabase
      const { error } = await db.from('simulados').delete().eq('id', id)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // GET /admin/api/exams?simulado_id= — exames de um simulado
  // Requer service_role no servidor para contornar RLS na tabela exams.
  if (parsed.pathname === '/admin/api/exams' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const simuladoId = (parsed.searchParams.get('simulado_id') || '').trim()
      if (!simuladoId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'simulado_id obrigatório' }))
      }
      if (!supabaseAdmin) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({
          success: false,
          error: 'Configure SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) no .env do servidor para listar exames.'
        }))
      }
      const { data, error } = await supabaseAdmin.from('exams').select('id, code, simulado_id').eq('simulado_id', simuladoId).order('code')
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: data || [] }))
    })
  }

  // POST /admin/api/exams — criar exame
  if (parsed.pathname === '/admin/api/exams' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        if (body.length > MAX_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Payload muito grande' }))
        }
        try {
          const p = JSON.parse(body || '{}')
          const simuladoId = p.simulado_id || ''
          const code = typeof p.code === 'string' ? p.code.trim().slice(0, 20) : ''
          if (!simuladoId) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: 'simulado_id obrigatório' }))
          }
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: 'Código do exame obrigatório' }))
          }
          const row = { simulado_id: simuladoId, code }
          const db = supabaseAdmin || supabase
          const { data: inserted, error } = await db.from('exams').insert(row).select('id, code, simulado_id').single()
          if (error) {
            if (error.code === '23505') {
              res.writeHead(409, { 'Content-Type': 'application/json' })
              return res.end(JSON.stringify({ success: false, error: 'Código já existe neste simulado' }))
            }
            res.writeHead(500, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: error.message }))
          }
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, data: inserted }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
        }
      })
    })
  }

  // PUT /admin/api/exams/:id
  if (parsed.pathname.match(/^\/admin\/api\/exams\/[\w-]+$/) && req.method === 'PUT') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        if (body.length > MAX_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Payload muito grande' }))
        }
        try {
          const p = JSON.parse(body || '{}')
          const update = {}
          if (typeof p.code === 'string' && p.code.trim()) update.code = p.code.trim().slice(0, 20)
          if (Object.keys(update).length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: true }))
          }
          const db = supabaseAdmin || supabase
          const { error } = await db.from('exams').update(update).eq('id', id)
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

  // DELETE /admin/api/exams/:id
  if (parsed.pathname.match(/^\/admin\/api\/exams\/[\w-]+$/) && req.method === 'DELETE') {
    return requireAdmin(req, res, async () => {
      const id = parsed.pathname.split('/').pop()
      const db = supabaseAdmin || supabase
      const { error } = await db.from('exams').delete().eq('id', id)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
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
      const type = parsed.searchParams.get('type')
      const difficulty = parsed.searchParams.get('difficulty')
      const status = parsed.searchParams.get('status')
      // Busca por texto na pergunta: sanitizar e limitar tamanho (segurança + desempenho)
      const searchRaw = (parsed.searchParams.get('q') || parsed.searchParams.get('search') || '').trim()
      const searchMaxLen = 200
      const searchSanitized = searchRaw.slice(0, searchMaxLen).replace(/[\0-\x1F\x7F]/g, '')
      const searchTerm = searchSanitized.length >= 2
        ? '%' + searchSanitized.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'
        : null

      let query = supabase
        .from('questions')
        .select(`id, type, question, difficulty, is_active, answer,
          exams!inner(code, simulado_id, simulados!inner(slug, title))`,
          { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (simuladoId) query = query.eq('exams.simulado_id', simuladoId)
      if (examCode) query = query.eq('exams.code', examCode)
      if (type) query = query.eq('type', type)
      if (difficulty) query = query.eq('difficulty', difficulty)
      if (status === 'active') query = query.eq('is_active', true)
      if (status === 'inactive') query = query.eq('is_active', false)
      if (searchTerm) query = query.ilike('question', searchTerm)

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
      const simuladoId = (body.simulado_id ?? parsed.searchParams.get('simulado_id') ?? '').toString().trim()
      let questions = Array.isArray(body.questions) ? body.questions : Array.isArray(body) ? body : null
      if (!questions) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Envie simulado_id (no body ou em ?simulado_id=) e questions (array no body)' }))
      }
      if (!simuladoId && questions.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'simulado_id obrigatório para importação (body ou query ?simulado_id=)' }))
      }
      const { data: exams } = await supabase.from('exams').select('id, code').eq('simulado_id', simuladoId)
      // Padrão recomendado: exam_id no body → todas as questões vão para esse exame (JSON sem campo exam em cada item).
      const rootExamId = body.exam_id ? String(body.exam_id).trim() : null
      if (rootExamId) {
        const pertence = (exams || []).some(e => e.id === rootExamId)
        if (!pertence) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'exam_id inválido ou não pertence ao simulado selecionado.' }))
        }
      }
      const byCode = new Map((exams || []).map(e => [e.code, e.id]))
      const rows = []
      const skippedCodes = new Set()
      for (const q of questions) {
        const examId = rootExamId || byCode.get(String(q.exam ?? q.exam_id ?? '').trim()) || (exams && exams[0] ? exams[0].id : null)
        if (!examId) {
          const c = String(q.exam ?? q.exam_id ?? '').trim()
          if (c) skippedCodes.add(c)
          continue
        }
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
          difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
          hint: q.hint ? String(q.hint) : null,
          is_active: true
        })
      }
      if (rows.length === 0) {
        const hint = !exams || exams.length === 0
          ? 'O simulado não tem nenhum exame. Crie ao menos um exame (ex.: código N1-100) no painel Admin → Simulados.'
          : skippedCodes.size
            ? `Nenhum exame com código: ${[...skippedCodes].slice(0, 5).join(', ')}${skippedCodes.size > 5 ? '...' : ''}. Crie um exame com esse código no simulado ou use o código de um exame existente (ex.: '${(exams && exams[0] && exams[0].code) || ''}').`
            : 'Nenhuma questão válida (verifique se cada item tem question e, para type multiple, options e correct).'
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Nenhuma questão válida para importar.', hint }))
      }
      const dbQuestions = supabaseAdmin || supabase
      const { error } = await dbQuestions.from('questions').insert(rows)
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
          const allowed = ['exam_id', 'type', 'question', 'options', 'answer', 'difficulty', 'hint', 'is_active']
          const row = {}
          for (const k of allowed) {
            if (q[k] !== undefined) row[k] = q[k]
          }
          if (!row.exam_id) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: false, error: 'exam_id obrigatório' }))
          }
          const { error } = await (supabaseAdmin || supabase).from('questions').insert(row)
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
          const allowed = ['exam_id', 'type', 'question', 'options', 'answer', 'difficulty', 'hint', 'is_active']
          const row = {}
          for (const k of allowed) {
            if (q[k] !== undefined) row[k] = q[k]
          }
          if (Object.keys(row).length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ success: true }))
          }
          const { error } = await (supabaseAdmin || supabase).from('questions').update(row).eq('id', id)
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
        ({ error } = await (supabaseAdmin || supabase).from('questions').delete().eq('id', id))
      } else {
        ({ error } = await (supabaseAdmin || supabase).from('questions').update({ is_active: false }).eq('id', id))
      }
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // GET /api/artigos — lista pública (apenas publicados)
  if (parsed.pathname === '/api/artigos' && req.method === 'GET') {
    const { data, error } = await (supabaseAdmin || supabase)
      .from('articles')
      .select('id, title, slug, excerpt, author_name, published_at, cover_image_url, content_type')
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: true, data: data || [] }))
  }

  // GET /api/artigos/:slug — um artigo público (para página de leitura)
  const apiArtigoSlugMatch = parsed.pathname.match(/^\/api\/artigos\/([^/]+)\/?$/)
  if (apiArtigoSlugMatch && req.method === 'GET') {
    let rawSlug = apiArtigoSlugMatch[1] || ''
    try { rawSlug = decodeURIComponent(rawSlug) } catch (_) {}
    const slug = (typeof rawSlug === 'string' ? rawSlug : '').slice(0, 200).replace(/[\0-\x1F\x7F]/g, '')
    const { data, error } = await (supabaseAdmin || supabase)
      .from('articles')
      .select('id, title, slug, excerpt, content, content_type, author_name, published_at, cover_image_url')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !data) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'Artigo não encontrado' }))
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: true, data }))
  }

  // GET /admin/api/artigos — lista para admin
  if (parsed.pathname === '/admin/api/artigos' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const { data, error } = await (supabaseAdmin || supabase)
        .from('articles')
        .select('*')
        .order('published_at', { ascending: false })

      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: data || [] }))
    })
  }

  // POST /admin/api/artigos — criar artigo
  if (parsed.pathname === '/admin/api/artigos' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body
      try { body = await readBody(req) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: e.message === 'Payload muito grande' ? 'Payload muito grande' : 'JSON inválido' }))
      }
      const allowed = ['title', 'slug', 'excerpt', 'content', 'content_type', 'author_name', 'published_at', 'cover_image_url', 'is_published']
      const row = {}
      for (const k of allowed) {
        if (body[k] !== undefined) row[k] = body[k]
      }
      if (!row.title || !row.slug) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'title e slug são obrigatórios' }))
      }
      row.content_type = row.content_type === 'md' ? 'md' : 'html'
      row.updated_at = new Date().toISOString()
      const { data, error } = await (supabaseAdmin || supabase).from('articles').insert(row).select('id').single()
      if (error) {
        const isSlugDuplicate = error.code === '23505' || (error.message && (error.message.includes('articles_slug_key') || error.message.includes('unique') && error.message.includes('slug')))
        const msg = isSlugDuplicate ? 'Já existe um artigo com este slug (URL). Escolha outro slug ou altere o título.' : error.message
        res.writeHead(isSlugDuplicate ? 400 : 500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: msg }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: { id: data?.id } }))
    })
  }

  const adminArtigoIdMatch = parsed.pathname.match(/^\/admin\/api\/artigos\/([^/]+)\/?$/)
  if (adminArtigoIdMatch && parsed.pathname !== '/admin/api/artigos/upload' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const id = adminArtigoIdMatch[1]
      const { data, error } = await (supabaseAdmin || supabase).from('articles').select('*').eq('id', id).single()
      if (error || !data) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Artigo não encontrado' }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data }))
    })
  }

  // PUT /admin/api/artigos/:id
  if (adminArtigoIdMatch && parsed.pathname !== '/admin/api/artigos/upload' && req.method === 'PUT') {
    return requireAdmin(req, res, async () => {
      const id = adminArtigoIdMatch[1]
      let body
      try { body = await readBody(req) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
      }
      const allowed = ['title', 'slug', 'excerpt', 'content', 'content_type', 'author_name', 'published_at', 'cover_image_url', 'is_published']
      const row = {}
      for (const k of allowed) {
        if (body[k] !== undefined) row[k] = body[k]
      }
      row.updated_at = new Date().toISOString()
      const { error } = await (supabaseAdmin || supabase).from('articles').update(row).eq('id', id)
      if (error) {
        const isSlugDuplicate = error.code === '23505' || (error.message && (error.message.includes('articles_slug_key') || error.message.includes('unique') && error.message.includes('slug')))
        const msg = isSlugDuplicate ? 'Já existe outro artigo com este slug (URL). Escolha outro slug.' : error.message
        res.writeHead(isSlugDuplicate ? 400 : 500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: msg }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // DELETE /admin/api/artigos/:id
  if (adminArtigoIdMatch && parsed.pathname !== '/admin/api/artigos/upload' && req.method === 'DELETE') {
    return requireAdmin(req, res, async () => {
      const id = adminArtigoIdMatch[1]
      const { error } = await (supabaseAdmin || supabase).from('articles').delete().eq('id', id)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // POST /admin/api/artigos/upload — upload de imagem (base64). Se SUPABASE_STORAGE_BUCKET_ARTIGOS
  // (ou SUPABASE_STORAGE_BUCKET) + SUPABASE_SERVICE_ROLE_KEY estiverem definidos, envia para o
  // Storage do Supabase (URL pública persiste após deploy). Senão, salva em public/uploads/artigos.
  if (parsed.pathname === '/admin/api/artigos/upload' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body
      try { body = await readBody(req, 300 * 1024) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Payload inválido ou muito grande (máx 200KB)' }))
      }
      const b64 = body.data || body.base64
      const name = (body.filename || body.name || 'img').replace(/[^a-zA-Z0-9._-]/g, '') || 'img'
      if (!b64 || typeof b64 !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Campo data (base64) é obrigatório' }))
      }
      const ext = (name.split('.').pop() || 'jpg').toLowerCase()
      const allowedExt = { jpg: true, jpeg: true, png: true, webp: true }
      if (!allowedExt[ext]) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Formato não permitido. Use JPG, PNG ou WebP.' }))
      }
      let buf
      try {
        buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Base64 inválido' }))
      }
      if (buf.length > MAX_IMAGE_UPLOAD_BYTES) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Imagem muito grande (máx 200KB)' }))
      }
      const filename = `${randomUUID()}.${ext}`
      const mimeByExt = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
      const contentType = mimeByExt[ext] || 'image/jpeg'
      const storageBucket = process.env.SUPABASE_STORAGE_BUCKET_ARTIGOS || process.env.SUPABASE_STORAGE_BUCKET
      let url
      if (storageBucket && supabaseAdmin) {
        try {
          const { error: uploadErr } = await supabaseAdmin.storage.from(storageBucket).upload(filename, buf, { contentType, upsert: true })
          if (uploadErr) throw uploadErr
          const { data: urlData } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(filename)
          url = urlData.publicUrl
        } catch (e) {
          try { writeFileSync(resolve(UPLOADS_ARTIGOS_DIR, filename), buf) } catch (_) {}
          url = `/uploads/artigos/${filename}`
        }
      } else {
        const filepath = resolve(UPLOADS_ARTIGOS_DIR, filename)
        if (!filepath.startsWith(UPLOADS_ARTIGOS_DIR)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Nome de arquivo inválido' }))
        }
        try {
          writeFileSync(filepath, buf)
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: 'Erro ao salvar arquivo' }))
        }
        url = `/uploads/artigos/${filename}`
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, url }))
    })
  }

  // GET /api/links — lista pública de links úteis (Links & Serviços Linux)
  if (parsed.pathname === '/api/links' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('useful_links')
      .select('id, name, url, description, label, icon_url, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: true, data: data || [] }))
  }

  // Admin: Links úteis (CRUD + upload ícone)
  const adminLinksIdMatch = parsed.pathname.match(/^\/admin\/api\/links\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
  const dbLinks = supabaseAdmin || supabase

  if (parsed.pathname === '/admin/api/links/upload' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body
      try { body = await readBody(req, 300 * 1024) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Payload inválido ou muito grande (máx 200KB)' }))
      }
      const b64 = body.data || body.base64
      const name = (body.filename || body.name || 'img').replace(/[^a-zA-Z0-9._-]/g, '') || 'img'
      if (!b64 || typeof b64 !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Campo data (base64) é obrigatório' }))
      }
      const ext = (name.split('.').pop() || 'jpg').toLowerCase()
      const allowedExt = { jpg: true, jpeg: true, png: true, webp: true }
      if (!allowedExt[ext]) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Formato não permitido. Use JPG, PNG ou WebP.' }))
      }
      let buf
      try {
        buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Base64 inválido' }))
      }
      if (buf.length > MAX_IMAGE_UPLOAD_BYTES) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Imagem muito grande (máx 200KB)' }))
      }
      const filename = `${randomUUID()}.${ext}`
      const filepath = resolve(UPLOADS_LINKS_DIR, filename)
      if (!filepath.startsWith(UPLOADS_LINKS_DIR)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Nome de arquivo inválido' }))
      }
      try {
        writeFileSync(filepath, buf)
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Erro ao salvar arquivo' }))
      }
      const url = `/uploads/links/${filename}`
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, url }))
    })
  }

  if (parsed.pathname === '/admin/api/links' && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const { data, error } = await dbLinks.from('useful_links').select('id, name, url, description, label, icon_url, sort_order, created_at').order('sort_order', { ascending: true }).order('name', { ascending: true })
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: data || [] }))
    })
  }

  if (parsed.pathname === '/admin/api/links' && req.method === 'POST') {
    return requireAdmin(req, res, async () => {
      let body
      try { body = await readBody(req) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
      }
      const allowed = ['name', 'url', 'description', 'label', 'icon_url', 'sort_order']
      const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      for (const k of allowed) {
        if (body[k] !== undefined) row[k] = body[k]
      }
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const url = typeof row.url === 'string' ? row.url.trim() : ''
      if (!name || !url) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Nome e URL são obrigatórios' }))
      }
      if (!/^https?:\/\/[^\s]+$/i.test(url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'URL inválida' }))
      }
      row.name = name
      row.url = url
      if (typeof row.sort_order !== 'number') row.sort_order = 0
      const { error } = await dbLinks.from('useful_links').insert(row)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  if (adminLinksIdMatch && req.method === 'GET') {
    return requireAdmin(req, res, async () => {
      const id = adminLinksIdMatch[1]
      const { data, error } = await dbLinks.from('useful_links').select('*').eq('id', id).single()
      if (error || !data) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Link não encontrado' }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data }))
    })
  }

  if (adminLinksIdMatch && req.method === 'PUT') {
    return requireAdmin(req, res, async () => {
      const id = adminLinksIdMatch[1]
      let body
      try { body = await readBody(req) } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'JSON inválido' }))
      }
      const allowed = ['name', 'url', 'description', 'label', 'icon_url', 'sort_order']
      const row = { updated_at: new Date().toISOString() }
      for (const k of allowed) {
        if (body[k] !== undefined) row[k] = body[k]
      }
      if (row.name !== undefined) row.name = typeof row.name === 'string' ? row.name.trim() : ''
      if (row.url !== undefined) row.url = typeof row.url === 'string' ? row.url.trim() : ''
      if (row.name === '') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Nome é obrigatório' }))
      }
      if (row.url !== undefined && row.url !== '' && !/^https?:\/\/[^\s]+$/i.test(row.url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'URL inválida' }))
      }
      const { error } = await dbLinks.from('useful_links').update(row).eq('id', id)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  if (adminLinksIdMatch && req.method === 'DELETE') {
    return requireAdmin(req, res, async () => {
      const id = adminLinksIdMatch[1]
      const { error } = await dbLinks.from('useful_links').delete().eq('id', id)
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: error.message }))
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
  }

  // GET /api/simulados (apenas colunas necessárias ao front)
  if (parsed.pathname === '/api/simulados') {
    const { data, error } = await supabase
      .from('simulados')
      .select('id, slug, title, is_active, is_premium, passing_score')
      .eq('is_active', true)

    if (error) {
      res.writeHead(500)
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200)
    return res.end(JSON.stringify({ success: true, data }))
  }

  // GET /api/simulados/:slug/exams — lista exames do simulado + tipos de questão (para config)
  const examsMatch = parsed.pathname.match(/^\/api\/simulados\/([a-z0-9_-]+)\/exams\/?$/i)
  if (examsMatch) {
    const slug = (examsMatch[1] || '').slice(0, 80)
    const { data: simulado } = await supabase
      .from('simulados')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!simulado) {
      res.writeHead(404)
      return res.end(JSON.stringify({ success: false, error: 'Simulado não encontrado' }))
    }

    const { data: exams, error: examsErr } = await supabase
      .from('exams')
      .select('id, code')
      .eq('simulado_id', simulado.id)
      .order('code')

    if (examsErr) {
      res.writeHead(500)
      return res.end(JSON.stringify({ success: false, error: examsErr.message }))
    }

    // Tipos de questão presentes no simulado (multiple e/ou text)
    const { data: typeRows } = await supabase
      .from('questions')
      .select('type')
      .eq('is_active', true)
      .in('exam_id', (exams || []).map(e => e.id))

    const typesSet = new Set((typeRows || []).map(r => r.type).filter(Boolean))
    const question_types = []
    if (typesSet.has('multiple')) question_types.push('multiple')
    if (typesSet.has('text')) question_types.push('text')
    if (question_types.length === 0) question_types.push('multiple')

    res.writeHead(200)
    return res.end(JSON.stringify({ success: true, exams: exams || [], question_types }))
  }

  // GET /api/simulados/lpic1/questions?exam=101
  const questionsMatch = parsed.pathname.match(/^\/api\/simulados\/([a-z0-9_-]+)\/questions\/?$/i)
  if (questionsMatch) {
    const slug = (questionsMatch[1] || '').slice(0, 80)
    const examCodeRaw = parsed.searchParams.get('exam')
    const examCode = (typeof examCodeRaw === 'string' ? examCodeRaw : '').trim().slice(0, 20)

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
        id, type, question, options, answer, difficulty, hint, weight,
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
  if (pathname.startsWith('/uploads/')) {
    const ext = pathname.split('.').pop()?.toLowerCase()
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext] || 'application/octet-stream'
    return serveFile(res, pathname.slice(1), mime)
  }
  const ext = pathname.split('.').pop()?.toLowerCase()
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', ico: 'image/x-icon', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff' }[ext]
  if (mime) return serveFile(res, pathname.slice(1), mime)

  res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS })
  res.end('Not found')
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`✅ LinuxGeek rodando em http://localhost:${PORT}`)
})