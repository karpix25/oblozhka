import type { Payment } from "../types.js";

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Status</th>
          <th>RUB</th>
          <th>Credits</th>
          <th>Transaction</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.id}>
            <td>{payment.user?.username ?? payment.user?.telegramId}</td>
            <td>{payment.status}</td>
            <td>{payment.amountRub} {payment.currency}</td>
            <td>{payment.creditsGranted}</td>
            <td>{payment.providerTransactionId ?? payment.providerStatus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
