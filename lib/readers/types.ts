/**
 * Uma linha bruta de qualquer fonte, sempre nesse formato: chave = nome da
 * coluna exatamente como veio da fonte, valor = texto (célula vazia = "").
 * O motor de sincronização não sabe nem precisa saber se a linha veio de
 * uma planilha do Google ou de um arquivo.
 */
export type RawRow = Record<string, string>;

export interface SourceReader {
  getRows(): Promise<RawRow[]>;
}
