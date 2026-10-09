"use client";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Empty, Field, Loading, Modal, NumInput, PageHead, TextInput } from "@/components/ui";
import type { Item } from "@/lib/cells";
import { norm, num } from "@/lib/cells";
import { api, useSheet } from "@/lib/client";
import { baht } from "@/lib/format";

export default function AccountsView() {
  const accounts = useSheet("Accounts");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Item | "new" | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (accounts.items ?? []).filter((a) => !needle || norm(a.name).toLowerCase().includes(needle)).sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
  }, [accounts.items, q]);

  const total = (k: string) => (accounts.items ?? []).reduce((s, a) => s + num(a[k]), 0);

  return (
    <>
      <PageHead title="ไอดีเกม" sub="ไอดีที่ใช้เก็บสินค้าของร้าน" action={<Button onClick={() => setEdit("new")}>+ เพิ่มไอดี</Button>} />
      {accounts.items && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-paper p-3"><p className="text-xs text-muted">คงเหลือรวม</p><p className="num text-xl font-semibold">{total("qty")}</p></div>
          <div className="rounded-2xl bg-paper p-3"><p className="text-xs text-muted">ลงทุนสะสม</p><p className="num text-xl font-semibold">{baht(total("invested"))}</p></div>
          <div className="rounded-2xl bg-paper p-3"><p className="text-xs text-muted">รายรับสะสม</p><p className="num text-xl font-semibold">{baht(total("revenue"))}</p></div>
        </div>
      )}
      <div className="mb-3"><TextInput type="search" placeholder="ค้นหาชื่อไอดี" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาไอดี" /></div>
      {!accounts.items ? <Loading error={accounts.error} /> : rows.length === 0 ? <Empty text="ไม่พบไอดี" /> : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a._row}>
              <button onClick={() => setEdit(a)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-paper p-4 text-left hover:bg-white/70">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{norm(a.name)}</span>
                  <span className="block text-sm text-muted">{num(a.skuCount)} ชนิด · คงเหลือ {num(a.qty)} ตัว</span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="num block">ลงทุน {baht(a.invested)}</span>
                  <span className="num block font-semibold text-good">รับ {baht(a.revenue)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && <AccountForm item={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); accounts.reload(); }} />}
    </>
  );
}

function AccountForm({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: norm(item?.name), invested: item ? String(num(item.invested)) : "0", revenue: item ? String(num(item.revenue)) : "0" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      if (item) await api(`/api/data/Accounts/${item._row}`, { method: "PUT", body: JSON.stringify({ ...v, _rev: item._rev }) });
      else await api("/api/data/Accounts", { method: "POST", body: JSON.stringify(v) });
      toast("บันทึกแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกไม่ได้", true);
      setBusy(false);
    }
  }
  async function remove() {
    if (!item || !confirm(`ลบไอดี "${norm(item.name)}"? สินค้าในสต็อกของไอดีนี้จะไม่ถูกลบ`)) return;
    setBusy(true);
    try {
      await api(`/api/data/Accounts/${item._row}?rev=${encodeURIComponent(item._rev)}`, { method: "DELETE" });
      toast("ลบแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ลบไม่ได้", true);
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? "แก้ไขไอดี" : "เพิ่มไอดี"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="ชื่อไอดี" hint={item ? "จำนวนชนิดและคงเหลือคำนวณจากหน้าสต็อกตามชื่อไอดี" : undefined}><TextInput value={v.name} onChange={(e) => set("name", e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ลงทุนสะสม (บาท)"><NumInput value={v.invested} onChange={(e) => set("invested", e.target.value)} /></Field>
          <Field label="รายรับสะสม (บาท)"><NumInput value={v.revenue} onChange={(e) => set("revenue", e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
          {item && <Button variant="danger" disabled={busy} onClick={remove}>ลบ</Button>}
        </div>
      </form>
    </Modal>
  );
}
