import type { AdminAnalyticsSummary, WindowCounts } from "../types.js";

type AnalyticsDashboardProps = {
  summary?: AdminAnalyticsSummary;
};

export function AnalyticsDashboard({ summary }: AnalyticsDashboardProps) {
  if (!summary) {
    return <p className="muted">No analytics loaded yet.</p>;
  }

  return (
    <div className="dashboard">
      <section className="metric-grid">
        <MetricCard label="Total users" value={summary.users.total} />
        <MetricCard label="Active today" value={summary.users.active.today} />
        <MetricCard label="Active 7 days" value={summary.users.active.last7Days} />
        <MetricCard label="Active 30 days" value={summary.users.active.last30Days} />
      </section>

      <section className="panel-grid">
        <WindowPanel title="New users" counts={summary.users.new} />
        <WindowPanel title="Active users" counts={summary.users.active} />
        <PaymentsPanel summary={summary} />
        <SubscriptionsPanel summary={summary} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Generations</h2>
          <span className="muted">Total: {formatNumber(summary.generations.total)}</span>
        </div>
        <div className="status-grid">
          {Object.entries(summary.generations.byStatus).map(([status, count]) => (
            <MetricCard label={status} value={count} key={status} compact />
          ))}
        </div>
      </section>
    </div>
  );
}

function WindowPanel({ title, counts }: { title: string; counts: WindowCounts }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <dl className="metric-list">
        <MetricRow label="Today" value={counts.today} />
        <MetricRow label="7 days" value={counts.last7Days} />
        <MetricRow label="30 days" value={counts.last30Days} />
      </dl>
    </section>
  );
}

function PaymentsPanel({ summary }: { summary: AdminAnalyticsSummary }) {
  return (
    <section className="panel">
      <h2>Payments</h2>
      <dl className="metric-list">
        <MetricRow label="Revenue" value={`${formatNumber(summary.payments.revenueRub)} RUB`} />
        <MetricRow label="Successful" value={summary.payments.successfulCount} />
        <MetricRow label="Average check" value={`${formatNumber(summary.payments.averageCheckRub)} RUB`} />
      </dl>
    </section>
  );
}

function SubscriptionsPanel({ summary }: { summary: AdminAnalyticsSummary }) {
  return (
    <section className="panel">
      <h2>Active plans</h2>
      <dl className="metric-list">
        {Object.entries(summary.subscriptions.activeByPlan).map(([plan, count]) => (
          <MetricRow label={plan} value={count} key={plan} />
        ))}
      </dl>
    </section>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <article className={compact ? "metric-card compact" : "metric-card"}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  );
}

function MetricRow({ label, value }: { label: string; value: number | string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{typeof value === "number" ? formatNumber(value) : value}</dd>
    </>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}
