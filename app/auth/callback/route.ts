import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/serverClient";
import { hasArtistsAccess } from "@/lib/auth/hasArtistsAccess";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "plauz.com.br").trim().toLowerCase();

/** Só aceita caminho relativo (começando com "/", nunca "//") — evita open redirect via ?next= manipulado no round-trip do OAuth. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

/**
 * Troca o code do OAuth por sessão e aplica a restrição de domínio
 * (CLAUDE.md não documenta isso ainda — é o controle central de acesso
 * introduzido pela auditoria de segurança: só @plauz.com.br pode entrar).
 * Deslogar antes de redirecionar pra /acesso-negado é essencial — senão um
 * e-mail de fora do domínio ficaria com cookie de sessão válido mesmo
 * caindo numa tela de "acesso negado".
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin));
  }

  const email = data.session.user.email?.toLowerCase() ?? "";
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/acesso-negado?reason=domain", url.origin));
  }

  // Integração com a plataforma central Plauz (plauz-core) — ver
  // middleware.ts para a mesma checagem aplicada a cada requisição
  // subsequente. Rejeitar aqui também evita depender só do middleware para
  // o primeiro redirecionamento pós-login.
  if (!(await hasArtistsAccess(supabase))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/acesso-negado?reason=no_access", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
