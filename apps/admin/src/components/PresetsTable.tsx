import { adminApi } from "../api.js";
import type { PromptPreset } from "../types.js";

type PresetsTableProps = {
  presets: PromptPreset[];
  onChanged: () => void;
};

export function PresetsTable({ presets, onChanged }: PresetsTableProps) {
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
        <thead>
          <tr>
            <th>Title</th>
            <th>Niche</th>
            <th>Style</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr key={preset.id}>
              <td>{preset.title}</td>
              <td>{preset.niche}</td>
              <td>{preset.style}</td>
              <td>{preset.isActive ? "yes" : "no"}</td>
              <td>
                <button onClick={() => adminApi.updatePreset(preset.id, { isActive: !preset.isActive }).then(onChanged)}>
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
