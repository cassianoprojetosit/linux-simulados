# Especificação do projeto — Linux Simulados

Este documento descreve o escopo, as funcionalidades e as decisões do projeto Linux Simulados (especificação de produto e técnico). Serve como referência para desenvolvimento e manutenção.

---

## 1. Visão e objetivos

- **Produto:** Plataforma web para estudo e prática de certificações Linux (LPIC-1 e planejados LPIC-2, Docker, CKA/CKAD).
- **Público:** Pessoas que estudam para certificações Linux e querem simulados, artigos e links úteis.
- **Diferencial:** Conteúdo baseado em domínios públicos e tutoriais; sem provas vazadas; foco em estudo e prática ética (ver política em Saiba mais).

---

## 2. Funcionalidades

### 2.1 Públicas (site)

| Funcionalidade | Descrição |
|----------------|-----------|
| Página inicial | Dashboard com simulados em destaque, artigos, links úteis. |
| Simulados | Listagem de simulados disponíveis; filtro e busca. |
| Simulado LPIC-1 | Provas por exame (101, 102, misto); questões múltipla escolha e texto; resultado e progresso. |
| Meu Progresso | Histórico de sessões e desempenho (requer login). |
| Artigos | Listagem e página de artigo (Markdown/HTML); capa e resumo. |
| Links úteis | Cards com links (oficial, referência, ferramenta, prática); tags coloridas. |
| Saiba mais | Texto institucional, FAQ (accordion), política sobre não usar provas vazadas, contato (e-mail). |
| Comunidade | Item no menu; **em breve** (inativo; badge e tooltip "EM BREVE"). |
| Autenticação | Login/Logout com Google (Supabase Auth). |
| Doação | Modal com QR e opção de copiar chave PIX (configurável). |

### 2.2 Painel admin

| Funcionalidade | Descrição |
|----------------|-----------|
| Acesso | Restrito a usuários com `role = admin` ou e-mail em `ADMIN_EMAIL`. |
| Dashboard | Estatísticas (usuários, sessões). |
| Usuários | Listagem; alteração de role (admin) e plan (free/pro). |
| Simulados e exames | CRUD de simulados e exames. |
| Questões | CRUD; importação em lote (JSON). |
| Artigos | CRUD; upload de imagem de capa (disco ou Supabase Storage); **importar .md** (um arquivo no modal ou vários de uma vez, com frontmatter opcional). |
| Links úteis | CRUD; upload de ícone. |

### 2.3 Fora do escopo (atualmente)

- Comunidade (fórum/chat) — planejado “em breve”.
- App mobile nativo.
- Simulados pagos (plan Pro existe no modelo; restrição de conteúdo por plan pode ser implementada depois).

---

## 3. Stack técnico

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js (ES modules) |
| Servidor | `http` nativo; um processo (`server.js`) para API e estáticos |
| Autenticação | Supabase Auth (OAuth Google) |
| Banco de dados | Supabase (PostgreSQL + PostgREST) |
| Armazenamento opcional | Supabase Storage (imagens de capa dos artigos) |
| Frontend | HTML, CSS, JavaScript (ES modules, sem bundler) |
| Rate limit | Em memória ou Redis (opcional) |

---

## 4. Decisões técnicas principais

- **Sem framework no backend:** Servidor HTTP puro para controle e simplicidade.
- **Sem build no frontend:** Scripts carregados como ES modules; CSP sem `unsafe-inline` (scripts em arquivos externos).
- **Upload de imagens:** Nome sempre gerado no servidor (UUID + extensão), nunca o nome original do cliente; extensões e tamanho limitados; path validado (path traversal).
- **Imagens de capa:** Se `SUPABASE_STORAGE_BUCKET_ARTIGOS` estiver definido, upload vai para o Storage (URL persistente após deploy); senão, disco em `public/uploads/artigos/`.
- **Redirect pós-login:** Lista fixa de paths permitidos (evita open redirect).
- **Admin:** Todas as rotas `/admin/api/*` exigem Bearer token e checagem de admin; respostas com `Cache-Control: no-store`.

---

## 5. Documentação relacionada

- [ARCHITECTURE.md](ARCHITECTURE.md) — fluxos e arquitetura.
- [API.md](API.md) — rotas da API.
- [DATA_MODEL.md](DATA_MODEL.md) — tabelas Supabase.
- [SECURITY.md](SECURITY.md) — segurança.
- [DEPLOYMENT.md](DEPLOYMENT.md) — deploy.
- [PERFORMANCE.md](PERFORMANCE.md) — otimização e boas práticas.

Este documento não contém credenciais nem dados sensíveis.
