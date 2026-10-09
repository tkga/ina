import { Chip, PageHead, Thumb } from "@/components/ui";
import { norm, num, thumbUrl } from "@/lib/cells";
import { baht, shortDate } from "@/lib/format";
import { ORDER_TYPES } from "@/lib/schema";
import { listItems } from "@/lib/service";
import { isLow, monthly } from "@/lib/stats";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const typeLabel = (v: string) => ORDER_TYPES.find((t) => t.value === v)?.label ?? v;

export default async function Dashboard() {
  const store = await getStore();
  let data;
  try {
    const [orders, stock, finance] = await Promise.all([listItems("Orders", store), listItems("Stock", store), listItems("Finance", store)]);
    data = { orders, stock, finance };
  } catch (e) {
    return (
      <>
        <PageHead title="ภาพรวม" />
        <div role="alert" className="rounded-2xl bg-bad-tint px-4 py-3 text-ball-dark">
          เชื่อมต่อข้อมูลไม่ได้: {e instanceof Error ? e.message : "ไม่ทราบสาเหตุ"}
        </div>
      </>
    );
  }
  const { orders, stock, finance } = data;
  const live = orders.filter((o) => !o.cancelled);
  const waiting = live.filter((o) => o.jobStatus === "waiting").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const unpaid = live.filter((o) => num(o.paid) < num(o.price));
  const owed = unpaid.reduce((s, o) => s + (num(o.price) - num(o.paid)), 0);
  const low = stock.filter(isLow);
  const soldOut = stock.filter((s) => num(s.qty) <= 0).length;
  const months = monthly(orders, finance);
  const nowKey = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
  const cur = months.find((m) => m.month === nowKey);
  const recent = months.slice(0, 6);
  const maxAbs = Math.max(1, ...recent.map((m) => Math.abs(m.profit)));

  return (
    <>
      <PageHead title="ภาพรวม" sub={`เดือน${monthLabel(nowKey)}`} />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="สรุปเดือนนี้">
        <div className="rounded-2xl bg-ink p-5 text-white">
          <p className="text-sm text-white/70">กำไรเดือนนี้</p>
          <p className="num mt-1 text-4xl font-semibold">{baht(cur?.profit ?? 0)}</p>
          <p className="mt-1 text-xs text-white/60">รายรับ {baht((cur?.sales ?? 0) + (cur?.otherIncome ?? 0))} − ลงทุน/รายจ่าย {baht((cur?.invest ?? 0) + (cur?.expense ?? 0))}</p>
        </div>
        <a href="#orders?f=waiting" className="rounded-2xl bg-paper p-5 hover:bg-white/70">
          <p className="text-sm text-muted">งานรอดำเนินการ</p>
          <p className="num mt-1 text-4xl font-semibold">{waiting.length}</p>
          <p className="mt-1 text-xs text-muted">ออเดอร์ที่ยังไม่ส่งมอบ</p>
        </a>
        <a href="#orders?f=unpaid" className="rounded-2xl bg-paper p-5 hover:bg-white/70">
          <p className="text-sm text-muted">ค้างชำระ</p>
          <p className="num mt-1 text-4xl font-semibold">{baht(owed)}</p>
          <p className="mt-1 text-xs text-muted">{unpaid.length} ออเดอร์</p>
        </a>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="h-wait">
          <h2 id="h-wait" className="mb-2 text-lg font-semibold">งานที่ต้องทำ</h2>
          {waiting.length === 0 ? (
            <p className="rounded-2xl bg-paper px-4 py-6 text-center text-muted">ไม่มีงานค้าง</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-paper">
              {waiting.slice(0, 8).map((o) => (
                <li key={o._row}>
                  <a href={`#orders?q=${encodeURIComponent(norm(o.orderNo))}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mist">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{norm(o.customer)}</span>
                      <span className="block truncate text-sm text-muted">
                        {typeLabel(norm(o.type))} · {norm(o.detail)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm text-muted">{shortDate(o.date)}</span>
                  </a>
                </li>
              ))}
              {waiting.length > 8 && (
                <li>
                  <a href="#orders?f=waiting" className="block px-4 py-3 text-center text-sm font-medium text-ball hover:bg-mist">
                    ดูทั้งหมด {waiting.length} รายการ
                  </a>
                </li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="h-low">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="h-low" className="text-lg font-semibold">สต็อกใกล้หมด</h2>
            <span className="text-sm text-muted">หมดแล้ว {soldOut} รายการ</span>
          </div>
          {low.length === 0 ? (
            <p className="rounded-2xl bg-paper px-4 py-6 text-center text-muted">ยังไม่มีสินค้าใกล้หมด</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-paper">
              {low.slice(0, 8).map((s) => (
                <li key={s._row}>
                  <a href={`#stock?q=${encodeURIComponent(norm(s.pokemon))}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mist">
                    <span className="block size-10 shrink-0 overflow-hidden rounded-lg bg-mist"><Thumb src={thumbUrl(s.imageUrl, 160)} alt="" className="size-full object-contain" empty="" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{norm(s.pokemon)}</span>
                      <span className="block truncate text-sm text-muted">{norm(s.account)}</span>
                    </span>
                    <Chip tone="warn">เหลือ {num(s.qty)}</Chip>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6" aria-labelledby="h-month">
        <h2 id="h-month" className="mb-2 text-lg font-semibold">กำไรรายเดือน</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-paper px-4 py-6 text-center text-muted">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-paper">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">เดือน</th>
                  <th className="px-2 py-2.5 text-right font-medium">รายรับ</th>
                  <th className="px-2 py-2.5 text-right font-medium">ลงทุน</th>
                  <th className="px-2 py-2.5 text-right font-medium">รายจ่าย</th>
                  <th className="px-4 py-2.5 font-medium">กำไร</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.month} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{monthLabel(m.month)}</td>
                    <td className="num px-2 py-2.5 text-right">{baht(m.sales + m.otherIncome)}</td>
                    <td className="num px-2 py-2.5 text-right">{baht(m.invest)}</td>
                    <td className="num px-2 py-2.5 text-right">{baht(m.expense)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`num w-20 shrink-0 text-right font-semibold ${m.profit < 0 ? "text-ball" : "text-good"}`}>{baht(m.profit)}</span>
                        <span aria-hidden className="h-2 rounded-full" style={{ width: `${Math.max(3, (Math.abs(m.profit) / maxAbs) * 100)}px`, background: m.profit < 0 ? "var(--color-ball)" : "var(--color-good)" }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">รายรับนับจากยอดที่ชำระแล้วของออเดอร์ที่ไม่ยกเลิก ส่วนลงทุนและรายจ่ายมาจากหน้าการเงิน</p>
      </section>
    </>
  );
}
