// ============================================================
// CONFIGURACIÓN DE SUPABASE
// Reemplaza los dos valores de abajo con los de tu proyecto.
// Los encuentras en: Supabase > tu proyecto > Settings > API
// ============================================================

const SUPABASE_URL = "https://vfavwksyqvnorqkuxoxd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmYXZ3a3N5cXZub3Jxa3V4b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMjU3MTQsImV4cCI6MjA5OTgwMTcxNH0.AXsyTE8OJv0B8drPr_pLFwCxB8OXC4PZAqI_IuVBpeE";

// Nota: la "anon key" está diseñada para ser pública y vivir en el
// navegador. La protección real la dan las políticas de seguridad
// (RLS) definidas en schema.sql: cualquiera puede leer, pero solo
// un usuario autenticado (el administrador) puede escribir.
