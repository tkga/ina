"use client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, PageHead } from "@/components/ui";
import { api } from "@/lib/client";
import { SHEET_LABEL, type SheetName } from "@/lib/schema";

interface Preview {
  summary: { sheet: SheetName; current: number; incoming: number | null }[];
  errors: string[];
  warnings: string[];
}
const KEY = "lastBackupAt";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function BackupView() {
  const toast = useToast();
  const [last, setLast] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setLast(localStorage.getItem(KEY)); } catch {}
  }, []);

  const stamp = () => {
    const now = new Date().toISOString();
    try { localStorage.setItem(KEY, now); } catch {}
    setLast(now);
  };
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;

  async function download(format: "xlsx" | "json") {
    setBusy(true);
    try {
      const res = await fetch(`/api/backup?format=${format}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "ดาวน์โหลดไม่ได้");
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `shop-backup.${format}`;
      saveBlob(await res.blob(), name);
      stamp();
      toast("ดาวน์โหลด Backup แล้ว");
    } catch (e) {
      toast(e instanceof Error ? e.message : "ดาวน์โหลดไม่ได้", true);
    }
    setBusy(false);
  }

  async function pick(f: File | null) {
    setFile(f);
    setPreview(null);
    setAgree(false);
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("mode", "preview");
      const p = await api<Preview>("/api/backup", { method: "POST", body: fd });
      setPreview(p);
      setChosen(new Set(p.summary.filter((s) => s.incoming && s.incoming > 0).map((s) => s.sheet)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "อ่านไฟล์ไม่ได้", true);
    }
    setBusy(false);
  }

  async function restore() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      // 1) สำรองข้อมูลปัจจุบันลงเครื่องก่อนเสมอ
      const res = await fetch("/api/backup?format=json");
      if (!res.ok) throw new Error("สำรองข้อมูลปัจจุบันไม่สำเร็จ จึงยังไม่ Restore");
      saveBlob(await res.blob(), `before-restore_${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.json`);
      // 2) เขียนทับ
      const fd = new FormData();
      fd.set("file", file);
      fd.set("mode", "apply");
      fd.set("confirm", "RESTORE");
      fd.set("sheets", [...chosen].join(","));
      const r = await api<{ restored: string[] }>("/api/backup", { method: "POST", body: fd });
      toast(`Restore แล้ว: ${r.restored.map((s) => SHEET_LABEL[s as SheetName]).join(", ")}`);
      setFile(null);
      setPreview(null);
      setAgree(false);
      if (input.current) input.current.value = "";
    } catch (e) {
      toast(e instanceof Error ? e.message : "Restore ไม่สำเร็จ", true);
    }
    setBusy(false);
  }

  const toggle = (s: string) =>
    setChosen((c) => {
      const n = new Set(c);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  const canRestore = !!preview && preview.errors.length === 0 && chosen.size > 0 && agree && !busy;

  return (
    <>
      <PageHead title="Backup / Restore" sub="เก็บสำเนาข้อมูลทั้งหมดเป็นไฟล์ และนำกลับมาใช้เมื่อข้อมูลหาย" />

      <section className="rounded-2xl bg-paper p-5" aria-labelledby="h-bk">
        <h2 id="h-bk" className="text-lg font-semibold">ดาวน์โหลด Backup</h2>
        <p className="mt-1 text-sm text-muted">ได้ไฟล์ที่มีครบทั้ง 5 ชีต ดาวน์โหลดได้ทุกเมื่อ ควรเก็บไว้ในที่อื่นด้วย เช่น Google Drive หรือในเครื่อง</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => download("xlsx")} disabled={busy}>ดาวน์โหลด Excel (.xlsx)</Button>
          <Button variant="ghost" onClick={() => download("json")} disabled={busy}>ดาวน์โหลด .json</Button>
        </div>
        <p className={`mt-3 text-sm ${days === null || days >= 7 ? "text-warn" : "text-muted"}`}>
          {last ? `ดาวน์โหลดล่าสุดจากเครื่องนี้เมื่อ ${days === 0 ? "วันนี้" : `${days} วันที่แล้ว`}` : "เครื่องนี้ยังไม่เคยดาวน์โหลด Backup"}
          {days !== null && days >= 7 ? " — ควรดาวน์โหลดใหม่" : ""}
        </p>
      </section>

      <section className="mt-5 rounded-2xl bg-paper p-5" aria-labelledby="h-rs">
        <h2 id="h-rs" className="text-lg font-semibold">Restore จากไฟล์</h2>
        <p className="mt-1 text-sm text-muted">ใช้ไฟล์ .xlsx หรือ .json ที่ดาวน์โหลดจากหน้านี้ (หรือไฟล์ Excel ของร้านที่มีหัวคอลัมน์ตรงกัน) ระบบจะแสดงตัวอย่างก่อนเขียนทับ และสำรองข้อมูลปัจจุบันลงเครื่องให้อัตโนมัติ</p>
        <div className="mt-3">
          <input ref={input} type="file" accept=".xlsx,.json" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white" aria-label="เลือกไฟล์ Backup" />
        </div>

        {preview && (
          <div className="mt-4 space-y-3">
            {preview.errors.length > 0 && (
              <div role="alert" className="rounded-xl bg-bad-tint px-4 py-3 text-sm text-ball-dark">
                <p className="font-semibold">ไฟล์นี้ Restore ไม่ได้ ยังไม่มีอะไรถูกเขียนทับ</p>
                <ul className="mt-1 list-disc pl-5">{preview.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            {preview.warnings.length > 0 && (
              <div className="rounded-xl bg-warn-tint px-4 py-3 text-sm text-warn">
                <ul className="list-disc pl-5">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="px-3 py-2 font-medium">Restore</th>
                    <th className="px-3 py-2 font-medium">ชีต</th>
                    <th className="px-3 py-2 text-right font-medium">ตอนนี้</th>
                    <th className="px-3 py-2 text-right font-medium">ในไฟล์</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.summary.map((s) => {
                    const has = s.incoming !== null;
                    return (
                      <tr key={s.sheet} className="border-b border-line/60 last:border-0">
                        <td className="px-3 py-2">
                          <input type="checkbox" disabled={!has} checked={chosen.has(s.sheet)} onChange={() => toggle(s.sheet)} aria-label={`Restore ${SHEET_LABEL[s.sheet]}`} className="size-5 accent-[var(--color-ball)]" />
                        </td>
                        <td className="px-3 py-2 font-medium">{SHEET_LABEL[s.sheet]}</td>
                        <td className="num px-3 py-2 text-right">{s.current} แถว</td>
                        <td className={`num px-3 py-2 text-right ${has && s.incoming === 0 && s.current > 0 ? "font-semibold text-ball" : ""}`}>{has ? `${s.incoming} แถว` : "ไม่มีในไฟล์"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.summary.some((s) => chosen.has(s.sheet) && s.incoming === 0 && s.current > 0) && (
              <p className="text-sm font-medium text-ball">ระวัง: ชีตที่เลือกบางชีตว่างในไฟล์ แต่ตอนนี้มีข้อมูล การ Restore จะลบข้อมูลชีตนั้นทั้งหมด</p>
            )}
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-5 accent-[var(--color-ball)]" />
              <span>ฉันเข้าใจว่าข้อมูลปัจจุบันของชีตที่เลือกจะถูกแทนที่ด้วยข้อมูลในไฟล์ (ระบบจะดาวน์โหลดข้อมูลปัจจุบันเก็บไว้ให้ก่อน)</span>
            </label>
            <Button onClick={restore} disabled={!canRestore} className="w-full sm:w-auto">{busy ? "กำลัง Restore…" : "Restore ข้อมูล"}</Button>
          </div>
        )}
      </section>
    </>
  );
}
