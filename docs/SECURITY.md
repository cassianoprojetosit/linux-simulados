# Segurança

Este documento descreve as medidas de segurança implementadas no projeto e boas práticas recomendadas. Não contém credenciais nem dados sensíveis.

---

## Resumo das medidas

- **CORS:** Origens permitidas configuráveis via `ALLOWED_ORIGINS`; em produção não depender apenas de fallback (localhost / Supabase).
- **Rate limiting:** Por IP, com limites distintos para API pública e admin; suporte a Redis para múltiplas instâncias.
- **Autenticação admin:** Bearer token + verificação de role no banco ou e-mail em variável de ambiente; chave de serviço nunca exposta ao frontend.
- **Headers de segurança:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy; Cache-Control no-store para rotas admin.
- **Uploads:** Extensão e tamanho limitados; path resolvido validado para ficar dentro do diretório de uploads.
- **Inputs:** Sanitização/whitelist em slugs, parâmetros de query e body (role, plan, colunas permitidas); sem expor dados sensíveis em mensagens de erro.

---

## Autenticação e autorização

- **Supabase Auth:** Login via OAuth (Google). Tokens gerenciados pelo Supabase; o servidor apenas valida o token e consulta a tabela `users` (com client de serviço quando disponível) para decidir se o usuário é admin.
- **Chave anon:** Exposta ao frontend via `/api/config`; é a chave pública do Supabase. A proteção dos dados é feita por RLS (Row Level Security) no Supabase e pelas rotas do servidor que exigem admin.
- **Chave de serviço:** Usada apenas no servidor (variável de ambiente). Nunca enviada ao cliente nem referenciada em código frontend.
- **Redirecionamento pós-login:** Lista fixa de paths permitidos em `redirect` (evita open redirect).

---

## CORS

- O header `Access-Control-Allow-Origin` é enviado apenas quando a origem da requisição está na lista permitida.
- Com `ALLOWED_ORIGINS` definido: só as origens listadas (ex.: domínio do site em produção).
- Sem `ALLOWED_ORIGINS`: fallback para localhost e `*.supabase.co` (adequado para desenvolvimento).

---

## Rate limiting

- Limite por IP por janela de tempo (ex.: 1 minuto).
- Limites separados para rotas `/admin/api/*` e para o restante da API (valores configuráveis no código).
- Sem Redis: contador em memória por instância (reinicia com o processo; em múltiplas instâncias cada uma tem seu limite).
- Com `REDIS_URL`: contador compartilhado no Redis (recomendado quando houver mais de uma instância para evitar que o limite efetivo seja multiplicado).

---

## Headers HTTP

- **X-Content-Type-Options: nosniff** — Reduz risco de MIME sniffing.
- **X-Frame-Options: SAMEORIGIN** — Reduz risco de clickjacking.
- **X-XSS-Protection: 1; mode=block** — Compatibilidade com navegadores antigos.
- **Referrer-Policy: strict-origin-when-cross-origin** — Controla vazamento de URL em referrer.
- **Permissions-Policy** — Restringe uso de APIs do browser (ex.: câmera, microfone, geolocalização desabilitados).
- **Content-Security-Policy** — Aplicado nas páginas HTML (script-src, connect-src, etc.). Conexões ao Supabase e Google permitidas; não incluir chaves ou URLs sensíveis no documento.
- **Cache-Control: no-store** nas respostas das rotas admin para não cachear dados sensíveis.

---

## Upload de arquivos

- Apenas usuários admin podem enviar arquivos.
- Corpo em base64; extensões permitidas: jpg, jpeg, png, webp.
- Tamanho máximo por arquivo definido no servidor (ex.: 200 KB).
- Nome do arquivo no disco gerado pelo servidor (UUID + extensão); não se usa o nome enviado pelo cliente para o path final.
- Antes de escrever, o servidor verifica que o path resolvido está dentro do diretório de uploads (proteção contra path traversal).

---

## Validação de entrada

- **Slugs e IDs:** Sanitização e limite de tamanho em parâmetros de URL e query (ex.: slug de artigos, slug de simulados, parâmetro exam).
- **Body JSON:** Tamanho máximo por rota; colunas permitidas (whitelist) em criação/atualização de recursos (usuários, questões, artigos, links).
- **Role e plan:** Em atualização de usuário, apenas valores permitidos (role: admin ou null; plan: free ou pro).
- **URL em links:** Validação de formato (ex.: `https?://...`) antes de persistir.

---

## Arquivos estáticos

- Servidos a partir de um diretório fixo (`public/`). Path normalizado e validado; rejeição de `..` e de caminhos que saiam do diretório permitido.

---

## Recomendações adicionais

- Manter `.env` fora do controle de versão e nunca commitar chaves ou senhas.
- Em produção, usar HTTPS (a maioria dos provedores de hospedagem já oferece).
- Configurar RLS no Supabase de acordo com as políticas de acesso desejadas para cada tabela.
- Rotacionar chaves (Supabase, Redis) periodicamente e atualizar as variáveis de ambiente no servidor (e, no caso da chave anon, o front passa a recebê-la via `/api/config`).
- Monitorar logs e respostas 4xx/5xx para detectar tentativas de abuso ou erros de configuração.

Este documento não inclui exemplos com tokens, chaves ou dados reais.
