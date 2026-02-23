# ============================================================
# LinuxGeek — Especificação: Página "Meu Progresso"
# Feature Spec v1.0 | Fev 2025
# ============================================================
# LEIA COMPLETAMENTE ANTES DE ESCREVER UMA ÚNICA LINHA DE CÓDIGO
# Este documento define TUDO sobre a feature "Meu Progresso":
# o que construir, como construir, o que NÃO tocar, e por quê.
# ============================================================

---

## 📋 CONTEXTO DO PROJETO

O **LinuxGeek** é uma plataforma de simulados para certificações Linux (LPIC-1, LPIC-2,
RHCSA) — 100% gratuita, sem login obrigatório, sem backend. Todo o armazenamento de dados
do usuário usa **`localStorage` do navegador**.

Arquivos existentes no projeto:
- `index.html` — Dashboard principal com grade de simulados, artigos e links
- `simulado-lpic1.html` — Simulado LPIC-1 funcional com 218 questões
- `progresso.html` — **ARQUIVO A SER CRIADO** (esta feature)
- `.cursorrules` — Regras absolutas do projeto (leia também)

---

## 🎯 OBJETIVO DA FEATURE

Criar o arquivo `progresso.html`: uma **página de dashboard pessoal** que lê os dados
salvos pelo `localStorage` após cada simulado concluído, e apresenta métricas de
desempenho de forma visual, motivacional e acionável.

**Propósito para o usuário:**
> "Ver claramente onde estou, o quanto evoluí, onde preciso melhorar,
> e sentir que cada simulado que faço me aproxima da certificação."

**Propósito para o negócio:**
> Aumentar retenção e retorno ao site. Usuários que veem seu progresso
> voltam mais vezes, estudam mais, e futuramente convertem em pagantes.

---

## 🚨 REGRAS ABSOLUTAS — NÃO VIOLE

### Design (herdar do projeto)
1. **MESMO design system** do `index.html` — dark theme, variáveis CSS idênticas
2. **MESMAS fontes** — Syne (títulos), Inter (corpo), Space Mono (dados/mono)
3. **MESMO topbar** do `simulado-lpic1.html` — logo LinuxGeek + navegação
4. **MESMA sidebar** do `index.html` — com link "Meu Progresso" como ATIVO
5. **NUNCA** usar cores hardcoded — sempre `var(--green)`, `var(--blue)`, etc.
6. **NUNCA** usar frameworks externos (React, Vue, Bootstrap) — HTML/CSS/JS puro

### Dados
7. **NUNCA** fazer chamadas a APIs externas — todos os dados vêm do `localStorage`
8. **NUNCA** pedir login ou cadastro — a feature funciona anonimamente
9. **SEMPRE** tratar o caso de localStorage vazio com estado empty elegante
10. **SEMPRE** usar `JSON.parse` / `JSON.stringify` para ler/gravar objetos

### Código
11. **Não altere** `index.html` nem `simulado-lpic1.html` — apenas LEIA o contrato
    de dados que o simulado já grava (descrito abaixo) e consuma esses dados
12. **Um único arquivo** `progresso.html` — CSS inline no `<style>`, JS no `<script>`
13. Comentários em português, nomes de função em camelCase descritivo

---

## 💾 CONTRATO DE DADOS — localStorage

O simulado (`simulado-lpic1.html`) deve gravar os dados de cada sessão ao finalizar.
**Se essa gravação ainda não existir no simulado, você precisa adicioná-la lá também.**

### Chave de armazenamento
```
localStorage key: "linuxgeek_progress"
valor: JSON array de objetos SessionRecord
```

