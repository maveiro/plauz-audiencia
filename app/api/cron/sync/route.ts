import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncSource, type SyncResult } from "@/lib/sync/syncSource";

/**
 * Chamada pelo Vercel Cron (vercel.json). Sincroniza todas as fontes ativas
 * do tipo google_sheets — uploads não entram aqui, são reprocessados apenas
 * quando reenviados manualmente (CLAUDE.md, Stack). Se uma fonte falhar, as
 * demais continuam (PLANO.md, Fase 5); o erro fica em sync_logs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: sources, error } = await supabase
    .from("sources_ativas")
    .select("id")
    .eq("tipo", "google_sheets")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: SyncResult[] = [];
  for (const source of sources ?? []) {
    // Sequencial de propósito: evita saturar a API do Google Sheets e
    // mantém os sync_logs em ordem previsível. Uma fonte com erro não
    // interrompe as demais.
    results.push(await syncSource(source.id));
  }

  return NextResponse.json({
    total: results.length,
    sucesso: results.filter((r) => r.status === "success").length,
    erro: results.filter((r) => r.status === "error").length,
    results,
  });
}
