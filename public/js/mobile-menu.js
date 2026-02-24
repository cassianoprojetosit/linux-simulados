/**
 * Menu mobile: abre overlay em tela cheia ao clicar no ícone; fecha ao escolher um link ou no backdrop.
 */
(function () {
  function init() {
    var btn = document.getElementById('btn-mobile-menu')
    var overlay = document.getElementById('mobile-menu-overlay')
    if (!btn || !overlay) return

    btn.addEventListener('click', function () {
      overlay.classList.add('open')
    })

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('.mobile-menu-close')) {
        overlay.classList.remove('open')
      }
    })

    overlay.querySelectorAll('.mobile-menu-content a').forEach(function (a) {
      a.addEventListener('click', function () {
        overlay.classList.remove('open')
      })
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