### Estrutura de um SessionRecord
```javascript
{
  id: "uuid-timestamp",          // ID único: Date.now().toString()
  simulado: "lpic1",             // identificador do simulado
  simuladoLabel: "LPIC-1",       // nome legível
  exam: "101",                   // "101", "102", ou "mixed"
  mode: "multiple",              // "multiple" ou "text"
  date: "2025-02-20",            // ISO date string: new Date().toISOString().split('T')[0]
  dateTimestamp: 1708387200000,  // Date.now() para ordenação e streak
  duration: 1847,                // segundos totais gastos
  total: 60,                     // total de questões respondidas
  correct: 42,                   // acertos
  wrong: 18,                     // erros
  score: 70,                     // percentual: Math.round((correct/total)*100)
  passed: true,                  // score >= 70 (nota mínima LPI)
  topicsStats: {                 // stats por tópico (já calculado no simulado)
    "101.1": { total: 5, correct: 4, name: "Hardware Configuration" },
    "101.2": { total: 8, correct: 6, name: "Boot the System" },
    // ... demais tópicos
  },
  weakTopics: ["103.5", "104.2"] // tópicos com < 60% de acerto nesta sessão
}
```

### Função de gravação (adicionar em simulado-lpic1.html)
Inserir esta função no JavaScript do simulado, chamando-a ao finalizar:

```javascript
function saveSessionToStorage(sessionData) {
  try {
    const key = 'linuxgeek_progress';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(sessionData);
    // Manter no máximo 200 sessões (evita ultrapassar ~5MB)
    if (existing.length > 200) existing.shift();
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    console.warn('Não foi possível salvar progresso:', e);
  }
}
```

Chamar no `finishSimulado()`, logo antes de exibir o relatório:
```javascript
saveSessionToStorage({
  id: Date.now().toString(),
  simulado: 'lpic1',
  simuladoLabel: 'LPIC-1',
  exam: simuladoConfig.exam,
  mode: simuladoConfig.mode,
  date: new Date().toISOString().split('T')[0],
  dateTimestamp: Date.now(),
  duration: Math.floor((Date.now() - startTime) / 1000),
  total: currentQuestions.length,
  correct: userAnswerStatus.filter(s => s === 'correct').length,
  wrong: userAnswerStatus.filter(s => s === 'incorrect').length,
  score: Math.round((userAnswerStatus.filter(s => s === 'correct').length / currentQuestions.length) * 100),
  passed: Math.round((userAnswerStatus.filter(s => s === 'correct').length / currentQuestions.length) * 100) >= 70,
  topicsStats: topicsStats,
  weakTopics: Object.entries(topicsStats)
    .filter(([_, s]) => (s.correct / s.total) < 0.6)
    .map(([code]) => code)
});
```

---

## 📐 ESTRUTURA DA PÁGINA progresso.html

