import { NextResponse } from "next/server";
import { HttpError, handler } from "@/lib/api";
import { exportAll, parseBackup, toXlsx } from "@/lib/backup";
import { SHEET_NAMES, isSheet, type SheetName } from "@/lib/schema";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

// ดาวน์โหลด Backup: /api/backup?format=xlsx หรือ json
export const GET = handler(async (req: Request) => {
  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "xlsx";
  const data = await exportAll(await getStore());
  const stamp = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const headers = {
    "Content-Disposition": `attachment; filename="shop-backup_${stamp}.${format}"`,
    "Cache-Control": "no-store",
  };
  if (format === "json") {
    return new Response(JSON.stringify(data), { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  }
  const buf = await toXlsx(data);
  return new Response(new Uint8Array(buf), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
});

// Restore: mode=preview ตรวจไฟล์และเทียบจำนวนแถว (ยังไม่เขียนอะไร)
//          mode=apply   เขียนทับชีตที่เลือก (ต้องส่ง confirm=RESTORE)
export const POST = handler(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "preview");
  if (!(file instanceof File)) throw new HttpError(400, "กรุณาเลือกไฟล์ Backup");
  if (file.size > MAX_BYTES) throw new HttpError(400, "ไฟล์ใหญ่เกิน 8 MB");

  const parsed = await parseBackup(Buffer.from(await file.arrayBuffer()), file.name);
  const store = await getStore();

  const summary = [];
  for (const n of SHEET_NAMES) {
    summary.push({ sheet: n, current: (await store.readAll(n)).length, incoming: parsed.sheets[n] ? parsed.sheets[n]!.length : null });
  }

  if (mode === "preview") {
    return NextResponse.json({ summary, errors: parsed.errors, warnings: parsed.warnings });
  }

  if (parsed.errors.length) throw new HttpError(400, "ไฟล์มีข้อผิดพลาด ยังไม่ได้เขียนอะไรลงชีต: " + parsed.errors[0]);
  if (form.get("confirm") !== "RESTORE") throw new HttpError(400, "ต้องยืนยันก่อน Restore");
  const chosen = String(form.get("sheets") ?? "")
    .split(",")
    .filter((s): s is SheetName => isSheet(s) && !!parsed.sheets[s]);
  if (!chosen.length) throw new HttpError(400, "ไม่ได้เลือกชีตที่จะ Restore");

  for (const n of chosen) await store.replaceAll(n, parsed.sheets[n]!);
  return NextResponse.json({ ok: true, restored: chosen });
});
