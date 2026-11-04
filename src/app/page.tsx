import { Watchlist } from "@/components/dashboard/Watchlist";

export default function DashboardPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Track tickers, then tap one for charts, stats and news.</p>
      </div>
      <Watchlist />
    </div>
  );
}