### Layout geral (herdar do index.html)
```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR (logo + navegação breadcrumb + link Dashboard)  │
├──────────────┬──────────────────────────────────────────┤
│              │  CONTENT                                 │
│   SIDEBAR    │  ┌─────────────────────────────────────┐ │
│              │  │  HERO: título + resumo rápido        │ │
│  Dashboard   │  └─────────────────────────────────────┘ │
│  Simulados   │  ┌──────── MÉTRICAS GLOBAIS ────────────┐ │
│  Progresso ← │  │  [Card] [Card] [Card] [Card]         │ │
│  Artigos     │  └─────────────────────────────────────┘ │
│              │  ┌──── STREAK & CALENDÁRIO ─────────────┐ │
│  Settings    │  │  Dias seguidos + heatmap mensal       │ │
│  Support     │  └─────────────────────────────────────┘ │
│              │  ┌──── EVOLUÇÃO DE NOTA (GRÁFICO) ──────┐ │
│              │  │  Linha do tempo dos últimos simulados │ │
│              │  └─────────────────────────────────────┘ │
│              │  ┌──── HISTÓRICO DE SIMULADOS ──────────┐ │
│              │  │  Tabela: data, nota, duração, status  │ │
│              │  └─────────────────────────────────────┘ │
│              │  ┌──── RECOMENDAÇÕES INTELIGENTES ──────┐ │
│              │  │  Top 3 tópicos para focar hoje        │ │
│              │  └─────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

## 📊 MÉTRICAS A CALCULAR E EXIBIR

### Bloco 1 — Métricas Globais (4 cards no topo)

| Card | Métrica | Cálculo | Cor |
|------|---------|---------|-----|
| Total de Simulados | Count de sessões | `sessions.length` | --green |
| Melhor Nota | Máximo histórico | `Math.max(...sessions.map(s => s.score))` + "%" | --blue |
| Média Geral | Média de todos scores | `avg(sessions.map(s => s.score))` + "%" | --yellow |
| Aprovações | Sessões com score ≥ 70 | `sessions.filter(s => s.passed).length` | --purple |

### Bloco 2 — Streak (Dias de Estudo Consecutivos)

Calcula quantos dias seguidos o usuário fez pelo menos 1 simulado.

```javascript
// Algoritmo de streak
function calcStreak(sessions) {
  if (!sessions.length) return 0;
  
  // Datas únicas ordenadas desc
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  
  let streak = 0;
  let expected = new Date().toISOString().split('T')[0];
  
  for (const date of dates) {
    if (date === expected) {
      streak++;
      // próximo dia esperado = dia anterior
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
}
```

**Exibição visual do streak:**
- Número grande com fogo 🔥 ao lado
- Texto: "X dias seguidos" ou "Comece hoje para iniciar sua sequência!"
- Heatmap dos últimos 30 dias: grade de 30 quadradinhos, coloridos se houve sessão

```javascript
// Gerar heatmap dos últimos 30 dias
function generateHeatmap(sessions) {
  const sessionDates = new Set(sessions.map(s => s.date));
  const heatmap = [];
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
    const sessionsOnDay = sessions.filter(s => s.date === dateStr);
    const avgScore = sessionsOnDay.length 
      ? Math.round(sessionsOnDay.reduce((a,b) => a + b.score, 0) / sessionsOnDay.length)
      : 0;
    
    heatmap.push({
      date: dateStr,
      hasSession: sessionDates.has(dateStr),
      count: sessionsOnDay.length,
      avgScore,
      isToday: i === 0
    });
  }
  return heatmap;
}
```

**CSS do heatmap:**
- Quadradinhos 24x24px com gap 4px
- Sem sessão: `background: var(--surface3)` (cinza escuro)
- Com sessão, score < 70: `background: rgba(251,191,36,0.5)` (amarelo)
- Com sessão, score ≥ 70: `background: var(--green)` + `box-shadow: 0 0 6px var(--green-glow)`
- Hoje sem sessão: borda `1px solid var(--green)` tracejada
- Tooltip no hover: data + "X simulados · média: Y%"

### Bloco 3 — Gráfico de Evolução (linha do tempo)

Usar **SVG puro** para renderizar um gráfico de linha simples (sem bibliotecas).
Mostrar os **últimos 20 simulados** com:
- Eixo Y: 0 a 100 (pontuação)
- Linha vermelha tracejada em Y=70 (nota mínima de aprovação)
- Pontos: verde se passed, vermelho se reprovado
- Tooltip no hover com data e nota

```javascript
// Gerar SVG do gráfico
function renderScoreChart(sessions) {
  const last20 = sessions.slice(-20);
  if (last20.length < 2) return '<p class="chart-empty">Faça pelo menos 2 simulados para ver o gráfico de evolução.</p>';
  
  const W = 600, H = 180, PAD = 30;
  const xStep = (W - PAD * 2) / (last20.length - 1);
  
  // Linha dos pontos
  const points = last20.map((s, i) => {
    const x = PAD + i * xStep;
    const y = H - PAD - ((s.score / 100) * (H - PAD * 2));
    return { x, y, score: s.score, date: s.date, passed: s.passed };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const y70 = H - PAD - (0.70 * (H - PAD * 2));
  
  return `
    <svg viewBox="0 0 ${W} ${H}" class="score-chart">
      <!-- Grid horizontal -->
      ${[0, 25, 50, 75, 100].map(v => {
        const y = H - PAD - (v / 100) * (H - PAD * 2);
        return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" 
                      stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <text x="${PAD - 6}" y="${y + 4}" text-anchor="end" 
                      font-size="9" fill="var(--text-muted)">${v}</text>`;
      }).join('')}
      
      <!-- Linha de aprovação -->
      <line x1="${PAD}" y1="${y70}" x2="${W - PAD}" y2="${y70}"
            stroke="rgba(248,113,113,0.4)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${W - PAD + 4}" y="${y70 + 4}" font-size="9" fill="var(--red)">70%</text>
      
      <!-- Linha de evolução -->
      <path d="${pathD}" fill="none" stroke="var(--green)" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
      
      <!-- Área sob a linha (gradiente) -->
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--green)" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="var(--green)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${pathD} L ${points[points.length-1].x} ${H - PAD} L ${PAD} ${H - PAD} Z"
            fill="url(#chartGrad)"/>
      
      <!-- Pontos -->
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4"
                fill="${p.passed ? 'var(--green)' : 'var(--red)'}"
                stroke="var(--bg)" stroke-width="2"
                class="chart-dot"
                data-score="${p.score}" data-date="${p.date}"/>
      `).join('')}
    </svg>
  `;
}
```

### Bloco 4 — Histórico de Simulados

Tabela com dropdown de filtro por simulado no header e botão de lixeira
por linha para apagar registros individuais.
**Nunca apagar tudo de uma vez — cada remoção é cirúrgica (por sessão).**

### Lógica de filtro

```javascript
// Estado do filtro ativo
let activeFilter = 'all'; // 'all' | 'lpic1' | 'lpic2' | ...

