"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const styles = {
    primary: "bg-ball text-white hover:bg-ball-dark",
    soft: "bg-ink/8 text-ink hover:bg-ink/14",
    ghost: "border border-line bg-paper text-ink hover:bg-mist",
    danger: "border border-ball/40 bg-paper text-ball hover:bg-bad-tint",
  }[variant];
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper md:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="ปิด" className="grid size-10 place-items-center rounded-full text-2xl leading-none text-muted hover:bg-mist">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] placeholder:text-muted/60 focus:border-ink focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const NumInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input inputMode="decimal" {...p} className={`${inputCls} num ${p.className ?? ""}`} />
);
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ""}`} />;

export function Chip({ tone = "plain", children }: { tone?: "plain" | "good" | "warn" | "bad" | "gold"; children: ReactNode }) {
  const t = {
    plain: "bg-mist text-muted",
    good: "bg-good-tint text-good",
    warn: "bg-warn-tint text-warn",
    bad: "bg-bad-tint text-ball-dark",
    gold: "bg-gold-tint text-gold",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper/60 px-6 py-10 text-center text-muted">
      <p>{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Loading({ error }: { error?: string | null }) {
  if (error)
    return (
      <div className="rounded-2xl bg-bad-tint px-4 py-3 text-sm text-ball-dark" role="alert">
        {error}
      </div>
    );
  return <p className="py-10 text-center text-muted">กำลังโหลด…</p>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
            o.value === value ? "bg-ink text-white" : "bg-paper text-ink hover:bg-white/70 border border-line"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** รูปจาก Drive: ถ้าโหลดไม่ได้ (เช่น ไฟล์ไม่ได้แชร์) ให้แสดงข้อความแทนรูปแตก */
export function Thumb({ src, alt, className = "", empty = "ไม่มีรูป" }: { src: string | null; alt: string; className?: string; empty?: ReactNode }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <span className="grid size-full place-items-center text-xs text-muted">{empty}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={className} />;
}
