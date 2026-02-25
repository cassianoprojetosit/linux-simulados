# Análise e auditoria do código

Este documento consolida a análise de código, funções, lógica, segurança, desempenho, falhas e melhorias do projeto Linux Simulados. A documentação (README, ARCHITECTURE, API, SECURITY, DEPLOYMENT, PERFORMANCE, PROJECT_SPEC, DATA_MODEL) é mantida alinhada a esta auditoria.

---

## 1. Visão geral do código

| Área | Arquivos principais | Observação |
|------|---------------------|------------|
| Backend | `server.js` (~1499 linhas) | Um único processo HTTP: API REST + estáticos; sem framework. |
| Auth frontend | `supabase-auth.js`, `login.js`, `require-auth.js`, `admin-auth.js`, `user-area.js`, `hash-capture.js` | Sessão Supabase; redirect com allowlist; admin via Bearer + /admin/api/ping. |
| Admin frontend | `public/admin/*.html`, `public/js/admin-*.js` | CRUD consumindo `/admin/api/*` com token. |
| Público | `artigos-*.js`, `links-public.js`, `simulados-cards.js`, `simulado-lpic1-engine.js`, `progresso-*.js` | Dados via `/api/*` e Supabase direto (sessão). |

---

## 2. Lógica e funções (server.js)

- **handleAPI:** Centraliza todas as rotas `/api/*` e `/admin/api/*`. Ordem de tratamento: config → rate limit → CORS → rotas específicas. Rotas admin exigem `requireAdmin`.
- **requireAdmin:** Valida Bearer token com `supabase.auth.getUser(token)`; considera admin por `ADMIN_EMAIL` ou `users.role = 'admin'` (consultando com `supabaseAdmin` quando existir).
- **Upload (artigos e links):** Base64 no body; extensão permitida (jpg, png, webp); tamanho máx. 200KB; nome gerado com `randomUUID()`; se `SUPABASE_STORAGE_BUCKET_*` e `supabaseAdmin` existirem, upload para Storage e URL pública; senão disco em `public/uploads/*` com path validado.
- **readBody:** Limite de tamanho (1MB padrão, 300KB para uploads); rejeita payload maior; JSON.parse no fim.
- **serveFile:** Path normalizado e validado; exige `resolved.startsWith(PUBLIC_DIR)` e sem `..` (path traversal).
- **Rate limit:** Por IP; janela 1 min; admin 40 req/min, API 120 req/min; Redis opcional para múltiplas instâncias; fallback em memória com limpeza de entradas antigas.

---

## 3. Segurança

### 3.1 O que está bem implementado

