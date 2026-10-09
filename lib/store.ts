import { type Cell, type SheetName } from "./schema";

export interface RawRow {
  row: number; // เลขแถวในชีต (แถวข้อมูลแรก = 2)
  cells: Cell[];
}

export interface Store {
  readonly kind: "sheets" | "file";
  /** อ่านทุกแถวข้อมูล (ข้ามแถวว่าง) */
  readAll(sheet: SheetName): Promise<RawRow[]>;
  /** เพิ่มแถวท้ายตาราง คืนเลขแถวที่เพิ่ม */
  append(sheet: SheetName, cells: Cell[]): Promise<number>;
  update(sheet: SheetName, row: number, cells: Cell[]): Promise<void>;
  remove(sheet: SheetName, row: number): Promise<void>;
  /** เขียนทับทั้งชีต (หัวตาราง + ข้อมูล) */
  replaceAll(sheet: SheetName, rows: Cell[][]): Promise<void>;
}

let cached: Store | null = null;

export async function getStore(): Promise<Store> {
  if (cached) return cached;
  if (process.env.STORE === "file" && process.env.NODE_ENV !== "production") {
    const { FileStore } = await import("./file-store");
    cached = new FileStore();
  } else {
    const { SheetsStore } = await import("./sheets-store");
    cached = SheetsStore.fromEnv();
  }
  return cached;
}
