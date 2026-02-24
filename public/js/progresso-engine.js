/**
 * Meu Progresso: métricas, heatmap, gráfico, histórico e recomendações.
 * Arquivo externo para cumprir CSP (script-src não permite inline).
 */
(function() {
    const KEY = 'linuxgeek_progress';
    var activeFilter = 'all';

    function escapeHtml(text) {
        if (text == null) return '';
        var div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function loadSessions() {
        if (window.__sessions !== undefined) return window.__sessions;
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return [];
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.warn('Erro ao ler progresso:', e);
            return [];
        }
    }

    function calcStreak(sessions) {
        if (!sessions.length) return 0;
        const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
        let streak = 0;
        let expected = new Date().toISOString().split('T')[0];
        for (const date of dates) {
            if (date === expected) {
                streak++;
                const d = new Date(expected);
                d.setDate(d.getDate() - 1);
                expected = d.toISOString().split('T')[0];
            } else {
                break;
            }
        }
        return streak;
    }

    function generateHeatmap(sessions) {
        const sessionDates = new Set(sessions.map(s => s.date));
        const heatmap = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const sessionsOnDay = sessions.filter(s => s.date === dateStr);
            const avgScore = sessionsOnDay.length
                ? Math.round(sessionsOnDay.reduce((a, b) => a + b.score, 0) / sessionsOnDay.length)
                : 0;
            heatmap.push({
                date: dateStr,
                hasSession: sessionDates.has(dateStr),
                count: sessionsOnDay.length,
                avgScore: avgScore,
                isToday: i === 0
            });
        }
        return heatmap;
    }

    function renderMetrics(sessions) {
        const grid = document.getElementById('metrics-grid');
        if (!grid) return;
        const total = sessions.length;
        const bestScore = total ? Math.max(...sessions.map(s => s.score)) : 0;
        const avgScore = total
            ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / total)
            : 0;
        const passed = sessions.filter(s => s.passed).length;
        grid.innerHTML = ''
            + '<div class="metric-card green">'
            +   '<div class="metric-value green">' + total + '</div>'
            +   '<div class="metric-label">Total de Simulados</div>'
            + '</div>'
            + '<div class="metric-card blue">'
            +   '<div class="metric-value blue">' + bestScore + '%</div>'
            +   '<div class="metric-label">Melhor Nota</div>'
            + '</div>'
            + '<div class="metric-card yellow">'
            +   '<div class="metric-value yellow">' + avgScore + '%</div>'
            +   '<div class="metric-label">Média Geral</div>'
            + '</div>'
            + '<div class="metric-card purple">'
            +   '<div class="metric-value purple">' + passed + '</div>'
            +   '<div class="metric-label">Aprovações</div>'
            + '</div>';
    }

    function renderStreakAndHeatmap(sessions) {
        const streakEl = document.getElementById('streak-block');
        const heatmapWrap = document.getElementById('heatmap-wrap');
        if (!streakEl || !heatmapWrap) return;
        const streak = calcStreak(sessions);
        streakEl.innerHTML = ''
            + '<span class="streak-fire">🔥</span>'
            + '<div class="streak-label">'
            +   '<strong>' + (streak > 0 ? streak + ' dia' + (streak > 1 ? 's' : '') + ' seguidos' : 'Comece hoje para iniciar sua sequência!') + '</strong>'
            +   (streak > 0 ? ' Mantenha o ritmo.' : '')
            + '</div>';
        const heatmap = generateHeatmap(sessions);
        const title = 'Últimos 30 dias';
        let daysHtml = '';
        heatmap.forEach(function(day) {
            let cls = 'heatmap-day';
            if (day.hasSession) {
                if (day.avgScore >= 70) cls += day.isToday ? ' today-done' : ' passed';
                else cls += ' has-session';
            } else if (day.isToday) cls += ' today-empty';
            const tooltip = day.date + (day.hasSession ? ' · ' + day.count + ' simulado' + (day.count > 1 ? 's' : '') + ' · média: ' + day.avgScore + '%' : '');
            daysHtml += '<div class="' + cls + '" title="' + tooltip + '" aria-label="' + tooltip + '"></div>';
        });
        heatmapWrap.innerHTML = '<div class="heatmap-title">' + title + '</div><div class="heatmap-grid">' + daysHtml + '</div>';
    }

    function renderScoreChart(sessions) {
        const last20 = sessions.slice(-20);
        if (last20.length < 2) return '<p class="chart-empty">Faça pelo menos 2 simulados para ver o gráfico de evolução.</p>';
        const W = 600, H = 180, PAD = 30;
        const xStep = (W - PAD * 2) / (last20.length - 1);
        const points = last20.map(function(s, i) {
            const x = PAD + i * xStep;
            const y = H - PAD - ((s.score / 100) * (H - PAD * 2));
            return { x: x, y: y, score: s.score, date: s.date, passed: s.passed };
        });
        const pathD = points.map(function(p, i) { return (i === 0 ? 'M' : 'L') + ' ' + p.x + ' ' + p.y; }).join(' ');
        const y70 = H - PAD - (0.70 * (H - PAD * 2));
        var gridLines = [0, 25, 50, 75, 100].map(function(v) {
            var y = H - PAD - (v / 100) * (H - PAD * 2);
            return '<line x1="' + PAD + '" y1="' + y + '" x2="' + (W - PAD) + '" y2="' + y + '" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>' +
                '<text x="' + (PAD - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="var(--text-muted)">' + v + '</text>';
        }).join('');
        var dotsHtml = points.map(function(p) {
            return '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + (p.passed ? 'var(--green)' : 'var(--red)') + '" stroke="var(--bg)" stroke-width="2" class="chart-dot" data-score="' + p.score + '" data-date="' + p.date + '" title="' + p.date + ' · ' + p.score + '%"/>';
        }).join('');
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="score-chart">' +
            '<!-- Grid horizontal -->' + gridLines +
            '<!-- Linha de aprovação --><line x1="' + PAD + '" y1="' + y70 + '" x2="' + (W - PAD) + '" y2="' + y70 + '" stroke="rgba(248,113,113,0.4)" stroke-width="1" stroke-dasharray="4,4"/>' +
            '<text x="' + (W - PAD + 4) + '" y="' + (y70 + 4) + '" font-size="9" fill="var(--red)">70%</text>' +
            '<!-- Linha de evolução --><path d="' + pathD + '" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>' +
            '<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--green)" stop-opacity="0.15"/><stop offset="100%" stop-color="var(--green)" stop-opacity="0"/></linearGradient></defs>' +
            '<path d="' + pathD + ' L ' + points[points.length - 1].x + ' ' + (H - PAD) + ' L ' + PAD + ' ' + (H - PAD) + ' Z" fill="url(#chartGrad)"/>' +
            '<!-- Pontos -->' + dotsHtml +
            '</svg>';
    }

    function renderChart(sessions) {
        var wrap = document.getElementById('chart-wrap');
        if (!wrap) return;
        wrap.innerHTML = renderScoreChart(sessions);
    }

    function formatDate(isoDate) {
        if (!isoDate) return '—';
        var parts = isoDate.split('T')[0].split('-');
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    function formatDuration(seconds) {
        if (seconds == null || seconds === undefined) return '—';
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return m + 'min ' + (s < 10 ? '0' : '') + s + 's';
    }

    function getFilteredSessions(sessions, filter) {
        if (filter === 'all') return sessions;
        return sessions.filter(function(s) { return s.simulado === filter; });
    }

    function getSimuladosInHistory(sessions) {
        var found = {};
        sessions.forEach(function(s) {
            if (!found[s.simulado]) {
                found[s.simulado] = s.simuladoLabel || s.simulado;
            }
        });
        return found;
    }

    function promptDeleteSession(session) {
        var modal = document.getElementById('confirm-modal');
        var desc = document.getElementById('modal-desc');
        var dateFormatted = session.dateTimestamp
            ? new Date(session.dateTimestamp).toLocaleDateString('pt-BR')
            : formatDate(session.date);
        desc.textContent = 'Data: ' + dateFormatted + ' · ' + (session.simuladoLabel || session.simulado) + ' · Nota: ' + session.score + '%';
        modal.classList.remove('hidden');
        document.getElementById('confirm-yes').onclick = function() {
            deleteSession(session.id);
            modal.classList.add('hidden');
        };
        document.getElementById('confirm-no').onclick = function() {
            modal.classList.add('hidden');
        };
        var overlay = document.getElementById('confirm-modal-overlay');
        if (overlay) overlay.onclick = function() { modal.classList.add('hidden'); };
    }

    function deleteSession(sessionId) {
        try {
            var all = loadSessions();
            var remaining = all.filter(function(s) { return s.id !== sessionId; });
            localStorage.setItem(KEY, JSON.stringify(remaining));
            if (typeof window.deleteProgressSession === 'function') {
                window.deleteProgressSession(sessionId);
            }
            window.__sessions = remaining;
            init();
        } catch (e) {
            console.warn('Erro ao apagar sessão:', e);
        }
    }

    function renderHistoryTable(sessions) {
        var wrap = document.getElementById('history-wrap');
        if (!wrap) return;
        var filtered = getFilteredSessions(sessions, activeFilter);
        var simulados = getSimuladosInHistory(sessions);
        var filterKeys = Object.keys(simulados);
        var selectOptions = '<option value="all"' + (activeFilter === 'all' ? ' selected' : '') + '>Todos os simulados</option>';
        filterKeys.forEach(function(key) {
            selectOptions += '<option value="' + key + '"' + (activeFilter === key ? ' selected' : '') + '>' + (simulados[key] || key) + '</option>';
        });
        var headerHtml = '<div class="history-header">' +
            '<span class="history-title">HISTÓRICO DE SIMULADOS</span>' +
            '<select id="history-filter" class="history-select">' + selectOptions + '</select>' +
            '</div>';
        var sorted = filtered.slice().sort(function(a, b) {
            var ta = (a.dateTimestamp != null ? a.dateTimestamp : (a.date ? new Date(a.date).getTime() : 0));
            var tb = (b.dateTimestamp != null ? b.dateTimestamp : (b.date ? new Date(b.date).getTime() : 0));
            return tb - ta;
        });
        var last10 = sorted.slice(0, 10);
        if (last10.length === 0) {
            wrap.innerHTML = headerHtml + '<div style="padding:24px;color:var(--text-muted);font-size:13px;">Nenhuma sessão registrada' + (activeFilter !== 'all' ? ' para este simulado.' : '.') + '</div>';
            var sel = document.getElementById('history-filter');
            if (sel) sel.addEventListener('change', function() { activeFilter = this.value; renderHistoryTable(loadSessions()); });
            return;
        }
        var th = '<thead><tr><th>Data</th><th>Simulado</th><th>Questões</th><th>Nota</th><th>Tempo</th><th>Status</th><th>Ação</th></tr></thead><tbody>';
        var rows = last10.map(function(s) {
            var scoreClass = s.score >= 70 ? 'good' : 'bad';
            var statusClass = s.passed ? 'passed' : 'failed';
            var statusText = s.passed ? 'Aprovado' : 'Reprovado';
            var simuladoLabel = escapeHtml(s.simuladoLabel || 'Simulado') + ' · Exam ' + escapeHtml(s.exam || '—');
            var sessionId = escapeHtml(String(s.id || '')).replace(/"/g, '&quot;');
            return '<tr>' +
                '<td>' + escapeHtml(formatDate(s.date)) + '</td>' +
                '<td>' + simuladoLabel + '</td>' +
                '<td>' + s.correct + '/' + s.total + '</td>' +
                '<td><span class="score-value ' + scoreClass + '">' + s.score + '%</span></td>' +
                '<td>' + formatDuration(s.duration) + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
                '<td><button type="button" class="delete-btn" data-session-id="' + sessionId + '" title="Apagar este registro">🗑</button></td>' +
                '</tr>';
        }).join('');
        wrap.innerHTML = headerHtml + '<table class="history-table">' + th + rows + '</tbody></table>';
        var sel = document.getElementById('history-filter');
        if (sel) sel.addEventListener('change', function() { activeFilter = this.value; renderHistoryTable(loadSessions()); });
    }

    function generateRecommendations(sessions) {
        var recs = [];
        var streak = calcStreak(sessions);
        if (streak === 0) {
            recs.push({
                icon: '🔥',
                title: 'Inicie sua sequência hoje',
                desc: 'Estudar um pouco todos os dias é mais eficaz do que sessões longas esporádicas.',
                action: { label: 'Fazer um simulado agora', href: 'simulado-lpic1.html' }
            });
        } else if (streak > 0) {
            recs.push({
                icon: '🔥',
                title: 'Sequência de ' + streak + ' dia' + (streak > 1 ? 's' : '') + '!',
                desc: 'Continue assim! A consistência é o principal fator de sucesso em certificações.',
                action: { label: 'Manter a sequência', href: 'simulado-lpic1.html' }
            });
        }
        var lastSession = sessions[sessions.length - 1];
        if (lastSession && lastSession.score >= 60 && lastSession.score < 70) {
            recs.push({
                icon: '📈',
                title: 'Você está quase aprovando!',
                desc: 'Sua última nota foi ' + lastSession.score + '%. Mais ' + (70 - lastSession.score) + '% e você passa no exame oficial.',
                action: { label: 'Tentar novamente', href: 'simulado-lpic1.html' }
            });
        } else if (sessions.length < 3) {
            recs.push({
                icon: '📊',
                title: 'Faça mais simulados para análise',
                desc: 'Com pelo menos 3 simulados conseguimos identificar seus padrões e dar recomendações mais precisas.',
                action: { label: 'Fazer simulado', href: 'simulado-lpic1.html' }
            });
        }
        return recs.slice(0, 3);
    }

    function renderRecommendations(sessions) {
        var grid = document.getElementById('recs-grid');
        if (!grid) return;
        var recs = generateRecommendations(sessions);
        if (recs.length === 0) {
            grid.innerHTML = '';
            return;
        }
        var html = recs.map(function(r) {
            return '<div class="rec-card">' +
                '<span class="rec-icon">' + r.icon + '</span>' +
                '<div class="rec-title">' + r.title + '</div>' +
                '<div class="rec-desc">' + r.desc + '</div>' +
                '<a href="' + (r.action.href || 'simulado-lpic1.html') + '" class="rec-action">' + (r.action.label || 'Fazer simulado') + ' →</a>' +
                '</div>';
        }).join('');
        grid.innerHTML = html;
    }

    function init(sessionsFromEvent) {
        var sessions = sessionsFromEvent !== undefined ? sessionsFromEvent : loadSessions();
        if (!Array.isArray(sessions)) sessions = [];
        var loadingEl = document.getElementById('progress-loading');
        var emptyEl = document.getElementById('empty-state');
        var dataEl = document.getElementById('content-with-data');
        if (!emptyEl || !dataEl) return;
        if (loadingEl) loadingEl.classList.add('hidden');
        if (sessions.length === 0) {
            emptyEl.classList.remove('hidden');
            dataEl.classList.add('hidden');
            return;
        }
        try {
            emptyEl.classList.add('hidden');
            dataEl.classList.remove('hidden');
            renderMetrics(sessions);
            renderStreakAndHeatmap(sessions);
            renderChart(sessions);
            renderHistoryTable(sessions);
            renderRecommendations(sessions);
        } catch (err) {
            console.error('[Meu Progresso] Erro ao renderizar:', err);
        }
    }

    document.body.addEventListener('click', function(e) {
        var target = e.target.closest ? e.target.closest('.delete-btn') : (e.target.classList && e.target.classList.contains('delete-btn') ? e.target : null);
        if (target) {
            var id = target.getAttribute('data-session-id');
            if (id) {
                var sessions = loadSessions();
                var session = sessions.filter(function(s) { return s.id === id; })[0];
                if (session) promptDeleteSession(session);
            }
        }
    });

    function onProgressoReady() {
        var sessions = (typeof window.__sessions !== 'undefined' && Array.isArray(window.__sessions)) ? window.__sessions : loadSessions();
        init(sessions);
    }
    document.addEventListener('progresso-ready', function onReady() {
        document.removeEventListener('progresso-ready', onReady);
        onProgressoReady();
    });
    if (typeof window.__sessions !== 'undefined' && Array.isArray(window.__sessions) && window.__sessions.length > 0) {
        setTimeout(onProgressoReady, 0);
    }
})();
