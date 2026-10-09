import ExcelJS from "exceljs";
import { cols, SHEETS, SHEET_NAMES, type Cell, type SheetName } from "./schema";
import type { Store } from "./store";

export interface BackupData {
  app: "pokeshop-backup";
  version: 1;
  exportedAt: string;
  sheets: Partial<Record<SheetName, { headers: string[]; rows: Cell[][] }>>;
}

export async function exportAll(store: Store): Promise<BackupData> {
  const sheets: BackupData["sheets"] = {};
  for (const name of SHEET_NAMES) {
    const rows = await store.readAll(name);
    sheets[name] = { headers: cols(name).map((c) => c.header), rows: rows.map((r) => r.cells) };
  }
  return { app: "pokeshop-backup", version: 1, exportedAt: new Date().toISOString(), sheets };
}

export async function toXlsx(data: BackupData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pokeshop";
  for (const name of SHEET_NAMES) {
    const s = data.sheets[name];
    if (!s) continue;
    const ws = wb.addWorksheet(name);
    ws.addRow(s.headers).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const c = cols(name);
    for (const r of s.rows) {
      ws.addRow(
        c.map((col, i) => {
          const v = r[i] ?? null;
          if (v === null) return null;
          if (col.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00Z");
          if (typeof v === "string" && v.startsWith("=")) return { formula: v.slice(1) };
          return v;
        })
      );
    }
    c.forEach((col, i) => {
      const column = ws.getColumn(i + 1);
      column.width = col.type === "num" ? 14 : col.type === "date" ? 13 : col.key === "detail" || col.key === "note" ? 32 : 22;
      if (col.type === "date") column.numFmt = "yyyy-mm-dd";
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- อ่านไฟล์ Backup ----------
export interface ParsedBackup {
  sheets: Partial<Record<SheetName, Cell[][]>>;
  errors: string[];
  warnings: string[];
}

const trimH = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

function normalize(sheet: SheetName, raw: unknown[], where: string, errors: string[], warnings: string[]): Cell[] {
  return cols(sheet).map((col, i) => {
    const v = raw[i];
    if (v === undefined || v === null || v === "") return null;
    if (col.type === "num") {
      if (typeof v === "number") return v;
      const n = Number(String(v).replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
      warnings.push(`${where} คอลัมน์ "${col.header}" ไม่ใช่ตัวเลข ("${String(v).slice(0, 20)}") เก็บเป็นข้อความตามเดิม`);
      return String(v);
    }
    if (col.type === "date") {
      if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return String(v).slice(0, 10);
      errors.push(`${where} คอลัมน์ "${col.header}" ต้องเป็นวันที่ (เช่น 2026-09-13) แต่พบ "${String(v).slice(0, 20)}"`);
      return null;
    }
    return typeof v === "number" ? String(v) : String(v);
  });
}

function checkHeaders(sheet: SheetName, got: unknown[], errors: string[]): boolean {
  const want = cols(sheet).map((c) => trimH(c.header));
  const have = want.map((_, i) => trimH(got[i]));
  const bad = want.findIndex((w, i) => w !== have[i]);
  if (bad >= 0) {
    errors.push(`ชีต ${sheet}: หัวคอลัมน์ที่ ${bad + 1} ควรเป็น "${want[bad]}" แต่ไฟล์เป็น "${have[bad]}"`);
    return false;
  }
  return true;
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as any;
    if (typeof o.formula === "string") return "=" + o.formula;
    if (typeof o.sharedFormula === "string") return o.result ?? null;
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text).join("");
    if (typeof o.hyperlink === "string") return o.text ?? o.hyperlink;
    if ("result" in o) return o.result;
    if ("error" in o) return null;
  }
  return v;
}

export async function parseBackup(file: Buffer, filename: string): Promise<ParsedBackup> {
  const out: ParsedBackup = { sheets: {}, errors: [], warnings: [] };
  const isJson = /\.json$/i.test(filename) || file.subarray(0, 1).toString() === "{";

  if (isJson) {
    let data: any;
    try {
      data = JSON.parse(file.toString("utf8"));
    } catch {
      out.errors.push("ไฟล์ JSON อ่านไม่ได้ (รูปแบบไม่ถูกต้อง)");
      return out;
    }
    if (data?.app !== "pokeshop-backup" || typeof data.sheets !== "object") {
      out.errors.push("ไม่ใช่ไฟล์ Backup ของเว็บนี้");
      return out;
    }
    for (const name of SHEET_NAMES) {
      const s = data.sheets[name];
      if (!s) continue;
      if (!Array.isArray(s.rows) || !checkHeaders(name, s.headers ?? [], out.errors)) continue;
      out.sheets[name] = s.rows
        .filter((r: unknown) => Array.isArray(r))
        .map((r: unknown[], i: number) => normalize(name, r, `${name} แถว ${i + 2}`, out.errors, out.warnings))
        .filter((r: Cell[]) => r.some((c) => c !== null));
    }
  } else {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as any);
    } catch {
      out.errors.push("ไฟล์ Excel อ่านไม่ได้ (ไฟล์เสียหรือไม่ใช่ .xlsx)");
      return out;
    }
    for (const ws of wb.worksheets) {
      if (!(ws.name in SHEETS)) {
        out.warnings.push(`ข้ามแท็บ "${ws.name}" เพราะไม่ใช่ชีตของระบบ`);
        continue;
      }
      const name = ws.name as SheetName;
      const n = cols(name).length;
      const head = ws.getRow(1);
      if (!checkHeaders(name, Array.from({ length: n }, (_, i) => cellValue(head.getCell(i + 1).value)), out.errors)) continue;
      const rows: Cell[][] = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const raw = Array.from({ length: n }, (_, i) => cellValue(row.getCell(i + 1).value));
        const cells = normalize(name, raw, `${name} แถว ${rowNumber}`, out.errors, out.warnings);
        if (cells.some((c) => c !== null)) rows.push(cells);
      });
      out.sheets[name] = rows;
    }
  }
  if (!Object.keys(out.sheets).length && !out.errors.length) out.errors.push("ไม่พบชีตที่ใช้ได้ในไฟล์นี้ (ต้องมีแท็บ Orders, Customers, Accounts, Stock หรือ Finance)");
  if (out.warnings.length > 8) {
    const extra = out.warnings.length - 8;
    out.warnings = [...out.warnings.slice(0, 8), `…และอีก ${extra} รายการ`];
  }
  return out;
}
