import "server-only";
import { getSheetsClient } from "@/lib/google/sheetsClient";
import type { RawRow, SourceReader } from "./types";

export class GoogleSheetsReader implements SourceReader {
  constructor(
    private readonly sheetId: string,
    private readonly tabName?: string | null,
  ) {}

  async getRows(): Promise<RawRow[]> {
    const sheets = getSheetsClient();
    const range = await this.resolveRange(sheets);

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
    });

    const values = data.values ?? [];
    if (values.length === 0) return [];

    const [headerRow, ...dataRows] = values;
    const headers = headerRow.map((h) => String(h ?? "").trim());

    return dataRows.map((row) => {
      const rawRow: RawRow = {};
      headers.forEach((header, i) => {
        rawRow[header] = String(row[i] ?? "");
      });
      return rawRow;
    });
  }

  private async resolveRange(
    sheets: ReturnType<typeof getSheetsClient>,
  ): Promise<string> {
    if (this.tabName) return this.tabName;

    const { data } = await sheets.spreadsheets.get({
      spreadsheetId: this.sheetId,
      fields: "sheets.properties.title",
    });
    const firstTitle = data.sheets?.[0]?.properties?.title;
    if (!firstTitle) {
      throw new Error(
        `Não foi possível determinar a aba da planilha ${this.sheetId}.`,
      );
    }
    return firstTitle;
  }
}
