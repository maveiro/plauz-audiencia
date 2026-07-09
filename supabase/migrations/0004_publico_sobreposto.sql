-- 0004_publico_sobreposto.sql
--
-- View de análise (PLANO.md, Fase 6): agrupa interessados_ativos por e-mail,
-- conta artista_id distintos, filtra quem aparece em mais de um artista.
-- Responde diretamente "há sobreposição de público entre artistas?" via
-- query/view, sem uma entidade "pessoa" unificada no schema (CLAUDE.md,
-- seção "O que este projeto explicitamente NÃO faz").

create view publico_sobreposto as
  select
    email,
    count(distinct artista_id) as artistas_distintos,
    array_agg(distinct artista_id) as artista_ids,
    count(*) as total_registros
  from interessados_ativos
  where email is not null and email <> ''
  group by email
  having count(distinct artista_id) > 1;

comment on view publico_sobreposto is
  'E-mails que aparecem como interessados de mais de um artista distinto — sobreposição de público entre artistas.';
