// ============================================================
// CONFIGURACIÓN DE SUPABASE
// Reemplaza los dos valores de abajo con los de tu proyecto.
// Los encuentras en: Supabase > tu proyecto > Settings > API
// ============================================================

const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-LLAVE-ANON-PUBLICA";

// Nota: la "anon key" está diseñada para ser pública y vivir en el
// navegador. La protección real la dan las políticas de seguridad
// (RLS) definidas en schema.sql: cualquiera puede leer, pero solo
// un usuario autenticado (el administrador) puede escribir.
