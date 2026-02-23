/**
 * Captura o hash da URL no momento em que este módulo é avaliado.
 * Deve ser importado antes de supabase-auth.js, pois o cliente Supabase
 * limpa window.location.hash ao processar OAuth; assim preservamos o hash
 * para fallback manual da sessão.
 */
export const urlHash = (typeof window !== 'undefined' && window.location && window.location.hash)
  ? window.location.hash
  : ''
