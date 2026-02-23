# ============================================================
# LinuxGeek V2 — Especificação Completa de Produto e Arquitetura
# Documento Estratégico + Técnico | Fev 2025
# ============================================================
# Este documento define TUDO sobre a próxima versão da plataforma:
# produto, negócio, tecnologia, segurança, banco de dados,
# painel admin e roadmap de monetização.
# Leia antes de escrever qualquer linha de código.
# ============================================================

---

## 🧭 POR QUE ESTAMOS RECOMEÇANDO

### O que a V1 entregou (preservar e migrar)
- Design system dark tech profissional e aprovado ✓
- Simulado LPIC-1 funcional com 218 questões ✓
- Dashboard, página de progresso (localStorage) ✓
- Identidade visual e estrutura de navegação ✓

### O que a V1 não resolve (motivação da V2)
- Questões embutidas no HTML — impossível gerenciar sem código
- Sem banco de dados — progresso perdido ao trocar dispositivo
- Sem autenticação — não é possível diferenciar free de premium
- Sem painel admin — adicionar simulado exige editar código
- Sem escalabilidade — não suporta múltiplos simulados, usuários, artigos

### Filosofia da V2
> Manter 100% do que foi construído visualmente.
> Trocar apenas o que está por baixo — a infraestrutura.
> Resultado: mesma experiência para o usuário, poder total para o admin.

---

## 🏆 ANÁLISE DE MERCADO — CONCORRENTES E OPORTUNIDADES

### Plataformas de referência analisadas

**Whizlabs** (whizlabs.com)
- Foco exclusivo em simulados de certificação IT (AWS, Azure, GCP, Linux)
- Modelo: freemium com planos anuais (~$20-99/ano por certificação)
- Diferenciais: laboratórios práticos, explicações por questão, modo flashcard
- Fraqueza: interface datada, sem PT-BR, preço em dólar afasta brasileiros

**ExamTopics** (examtopics.com)
- Banco de questões gratuito com discussão por questão
- Modelo: freemium agressivo — limite de questões por dia para free
- Diferenciais: comunidade ativa discutindo cada questão
- Fraqueza: questões de procedência duvidosa, sem modo simulado cronometrado

**Udemy (simulados)** 
- Modelo: venda única por curso ($10-50)
- Diferenciais: marca forte, variedade de certificações
- Fraqueza: compra única sem atualização, sem progresso cross-device, sem gamificação

**Passei Direto** (brasil, passeidireto.com)
- Modelo freemium para estudantes com plano premium
- Diferenciais: UX moderna, conteúdo em PT-BR, comunidade brasileira
- Fraqueza: foco em faculdade, não em certificações IT

### Oportunidade identificada para o LinuxGeek
O mercado brasileiro de certificações Linux/IT não tem uma plataforma
dedicada, em PT-BR, com UX moderna, gratuita na entrada e com planos
premium acessíveis. É um nicho com demanda crescente (LPIC, RHCSA,
AWS são requisitos em vagas de emprego) e baixíssima concorrência local.

### Modelo de negócio recomendado: Freemium + Assinatura Mensal

| Plano | Preço | O que inclui |
|-------|-------|--------------|
| **Free** | R$0 | LPIC-1 completo, progresso no dispositivo, sem login |
| **Pro** | R$19,90/mês | Todos os simulados, progresso cloud, histórico permanente, sem anúncios |
| **Pro Anual** | R$149/ano | Tudo do Pro com desconto (~37%), badge exclusivo |

**Por que esse modelo funciona:**
- Free generoso converte visitantes em usuários fiéis
- Preço acessível para público BR (diferencial vs Whizlabs em dólar)
- Receita recorrente (assinatura) é mais previsível que venda única
- O progresso cloud é o principal gatilho de conversão: o usuário free
  perde o histórico ao trocar de dispositivo e converte para Pro

---

## 🏗️ ARQUITETURA TÉCNICA DA V2

### Stack recomendada

**Frontend:** HTML + CSS + JavaScript vanilla (manter identidade visual V1)
- Mesmas fontes, variáveis CSS, design system
- Sem React ou Vue — evitar complexidade desnecessária
- Templates HTML renderizados via Jinja2/EJS no servidor

**Backend:** Node.js + Express.js
- API REST para autenticação, questões, progresso e admin
- JWT para autenticação de usuários
- Google OAuth 2.0 para login social

