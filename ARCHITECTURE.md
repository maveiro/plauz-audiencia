# Arquitetura

Visão técnica de como o sistema é construído e como os dados fluem. Para o
"porquê" das decisões e os princípios que não devem ser quebrados, ver
`CLAUDE.md`. Para o roadmap por fase, ver `docs/PLANO.md`.

## Visão geral

```
┌─────────────────┐     ┌──────────────────┐
│  Google Sheets   │     │  Upload CSV/XLS   │
│  (fonte)         │     │  (fonte)          │
└────────┬─────────┘     └─────────┬─────────┘
         │ GoogleSheetsReader       │ FileUploadReader
         │ (lib/readers)            │ (lib/readers)
         └───────────┬──────────────┘
                      │ implementam SourceReader.getRows()
                      ▼
            ┌───────────────────┐
            │   syncSource()     │  lib/sync/syncSource.ts
            │  (motor de sync)   │  — agnóstico ao tipo de fonte
            └─────────┬──────────┘
                      │
     1. row_hash (chaves ordenadas) ──▶ raw_responses (upsert, idempotente)
     2. field_mappings + transforms ──▶ campos canônicos
     3. validação leve (email/telefone) ──▶ *_valido
     4. normalização geográfica (pg_trgm via match_municipio) ──▶ cidade/estado normalizados
     5. insert ──▶ interessados
     6. log ──▶ sync_logs
                      │
                      ▼
            ┌───────────────────┐
            │  Supabase Postgres │
            │  (RLS habilitado)  │
            └─────────┬──────────┘
                      │ consultado só via views (soft delete)
                      ▼
        sources_ativas / interessados_ativos / publico_sobreposto
                      │
                      ▼
            Next.js App Router (Server Components + Server Actions)
```

## Camadas e responsabilidades

| Camada | Local | Responsabilidade |
|---|---|---|
| Leitores de fonte | `lib/readers/` | Traduzem Google Sheets ou arquivo (Storage) para `RawRow[]` — mesma forma, independente da origem |
| Motor de sync | `lib/sync/` | Hash, upsert em `raw_responses`, mapeamento para canônico, orquestra validação/geo, insere em `interessados`, grava `sync_logs` |
| Transforms | `lib/transforms/` | Dicionário de funções puras (`trim`, `only_digits`, `split_cidade_estado_*`, ...) referenciadas por nome em `field_mappings.transform` |
| Validação | `lib/validation/` | Formato leve de e-mail/telefone — nunca descarta linha |
| Geo | `lib/geo/` | Normaliza nome de cidade e casa contra `municipios_ref` via similaridade de trigrama (função SQL `match_municipio`); `aiResolveGeografia.ts` é uma segunda camada, sob demanda, que trata com IA os casos que sobraram pendentes (ver seção "Revisão de local assistida por IA") |
| Google | `lib/google/` | Cliente autenticado (service account, somente leitura) + extração de `sheet_id` da URL |
| Storage | `lib/storage/` | Upload/replace de arquivo no Supabase Storage, caminho determinístico por `source_id` |
| Supabase | `lib/supabase/` | Client server-side com a service role key — nunca importado por código client |
| Tipos | `lib/database.types.ts` | Tipos do schema, mantidos manualmente em sincronia com as migrações (ver nota no topo do arquivo) |
| Rotas de API | `app/api/` | Superfície HTTP: upload, sync manual, cron |
| Interface | `app/*/page.tsx` | Server Components que consultam Supabase diretamente (service role, server-side) |
| Mutações | `app/*/actions.ts` | Server Actions (`"use server"`) para criar/editar/excluir — evita rotas de API redundantes para operações internas da UI |
| UI compartilhada | `app/_components/` | Toast, status pill, skeleton de loading, nav ativa — ver CLAUDE.md, seção "Componentes de UI compartilhados" |
| Sugestão de mapeamento | `lib/fieldMappings/` | Pré-preenche `field_mappings` de uma fonte nova a partir do histórico de outras fontes com as mesmas colunas — puramente sugestivo, ver seção dedicada abaixo |

## Schema (Postgres/Supabase)

Aplicado em ordem por `supabase/migrations/`:

- **`0001_init.sql`** — schema completo: `artistas`, `eventos`, `sources`,
  `raw_responses`, `field_mappings`, `municipios_ref`, `interessados`,
  `sync_logs`; views `sources_ativas` e `interessados_ativos`; RLS habilitado
  em todas as tabelas, sem políticas públicas (só a service role acessa).
