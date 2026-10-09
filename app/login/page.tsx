"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, TextInput } from "@/components/ui";
import { api } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth", { method: "POST", body: JSON.stringify({ password: pw }) });
      router.push("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เข้าสู่ระบบไม่ได้");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-paper p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden className="relative inline-block size-9 overflow-hidden rounded-full border-[3px] border-ink bg-white">
            <span className="absolute inset-x-0 top-0 h-1/2 bg-ball" />
            <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-ink" />
            <span className="absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-white" />
          </span>
          <h1 className="text-2xl font-semibold">ร้านโปเกมอน</h1>
        </div>
        <Field label="รหัสผ่าน">
          <TextInput type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {err && (
          <p role="alert" className="mt-3 rounded-xl bg-bad-tint px-3 py-2 text-sm text-ball-dark">
            {err}
          </p>
        )}
        <Button type="submit" className="mt-5 w-full" disabled={busy || !pw}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </Button>
      </form>
    </div>
  );
}
