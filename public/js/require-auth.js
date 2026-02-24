/**
 * Proteção de rotas: exige login para acessar a página.
 * Carregar em simulados.html e progresso.html (antes do conteúdo).
 * Se não houver sessão, redireciona para login com ?redirect=<página atual>.
 * Só aceita redirect para simulados.html ou progresso.html (evita open redirect).
 */
const ALLOWED_REDIRECTS = ['simulados.html', 'progresso.html', 'simulado-lpic1.html', 'simulado.html']

async function requireAuth() {
  const mod = await import('/js/supabase-auth.js')
  const { data: { session } } = await mod.supabase.auth.getSession()
  if (session) return
  const path = window.location.pathname
  const page = path.slice(path.lastIndexOf('/') + 1) || 'index.html'
  const qs = window.location.search || ''
  const redirectParam = page + qs
  const allowed = ALLOWED_REDIRECTS.includes(page)
  const redirect = allowed ? redirectParam : 'index.html'
  window.location.replace('/login.html?redirect=' + encodeURIComponent(redirect))
}

requireAuth()
