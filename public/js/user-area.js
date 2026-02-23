/**
 * Área do usuário no canto superior direito (foto, nome, botão Sair).
 * Usado em todas as páginas que têm topbar com id="user-area".
 * urlHash vem de hash-capture.js (avaliado antes do supabase-auth graças ao import lá).
 */
import { urlHash } from '/js/hash-capture.js'
import { supabase, logout } from '/js/supabase-auth.js'

function escapeHtml (text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function safeAvatarUrl (url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim().toLowerCase()
  if (t.startsWith('https://') || t.startsWith('data:')) return url
  return ''
}

function renderUser (session) {
  const area = document.getElementById('user-area')
  if (!area) return

  if (session) {
    const rawName = session.user.user_metadata?.full_name?.split(' ')[0] || 'Usuário'
    const name = escapeHtml(rawName)
    const avatar = safeAvatarUrl(session.user.user_metadata?.avatar_url || '')
    area.innerHTML = `
      <div class="user-chip">
        <img src="${avatar}" class="user-avatar" alt="${name}">
        <span class="user-name">${name}</span>
        <button type="button" id="logout-btn" class="logout-btn">Sair</button>
      </div>
    `
    const img = area.querySelector('.user-avatar')
    if (img) img.onerror = function () { this.style.display = 'none' }
    const btn = document.getElementById('logout-btn')
    if (btn) btn.addEventListener('click', logout)
  } else {
    area.innerHTML = '<a href="/login.html" class="btn-login">Entrar com Google</a>'
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  renderUser(session)
})

// 1) Se a URL tinha tokens no hash (redirect OAuth), processar primeiro e setar sessão antes de qualquer outra chamada.
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
        console.error('[user-area] setSession do hash falhou:', error.message)
      } else {
        session = data?.session || sessionFromHash
        try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch (_) {}
      }
    } catch (e) {
      console.error('[user-area] Erro ao processar hash OAuth:', e)
    }
  }
}

// 2) Se ainda não temos sessão, usar a do cliente (storage ou URL processada pelo Supabase).
if (!session) {
  if (typeof supabase.auth.initialize === 'function') await supabase.auth.initialize()
  const result = await supabase.auth.getSession()
  session = result.data?.session ?? null
}

renderUser(session)
