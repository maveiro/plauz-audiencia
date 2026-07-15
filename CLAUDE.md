# CLAUDE.md — Instruções do Projeto

Este arquivo orienta qualquer agente (Claude Code) que trabalhar neste repositório.
Leia por completo antes de gerar código. As decisões aqui já foram tomadas — não
reabra debates de arquitetura sem justificativa forte; se algo parecer errado,
pergunte antes de mudar.

Ver também `AGENTS.md` (comandos, convenções, checklist antes de commitar —
formato universal, útil pra qualquer agente) e `ARCHITECTURE.md` (fluxo de
dados, camadas, schema, rotas de API e deploy).

## O que este projeto faz

Unifica respostas de múltiplos formulários (Google Sheets, upload manual de
CSV/XLS, e formulários nativos hospedados pelo próprio produto em `/f/{slug}`)
em um único banco de dados Supabase (Postgres). O usuário cadastra o link de
uma planilha, envia um arquivo, ou cria um formulário nativo, pela interface
web (Next.js na Vercel). Google Sheets sincroniza periodicamente; upload
substitui o dado no novo envio; formulário nativo recebe respostas em tempo
real — mantendo tudo atualizado, sem nunca escrever de volta no Google
Sheets. Formulário nativo também permite instalar um Pixel de conversão da
Meta (client-side + Conversions API server-side) para campanhas de tráfego
pago — ver seção "Camada adicional: formulários nativos e tracking de
campanha".

Domínio: captação de interessados em compra de ingresso para eventos. Cada
evento pertence a um **artista**. Cada evento tem uma ou mais **fontes**
(planilhas ou arquivos) de onde vêm os interessados. Isso permite, entre
outras coisas, analisar **sobreposição de público entre artistas** (mesma
pessoa interessada em mais de um).

Além do cadastro/sincronização, existe uma tela de **dashboard**
(`/dashboard`) para acompanhamento diário — volume, tendência, ranking de
eventos, geografia e qualidade de dado por fonte, filtrável por período,
artista, fonte e cidade. Ver seção "Camada adicional: dashboard" abaixo e
`ARCHITECTURE.md`.

## Stack

- **Frontend/API**: Next.js (App Router), deploy na Vercel
- **Banco**: Supabase (Postgres) — schema versionado via Supabase CLI migrations
- **Autenticação**: Supabase Auth (provider Google), restrita a um domínio de
  e-mail via `middleware.ts` — ver seção "Camada adicional: autenticação"
- **Armazenamento de arquivo**: Supabase Storage (para uploads de CSV/XLS)
- **Integração externa**: Google Sheets API v4, autenticado via **service account**
  (não usar OAuth de usuário — não precisamos escrever, só ler)
- **Parsing de arquivo**: `papaparse` (CSV) e `xlsx`/SheetJS (Excel)
- **Gráficos do dashboard**: Recharts (Client Components — a busca de dados
  em si continua Server Component)
- **Agendamento**: Vercel Cron chamando uma rota de API interna (apenas para
  fontes do tipo `google_sheets` — uploads não têm agendamento, são reenviados
  manualmente). A rota (`/api/cron/sync`) existe e funciona independente de
  agendamento; o `vercel.json` que a agenda não está no repo por padrão
  porque o plano Hobby só permite cron 1x/dia — ver README.md, seção
  "Automação", para as opções de reativar.
- **Linguagem**: TypeScript em todo o projeto (frontend, API routes, scripts)

## Arquitetura de dados (não mudar sem revisão)

```
Google Sheets (fonte, pull)      ─┐
Upload CSV/XLS (fonte, pull)      ├─→ raw_responses (dado bruto, JSONB, imutável)
Formulário nativo (fonte, push)  ─┘        → field_mappings (config: como traduzir cada fonte)
                                            → interessados (tabela canônica, unificada)
                                                 → normalização geográfica (automática, pós-sync)
```

