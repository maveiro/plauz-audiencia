# Plano de Desenvolvimento — por Fase

Cada fase deve ser concluída e validada isoladamente antes de avançar para a
próxima. Marque o checklist conforme for concluindo.

> **Nota de status:** o código de todas as fases (0 a 9) está implementado no
> repositório, além da migration de schema da Fase 10 (a integração com a
> Meta em si depende de credenciais que só você pode gerar — ver Fase 10).
> Os checkboxes abaixo continuam desmarcados de propósito — cada um
> representa uma validação contra o ambiente real (Supabase, Google Sheets,
> Vercel, e agora também Meta Business Manager) que só você pode confirmar
> rodando o sistema. Ver "Status do projeto" no README.md para o que falta de
> ação sua (variáveis de ambiente, aplicar as migrações 0002–0004, popular
> `municipios_ref`, criar o bucket, compartilhar planilhas com a service
> account) antes de marcar cada item.

---

## Fase 0 — Fundação

- [ ] Repositório GitHub criado, projeto Next.js inicializado (TypeScript, App Router)
- [ ] Projeto Supabase criado, `supabase link` configurado localmente
- [ ] Bucket criado no Supabase Storage para uploads de arquivo (ex: `uploads-fontes`)
- [ ] Projeto Google Cloud criado, Google Sheets API habilitada
- [ ] Service account criada, chave JSON gerada
- [ ] Projeto conectado à Vercel (deploy automático a partir do `main`)
- [ ] `.env.example` criado com todas as variáveis (sem valores reais)

**Critério de conclusão:** `npm run dev` sobe uma página em branco sem erros,
e `supabase db push` roda sem falhar (mesmo que sem migrações ainda).

---

## Fase 1 — Schema do banco

- [ ] Migração inicial aplicada a partir de `supabase/migrations/0001_init.sql`
      (artistas, eventos, sources, raw_responses, field_mappings,
      municipios_ref, interessados, sync_logs, views `sources_ativas` e
      `interessados_ativos`)
- [ ] Extensões `pgcrypto` e `pg_trgm` habilitadas (já incluídas na migração)
- [ ] Popular `municipios_ref` com a lista de municípios do IBGE (script
      único, rodado uma vez — fonte: dados públicos do IBGE)
- [ ] RLS confirmado ativo em todas as tabelas
- [ ] Tipos TypeScript gerados a partir do schema:
      `supabase gen types typescript --local > lib/database.types.ts`

**Critério de conclusão:** todas as tabelas e views existem no Supabase,
`municipios_ref` tem os ~5.570 municípios carregados, e o arquivo de tipos
gerado reflete exatamente esse schema.

---

## Fase 2 — Conectores de dados (Sheets + upload)

- [ ] Interface comum `SourceReader` com método `getRows(): Promise<RawRow[]>`
- [ ] `GoogleSheetsReader`: autentica com a service account, lê uma planilha
      (`sheet_id` + `tab_name` opcional) e retorna as linhas
- [ ] `FileUploadReader`: lê um arquivo do Supabase Storage (`arquivo_path`),
      identifica o formato (CSV via `papaparse`, XLS/XLSX via `xlsx`/SheetJS)
      e retorna as linhas no mesmo formato do `GoogleSheetsReader`
- [ ] Rota de upload: recebe o arquivo, salva no Storage, cria/atualiza a
      `source` correspondente (`arquivo_path`, `arquivo_nome_original`,
      `arquivo_enviado_em`)
- [ ] Testado isoladamente contra uma planilha real e contra um arquivo real,
      **sem** ainda estar plugado ao motor de sincronização

**Critério de conclusão:** os dois leitores retornam dados no mesmo formato,
a partir de uma fonte real de cada tipo, incluindo o caso de células vazias.

---

## Fase 3 — Motor de sincronização

