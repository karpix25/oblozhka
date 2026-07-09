import { useEffect, useState } from "react";
import { adminApi, saveToken } from "./api.js";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard.js";
import { GenerationsTable } from "./components/GenerationsTable.js";
import { PackagesTable } from "./components/PackagesTable.js";
import { PaymentsTable } from "./components/PaymentsTable.js";
import { PresetsTable } from "./components/PresetsTable.js";
import { UsersTable } from "./components/UsersTable.js";
import type { AdminAnalyticsSummary, CreditPackage, Generation, Payment, PromptPreset, User } from "./types.js";

type Tab = "analytics" | "users" | "packages" | "payments" | "generations" | "presets";

const TABS: Tab[] = ["analytics", "users", "packages", "payments", "generations", "presets"];

export function App() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary>();
  const [users, setUsers] = useState<User[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [nextAnalytics, nextUsers, nextPackages, nextPayments, nextGenerations, nextPresets] = await Promise.all([
        adminApi.analytics(),
        adminApi.users(),
        adminApi.packages(),
        adminApi.payments(),
        adminApi.generations(),
        adminApi.presets()
      ]);
      setAnalytics(nextAnalytics);
      setUsers(nextUsers);
      setPackages(nextPackages);
      setPayments(nextPayments);
      setGenerations(nextGenerations);
      setPresets(nextPresets);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка загрузки");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Cover Bot Admin</h1>
        <div className="actions">
          <button onClick={() => saveToken(prompt("Admin token") ?? "")}>Token</button>
          <button onClick={load}>Refresh</button>
        </div>
      </header>
      <nav className="tabs">
        {TABS.map((name) => (
          <button className={tab === name ? "active" : ""} onClick={() => setTab(name)} key={name}>
            {name}
          </button>
        ))}
      </nav>
      {error && <p className="error">{error}</p>}
      {tab === "analytics" && <AnalyticsDashboard summary={analytics} />}
      {tab === "users" && <UsersTable users={users} onChanged={load} />}
      {tab === "packages" && <PackagesTable packages={packages} onChanged={load} />}
      {tab === "payments" && <PaymentsTable payments={payments} />}
      {tab === "generations" && <GenerationsTable generations={generations} />}
      {tab === "presets" && <PresetsTable presets={presets} onChanged={load} />}
    </main>
  );
}