Google Sheets e Upload são fontes "pull": o motor de sync busca as linhas sob
demanda (`SourceReader.getRows()`). Formulário nativo é "push": cada resposta
chega em tempo real via `lib/sync/submitFormResponse.ts`, que reusa a mesma
tradução/validação/normalização (`lib/sync/buildInteressadoRow.ts`) só que
para uma linha por vez, em vez do loop em lote de `syncSource.ts`. Ver
princípio 4 e "Camada adicional: formulários nativos e tracking de
campanha".

Ver `docs/PLANO.md` para o detalhamento de fases e
`supabase/migrations/0001_init.sql` para o schema completo e comentado.

### Princípios inegociáveis

1. **Nunca descartar o dado bruto.** `raw_responses.raw_data` guarda a linha
   inteira, como veio da fonte, sempre. A tabela canônica é derivada, nunca é
   a única cópia do dado.
2. **Idempotência sempre.** Toda sincronização (Sheets) ou reprocessamento
   (upload) precisa poder rodar de novo sem duplicar registros. Deduplicação
   de linha bruta é por hash de conteúdo (`row_hash`), único por `source_id`.
   **Regra de cálculo do hash:** serializar a linha com as chaves em ordem
   alfabética antes de gerar o hash — isso garante que reordenar colunas na
   fonte não gere um falso "registro novo". **Limitação conhecida:** se uma
   resposta for editada na planilha original (não apenas uma linha nova
   adicionada), o hash muda e ela entra como um registro novo, não como
   atualização do registro anterior. Isso é aceito como comportamento
   esperado, não é um bug a corrigir agora.
3. **Adicionar fonte é configuração, não código.** Uma nova planilha ou
   upload nunca deve exigir alterar uma função de sincronização. Exige: uma
   linha em `sources` e linhas em `field_mappings`. Se você (agente) perceber
   que está prestes a escrever `if (source.id === 'x') { ... }` em lógica de
   sync/normalização, pare — isso é sinal de que falta uma entrada em
   `field_mappings`, não de que falta um `if`. Pra reduzir o trabalho manual
   dessa configuração (não pra pular o princípio): uma fonte nova sem
   mapeamento salvo tem o formulário de `field_mappings` pré-preenchido por
   `lib/fieldMappings/suggestMappings.ts`, olhando o mapeamento mais comum já
   usado em outras fontes com as mesmas colunas de origem (ex: mesmo template
   de formulário reaplicado a cada evento). É só uma sugestão de UI — nunca
   aplica nada sozinho, nunca sobrescreve mapeamento já salvo, e o usuário
   ainda confirma explicitamente antes de salvar. Formulário nativo é a
   exceção deliberada: como é a própria Plauz quem define o nome de cada
   campo (não uma planilha externa imprevisível), o `field_mappings` padrão
   é gerado automaticamente na criação (`lib/formularios/camposPadrao.ts`),
   sem pedir confirmação — não há ambiguidade a resolver.
4. **Três fontes de linhas, uma única lógica de tradução/validação/geo.**
   Google Sheets e arquivo upload são fontes "pull": o motor de sync
   (`lib/sync/syncSource.ts`) não sabe qual das duas é — consome uma
   interface comum (`getRows(): Promise<RawRow[]>`), implementada por dois
   "leitores" (`GoogleSheetsReader`, `FileUploadReader`,
   `lib/readers/getReaderForSource.ts`). Formulário nativo é fonte "push"
   (resposta chega em tempo real, uma linha por vez) — não implementa
   `SourceReader` (chamar `getReaderForSource` para essa fonte lança erro de
   propósito), e sim entra por `lib/sync/submitFormResponse.ts`. Os dois
   caminhos convergem na mesma função de tradução (`mapRowToCanonical` +
   validação leve + normalização geográfica, extraída em
   `lib/sync/buildInteressadoRow.ts`) — nunca duplicar essa lógica por tipo
   de fonte, só o "como as linhas chegam" (lote vs. tempo real) é diferente.
