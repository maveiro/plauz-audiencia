import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// /f e /api/f são a página pública de formulário nativo e sua rota de
// submissão — deliberadamente abertas a qualquer visitante da internet, sem
// sessão (ver CLAUDE.md, "Camada adicional: formulários nativos"). Diferente
// de /api/cron/sync (que tem seu próprio segredo, CRON_SECRET), aqui não há
// segredo nenhum: é a primeira superfície do produto que recebe dado de
// fora.
const EXEMPT_PATHS = ["/login", "/auth/callback", "/acesso-negado", "/f", "/api/f"];
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "plauz.com.br").trim().toLowerCase();

/**
 * Roda a cada requisição (middleware.ts na raiz), runtime Edge — por isso
 * nenhum shim de WebSocket aqui (diferente de lib/supabase/serverClient.ts,
 * que roda em Node.js): o Edge runtime já tem WebSocket nativo.
 *
 * Segue o padrão oficial do @supabase/ssr: revalida a sessão via
 * supabase.auth.getUser() (nunca getSession(), que só decodifica o cookie
 * local sem revalidar contra o Supabase Auth) e nunca insere lógica entre
 * createServerClient e getUser() — qualquer coisa ali pode causar logout
 * aleatório difícil de depurar (guia oficial do @supabase/ssr).
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Chamada direta do Vercel Cron (sem sessão de browser), autenticada por
  // CRON_SECRET dentro da própria rota — nunca tocar em cookie de auth aqui.
  if (pathname === "/api/cron/sync") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isExempt = EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isExempt) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Defesa em profundidade, não o controle principal: app/auth/callback já
  // rejeita sessão de fora do domínio antes de qualquer cookie ser salvo.
  // Isso só cobre uma regressão futura (ex: alguém convidar um usuário
  // manualmente pelo dashboard do Supabase, pulando o callback).
  if (user && !isExempt && !user.email?.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  // Repassa o pathname pro root layout (Server Component) decidir se
  // renderiza o chrome autenticado (header/nav) — /f/** usa um shell
  // público enxuto em vez disso. headers() não expõe a URL da requisição
  // por padrão; este é o jeito padrão de contornar isso sem duplicar o
  // root layout inteiro num route group separado.
  response.headers.set("x-pathname", pathname);

  return response;
}
