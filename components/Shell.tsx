"use client";
import { useEffect, useState, type ReactNode } from "react";
import AccountsView from "./AccountsView";
import BackupView from "./BackupView";
import CustomersView from "./CustomersView";
import FinanceView from "./FinanceView";
import Nav from "./Nav";
import OrdersView from "./OrdersView";
import StockView from "./StockView";
import { ToastProvider } from "./toast";

const VIEWS = ["dashboard", "orders", "stock", "customers", "accounts", "finance", "backup"];

// ทั้งเว็บเป็นหน้าเดียว สลับหน้าด้วย # เช่น #orders หรือ #orders?f=waiting
export default function Shell({ dashboard }: { dashboard: ReactNode }) {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      setHash(window.location.hash.slice(1));
      window.scrollTo(0, 0);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const name = (hash ?? "").split("?")[0];
  const view = VIEWS.includes(name) ? name : "dashboard";

  return (
    <ToastProvider>
      <Nav view={view} />
      <div className="md:pl-56">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {hash === null ? null : (
            <div key={hash}>
              {view === "dashboard" && dashboard}
              {view === "orders" && <OrdersView />}
              {view === "stock" && <StockView />}
              {view === "customers" && <CustomersView />}
              {view === "accounts" && <AccountsView />}
              {view === "finance" && <FinanceView />}
              {view === "backup" && <BackupView />}
            </div>
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