5. **Validação leve não descarta dado.** E-mail e telefone inválidos são
   marcados (`email_valido`, `telefone_valido` = false), o registro entra
   normalmente. Nunca rejeitar/pular uma linha por validação.
6. **Correção geográfica também não descarta e também não sobrescreve o
   original.** O valor digitado pela pessoa (`cidade_informada`,
   `estado_informada`) nunca é alterado. A correção vive em colunas separadas
   (`cidade_normalizada`, `estado_normalizado`), com um `local_confianca`
   (0 a 1) e uma flag `local_revisao_pendente` para os casos ambíguos que
   precisam de revisão manual. Este passo roda **automaticamente**, como
   parte do motor de sincronização, logo após a validação leve de
   e-mail/telefone — não é uma fase separada nem um botão manual.
7. **Telefone é armazenado só com dígitos.** Sem formatação, sem máscara, no
   banco. Formatar apenas na exibição (frontend).
8. **Segredos nunca no client.** Chave de service account do Google e a
   `SUPABASE_SERVICE_ROLE_KEY` só podem ser usadas em código server-side (API
   routes / server actions), nunca expostas ao bundle do client.
9. **Migrações são a única forma de alterar schema.** Nunca alterar tabelas
   direto no dashboard do Supabase em produção. Toda mudança de schema é um
   novo arquivo em `supabase/migrations/`.
10. **Exclusão é soft delete por padrão.** Excluir uma fonte (upload ou
    planilha) marca `deleted_at = now()`, não apaga a linha. A limpeza física
    definitiva (hard delete, que aciona o `on delete cascade` e remove
    `raw_responses`/`interessados`/`sync_logs` relacionados, além do arquivo
    no Storage) é uma ação separada e deliberada — nunca automática no fluxo
    normal de uso.
11. **A aplicação nunca consulta as tabelas cruas para exibir dados ativos.**
    Sempre usar as views `sources_ativas` e `interessados_ativos` (que já
    filtram `deleted_at is null`). Isso evita o erro recorrente de soft
    delete: esquecer o filtro em uma query e um dado "excluído" reaparecer na
    interface.

### Camada adicional: dashboard

`/dashboard` é só leitura — nunca escreve em `interessados` nem em nenhuma
tabela canônica. Consulta views dedicadas (`dash_interessados_diarios`,
`dash_qualidade_por_fonte`, `dash_geografia`, `dash_cidades_disponiveis` —
`0005_dashboard_views.sql` e os ajustes incrementais em `0007`–`0010`), cada
uma no grão que permite filtrar por período/artista/fonte/cidade via
PostgREST depois, sem precisar de uma view por combinação de filtro. O
filtro de cidade é o mesmo param de URL (`cidade`/`estado`) tanto pelo
dropdown quanto pelo clique numa barra do gráfico de geografia — os dois
caminhos escrevem o mesmo estado, nunca duplicar essa lógica. Se for
adicionar um novo corte de análise (ex: por faixa etária, por canal),
prefira estender uma view existente ou criar uma nova no mesmo padrão —
nunca agregar em SQL ad-hoc espalhado pelas páginas. Ver `ARCHITECTURE.md`,
seção "Dashboard", para o desenho completo, e o skill `dataviz` antes de
mexer em cor ou adicionar um gráfico novo (a paleta já validada vive em
`app/globals.css`).

### Camada adicional: revisão de local assistida por IA

