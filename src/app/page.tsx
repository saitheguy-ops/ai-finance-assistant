import { PortfolioSnapshot } from "@/components/dashboard/PortfolioSnapshot";
import { Watchlist } from "@/components/dashboard/Watchlist";

export default function DashboardPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Track tickers, then tap one for charts, stats, news and paper trading.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Watchlist />
        </div>
        <div className="grid content-start gap-4">
          <PortfolioSnapshot />
        </div>
      </div>
    </div>
  );
}
