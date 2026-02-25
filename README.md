# Linux Simulados

Plataforma web para simulados de certificações Linux (LPIC-1 e planejados LPIC-2, Docker, CKA/CKAD), com artigos, links úteis, progresso do usuário e painel administrativo.

---

## Índice

- [Visão geral](#visão-geral)
- [Stack tecnológica](#stack-tecnológica)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e execução local](#instalação-e-execução-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Documentação adicional](#documentação-adicional)
- [Licença](#licença)

---

## Visão geral

- **Público:** Simulados (LPIC-1 com exames 101, 102 e misto), artigos, links úteis, progresso por sessão.
- **Autenticação:** Supabase Auth (OAuth com Google). Sessão no cliente; APIs protegidas por Bearer token quando necessário.
- **Admin:** Painel restrito a usuários com `role = admin` na base ou a um e-mail configurado via variável de ambiente. CRUD de simulados, exames, questões, artigos, links e gestão de usuários (tipo Free/Pro/Admin).
- **Deploy:** Servidor Node único; front estático servido pelo mesmo processo. Preparado para hospedagem em plataformas como Render; variáveis de ambiente para CORS e Redis opcional.

Nenhuma informação sensível (chaves, domínios reais, e-mails ou dados de usuário) é documentada neste repositório. Configuração é feita via `.env` (ver [Variáveis de ambiente](#variáveis-de-ambiente) e [.env.example](.env.example)).

---

## Stack tecnológica

| Camada        | Tecnologia |
|---------------|------------|
| Runtime       | Node.js (ES modules) |
| Servidor HTTP | `http` nativo (sem framework) |
| Backend       | `server.js` (API REST + arquivos estáticos) |
| Autenticação  | Supabase Auth (OAuth Google) |
| Banco de dados| Supabase (PostgreSQL + PostgREST) |
| Frontend      | HTML, CSS, JavaScript (módulos ES6, sem bundler) |
| Rate limit    | Em memória ou Redis (opcional, para múltiplas instâncias) |

---

## Estrutura do projeto

```
.
├── server.js                 # Entrada do servidor (API + estáticos)
├── package.json
├── .env.example              # Modelo de variáveis (nunca commitar .env)
├── README.md
├── CONTRIBUTING.md           # Guia para contribuições
├── docs/
│   ├── ARCHITECTURE.md       # Arquitetura e fluxos
│   ├── API.md                # Referência das rotas da API
│   ├── DATA_MODEL.md         # Modelo de dados (Supabase)
│   ├── DEPLOYMENT.md         # Deploy (ex.: Render)
│   ├── SECURITY.md           # Práticas de segurança
│   ├── PROJECT_SPEC.md       # Especificação do projeto (escopo, funcionalidades)
│   └── PERFORMANCE.md       # Otimização e boas práticas
└── public/
    ├── index.html            # Página inicial
    ├── login.html, logout.html
    ├── simulados.html, simulado.html, simulado-lpic1.html
    ├── progresso.html
    ├── artigos.html, artigo.html
    ├── saiba-mais.html       # FAQ, política, contato
    ├── css/                  # Ex.: donation-modal.css
    ├── js/                   # Módulos do frontend
    │   ├── supabase-auth.js, user-area.js, login.js, logout.js, require-auth.js, track-login.js
    │   ├── cards-auth.js, admin-entry.js, admin-auth.js
    │   ├── artigos-home.js, artigos-public.js, artigo-public.js
    │   ├── links-public.js
    │   ├── progresso-engine.js, progresso-data.js, progress-sync.js
    │   ├── simulado-lpic1-engine.js, simulado-engine.js, simulados-cards.js
    │   ├── admin-*.js        # Painel admin (artigos com import .md, links, questões, simulados, usuários)
    │   ├── mobile-menu.js, newsletter-popup.js, donation-modal.js, faq-accordion.js
    │   └── hash-capture.js, track-login.js
    └── admin/                # Páginas do painel admin
        ├── index.html, artigos.html, links.html, usuarios.html, questoes.html, simulados.html
        └── (uploads em public/uploads/artigos e public/uploads/links; ou Supabase Storage)
```

---

## Pré-requisitos

- **Node.js** 18+ (recomendado LTS)
- Conta **Supabase** (projeto com Auth e tabelas configuradas)
- Para rate limit distribuído (opcional): instância **Redis** e variável `REDIS_URL`

---

## Instalação e execução local

1. Clone o repositório (ou use o código já disponível).
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Copie o arquivo de exemplo de ambiente e preencha com os valores do seu projeto Supabase (e opcionais):

   ```bash
   cp .env.example .env
   # Edite .env com SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e, se usar admin completo, SUPABASE_SERVICE_ROLE_KEY
   ```

4. Inicie o servidor:

   ```bash
   npm start
   ```

   O servidor sobe em `http://localhost:3000` (ou na porta definida em `PORT` no `.env`).

5. Acesse no navegador: `http://localhost:3000`. O front carrega a configuração do Supabase via `GET /api/config` (URL e chave anon vêm do `.env`).

---

## Variáveis de ambiente

Todas as variáveis são configuradas no `.env` (local) ou nas variáveis de ambiente do serviço (produção). **Nunca commitar o arquivo `.env`.**

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `PORT` | Não (default 3000) | Porta do servidor HTTP. |
| `SUPABASE_URL` | Sim | URL do projeto Supabase (ex.: `https://seu-projeto.supabase.co`). |
| `SUPABASE_PUBLISHABLE_KEY` | Sim | Chave anon (pública) do Supabase. Usada pelo servidor e exposta ao front via `/api/config`. |
| `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` | Não | Chave de serviço do Supabase. Necessária para listar usuários Auth, stats do admin e operações que contornam RLS. **Nunca expor no frontend.** |
| `ADMIN_EMAIL` | Não | Se definido, este e-mail tem acesso ao painel admin independente da tabela `users`. |
| `ALLOWED_ORIGINS` | Não | Origens permitidas para CORS, separadas por vírgula (ex.: `https://seusite.com,https://www.seusite.com`). Se não definido, aceita localhost e `*.supabase.co`. |
| `REDIS_URL` | Não | URL do Redis para rate limit distribuído (útil com múltiplas instâncias). Se não definido, usa rate limit em memória por instância. |
| `SUPABASE_STORAGE_BUCKET_ARTIGOS` | Não | Nome do bucket no Supabase Storage para imagens de capa dos artigos. Se definido (com chave de serviço), uploads vão para o Storage e a URL persiste após deploy. |

Detalhes e exemplos seguros estão em [.env.example](.env.example). Para deploy em produção, ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Documentação adicional

| Documento | Conteúdo |
|-----------|----------|
| [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | **Especificação do projeto:** escopo, funcionalidades, stack e decisões técnicas. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, fluxo de autenticação, admin e dados. |
| [docs/API.md](docs/API.md) | Listagem das rotas da API (públicas e admin), métodos e autenticação. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Tabelas do Supabase e responsabilidades (sem dados sensíveis). |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy em produção (ex.: Render), checklist de variáveis e CORS. |
| [docs/SECURITY.md](docs/SECURITY.md) | Medidas de segurança (CORS, rate limit, headers, auth, uploads). |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Otimização, desempenho e boas práticas. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Como contribuir com o projeto. |

---

## Licença

ISC. Ver [package.json](package.json) e, se existir, arquivo `LICENSE` na raiz do repositório.
