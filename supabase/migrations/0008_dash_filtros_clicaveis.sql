-- 0008_dash_filtros_clicaveis.sql
--
-- Suporte a dois cortes de análise que faltavam nas views do dashboard, para
-- viabilizar filtro por clique nos gráficos de "Top cidades" e "Ranking de
-- eventos" (app/dashboard/GeoChart.tsx, RankingChart.tsx):
--
-- 1. dash_geografia não tinha nenhuma coluna de data — o gráfico de cidades
--    ignorava por completo o seletor de período (Hoje/7d/30d/90d/Tudo).
--    Agora agrupa também por dia (mesma lógica de fuso da 0007).
-- 2. dash_interessados_diarios e dash_qualidade_por_fonte não tinham cidade
--    nem estado — não dava pra filtrar o dashboard inteiro por cidade ao
--    clicar numa barra do gráfico de geografia.
--
-- Em ambos os casos, cidade/estado só precisam existir como dimensão de
-- GROUP BY para o PostgREST poder filtrar por elas (.eq()) — o código em
-- lib/dashboard/queries.ts não precisa necessariamente selecioná-las de
-- volta, já que os totais são somados em cima de todas as linhas
-- retornadas, então o split adicional por cidade é transparente para quem
-- só soma total/email_validos/etc. A exceção é dash_qualidade_por_fonte:
-- como cada linha vira um item de tabela (não só um total agregado), o
-- código em queries.ts precisa recolapsar por source_id depois de buscar,
-- senão uma fonte com leads de várias cidades apareceria duplicada.
--
-- `create or replace view` do Postgres não permite reordenar/inserir
-- colunas no meio da lista existente (só apêndice no fim) — por isso as
-- colunas novas (cidade, estado, dia) vêm sempre depois das originais,
-- mesmo quando isso deixa a ordem menos natural de ler.

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
    coalesce(i.estado_normalizado, i.estado_informada) as estado
  from interessados_ativos i
  join eventos e on e.id = i.evento_id
  join artistas a on a.id = i.artista_id
  group by 1, 2, 3, 4, 5, 9, 10;

comment on view dash_interessados_diarios is
  'Interessados agrupados por dia (América/São_Paulo — ver 0007), evento, artista, cidade e estado. Cidade/estado existem só para permitir filtro por clique no gráfico de geografia (ver 0008) — o app soma total por dia/evento/artista normalmente, ignorando o split extra quando não há filtro de cidade ativo. Base do gráfico de tendência, dos KPIs de volume/delta e do ranking de eventos.';

create or replace view dash_geografia as
  select
    coalesce(cidade_normalizada, cidade_informada) as cidade,
    coalesce(estado_normalizado, estado_informada) as estado,
    artista_id,
    evento_id,
    count(*) as total,
    date_trunc('day', coalesce(submitted_at, synced_at) at time zone 'America/Sao_Paulo')::date as dia
  from interessados_ativos
  where coalesce(cidade_normalizada, cidade_informada) is not null
  group by 1, 2, 3, 4, 6;

comment on view dash_geografia is
  'Interessados agrupados por dia (América/São_Paulo), cidade/estado (normalizado, com fallback para o informado), artista e evento. Dia adicionado na 0008 para o gráfico de top cidades respeitar o filtro de período, que antes era ignorado.';

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
    count(i.id) filter (where i.local_revisao_pendente) as local_pendentes,
    coalesce(i.cidade_normalizada, i.cidade_informada) as cidade,
    coalesce(i.estado_normalizado, i.estado_informada) as estado
  from sources_ativas s
  join eventos e on e.id = s.evento_id
  join artistas a on a.id = e.artista_id
  left join interessados_ativos i on i.source_id = s.id
  group by
    s.id, s.name, s.tipo, s.status, s.last_synced_at, e.id, e.nome, a.id, a.nome,
    coalesce(i.cidade_normalizada, i.cidade_informada),
    coalesce(i.estado_normalizado, i.estado_informada);

comment on view dash_qualidade_por_fonte is
  'Qualidade de dado por fonte ativa, agora também dividida por cidade/estado (0008) para permitir filtro por clique no gráfico de geografia. Uma fonte com leads de N cidades gera N linhas aqui — lib/dashboard/queries.ts recolapsa por source_id antes de exibir/gerar alertas, senão a mesma fonte apareceria duplicada na tabela.';