**Banco de dados:** PostgreSQL
- Relacional, robusto, gratuito, excelente para dados estruturados
- Hospedagem: Supabase (gratuito até 500MB, inclui auth e API automática)
  ou Railway (simples de configurar, barato)

**Hosting:** Vercel (frontend) + Railway ou Render (backend + PostgreSQL)
- Custo inicial: R$0 a R$50/mês
- Escala automaticamente com crescimento

**Alternativa simplificada (recomendada para começar):**
Usar **Supabase** como backend completo:
- Banco PostgreSQL gerenciado
- Autenticação pronta (email, Google OAuth) sem código próprio
- API REST automática para todas as tabelas
- Painel admin web para gerenciar dados
- Custo: gratuito para até ~50k usuários ativos
- Reduz drasticamente a complexidade de backend

### Por que Supabase é a escolha certa para agora
1. Você tem 0 código de backend hoje — Supabase elimina 80% do backend
2. Autenticação Google OAuth pronta em 15 minutos
3. Painel visual para gerenciar questões (igual ao que você pediu)
4. Migração futura para backend próprio é possível sem perder dados
5. Dashboard de banco de dados já é o seu painel admin inicial

---

## 🗄️ MODELAGEM DO BANCO DE DADOS

### Diagrama de tabelas

```
users
  id (uuid, PK)
  email (varchar, unique)
  name (varchar)
  avatar_url (varchar)
  plan (enum: 'free' | 'pro')
  plan_expires_at (timestamp)
  created_at (timestamp)
  last_login_at (timestamp)
  google_id (varchar, nullable)

simulados
  id (uuid, PK)
  slug (varchar, unique) -- ex: 'lpic1', 'rhcsa'
  title (varchar) -- ex: 'LPIC-1'
  description (text)
  is_active (boolean)
  is_premium (boolean) -- false = disponível no free
  passing_score (integer) -- padrão: 70
  created_at (timestamp)

exams
  id (uuid, PK)
  simulado_id (uuid, FK -> simulados)
  code (varchar) -- ex: '101', '102'
  title (varchar) -- ex: 'System Architecture'
  created_at (timestamp)

questions
  id (uuid, PK)
  exam_id (uuid, FK -> exams)
  type (enum: 'multiple' | 'text')
  question (text)
  options (jsonb) -- [{ letter: 'A', text: '...' }] para múltipla escolha
  answer (jsonb) -- ['A'] ou ['comando'] — array para suportar múltiplas
  topic (varchar) -- ex: '101.1'
  difficulty (enum: 'easy' | 'medium' | 'hard')
  hint (text, nullable)
  explanation (text, nullable) -- explicação da resposta correta (premium)
  weight (integer, default: 1)
  is_active (boolean, default: true)
  created_at (timestamp)

sessions
  id (uuid, PK)
  user_id (uuid, FK -> users, nullable) -- null para usuários anônimos/free
  simulado_id (uuid, FK -> simulados)
  exam_code (varchar)
  mode (varchar)
  score (integer)
  total (integer)
  correct (integer)
  wrong (integer)
  duration (integer) -- segundos
  passed (boolean)
  session_data (jsonb) -- respostas detalhadas, stats por tópico
  created_at (timestamp)

articles
  id (uuid, PK)
  title (varchar)
  slug (varchar, unique)
  excerpt (text)
  url (varchar) -- link externo ou caminho interno
  category (varchar)
  emoji (varchar)
  is_active (boolean)
  sort_order (integer)
  created_at (timestamp)

links
  id (uuid, PK)
  name (varchar)
  description (varchar)
  url (varchar)
  emoji (varchar)
  label (varchar) -- ex: 'Oficial', 'Parceiro', 'Recurso'
  is_active (boolean)
  sort_order (integer)
  created_at (timestamp)
```

---

## 🔐 AUTENTICAÇÃO E SEGURANÇA

### Fluxo de autenticação

**Usuário Free (sem login):**
- Acessa tudo do plano free sem cadastro
- Progresso salvo no localStorage (comportamento V1)
- Ao tentar acessar recurso premium → prompt de cadastro

**Usuário cadastrado (login email/Google):**
- Sessão mantida via JWT (token no cookie httpOnly)
- Progresso salvo no banco de dados (tabela sessions)
- Histórico disponível em qualquer dispositivo

**Admin:**
- Usuário com flag `role = 'admin'` no banco
- Acesso ao painel /admin protegido por middleware
- Autenticação separada — nunca exposta ao público

### Regras de segurança obrigatórias

