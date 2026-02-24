/**
 * Carrega a lista de artigos na página /artigos.html (pública).
 * Arquivo externo para respeitar CSP (script-src 'self').
 */
(async function () {
  const grid = document.getElementById('artigos-grid')
  if (!grid) return
  const show = (html) => { grid.innerHTML = html }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch('/api/artigos', { signal: ctrl.signal })
    clearTimeout(t)
    const json = await res.json().catch(() => ({}))
    const list = json.data || []
    if (!res.ok) {
      show('<p style="color:var(--muted);grid-column:1/-1;">Não foi possível carregar os artigos. Tente recarregar a página.</p>')
      return
    }
    if (list.length === 0) {
      show('<p style="color:var(--muted);grid-column:1/-1;">Nenhum artigo publicado ainda.</p>')
      return
    }
    const icons = ['🚀', '🔧', '🌐', '🔐', '📦', '📚', '🐧', '⚙️']
    show(list.map((a, i) => {
      const href = '/artigo.html?slug=' + encodeURIComponent(a.slug || '')
      const excerpt = (a.excerpt || '').slice(0, 120) + (a.excerpt && a.excerpt.length > 120 ? '…' : '')
      const date = a.published_at ? new Date(a.published_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : ''
      const iconHtml = a.cover_image_url
        ? '<img src="' + String(a.cover_image_url).replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" alt="" style="width:100%;height:100%;object-fit:cover;">'
        : icons[i % icons.length]
      return '<a href="' + href + '" class="article-card">' +
        '<div class="article-hero-img">' + iconHtml + '</div>' +
        '<div class="article-body">' +
        '<div class="article-tag">' + (a.author_name || '') + '</div>' +
        '<div class="article-title">' + (a.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '<div class="article-desc">' + (excerpt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '<div class="article-meta"><span>📅 ' + date + '</span></div>' +
        '</div></a>'
    }).join(''))
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Demorou demais. Verifique sua conexão e recarregue.' : 'Erro ao carregar artigos. Tente recarregar a página.'
    show('<p style="color:var(--muted);grid-column:1/-1;">' + msg + '</p>')
  }
})()
