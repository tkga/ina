"use client";
import { useCallback, useEffect, useState } from "react";
import type { Item } from "./cells";

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("กรุณาเข้าสู่ระบบ");
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  return j as T;
}

export function useSheet(sheet: string) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const r = await api<{ items: Item[] }>(`/api/data/${sheet}`);
      setItems(r.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่ได้");
    }
  }, [sheet]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { items, error, reload };
}

/** พารามิเตอร์หลัง # เช่น #orders?f=waiting */
export function hashParams(): URLSearchParams {
  const h = window.location.hash.slice(1);
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}