1. **Senhas:** nunca armazenar em texto puro — usar bcrypt (salt rounds: 12)
2. **JWT:** token com expiração de 7 dias, refresh token de 30 dias
3. **HTTPS:** obrigatório em produção — certificado SSL via Let's Encrypt
4. **CORS:** configurado para aceitar apenas domínios autorizados
5. **Rate limiting:** máximo 100 requisições/minuto por IP (previne brute force)
6. **Sanitização:** todas as entradas do admin validadas e sanitizadas (prevent XSS/SQLi)
7. **Variáveis de ambiente:** NUNCA commitar .env no repositório (usar .gitignore)
8. **Painel admin:** rota /admin acessível APENAS com IP whitelist + autenticação
9. **Questões:** usuários free nunca recebem explicações (campo explanation)
   — filtrar no backend, nunca no frontend
10. **Backup:** backup automático do banco a cada 24h (Supabase faz isso nativo)

### Variáveis de ambiente necessárias (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=string_aleatoria_muito_longa
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ADMIN_EMAIL=seu@email.com
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
NODE_ENV=production
PORT=3000
```

---

## 🛠️ PAINEL ADMINISTRATIVO (/admin)

### Visão geral
O painel admin é uma área protegida do próprio site (não um sistema separado).
Acessível apenas pelo administrador. Interface simples, funcional e eficiente —
não precisa ser bonita, precisa ser produtiva.

### Módulos do painel

#### 1. Dashboard Admin
- Total de usuários (free / pro)
- Total de sessões hoje / semana / mês
- Simulados mais usados
- Taxa de conversão free → pro
- Últimos cadastros

#### 2. Gerenciar Simulados
Listagem de todos os simulados com toggle ativo/inativo.
Criar novo simulado:
```
Campos:
- Título (ex: "LPIC-2")
- Slug (ex: "lpic2") — gerado automaticamente
- Descrição
- Nota mínima de aprovação (padrão: 70%)
- Plano necessário (Free / Pro)
- Status (Ativo / Rascunho)
```

#### 3. Gerenciar Questões (o mais importante)
**Import em lote via JSON** — formato padronizado:
```json
[
  {
    "exam": "101",
    "topic": "101.1",
    "type": "multiple",
    "question": "Qual comando exibe os módulos do kernel carregados?",
    "options": [
      { "letter": "A", "text": "modinfo" },
      { "letter": "B", "text": "lsmod" },
      { "letter": "C", "text": "insmod" },
      { "letter": "D", "text": "rmmod" }
    ],
    "answer": ["B"],
    "difficulty": "easy",
    "hint": "Lista os módulos carregados atualmente",
    "explanation": "O lsmod lê /proc/modules e exibe os módulos..."
  }
]
```

**Interface de criação individual:**
- Formulário com todos os campos
- Preview da questão antes de salvar
- Validação: pergunta + resposta obrigatórios, mínimo 2 opções para múltipla

**Ações por questão:**
- Editar / Desativar / Ativar / Excluir
- Filtrar por: simulado, tópico, dificuldade, tipo, status

#### 4. Gerenciar Artigos
```
Campos:
- Título
- URL (link externo ou caminho interno /artigos/slug)
- Excerpt (resumo)
- Categoria
- Emoji
- Ordem de exibição
- Status (ativo/inativo)
```

#### 5. Gerenciar Links Úteis
```
Campos:
- Nome
- URL
- Descrição curta
- Emoji
- Label (Oficial / Parceiro / Recurso / Gratuito)
- Ordem
- Status
```

#### 6. Gerenciar Usuários
- Lista de usuários com plano e data de cadastro
- Busca por email
- Alterar plano manualmente (free ↔ pro)
- Bloquear/desbloquear usuário
- Ver histórico de sessões de um usuário

#### 7. Configurações do Site
- Título e descrição do site
- Modo manutenção (exibe página de aviso para visitantes)
- Banner de aviso global (ex: "Nova certificação disponível!")
- Configurações de email (SMTP para notificações)

### Tecnologia do painel admin
Opção recomendada: **Supabase Studio** (já incluso no Supabase)
- É literalmente o painel que você descreveu — gerencia tabelas, cria registros,
  importa CSV/JSON, filtra, ordena
- Zero desenvolvimento necessário
- Você acessa em supabase.com/dashboard com seu login

Para painel customizado (futuro, quando precisar de lógica específica):
- Usar AdminJS ou Retool (low-code admin panels)
- Ou construir /admin em HTML vanilla com as mesmas APIs do Supabase

---

## 📁 ESTRUTURA DE ARQUIVOS DA V2

```
linuxgeek-v2/
├── .env                          ← variáveis de ambiente (não commitar)
├── .env.example                  ← template sem valores reais (commitar)
├── .gitignore
├── package.json
├── README.md
│
├── public/                       ← arquivos estáticos servidos diretamente
│   ├── css/
│   │   └── design-system.css     ← variáveis CSS, fontes, componentes base
│   ├── js/
│   │   ├── simulado-engine.js    ← lógica do simulado (migrada do V1)
│   │   └── progress.js           ← lógica da página de progresso
│   └── assets/
│       ├── favicon.ico
│       └── og-image.png          ← imagem para compartilhamento social
│
├── views/                        ← templates HTML (EJS ou Handlebars)
│   ├── layouts/
│   │   └── main.html             ← topbar + sidebar (shared)
│   ├── index.html                ← dashboard público
│   ├── simulado.html             ← tela do simulado (genérica)
│   ├── progresso.html            ← página de progresso
│   ├── login.html                ← página de login
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── simulados.html
│   │   ├── questoes.html
│   │   ├── artigos.html
│   │   └── usuarios.html
│   └── errors/
│       ├── 404.html
│       └── 500.html
│
├── server/                       ← backend Node.js
│   ├── index.js                  ← entry point
│   ├── config/
│   │   ├── database.js           ← conexão PostgreSQL/Supabase
│   │   └── auth.js               ← configuração Google OAuth + JWT
│   ├── middleware/
│   │   ├── auth.middleware.js    ← verifica JWT
│   │   ├── admin.middleware.js   ← verifica role admin
│   │   └── ratelimit.middleware.js
│   ├── routes/
│   │   ├── public.routes.js      ← rotas sem auth
│   │   ├── auth.routes.js        ← login, logout, oauth callback
│   │   ├── api.routes.js         ← API para o frontend
│   │   └── admin.routes.js       ← rotas do painel admin
│   └── services/
│       ├── questions.service.js  ← lógica de seleção de questões
│       ├── sessions.service.js   ← salvar/buscar sessões
│       └── users.service.js      ← gerenciar usuários
│
└── scripts/
    └── migrate-v1-questions.js   ← script para importar questões do V1
