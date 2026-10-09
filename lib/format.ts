export const baht = (n: unknown) =>
  "฿" + (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function shortDate(iso: unknown): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso ?? "");
  const y = Number(m[1]);
  const nowY = new Date().getFullYear();
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}${y === nowY ? "" : " " + String((y + 543) % 100).padStart(2, "0")}`;
}
export const todayIso = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
