import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GoogleSheetsReader } from "./googleSheetsReader";
import { FileUploadReader } from "./fileUploadReader";
import type { SourceReader } from "./types";

type SourceRow = Database["public"]["Tables"]["sources"]["Row"];

/**
 * Único ponto do código que sabe que existem dois tipos de fonte. O motor
 * de sincronização (lib/sync) consome apenas a interface SourceReader.
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

  if (!source.arquivo_path) {
    throw new Error(`Fonte ${source.id} é arquivo_upload mas não tem arquivo_path.`);
  }
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads-fontes";
  return new FileUploadReader(supabase, bucket, source.arquivo_path);
}
