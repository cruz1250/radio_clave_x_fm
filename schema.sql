-- ============================================================
-- ESQUEMA DE BASE DE DATOS - CLAVEX FM
-- ============================================================
--
-- ¿YA HABÍAS CORRIDO UN SCHEMA ANTERIOR (Son de Ébano) EN SUPABASE?
-- → NO vuelvas a correr todo este archivo, crearía canciones duplicadas.
--   Corre SOLO este bloque de migración y listo:
--
--   alter table songs add column if not exists artist text;
--   update songs set artist = 'Son de Ébano' where artist is null;
--   alter table songs alter column artist set not null;
--
-- ¿ES UN PROYECTO NUEVO DE SUPABASE?
-- → Copia y pega TODO este archivo en SQL Editor > Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- TABLA: canciones del repertorio ----------
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default 'ClaveX fm',
  youtube_id text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- TABLA: programación de la emisora ----------
create table if not exists schedule (
  id uuid primary key default gen_random_uuid(),
  time_range text not null,
  title text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- SEGURIDAD A NIVEL DE FILA (RLS) ----------
alter table songs enable row level security;
alter table schedule enable row level security;

-- Cualquier oyente puede leer (la radio es pública)
create policy "lectura publica songs" on songs
  for select using (true);

create policy "lectura publica schedule" on schedule
  for select using (true);

-- Solo un usuario autenticado (el administrador) puede escribir
create policy "admin insert songs" on songs
  for insert to authenticated with check (true);
create policy "admin update songs" on songs
  for update to authenticated using (true);
create policy "admin delete songs" on songs
  for delete to authenticated using (true);

create policy "admin insert schedule" on schedule
  for insert to authenticated with check (true);
create policy "admin update schedule" on schedule
  for update to authenticated using (true);
create policy "admin delete schedule" on schedule
  for delete to authenticated using (true);

-- ---------- DATOS INICIALES (repertorio de varias orquestas) ----------
insert into songs (title, artist, youtube_id, position) values
  ('El Negro Carabalí', 'Son de Ébano', 'RcakcxYY1p4', 1),
  ('Metiendo Mano Con Mujer Ajena', 'Son de Ébano', 'gW_BlAm45tg', 2),
  ('Hipocresía', 'Son de Ébano', 'En50ama30JE', 3),
  ('Devuélveme La Vida', 'Son de Ébano', 'NxXKnMukB7U', 4),
  ('Ya No Hay Amistad', 'Son de Ébano', '0Sf0V7LGSi0', 5),
  ('Que Rico Mi Son', 'Son de Ébano', 'gG7Uu9a9wFw', 6),
  ('La Humanidad', 'Son de Ébano', 'DwiqckerTTU', 7);

insert into schedule (time_range, title, description, position) values
  ('6:00 AM – 9:00 AM', 'Amanecer con Son', 'Los clásicos de la vieja guardia para empezar el día con buen pie.', 1),
  ('12:00 M – 2:00 PM', 'Salsa al Almuerzo', 'Ritmo de salsa y buena sazón para la hora del mediodía.', 2),
  ('6:00 PM – 9:00 PM', 'Hora Brava', 'Lo más caliente del repertorio ClaveX, sin pausa.', 3),
  ('9:00 PM – 12:00 AM', 'Noche de Rumba', 'Salsa dura para cerrar la noche bailando hasta el final.', 4);