- **`0002_fix_field_mappings_unique.sql`** — corrige a constraint de
  unicidade de `field_mappings` para `(source_id, source_field,
  canonical_field)` — a original impedia uma mesma coluna de origem
  alimentar dois campos canônicos (necessário para `split_cidade_estado_*`).
- **`0003_match_municipio.sql`** — função SQL `match_municipio(nome, uf?)`
  que usa `pg_trgm` para achar o município mais parecido; chamada via
  `supabase.rpc(...)` a partir de `lib/geo/matchMunicipio.ts`.
- **`0004_publico_sobreposto.sql`** — view que agrupa `interessados_ativos`
  por e-mail e filtra quem aparece em mais de um `artista_id`.
- **`0005_dashboard_views.sql`** — três views de agregação para o dashboard
  (`/dashboard`): `dash_interessados_diarios` (grão dia/evento/artista —
  tendência, KPIs de volume/delta e ranking de eventos, todos filtrados em
  runtime via PostgREST), `dash_qualidade_por_fonte` (snapshot atual, sem
  filtro de período, de validade de contato e revisão geográfica pendente
  por fonte ativa) e `dash_geografia` (grão cidade/estado/artista/evento,
  sem filtro de período no v1).
- **`0006_geo_ia_logs.sql`** — tabela `geo_ia_logs`: auditoria de toda
  sugestão de normalização geográfica gerada por IA (aplicada ou não),
  disparada manualmente na tela `/revisao` — ver seção "Revisão de local
  assistida por IA".
- **`0007_fix_dash_diarios_timezone.sql`** — corrige `dash_interessados_diarios`
  para truncar o dia em América/São_Paulo, não no timezone da sessão do
  Postgres (UTC) — sem isso, interessados enviados entre 21h e 23h59
  (horário de SP) contavam no dia seguinte.
- **`0008_dash_filtros_clicaveis.sql`** — adiciona `cidade`/`estado` a
  `dash_interessados_diarios`/`dash_qualidade_por_fonte` e `dia` a
  `dash_geografia`, viabilizando o filtro por clique nos gráficos de "Top
  cidades" e "Ranking de eventos".
- **`0009_dash_diarios_data_desconhecida.sql`** — adiciona
  `data_desconhecida` a `dash_interessados_diarios`, marcando linhas cujo
  "dia" veio do fallback `synced_at` (fonte sem coluna de data de envio
  mapeada) — o app exclui essas linhas da série de tendência (evita pico
  artificial no dia de um upload de CSV com cadastros antigos), mas
  continua somando normalmente nos KPIs de volume e no ranking.
- **`0010_dash_fonte_cidade_filtros.sql`** — adiciona `source_id` a
  `dash_interessados_diarios`/`dash_geografia` (faltava — só
  `dash_qualidade_por_fonte` tinha) e cria `dash_cidades_disponiveis`
  (lista distinta de cidade/estado, sem filtro de período/artista/evento),
  viabilizando os dropdowns de fonte e cidade no `FilterBar` do dashboard —
  antes cidade só era filtrável clicando numa barra do gráfico, e fonte não
  era filtrável no dashboard como um todo.

Diagrama de relacionamento (chaves estrangeiras):

```
artistas ──┬── eventos ──── sources ──┬── raw_responses ──── interessados
           │                          ├── field_mappings
           └──────────────────────────┴── interessados      └── sync_logs
                                       └── sync_logs
```

`interessados` referencia `evento_id`, `artista_id` (desnormalizado, herdado
do evento no momento do sync), `source_id` e `raw_response_id` (1:1, único).

## Rotas de API

| Rota | Método | Uso |
|---|---|---|
| `/api/sync/[sourceId]` | `POST` | Dispara `syncSource(sourceId)` — usada pelo botão "Sincronizar agora" |
| `/api/sources/upload` | `POST` | Cria uma fonte `arquivo_upload` nova (multipart: `evento_id`, `name`, `file`) |
| `/api/sources/[sourceId]/upload` | `POST` | Reenvia arquivo de uma fonte existente e já roda o sync |
| `/api/cron/sync` | `GET` | Sincroniza todas as fontes `google_sheets` ativas; protegida por `Authorization: Bearer $CRON_SECRET` |

