-- 0009_dash_diarios_data_desconhecida.sql
--
-- dash_interessados_diarios usa coalesce(submitted_at, synced_at) como
-- "dia" (ver 0007/0008) para não perder do gráfico de tendência os
-- interessados de fontes sem coluna de data de cadastro mapeada. Isso
-- funciona bem para Google Sheets sincronizado por cron (synced_at fica
-- perto da data real), mas é ruim para upload de CSV/XLS: um arquivo
-- inteiro com cadastros antigos entra de uma vez, e todos ganham o dia do
-- upload — criando um pico artificial que destrói a leitura da evolução
-- real de cadastros ao longo do tempo.
--
-- Em vez de mudar o cálculo de "dia" (que quebraria os KPIs de volume e o
-- ranking, hoje todos somados em cima dessa mesma coluna), esta migração só
-- expõe `data_desconhecida` (true quando não há submitted_at real). O app
-- (lib/dashboard/queries.ts) usa essa flag para excluir esses registros
-- especificamente da série do gráfico de tendência diária, mantendo-os
-- contados nos KPIs de volume/ranking — e mostra quantos foram excluídos
-- como aviso.

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
    (i.submitted_at is null) as data_desconhecida
  from interessados_ativos i
  join eventos e on e.id = i.evento_id
  join artistas a on a.id = i.artista_id
  group by 1, 2, 3, 4, 5, 9, 10, 11;

comment on view dash_interessados_diarios is
  'Interessados agrupados por dia (América/São_Paulo — ver 0007), evento, artista, cidade e estado. Cidade/estado existem só para permitir filtro por clique no gráfico de geografia (ver 0008). data_desconhecida (0009) marca linhas onde o dia veio do fallback synced_at (fonte sem data de cadastro real) — o app exclui essas linhas da série de tendência, mas soma normalmente nos KPIs de volume e no ranking. Base do gráfico de tendência, dos KPIs de volume/delta e do ranking de eventos.';
