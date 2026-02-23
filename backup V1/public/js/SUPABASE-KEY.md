# Chave API Supabase — erro "Unregistered API key"

O erro **"Unregistered API key"** e o **401** em `/auth/v1/user` indicam que a chave usada no frontend **não é a chave anon do projeto**.

## O que fazer

1. Abra o **Supabase Dashboard**: https://supabase.com/dashboard  
2. Selecione o projeto **tfmcvjwhicvoouhoxzqz**.  
3. Vá em **Settings** (engrenagem) → **API**.  
4. Em **Project API keys**:
   - Se existir **"anon" (public)** (chave longa em formato JWT, começa com `eyJ...`), **copie essa chave**.
   - Se existir só **"Publishable"** (`sb_publishable_...`) e o Auth retorna "Unregistered API key", crie ou use as **Legacy API Keys**: na mesma página, abra a aba **"Legacy"** ou **"API Keys"** e copie a chave **anon public**.
5. No projeto, abra **`public/js/supabase-auth.js`**.  
6. Substitua o valor de **`SUPABASE_ANON_KEY`** pela chave que você copiou (cole entre aspas, substituindo a chave atual).

Exemplo, se a anon for `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`:

```js
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

Salve o arquivo, recarregue a página e teste de novo o login com Google.

## Sobre o CSP

O servidor já foi ajustado para incluir explicitamente a URL do seu projeto Supabase no CSP (`connect-src` e `wss://`), para evitar bloqueio de requisições.
