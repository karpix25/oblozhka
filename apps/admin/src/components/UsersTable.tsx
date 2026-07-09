import { adminApi } from "../api.js";
import type { User } from "../types.js";

type UsersTableProps = {
  users: User[];
  onChanged: () => void;
};

export function UsersTable({ users, onChanged }: UsersTableProps) {
  async function adjust(user: User) {
    const amount = Number(prompt("Credit adjustment"));
    if (!Number.isInteger(amount) || amount === 0) return;
    await adminApi.adjustCredits(user.id, amount, "manual admin adjustment");
    onChanged();
  }

  return (
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Status</th>
          <th>Balance</th>
          <th>Last seen</th>
          <th>Created</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.username ? `@${user.username}` : user.firstName ?? user.telegramId}</td>
            <td>{user.status}</td>
            <td>{user.balance}</td>
            <td>{formatDate(user.lastSeenAt)}</td>
            <td>{formatDate(user.createdAt)}</td>
            <td>
              <button onClick={() => adjust(user)}>Credits</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("ru-RU") : "-";
}
