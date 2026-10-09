import { NextResponse } from "next/server";
import { COOKIE, cookieOptions, makeToken, passwordOk } from "@/lib/auth";

const fails = new Map<string, { n: number; until: number }>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// เข้าสู่ระบบ
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const f = fails.get(ip);
  if (f && f.until > Date.now()) {
    return NextResponse.json({ error: "ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }
  try {
    const { password } = await req.json();
    if (typeof password === "string" && passwordOk(password)) {
      fails.delete(ip);
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE, makeToken(), cookieOptions);
      return res;
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("ยังไม่ได้ตั้งค่า")) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }
  const n = (f?.n ?? 0) + 1;
  fails.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
  await sleep(700);
  return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
}

// ออกจากระบบ
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
