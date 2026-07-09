# CLAUDE.md — Instruções do Projeto

Este arquivo orienta qualquer agente (Claude Code) que trabalhar neste repositório.
Leia por completo antes de gerar código. As decisões aqui já foram tomadas — não
reabra debates de arquitetura sem justificativa forte; se algo parecer errado,
pergunte antes de mudar.

Ver também `AGENTS.md` (comandos, convenções, checklist antes de commitar —
formato universal, útil pra qualquer agente) e `ARCHITECTURE.md` (fluxo de
dados, camadas, schema, rotas de API e deploy).

## O que este projeto faz

Unifica respostas de múltiplos formulários (Google Sheets, e também upload
manual de CSV/XLS) em um único banco de dados Supabase (Postgres). O usuário
cadastra o link de uma planilha, ou envia um arquivo, pela interface web
(Next.js na Vercel), e o sistema sincroniza periodicamente (no caso de Google
Sheets) ou substitui o dado no novo upload (no caso de arquivo), mantendo tudo
atualizado — sem nunca escrever de volta no Google Sheets.

Domínio: captação de interessados em compra de ingresso para eventos. Cada
evento pertence a um **artista**. Cada evento tem uma ou mais **fontes**
(planilhas ou arquivos) de onde vêm os interessados. Isso permite, entre
outras coisas, analisar **sobreposição de público entre artistas** (mesma
pessoa interessada em mais de um).

## Stack

- **Frontend/API**: Next.js (App Router), deploy na Vercel
- **Banco**: Supabase (Postgres) — schema versionado via Supabase CLI migrations
- **Armazenamento de arquivo**: Supabase Storage (para uploads de CSV/XLS)
- **Integração externa**: Google Sheets API v4, autenticado via **service account**
  (não usar OAuth de usuário — não precisamos escrever, só ler)
- **Parsing de arquivo**: `papaparse` (CSV) e `xlsx`/SheetJS (Excel)
- **Agendamento**: Vercel Cron chamando uma rota de API interna (apenas para
  fontes do tipo `google_sheets` — uploads não têm agendamento, são reenviados
  manualmente). A rota (`/api/cron/sync`) existe e funciona independente de
  agendamento; o `vercel.json` que a agenda não está no repo por padrão
  porque o plano Hobby só permite cron 1x/dia — ver README.md, seção
  "Automação", para as opções de reativar.
- **Linguagem**: TypeScript em todo o projeto (frontend, API routes, scripts)

## Arquitetura de dados (não mudar sem revisão)

```
Google Sheets (fonte)  ─┐
                          ├─→ raw_responses (dado bruto, JSONB, imutável)
Upload CSV/XLS (fonte)  ─┘        → field_mappings (config: como traduzir cada fonte)
                                   → interessados (tabela canônica, unificada)
                                        → normalização geográfica (automática, pós-sync)
```

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
   `field_mappings`, não de que falta um `if`.
4. **Duas fontes de linhas, um único motor de sincronização.** O motor de
   sync não sabe se as linhas vieram do Google Sheets ou de um arquivo — ele
   consome uma interface comum (`getRows(): Promise<RawRow[]>`). Existem dois
   "leitores" (`GoogleSheetsReader`, `FileUploadReader`) que implementam essa
   interface. Nunca duplicar a lógica de hash/upsert/normalização por tipo de
   fonte.
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

### Camada adicional: revisão de local assistida por IA

Além do passo determinístico do princípio 6 (que roda automaticamente no
sync), existe uma segunda camada, opcional e disparada manualmente pelo
botão "Resolver com IA" na tela `/revisao` (`lib/geo/aiResolveGeografia.ts`):
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
- Não faz autenticação multiusuário (uso é pessoal).
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
SUPABASE_ANON_KEY=               # se necessário no client
DATABASE_URL=                    # opcional; não usada pela app, só para psql/CLI direto no Postgres
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
SUPABASE_STORAGE_BUCKET=uploads-fontes  # bucket dos uploads de CSV/XLS
CRON_SECRET=                     # para validar chamadas do Vercel Cron
ANTHROPIC_API_KEY=               # server-side only; botão "Resolver com IA" em /revisao
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
