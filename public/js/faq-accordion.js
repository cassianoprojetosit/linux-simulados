/**
 * Accordion para a seção Perguntas frequentes (Saiba mais).
 * Arquivo externo para respeitar CSP (script-src não permite inline).
 */
(function () {
  var list = document.getElementById('faq-list')
  if (!list) return
  list.addEventListener('click', function (e) {
    var header = e.target.closest('.faq-header')
    if (!header) return
    var item = header.closest('.faq-item')
    var body = item && item.querySelector('.faq-body')
    if (!item || !body) return
    var isOpen = item.classList.contains('open')
    list.querySelectorAll('.faq-item').forEach(function (el) {
      el.classList.remove('open')
      var btn = el.querySelector('.faq-header')
      if (btn) btn.setAttribute('aria-expanded', 'false')
    })
    if (!isOpen) {
      item.classList.add('open')
      header.setAttribute('aria-expanded', 'true')
    }
  })
})()