Além do passo determinístico do princípio 6 (que roda automaticamente no
sync), existe uma segunda camada, opcional e disparada manualmente pelo
botão "Resolver com IA" na tela `/fontes/revisao` (`lib/geo/aiResolveGeografia.ts`):
trata com IA (Claude) os casos que o passo determinístico deixou pendentes
(apelidos, abreviações, erros de digitação — ex: "Beaga" → Belo
Horizonte/MG), aplicando automaticamente só quando a IA reporta confiança
alta **e** a sugestão bate com um município real em `municipios_ref` (mesma
validação de similaridade do passo determinístico — evita a IA "alucinar"
uma cidade inexistente). Casos ambíguos (ex: várias cidades listadas)
continuam pendentes para revisão humana, mas a sugestão da IA pré-preenche o
formulário. **Toda sugestão da IA é logada em `geo_ia_logs`, aplicada ou
não** — nunca só as aplicadas. Essa camada é deliberadamente separada do
motor de sync (não roda automaticamente a cada sincronização) para não
acoplar uma dependência externa e custo variável ao caminho crítico do sync.

### Camada adicional: autenticação

Toda rota é protegida por padrão via `middleware.ts` +
`lib/supabase/middleware.ts`, exceto `/login`, `/auth/callback`,
`/acesso-negado` e `/api/cron/sync` (que mantém sua própria autenticação por
`CRON_SECRET` — chamada direta do Vercel Cron, sem sessão de browser). Login é
Google OAuth via Supabase Auth, restrito ao domínio em `ALLOWED_EMAIL_DOMAIN`
(padrão `plauz.com.br`, falha fechado se a env var estiver vazia): a
checagem de domínio principal acontece em `app/auth/callback/route.ts` logo
após trocar o code por sessão (desloga e redireciona para `/acesso-negado`
se o e-mail não bater — nunca deixa cookie de sessão válido para fora do
domínio); o middleware repete a mesma checagem como defesa em profundidade,
não como controle principal.

Três clients Supabase distintos, cada um só no seu contexto — não misturar:

- **`lib/supabase/server.ts`** (`createServiceRoleClient`) — service role,
  ignora RLS, usado por todo o motor de sync e pelas queries de
  dado/dashboard. Nunca ganha consciência de sessão de usuário.
- **`lib/supabase/serverClient.ts`** — ciente do cookie de auth, para Server
  Components/Route Handlers/Server Actions do fluxo de login
  (`app/layout.tsx`, `app/login/`, `app/auth/callback/`,
  `lib/auth/actions.ts`). Fala só com a API de Auth, nunca com tabela de
  negócio.
