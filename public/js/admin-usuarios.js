/**
 * Página Admin Usuários: lista usuários, busca, altera tipo (Free/Pro/Admin) e permite remover metadados.
 * Depende de admin-auth.js (sessão + ping) e usa o mesmo token de sessão (via supabase-auth).
 */
import { supabase } from '/js/supabase-auth.js'

let token = null
let currentPage = 1
let totalCount = 0
const LIMIT = 10

function escapeHtml (text) {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

function formatDate (str) {
  if (!str) return '—'
  try {
    const d = new Date(str)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return str
  }
}

function getAuthHeaders () {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function userTypeLabel (u) {
  if (u.role === 'admin') return { label: 'Admin', cls: 'admin' }
  if (u.plan === 'pro') return { label: 'Pro', cls: 'pro' }
  return { label: 'Free', cls: 'free' }
}

async function ensureToken () {
  if (token) return
  const { data } = await supabase.auth.getSession()
  token = data?.session?.access_token ?? null
}

async function loadUsers () {
  const tbody = document.getElementById('users-tbody')
  const metaEl = document.getElementById('users-meta')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;color:var(--text-dim);text-align:center;">Carregando…</td></tr>'

  const search = document.getElementById('user-search')?.value?.trim() || ''
  const params = new URLSearchParams()
  params.set('page', String(currentPage))
  params.set('limit', String(LIMIT))
  if (search) params.set('search', search)

  const res = await fetch(`/admin/api/users?${params.toString()}`, { headers: getAuthHeaders() })
  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;color:var(--red);text-align:center;">Erro ao carregar usuários.</td></tr>'
    if (metaEl) metaEl.textContent = '—'
    return
  }
  const json = await res.json()
  const list = json.data || []
  totalCount = json.total ?? 0

  if (metaEl) {
    if (totalCount === 0) {
      metaEl.textContent = 'Nenhum usuário encontrado'
    } else {
      const from = (currentPage - 1) * LIMIT + 1
      const to = Math.min(currentPage * LIMIT, totalCount)
      metaEl.textContent = `${from}–${to} de ${totalCount} usuário(s)`
    }
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;color:var(--text-dim);text-align:center;">Nenhum usuário encontrado.</td></tr>'
    return
  }

  tbody.innerHTML = list.map(u => {
    const type = userTypeLabel(u)
    const lastLogin = formatDate(u.last_login_at || u.updated_at || u.created_at)
    return (
      '<tr data-id="' + escapeHtml(u.id) + '">' +
        '<td>' + escapeHtml(u.name || u.email || '—') + '</td>' +
        '<td>' + escapeHtml(u.email || '—') + '</td>' +
        '<td><span class="user-pill ' + type.cls + '">' + escapeHtml(type.label) + '</span></td>' +
        '<td>' + escapeHtml(lastLogin) + '</td>' +
        '<td class="admin-users-actions">' +
          '<button type="button" class="btn-icon" data-action="make-admin" title="Tornar admin">👑</button>' +
          '<button type="button" class="btn-icon" data-action="make-pro" title="Marcar como Pro">⭐</button>' +
          '<button type="button" class="btn-icon" data-action="make-free" title="Marcar como Free">🆓</button>' +
          '<button type="button" class="btn-icon danger" data-action="delete" title="Remover meta do usuário">🗑️</button>' +
        '</td>' +
      '</tr>'
    )
  }).join('')
}

async function updateUser (id, changes) {
  const res = await fetch(`/admin/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(changes)
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    alert(json.error || 'Erro ao atualizar usuário.')
    return false
  }
  return true
}

async function deleteUser (id, email) {
  if (!confirm(`Remover metadados do usuário ${email || ''}? (auth.users permanece intocado)`)) return
  const res = await fetch(`/admin/api/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    alert(json.error || 'Erro ao remover usuário.')
    return
  }
  loadUsers()
}

function attachRowHandlers () {
  const tbody = document.getElementById('users-tbody')
  if (!tbody) return
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const tr = btn.closest('tr[data-id]')
    if (!tr) return
    const id = tr.getAttribute('data-id')
    const email = tr.children[1]?.textContent || ''
    const action = btn.getAttribute('data-action')
    if (action === 'delete') {
      await deleteUser(id, email)
    } else if (action === 'make-admin') {
      if (await updateUser(id, { role: 'admin' })) loadUsers()
    } else if (action === 'make-pro') {
      if (await updateUser(id, { plan: 'pro' })) loadUsers()
    } else if (action === 'make-free') {
      if (await updateUser(id, { role: null, plan: 'free' })) loadUsers()
    }
  })
}

async function init () {
  await ensureToken()
  if (!token) return

  attachRowHandlers()

  const searchInput = document.getElementById('user-search')
  const searchBtn = document.getElementById('btn-user-search')
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      currentPage = 1
      loadUsers()
    })
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        currentPage = 1
        loadUsers()
      }
    })
  }

  // Sair no sidebar
  const sidebarSair = document.getElementById('admin-sidebar-sair')
  if (sidebarSair) {
    sidebarSair.addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = '/login.html'
    })
  }

  loadUsers()
}

init().catch(e => {
  console.error('[admin-usuarios] Erro ao inicializar:', e)
})

