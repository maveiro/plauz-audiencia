import { NextRequest, NextResponse } from "next/server";
import { syncSource } from "@/lib/sync/syncSource";

/**
 * Dispara a sincronização de uma fonte (Sheets ou upload). Usada tanto pelo
 * botão "sincronizar agora" da interface quanto pela rota de Cron (Fase 5),
 * que chama a mesma função syncSource por trás.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await params;

  const result = await syncSource(sourceId);

  return NextResponse.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}