- **`lib/supabase/client.ts`** — client de browser, usado só pelo botão
  "Entrar com Google". A anon key exposta via `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  é segura por design: RLS habilitado sem nenhuma policy (princípio 8 segue
  valendo), então o client não enxerga tabela nenhuma, só a API de Auth.

### Camada adicional: formulários nativos e tracking de campanha

Formulário nativo é um terceiro `sources.tipo` (`formulario_nativo`),
configurado em `formularios` + `formulario_perguntas`
(`supabase/migrations/0011_formularios_nativos.sql`), hospedado em
`/f/{slug}` (página pública) com submissão via `POST /api/f/{slug}/submit`.
Essas duas rotas são a **primeira superfície pública** do produto — isentas
do gate de autenticação em `lib/supabase/middleware.ts`
(`EXEMPT_PATHS`) porque recebem submissão de qualquer visitante da
internet, sem sessão. Tudo mais continua atrás de login.

- **Ciclo de vida**: `formularios.status` é `rascunho` (só visível a
  usuário autenticado, via `/f/{slug}` mesmo — sem rota de preview
  separada), `publicado` (aberto ao público) ou `pausado` (página
  "captação encerrada", nunca 404 — evita quebrar link de campanha
  antiga). Fonte soft-deletada (`sources.deleted_at`) sempre vira 404,
  em qualquer status.
- **Campos padrão fixos**: nome, e-mail, telefone, cidade/estado sempre
  existem no formulário público, não são configuráveis — só perguntas
  extras (`formulario_perguntas`, tipos `texto_curto`/`texto_longo`/
  `multipla_escolha`/`caixa_selecao`) são. Builder deliberadamente enxuto,
  não uma réplica do Google Forms.
- **Perguntas pós-publicação**: `tipo`/`opcoes`/`chave` de uma pergunta
  existente nunca mudam depois de criada — só `rotulo`/`obrigatorio`/`ativo`
  (desativar em vez de apagar, preserva a leitura de respostas antigas em
  `interessados.extra`, chaveadas por `chave`).
  `lib/formularios/camposPadrao.ts` também é o dicionário de textos padrão
  (consentimento LGPD, confirmação de envio).
- **Validação server-side estrita** (`lib/formularios/validarResposta.ts`):
  a rota de submit nunca confia no client — só aceita chaves conhecidas do
  formulário publicado, impõe obrigatoriedade, valida opções de múltipla
  escolha/caixa de seleção contra o cadastrado, limita tamanho de texto.
- **Anti-spam sem infra nova**: honeypot (campo invisível) + tempo mínimo
  entre carregar a página e enviar — rejeição silenciosa (resposta de
  sucesso falsa pro bot, nunca grava nada). CAPTCHA fica para quando/se
  houver spam real observado.
- **Meta Pixel + Conversions API** (`lib/meta/conversionsApi.ts`,
  `supabase/migrations/0012_meta_tracking.sql`): opcional por formulário
  (`formularios.meta_pixel_id`, não é segredo — todo Pixel já é exposto no
  HTML de qualquer site). No sucesso do submit, o client dispara
  `fbq('track','Lead', ..., {eventID})` **e** a rota de submit dispara
  (via `after()`, sem bloquear a resposta ao usuário) uma chamada
  server-side à Conversions API com o **mesmo** `event_id` — é essa
  correlação que permite ao Meta deduplicar o mesmo evento reportado duas
  vezes. Token de acesso é `META_CONVERSIONS_API_ACCESS_TOKEN` (env var,
  server-only, uma única conta de anúncios centralizada da Plauz — nunca
  no banco). **Toda chamada é logada em `meta_capi_logs`, sucesso ou
  erro** (mesmo espírito de `geo_ia_logs`) — falha na Meta nunca derruba a
  submissão do lead, que já foi salva antes dessa chamada.
- **UTM/`fbclid`**: capturados da query string da página pública no
  carregamento, entram no `row_hash` (reenvio da mesma origem é dedup
  legítimo) e viram colunas dedicadas em `interessados`
  (`utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`fbclid`) — não
  ficam em `extra`, são dimensão de análise de primeira classe (mesma
  lógica de "estender view, nunca SQL ad-hoc" do dashboard).

### Componentes de UI compartilhados

`app/_components/` (prefixo `_` exclui a pasta do roteamento do App Router)
reúne os poucos primitivos usados em mais de uma tela — reaproveitar em vez
de recriar:

- **`ToastProvider.tsx`** (`useToast()`) — feedback de ação assíncrona
  (sucesso/erro). Toda ação disparada por botão (sincronizar, salvar,
  excluir, confirmar) usa isso, não estado local de mensagem solta na tela.
- **`StatusPill.tsx`** — status de fonte (`active`/`paused`/`error`) sempre
  com ícone além de cor, nunca só cor (acessibilidade — daltonismo).
- **`Skeleton.tsx`** — bloco de carregamento usado pelos `loading.tsx` de
  cada rota. Toda página com busca não-trivial no Supabase tem um
  `loading.tsx` — o App Router não dá nenhum feedback de carregamento sem
  isso, e a maioria das páginas deste projeto é um Server Component
  `force-dynamic` que só renderiza depois de todas as queries resolverem.
- **`NavLinks.tsx`** — links do header com estado ativo (via `usePathname`).
  É Client Component só por causa disso; a lista de rotas vive só aqui.

## Convenções de nomenclatura

- Nomes de tabelas e colunas em `snake_case`, em português, refletindo o
  domínio real (`interessados`, `nome_completo`, `telefone_valido`) — não
  traduzir para inglês genérico (`leads`, `is_valid`).
