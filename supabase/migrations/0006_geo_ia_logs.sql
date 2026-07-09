-- 0006_geo_ia_logs.sql
--
-- Auditoria da normalização geográfica assistida por IA (ver CLAUDE.md,
-- princípio 6, e app/revisao/). O passo determinístico por trigram
-- (match_municipio, 0003) continua rodando durante o sync, sem mudanças.
-- Esta tabela registra uma camada adicional, disparada manualmente pelo
-- botão "Resolver com IA" na tela /revisao, sobre os casos que o passo
-- determinístico deixou pendentes: toda sugestão da IA é logada aqui,
-- tenha sido aplicada automaticamente (alta confiança) ou não (caso
-- permaneça pendente para revisão humana) — nunca só as aplicadas.
create table geo_ia_logs (
  id uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados(id) on delete cascade,

  cidade_informada text,
  estado_informada text,

  cidade_sugerida text,
  estado_sugerido text,
  confianca_ia real,             -- confiança auto-relatada pelo modelo (0 a 1)
  confianca_similaridade real,   -- similaridade contra municipios_ref (mesmo motor do match_municipio)

  aplicado boolean not null,     -- true = escreveu em interessados.cidade_normalizada/estado_normalizado
  modelo text not null,
  motivo text,

  created_at timestamptz not null default now()
);

comment on table geo_ia_logs is 'Log de auditoria de toda sugestão de normalização geográfica gerada por IA (aplicada ou não), disparada manualmente na tela /revisao.';
comment on column geo_ia_logs.aplicado is 'true quando a sugestão foi aplicada automaticamente (alta confiança da IA + validação contra municipios_ref); false quando ficou como sugestão para revisão humana.';
comment on column geo_ia_logs.confianca_similaridade is 'Similaridade de trigrama entre a sugestão da IA e o município mais parecido em municipios_ref — mesma validação usada pelo passo determinístico, evitando que a IA "alucine" uma cidade inexistente.';

create index idx_geo_ia_logs_interessado_id on geo_ia_logs(interessado_id);

alter table geo_ia_logs enable row level security;
