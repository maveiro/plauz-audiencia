import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const EXEMPT_PATHS = ["/login", "/auth/callback", "/acesso-negado"];
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

  return response;
}
