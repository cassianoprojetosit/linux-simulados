/**
 * Script de login (carregado como módulo por login.html).
 * Mantido em arquivo externo para cumprir CSP: script-src não permite inline.
 */
(async function () {
  let supabase, loginWithGoogle
  try {
    const mod = await import('/js/supabase-auth.js')
    supabase = mod.supabase
    loginWithGoogle = mod.loginWithGoogle
  } catch (e) {
    console.error('Falha ao carregar módulo de auth:', e)
    return
  }

  document.body.addEventListener('click', function (e) {
    if (!e.target.closest('#google-btn')) return
    e.preventDefault()
    if (typeof loginWithGoogle === 'function') {
      loginWithGoogle().catch(function (err) {
        console.error('Erro ao executar login:', err)
      })
    }
  })

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const params = new URLSearchParams(window.location.search)
      const redirect = params.get('redirect')
      const allowed = ['simulados.html', 'progresso.html', 'simulado-lpic1.html']
      const target = redirect && allowed.includes(redirect) ? '/' + redirect : '/index.html'
      window.location.href = target
    }
  } catch (e) {
    console.error('Erro ao verificar sessão:', e)
  }
})()
