/**
 * Página de logout: executa signOut e redireciona para a home.
 * Carregado por logout.html (script externo para respeitar CSP).
 */
import { logout } from '/js/supabase-auth.js'
logout()
