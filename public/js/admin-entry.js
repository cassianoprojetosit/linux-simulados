/**
 * Botão "Painel Admin" na página inicial.
 * Só é exibido quando o servidor confirma que o usuário é admin (GET /admin/api/me).
 * Não usa email no front — a decisão de quem é admin fica apenas no servidor.
 */
import { supabase } from '/js/supabase-auth.js'

const WRAP_ID = 'admin-entry-wrap'
const MOBILE_WRAP_ID = 'mobile-admin-wrap'
const ME_URL = '/admin/api/me'

function setAdminEntryVisible (visible) {
  const wrap = document.getElementById(WRAP_ID)
  if (wrap) {
    wrap.style.display = visible ? 'block' : 'none'
    wrap.setAttribute('aria-hidden', visible ? 'false' : 'true')
  }
  const mobileWrap = document.getElementById(MOBILE_WRAP_ID)
  if (mobileWrap) {
    mobileWrap.style.display = visible ? 'block' : 'none'
    mobileWrap.setAttribute('aria-hidden', visible ? 'false' : 'true')
  }
}

async function checkAdminAndShow (session) {
  if (!session?.access_token) {
    setAdminEntryVisible(false)
    return
  }
  try {
    const res = await fetch(ME_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (!res.ok) {
      setAdminEntryVisible(false)
      return
    }
    const data = await res.json()
    setAdminEntryVisible(data?.success === true && data?.isAdmin === true)
  } catch (_) {
    setAdminEntryVisible(false)
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  checkAdminAndShow(session)
})
