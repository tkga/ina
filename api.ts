import { NextResponse } from "next/server";
import { isAuthed } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (!(await isAuthed())) throw new HttpError(401, "กรุณาเข้าสู่ระบบ");
      return await fn(...args);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      if (status === 500) console.error(e);
      return NextResponse.json({ error: message }, { status });
    }
  };
}
