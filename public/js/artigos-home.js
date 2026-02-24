/**
 * Preenche a seção "Artigos & Recursos" na página inicial com artigos da API.
 * Mantém o padrão: 1 card em destaque + lista de mini cards.
 */
(function () {
  const grid = document.getElementById('artigos-home')
  if (!grid) return

  const icons = ['🚀', '🔧', '🌐', '🔐', '📦', '📚', '🐧', '⚙️']

  function esc(s) {
    if (s == null) return ''
    const div = document.createElement('div')
    div.textContent = String(s)
    return div.innerHTML
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '<p class="articles-empty" style="grid-column:1/-1;padding:24px;color:var(--muted);text-align:center;">Nenhum artigo publicado ainda.</p>'
      return
    }

    const [featured, ...rest] = list
    const slug = (featured.slug || '').trim()
    const href = slug ? '/artigo.html?slug=' + encodeURIComponent(slug) : '#'
    const title = esc(featured.title || '')
    const excerpt = (featured.excerpt || '').slice(0, 140) + (featured.excerpt && featured.excerpt.length > 140 ? '…' : '')
    const author = esc(featured.author_name || '')
    const date = formatDate(featured.published_at)
    const heroHtml = featured.cover_image_url
      ? '<img src="' + esc(featured.cover_image_url) + '" alt="">'
      : icons[0]

    const featuredCard =
      '<a href="' + href + '" class="article-card">' +
      '<div class="article-hero-img">' + heroHtml + '</div>' +
      '<div class="article-body">' +
      '<div class="article-tag">' + author + '</div>' +
      '<div class="article-title">' + title + '</div>' +
      '<div class="article-desc">' + esc(excerpt) + '</div>' +
      '<div class="article-meta">' +
      '<span>📅 ' + date + '</span>' +
      '<span style="margin-left:auto;color:var(--accent)">Ler artigo →</span>' +
      '</div></div></a>'

    const miniItems = rest.slice(0, 4).map(function (a, i) {
      const s = (a.slug || '').trim()
      const h = s ? '/artigo.html?slug=' + encodeURIComponent(s) : '#'
      const icon = a.cover_image_url
        ? '<img src="' + esc(a.cover_image_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">'
        : icons[(i + 1) % icons.length]
      return '<a href="' + h + '" class="article-mini">' +
        '<div class="mini-icon">' + icon + '</div>' +
        '<div><div class="mini-title">' + esc((a.title || '').slice(0, 50)) + (a.title && a.title.length > 50 ? '…' : '') + '</div>' +
        '<div class="mini-tag">' + esc(a.author_name || '') + ' • ' + formatDate(a.published_at) + '</div></div></a>'
    }).join('')

    grid.innerHTML = featuredCard + '<div class="article-list">' + miniItems + '</div>'
  }

  fetch('/api/artigos')
    .then(function (r) { return r.json() })
    .then(function (data) {
      const list = data.data || []
      render(list)
    })
    .catch(function () {
      grid.innerHTML = '<p class="articles-error" style="grid-column:1/-1;padding:24px;color:var(--muted);text-align:center;">Não foi possível carregar os artigos.</p>'
    })
})()
