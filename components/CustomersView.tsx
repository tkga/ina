"use client";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Empty, Field, Loading, Modal, PageHead, TextInput } from "@/components/ui";
import type { Item } from "@/lib/cells";
import { norm, num } from "@/lib/cells";
import { api, useSheet } from "@/lib/client";
import { baht } from "@/lib/format";

export default function CustomersView() {
  const customers = useSheet("Customers");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [limit, setLimit] = useState(40);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (customers.items ?? [])
      .filter((c) => !needle || `${c.name} ${c.gameIds} ${c.note}`.toLowerCase().includes(needle))
      .sort((a, b) => num(b.spend) - num(a.spend) || norm(a.name).localeCompare(norm(b.name), "th"));
  }, [customers.items, q]);

  return (
    <>
      <PageHead title="ลูกค้า" sub={customers.items ? `${customers.items.length} คน เรียงตามยอดใช้จ่าย` : undefined} action={<Button onClick={() => setEdit("new")}>+ เพิ่มลูกค้า</Button>} />
      <div className="mb-3">
        <TextInput type="search" placeholder="ค้นหาชื่อ ไอดีเกม หรือหมายเหตุ" value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }} aria-label="ค้นหาลูกค้า" />
      </div>
      {!customers.items ? (
        <Loading error={customers.error} />
      ) : rows.length === 0 ? (
        <Empty text={q ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีลูกค้า"} />
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, limit).map((c) => (
            <li key={c._row} className="flex items-stretch overflow-hidden rounded-2xl bg-paper">
              <button onClick={() => setEdit(c)} className="min-w-0 flex-1 p-4 text-left hover:bg-white/70">
                <span className="block truncate font-semibold">{norm(c.name)}</span>
                <span className="block truncate text-sm text-muted">{norm(c.gameIds) || "ยังไม่มีไอดีเกม"}</span>
                {norm(c.note) && <span className="mt-1 block text-sm">{norm(c.note)}</span>}
              </button>
              <div className="flex shrink-0 flex-col items-end justify-between p-4 text-right">
                <span className="num text-lg font-semibold">{baht(c.spend)}</span>
                {/^https?:\/\//.test(norm(c.facebook)) && (
                  <a href={norm(c.facebook)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ball underline-offset-2 hover:underline">
                    Facebook
                  </a>
                )}
              </div>
            </li>
          ))}
          {rows.length > limit && <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + 40)}>แสดงเพิ่ม ({rows.length - limit} คน)</Button>}
        </ul>
      )}
      {edit && <CustomerForm item={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); customers.reload(); }} />}
    </>
  );
}

function CustomerForm({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: norm(item?.name), gameIds: norm(item?.gameIds), facebook: norm(item?.facebook), note: norm(item?.note) });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      if (item) await api(`/api/data/Customers/${item._row}`, { method: "PUT", body: JSON.stringify({ ...v, _rev: item._rev }) });
      else await api("/api/data/Customers", { method: "POST", body: JSON.stringify(v) });
      toast("บันทึกแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกไม่ได้", true);
      setBusy(false);
    }
  }
  async function remove() {
    if (!item || !confirm(`ลบลูกค้า "${norm(item.name)}"? ออเดอร์เดิมยังอยู่ แต่จะไม่มีรายชื่อในหน้านี้`)) return;
    setBusy(true);
    try {
      await api(`/api/data/Customers/${item._row}?rev=${encodeURIComponent(item._rev)}`, { method: "DELETE" });
      toast("ลบแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ลบไม่ได้", true);
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="ชื่อในเกม" hint={item ? "ยอดสะสมนับจากชื่อในออเดอร์ ถ้าเปลี่ยนชื่อ ยอดจะเริ่มนับใหม่" : undefined}>
          <TextInput value={v.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="ไอดีในเกมทั้งหมด" hint="คั่นด้วยเครื่องหมายจุลภาค เช่น ID1, ID2"><TextInput value={v.gameIds} onChange={(e) => set("gameIds", e.target.value)} /></Field>
        <Field label="ลิงก์ Facebook"><TextInput type="url" value={v.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="https://www.facebook.com/…" /></Field>
        <Field label="หมายเหตุ"><TextInput value={v.note} onChange={(e) => set("note", e.target.value)} /></Field>
        {item && <p className="rounded-xl bg-mist px-3 py-2 text-sm">ยอดใช้จ่ายสะสม <b className="num">{baht(item.spend)}</b> (คำนวณจากออเดอร์ที่ชำระแล้ว ไม่รวมที่ยกเลิก)</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
          {item && <Button variant="danger" disabled={busy} onClick={remove}>ลบ</Button>}
        </div>
      </form>
    </Modal>
  );
}
