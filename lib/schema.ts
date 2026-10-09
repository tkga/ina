// โครงสร้างชีตทั้งหมด — ลำดับคอลัมน์ต้องตรงกับ Google Sheet / ไฟล์ Excel เดิม
export type ColType = "text" | "num" | "date" | "image";
export interface Col {
  key: string;
  header: string;
  type: ColType;
}

export const SHEETS = {
  Orders: [
    { key: "date", header: "วันที่สร้าง", type: "date" },
    { key: "orderNo", header: "เลขออเดอร์", type: "text" },
    { key: "type", header: "ประเภท", type: "text" },
    { key: "customer", header: "ลูกค้า", type: "text" },
    { key: "gameId", header: "ไอดีเกม", type: "text" },
    { key: "detail", header: "รายละเอียด", type: "text" },
    { key: "price", header: "ราคา", type: "num" },
    { key: "paid", header: "ชำระแล้ว", type: "num" },
    { key: "payStatus", header: "สถานะชำระ", type: "text" },
    { key: "jobStatus", header: "สถานะเทรด/งาน", type: "text" },
    { key: "cancelled", header: "ยกเลิก?", type: "text" },
    { key: "slip", header: "รูปสลิป/รูปงาน", type: "image" },
    { key: "productCode", header: "รหัสสินค้า", type: "text" },
  ],
  Customers: [
    { key: "name", header: "ชื่อในเกม", type: "text" },
    { key: "gameIds", header: "ไอดีในเกมทั้งหมด", type: "text" },
    { key: "facebook", header: "Facebook", type: "text" },
    { key: "note", header: "หมายเหตุ", type: "text" },
    { key: "spend", header: "ยอดใช้จ่ายสะสม", type: "num" },
  ],
  Accounts: [
    { key: "name", header: "ชื่อไอดี", type: "text" },
    { key: "skuCount", header: "จำนวนชนิดสินค้า (SKU)", type: "num" },
    { key: "qty", header: "จำนวนคงเหลือรวม", type: "num" },
    { key: "invested", header: "ลงทุนสะสม", type: "num" },
    { key: "revenue", header: "รายรับสะสม", type: "num" },
  ],
  Stock: [
    { key: "account", header: "ชื่อไอดี", type: "text" },
    { key: "pokemon", header: "ชื่อสินค้า (Pokémon)", type: "text" },
    { key: "kind", header: "ชนิด", type: "text" },
    { key: "qty", header: "จำนวนคงเหลือ", type: "num" },
    { key: "alertAt", header: "แจ้งเตือนเมื่อเหลือ ≤", type: "num" },
    { key: "imageCell", header: "รูปสินค้า", type: "image" },
    { key: "imageUrl", header: "ลิงก์รูป (ห้ามลบ)", type: "text" },
    { key: "price", header: "ราคาต่อตัว", type: "num" },
    { key: "code", header: "รหัสสินค้า", type: "text" },
    { key: "sortOrder", header: "ลำดับแนะนำ", type: "num" },
  ],
  Finance: [
    { key: "date", header: "วันที่", type: "date" },
    { key: "kind", header: "ประเภท", type: "text" },
    { key: "amount", header: "จำนวนเงิน", type: "num" },
    { key: "note", header: "หมายเหตุ", type: "text" },
  ],
} as const satisfies Record<string, readonly Col[]>;

export type SheetName = keyof typeof SHEETS;
export const SHEET_NAMES = Object.keys(SHEETS) as SheetName[];

export const SHEET_LABEL: Record<SheetName, string> = {
  Orders: "ออเดอร์",
  Customers: "ลูกค้า",
  Accounts: "ไอดีเกม",
  Stock: "สต็อก",
  Finance: "การเงิน",
};

export function isSheet(name: string): name is SheetName {
  return Object.prototype.hasOwnProperty.call(SHEETS, name);
}

export function cols(sheet: SheetName): readonly Col[] {
  return SHEETS[sheet];
}

export function lastColLetter(sheet: SheetName): string {
  return String.fromCharCode(64 + SHEETS[sheet].length);
}

export type Cell = string | number | null;

// ---------- ค่าคงที่ของธุรกิจ ----------
export const ORDER_TYPES = [
  { value: "sell_pokemon", label: "ขายโปเกมอน" },
  { value: "hire_invite", label: "จ้างเชิญ" },
  { value: "hire_farm", label: "จ้างฟาร์ม" },
] as const;
export const CANCELLED = "ยกเลิก";
export const FINANCE_KINDS = [
  { value: "ลงทุน", sign: -1 },
  { value: "รายจ่าย", sign: -1 },
  { value: "รายรับ", sign: 1 },
] as const;
