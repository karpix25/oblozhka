import { useEffect, useState } from "react";
import { adminApi } from "../api.js";
import type { CreditPackage } from "../types.js";

type PackagesTableProps = {
  packages: CreditPackage[];
  onChanged: () => void;
};

type PackageDraft = {
  title: string;
  description: string;
  priceRub: string;
  credits: string;
};

export function PackagesTable({ packages, onChanged }: PackagesTableProps) {
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({});
  const [savingId, setSavingId] = useState<string>();

  useEffect(() => {
    setDrafts(Object.fromEntries(packages.map((pack) => [pack.id, draftFromPackage(pack)])));
  }, [packages]);

  async function create() {
    const title = prompt("Tariff title");
    const priceRub = Number(prompt("Price, RUB"));
    const credits = Number(prompt("Monthly credits, 0 for unlimited"));
    const plan = prompt("Plan code: START, PRO, BUSINESS") as CreditPackage["plan"];
    if (!title || !Number.isInteger(priceRub) || !Number.isInteger(credits)) return;
    await adminApi.createPackage({ title, priceRub, credits, plan: plan || undefined, slug: plan?.toLowerCase() });
    onChanged();
  }

  async function save(pack: CreditPackage) {
    const draft = drafts[pack.id];
    if (!draft) return;

    const priceRub = Number(draft.priceRub);
    const credits = Number(draft.credits);
    if (!draft.title.trim() || !Number.isInteger(priceRub) || !Number.isInteger(credits)) return;

    setSavingId(pack.id);
    try {
      await adminApi.updatePackage(pack.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        priceRub,
        credits
      });
      onChanged();
    } finally {
      setSavingId(undefined);
    }
  }

  function updateDraft(id: string, patch: Partial<PackageDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch }
    }));
  }

  return (
    <>
      <button className="primary" onClick={create}>New tariff</button>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Plan</th>
            <th>RUB</th>
            <th>Credits/mo</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {packages.map((pack) => (
            <PackageRow
              draft={drafts[pack.id] ?? draftFromPackage(pack)}
              isSaving={savingId === pack.id}
              key={pack.id}
              pack={pack}
              onSave={save}
              onToggle={() => adminApi.updatePackage(pack.id, { isActive: !pack.isActive }).then(onChanged)}
              onUpdate={updateDraft}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

function PackageRow({
  draft,
  isSaving,
  pack,
  onSave,
  onToggle,
  onUpdate
}: {
  draft: PackageDraft;
  isSaving: boolean;
  pack: CreditPackage;
  onSave: (pack: CreditPackage) => void;
  onToggle: () => void;
  onUpdate: (id: string, patch: Partial<PackageDraft>) => void;
}) {
  return (
    <tr>
      <td>
        <input value={draft.title} onChange={(event) => onUpdate(pack.id, { title: event.target.value })} />
      </td>
      <td>
        <input
          value={draft.description}
          onChange={(event) => onUpdate(pack.id, { description: event.target.value })}
        />
      </td>
      <td>{pack.plan ?? "legacy"}</td>
      <td>
        <input
          inputMode="numeric"
          value={draft.priceRub}
          onChange={(event) => onUpdate(pack.id, { priceRub: event.target.value })}
        />
      </td>
      <td>
        <input
          inputMode="numeric"
          value={draft.credits}
          onChange={(event) => onUpdate(pack.id, { credits: event.target.value })}
        />
      </td>
      <td>{pack.isActive ? "yes" : "no"}</td>
      <td className="row-actions">
        <button onClick={() => onSave(pack)} disabled={isSaving}>{isSaving ? "Saving" : "Save"}</button>
        <button onClick={onToggle}>Toggle</button>
      </td>
    </tr>
  );
}

function draftFromPackage(pack: CreditPackage): PackageDraft {
  return {
    title: pack.title,
    description: pack.description ?? "",
    priceRub: String(pack.priceRub),
    credits: String(pack.credits)
  };
}
