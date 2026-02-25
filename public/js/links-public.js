/**
 * Carrega os links úteis na seção "Links & Serviços Linux" da página inicial.
 */
(function () {
  const grid = document.getElementById('links-grid')
  if (!grid) return

  const defaultIcons = ['🏛️', '🐧', '📖', '⚡', '🔍', '🎮']

  function esc(s) {
    if (s == null) return ''
    const div = document.createElement('div')
    div.textContent = String(s)
    return div.innerHTML
  }

  function labelClass(label) {
    if (!label) return ''
    const n = String(label).toLowerCase().normalize('NFD').replace(/\u0307/g, '').replace(/[\u0300-\u036f]/g, '')
    if (n === 'oficial') return ' sponsored-label-oficial'
    if (n === 'referencia') return ' sponsored-label-referencia'
    if (n === 'ferramenta') return ' sponsored-label-ferramenta'
    if (n === 'pratica') return ' sponsored-label-pratica'
    return ''
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '<span style="color:var(--muted);grid-column:1/-1;">Nenhum link cadastrado.</span>'
      return
    }
    grid.innerHTML = list.map(function (item, i) {
      const url = (item.url || '').trim()
      const href = url ? esc(url) : '#'
      const label = esc(item.label || '')
      const name = esc(item.name || '')
      const desc = esc((item.description || '').slice(0, 80)) + (item.description && item.description.length > 80 ? '…' : '')
      const iconHtml = item.icon_url
        ? '<img src="' + esc(item.icon_url) + '" alt="">'
        : defaultIcons[i % defaultIcons.length]
      const labelCls = 'sponsored-label' + labelClass(item.label || '')
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="sponsored-card">' +
        (label ? '<span class="' + labelCls + '">' + label + '</span>' : '') +
        '<span class="sponsored-icon">' + iconHtml + '</span>' +
        '<div class="sponsored-name">' + name + '</div>' +
        (desc ? '<div class="sponsored-desc">' + desc + '</div>' : '') +
        '</a>'
    }).join('')
  }

  fetch('/api/links')
    .then(function (r) { return r.json() })
    .then(function (data) {
      render(data.data || [])
    })
    .catch(function () {
      grid.innerHTML = '<span style="color:var(--muted);grid-column:1/-1;">Não foi possível carregar os links.</span>'
    })
})()