- [ ] Função `syncSource(sourceId)`, agnóstica ao tipo de fonte (usa
      `SourceReader` correspondente por trás):
  1. Busca a fonte, seu evento e artista
  2. Obtém as linhas via o `SourceReader` adequado
  3. Para cada linha: calcula `row_hash` (chaves ordenadas
     alfabeticamente antes de serializar), faz upsert em `raw_responses`
     (ignora se hash já existe para essa fonte)
  4. Aplica `field_mappings` da fonte sobre cada linha nova, gerando o
     registro canônico (incluindo `artista_id`, herdado do evento)
  5. Aplica validação leve de e-mail/telefone (marca `_valido`, não descarta)
  6. **Aplica normalização geográfica automaticamente**: compara
     `cidade_informada`/`estado_informada` contra `municipios_ref` via
     `pg_trgm`; se a similaridade for alta, preenche `cidade_normalizada`/
     `estado_normalizado` e marca `local_revisao_pendente = false`; caso
     contrário, deixa `local_revisao_pendente = true`
  7. Insere em `interessados`
  8. Grava resultado (sucesso/erro, contagem) em `sync_logs`
- [ ] Dicionário de transforms (`lib/transforms/`): `trim`, `only_digits`,
      `trim_lowercase`, `trim_uppercase`, `split_cidade_estado` (e outros que
      surgirem ao mapear as fontes reais)
- [ ] Rota de API `POST /api/sync/[sourceId]` chamando `syncSource`
      (usada tanto pelo botão manual quanto pelo Cron)
- [ ] Testado rodando duas vezes seguidas contra a mesma fonte — segunda
      execução não deve inserir duplicatas

**Critério de conclusão:** consigo cadastrar uma fonte de cada tipo (Sheets e
upload), chamar a rota de sync, e ver os dados aparecerem corretamente em
`interessados`, já com `artista_id`, validações e normalização geográfica
preenchidas, e `sync_logs` registrando o resultado.

---

## Fase 4 — Interface

- [ ] Página para cadastrar artista e evento
- [ ] Página para cadastrar uma fonte: escolher tipo (Sheets ou upload),
      evento, e conforme o tipo — link da planilha (extraindo `sheet_id`
      automaticamente da URL) ou upload de arquivo
- [ ] Página de listagem de fontes (via view `sources_ativas`): nome, evento,
      artista, tipo, status, última sincronização, botão "sincronizar agora"
      (Sheets) ou "reenviar arquivo" (upload)
- [ ] Página para reenviar um arquivo em uma fonte existente (substitui o
      arquivo anterior, roda o sync sobre a fonte)
- [ ] Ação de excluir fonte (soft delete: marca `deleted_at`)
- [ ] Página/histórico de uploads excluídos, com opção de restaurar
      (`deleted_at = null`) dentro da janela de retenção
- [ ] Página para definir `field_mappings` de uma fonte recém-cadastrada,
      mostrando as colunas encontradas para o usuário mapear aos campos
      canônicos. Quando a fonte ainda não tem nada salvo, o formulário vem
      pré-preenchido com o mapeamento mais comum usado em outras fontes com
      as mesmas colunas (`lib/fieldMappings/suggestMappings.ts`) — sempre
      revisável, nunca aplicado sem confirmação
- [ ] Página simples listando `interessados_ativos` com `local_revisao_pendente
      = true`, para revisão manual de cidade/estado ambíguos

**Critério de conclusão:** consigo cadastrar, sincronizar, excluir e
restaurar uma fonte (de qualquer tipo) do início ao fim pela interface, sem
tocar em SQL.

---

## Fase 5 — Automação

> Decisão operacional: `vercel.json` não está no repo por padrão porque o
> plano Hobby só permite cron 1x/dia. A rota existe e funciona
> (`/api/cron/sync`); sincronização de Sheets é manual por enquanto. Ver
> README.md, seção "Automação", para reativar.