function getFilteredSessions(sessions, filter) {
  if (filter === 'all') return sessions;
  return sessions.filter(s => s.simulado === filter);
}

// Descobrir quais simulados existem no histórico (para popular o select)
function getSimuladosInHistory(sessions) {
  const found = {};
  sessions.forEach(s => {
    if (!found[s.simulado]) {
      found[s.simulado] = s.simuladoLabel; // ex: { lpic1: 'LPIC-1' }
    }
  });
  return found;
}
```

### HTML do header da tabela

```html
<div class="history-header">
  <span class="history-title">HISTÓRICO DE SIMULADOS</span>
  <select id="history-filter" class="history-select">
    <option value="all">Todos os simulados</option>
    <!-- Gerado dinamicamente para cada simulado no histórico -->
    <!-- <option value="lpic1">LPIC-1</option> -->
  </select>
</div>
```

### Colunas da tabela

| Coluna | Exemplo | Observação |
|--------|---------|------------|
| Data | "20/02/2025" | Mais recente no topo |
| Simulado | badge "LPIC-1 · Exam 101" | Sempre visível |
| Questões | "42/60" | — |
| Nota | "70%" | Verde ≥ 70, vermelho < 70 |
| Tempo | "31min 20s" | — |
| Status | badge "Aprovado" / "Reprovado" | Verde / vermelho |
| Ação | botão 🗑 | Apagar aquela sessão individualmente |

Mostrar as **últimas 10 sessões** do filtro ativo por padrão.
Botão "Ver todas" expande para mostrar o histórico completo do filtro ativo.

### Lógica de remoção por linha

```javascript
function deleteSession(sessionId) {
  try {
    const all = loadSessions();
    const remaining = all.filter(s => s.id !== sessionId);
    localStorage.setItem('linuxgeek_progress', JSON.stringify(remaining));
    renderProgressPage();
  } catch (e) {
    console.warn('Erro ao apagar sessão:', e);
  }
}
```

O botão 🗑 de cada linha chama `promptDeleteSession(session)` que abre
o modal com os dados específicos daquela sessão antes de confirmar.

### Bloco 5 — Recomendações Inteligentes

Baseado nos dados históricos, gerar 3 recomendações acionáveis:

```javascript
function generateRecommendations(sessions) {
  const recs = [];
  
  // 1. Média abaixo de 70% — incentivo a melhorar
  const avg = sessions.length
    ? Math.round(sessions.reduce((a, b) => a + b.score, 0) / sessions.length)
    : 0;
  if (avg < 70 && sessions.length >= 2) {
    recs.push({
      icon: '🎯',
      title: 'Sua média ainda está abaixo de 70%',
      desc: `Média atual: ${avg}%. O exame oficial exige 70% para aprovação. Continue praticando!`,
      action: { label: 'Fazer novo simulado', href: 'simulado-lpic1.html' }
    });
  }
  
  // 2. Streak / consistência
  const streak = calcStreak(sessions);
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
      title: `Sequência de ${streak} dia${streak > 1 ? 's' : ''}!`,
      desc: 'Continue assim! A consistência é o principal fator de sucesso em certificações.',
      action: { label: 'Manter a sequência', href: 'simulado-lpic1.html' }
    });
  }
  
  // 3. Nota próxima da aprovação
  const lastSession = sessions[sessions.length - 1];
  if (lastSession && lastSession.score >= 60 && lastSession.score < 70) {
    recs.push({
      icon: '📈',
      title: 'Você está quase aprovando!',
      desc: `Sua última nota foi ${lastSession.score}%. Mais ${70 - lastSession.score}% e você passa no exame oficial.`,
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
```

---

## 🎨 ESTADO VAZIO (Empty State)

Quando não há dados no localStorage, exibir um estado vazio acolhedor e motivacional
**em vez de zeros e gráficos em branco**:

```html
<!-- Estado vazio -->
<div class="empty-state">
  <div class="empty-icon">🐧</div>
  <h2>Seu progresso aparece aqui</h2>
  <p>Você ainda não completou nenhum simulado. Faça seu primeiro agora e 
     acompanhe sua evolução rumo à certificação LPIC-1.</p>
  <a href="simulado-lpic1.html" class="btn">▶ Fazer meu primeiro simulado</a>
</div>
```

CSS do empty state:
```css
.empty-state {
  text-align: center;
  padding: 80px 40px;
  color: var(--text-dim);
}
.empty-icon { font-size: 64px; margin-bottom: 20px; }
.empty-state h2 { font-family: 'Syne', sans-serif; color: #fff; margin-bottom: 12px; }
.empty-state p { max-width: 400px; margin: 0 auto 28px; line-height: 1.7; }
```

---

## 🧩 COMPONENTES CSS NOVOS (adicionar ao progresso.html)

Seguem os componentes específicos desta página. **Copie os componentes base do
`index.html`** (topbar, sidebar, card, btn, etc.) e adicione apenas estes:

```css
/* === MÉTRICAS GLOBAIS === */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.metric-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
}

.metric-card.green::before { background: var(--green); }
.metric-card.blue::before  { background: var(--blue); }
.metric-card.yellow::before { background: var(--yellow); }
.metric-card.purple::before { background: var(--purple); }

.metric-value {
  font-family: 'Syne', sans-serif;
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.metric-value.green  { color: var(--green); }
.metric-value.blue   { color: var(--blue); }
.metric-value.yellow { color: var(--yellow); }
.metric-value.purple { color: var(--purple); }

.metric-label {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* === STREAK DISPLAY === */
.streak-block {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.streak-number {
  font-family: 'Syne', sans-serif;
  font-size: 52px;
  font-weight: 800;
  color: var(--green);
  line-height: 1;
}

.streak-fire { font-size: 36px; }
.streak-label { font-size: 13px; color: var(--text-dim); }
.streak-label strong { color: var(--text); display: block; font-size: 16px; margin-bottom: 2px; }

/* === HEATMAP === */
.heatmap-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 32px;
}

.heatmap-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.heatmap-grid {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.heatmap-day {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: var(--surface3);
  cursor: default;
  position: relative;
  transition: transform 0.1s;
}

.heatmap-day:hover { transform: scale(1.2); z-index: 1; }

.heatmap-day.has-session { background: rgba(0,255,136,0.3); }
.heatmap-day.passed      { background: var(--green); box-shadow: 0 0 8px var(--green-glow); }
.heatmap-day.today-empty { border: 2px dashed rgba(0,255,136,0.4); }
.heatmap-day.today-done  { background: var(--green); box-shadow: 0 0 12px var(--green-glow); }

/* === GRÁFICO SVG === */
.chart-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 32px;
  overflow: hidden;
}

.score-chart {
  width: 100%;
  height: auto;
  display: block;
}

.chart-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}

/* === TABELA DE HISTÓRICO === */
.history-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0;
  margin-bottom: 32px;
  overflow: hidden;
}

.history-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th {
  padding: 10px 16px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
}

.history-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}

.history-table tr:last-child td { border-bottom: none; }
.history-table tr:hover td { background: rgba(255,255,255,0.02); }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}

.status-badge.passed {
  background: var(--green-dim);
  border: 1px solid rgba(0,255,136,0.2);
  color: var(--green);
}

.status-badge.failed {
  background: var(--red-dim);
  border: 1px solid rgba(248,113,113,0.2);
  color: var(--red);
}

.score-value.good { color: var(--green); font-weight: 600; font-family: 'Space Mono', monospace; }
.score-value.bad  { color: var(--red);   font-weight: 600; font-family: 'Space Mono', monospace; }

/* === RECOMENDAÇÕES === */
.recs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.rec-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-icon { font-size: 24px; }
.rec-title { font-size: 14px; font-weight: 600; color: var(--text); }
.rec-desc  { font-size: 12px; color: var(--text-dim); line-height: 1.6; flex: 1; }
.rec-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--green);
  text-decoration: none;
  margin-top: 4px;
}
.rec-action:hover { text-decoration: underline; }