O cron não é agendado automaticamente por padrão (ver README, seção
"Automação") — a rota funciona independente de agendamento e pode ser
chamada por qualquer scheduler externo.

## Dashboard

`/dashboard` (`app/dashboard/page.tsx`) é a tela de acompanhamento diário —
volume de interessados, tendência, ranking de eventos, geografia, qualidade
de dado por fonte e sobreposição de público. Server Component que consulta
as views `dash_*` (ver "Schema" acima) e `publico_sobreposto` via
`lib/dashboard/queries.ts`; toda a agregação por período/artista/fonte/cidade
acontece em JS sobre o resultado já filtrado no Postgres, sem view por
combinação de filtro. Filtros ficam na URL
(`?periodo=&artista_id=&fonte_id=&cidade=&estado=`), lidos pelo Server
Component e escritos por um Client Component pequeno (`FilterBar.tsx`) — três
`<select>` (artista, fonte, cidade) mais os botões de período. As listas de
opções de fonte e cidade são buscadas **sem** os filtros ativos aplicados
(mesmo padrão de `artistas`), senão a opção selecionada podia sumir do
próprio dropdown ao combinar com outro filtro. `evento_id` não tem dropdown
próprio — só é setável clicando numa barra do "Ranking de eventos"
(`RankingChart.tsx`); `cidade`/`estado` têm as duas entradas (dropdown *e*
clique no "Top cidades", `GeoChart.tsx`) escrevendo o mesmo par de params, no
mesmo formato (`cidade|estado` como valor do `<option>`/id da barra) — ver
`CLAUDE.md`, seção "Camada adicional: dashboard".

`loadDashboardData` busca a lista de fontes reaproveitando
`dash_qualidade_por_fonte` sem filtro (dedupe por `source_id` em JS) em vez
de ter uma view dedicada tipo `dash_cidades_disponiveis` — funciona, mas é
uma segunda ida a essa view na mesma request (a filtrada, pra tabela de
qualidade, é uma busca separada). Ficou assim por pragmatismo; migrar para
uma view própria de fontes é uma limpeza pendente, não um bug.

Gráficos usam Recharts (`TrendChart`, `RankingChart`,
`GeoChart`/`HorizontalBarChart`), que por usarem hooks precisam ser Client
Components — a busca de dados em si continua inteiramente server-side. Cores
seguem a paleta fixa em `app/globals.css` (`--series-1..8`,
`--status-*`), light/dark via `prefers-color-scheme`, mesmo padrão do resto
do app.

## Revisão de local assistida por IA

`/revisao` (`app/revisao/page.tsx`) lista os `interessados_ativos` com
`local_revisao_pendente = true` — casos que a normalização determinística
(`match_municipio`, pg_trgm) não resolveu com confiança suficiente. Além da
confirmação manual (já existente, `resolveRevisao` em `actions.ts`), a tela
tem um botão "Resolver com IA" (`ResolverComIABotao.tsx`, Client Component)
que dispara a server action `resolverComIA`:

1. Busca os pendentes atualmente exibidos (mesmo `LIMIT` da página).
2. Chama `resolverPendentesComIA` (`lib/geo/aiResolveGeografia.ts`), que
   envia lotes de até 30 itens ao Claude (`claude-opus-4-8`, saída
   estruturada via `output_config.format`), pedindo cidade + UF + confiança
   + motivo para cada um, usando conhecimento de apelidos/abreviações
   (ex: "Beaga" → Belo Horizonte/MG).
3. Cada sugestão da IA é validada contra `municipios_ref` com o mesmo
   `matchMunicipio` usado no passo determinístico — evita aplicar uma
   cidade que a IA "alucinou" e não existe na referência.
4. Se a confiança da IA **e** a similaridade contra `municipios_ref` forem
   altas, a sugestão é aplicada automaticamente (`cidade_normalizada`,
   `estado_normalizado`, `local_confianca`, `local_revisao_pendente =
   false`). Caso contrário, o registro continua pendente, mas a sugestão da
   IA pré-preenche os campos da revisão manual (`RevisaoRow.tsx` busca a
   sugestão mais recente em `geo_ia_logs` por `interessado_id`).
5. **Toda** sugestão — aplicada ou não — é registrada em `geo_ia_logs`
   (cidade/estado informados, sugestão, confiança da IA, similaridade,
   se foi aplicada, modelo usado, motivo). É o log de auditoria pedido para
   qualquer alteração feita por IA.