```

---

## 🚀 PLANO DE MIGRAÇÃO V1 → V2

### Passo 1: Setup da infraestrutura (1-2 dias)
- [ ] Criar conta no Supabase
- [ ] Criar projeto e aplicar schema do banco (tabelas acima)
- [ ] Configurar Google OAuth no Supabase
- [ ] Criar repositório Git com estrutura de arquivos

### Passo 2: Migrar questões do V1 (1 dia)
- [ ] Extrair JSON embutido no `simulado-lpic1.html`
- [ ] Rodar script `migrate-v1-questions.js` para popular banco
- [ ] Validar: 218 questões importadas corretamente

### Passo 3: Frontend estático (2-3 dias)
- [ ] Migrar design system (CSS variables) para `design-system.css`
- [ ] Converter `index.html` para consumir dados da API
- [ ] Converter `simulado.html` para carregar questões via API
- [ ] Converter `progresso.html` para usar sessões do banco (quando logado)
  ou localStorage (quando anônimo)

### Passo 4: Autenticação (1-2 dias)
- [ ] Implementar login com Google OAuth via Supabase Auth
- [ ] Tela de login/cadastro seguindo design system
- [ ] Middleware de proteção de rotas premium
- [ ] Persistência de sessão com cookie seguro

### Passo 5: Painel admin (2-3 dias)
- [ ] Usar Supabase Studio para gerenciamento inicial
- [ ] Criar interface /admin simplificada para import de questões em JSON
- [ ] Formulários de criação/edição de artigos e links

### Passo 6: Deploy (1 dia)
- [ ] Deploy frontend no Vercel
- [ ] Deploy backend no Railway ou Render
- [ ] Configurar domínio linuxgeek.com.br
- [ ] Configurar SSL/HTTPS automático
- [ ] Testar tudo em produção antes de divulgar

---

## 💰 ESTRATÉGIA DE MONETIZAÇÃO DETALHADA

### Fase 1 — Captura de audiência (agora até 1.000 usuários)
- Tudo gratuito, sem fricção, sem cadastro obrigatório
- Foco em SEO: artigos sobre Linux, certificações, carreira DevOps
- Meta: aparecer no Google para "simulado lpic-1 português"

### Fase 2 — Ativação (1.000 a 5.000 usuários)
- Introduzir login opcional com Google (fácil, sem senha)
- Benefício imediato do login: salvar progresso no servidor
- Mensagem de conversão: "Você perdeu seu progresso ao trocar de PC?
  Faça login com Google e nunca mais perca."

### Fase 3 — Monetização (5.000+ usuários)
- Lançar plano Pro com LPIC-2 + RHCSA como conteúdo exclusivo
- Preço: R$19,90/mês ou R$149/ano
- Implementar Stripe ou Mercado Pago para pagamentos

### Gatilhos de conversão free → pro
1. **Conteúdo bloqueado:** ao tentar acessar LPIC-2, ver mensagem de upgrade
2. **Progresso perdido:** ao limpar histórico ou trocar dispositivo
3. **Explicações detalhadas:** questões erradas mostram "Ver explicação (Pro)"
4. **Limite soft:** após X simulados no mês, exibir banner de upgrade (não bloquear)

### Projeção conservadora de receita
| Usuários ativos | Conversão 3% | Receita mensal |
|-----------------|--------------|----------------|
| 1.000 | 30 Pro | R$597 |
| 5.000 | 150 Pro | R$2.985 |
| 10.000 | 300 Pro | R$5.970 |
| 50.000 | 1.500 Pro | R$29.850 |

---

## 📋 REGRAS PARA O CURSOR — V2

### O que NUNCA mudar
1. Design system: cores, fontes, variáveis CSS — idênticos ao V1
2. Comportamento do simulado: timer, feedback, progresso
3. Estrutura de navegação: topbar + sidebar

### O que SEMPRE fazer
1. Questões e conteúdo vêm SEMPRE da API/banco, nunca hardcoded no HTML
2. Rotas premium verificadas SEMPRE no backend, nunca só no frontend
3. Senhas SEMPRE com bcrypt, nunca texto puro
4. Variáveis de ambiente SEMPRE via process.env, nunca hardcoded
5. SQL SEMPRE via ORM ou queries parametrizadas, nunca concatenação de string

### Padrão de API REST
```
GET    /api/simulados              → lista simulados ativos
GET    /api/simulados/:slug        → dados de um simulado
GET    /api/simulados/:slug/questions → questões (filtra premium no backend)
POST   /api/sessions               → salvar resultado de simulado
GET    /api/sessions               → histórico do usuário logado

