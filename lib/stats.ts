import { norm, num, type Item } from "./cells";
import { FINANCE_KINDS } from "./schema";

export const monthOf = (iso: unknown) => String(iso ?? "").slice(0, 7);

export interface MonthRow {
  month: string;
  sales: number; // เงินที่รับจากออเดอร์ (ไม่นับที่ยกเลิก)
  otherIncome: number;
  invest: number;
  expense: number;
  profit: number;
}

export function monthly(orders: Item[], finance: Item[]): MonthRow[] {
  const m = new Map<string, MonthRow>();
  const row = (k: string) => {
    if (!m.has(k)) m.set(k, { month: k, sales: 0, otherIncome: 0, invest: 0, expense: 0, profit: 0 });
    return m.get(k)!;
  };
  for (const o of orders) {
    if (o.cancelled || !o.date) continue;
    row(monthOf(o.date)).sales += num(o.paid);
  }
  for (const f of finance) {
    if (!f.date) continue;
    const kind = FINANCE_KINDS.find((k) => k.value === norm(f.kind));
    const r = row(monthOf(f.date));
    const amt = Math.abs(num(f.amount));
    if (kind?.value === "ลงทุน") r.invest += amt;
    else if (kind?.value === "รายจ่าย") r.expense += amt;
    else if (kind?.value === "รายรับ") r.otherIncome += amt;
    else if (num(f.amount) < 0) r.expense += amt;
    else r.otherIncome += amt;
  }
  for (const r of m.values()) r.profit = r.sales + r.otherIncome - r.invest - r.expense;
  return [...m.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export const isLow = (s: Item) => num(s.qty) > 0 && num(s.qty) <= num(s.alertAt || 2);
