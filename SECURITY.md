# Segurança e boas práticas

## O que já está aplicado

- **CSP (Content-Security-Policy)** em todas as páginas HTML para mitigar XSS e injeção.
- **Headers de segurança**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.
- **CORS**: origem restrita (localhost e Supabase) nas respostas da API.
- **Secrets no servidor**: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` vêm do `.env`; validação na subida do servidor.
- **Script de importação**: `import-questions.js` usa `SUPABASE_SERVICE_ROLE_KEY` do `.env` (nunca no frontend).
- **XSS**: escape de conteúdo dinâmico em `user-area.js`, `progresso-engine.js` e `simulado-lpic1-engine.js` (questões, dicas, histórico).
- **RLS no Supabase**: tabela `sessions` com políticas por `auth.uid()`; chave anon no frontend é segura com RLS.
- **Rota obsoleta removida**: `POST /api/sessions` removido; o cliente grava direto no Supabase com JWT.

## O que você deve fazer

1. **Remover segredos do repositório**
   - O arquivo `client_secret_*.json` (Google OAuth) não deve ser commitado. Está no `.gitignore`; se já foi commitado, remova do histórico (`git filter-branch` ou BFG) e revogue/recrie o client secret no Google Cloud.
   - Nunca commitar `.env` ou chaves reais; usar `.env.example` só com placeholders.

2. **Produção**
   - Definir `NODE_ENV=production`.
   - Usar HTTPS e, se possível, restringir `Access-Control-Allow-Origin` à origem real do frontend.
   - Considerar rate limiting (ex.: `express-rate-limit` se migrar para Express) nas rotas da API.

3. **Supabase**
   - Manter RLS ativo em todas as tabelas acessíveis pelo cliente.
   - Rotacionar a Service Role Key se ela tiver vazado; a chave anon pode permanecer no frontend.

4. **Dependências**
   - Rodar `npm audit` e corrigir vulnerabilidades críticas/altas.