- **Admin:** Todas as rotas `/admin/api/*` exigem Bearer e checagem de admin; respostas com `Cache-Control: no-store`.
- **CORS:** Só origens em `ALLOWED_ORIGINS` ou fallback localhost / `*.supabase.co`.
- **Headers:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy; CSP em HTML (script-src, connect-src, etc.).
- **Upload:** Extensão e tamanho limitados; path de escrita dentro de `UPLOADS_*_DIR`; nome de arquivo gerado no servidor (UUID).
- **Input:** Whitelist de colunas em criação/atualização (questões, artigos, links, users); slugs e query params sanitizados e com limite de tamanho; URL de links validada (`https?://...`); escape de LIKE em buscas (`%`, `_`, `\`).
- **Redirect pós-login:** Allowlist em `require-auth.js` e `login.js` (ex.: simulados.html, progresso.html, simulado-lpic1.html, simulado.html e `simulado.html?*`); evita open redirect.
- **Service role:** Usada apenas no servidor; nunca exposta ao front.

### 3.2 Pontos de atenção e melhorias

1. **Cliente Supabase no frontend:** Em `supabase-auth.js` a URL e a chave anon estão **hardcoded**. A documentação diz que o front obtém config via `GET /api/config`; na prática o front não usa essa rota para criar o client. **Recomendação:** Inicializar o cliente Supabase no front a partir de `GET /api/config` (ex.: bootstrap que chama a API e depois cria o client), para que rotação de chaves não exija redeploy do front.
2. **Avatar URL no admin:** `safeAvatarUrl` em `admin-auth.js` permite `data:` além de `https://`. Para img src isso é aceitável; se no futuro o valor for usado em outro contexto, restringir a `https://` pode ser mais seguro.
3. **GET /api/simulados:** Não verifica `req.method`; POST para essa rota também retorna a lista (sem alterar dados, mas inconsistente). **Correção recomendada:** aceitar apenas `GET`.
4. **GET /admin/api/questoes:** Usa o client `supabase` (anon) em vez de `supabaseAdmin || supabase`. Com RLS restritivo na tabela `questions`, a listagem admin pode falhar. **Recomendação:** usar `const db = supabaseAdmin || supabase` e `db.from('questions')` como nas demais rotas admin.

---

## 4. Desempenho e otimização

- **Servidor:** Um processo; rate limit evita picos; body limitado por rota.
- **Estáticos:** Path validado; não há Cache-Control para JS/CSS (pode adicionar `max-age` para assets imutáveis, conforme PERFORMANCE.md).
- **API:** Listagens com paginação (questões, usuários); limites e offsets; artigos/links públicos sem paginação (conjuntos tipicamente pequenos).
- **Storage:** Opção de Supabase Storage para capas (artigos) e ícones (links) reduz dependência de disco e melhora persistência após deploy.
- **Redis:** Rate limit distribuído quando `REDIS_URL` está definido.

Sugestões já documentadas em PERFORMANCE.md: Cache-Control em estáticos, compressão (gzip/brotli), lazy load de imagens, preconnect para Supabase/Google.

---

## 5. Falhas e bugs conhecidos

| Item | Severidade | Descrição |
|------|------------|-----------|
| `/api/simulados` sem verificação de método | Baixa | POST retorna a mesma lista que GET; não há mutação. Correção: aceitar apenas GET. |
| GET /admin/api/questoes com client anon | Média | Com RLS restritivo, listagem de questões no admin pode retornar vazio ou erro. Correção: usar supabaseAdmin \|\| supabase. |
| Frontend sem uso de /api/config | Média | Chave e URL fixas no JS; rotação de chaves exige redeploy. Melhoria: inicializar client a partir de /api/config. |

Nenhum deles expõe dados sensíveis ou permite escalação de privilégios; as correções melhoram consistência e operação.

---

## 6. Melhorias recomendadas (resumo)

1. **Código:** Restringir `/api/simulados` a `req.method === 'GET'`; usar `supabaseAdmin || supabase` em GET /admin/api/questoes.
2. **Frontend:** Inicializar cliente Supabase com dados de `GET /api/config` para facilitar rotação de chaves.
3. **Documentação:** Manter API.md, ARCHITECTURE.md, SECURITY.md e README alinhados ao comportamento real (incl. upload de links para Storage e uso atual de config no front).
4. **Ops:** Garantir `ALLOWED_ORIGINS` em produção; usar `SUPABASE_STORAGE_BUCKET_LINKS` e `SUPABASE_STORAGE_BUCKET_ARTIGOS` quando aplicável; considerar Cache-Control para estáticos.

---

## 7. Documentação relacionada

- [ARCHITECTURE.md](ARCHITECTURE.md) — fluxos e decisões
- [API.md](API.md) — rotas e métodos
- [SECURITY.md](SECURITY.md) — medidas de segurança
- [PERFORMANCE.md](PERFORMANCE.md) — otimização
- [DEPLOYMENT.md](DEPLOYMENT.md) — deploy e checklist
- [PROJECT_SPEC.md](PROJECT_SPEC.md) — escopo e funcionalidades
- [DATA_MODEL.md](DATA_MODEL.md) — tabelas Supabase

Este documento não contém credenciais nem dados sensíveis.
