import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const ALLOWED_EXTENSIONS = ["csv", "xls", "xlsx"];

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "uploads-fontes";
}

/**
 * Envia o arquivo de uma fonte para o Storage em um caminho determinístico
 * (`${sourceId}.${extensao}`), com upsert — reenviar um arquivo para a
 * mesma fonte substitui o objeto anterior em vez de acumular arquivos
 * órfãos no bucket.
 */
export async function uploadArquivoFonte(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  file: File,
): Promise<{ path: string; originalName: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Formato de arquivo não suportado: "${file.name}". Use CSV, XLS ou XLSX.`,
    );
  }

  const path = `${sourceId}.${extension}`;
  const { error } = await supabase.storage
    .from(getStorageBucket())
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (error) {
    throw new Error(`Falha ao enviar arquivo para o Storage: ${error.message}`);
  }

  return { path, originalName: file.name };
}
