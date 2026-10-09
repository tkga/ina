"use client";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Chip, Empty, Field, Loading, Modal, NumInput, PageHead, Select, TextInput, Thumb } from "@/components/ui";
import type { Item } from "@/lib/cells";
import { norm, num, thumbUrl } from "@/lib/cells";
import { api, useSheet, hashParams } from "@/lib/client";
import { baht } from "@/lib/format";

type View = "available" | "low" | "all";
const isShiny = (k: unknown) => /shin/i.test(String(k ?? ""));

export default function StockView() {
  const stock = useSheet("Stock");
  const accounts = useSheet("Accounts");
  const toast = useToast();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [view, setView] = useState<View>("available");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [limit, setLimit] = useState(48);

  useEffect(() => {
    setQ(hashParams().get("q") ?? "");
  }, []);

  const kinds = useMemo(() => [...new Set((stock.items ?? []).map((s) => norm(s.kind)).filter(Boolean))].sort(), [stock.items]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (stock.items ?? [])
      .filter((s) => {
        if (needle && !`${s.pokemon} ${s.account} ${s.kind} ${s.code}`.toLowerCase().includes(needle)) return false;
        if (kind && norm(s.kind) !== kind) return false;
        const n = num(s.qty);
        if (view === "available") return n > 0;
        if (view === "low") return n > 0 && n <= num(s.alertAt || 2);
        return true;
      })
      .sort((a, b) => norm(a.pokemon).localeCompare(norm(b.pokemon), "th") || norm(a.kind).localeCompare(norm(b.kind)) || num(b.price) - num(a.price));
  }, [stock.items, q, kind, view]);

  const totalQty = (stock.items ?? []).reduce((s, x) => s + num(x.qty), 0);

  async function bump(s: Item, d: number) {
    const next = Math.max(0, num(s.qty) + d);
    setBusyRow(s._row);
    try {
      await api(`/api/data/Stock/${s._row}`, { method: "PUT", body: JSON.stringify({ qty: next, _rev: s._rev }) });
      await stock.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกไม่ได้", true);
      await stock.reload();
    }
    setBusyRow(null);
  }

  return (
    <>
      <PageHead title="สต็อก" sub={stock.items ? `${stock.items.length} รายการ · คงเหลือรวม ${totalQty} ตัว` : undefined} action={<Button onClick={() => setEdit("new")}>+ เพิ่มสินค้า</Button>} />
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_11rem_11rem]">
        <TextInput type="search" placeholder="ค้นหาชื่อโปเกมอน ไอดี หรือรหัสสินค้า" value={q} onChange={(e) => { setQ(e.target.value); setLimit(48); }} aria-label="ค้นหาสินค้า" />
        <Select value={kind} onChange={(e) => { setKind(e.target.value); setLimit(48); }} aria-label="กรองตามชนิด">
          <option value="">ทุกชนิด</option>
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
        <Select value={view} onChange={(e) => { setView(e.target.value as View); setLimit(48); }} aria-label="กรองตามจำนวน">
          <option value="available">เฉพาะที่มีของ</option>
          <option value="low">ใกล้หมด</option>
          <option value="all">รวมที่หมดแล้ว</option>
        </Select>
      </div>

      {!stock.items ? (
        <Loading error={stock.error} />
      ) : rows.length === 0 ? (
        <Empty text="ไม่พบสินค้าที่ตรงกับตัวกรอง" action={<Button variant="ghost" onClick={() => { setQ(""); setKind(""); setView("all"); }}>ล้างตัวกรอง</Button>} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {rows.slice(0, limit).map((s) => {
              const n = num(s.qty);
              const low = n > 0 && n <= num(s.alertAt || 2);
              const img = thumbUrl(s.imageUrl, 400);
              const shiny = isShiny(s.kind);
              return (
                <li key={s._row} className={`flex flex-col overflow-hidden rounded-2xl bg-paper ${shiny ? "ring-2 ring-gold/60" : ""} ${n === 0 ? "opacity-60" : ""}`}>
                  <button onClick={() => setEdit(s)} className="block text-left" aria-label={`แก้ไข ${norm(s.pokemon)}`}>
                    <span className={`grid aspect-square place-items-center ${shiny ? "bg-gold-tint" : "bg-mist"}`}>
                      <Thumb src={img} alt={norm(s.pokemon)} className="size-full object-contain p-2" />
                    </span>
                    <span className="block px-3 pt-2">
                      <span className="block truncate font-semibold">{norm(s.pokemon)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {s.kind ? <Chip tone={shiny ? "gold" : "plain"}>{norm(s.kind)}</Chip> : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">{norm(s.account)}</span>
                    </span>
                  </button>
                  <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-3 pt-2">
                    <span className="num text-base font-semibold">{baht(s.price)}</span>
                    <span className="flex items-center gap-1">
                      <button disabled={busyRow === s._row || n === 0} onClick={() => bump(s, -1)} aria-label="ลดจำนวน" className="grid size-9 place-items-center rounded-full bg-mist text-lg font-semibold disabled:opacity-40">−</button>
                      <span className={`num min-w-6 text-center font-semibold ${n === 0 ? "text-ball" : low ? "text-warn" : ""}`} aria-label={`คงเหลือ ${n}`}>{n}</span>
                      <button disabled={busyRow === s._row} onClick={() => bump(s, 1)} aria-label="เพิ่มจำนวน" className="grid size-9 place-items-center rounded-full bg-mist text-lg font-semibold disabled:opacity-40">+</button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > limit && (
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setLimit((l) => l + 48)}>แสดงเพิ่ม ({rows.length - limit} รายการ)</Button>
          )}
        </>
      )}

      {edit && (
        <StockForm
          item={edit === "new" ? null : edit}
          accounts={accounts.items ?? []}
          kinds={kinds}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); stock.reload(); }}
        />
      )}
    </>
  );
}

