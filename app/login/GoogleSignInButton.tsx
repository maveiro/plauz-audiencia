"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // hd só melhora a UX do seletor de conta do Google (pré-filtra pro
        // domínio certo) — não é controle de segurança. A checagem que
        // realmente restringe acesso é feita em app/auth/callback/route.ts.
        queryParams: { hd: "plauz.com.br", prompt: "select_account" },
      },
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={loading} className="w-full">
      {loading ? "Redirecionando…" : "Entrar com Google"}
    </Button>
  );
}
