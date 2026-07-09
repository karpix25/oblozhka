import type { Generation } from "../types.js";

export function GenerationsTable({ generations }: { generations: Generation[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Status</th>
          <th>Format</th>
          <th>Topic</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        {generations.map((item) => (
          <tr key={item.id}>
            <td>{item.user?.username ?? item.user?.telegramId}</td>
            <td>{item.status}</td>
            <td>{item.format}</td>
            <td>{item.topic}</td>
            <td>{item.errorMessage}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
