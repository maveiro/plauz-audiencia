-- 0001_init.sql
-- Schema inicial consolidado: artistas, eventos, fontes (Sheets + upload),
-- dado bruto, mapeamentos, tabela canônica com normalização geográfica,
-- soft delete e views de acesso seguro.
-- Ver CLAUDE.md para os princípios que orientam este desenho.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- similarity() para normalização geográfica

-- ============================================================================
-- ARTISTAS
-- ============================================================================
create table artistas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

comment on table artistas is 'Artistas para os quais existe captação de interessados em eventos.';

-- ============================================================================
-- EVENTOS
-- Cada evento/edição pertence a um artista.
-- ============================================================================
create table eventos (
  id uuid primary key default gen_random_uuid(),
  artista_id uuid not null references artistas(id) on delete cascade,
  nome text not null,
  data_evento date,
  status text not null default 'planejamento'
    check (status in ('planejamento', 'vendas_abertas', 'encerrado')),
  created_at timestamptz not null default now()
);

comment on table eventos is 'Eventos/edições de um artista, para os quais existe captação de interessados.';

create index idx_eventos_artista_id on eventos(artista_id);

-- ============================================================================
-- SOURCES (fontes)
-- Uma planilha do Google OU um arquivo enviado manualmente, pertencente a um evento.
-- ============================================================================
create table sources (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  name text not null,

  tipo text not null default 'google_sheets'
    check (tipo in ('google_sheets', 'arquivo_upload')),

  -- Campos específicos de google_sheets
  sheet_id text,
  sheet_url text,
  tab_name text,

  -- Campos específicos de arquivo_upload
  arquivo_path text,          -- caminho no Supabase Storage
  arquivo_nome_original text,
  arquivo_enviado_em timestamptz,

  status text not null default 'active'
    check (status in ('active', 'paused', 'error')),
  last_synced_at timestamptz,

  deleted_at timestamptz,     -- soft delete: null = ativo

  created_at timestamptz not null default now(),

  constraint chk_source_tipo_dados check (
    (tipo = 'google_sheets' and sheet_id is not null and sheet_url is not null)
    or
    (tipo = 'arquivo_upload' and arquivo_path is not null)
  )
);

comment on table sources is 'Fontes de dados: planilhas do Google Sheets ou arquivos (CSV/XLS) enviados manualmente.';
comment on column sources.tab_name is 'Nome da aba específica, se a planilha tiver múltiplas abas relevantes.';
comment on column sources.deleted_at is 'Soft delete. Consultar sempre via view sources_ativas, nunca esta tabela diretamente.';
comment on constraint chk_source_tipo_dados on sources is 'Garante que cada tipo de fonte tenha os campos obrigatórios correspondentes preenchidos.';

create index idx_sources_evento_id on sources(evento_id);

-- ============================================================================
-- RAW_RESPONSES (dado bruto)
-- Uma linha por resposta, exatamente como veio da fonte (Sheets ou arquivo).
-- Imutável: nunca é sobrescrita, apenas inserida.
-- ============================================================================
create table raw_responses (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  row_hash text not null,
  raw_data jsonb not null,
  synced_at timestamptz not null default now(),

  unique (source_id, row_hash)
);

comment on table raw_responses is 'Dado bruto, imutável, de cada linha da fonte. row_hash garante idempotência.';
comment on column raw_responses.row_hash is 'Hash do conteúdo da linha (chaves ordenadas alfabeticamente antes de serializar), usado para evitar duplicar a mesma resposta em execuções repetidas. Edições na fonte original geram um hash novo, e portanto um novo registro — limitação conhecida e aceita.';

create index idx_raw_responses_source_id on raw_responses(source_id);

-- ============================================================================
-- FIELD_MAPPINGS
-- Configuração declarativa: como traduzir cada coluna de cada fonte para o
-- campo canônico correspondente.
-- ============================================================================
create table field_mappings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  source_field text not null,
  canonical_field text not null
    check (canonical_field in (
      'nome_completo', 'telefone', 'email', 'cidade', 'estado', 'submitted_at'
    )),
  transform text,

  unique (source_id, source_field)
);

comment on table field_mappings is 'Mapeamento declarativo de coluna da fonte -> campo canônico, por fonte.';
comment on column field_mappings.canonical_field is 'cidade e estado aqui se referem, na prática, às colunas cidade_informada/estado_informada em interessados — ver CLAUDE.md.';
comment on column field_mappings.transform is 'Identificador de função de transformação (ex: only_digits, trim_lowercase, split_cidade_estado), aplicada no código.';

create index idx_field_mappings_source_id on field_mappings(source_id);

