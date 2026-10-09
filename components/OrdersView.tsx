"use client";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Chip, Empty, Field, Loading, Modal, NumInput, PageHead, Segmented, Select, TextInput, Thumb } from "@/components/ui";
import type { Item } from "@/lib/cells";
import { norm, num, thumbUrl } from "@/lib/cells";
import { api, useSheet, hashParams } from "@/lib/client";
import { baht, shortDate, todayIso } from "@/lib/format";
import { CANCELLED, ORDER_TYPES } from "@/lib/schema";

type Filter = "all" | "waiting" | "unpaid" | "done" | "cancelled";
type TypeFilter = "all" | (typeof ORDER_TYPES)[number]["value"];
const TYPE_ICON: Record<string, string> = { sell_pokemon: "🛒", hire_invite: "🤝", hire_farm: "🌾" };
const typeLabel = (v: string) => ORDER_TYPES.find((t) => t.value === v)?.label ?? v;
const ROUNDS = /^(\d+)\s*\/\s*(\d+)(.*)$/;

export default function OrdersView() {
  const orders = useSheet("Orders");
  const customers = useSheet("Customers");
  const stock = useSheet("Stock");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [t, setT] = useState<TypeFilter>("all");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    const p = hashParams();
    setQ(p.get("q") ?? "");
    const ff = p.get("f");
    if (ff === "waiting" || ff === "unpaid" || ff === "done" || ff === "cancelled") setF(ff);
    const tt = p.get("t");
    if (ORDER_TYPES.some((x) => x.value === tt)) setT(tt as TypeFilter);
  }, []);

  const rows = useMemo(() => {
    const all = (orders.items ?? []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.orderNo).localeCompare(String(a.orderNo)));
    const needle = q.trim().toLowerCase();
    return all.filter((o) => {
      if (needle && !`${o.orderNo} ${o.customer} ${o.gameId} ${o.detail}`.toLowerCase().includes(needle)) return false;
      if (t !== "all" && norm(o.type) !== t) return false;
      const cancelled = !!o.cancelled;
      switch (f) {
        case "waiting": return !cancelled && o.jobStatus === "waiting";
        case "unpaid": return !cancelled && num(o.paid) < num(o.price);
        case "done": return !cancelled && o.jobStatus === "traded";
        case "cancelled": return cancelled;
        default: return true;
      }
    });
  }, [orders.items, q, f, t]);

  const typeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders.items ?? []) m.set(norm(o.type), (m.get(norm(o.type)) ?? 0) + 1);
    return m;
  }, [orders.items]);

  const reloadAll = () => Promise.all([orders.reload(), customers.reload(), stock.reload()]);

  return (
    <>
      <PageHead title="ออเดอร์" sub={orders.items ? `${orders.items.length} ออเดอร์` : undefined} action={<Button onClick={() => setEdit("new")}>+ เพิ่มออเดอร์</Button>} />
      <div className="mb-3 space-y-2">
        <TextInput type="search" placeholder="ค้นหาชื่อลูกค้า ไอดีเกม เลขออเดอร์ หรือรายละเอียด" value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }} aria-label="ค้นหาออเดอร์" />
        <Segmented<TypeFilter>
          value={t}
          onChange={(v) => { setT(v); setLimit(40); }}
          options={[
            { value: "all", label: "ทุกประเภท" },
            ...ORDER_TYPES.map((x) => ({ value: x.value, label: `${TYPE_ICON[x.value] ?? ""} ${x.label} (${typeCount.get(x.value) ?? 0})` })),
          ]}
        />
        <Segmented<Filter>
          value={f}
          onChange={(v) => { setF(v); setLimit(40); }}
          options={[
            { value: "all", label: "ทั้งหมด" },
            { value: "waiting", label: "รอดำเนินการ" },
            { value: "unpaid", label: "ค้างชำระ" },
            { value: "done", label: "ส่งมอบแล้ว" },
            { value: "cancelled", label: "ยกเลิก" },
          ]}
        />
      </div>

      {!orders.items ? (
        <Loading error={orders.error} />
      ) : rows.length === 0 ? (
        <Empty text={q || f !== "all" || t !== "all" ? "ไม่พบออเดอร์ที่ตรงกับตัวกรอง" : "ยังไม่มีออเดอร์"} action={<Button onClick={() => setEdit("new")}>เพิ่มออเดอร์แรก</Button>} />
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, limit).map((o) => {
            const cancelled = !!o.cancelled;
            const owed = num(o.price) - num(o.paid);
            const img = thumbUrl(o.slip, 160);
            return (
              <li key={o._row}>
                <button onClick={() => setEdit(o)} className={`flex w-full items-start gap-3 rounded-2xl bg-paper p-4 text-left hover:bg-white/70 ${cancelled ? "opacity-60" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                      <span className="num font-medium text-ink">{norm(o.orderNo)}</span>
                      <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-ink">
                        {TYPE_ICON[norm(o.type)] ?? ""} {typeLabel(norm(o.type))}
                      </span>
                      <span>· {shortDate(o.date)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-base font-semibold">{norm(o.customer)}</span>
                    <span className="block text-sm text-muted">{norm(o.detail)}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {cancelled ? <Chip tone="bad">ยกเลิก</Chip> : o.jobStatus === "traded" ? <Chip tone="good">ส่งมอบแล้ว</Chip> : <Chip tone="warn">รอดำเนินการ</Chip>}
                      {!cancelled && owed > 0 && <Chip tone="bad">ค้าง {baht(owed)}</Chip>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-lg font-semibold">{baht(o.price)}</span>
                    {img && (
                      <span className="ml-auto mt-2 block size-12 overflow-hidden rounded-lg bg-mist">
                        <Thumb src={img} alt="รูปสลิป/รูปงาน" className="size-full object-cover" empty="รูป" />
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {rows.length > limit && (
            <li>
              <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + 40)}>
                แสดงเพิ่ม ({rows.length - limit} ออเดอร์)
              </Button>
            </li>
          )}
        </ul>
      )}

      {edit && (
        <OrderForm
          item={edit === "new" ? null : edit}
          customers={customers.items ?? []}
          stock={stock.items ?? []}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); reloadAll(); }}
        />
      )}
    </>
  );
}

function OrderForm({ item, customers, stock, onClose, onSaved }: { item: Item | null; customers: Item[]; stock: Item[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = !item;
  const [v, setV] = useState({
    date: norm(item?.date) || todayIso(),
    type: norm(item?.type) || "sell_pokemon",
    customer: norm(item?.customer),
    gameId: norm(item?.gameId),
    detail: norm(item?.detail),
    price: item ? String(num(item.price)) : "",
    paid: item ? String(num(item.paid)) : "",
    slip: norm(item?.slip),
    stockRow: "",
    qty: "1",
  });
  const [paidTouched, setPaidTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  const available = useMemo(
    () => stock.filter((s) => num(s.qty) > 0).sort((a, b) => norm(a.pokemon).localeCompare(norm(b.pokemon), "th")),
    [stock]
  );
  const picked = available.find((s) => String(s._row) === v.stockRow);

  function pickStock(row: string) {
    const s = available.find((x) => String(x._row) === row);
    setV((p) => {
      const n = { ...p, stockRow: row };
      if (s) {
        n.price = String(num(s.price) * (Number(p.qty) || 1));
        if (!paidTouched) n.paid = n.price;
      }
      return n;
    });
  }
  function changeCustomer(name: string) {
    const c = customers.find((x) => norm(x.name) === name.trim());
    setV((p) => ({ ...p, customer: name, gameId: p.gameId || (c ? norm(c.gameIds).split(/[,\s]+/)[0] ?? "" : "") }));
  }

  async function submit(extra?: Record<string, unknown>, doneMsg = "บันทึกแล้ว") {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        date: v.date, type: v.type, customer: v.customer, gameId: v.gameId, detail: v.detail,
        price: v.price, paid: v.paid === "" && isNew ? v.price : v.paid, slip: v.slip || null,
        ...extra,
      };
      if (isNew && v.type === "sell_pokemon" && v.stockRow) { body._stockRow = v.stockRow; body._qty = v.qty; }
      if (isNew) await api("/api/data/Orders", { method: "POST", body: JSON.stringify(body) });
      else await api(`/api/data/Orders/${item!._row}`, { method: "PUT", body: JSON.stringify({ ...body, _rev: item!._rev }) });
      toast(doneMsg);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกไม่ได้", true);
      setBusy(false);
    }
  }

  const rounds = item ? norm(item.detail).match(ROUNDS) : null;
  const cancelled = !!item?.cancelled;

  return (
    <Modal title={isNew ? "เพิ่มออเดอร์" : `ออเดอร์ ${norm(item!.orderNo)}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {!isNew && (
          <div className="flex flex-wrap gap-2 rounded-2xl bg-mist p-3">
            <Button variant="ghost" disabled={busy || cancelled} onClick={() => submit({ jobStatus: item!.jobStatus === "traded" ? "waiting" : "traded" }, "อัปเดตสถานะแล้ว")}>
              {item!.jobStatus === "traded" ? "กลับเป็นรอดำเนินการ" : "ส่งมอบแล้ว"}
            </Button>
            {num(item!.paid) < num(item!.price) && (
              <Button variant="ghost" disabled={busy || cancelled} onClick={() => submit({ paid: item!.price }, "บันทึกรับเงินครบแล้ว")}>
                รับเงินครบ
              </Button>
            )}
            {rounds && !cancelled && (
              <Button
                variant="ghost"
                disabled={busy || Number(rounds[1]) >= Number(rounds[2])}
                onClick={() => {
                  const done = Number(rounds[1]) + 1;
                  submit({ detail: `${done}/${rounds[2]}${rounds[3]}`, jobStatus: done >= Number(rounds[2]) ? "traded" : item!.jobStatus }, "นับรอบเพิ่มแล้ว");
                }}
              >
                +1 รอบ ({rounds[1]}/{rounds[2]})
              </Button>
            )}
            <Button variant="danger" disabled={busy} onClick={() => { if (cancelled || confirm("ยกเลิกออเดอร์นี้? ยอดชำระจะไม่ถูกนับเป็นรายรับ")) submit({ cancelled: !cancelled }, cancelled ? "เลิกยกเลิกแล้ว" : "ยกเลิกออเดอร์แล้ว"); }}>
              {cancelled ? "เลิกยกเลิก" : "ยกเลิกออเดอร์"}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่"><TextInput type="date" value={v.date} onChange={(e) => set("date", e.target.value)} required /></Field>
          <Field label="ประเภท">
            <Select value={v.type} onChange={(e) => set("type", e.target.value)}>
              {ORDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="ชื่อลูกค้า" hint={isNew ? "ถ้าเป็นลูกค้าใหม่ ระบบจะเพิ่มในหน้าลูกค้าให้เอง" : undefined}>
          <TextInput list="customer-list" value={v.customer} onChange={(e) => changeCustomer(e.target.value)} required autoComplete="off" />
          <datalist id="customer-list">{customers.map((c) => <option key={c._row} value={norm(c.name)} />)}</datalist>
        </Field>
        <Field label="ไอดีเกม"><TextInput value={v.gameId} onChange={(e) => set("gameId", e.target.value)} placeholder="ถ้ายังไม่มี ใส่ ว่าง" /></Field>

        {isNew && v.type === "sell_pokemon" && (
          <div className="space-y-3 rounded-2xl border border-line p-3">
            <Field label="เลือกสินค้าจากสต็อก (ไม่บังคับ)" hint="เลือกแล้วระบบจะตัดสต็อกและใส่ราคา/รายละเอียดให้">
              <Select value={v.stockRow} onChange={(e) => pickStock(e.target.value)}>
                <option value="">ไม่ตัดสต็อก</option>
                {available.map((s) => (
                  <option key={s._row} value={s._row}>
                    {norm(s.pokemon)}{s.kind ? ` (${norm(s.kind)})` : ""} · {norm(s.account)} · เหลือ {num(s.qty)} · {baht(s.price)}
                  </option>
                ))}
              </Select>
            </Field>
            {picked && (
              <Field label="จำนวนที่ขาย">
                <NumInput value={v.qty} onChange={(e) => {
                  const q = e.target.value;
                  setV((p) => {
                    const price = String(num(picked.price) * (Number(q) || 1));
                    return { ...p, qty: q, price, paid: paidTouched ? p.paid : price };
                  });
                }} />
              </Field>
            )}
          </div>
        )}

        <Field label="รายละเอียด"><TextInput value={v.detail} onChange={(e) => set("detail", e.target.value)} placeholder={v.type === "hire_invite" ? "เช่น 0/10 รอบ" : "เช่น ซาเซียน x1"} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคา (บาท)">
            <NumInput value={v.price} required onChange={(e) => { const p = e.target.value; setV((s) => ({ ...s, price: p, paid: paidTouched ? s.paid : p })); }} />
          </Field>
          <Field label="ชำระแล้ว (บาท)">
            <NumInput value={v.paid} onChange={(e) => { setPaidTouched(true); set("paid", e.target.value); }} />
          </Field>
        </div>
        <Field label="ลิงก์รูปสลิป/รูปงาน (Google Drive)" hint="ไม่บังคับ">
          <TextInput value={v.slip.startsWith("=") ? "(มีรูปแนบอยู่แล้ว)" : v.slip} disabled={v.slip.startsWith("=")} onChange={(e) => set("slip", e.target.value)} placeholder="https://drive.google.com/file/d/…" />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? "กำลังบันทึก…" : isNew ? "เพิ่มออเดอร์" : "บันทึก"}</Button>
          <Button variant="ghost" onClick={onClose}>ปิด</Button>
        </div>
        {!isNew && <p className="text-xs text-muted">หมายเหตุ: ยกเลิกออเดอร์ไม่คืนสต็อกอัตโนมัติ ถ้าต้องการให้ไปเพิ่มจำนวนในหน้าสต็อก</p>}
      </form>
    </Modal>
  );
}
