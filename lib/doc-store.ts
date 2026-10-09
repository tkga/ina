// ที่เก็บข้อมูลแบบ "หนึ่งชีต = หนึ่งก้อน JSON" ใช้ร่วมกันระหว่างไฟล์ (ทดสอบ) และ Redis (ใช้จริงบน Vercel)
import { cols, type Cell, type SheetName } from "./schema";
import type { RawRow, Store } from "./store";

export abstract class DocStore implements Store {
  abstract readonly kind: "sheets" | "file" | "kv";
  protected abstract load(sheet: SheetName): Promise<Cell[][]>;
  protected abstract save(sheet: SheetName, rows: Cell[][]): Promise<void>;

  private pad(sheet: SheetName, cells: Cell[]): Cell[] {
    const n = cols(sheet).length;
    return Array.from({ length: n }, (_, i) => cells[i] ?? null);
  }

  async readAll(sheet: SheetName): Promise<RawRow[]> {
    const rows = await this.load(sheet);
    const out: RawRow[] = [];
    rows.forEach((cells, i) => {
      if (cells.some((c) => c !== null && c !== "")) out.push({ row: i + 2, cells: this.pad(sheet, cells) });
    });
    return out;
  }
  async append(sheet: SheetName, cells: Cell[]): Promise<number> {
    const rows = await this.load(sheet);
    rows.push(this.pad(sheet, cells));
    await this.save(sheet, rows);
    return rows.length + 1;
  }
  async update(sheet: SheetName, row: number, cells: Cell[]): Promise<void> {
    const rows = await this.load(sheet);
    while (rows.length < row - 1) rows.push(this.pad(sheet, []));
    rows[row - 2] = this.pad(sheet, cells);
    await this.save(sheet, rows);
  }
  async remove(sheet: SheetName, row: number): Promise<void> {
    const rows = await this.load(sheet);
    rows.splice(row - 2, 1);
    await this.save(sheet, rows);
  }
  async replaceAll(sheet: SheetName, rows: Cell[][]): Promise<void> {
    await this.save(sheet, rows.map((r) => this.pad(sheet, r)));
  }
}
