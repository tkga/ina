// ตรรกะธุรกิจ: อ่านเป็น Item, เขียนพร้อมตรวจความขัดแย้ง, คำนวณยอดสะสม
import { HttpError } from "./api";
import { cellsEqual, driveId, imageFormula, imageUrlFull, norm, num, revOf, toCells, toItem, type Item } from "./cells";
import { CANCELLED, cols, type Cell, type SheetName } from "./schema";
import { getStore, type Store } from "./store";

export async function listItems(sheet: SheetName, store?: Store): Promise<Item[]> {
  const s = store ?? (await getStore());
  const rows = await s.readAll(sheet);
  return rows.map((r) => toItem(sheet, r.row, r.cells));
}

// ---------- ยอดสะสมที่คำนวณได้จากข้อมูลอื่น ----------
export interface Derived {
  spend: Map<string, number>; // ลูกค้า -> ยอดชำระสะสม (ไม่นับออเดอร์ยกเลิก)
  sku: Map<string, number>; // ไอดี -> จำนวนแถวสินค้า
  qty: Map<string, number>; // ไอดี -> จำนวนคงเหลือรวม
}
export function computeDerived(orders: Item[], stock: Item[]): Derived {
  const spend = new Map<string, number>();
  for (const o of orders) {
    if (o.cancelled) continue;
    const k = norm(o.customer);
    spend.set(k, (spend.get(k) ?? 0) + num(o.paid));
  }
  const sku = new Map<string, number>();
  const qty = new Map<string, number>();
  for (const s of stock) {
    const k = norm(s.account);
    sku.set(k, (sku.get(k) ?? 0) + 1);
    qty.set(k, (qty.get(k) ?? 0) + num(s.qty));
  }
  return { spend, sku, qty };
}

export function overlay(sheet: SheetName, items: Item[], d: Derived): Item[] {
  if (sheet === "Customers") return items.map((c) => ({ ...c, spend: d.spend.get(norm(c.name)) ?? 0 }));
  if (sheet === "Accounts")
    return items.map((a) => ({ ...a, skuCount: d.sku.get(norm(a.name)) ?? 0, qty: d.qty.get(norm(a.name)) ?? 0 }));
  return items;
}

/** เขียนยอดสะสมที่คำนวณได้กลับลงชีต (เฉพาะแถวที่ค่าเปลี่ยน) */
export async function syncDerived(store: Store) {
  const [orders, stock, customers, accounts] = await Promise.all([
    listItems("Orders", store),
    listItems("Stock", store),
    listItems("Customers", store),
    listItems("Accounts", store),
  ]);
  const d = computeDerived(orders, stock);
  for (const [sheet, items] of [["Customers", customers], ["Accounts", accounts]] as const) {
    const shown = overlay(sheet, items, d);
    for (let i = 0; i < items.length; i++) {
      const before = toCells(sheet, items[i]);
      const after = toCells(sheet, shown[i]);
      if (!cellsEqual(before, after)) await store.update(sheet, items[i]._row, after);
    }
  }
}

