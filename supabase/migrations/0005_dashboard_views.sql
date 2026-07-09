-- 0005_dashboard_views.sql
--
-- Views de suporte ao dashboard de acompanhamento diário (ver
-- docs/PLANO.md, Fase 6 — "views adicionais de análise"). Cada view expõe
-- o grão certo (dia/evento/artista, fonte, cidade/estado) para que a
-- aplicação filtre por período e por artista via PostgREST (.gte()/.eq())
-- sem duplicar lógica de agregação em cada consulta.
--
-- Todas leem de interessados_ativos/sources_ativas (nunca as tabelas
-- cruas), preservando o comportamento de soft delete — CLAUDE.md, regra 11.

-- create or replace (não create) para poder rodar com segurança mais de uma
-- vez, tanto via `supabase db push` quanto via execução manual/script.
create or replace view dash_interessados_diarios as
  select
    date_trunc('day', coalesce(i.submitted_at, i.synced_at))::date as dia,
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
  'Interessados agrupados por dia (submitted_at, com fallback para synced_at quando a fonte não mapeia data de envio), evento e artista. Base do gráfico de tendência, dos KPIs de volume/delta e do ranking de eventos — filtrada em runtime por período e artista via PostgREST.';

create or replace view dash_qualidade_por_fonte as
  select
    s.id as source_id,
    s.name as source_name,
    s.tipo,
    s.status,
    s.last_synced_at,
    e.id as evento_id,
    e.nome as evento_nome,
    a.id as artista_id,
    a.nome as artista_nome,
    count(i.id) as total,
    count(i.id) filter (where i.email_valido) as email_validos,
    count(i.id) filter (where i.telefone_valido) as telefone_validos,
    count(i.id) filter (where i.local_revisao_pendente) as local_pendentes
  from sources_ativas s
  join eventos e on e.id = s.evento_id
  join artistas a on a.id = e.artista_id
  left join interessados_ativos i on i.source_id = s.id
  group by s.id, s.name, s.tipo, s.status, s.last_synced_at, e.id, e.nome, a.id, a.nome;

comment on view dash_qualidade_por_fonte is
  'Snapshot atual (sem filtro de período) de saúde e qualidade de dado por fonte ativa: validade de e-mail/telefone e revisão geográfica pendente. Alimenta a tabela de qualidade e o alerta de fonte parada no dashboard.';

create or replace view dash_geografia as
  select
    coalesce(cidade_normalizada, cidade_informada) as cidade,
    coalesce(estado_normalizado, estado_informada) as estado,
    artista_id,
    evento_id,
    count(*) as total
  from interessados_ativos
  where coalesce(cidade_normalizada, cidade_informada) is not null
  group by 1, 2, 3, 4;

comment on view dash_geografia is
  'Interessados agrupados por cidade/estado (normalizado, com fallback para o valor informado), artista e evento — sem filtro de período no v1. Alimenta o gráfico de top cidades do dashboard.';
