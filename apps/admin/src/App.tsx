import { useEffect, useState } from "react";
import { adminApi, saveToken } from "./api.js";
import type { CreditPackage, Generation, Payment, PromptPreset, User } from "./types.js";

type Tab = "users" | "packages" | "payments" | "generations" | "presets";

export function App() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [nextUsers, nextPackages, nextPayments, nextGenerations, nextPresets] = await Promise.all([
        adminApi.users(),
        adminApi.packages(),
        adminApi.payments(),
        adminApi.generations(),
        adminApi.presets()
      ]);
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
        {(["users", "packages", "payments", "generations", "presets"] as Tab[]).map((name) => (
          <button className={tab === name ? "active" : ""} onClick={() => setTab(name)} key={name}>
            {name}
          </button>
        ))}
      </nav>
      {error && <p className="error">{error}</p>}
      {tab === "users" && <UsersTable users={users} onChanged={load} />}
      {tab === "packages" && <PackagesTable packages={packages} onChanged={load} />}
      {tab === "payments" && <PaymentsTable payments={payments} />}
      {tab === "generations" && <GenerationsTable generations={generations} />}
      {tab === "presets" && <PresetsTable presets={presets} onChanged={load} />}
    </main>
  );
}

function UsersTable({ users, onChanged }: { users: User[]; onChanged: () => void }) {
  async function adjust(user: User) {
    const amount = Number(prompt("Credit adjustment"));
    if (!Number.isInteger(amount) || amount === 0) return;
    await adminApi.adjustCredits(user.id, amount, "manual admin adjustment");
    onChanged();
  }

  return (
    <table>
      <thead><tr><th>User</th><th>Status</th><th>Balance</th><th>Created</th><th /></tr></thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.username ? `@${user.username}` : user.firstName ?? user.telegramId}</td>
            <td>{user.status}</td>
            <td>{user.balance}</td>
            <td>{new Date(user.createdAt).toLocaleString("ru-RU")}</td>
            <td><button onClick={() => adjust(user)}>Credits</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PackagesTable({ packages, onChanged }: { packages: CreditPackage[]; onChanged: () => void }) {
  async function create() {
    const title = prompt("Package title");
    const starsPrice = Number(prompt("Stars price"));
    const credits = Number(prompt("Credits"));
    if (!title || !Number.isInteger(starsPrice) || !Number.isInteger(credits)) return;
    await adminApi.createPackage({ title, starsPrice, credits });
    onChanged();
  }

  return (
    <>
      <button className="primary" onClick={create}>New package</button>
      <table>
        <thead><tr><th>Title</th><th>Stars</th><th>Credits</th><th>Active</th><th /></tr></thead>
        <tbody>
          {packages.map((pack) => (
            <tr key={pack.id}>
              <td>{pack.title}</td>
              <td>{pack.starsPrice}</td>
              <td>{pack.credits}</td>
              <td>{pack.isActive ? "yes" : "no"}</td>
              <td>
                <button onClick={() => adminApi.updatePackage(pack.id, { isActive: !pack.isActive }).then(onChanged)}>
                  Toggle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PaymentsTable({ payments }: { payments: Payment[] }) {
  return <table><thead><tr><th>User</th><th>Status</th><th>Stars</th><th>Credits</th><th>Charge</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.user?.username ?? payment.user?.telegramId}</td><td>{payment.status}</td><td>{payment.starsAmount}</td><td>{payment.creditsGranted}</td><td>{payment.telegramPaymentChargeId}</td></tr>)}</tbody></table>;
}

function GenerationsTable({ generations }: { generations: Generation[] }) {
  return <table><thead><tr><th>User</th><th>Status</th><th>Format</th><th>Topic</th><th>Error</th></tr></thead><tbody>{generations.map((item) => <tr key={item.id}><td>{item.user?.username ?? item.user?.telegramId}</td><td>{item.status}</td><td>{item.format}</td><td>{item.topic}</td><td>{item.errorMessage}</td></tr>)}</tbody></table>;
}

function PresetsTable({ presets, onChanged }: { presets: PromptPreset[]; onChanged: () => void }) {
  async function create() {
    const title = prompt("Preset title");
    const slug = prompt("Preset slug");
    const niche = prompt("Niche");
    const style = prompt("Style");
    const promptTemplate = prompt("Prompt template");
    if (!title || !slug || !niche || !style || !promptTemplate) return;
    await adminApi.createPreset({ title, slug, niche, style, promptTemplate });
    onChanged();
  }

  return (
    <>
      <button className="primary" onClick={create}>New preset</button>
      <table>
        <thead><tr><th>Title</th><th>Niche</th><th>Style</th><th>Active</th><th /></tr></thead>
        <tbody>{presets.map((preset) => <tr key={preset.id}><td>{preset.title}</td><td>{preset.niche}</td><td>{preset.style}</td><td>{preset.isActive ? "yes" : "no"}</td><td><button onClick={() => adminApi.updatePreset(preset.id, { isActive: !preset.isActive }).then(onChanged)}>Toggle</button></td></tr>)}</tbody>
      </table>
    </>
  );
}
