/**
 * Popup "Deseja receber novidades por e-mail?" — só aparece uma vez por sessão de login.
 * Ao trocar de tela não reaparece; ao fazer logout e login de novo, aparece de novo.
 * Bloqueia a tela até o usuário clicar em Sim ou Não.
 */
import { supabase } from '/js/supabase-auth.js'

const POPUP_ID = 'newsletter-popup-wrap'
const SESSION_KEY = 'newsletter_popup_shown'
const OPT_IN_STORAGE_KEY = 'newsletter_opt_in'

function getOrCreatePopup() {
  let wrap = document.getElementById(POPUP_ID)
  if (wrap) return wrap

  wrap = document.createElement('div')
  wrap.id = POPUP_ID
  wrap.setAttribute('aria-modal', 'true')
  wrap.setAttribute('aria-labelledby', 'newsletter-popup-title')
  wrap.setAttribute('role', 'dialog')
  wrap.innerHTML =
    '<style>#' + POPUP_ID + '{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);pointer-events:auto}' +
    '#' + POPUP_ID + ' .newsletter-popup{background:var(--surface,#111827);border:1px solid var(--border,rgba(255,255,255,0.07));border-radius:16px;max-width:380px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.5);pointer-events:auto}' +
    '#' + POPUP_ID + ' .newsletter-popup h2{font-family:var(--font-title,Syne,sans-serif);font-size:1.15rem;margin-bottom:8px;color:var(--text,#e2e8f0)}' +
    '#' + POPUP_ID + ' .newsletter-popup p{margin-bottom:20px;font-size:0.9rem;color:var(--muted,#64748b);line-height:1.5}' +
    '#' + POPUP_ID + ' .newsletter-popup-btns{display:flex;gap:10px;justify-content:flex-end}' +
    '#' + POPUP_ID + ' .newsletter-popup-btn{padding:10px 18px;border-radius:8px;font-size:0.875rem;font-weight:500;cursor:pointer;font-family:inherit;border:none;transition:opacity 0.2s}' +
    '#' + POPUP_ID + ' .newsletter-popup-btn:hover{opacity:0.9}' +
    '#' + POPUP_ID + ' .newsletter-popup-btn.ghost{background:transparent;color:var(--muted,#64748b);border:1px solid var(--border,rgba(255,255,255,0.07))}' +
    '#' + POPUP_ID + ' .newsletter-popup-btn.primary{background:var(--accent,#00e5a0);color:#0a0e1a}</style>' +
    '<div class="newsletter-popup">' +
    '<h2 id="newsletter-popup-title">Receber novidades?</h2>' +
    '<p>Quer receber avisos de novos simulados e dicas por e-mail?</p>' +
    '<div class="newsletter-popup-btns">' +
    '<button type="button" class="newsletter-popup-btn ghost" data-action="no">Não, obrigado</button>' +
    '<button type="button" class="newsletter-popup-btn primary" data-action="yes">Sim, quero receber</button>' +
    '</div></div>'

  document.body.appendChild(wrap)

  wrap.querySelector('[data-action="no"]').addEventListener('click', () => closePopup(wrap))
  wrap.querySelector('[data-action="yes"]').addEventListener('click', () => confirmYes(wrap))

  return wrap
}

function markPopupShown() {
  try { sessionStorage.setItem(SESSION_KEY, '1') } catch (_) {}
}

function closePopup(wrap) {
  markPopupShown()
  if (wrap && wrap.parentNode) {
    wrap.remove()
    document.body.style.overflow = ''
  }
}

async function confirmYes(wrap) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) {
    closePopup(wrap)
    return
  }
  // Só atualiza newsletter_opt_in (evita conflito com UNIQUE em email)
  const { error } = await supabase
    .from('users')
    .update({ newsletter_opt_in: true })
    .eq('id', session.user.id)
  if (error) {
    console.error('[newsletter] Erro ao salvar aceite:', error.message, error.code)
  }
  try { localStorage.setItem(OPT_IN_STORAGE_KEY, '1') } catch (_) {}
  closePopup(wrap)
}

const ADMIN_ME_URL = '/admin/api/me'

async function isAdmin(session) {
  if (!session?.access_token) return false
  try {
    const res = await fetch(ADMIN_ME_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (!res.ok) return false
    const data = await res.json()
    return data?.success === true && data?.isAdmin === true
  } catch (_) {
    return false
  }
}

async function maybeShowPopup(session) {
  if (!session?.user?.id) return
  if (sessionStorage.getItem(SESSION_KEY) === '1') return
  if (localStorage.getItem(OPT_IN_STORAGE_KEY) === '1') return

  if (await isAdmin(session)) {
    markPopupShown()
    return
  }

  const { data: row, error } = await supabase.from('users').select('newsletter_opt_in').eq('id', session.user.id).maybeSingle()
  if (error) {
    console.warn('[newsletter] Erro ao verificar opt-in:', error.message, error.code)
  }
  if (row?.newsletter_opt_in === true) {
    try { localStorage.setItem(OPT_IN_STORAGE_KEY, '1') } catch (_) {}
    markPopupShown()
    return
  }

  markPopupShown()
  document.body.style.overflow = 'hidden'
  const wrap = getOrCreatePopup()
  wrap.style.display = 'flex'
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event !== 'SIGNED_IN') return
  if (!session) return
  setTimeout(() => maybeShowPopup(session), 800)
})
