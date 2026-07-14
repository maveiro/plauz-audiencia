# Unificador de Interessados — Sheets/Upload → Supabase

Sistema para consolidar respostas de múltiplos formulários (Google Sheets ou
arquivos CSV/XLS enviados manualmente) — captação de interessados em
ingressos de eventos, por artista — em um único banco de dados, com
sincronização automática, upload de arquivos e interface para cadastrar
novas fontes.

## Como funciona, em uma frase

Você cadastra o link de uma planilha do Google Forms, ou envia um arquivo
CSV/XLS, associando a um evento de um artista; o sistema lê as respostas,
traduz cada coluna para um formato padrão, corrige cidade/estado digitados
livremente, e mantém tudo atualizado em uma tabela única no Supabase — sem
nunca alterar a fonte original.

## Stack

- [Next.js](https://nextjs.org) — interface e API, hospedado na [Vercel](https://vercel.com)
- [Supabase](https://supabase.com) — banco de dados (Postgres), armazenamento de arquivos (Storage) e autenticação (Supabase Auth)
- Login — Google OAuth via Supabase Auth, restrito a um domínio de e-mail (`ALLOWED_EMAIL_DOMAIN`); toda rota exige sessão, exceto a de Cron
- Google Sheets API — leitura das planilhas, via service account (credencial separada da do login)
- `papaparse` / `xlsx` (SheetJS) — leitura de arquivos CSV/Excel enviados por upload
- Vercel Cron — sincronização automática periódica (apenas fontes do tipo Google Sheets; ver nota sobre o plano Hobby abaixo)
- [Recharts](https://recharts.org) — gráficos do dashboard (`/dashboard`)
- Anthropic (Claude) — opcional, só para o botão "Resolver com IA" em `/revisao`

## Setup local

### 1. Pré-requisitos
- Node.js 20+
- Conta no Supabase, Vercel e Google Cloud já criadas
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado

### 2. Clonar e instalar
```bash
git clone <repo>
cd <repo>
npm install
```

### 3. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha (ver `CLAUDE.md` para a
lista completa e o papel de cada variável). `DATABASE_URL` é opcional — só é
necessária se você for rodar SQL direto via `psql`/Supabase CLI; a aplicação
em si usa apenas `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`.

### 4. Banco de dados
```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```
Isso aplica as migrações em `supabase/migrations/` ao seu projeto Supabase
(schema inicial + correções de constraint + função de normalização
geográfica + view de sobreposição de público + views do dashboard +
log de auditoria da revisão de local assistida por IA).

Se `supabase login` (fluxo interativo via navegador) não estiver disponível
no seu ambiente, use a alternativa que já existe no projeto — aplica direto
via `DATABASE_URL` (preencha a senha real do banco no `.env.local` antes):
```bash
npm run apply-migrations
```
**Importante:** nenhuma das duas formas roda sozinha — se você adicionar uma
migração nova, alguém precisa efetivamente rodar `supabase db push` ou
`npm run apply-migrations` contra o banco de produção. Um arquivo `.sql`
commitado e nunca aplicado é a causa mais provável de erro genérico do tipo
"Algo deu errado" (Server Components) em produção nas páginas que dependem
dele.

Depois, popule `municipios_ref` (dados do IBGE, seed estático em
`scripts/data/municipios-ibge.json`):
```bash
npm run load-municipios
```

### 5. Storage
Crie um bucket no Supabase Storage (o nome deve bater com
`SUPABASE_STORAGE_BUCKET` no `.env.local`; padrão: `uploads-fontes`) para
receber os arquivos enviados por upload.

### 6. Service account do Google
1. No Google Cloud Console, crie um projeto (ou use um existente) e habilite a
   **Google Sheets API**.
2. Crie uma **service account** e gere uma chave JSON.
3. Preencha `GOOGLE_SERVICE_ACCOUNT_EMAIL` e
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` no `.env.local` a partir dessa chave.
4. Para cada planilha que for cadastrar, compartilhe-a (permissão de leitura)
   com o e-mail da service account — passo manual, feito uma vez por planilha.

**Colando a private key no dashboard da Vercel:** `.env.local` usa aspas
duplas ao redor do valor só como sintaxe do arquivo (o Next.js remove
automaticamente); a Vercel não faz esse unquoting — se você colar o mesmo
texto (com as aspas) direto lá, o parsing quebra com um erro de decodificação
(`DECODER routines::unsupported`, do Node/OpenSSL). `lib/google/sheetsClient.ts`
já tolera as duas formas (com ou sem aspas envolventes), mas se aparecer esse
erro depois de configurar credenciais novas na Vercel, é o primeiro lugar a
checar.

### 7. Login (Google OAuth via Supabase Auth)
Toda rota da aplicação exige login — restrito a um domínio de e-mail
(Google Workspace), configurado em duas partes:

1. **Google Cloud Console** → APIs & Services → **Google Auth Platform**
   (substituiu o antigo menu único "OAuth consent screen" — hoje é dividido
   em três abas: Branding, Audience, Clients).
   - Aba **Audience**: se o projeto do GCP pertencer à organização do seu
     Workspace, escolha **Internal** (só quem é do domínio consegue logar —
     o Google recusa o resto antes de chegar na aplicação). Só aparece
     **External** se o projeto não pertencer à organização; nesse caso a
     restrição de domínio fica só por conta da checagem em
     `app/auth/callback/route.ts`.
   - Aba **Clients** → **+ Create Client** → tipo **Web application**.
     **Authorized redirect URIs** é a URL do **Supabase**, não a da
     aplicação: `https://<seu-project-ref>.supabase.co/auth/v1/callback`.
     Copie o **Client ID** e o **Client Secret** gerados.
2. **Supabase Dashboard** → Authentication → Providers → **Google** → cole
   o Client ID/Secret do passo anterior. Depois, Authentication → URL
   Configuration → adicione `<sua-url>/auth/callback` (e
   `http://localhost:3000/auth/callback` pra testar local) na lista de
   Redirect URLs — o Supabase rejeita qualquer `redirectTo` fora dessa lista.
3. Preencha `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (mesmos valores de `SUPABASE_URL`/`SUPABASE_ANON_KEY`, só expostos ao
   bundle do browser) e `ALLOWED_EMAIL_DOMAIN` no `.env.local`.

**Se o login falhar com `Unable to exchange external code` (erro do
Supabase, não da aplicação):** o Google não permite mais ver/baixar um
Client Secret depois de criado — só é mostrado uma vez, na hora. Se houver
qualquer dúvida sobre o valor colado no Supabase, não dá pra "conferir se
bate"; a única forma confiável de corrigir é gerar um Client Secret novo
(Google Cloud → Clients → o client → **+ Add secret**, funciona em paralelo
ao antigo, sem downtime) e colar esse valor novo no Supabase. Confira também
se a lista de Redirect URLs do passo 2 não ficou vazia — outra causa comum
do mesmo erro.

### 8. Rodar localmente
```bash
npm run dev
```
Acessar `http://localhost:3000` deve redirecionar pra `/login` (salvo se já
existir uma sessão válida no navegador) — primeiro sinal de que o gate de
autenticação está funcionando.

## Documentação

- **`CLAUDE.md`** — princípios de arquitetura e regras que não devem ser
  quebradas sem justificativa (leitura obrigatória antes de gerar código).
- **`AGENTS.md`** — referência rápida (comandos, convenções, checklist antes
  de commitar), formato universal lido por qualquer agente de código.
- **`ARCHITECTURE.md`** — desenho técnico: fluxo de dados, camadas, schema,
  rotas de API, segurança e deploy.
- **`docs/PLANO.md`** — roadmap de desenvolvimento por fase.

## Estrutura do repositório

```
├── CLAUDE.md                     # instruções do projeto para o agente de IA
├── AGENTS.md                     # referência rápida (comandos, convenções)
├── ARCHITECTURE.md               # desenho técnico do sistema
├── middleware.ts                  # protege toda rota por padrão (auth) — ver ARCHITECTURE.md, seção "Autenticação"
├── docs/
│   └── PLANO.md                  # roadmap de desenvolvimento, por fase
├── supabase/
│   └── migrations/                # schema do banco, versionado
├── scripts/
│   ├── load-municipios.ts         # popula municipios_ref (IBGE), rodar uma vez
│   ├── hard-delete-expired.ts     # limpeza definitiva de fontes excluídas há muito tempo
│   └── data/municipios-ibge.json  # seed estático (dados públicos do IBGE)
├── app/                           # rotas Next.js (interface + API)
│   ├── _components/               # UI compartilhada entre rotas (toast, status pill, skeleton, nav)
│   ├── login/                     # tela de login (botão "Entrar com Google")
│   ├── auth/callback/             # troca o code do OAuth por sessão, valida domínio do e-mail
│   ├── acesso-negado/             # tela pra quem tenta logar fora do domínio autorizado
│   ├── artistas/                  # cadastro de artistas e eventos
│   ├── fontes/                    # cadastro, listagem, mapeamento e exclusão de fontes
│   ├── revisao/                   # revisão manual de cidade/estado ambíguos (com botão "Resolver com IA")
│   ├── publico-sobreposto/        # análise de sobreposição de público entre artistas
│   ├── sync-logs/                 # histórico de sincronizações
│   ├── dashboard/                 # acompanhamento diário — volume, tendência, ranking, geografia, qualidade
│   └── api/
│       ├── sync/[sourceId]/       # dispara o motor de sincronização
│       ├── sources/upload/        # cria fonte arquivo_upload (recebe o arquivo)
│       ├── sources/[sourceId]/upload/  # reenvia arquivo de uma fonte existente
│       └── cron/sync/             # chamada pelo Vercel Cron, protegida por CRON_SECRET
└── lib/
    ├── readers/                   # leitores de fonte (Google Sheets, upload de arquivo)
    ├── sync/                      # motor de sincronização (agnóstico ao tipo de fonte)
    ├── transforms/                # dicionário de transforms por campo
    ├── geo/                       # normalização geográfica (pg_trgm) + revisão assistida por IA
    ├── validation/                # validação leve de e-mail/telefone
    ├── google/                    # cliente autenticado do Google Sheets
    ├── storage/                   # upload para o Supabase Storage
    ├── auth/                      # server action de logout
    ├── supabase/                  # três clients Supabase: server.ts (service role), serverClient.ts (sessão), client.ts (browser)
    ├── fieldMappings/             # sugestão de mapeamento pra fonte nova, a partir de fontes já mapeadas
    └── dashboard/                 # busca + agregação server-side para /dashboard
```

## Conceitos-chave

- **Artista**: quem tem eventos com captação de interessados.
- **Evento**: uma edição/show específico de um artista.
- **Fonte (`source`)**: uma planilha do Google OU um arquivo (CSV/XLS)
  cadastrado, ligado a um evento. Planilhas sincronizam automaticamente;
  arquivos são atualizados por reenvio manual, substituindo a leitura
  anterior da mesma fonte.
- **Dado bruto (`raw_responses`)**: cada linha da fonte, como veio, sem
  tratamento. Nunca é apagado ou sobrescrito de forma destrutiva.
- **Mapeamento (`field_mappings`)**: configuração que diz como traduzir cada
  coluna de cada fonte para o formato padrão. Uma fonte nova sem mapeamento
  salvo vem com uma sugestão pré-preenchida (revisável, nunca aplicada
  sozinha) baseada em como outras fontes com as mesmas colunas já foram
  mapeadas — útil quando várias fontes reusam o mesmo template de
  formulário.
- **Interessados (`interessados`)**: a tabela final, unificada, com
  validação leve de e-mail/telefone e correção automática de cidade/estado.
- **Sobreposição de público**: como a mesma pessoa pode aparecer em
  interessados de mais de um artista, é possível analisar cruzamento de
  público via uma view dedicada (ver `docs/PLANO.md`, Fase 6).
- **Exclusão**: fontes excluídas usam soft delete (ficam ocultas, mas
  recuperáveis por um tempo) antes de uma limpeza definitiva.
- **Dashboard**: tela de acompanhamento diário (`/dashboard`) — volume,
  tendência, ranking de eventos, geografia e qualidade de dado por fonte,
  com alerta quando uma fonte para de sincronizar. Filtrável por período,
  artista, fonte e cidade. Só leitura.
- **Revisão de local assistida por IA**: no `/revisao`, além da confirmação
  manual, um botão "Resolver com IA" trata com Claude os casos que a
  normalização determinística deixou pendentes, sempre validando a sugestão
  contra a lista de municípios antes de aplicar, e registrando tudo em
  `geo_ia_logs` (aplicado ou não).
- **Login**: toda a aplicação exige sessão — Google OAuth via Supabase Auth,
  restrito a um domínio de e-mail (`ALLOWED_EMAIL_DOMAIN`). Única exceção é
  `/api/cron/sync`, que autentica por `CRON_SECRET`.

Mais detalhes de arquitetura e decisões de design estão em `CLAUDE.md`.

## Deploy na Vercel

> **Nomes diferentes, mesmo sistema** (evita confusão ao procurar o projeto):
> a pasta local e o `package.json` chamam isso de `plauz-importar`, o
> repositório no GitHub é `maveiro/plauz-audiencia`, e o projeto na Vercel
> (time `marcelos-projects-017e3fe7`) se chama `plauz-import`. Os três
> apontam pro mesmo deploy — o projeto Vercel `plauz-import` está conectado
> a esse mesmo repositório GitHub, deploy automático a cada push em `main`.

Configure as mesmas variáveis de `.env.local` (exceto `DATABASE_URL`, que não
é usada pela aplicação) em Project Settings → Environment Variables, na
Vercel. **Depois de adicionar ou editar uma env var lá, é preciso disparar um
redeploy** — deployments já publicados não pegam o valor novo sozinhos (ver
`ARCHITECTURE.md`, seção "Deploy").

## Automação (sincronização periódica)

A rota `GET /api/cron/sync` sincroniza todas as fontes ativas do tipo
`google_sheets` de uma vez, protegida por `CRON_SECRET` (a Vercel injeta o
header `Authorization: Bearer $CRON_SECRET` automaticamente em chamadas de
Cron Jobs quando essa env var está configurada). **Ativo**: `vercel.json`
agenda 1x/dia, `"0 9 * * *"` (09:00 UTC = 06:00 horário de Brasília, fixo —
o Brasil não usa horário de verão desde 2019). O plano Hobby da Vercel só
permite cron no máximo 1x/dia; se precisar de mais frequência:

- **Plano [Pro da Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing#hobby-plan):** mesma chave `crons` em `vercel.json`, com um `schedule` mais frequente (ex: `*/30 * * * *`).
- **Grátis e mais frequente, sem depender do plano da Vercel:** um serviço
  externo (ex: [cron-job.org](https://cron-job.org), GitHub Actions
  agendado) chamando `POST /api/cron/sync` com o header
  `Authorization: Bearer <CRON_SECRET>` no intervalo desejado — pode
  coexistir com o cron nativo da Vercel ou substituí-lo (remova a chave
  `crons` do `vercel.json` nesse caso).

## Manutenção

Limpeza definitiva de fontes excluídas há mais de N dias (hard delete —
aciona o cascade e remove o arquivo do Storage). Roda em modo dry-run por
padrão:
```bash
npm run hard-delete-expired -- --dias=30            # lista o que seria apagado
npm run hard-delete-expired -- --dias=30 --confirmar  # apaga de fato
```

## Status do projeto

Ambiente de produção (Vercel + Supabase) configurado e operacional: todas as
env vars preenchidas (Supabase, Google service account, `CRON_SECRET`,
Google OAuth + `ALLOWED_EMAIL_DOMAIN`), migrações aplicadas no banco (`0001`
a `0012` — schema inicial, dashboard, revisão por IA, filtros de
fonte/cidade do dashboard, formulários nativos e tracking de campanha Meta),
o cron de sincronização diária ativo (ver "Automação" acima), e login
obrigatório restrito a `plauz.com.br` (ver "Conceitos-chave" acima e
`ARCHITECTURE.md`, seção "Autenticação"). `ANTHROPIC_API_KEY` e
`META_CONVERSIONS_API_ACCESS_TOKEN` são variáveis opcionais — sem a
primeira, o botão "Resolver com IA" em `/revisao` falha ao ser clicado; sem
a segunda, formulários nativos continuam recebendo respostas normalmente,
só não disparam o evento "Lead" pra Conversions API da Meta mesmo que um
Pixel esteja configurado (fica registrado como erro em `meta_capi_logs`,
nunca bloqueia a submissão). Ver `docs/PLANO.md` para o detalhamento por
fase de desenvolvimento.

O que continua sendo trabalho manual **recorrente** (não é uma pendência de
setup, é o fluxo normal de uso): para cada planilha nova, compartilhar com a
service account e, na interface (`/fontes/[id]/mapeamento`), configurar o
`field_mappings` da fonte — sem isso o cron roda mas retorna erro
("não tem field_mappings configurados") para aquela fonte especificamente,
sem afetar as demais. Formulário nativo não tem esse passo manual — o
mapeamento é gerado automaticamente na criação.

Para instalar o Pixel de conversão da Meta num formulário: gere um token de
sistema no Events Manager do Business Manager da Meta (Configurações >
Conversions API > Gerar token de acesso), preencha
`META_CONVERSIONS_API_ACCESS_TOKEN` (Vercel + redeploy), e cole o ID do
Pixel na tela de edição do formulário (`/fontes/[id]/formulario`).
Opcionalmente, `META_PIXEL_TEST_EVENT_CODE` (aba "Testar eventos" do Events
Manager) evita misturar teste com dado de produção.
