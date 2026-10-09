import { type Cell, type SheetName } from "./schema";

export interface RawRow {
  row: number; // เลขแถวในชีต (แถวข้อมูลแรก = 2)
  cells: Cell[];
}

export interface Store {
  readonly kind: "sheets" | "file" | "kv";
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
  } else if (process.env.GOOGLE_SHEET_ID) {
    // ถ้าตั้งค่า Google Sheets ไว้ ใช้ Google Sheets
    const { SheetsStore } = await import("./sheets-store");
    cached = SheetsStore.fromEnv();
  } else {
    // ไม่งั้นใช้ Redis ที่เชื่อมจาก Vercel > Storage
    const { KvStore, kvEnv } = await import("./kv-store");
    const env = kvEnv();
    if (!env) {
      throw new Error(
        "ยังไม่ได้เชื่อมที่เก็บข้อมูล — ที่ Vercel เปิดแท็บ Storage แล้วสร้าง Upstash Redis เชื่อมกับโปรเจกต์นี้ จากนั้น Redeploy (หรือจะตั้งค่า Google Sheets แทนก็ได้ ดู README)"
      );
    }
    cached = new KvStore(env.url, env.token);
  }
  return cached;
}
