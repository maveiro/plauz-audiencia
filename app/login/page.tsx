import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/serverClient";
import { GoogleSignInButton } from "./GoogleSignInButton";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Login cancelado ou inválido. Tente de novo.",
  oauth_failed: "Não foi possível confirmar o login com o Google. Tente de novo.",
};

function safeNext(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "plauz.com.br").trim().toLowerCase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    if (user.email?.toLowerCase().endsWith(`@${allowedDomain}`)) {
      redirect(next);
    }
    // Sessão de fora do domínio chegou até aqui (não deveria — callback e
    // middleware já cobrem isso) — não deixa como está, limpa antes de
    // seguir pra tela de login normal.
    await supabase.auth.signOut();
  }

  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? "Falha no login.") : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 pt-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Acesso restrito a contas Google do domínio plauz.com.br.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <GoogleSignInButton next={next} />
    </div>
  );
}
