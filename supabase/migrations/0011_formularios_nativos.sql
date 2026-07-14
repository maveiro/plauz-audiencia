-- 0011_formularios_nativos.sql
-- Terceiro tipo de fonte: formulário nativo de captação, hospedado pelo
-- próprio produto (substitui/complementa Google Forms + Sheets). Ver
-- CLAUDE.md e docs/PLANO.md (Fase 9) para o desenho completo.
--
-- Formulário nativo é fonte "push" (submissão em tempo real), diferente de
-- google_sheets/arquivo_upload (fontes "pull", lidas em lote pelo motor de
-- sync). Por isso `sources` ganha um terceiro `tipo` mas sem colunas de
-- dados específicas — a configuração completa vive em `formularios` /
-- `formulario_perguntas`, mantendo `sources` enxuta.

-- ============================================================================
-- sources: terceiro tipo de fonte
-- ============================================================================
alter table sources drop constraint sources_tipo_check;
alter table sources add constraint sources_tipo_check
  check (tipo in ('google_sheets', 'arquivo_upload', 'formulario_nativo'));

alter table sources drop constraint chk_source_tipo_dados;
alter table sources add constraint chk_source_tipo_dados check (
  (tipo = 'google_sheets' and sheet_id is not null and sheet_url is not null)
  or
  (tipo = 'arquivo_upload' and arquivo_path is not null)
  or
  (tipo = 'formulario_nativo')  -- dados específicos vivem em `formularios`
);

-- ============================================================================
-- FORMULARIOS
-- Configuração do formulário público, 1:1 com uma source do tipo
-- formulario_nativo.
-- ============================================================================
create table formularios (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references sources(id) on delete cascade,

  slug text not null unique,
  titulo text not null,
  descricao text,

  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicado', 'pausado')),

  texto_consentimento text not null,
  texto_confirmacao text,

  cor_destaque text,
  logo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_formulario_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60)
);

comment on table formularios is 'Configuração de um formulário nativo de captação (página pública em /f/{slug}). 1:1 com sources.tipo = formulario_nativo.';
comment on column formularios.texto_consentimento is 'Texto do checkbox de aceite (LGPD), obrigatório — precisa cobrir o compartilhamento com a Meta quando o Pixel/Conversions API estiver configurado (ver 0012).';
comment on column formularios.status is 'rascunho: só visível para usuário autenticado (pré-visualização). publicado: aberto ao público. pausado: página "captação encerrada", nunca 404 (evita quebrar link de campanha antiga).';

create index idx_formularios_source_id on formularios(source_id);

-- ============================================================================
-- FORMULARIO_PERGUNTAS
-- Perguntas extras, além dos campos padrão fixos (nome, telefone, e-mail,
-- cidade/estado) que todo formulário nativo já tem no template público —
-- por isso não são configuráveis aqui (builder deliberadamente enxuto).
-- ============================================================================
create table formulario_perguntas (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references formularios(id) on delete cascade,

  ordem int not null,
  tipo text not null
    check (tipo in ('texto_curto', 'texto_longo', 'multipla_escolha', 'caixa_selecao')),
  rotulo text not null,
  obrigatorio boolean not null default false,
  opcoes jsonb,             -- array de strings; obrigatório para multipla_escolha/caixa_selecao

  chave text not null,      -- slug estável gerado 1x do rótulo; chave em interessados.extra
  ativo boolean not null default true,  -- "remover" pós-publicação = desativar, nunca deletar

  created_at timestamptz not null default now(),

  unique (formulario_id, chave),

  constraint chk_pergunta_opcoes check (
    (tipo in ('multipla_escolha', 'caixa_selecao') and jsonb_typeof(opcoes) = 'array' and jsonb_array_length(opcoes) >= 2)
    or
    (tipo in ('texto_curto', 'texto_longo') and opcoes is null)
  )
);

comment on table formulario_perguntas is 'Perguntas extras de um formulário nativo, além dos campos padrão fixos. Respostas ficam em interessados.extra, chaveadas por `chave` (estável mesmo se `rotulo` for editado depois de publicado).';
comment on column formulario_perguntas.chave is 'Gerada 1x a partir do rótulo na criação, nunca reescrita — evita órfãos em interessados.extra quando o texto da pergunta é corrigido depois de publicado.';
comment on column formulario_perguntas.ativo is 'Pergunta "removida" pós-publicação vira ativo=false (some do formulário público), nunca é deletada — preserva a leitura das respostas antigas em interessados.extra.';

create index idx_formulario_perguntas_formulario_id on formulario_perguntas(formulario_id);