POST   /api/auth/google            → OAuth callback
POST   /api/auth/logout
GET    /api/auth/me                → dados do usuário logado

GET    /admin/api/questions        → admin: listar questões
POST   /admin/api/questions        → admin: criar questão
POST   /admin/api/questions/import → admin: importar JSON em lote
PUT    /admin/api/questions/:id    → admin: editar
DELETE /admin/api/questions/:id    → admin: excluir
```

### Tratamento de erros padrão
```javascript
// Todas as rotas da API retornam este formato:
{
  success: boolean,
  data: any | null,
  error: string | null,
  code: number // HTTP status
}
```

---

## ✅ CHECKLIST DE ENTREGA DA V2

### Infraestrutura
- [ ] Banco de dados criado no Supabase com todas as tabelas
- [ ] Google OAuth configurado e funcionando
- [ ] Variáveis de ambiente configuradas (nunca no código)
- [ ] Deploy em produção com HTTPS

### Funcionalidades core
- [ ] Dashboard carregando simulados do banco
- [ ] Simulado carregando questões do banco via API
- [ ] Resultado salvo no banco para usuários logados
- [ ] Progresso carregando do banco (logado) ou localStorage (anônimo)
- [ ] Login com Google funcionando
- [ ] Diferenciação free/pro no backend

### Painel admin
- [ ] Login admin protegido por autenticação
- [ ] Import de questões via JSON funcionando
- [ ] CRUD de artigos e links funcionando
- [ ] Dashboard com métricas básicas

### Segurança
- [ ] Rate limiting ativo
- [ ] CORS configurado
- [ ] Rotas admin inacessíveis sem autenticação
- [ ] Campos premium filtrados no backend
- [ ] .env não commitado no repositório

### Migração
- [ ] 218 questões do V1 importadas corretamente
- [ ] Links e artigos existentes migrados para o banco
- [ ] Nenhuma funcionalidade do V1 perdida