- [ ] Configurar Vercel Cron (`vercel.json`) chamando uma rota que sincroniza
      todas as fontes ativas do tipo `google_sheets` (uploads não entram no
      Cron — são reprocessados apenas quando reenviados)
- [ ] Rota protegida por `CRON_SECRET`
- [ ] Tratamento de erro: se uma fonte falhar, as demais continuam; erro fica
      registrado em `sync_logs`

**Critério de conclusão:** sem nenhuma ação manual, as fontes do tipo
Google Sheets sincronizam sozinhas no intervalo configurado.

---

## Fase 6 — Normalização avançada e análise (sob demanda)

- [ ] Revisar registros com `local_revisao_pendente = true` em lote — ajustar
      `municipios_ref` ou o limiar de similaridade conforme os erros reais
      encontrados
- [ ] View `publico_sobreposto`: agrupa `interessados_ativos` por `email`,
      conta `artista_id` distintos, filtra quem aparece em mais de um —
      responde diretamente "há sobreposição de público entre artistas?"
- [ ] (Opcional, futuro) Verificação de deliverability de e-mail via serviço
      externo, rodada sob demanda
- [ ] Views adicionais de análise: interessados por evento/artista, taxa de
      validade de contato, etc. — implementado como dashboard dedicado
      (`/dashboard`, views `dash_*` em `0005_dashboard_views.sql`, com
      ajustes em `0007`–`0010` incluindo filtro por fonte e por cidade via
      dropdown, além do já existente por clique no gráfico). Ver
      ARCHITECTURE.md, seção "Dashboard". Checkbox segue desmarcado por
      convenção deste arquivo (nota de status no topo) até validação contra
      o ambiente real.
- [ ] Job de limpeza definitiva: hard delete de fontes com `deleted_at`
      preenchido há mais de N dias (aciona o cascade e remove o arquivo do
      Storage) — rodado manualmente ou agendado, conforme preferência

Esta fase não tem "conclusão" — é contínua, conforme a necessidade de análise
for aparecendo.

---

## Fase 7 — Observabilidade

- [ ] Página simples mostrando `sync_logs` recentes (sucesso/erro por fonte)
- [ ] (Opcional) Alerta por e-mail quando uma sincronização falha

---

## Fase 8 — Autenticação (fora do escopo original — motivada por auditoria de segurança)

> A aplicação chegou a rodar em produção sem nenhuma autenticação (só
> `/api/cron/sync` tinha proteção própria via `CRON_SECRET`), expondo
> nome/e-mail/telefone real de interessados pra qualquer um com a URL. Esta
> fase fecha isso — ver ARCHITECTURE.md, seção "Autenticação", pro desenho
> completo.

- [ ] `middleware.ts` + `lib/supabase/middleware.ts` protegendo toda rota por
      padrão, exceto `/login`, `/auth/callback`, `/acesso-negado` e
      `/api/cron/sync`
- [ ] Login via Google OAuth (Supabase Auth), restrito a `ALLOWED_EMAIL_DOMAIN`
      — checagem principal em `app/auth/callback/route.ts` (desloga e
      redireciona pra `/acesso-negado` se o domínio não bater), repetida no
      middleware como defesa em profundidade
- [ ] Três clients Supabase separados por contexto (`server.ts` service role,
      `serverClient.ts` ciente de sessão, `client.ts` browser) — nunca
      misturar
- [ ] Google Cloud Console (Google Auth Platform: Audience/Branding/Clients)
      e Supabase Auth (provider Google + Redirect URLs) configurados

**Critério de conclusão:** acessar qualquer rota sem sessão redireciona pra
`/login`; login com conta do domínio autorizado funciona e aparece em
`auth.users`; conta de fora do domínio cai em `/acesso-negado` sem deixar
sessão válida; `/api/cron/sync` continua respondendo por `CRON_SECRET`, sem
redirecionar. Checkbox segue desmarcado por convenção deste arquivo (nota de
status no topo) até validação contra o ambiente real.

