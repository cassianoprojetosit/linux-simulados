/**
 * Autenticação do painel admin: mesmo padrão de sessão do index (user-area.js)
 * + verificação de role admin via GET /admin/api/ping com Bearer token.
 * Arquivo externo para cumprir CSP (script-src não permite inline).
 */
import { urlHash } from '/js/hash-capture.js'
import { supabase } from '/js/supabase-auth.js'

function escapeHtml(text) {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

function safeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim().toLowerCase()
  if (t.startsWith('https://') || t.startsWith('data:')) return url
  return ''
}

function renderAdminUser(session) {
  const area = document.getElementById('admin-user-area')
  if (!area) return
  const name = escapeHtml(session.user.user_metadata?.full_name?.split(' ')[0] || 'Admin')
  const avatar = safeAvatarUrl(session.user.user_metadata?.avatar_url || '')
  area.innerHTML = '<div class="admin-user-chip">' +
    (avatar ? '<img src="' + escapeHtml(avatar) + '" class="admin-user-avatar" alt="">' : '') +
    '<span class="admin-user-name">' + name + '</span>' +
    '<button type="button" id="admin-topbar-sair" class="admin-logout-btn">Sair</button>' +
    '</div>'
  const img = area.querySelector('.admin-user-avatar')
  if (img) img.onerror = function () { this.style.display = 'none' }
  const btn = area.querySelector('#admin-topbar-sair')
  if (btn) btn.addEventListener('click', doLogout)
}

function doLogout() {
  supabase.auth.signOut().then(() => {
    window.location.href = '/login.html'
  })
}

function formatDateAdmin(str) {
  if (!str) return '—'
  try {
    const d = new Date(str)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return str
  }
}

function renderDashboard(data) {
  const grid = document.getElementById('admin-metrics-grid')
  const wrap = document.getElementById('admin-recent-users-wrap')
  if (!grid || !data) return

  grid.innerHTML =
    '<div class="admin-metric-card">' +
      '<div class="admin-metric-value">' + (data.totalUsers ?? 0) + '</div>' +
      '<div class="admin-metric-label">Total Usuários</div>' +
    '</div>' +
    '<div class="admin-metric-card free">' +
      '<div class="admin-metric-value">' + (data.freeUsers ?? 0) + '</div>' +
      '<div class="admin-metric-label">Usuários Free</div>' +
    '</div>' +
    '<div class="admin-metric-card pro">' +
      '<div class="admin-metric-value">' + (data.proUsers ?? 0) + '</div>' +
      '<div class="admin-metric-label">Usuários Pro</div>' +
    '</div>' +
    '<div class="admin-metric-card sessions">' +
      '<div class="admin-metric-value">' + (data.totalSessions ?? 0) + '</div>' +
      '<div class="admin-metric-label">Simulados realizados</div>' +
    '</div>'

  if (wrap) {
    const rows = (data.recentUsers || []).map(u =>
      '<tr><td>' + escapeHtml(u.name || u.email || '—') + '</td><td>' + escapeHtml(u.email || '—') + '</td><td>' + escapeHtml(u.plan || '—') + '</td><td>' + formatDateAdmin(u.created_at) + '</td></tr>'
    ).join('')
    wrap.innerHTML =
      '<h2>Últimos 5 usuários cadastrados</h2>' +
      '<table class="admin-recent-table">' +
      '<thead><tr><th>Nome</th><th>Email</th><th>Plano</th><th>Data</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4" style="padding:24px;color:var(--text-muted);">Nenhum usuário</td></tr>') + '</tbody>' +
      '</table>'
  }
}

let session = null
if (urlHash && urlHash.includes('access_token')) {
  const params = new URLSearchParams(urlHash.replace(/^#/, ''))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  const expires_in = params.get('expires_in')
  const expires_at = params.get('expires_at')
  const token_type = params.get('token_type') || 'bearer'
  if (access_token && refresh_token && expires_in) {
    try {
      const payload = JSON.parse(atob(access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      const user = {
        id: payload.sub,
        email: payload.email || '',
        user_metadata: payload.user_metadata || {},
        app_metadata: payload.app_metadata || {},
        aud: payload.aud || 'authenticated',
        created_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : '',
        updated_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : ''
      }
      const exp = expires_at ? parseInt(expires_at, 10) : Math.round(Date.now() / 1000) + parseInt(expires_in, 10)
      const sessionFromHash = {
        access_token,
        refresh_token,
        expires_in: parseInt(expires_in, 10),
        expires_at: exp,
        token_type,
        user
      }
      const { data, error } = await supabase.auth.setSession(sessionFromHash)
      if (error) {
        console.error('[admin] setSession do hash falhou:', error.message)
      } else {
        session = data?.session || sessionFromHash
        try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch (_) {}
      }
    } catch (e) {
      console.error('[admin] Erro ao processar hash OAuth:', e)
    }
  }
}

if (!session) {
  if (typeof supabase.auth.initialize === 'function') await supabase.auth.initialize()
  const result = await supabase.auth.getSession()
  session = result.data?.session ?? null
}

if (!session) {
  window.location.href = '/login.html'
  throw new Error('redirect')
}

try {
  const res = await fetch('/admin/api/ping', {
    headers: { Authorization: 'Bearer ' + session.access_token }
  })
  if (!res.ok) {
    alert('Acesso negado')
    window.location.href = '/index.html'
    throw new Error('not admin')
  }
  renderAdminUser(session)

  async function loadDashboardStats() {
    const res = await fetch('/admin/api/stats', {
      headers: { Authorization: 'Bearer ' + session.access_token }
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data) renderDashboard(json.data)
    }
  }
  await loadDashboardStats()

  const refreshBtn = document.getElementById('admin-dashboard-refresh')
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboardStats())
} catch (e) {
  if (e.message === 'not admin') throw e
  const area = document.getElementById('admin-user-area')
  if (area) area.textContent = 'Erro ao verificar acesso. Tente novamente.'
  console.error('[admin] Erro:', e)
  throw e
}

const sidebarSair = document.getElementById('admin-sidebar-sair')
if (sidebarSair) sidebarSair.addEventListener('click', doLogout)
