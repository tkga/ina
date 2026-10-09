import { cols, type Cell, type SheetName } from "./schema";

export type Item = { _row: number; _rev: string } & Record<string, any>;

export function revOf(cells: Cell[]): string {
  const s = JSON.stringify(cells);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ":" + s.length;
}

export function toItem(sheet: SheetName, row: number, cells: Cell[]): Item {
  const item: Item = { _row: row, _rev: revOf(cells) };
  cols(sheet).forEach((c, i) => {
    item[c.key] = cells[i] ?? null;
  });
  return item;
}

export function toCells(sheet: SheetName, item: Record<string, any>): Cell[] {
  return cols(sheet).map((c) => {
    const v = item[c.key];
    if (v === undefined || v === null || v === "") return null;
    if (c.type === "num") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    return typeof v === "string" ? v.trim() : String(v);
  });
}

export const norm = (s: unknown): string => String(s ?? "").trim();
export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function cellsEqual(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------- รูปจาก Google Drive ----------
export function driveId(v: unknown): string | null {
  const s = String(v ?? "");
  const m = s.match(/[?&]id=([\w-]{10,})/) || s.match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : null;
}
export function thumbUrl(v: unknown, size = 400): string | null {
  const id = driveId(v);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}
export function imageFormula(id: string): string {
  return `=HYPERLINK("https://drive.google.com/file/d/${id}/view", IMAGE("https://drive.google.com/thumbnail?id=${id}&sz=w1600", 4, 76, 76))`;
}
export function imageUrlFull(id: string): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
}
