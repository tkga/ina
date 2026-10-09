"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

function Icon({ name }: { name: string }) {
  const d: Record<string, string> = {
    home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
    more: "M5 12h.01M12 12h.01M19 12h.01",
  };
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[name]} />
    </svg>
  );
}

export const MAIN = [
  { href: "dashboard", label: "ภาพรวม", icon: "home" },
  { href: "orders", label: "ออเดอร์", icon: "list" },
  { href: "stock", label: "สต็อก", icon: "grid" },
  { href: "customers", label: "ลูกค้า", icon: "user" },
];
export const MORE = [
  { href: "accounts", label: "ไอดีเกม" },
  { href: "finance", label: "การเงิน" },
  { href: "backup", label: "Backup / Restore" },
];

function Ball() {
  return (
    <span aria-hidden className="relative inline-block size-7 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-white">
      <span className="absolute inset-x-0 top-0 h-1/2 bg-ball" />
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-ink" />
      <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-white" />
    </span>
  );
}

export default function Nav({ view }: { view: string }) {
  const router = useRouter();
  const [more, setMore] = useState(false);
  const active = (h: string) => view === h;
  const moreActive = MORE.some((m) => active(m.href));

  async function logout() {
    await api("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  const link = (h: string, label: string, icon?: string) => (
    <a
      key={h}
      href={`#${h}`}
      onClick={() => setMore(false)}
      aria-current={active(h) ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${
        active(h) ? "bg-ink text-white" : "text-ink hover:bg-ink/8"
      }`}
    >
      {icon && <Icon name={icon} />}
      {label}
    </a>
  );

  return (
    <>
      {/* คอมพิวเตอร์: แถบเมนูซ้าย */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-paper p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <Ball />
          <span className="font-display text-lg font-semibold">ร้านโปเกมอน</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="เมนูหลัก">
          {MAIN.map((m) => link(m.href, m.label, m.icon))}
          <div className="my-2 h-px bg-line" />
          {MORE.map((m) => link(m.href, m.label))}
        </nav>
        <button onClick={logout} className="mt-auto min-h-11 rounded-xl px-3 text-left text-sm text-muted hover:bg-ink/8">
          ออกจากระบบ
        </button>
      </aside>

      {/* มือถือ: แถบเมนูล่าง */}
      <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        {MAIN.map((m) => (
          <a
            key={m.href}
            href={`#${m.href}`}
            aria-current={active(m.href) ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active(m.href) ? "text-ball" : "text-muted"}`}
          >
            <Icon name={m.icon} />
            {m.label}
          </a>
        ))}
        <button
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${moreActive || more ? "text-ball" : "text-muted"}`}
        >
          <Icon name="more" />
          เพิ่มเติม
        </button>
        {more && (
          <div className="sheet-in absolute inset-x-3 bottom-[calc(100%+8px)] rounded-2xl border border-line bg-paper p-2 shadow-xl">
            {MORE.map((m) => link(m.href, m.label))}
            <button onClick={logout} className="min-h-11 w-full rounded-xl px-3 text-left text-sm text-muted hover:bg-ink/8">
              ออกจากระบบ
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
