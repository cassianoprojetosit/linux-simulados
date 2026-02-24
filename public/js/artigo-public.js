/**
 * Carrega um artigo por slug na página /artigo.html (pública).
 * Arquivo externo para respeitar CSP (script-src 'self').
 */
(async function () {
  const params = new URLSearchParams(window.location.search)
  const slug = params.get('slug')
  const wrap = document.getElementById('article-wrap')
  if (!wrap) return
  if (!slug) {
    wrap.innerHTML = '<p id="load-err">Artigo não encontrado.</p>'
    return
  }
  try {
    const res = await fetch('/api/artigos/' + encodeURIComponent(slug))
    const json = await res.json()
    if (!res.ok || !json.data) {
      wrap.innerHTML = '<p id="load-err">Artigo não encontrado.</p>'
      return
    }
    const a = json.data
    const date = a.published_at ? new Date(a.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''
    let body = a.content || ''
    if (a.content_type === 'md' && typeof marked !== 'undefined') body = marked.parse(body)
    const coverUrl = (a.cover_image_url || '').trim()
    const heroHtml = coverUrl
      ? '<div class="article-hero"><img src="' + coverUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" alt="Capa do artigo"></div>'
      : ''
    wrap.innerHTML =
      heroHtml +
      '<div class="article-header">' +
      '<h1 class="article-title">' + (a.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</h1>' +
      '<div class="article-meta">' + (a.author_name ? a.author_name.replace(/</g, '&lt;') : '') + (date ? ' · ' + date : '') + '</div>' +
      '</div>' +
      '<div class="article-body-wrap"><div class="article-body">' + body + '</div></div>'
    if (coverUrl) {
      const bodyEl = wrap.querySelector('.article-body')
      const firstImg = bodyEl && bodyEl.querySelector('img')
      if (firstImg) firstImg.classList.add('article-cover-img')
    }
  } catch (e) {
    wrap.innerHTML = '<p id="load-err">Erro ao carregar o artigo.</p>'
  }
})()