- Nomes de funções, variáveis e arquivos TypeScript em inglês, padrão da
  comunidade (`syncSource`, `normalizeRow.ts`).
- `transform` em `field_mappings` é uma string que referencia uma função
  registrada em um dicionário de transforms no código (ex: `only_digits`,
  `trim_lowercase`, `split_cidade_estado`). Adicionar um novo transform =
  adicionar uma função a esse dicionário, nunca lógica condicional espalhada.
- No `field_mappings`, o `canonical_field` continua usando os nomes
  intuitivos `cidade` e `estado` (é o que faz sentido ao configurar o
  mapeamento). O código sabe que isso escreve, na prática, em
  `cidade_informada`/`estado_informada` — esse "de-para" é uma decisão de
  implementação, documentada aqui para não gerar confusão.

## O que este projeto explicitamente NÃO faz (ainda)

- Não escreve de volta nas planilhas do Google.
- Não faz verificação de deliverability de e-mail nem validação de telefone
  via API externa — isso é validação "pesada", fica para uma fase de análise
  separada, sob demanda, fora da sincronização automática.
- Não deduplica pessoas entre eventos/artistas diferentes na tabela
  `interessados`. Uma pessoa que aparece em dois eventos gera dois registros,
  cada um rastreável à sua fonte/evento/artista. Isso é intencional — é o que
  permite a análise de sobreposição de público, que é feita via query/view
  (agrupando por `email` e contando `artista_id` distintos), não por uma
  entidade "pessoa" unificada no schema.

## Ambiente e variáveis

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=        # mesmo valor de SUPABASE_URL, exposto ao bundle do browser (login)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # mesmo valor de SUPABASE_ANON_KEY, exposto ao bundle do browser (login)
ALLOWED_EMAIL_DOMAIN=plauz.com.br  # domínio Google Workspace autorizado a logar
DATABASE_URL=                    # opcional; não usada pela app, só para psql/CLI direto no Postgres
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
SUPABASE_STORAGE_BUCKET=uploads-fontes  # bucket dos uploads de CSV/XLS
CRON_SECRET=                     # para validar chamadas do Vercel Cron
ANTHROPIC_API_KEY=               # server-side only; botão "Resolver com IA" em /fontes/revisao
META_CONVERSIONS_API_ACCESS_TOKEN=  # server-side only; envio do evento "Lead" da Conversions API (opcional, por formulário)
META_PIXEL_TEST_EVENT_CODE=      # opcional; código de teste do Events Manager, só para QA
```

O arquivo local é `.env.local` (nunca commitado — coberto por `.env*` no
`.gitignore`, com exceção do `.env.example`). O dashboard do Supabase pode
exibir também chaves no formato novo (`sb_publishable_...`/`sb_secret_...`)
e uma URL de JWKS — o código deste projeto não as usa (usa o par
`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` acima); não precisam ser
preenchidas.

Opcionalmente, também em `.env.local` (nunca em `.env.example` — não são
usados pela aplicação nem por nenhum script versionado, servem só para
automação ad-hoc via agente de IA/CLI quando `node`/`vercel` CLI/`psql` não
estão disponíveis no ambiente):
```
VERCEL_TOKEN=              # gerado em vercel.com/account/tokens
SUPABASE_ACCESS_TOKEN=     # gerado em supabase.com/dashboard/account/tokens (Management API)
```
Com esses dois e `curl`, dá pra ler/editar env vars do projeto na Vercel e
rodar SQL direto no Supabase sem precisar da senha do banco.

O usuário compartilha cada planilha do Google (somente leitura) com o e-mail
da service account. Isso é um passo manual, feito uma vez por planilha — a
aplicação não pode automatizar esse compartilhamento.

## Ordem de trabalho

Siga as fases descritas em `docs/PLANO.md`, em ordem. Não pule para a
interface antes do motor de sincronização estar testado isoladamente — cada
camada deve ser validável sem depender da seguinte.
