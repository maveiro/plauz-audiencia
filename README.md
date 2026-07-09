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
- [Supabase](https://supabase.com) — banco de dados (Postgres) e armazenamento de arquivos (Storage)
- Google Sheets API — leitura das planilhas, via service account
- `papaparse` / `xlsx` (SheetJS) — leitura de arquivos CSV/Excel enviados por upload
- Vercel Cron — sincronização automática periódica (apenas fontes do tipo Google Sheets; ver nota sobre o plano Hobby abaixo)

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
lista completa e o papel de cada variável).

### 4. Banco de dados
```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```
Isso aplica as migrações em `supabase/migrations/` ao seu projeto Supabase
(schema inicial + correções de constraint + função de normalização
geográfica + view de sobreposição de público).

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

### 7. Rodar localmente
```bash
npm run dev
```

## Estrutura do repositório

```
├── CLAUDE.md                     # instruções do projeto para o agente de IA
├── docs/
│   └── PLANO.md                  # roadmap de desenvolvimento, por fase
├── supabase/
│   └── migrations/                # schema do banco, versionado
├── scripts/
│   ├── load-municipios.ts         # popula municipios_ref (IBGE), rodar uma vez
│   ├── hard-delete-expired.ts     # limpeza definitiva de fontes excluídas há muito tempo
│   └── data/municipios-ibge.json  # seed estático (dados públicos do IBGE)
├── app/                           # rotas Next.js (interface + API)
│   ├── artistas/                  # cadastro de artistas e eventos
│   ├── fontes/                    # cadastro, listagem, mapeamento e exclusão de fontes
│   ├── revisao/                   # revisão manual de cidade/estado ambíguos
│   ├── publico-sobreposto/        # análise de sobreposição de público entre artistas
│   ├── sync-logs/                 # histórico de sincronizações
│   └── api/
│       ├── sync/[sourceId]/       # dispara o motor de sincronização
│       ├── sources/upload/        # cria fonte arquivo_upload (recebe o arquivo)
│       ├── sources/[sourceId]/upload/  # reenvia arquivo de uma fonte existente
│       └── cron/sync/             # chamada pelo Vercel Cron, protegida por CRON_SECRET
└── lib/
    ├── readers/                   # leitores de fonte (Google Sheets, upload de arquivo)
    ├── sync/                      # motor de sincronização (agnóstico ao tipo de fonte)
    ├── transforms/                # dicionário de transforms por campo
    ├── geo/                       # normalização geográfica (pg_trgm)
    ├── validation/                # validação leve de e-mail/telefone
    ├── google/                    # cliente autenticado do Google Sheets
    ├── storage/                   # upload para o Supabase Storage
    └── supabase/                  # cliente server-side (service role)
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
  coluna de cada fonte para o formato padrão.
- **Interessados (`interessados`)**: a tabela final, unificada, com
  validação leve de e-mail/telefone e correção automática de cidade/estado.
- **Sobreposição de público**: como a mesma pessoa pode aparecer em
  interessados de mais de um artista, é possível analisar cruzamento de
  público via uma view dedicada (ver `docs/PLANO.md`, Fase 6).
- **Exclusão**: fontes excluídas usam soft delete (ficam ocultas, mas
  recuperáveis por um tempo) antes de uma limpeza definitiva.

Mais detalhes de arquitetura e decisões de design estão em `CLAUDE.md`.

## Automação (sincronização periódica)

A rota `POST /api/cron/sync` sincroniza todas as fontes ativas do tipo
`google_sheets` de uma vez, protegida por `CRON_SECRET` (header
`Authorization: Bearer <CRON_SECRET>`). Por padrão **não há agendamento
automático configurado** — o plano Hobby da Vercel só permite cron rodando
no máximo 1x/dia, então a decisão foi deixar a sincronização de planilhas
manual (botão "Sincronizar agora" em cada fonte) até haver necessidade real
de automação. Opções para reativar, dependendo da frequência desejada:

- **1x/dia, de graça (Hobby):** crie `vercel.json` na raiz com:
  ```json
  { "crons": [{ "path": "/api/cron/sync", "schedule": "0 6 * * *" }] }
  ```
- **Mais frequente:** requer plano [Pro da Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing#hobby-plan) — mesmo `vercel.json`, com um `schedule` mais frequente (ex: `*/30 * * * *`).
- **Grátis e mais frequente, sem depender do plano da Vercel:** um serviço
  externo (ex: [cron-job.org](https://cron-job.org), GitHub Actions
  agendado) chamando `POST /api/cron/sync` com o header
  `Authorization: Bearer <CRON_SECRET>` no intervalo desejado.

## Manutenção

Limpeza definitiva de fontes excluídas há mais de N dias (hard delete —
aciona o cascade e remove o arquivo do Storage). Roda em modo dry-run por
padrão:
```bash
npm run hard-delete-expired -- --dias=30            # lista o que seria apagado
npm run hard-delete-expired -- --dias=30 --confirmar  # apaga de fato
```

## Status do projeto

Código de todas as fases (0 a 7) do `docs/PLANO.md` implementado. O que
ainda depende de uma ação sua, fora do alcance de um agente de código:
preencher `.env.local`, rodar `supabase db push` + `npm run load-municipios`
no seu projeto Supabase, criar o bucket de Storage, e compartilhar cada
planilha do Google com a service account. Ver `docs/PLANO.md` para o
detalhamento por fase.
