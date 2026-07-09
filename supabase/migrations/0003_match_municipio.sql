-- 0003_match_municipio.sql
--
-- Função de apoio à normalização geográfica (CLAUDE.md, princípio 6): dado
-- um nome de cidade já normalizado (sem acento, minúsculo) e opcionalmente
-- uma UF conhecida, devolve o município de municipios_ref mais parecido por
-- similaridade de trigrama (pg_trgm), já habilitado desde 0001_init.sql.
--
-- Mantida como função SQL para permitir usar o operador de similaridade e o
-- índice GIN em nome_normalizado (idx_municipios_ref_nome_normalizado_trgm)
-- de forma eficiente, chamada via supabase.rpc(...) a partir do motor de
-- sincronização (lib/geo).

create or replace function match_municipio(
  p_nome_normalizado text,
  p_uf text default null
)
returns table (nome text, uf text, similaridade real)
language sql
stable
as $$
  select
    m.nome,
    m.uf,
    similarity(m.nome_normalizado, p_nome_normalizado) as similaridade
  from municipios_ref m
  where p_uf is null or m.uf = p_uf
  order by similarity(m.nome_normalizado, p_nome_normalizado) desc
  limit 1;
$$;

comment on function match_municipio(text, text) is
  'Retorna o município de municipios_ref mais parecido (trigram similarity) com p_nome_normalizado, opcionalmente restrito a uma UF. Usado pela normalização geográfica automática pós-sync.';
