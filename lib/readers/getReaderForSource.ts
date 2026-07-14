import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GoogleSheetsReader } from "./googleSheetsReader";
import { FileUploadReader } from "./fileUploadReader";
import type { SourceReader } from "./types";

type SourceRow = Database["public"]["Tables"]["sources"]["Row"];

/**
 * Único ponto do código que sabe quais tipos de fonte existem — mas só os
 * dois tipos "pull" (lidos em lote sob demanda). `formulario_nativo` é uma
 * fonte "push": respostas chegam em tempo real via
 * `lib/sync/submitFormResponse.ts`, nunca via reader/getRows(). Chamar
 * syncSource()/getReaderForSource() para essa fonte é sempre um erro de
 * quem chamou (botão errado, chamada manual de API) — falha explícita aqui
 * em vez de cair no ramo de arquivo_upload por engano.
 */
export function getReaderForSource(
  source: SourceRow,
  supabase: SupabaseClient<Database>,
): SourceReader {
  if (source.tipo === "google_sheets") {
    if (!source.sheet_id) {
      throw new Error(`Fonte ${source.id} é google_sheets mas não tem sheet_id.`);
    }
    return new GoogleSheetsReader(source.sheet_id, source.tab_name);
  }

  if (source.tipo === "formulario_nativo") {
    throw new Error(
      `Fonte ${source.id} é um formulário nativo — não sincroniza via reader, respostas entram em tempo real (ver lib/sync/submitFormResponse.ts).`,
    );
  }

  if (!source.arquivo_path) {
    throw new Error(`Fonte ${source.id} é arquivo_upload mas não tem arquivo_path.`);
  }
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads-fontes";
  return new FileUploadReader(supabase, bucket, source.arquivo_path);
}