/* === BOTÃO LIMPAR HISTÓRICO === */
.clear-btn {
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.2s;
}

.clear-btn:hover { border-color: var(--red); color: var(--red); }

/* === RESPONSIVO === */
@media (max-width: 900px) {
  .metrics-grid { grid-template-columns: 1fr 1fr; }
  .recs-grid    { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .metrics-grid { grid-template-columns: 1fr 1fr; }
  .history-table th:nth-child(4),
  .history-table td:nth-child(4) { display: none; } /* ocultar coluna Tempo no mobile */
}
```

---

## 🔗 NAVEGAÇÃO — ATUALIZAR SIDEBAR

Na sidebar do `progresso.html`, o item "Meu Progresso" deve ter classe `active`:
```html
<a href="progresso.html" class="nav-item active">
  <span class="icon">📊</span> Meu Progresso
</a>
```

Também atualizar o `index.html` para que o link do nav item "Meu Progresso" aponte
corretamente para `progresso.html`:
```html
<!-- No index.html, sidebar -->
<a href="progresso.html" class="nav-item">
  <span class="icon">📊</span> Meu Progresso
</a>
```

---

## ⚠️ TRATAMENTO DE ERROS

Sempre envolver leitura do localStorage em try/catch:
```javascript
function loadSessions() {
  try {
    const raw = localStorage.getItem('linuxgeek_progress');
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Erro ao ler progresso:', e);
    return [];
  }
}
```

Se `sessions.length === 0`, mostrar empty state em TODOS os blocos.
Não renderizar gráficos ou tabelas vazios — sempre empty state com CTA.

---

## 📱 COMPORTAMENTO DA LIXEIRA E MODAL DE CONFIRMAÇÃO

### Regra principal
**NUNCA existe um botão que apague múltiplas sessões de uma vez.**
Cada linha tem sua própria lixeira 🗑 — a remoção é sempre de um registro por vez.

### Fluxo completo

1. Usuário vê a tabela com todas as sessões
2. Clica na lixeira 🗑 de uma linha específica
3. Abre modal mostrando os dados daquela sessão:
   *"Apagar este registro? Data: 20/02/2025 · LPIC-1 · Nota: 70%"*
4. Confirma → remove APENAS aquela sessão pelo `id`
5. Tabela rerenderiza sem aquela linha
6. Se não restar nenhuma sessão → mostrar empty state global

### Modal de confirmação (sem alert())

```html
<div id="confirm-modal" class="hidden">
  <div class="modal-overlay">
    <div class="modal-box">
      <h3>Apagar este registro?</h3>
      <p id="modal-desc"><!-- preenchido dinamicamente --></p>
      <div class="modal-actions">
        <button id="confirm-no"  class="btn-secondary">Cancelar</button>
        <button id="confirm-yes" class="btn-danger">Sim, apagar</button>
      </div>
    </div>
  </div>
</div>
```

### JavaScript do modal e remoção

```javascript
function promptDeleteSession(session) {
  const modal = document.getElementById('confirm-modal');
  const desc  = document.getElementById('modal-desc');

  const dateFormatted = new Date(session.dateTimestamp)
    .toLocaleDateString('pt-BR');

  desc.textContent = `Data: ${dateFormatted} · ${session.simuladoLabel} · Nota: ${session.score}%`;

  modal.classList.remove('hidden');

  document.getElementById('confirm-yes').onclick = () => {
    deleteSession(session.id);
    modal.classList.add('hidden');
  };

  document.getElementById('confirm-no').onclick = () => {
    modal.classList.add('hidden');
  };
}

function deleteSession(sessionId) {
  try {
    const all       = loadSessions();
    const remaining = all.filter(s => s.id !== sessionId);
    localStorage.setItem('linuxgeek_progress', JSON.stringify(remaining));
    renderProgressPage();
  } catch (e) {
    console.warn('Erro ao apagar sessão:', e);
  }
}
```

### CSS do botão lixeira e select de filtro

```css
/* Botão lixeira por linha */
.delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  line-height: 1;
}
.delete-btn:hover { color: var(--red); background: var(--red-dim); }

