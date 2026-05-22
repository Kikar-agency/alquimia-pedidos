// ============================================
// CONFIG SUPABASE
// ============================================
// Estos valores son públicos (publishable key) — pueden ir en el frontend.
// La seguridad real está en las políticas RLS configuradas en Supabase.
// ============================================

const SUPABASE_URL = 'https://jizmzyxljhxgorxlhqxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__Bx4rfYZIqokwSdfpV6HzA_FWyo0QhH';

// Inicializar cliente Supabase (usando la lib cargada por CDN)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
