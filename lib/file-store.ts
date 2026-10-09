// ที่เก็บข้อมูลในไฟล์ JSON — ใช้ทดสอบในเครื่องเท่านั้น (STORE=file)
import fs from "node:fs";
import path from "node:path";
import { cols, SHEET_NAMES, type Cell, type SheetName } from "./schema";
import type { RawRow, Store } from "./store";

const FILE = path.join(process.cwd(), "data", "store.json");
type Data = Record<string, Cell[][]>;

export class FileStore implements Store {
  readonly kind = "file" as const;

  private load(): Data {
    try {
      return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
      return Object.fromEntries(SHEET_NAMES.map((n) => [n, []]));
    }
  }
  private save(d: Data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d));
  }
  private pad(sheet: SheetName, cells: Cell[]): Cell[] {
    const n = cols(sheet).length;
    return Array.from({ length: n }, (_, i) => cells[i] ?? null);
  }

  async readAll(sheet: SheetName): Promise<RawRow[]> {
    const rows = this.load()[sheet] ?? [];
    const out: RawRow[] = [];
    rows.forEach((cells, i) => {
      if (cells.some((c) => c !== null && c !== "")) out.push({ row: i + 2, cells: this.pad(sheet, cells) });
    });
    return out;
  }
  async append(sheet: SheetName, cells: Cell[]): Promise<number> {
    const d = this.load();
    const rows = (d[sheet] ??= []);
    rows.push(this.pad(sheet, cells));
    this.save(d);
    return rows.length + 1;
  }
  async update(sheet: SheetName, row: number, cells: Cell[]): Promise<void> {
    const d = this.load();
    const rows = (d[sheet] ??= []);
    while (rows.length < row - 1) rows.push(this.pad(sheet, []));
    rows[row - 2] = this.pad(sheet, cells);
    this.save(d);
  }
  async remove(sheet: SheetName, row: number): Promise<void> {
    const d = this.load();
    (d[sheet] ??= []).splice(row - 2, 1);
    this.save(d);
  }
  async replaceAll(sheet: SheetName, rows: Cell[][]): Promise<void> {
    const d = this.load();
    d[sheet] = rows.map((r) => this.pad(sheet, r));
    this.save(d);
  }
}