-- ============================================================================
-- MUNICIPIOS_REF
-- Referência de municípios brasileiros (dados públicos do IBGE), usada na
-- normalização geográfica por similaridade de texto.
-- ============================================================================
create table municipios_ref (
  id serial primary key,
  nome text not null,
  uf text not null,
  nome_normalizado text not null    -- sem acento, minúsculo, espaços únicos
);

comment on table municipios_ref is 'Lista de referência de municípios (IBGE), usada para corrigir cidade/estado digitados livremente.';

create index idx_municipios_ref_nome_normalizado_trgm
  on municipios_ref using gin (nome_normalizado gin_trgm_ops);

-- ============================================================================
-- INTERESSADOS (tabela canônica)
-- Uma linha por resposta normalizada. É esta tabela que a aplicação consulta
-- (por meio da view interessados_ativos).
-- ============================================================================
create table interessados (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  artista_id uuid not null references artistas(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  raw_response_id uuid not null references raw_responses(id) on delete cascade,

  nome_completo text,

  telefone text,
  telefone_valido boolean,

  email text,
  email_valido boolean,

  cidade_informada text,
  estado_informada text,
  cidade_normalizada text,
  estado_normalizado text,          -- sempre UF, ex: "PR"
  local_confianca real,              -- 0 a 1
  local_revisao_pendente boolean not null default true,

  submitted_at timestamptz,

  extra jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),

  unique (raw_response_id)
);

comment on table interessados is 'Tabela canônica e unificada de interessados, derivada de raw_responses via field_mappings.';
comment on column interessados.telefone is 'Somente dígitos, sem formatação.';
comment on column interessados.telefone_valido is 'Validação leve de formato. Não garante que o número exista.';
comment on column interessados.email_valido is 'Validação leve de formato. Deliverability real é verificada sob demanda, fora da sincronização automática.';
comment on column interessados.cidade_informada is 'Texto exatamente como a pessoa digitou/selecionou. Nunca sobrescrito.';
comment on column interessados.cidade_normalizada is 'Cidade corrigida/padronizada contra municipios_ref. Preenchida automaticamente pela normalização geográfica pós-sync.';
comment on column interessados.local_revisao_pendente is 'true quando a normalização geográfica não teve confiança suficiente para corrigir automaticamente — fica pendente de revisão manual.';
comment on column interessados.extra is 'Campos presentes na fonte mas ainda não mapeados para uma coluna própria.';

create index idx_interessados_evento_id on interessados(evento_id);
create index idx_interessados_artista_id on interessados(artista_id);
create index idx_interessados_source_id on interessados(source_id);
create index idx_interessados_email on interessados(email);
create index idx_interessados_artista_email on interessados(artista_id, email);

-- ============================================================================
-- SYNC_LOGS
-- ============================================================================
create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_found integer,
  rows_inserted integer,
  status text not null default 'running'
    check (status in ('running', 'success', 'error')),
  error_message text
);

comment on table sync_logs is 'Histórico de execuções de sincronização/reprocessamento, por fonte.';

create index idx_sync_logs_source_id on sync_logs(source_id);

-- ============================================================================
-- VIEWS DE ACESSO SEGURO (soft delete)
-- A aplicação consulta sempre estas views, nunca as tabelas cruas, para
-- garantir que fontes/interessados excluídos (soft delete) nunca reapareçam.
-- ============================================================================
create view sources_ativas as
  select * from sources where deleted_at is null;

create view interessados_ativos as
  select i.*
  from interessados i
  join sources s on s.id = i.source_id
  where s.deleted_at is null;

comment on view sources_ativas is 'Fontes não excluídas (soft delete). Usar sempre esta view na aplicação, nunca a tabela sources diretamente.';
comment on view interessados_ativos is 'Interessados cuja fonte não foi excluída (soft delete). Usar sempre esta view na aplicação.';

-- ============================================================================
-- RLS
-- Habilitado desde o início. A aplicação server-side usa a service role key
-- (que ignora RLS por padrão). Estas políticas cobrem o uso futuro de uma
-- chave anon/client, caso a aplicação passe a acessar o Supabase direto do
-- browser.
-- ============================================================================
alter table artistas enable row level security;
alter table eventos enable row level security;
alter table sources enable row level security;
alter table raw_responses enable row level security;
alter table field_mappings enable row level security;
alter table municipios_ref enable row level security;
alter table interessados enable row level security;
alter table sync_logs enable row level security;

-- Nenhuma política de acesso público é criada aqui de propósito: com RLS
-- habilitado e sem políticas, apenas a service role (server-side) consegue
-- ler/escrever. Se no futuro a interface precisar de leitura direta via
-- client com a chave anon, adicionar políticas explícitas em uma nova
-- migração, autenticadas por usuário.
