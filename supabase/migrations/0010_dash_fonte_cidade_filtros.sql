-- 0010_dash_fonte_cidade_filtros.sql
--
-- Suporte a dois seletores explícitos (dropdown) no dashboard: fonte e
-- cidade (app/dashboard/FilterBar.tsx). Cidade já existia como filtro, mas
-- só via clique numa barra do gráfico de geografia (0008) — agora também
-- dá pra escolher direto num <select>, então precisa de uma lista completa
-- de cidades disponíveis, não só o recorte que já apareceria num gráfico
-- filtrado. Fonte nunca existiu como filtro do dashboard inteiro (só como
-- linha da tabela de qualidade) — dash_interessados_diarios e
-- dash_geografia não tinham source_id, então não dava pra filtrar o
-- restante do dashboard (tendência, ranking, KPIs) por uma fonte
-- específica.
--
-- `create or replace view` só permite apêndice de coluna no fim da lista
-- existente (mesma limitação já documentada na 0008) — por isso source_id
-- entra depois das colunas originais.

create or replace view dash_interessados_diarios as
  select
    date_trunc('day', coalesce(i.submitted_at, i.synced_at) at time zone 'America/Sao_Paulo')::date as dia,
    i.evento_id,
    e.nome as evento_nome,
    i.artista_id,
    a.nome as artista_nome,
    count(*) as total,
    count(*) filter (where i.email_valido) as email_validos,
    count(*) filter (where i.telefone_valido) as telefone_validos,
    coalesce(i.cidade_normalizada, i.cidade_informada) as cidade,
    coalesce(i.estado_normalizado, i.estado_informada) as estado,
    (i.submitted_at is null) as data_desconhecida,
    i.source_id
  from interessados_ativos i
  join eventos e on e.id = i.evento_id
  join artistas a on a.id = i.artista_id
  group by 1, 2, 3, 4, 5, 9, 10, 11, 12;

comment on view dash_interessados_diarios is
  'Interessados agrupados por dia (América/São_Paulo — ver 0007), evento, artista, cidade, estado e fonte (source_id, 0010 — filtro por fonte no dashboard). data_desconhecida (0009) marca linhas onde o dia veio do fallback synced_at. Base do gráfico de tendência, dos KPIs de volume/delta e do ranking de eventos.';

create or replace view dash_geografia as
  select
    coalesce(cidade_normalizada, cidade_informada) as cidade,
    coalesce(estado_normalizado, estado_informada) as estado,
    artista_id,
    evento_id,
    count(*) as total,
    date_trunc('day', coalesce(submitted_at, synced_at) at time zone 'America/Sao_Paulo')::date as dia,
    source_id
  from interessados_ativos
  where coalesce(cidade_normalizada, cidade_informada) is not null
  group by 1, 2, 3, 4, 6, 7;

comment on view dash_geografia is
  'Interessados agrupados por dia (América/São_Paulo), cidade/estado (normalizado, com fallback pro informado), artista, evento e fonte (source_id, 0010). Alimenta o gráfico de top cidades do dashboard, com filtro por fonte.';

create or replace view dash_cidades_disponiveis as
  select distinct
    coalesce(cidade_normalizada, cidade_informada) as cidade,
    coalesce(estado_normalizado, estado_informada) as estado
  from interessados_ativos
  where coalesce(cidade_normalizada, cidade_informada) is not null
  order by 1, 2;

comment on view dash_cidades_disponiveis is
  'Lista de cidade/estado distintas presentes em interessados_ativos, sem filtro de período/artista/evento — alimenta o dropdown de cidade do dashboard (app/dashboard/FilterBar.tsx), que precisa da lista completa independente dos outros filtros ativos, igual já acontece com o dropdown de artista.';