---

## Fase 9 — Formulários nativos de captação

> Motivação: captação hoje depende do Google Forms, que roda no domínio do
> Google — impossível instalar tracking de conversão (ver Fase 10) e sem
> controle de marca/experiência. Formulário nativo convive com Google
> Sheets (não o substitui) — ver CLAUDE.md, seção "Camada adicional:
> formulários nativos e tracking de campanha", pro desenho completo.

- [ ] Migração `0011_formularios_nativos.sql` aplicada (terceiro
      `sources.tipo = 'formulario_nativo'`, tabelas `formularios` e
      `formulario_perguntas`)
- [ ] `lib/sync/submitFormResponse.ts` — ingestão em tempo real, reusando
      `lib/sync/buildInteressadoRow.ts` (extraído de `syncSource.ts`)
- [ ] Rotas públicas `/f/[slug]` (page) e `/api/f/[slug]/submit` (POST),
      isentas do gate de autenticação (`EXEMPT_PATHS` em
      `lib/supabase/middleware.ts`) — únicas rotas do produto abertas a
      qualquer visitante sem sessão
- [ ] Terceira aba "Formulário nativo" em `/fontes/nova`
      (`NovaFonteFormularioForm.tsx`), tela de edição em
      `/fontes/[sourceId]/formulario` (status rascunho/publicado/pausado,
      perguntas extras, texto de consentimento)
- [ ] Validação server-side estrita da submissão (chaves conhecidas,
      obrigatoriedade, opções válidas) + honeypot + tempo mínimo de
      preenchimento como anti-spam

**Critério de conclusão:** um evento real roda 100% num formulário nativo —
criado, publicado, preenchido em navegador anônimo (sem sessão) — com dados
chegando em `interessados` no mesmo formato que uma linha vinda de Sheets
teria, visíveis no dashboard sem nenhuma mudança nele. Validado contra o
Supabase de produção nesta sessão (dado de teste criado e removido em
seguida); checkbox segue desmarcado por convenção deste arquivo até você
confirmar rodando o sistema você mesmo.

---

## Fase 10 — Pixel de conversão da Meta + Conversions API

> Depende da Fase 9. Sem esta fase, campanhas de Meta Ads apontando pro
> formulário nativo não têm nenhum evento de conversão voltando ao Ads
> Manager. Ver CLAUDE.md, seção "Camada adicional: formulários nativos e
> tracking de campanha".

- [ ] Migração `0012_meta_tracking.sql` aplicada (`formularios.meta_pixel_id`,
      colunas UTM/`fbclid` em `interessados`, tabela `meta_capi_logs`)
- [ ] `lib/meta/conversionsApi.ts` — chamada server-side best-effort à
      Conversions API, disparada via `after()` na rota de submit, nunca
      bloqueia nem derruba a resposta ao usuário
- [ ] Pixel client-side (`fbq init` + `PageView` + `Lead` com `eventID`)
      carregado em `/f/[slug]` quando `meta_pixel_id` está configurado
- [ ] Campo de Pixel ID na tela de edição do formulário
      (`/fontes/[sourceId]/formulario`)
- [ ] **Pré-requisito operacional, fora do código — só você pode fazer:**
      gerar `META_CONVERSIONS_API_ACCESS_TOKEN` no Events Manager do
      Business Manager da Meta (Configurações > Conversions API), verificar
      o domínio do app no Business Manager, e opcionalmente configurar
      `META_PIXEL_TEST_EVENT_CODE` pra QA sem sujar dado de produção

**Critério de conclusão:** com um Pixel configurado num formulário de teste
e `META_PIXEL_TEST_EVENT_CODE` preenchido, o evento "Lead" aparece no
Events Manager tanto via Pixel quanto via Conversions API, com o mesmo
`event_id`, deduplicados (um evento no relatório, não dois) — validação que
só você pode fazer, por depender de acesso ao Business Manager da Meta.
