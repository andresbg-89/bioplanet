-- ══════════════════════════════════════════════════════════
-- TABLA DE RATE LIMITING — BioPlanet
-- Ejecuta esto UNA VEZ en Supabase: SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════

-- Tabla que registra cada llamada a la API de IA
create table if not exists api_usage (
  id         bigint generated always as identity primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);

-- Índices para que las consultas de conteo sean rápidas
create index if not exists idx_api_usage_ip_time on api_usage (ip, created_at);
create index if not exists idx_api_usage_time    on api_usage (created_at);

-- ── Seguridad (RLS) ──
-- Esta tabla solo la toca el proxy con la SERVICE key (que salta RLS).
-- Activamos RLS y NO creamos políticas públicas → nadie más puede leerla.
alter table api_usage enable row level security;

-- ── Limpieza automática opcional ──
-- Para no acumular registros viejos, puedes borrar los de más de 2 días.
-- Ejecuta esto manualmente de vez en cuando, o programa un cron en Supabase:
--   delete from api_usage where created_at < now() - interval '2 days';

-- ══════════════════════════════════════════════════════════
-- NOTA: el proxy usa la SERVICE_ROLE key (no la anon key).
-- La encuentras en Supabase → Settings → API → service_role secret.
-- Esa key NUNCA va en el frontend, solo en las variables de entorno
-- de Vercel (SUPABASE_SERVICE_KEY).
-- ══════════════════════════════════════════════════════════
