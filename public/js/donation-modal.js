/**
 * Modal de doações: Solana, Bitcoin, Ethereum.
 * - Segurança: endereços só exibidos; escape Html/Attr contra XSS; href com scheme em allowlist (solana:|bitcoin:|ethereum:).
 * - Desempenho: modal criado no primeiro clique; QR lib carregada sob demanda (lazy).
 * - Acessibilidade: foco no botão fechar ao abrir; foco devolvido ao trigger ao fechar.
 * Incluir em páginas que tenham .sidebar e #mobile-menu-overlay.
 */
(function() {
    // Configure aqui os endereços das wallets (públicos, apenas exibição)
    const WALLETS = {
        solana: {
            name: 'Solana',
            address: '4nPoP7crE3Saw2TRrsucGZXhwfm3iqUpz1XeGo6gDXst',
            scheme: 'solana:'
        },
        btc: {
            name: 'Bitcoin',
            address: 'bc1przw5um26682j9rzap9tpmgvgwzjn67gtu7tjpz0acwdnme69e0gsyg3qyn',
            scheme: 'bitcoin:'
        },
        eth: {
            name: 'Ethereum',
            address: '0xdf0C6Aff8E2A270B0C013f179B2693f369480403',
            scheme: 'ethereum:'
        }
    };

    const QR_SCRIPT = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    const MODAL_ID = 'donation-modal-backdrop';
    const MODAL_BODY_ID = 'donation-modal-body';

    function hasAddresses() {
        const a = WALLETS.solana.address || '';
        const b = WALLETS.btc.address || '';
        const c = WALLETS.eth.address || '';
        return (a + b + c).replace(/\s/g, '').length > 0;
    }

    function createDonationLink() {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-link donation-trigger';
        a.setAttribute('role', 'button');
        a.innerHTML = '<span class="nav-icon">❤️</span> Doar';
        a.addEventListener('click', function(e) {
            e.preventDefault();
            openModal(e);
        });
        return a;
    }

    function injectSidebarDonation() {
        const nav = document.querySelector('.sidebar .nav');
        if (!nav || nav.querySelector('.donation-trigger')) return;
        // .sidebar-footer é irmão do .nav, não filho — só append no nav
        const section = document.createElement('div');
        section.className = 'nav-section';
        section.textContent = 'Apoie';
        const link = createDonationLink();
        nav.appendChild(section);
        nav.appendChild(link);
    }

    function injectMobileDonation() {
        const content = document.querySelector('#mobile-menu-overlay .mobile-menu-content');
        const adminWrap = document.getElementById('mobile-admin-wrap');
        if (!content || content.querySelector('.donation-trigger')) return;
        const section = document.createElement('div');
        section.className = 'nav-section';
        section.textContent = 'Apoie';
        const link = createDonationLink();
        link.classList.add('nav-link');
        if (adminWrap) {
            content.insertBefore(section, adminWrap);
            content.insertBefore(link, adminWrap);
        } else {
            content.appendChild(section);
            content.appendChild(link);
        }
    }

    function getModal() {
        let el = document.getElementById(MODAL_ID);
        if (el) return el;
        el = document.createElement('div');
        el.id = MODAL_ID;
        el.className = 'donation-modal-backdrop';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML =
            '<div class="donation-modal" role="dialog" aria-labelledby="donation-modal-title">' +
            '  <div class="donation-modal-header">' +
            '    <h2 id="donation-modal-title">Apoie o projeto</h2>' +
            '    <button type="button" class="donation-modal-close" aria-label="Fechar">×</button>' +
            '  </div>' +
            '  <div class="donation-modal-body" id="' + MODAL_BODY_ID + '">' +
            '    <p class="donation-intro">Escolha a rede, escaneie o QR code ou copie o endereço.</p>' +
            '    <div class="donation-networks"></div>' +
            '  </div>' +
            '</div>';
        document.body.appendChild(el);

        var closeBtn = el.querySelector('.donation-modal-close');
        closeBtn.addEventListener('click', closeModal);
        el.addEventListener('click', function(e) {
            if (e.target === el) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && el.classList.contains('open')) {
                closeModal();
            }
        });
        el._donationCloseBtn = closeBtn;
        return el;
    }

    var _lastDonationTrigger = null;
    function openModal(ev) {
        if (ev && ev.currentTarget) _lastDonationTrigger = ev.currentTarget;
        var mobileOverlay = document.getElementById('mobile-menu-overlay');
        if (mobileOverlay) mobileOverlay.classList.remove('open');
        const modal = getModal();
        const body = document.getElementById(MODAL_BODY_ID);
        const networksEl = body && body.querySelector('.donation-networks');
        if (!networksEl) return;
        if (!body.dataset.donationBuilt) {
            buildNetworks(body);
            body.dataset.donationBuilt = '1';
        }
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function() {
            buildAndDrawQr();
            var btn = modal._donationCloseBtn;
            if (btn && typeof btn.focus === 'function') btn.focus();
        });
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (_lastDonationTrigger && typeof _lastDonationTrigger.focus === 'function') {
            _lastDonationTrigger.focus();
            _lastDonationTrigger = null;
        }
    }

    function buildNetworks(body) {
        const container = body.querySelector('.donation-networks');
        if (!container) return;
        container.innerHTML = '';
        if (!hasAddresses()) {
            container.innerHTML = '<p class="donation-intro" style="margin:0">Configure os endereços das wallets no arquivo <code>js/donation-modal.js</code> (objeto WALLETS).</p>';
            return;
        }
        ['solana', 'btc', 'eth'].forEach(function(key) {
            const w = WALLETS[key];
            if (!w || !w.address || !String(w.address).trim()) return;
            const card = document.createElement('div');
            card.className = 'donation-network-card';
            card.innerHTML =
                '<div class="donation-network-name">' + escapeHtml(w.name) + '</div>' +
                '<div class="donation-qr-wrap" data-address="' + escapeAttr(w.address) + '" data-network="' + key + '"></div>' +
                '<div class="donation-address-wrap">' +
                '  <code class="donation-address donation-address-short" title="' + escapeAttr(w.address) + '">' + escapeHtml(shortenAddress(w.address)) + '</code>' +
                '  <code class="donation-address-full">' + escapeHtml(w.address) + '</code>' +
                '  <button type="button" class="donation-copy" data-address="' + escapeAttr(w.address) + '" title="Copiar endereço">Copiar</button>' +
                '</div>' +
                (allowedScheme(w.scheme) ? '<a href="' + escapeAttr(w.scheme + w.address) + '" class="donation-wallet-link" target="_blank" rel="noopener noreferrer">Abrir na carteira</a>' : '');
            container.appendChild(card);
        });
        container.querySelectorAll('.donation-copy').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const addr = btn.getAttribute('data-address');
                if (!addr) return;
                copyToClipboard(addr, btn);
            });
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }
    function escapeAttr(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function shortenAddress(addr) {
        if (!addr || addr.length < 20) return addr;
        return addr.slice(0, 10) + '…' + addr.slice(-8);
    }

    var ALLOWED_SCHEMES = { 'solana:': 1, 'bitcoin:': 1, 'ethereum:': 1 };
    function allowedScheme(s) {
        return s && ALLOWED_SCHEMES[s] === 1;
    }

    function copyToClipboard(text, buttonEl) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                showCopyFeedback(buttonEl);
            }).catch(function() {
                fallbackCopy(text, buttonEl);
            });
        } else {
            fallbackCopy(text, buttonEl);
        }
    }
    function fallbackCopy(text, buttonEl) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showCopyFeedback(buttonEl);
        } catch (e) {}
        document.body.removeChild(ta);
    }
    function showCopyFeedback(buttonEl) {
        const label = buttonEl.textContent;
        buttonEl.textContent = 'Copiado!';
        buttonEl.disabled = true;
        setTimeout(function() {
            buttonEl.textContent = label;
            buttonEl.disabled = false;
        }, 2000);
    }

    function loadQrScript(callback) {
        if (window.QRCode) {
            callback();
            return;
        }
        const script = document.createElement('script');
        script.src = QR_SCRIPT;
        script.onload = callback;
        script.onerror = function() {
            console.warn('Donation modal: QR library failed to load');
            callback();
        };
        document.head.appendChild(script);
    }

    function drawQrInContainers() {
        const wraps = document.querySelectorAll('.donation-qr-wrap');
        wraps.forEach(function(wrap) {
            if (wrap.dataset.qrDone) return;
            const address = wrap.getAttribute('data-address');
            if (!address) return;
            wrap.innerHTML = '';
            try {
                if (window.QRCode) {
                    new window.QRCode(wrap, {
                        text: address,
                        width: 128,
                        height: 128
                    });
                    wrap.dataset.qrDone = '1';
                }
            } catch (e) {
                wrap.innerHTML = '<span class="donation-qr-fallback">QR indisponível</span>';
            }
        });
    }

    function buildAndDrawQr() {
        const body = document.getElementById(MODAL_BODY_ID);
        if (!body || !body.dataset.donationBuilt) return;
        loadQrScript(drawQrInContainers);
    }

    // Inicialização
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        injectSidebarDonation();
        injectMobileDonation();
        // Modal criado sob demanda no primeiro openModal() (melhor desempenho)
    }
})();
