// /api/data/<Sheet>         GET = ดูทั้งชีต, POST = เพิ่มแถว
// /api/data/<Sheet>/<แถว>   PUT = แก้ไข, DELETE = ลบ
import { NextResponse } from "next/server";
import { HttpError, handler } from "@/lib/api";
import { toItem } from "@/lib/cells";
import { cols, isSheet, type SheetName } from "@/lib/schema";
import { computeDerived, createOrder, listItems, overlay, prepare, readRowChecked, syncDerived } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ path: string[] }> };

async function target(ctx: Ctx, needRow: boolean): Promise<{ sheet: SheetName; row: number }> {
  const [sheet, rowStr] = (await ctx.params).path;
  const row = Number(rowStr);
  if (!sheet || !isSheet(sheet)) throw new HttpError(404, "ไม่พบชีตนี้");
  if (needRow && (!Number.isInteger(row) || row < 2)) throw new HttpError(404, "ไม่พบรายการ");
  return { sheet, row };
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { sheet } = await target(ctx, false);
  const store = await getStore();
  let items = await listItems(sheet, store);
  if (sheet === "Customers" || sheet === "Accounts") {
    const [orders, stock] = await Promise.all([listItems("Orders", store), listItems("Stock", store)]);
    items = overlay(sheet, items, computeDerived(orders, stock));
  }
  return NextResponse.json({ columns: cols(sheet).map((c) => c.key), items });
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { sheet } = await target(ctx, false);
  const body = await req.json();
  const store = await getStore();
  let row: number;
  if (sheet === "Orders") {
    row = await createOrder(store, body);
  } else {
    row = await store.append(sheet, await prepare(store, sheet, body));
    if (sheet === "Stock" || sheet === "Customers" || sheet === "Accounts") await syncDerived(store);
  }
  return NextResponse.json({ ok: true, row });
});

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const { sheet, row } = await target(ctx, true);
  const { _rev, ...input } = await req.json();
  const store = await getStore();
  const found = await readRowChecked(store, sheet, row, _rev);
  const cells = await prepare(store, sheet, input, toItem(sheet, row, found.cells));
  await store.update(sheet, row, cells);
  await syncDerived(store);
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const { sheet, row } = await target(ctx, true);
  if (sheet === "Orders") throw new HttpError(400, "ออเดอร์ลบไม่ได้ ให้ใช้ปุ่มยกเลิกแทน เพื่อให้ยอดย้อนหลังยังตรวจสอบได้");
  const rev = new URL(req.url).searchParams.get("rev") ?? undefined;
  const store = await getStore();
  await readRowChecked(store, sheet, row, rev);
  await store.remove(sheet, row);
  await syncDerived(store);
  return NextResponse.json({ ok: true });
});
