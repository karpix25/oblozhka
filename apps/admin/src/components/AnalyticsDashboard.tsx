import type { AdminAnalyticsSummary, CjmAnalytics, PercentileMetric, WindowCounts } from "../types.js";

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

      {summary.cjm && <CjmPanel analytics={summary.cjm} />}
    </div>
  );
}

const FUNNEL_LABELS: Record<string, string> = {
  project_started: "Project started",
  source_submitted: "Source submitted",
  platform_selected: "Format selected",
  templates_shown: "Templates shown",
  template_selected: "Template selected",
  hooks_ready: "Hooks ready",
  hook_selected: "Hook selected",
  reference_selected: "Face selected",
  generation_started: "Generation started",
  generation_succeeded: "PNG ready"
};

function CjmPanel({ analytics }: { analytics: CjmAnalytics }) {
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>CJM funnel</h2>
          <span className="muted">Last {analytics.windowDays} days</span>
        </div>
        <div className="analytics-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Projects</th>
                <th>From previous</th>
                <th>From start</th>
              </tr>
            </thead>
            <tbody>
              {analytics.funnel.map((step) => (
                <tr key={step.name}>
                  <td>{FUNNEL_LABELS[step.name] ?? step.name}</td>
                  <td>{formatNumber(step.count)}</td>
                  <td>{formatPercent(step.conversionFromPrevious)}</td>
                  <td>{formatPercent(step.conversionFromStart)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Journey speed (p50 / p90)</h2>
        <div className="duration-grid">
          <DurationCard label="Source to templates" metric={analytics.journeyDurations.sourceToTemplates} />
          <DurationCard label="Hooks preparation" metric={analytics.journeyDurations.hooksPreparation} />
          <DurationCard label="Time to generation" metric={analytics.journeyDurations.timeToGeneration} />
          <DurationCard label="Queue wait" metric={analytics.generationDurations.queue} />
          <DurationCard label="Image processing" metric={analytics.generationDurations.processing} />
          <DurationCard label="Generation total" metric={analytics.generationDurations.total} />
        </div>
      </section>
    </>
  );
}

function DurationCard({ label, metric }: { label: string; metric: PercentileMetric }) {
  return (
    <article className="duration-card">
      <span>{label}</span>
      <strong>{formatDuration(metric.p50Ms)} / {formatDuration(metric.p90Ms)}</strong>
      <small>{formatNumber(metric.sampleSize)} samples</small>
    </article>
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

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  if (value < 60_000) return `${Math.round(value / 100) / 10}s`;
  return `${Math.round(value / 6_000) / 10}m`;
}
