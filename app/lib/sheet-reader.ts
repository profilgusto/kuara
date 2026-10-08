/**
 * lib/sheet-reader.ts — turns an .xls/.xlsx file into rows of cells.
 *
 * Runs in the browser: the spreadsheet is read where it was picked and only
 * the extracted students travel to the server. The parser (SheetJS) is loaded
 * on demand, so it costs nothing until someone actually picks a file.
 */
import {
  patchBiffNumbers,
  type PatchResult,
  type SheetCellValue,
} from "./sigaa-export";

/** Largest spreadsheet accepted; a class roster is a few dozen kilobytes. */
export const MAX_SHEET_BYTES = 5 * 1024 * 1024;

/** The first sheet of the workbook, as an array of rows of raw cell values. */
export async function readSheetRows(data: ArrayBuffer): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
}

/**
 * Writes numbers into cells of an .xls file without disturbing anything
 * else in it (see `patchBiffNumbers`), and returns the new file's bytes.
 * Throws when the file is not a legacy .xls workbook.
 */
export async function patchXlsNumbers(
  data: ArrayBuffer,
  cells: SheetCellValue[],
): Promise<{ file: Uint8Array; result: PatchResult }> {
  const XLSX = await import("xlsx");
  const container = XLSX.CFB.read(new Uint8Array(data), { type: "array" });
  const entry =
    XLSX.CFB.find(container, "/Workbook") ?? XLSX.CFB.find(container, "/Book");
  if (!entry?.content) {
    throw new Error("Not a legacy .xls workbook");
  }

  const stream = Uint8Array.from(entry.content as ArrayLike<number>);
  const result = patchBiffNumbers(stream, cells);
  entry.content = stream as unknown as typeof entry.content;

  const written = XLSX.CFB.write(container, { type: "array" }) as
    | Uint8Array
    | number[];
  return { file: Uint8Array.from(written), result };
}