Deliberadamente **não** roda como parte de `syncSource` — é uma camada
adicional, sob demanda, para não acoplar uma chamada de API externa (custo,
latência, ponto de falha) ao caminho crítico do sync. Requer
`ANTHROPIC_API_KEY` (server-side only — ver `.env.example`).

## Sugestão de mapeamento de campo

`app/fontes/[sourceId]/mapeamento/page.tsx` chama
`suggestFieldMappings(supabase, allColumns)`
(`lib/fieldMappings/suggestMappings.ts`) só quando a fonte **ainda não tem**
nenhum `field_mappings` salvo. A função busca, na tabela `field_mappings`
inteira (todas as fontes), linhas cujo `source_field` bate com alguma coluna
detectada nessa fonte nova, e para cada coluna escolhe o `canonical_field` e
o `transform` mais frequentes historicamente — útil quando várias fontes
reusam o mesmo template de formulário (mesmos cabeçalhos), como uma "Lista
Padrão" reaplicada a cada evento. O resultado só pré-preenche o formulário
(`FieldMappingsForm.tsx`, com um aviso visível de que é sugestão) — nada é
gravado em `field_mappings` até o usuário clicar em "Salvar mapeamento". Uma
fonte que já tem mapeamento salvo nunca passa por essa função — não há
risco de sobrescrever configuração existente.

## Idempotência e integridade

- **Deduplicação de linha bruta:** hash SHA-256 do conteúdo da linha, chaves
  ordenadas alfabeticamente, único por `(source_id, row_hash)`. Rodar
  `syncSource` várias vezes sobre a mesma fonte não duplica.
- **`syncSource`** busca os hashes já existentes de uma vez (`Set`), filtra
  as linhas novas, insere em lote (`raw_responses` e `interessados`) — evita
  N chamadas ao banco por linha.
- **Normalização geográfica** usa um cache em memória por execução
  (`createGeografiaResolver`), memoizando por `(cidade_normalizada, uf)` —
  evita repetir a mesma consulta de similaridade para cidades que se repetem
  entre interessados do mesmo evento.
- **Soft delete:** `sources.deleted_at`. A aplicação só lê pelas views
  `*_ativas`. Hard delete é um script manual (`scripts/hard-delete-expired.ts`),
  nunca automático.

## Segurança

- `SUPABASE_SERVICE_ROLE_KEY` e a chave privada da service account do Google
  só existem em módulos marcados `import "server-only"` — o build falha se
  algum desses módulos for importado por código client.
- RLS habilitado em todas as tabelas, sem políticas públicas: só a service
  role (server-side) lê/escreve. Se a aplicação um dia precisar de acesso
  direto do client com a chave anon, isso exige políticas explícitas em uma
  nova migração — não existe hoje.
- `/api/cron/sync` exige `Authorization: Bearer $CRON_SECRET`.
- Upload de arquivo valida extensão (`csv`, `xls`, `xlsx`) antes de gravar no
  Storage.

## Deploy

- **Vercel**: `vercel.json` fixa `"framework": "nextjs"` (necessário quando o
  projeto foi importado com o Framework Preset errado no dashboard — sem
  isso, a Vercel procura uma pasta `public/` estática em vez de usar o
  adapter do Next.js). Variáveis de ambiente configuradas no dashboard da
  Vercel, mesmas chaves do `.env.example`. **Adicionar ou editar uma env var
  não afeta deployments já publicados** — as funções serverless capturam o
  valor no momento do build/deploy; é preciso disparar um redeploy (dashboard
  → Deployments → "Redeploy", ou um novo push) para o valor novo entrar em
  vigor.
- **Supabase**: schema versionado por `supabase db push` a partir de
  `supabase/migrations/` (alternativa sem o fluxo interativo de
  `supabase login`: `npm run apply-migrations`, que usa `DATABASE_URL`
  diretamente — ver script em `scripts/apply-migrations.ts`).
  `municipios_ref` é populada uma vez por `npm run load-municipios` (não faz
  parte das migrações porque é dado, não schema). **Um arquivo `.sql` novo em
  `supabase/migrations/` só existe no schema real depois de efetivamente
  rodado** — não há CI nem hook que aplique migrações automaticamente ao
  commitar ou dar deploy. Depois de criar uma migração (ou ao suspeitar que
  uma não foi aplicada), confirme direto no banco antes de assumir que está
  tudo certo.
