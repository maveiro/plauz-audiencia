# AGENTS.md

Referência rápida para qualquer agente de código trabalhando neste
repositório. Para contexto de domínio, princípios de arquitetura e regras
que não devem ser quebradas sem justificativa, ver `CLAUDE.md` — leia-o
antes de gerar código; este arquivo aqui é só o "como rodar as coisas".
Para o desenho técnico do sistema, ver `ARCHITECTURE.md`.

## Setup

```bash
npm install
cp .env.example .env.local   # preencher manualmente — nunca commitar valores reais
supabase link --project-ref <ref>
supabase db push             # aplica supabase/migrations/
npm run load-municipios      # popula municipios_ref (dado do IBGE, script único)
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Next.js, Turbopack) |
| `npm run build` | Build de produção — deve passar antes de qualquer PR |
| `npm run typecheck` | `tsc --noEmit` — sem erros de tipo |
| `npm run lint` | ESLint (config `eslint-config-next`) |
| `npm run load-municipios` | Popula `municipios_ref` a partir do seed do IBGE |
| `npm run hard-delete-expired -- --dias=30` | Dry-run da limpeza definitiva de fontes excluídas |
| `npm run hard-delete-expired -- --dias=30 --confirmar` | Aplica a limpeza definitiva de fato |

**Antes de considerar uma mudança pronta:** rode `npm run typecheck && npm run lint && npm run build` — os três precisam passar limpos.

## Estrutura

```
app/            rotas Next.js (App Router) — pages, Server Actions, API routes
lib/            lógica de domínio (readers, sync, transforms, geo, validation, google, storage, supabase)
supabase/migrations/   schema versionado — única forma de alterar o banco
scripts/        scripts standalone (rodados via tsx, fora do Next.js)
docs/PLANO.md   roadmap por fase
```

## Convenções de código

- TypeScript em tudo (frontend, API routes, scripts). Sem `any` — usar os
  tipos de `lib/database.types.ts`.
- Nomes de tabelas/colunas: `snake_case`, em português, refletindo o
  domínio (`interessados`, `telefone_valido`) — não traduzir para inglês
  genérico.
- Nomes de funções/variáveis/arquivos TS: inglês, `camelCase`/`PascalCase`
  padrão da comunidade (`syncSource`, `getReaderForSource.ts`).
- Sem comentários explicando o óbvio. Comentário só quando o *porquê* não é
  óbvio pela leitura do código (uma restrição escondida, um workaround, uma
  decisão que alguém vai questionar depois).
- Módulos que tocam segredos (`SUPABASE_SERVICE_ROLE_KEY`, chave da service
  account do Google) começam com `import "server-only"`.
- Novo transform de campo = nova função em `lib/transforms/index.ts`, nunca
  um `if` condicional por fonte espalhado pelo motor de sync.
- Migrações são sempre um novo arquivo em `supabase/migrations/`, nunca uma
  edição de migração já aplicada nem uma alteração manual no dashboard.

## O que NÃO fazer

- Não escrever de volta no Google Sheets (a integração é somente leitura).
- Não descartar uma linha por validação (marcar `_valido = false`, nunca
  pular a linha).
- Não consultar `sources`/`interessados` diretamente para exibir dados
  ativos na interface — sempre as views `sources_ativas` /
  `interessados_ativos`.
- Não commitar `.env.local`, `.mcp.json` (config local de MCP), nem qualquer
  arquivo com segredo real.
- Não fazer `git push --force` nem reescrever histórico sem pedido explícito.

## Antes de abrir um PR / commit

1. `npm run typecheck && npm run lint && npm run build`
2. Se mudou o schema: novo arquivo em `supabase/migrations/` **e efetivamente
   rodado** (`supabase db push` ou `npm run apply-migrations`) contra o
   projeto Supabase real usado pela aplicação — commitar o `.sql` sem
   aplicá-lo já causou erro em produção neste projeto (view/função inexistente
   apesar da migração existir no repo). Confirme com uma query direta se tem
   dúvida se já rodou.
3. Se mudou env vars usadas pela app: atualizar também no dashboard da
   Vercel e disparar um redeploy — variável nova/editada não afeta
   deployments já publicados.
4. Mensagens de commit em português, focadas no *porquê*, não no *o quê*
   (o diff já mostra o quê).
