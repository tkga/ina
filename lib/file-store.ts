// ที่เก็บข้อมูลในไฟล์ JSON — ใช้ทดสอบในเครื่องเท่านั้น (STORE=file)
import fs from "node:fs";
import path from "node:path";
import { SHEET_NAMES, type Cell, type SheetName } from "./schema";
import { DocStore } from "./doc-store";

const FILE = path.join(process.cwd(), "data", "store.json");
type Data = Record<string, Cell[][]>;

export class FileStore extends DocStore {
  readonly kind = "file" as const;

  private read(): Data {
    try {
      return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
      return Object.fromEntries(SHEET_NAMES.map((n) => [n, []]));
    }
  }
  protected async load(sheet: SheetName): Promise<Cell[][]> {
    return this.read()[sheet] ?? [];
  }
  protected async save(sheet: SheetName, rows: Cell[][]): Promise<void> {
    const d = this.read();
    d[sheet] = rows;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d));
  }
}
