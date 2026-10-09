// ที่เก็บข้อมูลบน Redis (Upstash) ที่เชื่อมจาก Vercel > Storage ได้ในไม่กี่คลิก
import type { Cell, SheetName } from "./schema";
import { DocStore } from "./doc-store";

/** หาค่า URL/Token ของ Redis จากตัวแปรที่ Vercel ใส่ให้ (ชื่อขึ้นต้นต่างกันได้ เช่น KV_ / UPSTASH_ / STORAGE_) */
export function kvEnv(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  for (const key of Object.keys(env)) {
    if (!/URL$/.test(key) || /READ_ONLY/.test(key)) continue;
    const url = env[key];
    if (!url || !/^https:\/\//.test(url)) continue; // ข้าง redis:// ไม่ใช้ ต้องเป็นแบบ REST (https)
    const token = env[key.replace(/URL$/, "TOKEN")];
    if (token) return { url, token };
  }
  return null;
}

export class KvStore extends DocStore {
  readonly kind = "kv" as const;
  constructor(private url: string, private token: string) {
    super();
  }

  private async cmd<T>(args: (string | number)[]): Promise<T> {
    let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { result?: T; error?: string };
        if (j.error) throw new Error(`ที่เก็บข้อมูล (Redis) ตอบกลับ: ${j.error}`);
        return j.result as T;
      }
      last = `ที่เก็บข้อมูล (Redis) ตอบกลับ ${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
    throw new Error(last);
  }

  protected async load(sheet: SheetName): Promise<Cell[][]> {
    const raw = await this.cmd<string | null>(["GET", `shop:${sheet}`]);
    return raw ? (JSON.parse(raw) as Cell[][]) : [];
  }
  protected async save(sheet: SheetName, rows: Cell[][]): Promise<void> {
    await this.cmd(["SET", `shop:${sheet}`, JSON.stringify(rows)]);
  }
}