/* Select de filtro no header */
.history-select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-dim);
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  padding: 6px 10px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.history-select:focus { border-color: var(--green); color: var(--text); }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  backdrop-filter: blur(4px);
}

.modal-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
  max-width: 420px;
  width: 90%;
  text-align: center;
}

.modal-box h3 {
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  color: #fff;
  margin-bottom: 10px;
}

.modal-box p {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 24px;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
```

---

## 🚀 CHECKLIST DE ENTREGA

Antes de considerar a feature concluída, confirme:

- [ ] `progresso.html` criado com layout 100% fiel ao `index.html`
- [ ] Sidebar com "Meu Progresso" ativo
- [ ] 4 cards de métricas globais funcionando
- [ ] Streak calculado corretamente
- [ ] Heatmap dos últimos 30 dias renderizando
- [ ] Gráfico SVG de evolução de notas funcionando
- [ ] Tabela com dropdown de filtro por simulado funcionando
- [ ] Cada linha tem botão lixeira 🗑 discreto
- [ ] Clicar na lixeira abre modal com dados da sessão (data, simulado, nota)
- [ ] Confirmar apaga APENAS aquela sessão pelo id
- [ ] Cancelar preserva todos os dados
- [ ] Empty state exibido quando não restar nenhuma sessão
- [ ] Recomendações inteligentes geradas dinamicamente
- [ ] Código de gravação adicionado ao `simulado-lpic1.html` (`saveSessionToStorage`)
- [ ] Link "Meu Progresso" atualizado no `index.html`
- [ ] Responsivo em mobile (< 600px) funcionando
- [ ] Nenhuma variável CSS hardcoded (tudo usando `var(--)`)
- [ ] Nenhuma biblioteca externa importada
- [ ] Testado com localStorage vazio (empty state)
- [ ] Testado com 1 sessão, 5 sessões, 20+ sessões
