import crypto from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "shop_session";
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("ยังไม่ได้ตั้งค่า SESSION_SECRET (อย่างน้อย 16 ตัวอักษร)");
  return s;
}
const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

export function makeToken(): string {
  const exp = String(Date.now() + MAX_AGE_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(t: string | undefined): boolean {
  if (!t) return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}

export function passwordOk(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("ยังไม่ได้ตั้งค่า APP_PASSWORD");
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthed(): Promise<boolean> {
  try {
    const c = await cookies();
    return verifyToken(c.get(COOKIE)?.value);
  } catch {
    return false;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_MS / 1000,
};
