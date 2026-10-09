"use client";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Chip, Empty, Field, Loading, Modal, NumInput, PageHead, Select, TextInput } from "@/components/ui";
import type { Item } from "@/lib/cells";
import { norm, num } from "@/lib/cells";
import { api, useSheet } from "@/lib/client";
import { baht, shortDate, todayIso } from "@/lib/format";
import { FINANCE_KINDS } from "@/lib/schema";

const signOf = (kind: string) => FINANCE_KINDS.find((k) => k.value === kind)?.sign ?? -1;

export default function FinanceView() {
  const finance = useSheet("Finance");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [limit, setLimit] = useState(60);

  const rows = useMemo(
    () => (finance.items ?? []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b._row - a._row),
    [finance.items]
  );
  const net = rows.reduce((s, r) => s + num(r.amount), 0);

  return (
    <>
      <PageHead title="การเงิน" sub="รายการลงทุนและรายจ่ายของร้าน" action={<Button onClick={() => setEdit("new")}>+ เพิ่มรายการ</Button>} />
      {finance.items && (
        <p className="mb-3 rounded-2xl bg-paper px-4 py-3 text-sm">
          รวมทุกรายการ <b className={`num ${net < 0 ? "text-ball" : "text-good"}`}>{baht(net)}</b>
          <span className="text-muted"> (ไม่รวมรายรับจากออเดอร์ ดูกำไรรวมที่หน้าภาพรวม)</span>
        </p>
      )}
      {!finance.items ? <Loading error={finance.error} /> : rows.length === 0 ? <Empty text="ยังไม่มีรายการ" /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-paper">
          {rows.slice(0, limit).map((r) => (
            <li key={r._row}>
              <button onClick={() => setEdit(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist">
                <span className="w-14 shrink-0 text-sm text-muted">{shortDate(r.date)}</span>
                <span className="min-w-0 flex-1">
                  <Chip tone={signOf(norm(r.kind)) > 0 ? "good" : norm(r.kind) === "ลงทุน" ? "warn" : "plain"}>{norm(r.kind)}</Chip>
                  {norm(r.note) && <span className="ml-2 text-sm">{norm(r.note)}</span>}
                </span>
                <span className={`num shrink-0 font-semibold ${num(r.amount) < 0 ? "text-ball" : "text-good"}`}>{baht(r.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && <Button variant="ghost" className="mt-3 w-full" onClick={() => setLimit((l) => l + 60)}>แสดงเพิ่ม ({rows.length - limit} รายการ)</Button>}
      {edit && <FinanceForm item={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); finance.reload(); }} />}
    </>
  );
}

function FinanceForm({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    date: norm(item?.date) || todayIso(),
    kind: norm(item?.kind) || "ลงทุน",
    amount: item ? String(Math.abs(num(item.amount))) : "",
    note: norm(item?.note),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      const body = { ...v, amount: Math.abs(Number(v.amount)) * signOf(v.kind) };
      if (item) await api(`/api/data/Finance/${item._row}`, { method: "PUT", body: JSON.stringify({ ...body, _rev: item._rev }) });
      else await api("/api/data/Finance", { method: "POST", body: JSON.stringify(body) });
      toast("บันทึกแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกไม่ได้", true);
      setBusy(false);
    }
  }
  async function remove() {
    if (!item || !confirm("ลบรายการนี้?")) return;
    setBusy(true);
    try {
      await api(`/api/data/Finance/${item._row}?rev=${encodeURIComponent(item._rev)}`, { method: "DELETE" });
      toast("ลบแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ลบไม่ได้", true);
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? "แก้ไขรายการ" : "เพิ่มรายการ"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่"><TextInput type="date" value={v.date} onChange={(e) => set("date", e.target.value)} required /></Field>
          <Field label="ประเภท">
            <Select value={v.kind} onChange={(e) => set("kind", e.target.value)}>
              {FINANCE_KINDS.map((k) => <option key={k.value}>{k.value}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="จำนวนเงิน (บาท)" hint="กรอกเป็นเลขบวก ระบบใส่เครื่องหมายให้ตามประเภท"><NumInput value={v.amount} onChange={(e) => set("amount", e.target.value)} required /></Field>
        <Field label="หมายเหตุ"><TextInput value={v.note} onChange={(e) => set("note", e.target.value)} /></Field>
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
          {item && <Button variant="danger" disabled={busy} onClick={remove}>ลบ</Button>}
        </div>
      </form>
    </Modal>
  );
}
