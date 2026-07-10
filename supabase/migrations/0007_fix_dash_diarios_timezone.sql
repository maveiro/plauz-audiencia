-- 0007_fix_dash_diarios_timezone.sql
--
-- Corrige dash_interessados_diarios (0005_dashboard_views.sql): o
-- date_trunc('day', ...) truncava no timezone da sessão do Postgres (UTC,
-- padrão do Supabase), enquanto o app (lib/dashboard/dateRange.ts) define
-- "dia" em América/São_Paulo (UTC-3 fixo). Isso deslocava para o dia
-- seguinte qualquer interessado enviado entre 21h e 23h59 (horário de SP),
-- inflando "novos hoje" e distorcendo a tendência diária e o ranking de
-- eventos, que são todos derivados desta view.

create or replace view dash_interessados_diarios as
  select
    date_trunc('day', coalesce(i.submitted_at, i.synced_at) at time zone 'America/Sao_Paulo')::date as dia,
    i.evento_id,
    e.nome as evento_nome,
    i.artista_id,
    a.nome as artista_nome,
    count(*) as total,
    count(*) filter (where i.email_valido) as email_validos,
    count(*) filter (where i.telefone_valido) as telefone_validos
  from interessados_ativos i
  join eventos e on e.id = i.evento_id
  join artistas a on a.id = i.artista_id
  group by 1, 2, 3, 4, 5;

comment on view dash_interessados_diarios is
  'Interessados agrupados por dia (submitted_at, com fallback para synced_at quando a fonte não mapeia data de envio), evento e artista. Dia calculado em América/São_Paulo, não no timezone da sessão (ver 0007). Base do gráfico de tendência, dos KPIs de volume/delta e do ranking de eventos — filtrada em runtime por período e artista via PostgREST.';
