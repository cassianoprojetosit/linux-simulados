# Desempenho e otimização

Recomendações de desempenho, otimização e boas práticas para o projeto Linux Simulados.

---

## 1. O que já está bem feito

- **Servidor:** Um processo Node; sem overhead de framework; rate limit para proteger a API.
- **Estáticos:** Servidos pelo mesmo processo com path validado; headers de cache podem ser adicionados para assets imutáveis.
- **Frontend:** ES modules (carregamento nativo); scripts externos (CSP respeitada); sem scripts inline bloqueantes.
- **Imagens de capa:** Opção de Supabase Storage (CDN) para URLs persistentes e entrega rápida.
- **APIs:** Respostas JSON; listagens com limites; admin com `Cache-Control: no-store`.

---

## 2. Sugestões de otimização

### 2.1 Servidor

| Sugestão | Benefício |
|----------|-----------|
| **Cache-Control em estáticos** | Para arquivos em `public/` que não mudam (JS, CSS, imagens com hash ou versão), usar `Cache-Control: public, max-age=3600` (ou maior) para reduzir requisições repetidas. |
| **Compressão (gzip/brotli)** | Comprimir respostas de API e HTML (middleware ou proxy reverso) para reduzir tamanho na rede. |
| **HTTPS em produção** | Já esperado em hospedagem; melhora segurança e permite HTTP/2. |

### 2.2 Frontend

| Sugestão | Benefício |
|----------|-----------|
| **Lazy load de imagens** | Em listagens (artigos, links), usar `loading="lazy"` nas imagens abaixo da dobra para carregar sob demanda. |
| **Preconnect para Supabase/Google** | Já existe `preconnect` para fonts; garantir preconnect para `*.supabase.co` e Google Auth se ainda não houver. |
| **Evitar muitos scripts na primeira carga** | Manter apenas o necessário na página inicial; carregar módulos de páginas específicas só quando acessadas (já em parte feito com rotas separadas). |
| **Minificação (opcional)** | Para produção, minificar JS/CSS reduz tamanho; hoje o projeto não usa build — pode ser um passo futuro (ex.: esbuild rollup) sem obrigatoriedade. |

### 2.3 Dados e API

| Sugestão | Benefício |
|----------|-----------|
| **Paginação nas listagens** | APIs como artigos e questões já suportam ou podem ter `limit`/`offset` para não trazer listas gigantes. |
| **Índices no Supabase** | Garantir índices em colunas usadas em filtros e ordenação (slug, published_at, is_active, etc.). |

---

## 3. Boas práticas em uso

- **CSP:** Restringe origens de script e conexão; scripts em arquivos externos.
- **Sem inline scripts:** Accordion, menu e lógica em `.js` externos (respeito à CSP).
- **Validação de entrada:** Whitelist de colunas, sanitização de slug/query, tamanho máximo de body.
- **Upload:** Nome de arquivo gerado no servidor (UUID); extensão e tamanho limitados.
- **Token e admin:** Chave de serviço só no servidor; admin verificado por token + role/e-mail.

---

## 4. Tecnologias alternativas (futuro)

- **Bundler (Vite, esbuild):** Útil se quiser minificar, tree-shake e ter um único bundle por página; não obrigatório para o tamanho atual.
- **PWA:** Service worker e cache de assets para uso offline leve; exige HTTPS e testes.
- **CDN na frente do Node:** Colocar estáticos (ou todo o site) atrás de CDN (Cloudflare, etc.) para cache e DDoS básico.

Nenhuma dessas é necessária para o projeto estar “bem feito”; são evoluções possíveis conforme a escala e a necessidade.

Este documento não contém credenciais nem dados sensíveis.