function StockForm({ item, accounts, kinds, onClose, onSaved }: { item: Item | null; accounts: Item[]; kinds: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    account: norm(item?.account),
    pokemon: norm(item?.pokemon),
    kind: norm(item?.kind),
    qty: item ? String(num(item.qty)) : "1",
    alertAt: item ? String(num(item.alertAt)) : "2",
    price: item ? String(num(item.price)) : "",
    imageUrl: norm(item?.imageUrl),
    code: norm(item?.code),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      if (item) await api(`/api/data/Stock/${item._row}`, { method: "PUT", body: JSON.stringify({ ...v, _rev: item._rev }) });
      else await api("/api/data/Stock", { method: "POST", body: JSON.stringify(v) });
      toast("บันทึกแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกไม่ได้", true);
      setBusy(false);
    }
  }
  async function remove() {
    if (!item || !confirm(`ลบ "${norm(item.pokemon)}" ออกจากสต็อก? (ย้อนกลับไม่ได้ ถ้าไม่แน่ใจให้ตั้งจำนวนเป็น 0 แทน)`)) return;
    setBusy(true);
    try {
      await api(`/api/data/Stock/${item._row}?rev=${encodeURIComponent(item._rev)}`, { method: "DELETE" });
      toast("ลบแล้ว");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ลบไม่ได้", true);
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? "แก้ไขสินค้า" : "เพิ่มสินค้า"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="ชื่อไอดีที่เก็บสินค้า">
          <TextInput list="acc-list" value={v.account} onChange={(e) => set("account", e.target.value)} required autoComplete="off" />
          <datalist id="acc-list">{accounts.map((a) => <option key={a._row} value={norm(a.name)} />)}</datalist>
        </Field>
        <Field label="ชื่อสินค้า (Pokémon)"><TextInput value={v.pokemon} onChange={(e) => set("pokemon", e.target.value)} required /></Field>
        <Field label="ชนิด">
          <TextInput list="kind-list" value={v.kind} onChange={(e) => set("kind", e.target.value)} placeholder="เช่น Shiny, กิกะแมกซ์" autoComplete="off" />
          <datalist id="kind-list">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="คงเหลือ"><NumInput value={v.qty} onChange={(e) => set("qty", e.target.value)} /></Field>
          <Field label="เตือนเมื่อ ≤"><NumInput value={v.alertAt} onChange={(e) => set("alertAt", e.target.value)} /></Field>
          <Field label="ราคา/ตัว"><NumInput value={v.price} onChange={(e) => set("price", e.target.value)} /></Field>
        </div>
        <Field label="ลิงก์รูปจาก Google Drive" hint="วางลิงก์ไฟล์รูปที่แชร์เป็น “ทุกคนที่มีลิงก์” ระบบสร้างรูปตัวอย่างให้เอง">
          <TextInput value={v.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://drive.google.com/file/d/…" />
        </Field>
        <Field label="รหัสสินค้า" hint={item ? undefined : "เว้นว่างได้ ระบบใช้รหัสเดิมของสินค้านี้หรือออกรหัสใหม่ให้"}>
          <TextInput value={v.code} onChange={(e) => set("code", e.target.value)} />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
          {item && <Button variant="danger" disabled={busy} onClick={remove}>ลบ</Button>}
        </div>
      </form>
    </Modal>
  );
}
