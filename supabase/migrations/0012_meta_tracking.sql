-- 0012_meta_tracking.sql
-- Tracking de campanha (UTM/fbclid) + integração com o Pixel de conversão
-- da Meta (client-side) e a Conversions API (server-side). Ver CLAUDE.md e
-- docs/PLANO.md (Fase 10) para o desenho completo. Depende de 0011
-- (formularios) já aplicada.

alter table formularios add column meta_pixel_id text;

comment on column formularios.meta_pixel_id is 'ID do Pixel da Meta (não é segredo — todo Pixel já é exposto no HTML de qualquer site que o usa). Token de acesso da Conversions API fica fora do banco, em META_CONVERSIONS_API_ACCESS_TOKEN (env var, server-only).';

alter table interessados
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column utm_content text,
  add column fbclid text;

comment on column interessados.utm_source is 'Capturado da query string da página pública do formulário no carregamento. Dimensão de análise de primeira classe — permite estender uma view dash_campanhas futura, sem SQL ad-hoc (CLAUDE.md, seção dashboard).';

create table meta_capi_logs (
  id uuid primary key default gen_random_uuid(),
  interessado_id uuid not null references interessados(id) on delete cascade,
  event_id uuid not null,
  enviado boolean not null default false,
  resposta_meta jsonb,
  erro text,
  created_at timestamptz not null default now()
);

comment on table meta_capi_logs is 'Log de toda chamada à Conversions API da Meta, sucesso ou erro (mesmo espírito de geo_ia_logs — nunca só as que deram certo). event_id é o mesmo enviado ao Pixel client-side, para o Meta deduplicar.';

create index idx_meta_capi_logs_interessado_id on meta_capi_logs(interessado_id);
