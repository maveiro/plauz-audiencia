import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RawRow, SourceReader } from "./types";

export class FileUploadReader implements SourceReader {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly bucket: string,
    private readonly arquivoPath: string,
  ) {}

  async getRows(): Promise<RawRow[]> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(this.arquivoPath);

    if (error || !data) {
      throw new Error(
        `Falha ao baixar arquivo "${this.arquivoPath}" do bucket "${this.bucket}": ${error?.message ?? "arquivo não encontrado"}`,
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const extension = this.arquivoPath.split(".").pop()?.toLowerCase();

    return extension === "csv" ? parseCsv(buffer) : parseSpreadsheet(buffer);
  }
}

function parseCsv(buffer: Buffer): RawRow[] {
  const { data } = Papa.parse<Record<string, string>>(
    buffer.toString("utf-8"),
    { header: true, skipEmptyLines: true },
  );
  return data.map(normalizeRow);
}

function parseSpreadsheet(buffer: Buffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rows.map(normalizeRow);
}

function normalizeRow(row: Record<string, unknown>): RawRow {
  const rawRow: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    rawRow[key] = value === null || value === undefined ? "" : String(value);
  }
  return rawRow;
}
