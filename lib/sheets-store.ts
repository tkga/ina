import { GoogleAuth } from "google-auth-library";
import { cols, lastColLetter, type Cell, type Col, type SheetName } from "./schema";
import type { RawRow, Store } from "./store";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const EPOCH = Date.UTC(1899, 11, 30);

const serialToIso = (n: number) => new Date(EPOCH + Math.round(n * 86400000)).toISOString().slice(0, 10);

function decode(col: Col, v: unknown): Cell {
  if (v === undefined || v === null || v === "") return null;
  switch (col.type) {
    case "date":
      return typeof v === "number" ? serialToIso(v) : String(v);
    case "num":
      if (typeof v === "number") return v;
      {
        const n = Number(String(v).replace(/,/g, ""));
        return Number.isFinite(n) ? n : String(v);
      }
    case "text":
      return typeof v === "number" ? String(v) : String(v);
    case "image":
      return String(v);
  }
}

// กันไม่ให้ Google Sheets แปลงข้อความที่หน้าตาเหมือนตัวเลข/วันที่/สูตร ให้กลายเป็นอย่างอื่น
const RISKY = /^[\d.,+\-eE]+$|^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$|^[=+\-@]|^(true|false)$/i;
function encode(col: Col, v: Cell): string | number {
  if (v === null || v === undefined) return "";
  if (col.type === "num") return typeof v === "number" ? v : String(v);
  const s = String(v);
  if (col.type === "image" && s.startsWith("=")) return s;
  if (col.type === "date") return s;
  return RISKY.test(s) ? "'" + s : s;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SheetsStore implements Store {
  readonly kind = "sheets" as const;
  private auth: GoogleAuth;
  private meta: Record<string, { sheetId: number; rows: number }> | null = null;

  constructor(private spreadsheetId: string, email: string, privateKey: string) {
    this.auth = new GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  static fromEnv(): SheetsStore {
    const id = process.env.GOOGLE_SHEET_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!id || !email || !key) {
      throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
    }
    return new SheetsStore(id, email, key);
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      const client = await this.auth.getClient();
      const token = (await client.getAccessToken()).token;
      const res = await fetch(`${BASE}/${this.spreadsheetId}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;
      const body = await res.text();
      lastErr = `Google Sheets ตอบกลับ ${res.status}: ${body.slice(0, 300)}`;
      if (res.status === 429 || res.status >= 500) {
        await sleep(800 * 2 ** attempt);
        continue;
      }
      if (res.status === 403 || res.status === 404) {
        lastErr = "เข้า Google Sheet ไม่ได้ — ตรวจว่าแชร์ชีตให้อีเมล Service Account แบบ Editor แล้ว และ GOOGLE_SHEET_ID ถูกต้อง";
      }
      break;
    }
    throw new Error(lastErr);
  }

  private async loadMeta() {
    if (this.meta) return this.meta;
    const r = await this.req<{ sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number } } }[] }>(
      "?fields=sheets.properties(sheetId,title,gridProperties.rowCount)"
    );
    this.meta = Object.fromEntries(r.sheets.map((s) => [s.properties.title, { sheetId: s.properties.sheetId, rows: s.properties.gridProperties.rowCount }]));
    return this.meta;
  }

  private async sheetInfo(sheet: SheetName, create = false) {
    const m = await this.loadMeta();
    let info = m[sheet];
    if (!info && create) {
      const r = await this.req<{ replies: { addSheet: { properties: { sheetId: number; gridProperties: { rowCount: number } } } }[] }>(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheet } } }] }),
      });
      const p = r.replies[0].addSheet.properties;
      info = m[sheet] = { sheetId: p.sheetId, rows: p.gridProperties.rowCount };
    }
    if (!info) throw new Error(`ไม่พบแท็บชื่อ "${sheet}" ใน Google Sheet — สร้างแท็บให้ครบ 5 แท็บ หรือใช้หน้า Backup > Restore เพื่อสร้างข้อมูลเริ่มต้น`);
    return info;
  }

  private async ensureRows(sheet: SheetName, needed: number) {
    const info = await this.sheetInfo(sheet);
    if (info.rows >= needed) return;
    const add = needed - info.rows + 50;
    await this.req(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ appendDimension: { sheetId: info.sheetId, dimension: "ROWS", length: add } }] }),
    });
    info.rows += add;
  }

  private rng(sheet: SheetName, a1: string) {
    return encodeURIComponent(`'${sheet}'!${a1}`);
  }

  async readAll(sheet: SheetName): Promise<RawRow[]> {
    await this.sheetInfo(sheet);
    const c = cols(sheet);
    const r = await this.req<{ values?: unknown[][] }>(
      `/values/${this.rng(sheet, `A2:${lastColLetter(sheet)}`)}?valueRenderOption=FORMULA`
    );
    const out: RawRow[] = [];
    (r.values ?? []).forEach((vals, i) => {
      const cells = c.map((col, j) => decode(col, vals[j]));
      if (cells.some((x) => x !== null)) out.push({ row: i + 2, cells });
    });
    return out;
  }

  private encodeRow(sheet: SheetName, cells: Cell[]) {
    return cols(sheet).map((col, i) => encode(col, cells[i] ?? null));
  }

  async append(sheet: SheetName, cells: Cell[]): Promise<number> {
    const rows = await this.readAll(sheet);
    const next = (rows.length ? rows[rows.length - 1].row : 1) + 1;
    await this.update(sheet, next, cells);
    return next;
  }

  async update(sheet: SheetName, row: number, cells: Cell[]): Promise<void> {
    await this.ensureRows(sheet, row);
    await this.req(`/values/${this.rng(sheet, `A${row}:${lastColLetter(sheet)}${row}`)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [this.encodeRow(sheet, cells)] }),
    });
  }

  async remove(sheet: SheetName, row: number): Promise<void> {
    const info = await this.sheetInfo(sheet);
    await this.req(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [{ deleteDimension: { range: { sheetId: info.sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }],
      }),
    });
    info.rows -= 1;
  }

  async replaceAll(sheet: SheetName, rows: Cell[][]): Promise<void> {
    await this.sheetInfo(sheet, true);
    await this.ensureRows(sheet, rows.length + 1);
    const last = lastColLetter(sheet);
    const headers = cols(sheet).map((c) => c.header);
    await this.req(`/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: [`'${sheet}'!A2:${last}`] }) });
    await this.req(`/values/${this.rng(sheet, `A1:${last}1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [headers] }),
    });
    if (rows.length) {
      await this.req(`/values/${this.rng(sheet, `A2:${last}${rows.length + 1}`)}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        body: JSON.stringify({ values: rows.map((r) => this.encodeRow(sheet, r)) }),
      });
    }
  }
}