// ---------- เขียนข้อมูลพร้อมตรวจความขัดแย้ง ----------
export async function readRowChecked(store: Store, sheet: SheetName, row: number, rev: string | undefined) {
  const rows = await store.readAll(sheet);
  const found = rows.find((r) => r.row === row);
  if (!found) throw new HttpError(404, "ไม่พบแถวนี้แล้ว (อาจถูกลบหรือย้ายไปแล้ว) — โหลดหน้าใหม่");
  if (rev && revOf(found.cells) !== rev) throw new HttpError(409, "ข้อมูลนี้ถูกแก้จากที่อื่นไปแล้ว — โหลดหน้าใหม่แล้วแก้อีกครั้ง");
  return found;
}

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** ตรวจ/จัดรูปข้อมูลก่อนบันทึก ตามกฎของแต่ละชีต */
export async function prepare(store: Store, sheet: SheetName, input: Record<string, any>, prev?: Item | null): Promise<Cell[]> {
  const data: Record<string, any> = { ...(prev ?? {}), ...input };
  const must = (key: string, label: string) => {
    if (!norm(data[key])) throw new HttpError(400, `กรุณากรอก${label}`);
  };

  if (sheet === "Orders") {
    must("customer", "ชื่อลูกค้า");
    if (!Number.isFinite(Number(data.price)) || data.price === "" || data.price === null) throw new HttpError(400, "กรุณากรอกราคา");
    data.date = data.date || today();
    data.paid = data.paid === "" || data.paid === null || data.paid === undefined ? 0 : data.paid;
    data.payStatus = num(data.paid) >= num(data.price) ? "paid" : "partial";
    data.jobStatus = data.jobStatus || "waiting";
    data.cancelled = data.cancelled ? CANCELLED : null;
    const sid = driveId(data.slip);
    if (sid && !String(data.slip).startsWith("=")) data.slip = imageFormula(sid);
  }
  if (sheet === "Customers") must("name", "ชื่อในเกม");
  if (sheet === "Accounts") must("name", "ชื่อไอดี");
  if (sheet === "Finance") {
    must("kind", "ประเภท");
    if (data.amount === "" || data.amount === null || !Number.isFinite(Number(data.amount))) throw new HttpError(400, "กรุณากรอกจำนวนเงิน");
    data.date = data.date || today();
  }
  if (sheet === "Stock") {
    must("account", "ชื่อไอดี");
    must("pokemon", "ชื่อสินค้า");
    if (data.alertAt === "" || data.alertAt === null || data.alertAt === undefined) data.alertAt = 2;
    // รูป: รับลิงก์ Drive แล้วสร้างทั้งลิงก์รูปและสูตรแสดงรูปให้
    const id = driveId(data.imageUrl);
    if (id) {
      data.imageUrl = imageUrlFull(id);
      data.imageCell = imageFormula(id);
    }
    // รหัสสินค้า: ใช้รหัสเดิมถ้ามีสินค้าชื่อ+ชนิดเดียวกัน ไม่งั้นออกรหัสใหม่
    if (!norm(data.code)) {
      const all = await listItems("Stock", store);
      const same = all.find((s) => norm(s.pokemon) === norm(data.pokemon) && norm(s.kind) === norm(data.kind) && norm(s.code));
      if (same) {
        data.code = same.code;
        if (!norm(data.imageUrl) && same.imageUrl) {
          data.imageUrl = same.imageUrl;
          data.imageCell = same.imageCell;
        }
      } else {
        const max = all.reduce((m, s) => Math.max(m, Number(String(s.code ?? "").replace(/\D/g, "")) || 0), 0);
        data.code = "A" + String(max + 1).padStart(3, "0");
      }
    }
  }
  return toCells(sheet, data);
}

export async function nextOrderNo(store: Store): Promise<string> {
  const orders = await listItems("Orders", store);
  const max = orders.reduce((m, o) => Math.max(m, Number(String(o.orderNo ?? "").replace(/\D/g, "")) || 0), 0);
  return "a" + String(max + 1).padStart(4, "0");
}

export const colKeys = (sheet: SheetName) => cols(sheet).map((c) => c.key);

// ---------- สร้างออเดอร์ (ตัดสต็อก + เพิ่มลูกค้าอัตโนมัติ) ----------
export async function createOrder(store: Store, input: Record<string, any>): Promise<number> {
  const data: Record<string, any> = { ...input, orderNo: await nextOrderNo(store) };
  const qty = Math.max(1, Math.floor(num(input._qty) || 1));

  let stockItem: Item | null = null;
  if (input._stockRow) {
    const row = await readRowChecked(store, "Stock", Number(input._stockRow), undefined);
    stockItem = toItem("Stock", row.row, row.cells);
    if (num(stockItem.qty) < qty) throw new HttpError(400, `สต็อกไม่พอ (เหลือ ${num(stockItem.qty)})`);
    data.productCode = stockItem.code;
    if (!norm(data.detail)) data.detail = `${norm(stockItem.pokemon)}${stockItem.kind ? ` (${norm(stockItem.kind)})` : ""} x${qty}`;
    if (data.price === undefined || data.price === "") data.price = num(stockItem.price) * qty;
  }
  const cells = await prepare(store, "Orders", data);
  const row = await store.append("Orders", cells);

  if (stockItem) {
    const next = toCells("Stock", { ...stockItem, qty: num(stockItem.qty) - qty });
    await store.update("Stock", stockItem._row, next);
  }

  const name = norm(data.customer);
  const gid = norm(data.gameId);
  const customers = await listItems("Customers", store);
  const found = customers.find((c) => norm(c.name) === name);
  const usableId = gid && gid !== "ว่าง";
  if (!found) {
    await store.append("Customers", toCells("Customers", { name, gameIds: usableId ? gid : null, spend: 0 }));
  } else if (usableId && !norm(found.gameIds).split(/[,\s]+/).includes(gid)) {
    const ids = [norm(found.gameIds), gid].filter(Boolean).join(", ");
    await store.update("Customers", found._row, toCells("Customers", { ...found, gameIds: ids }));
  }
  await syncDerived(store);
  return row;
}
