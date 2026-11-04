import { EmptyState } from "@/components/ui/States";
import type { NewsItem } from "@/lib/types";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsList({ news }: { news: NewsItem[] | null }) {
  if (news === null) return <EmptyState>News is unavailable right now.</EmptyState>;
  if (news.length === 0) return <EmptyState>No recent headlines.</EmptyState>;
  return (
    <ul className="divide-y divide-border">
      {news.map((n) => (
        <li key={n.id} className="py-3">
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="group block">
            <p className="text-sm font-medium group-hover:text-accent">{n.title}</p>
            <p className="mt-1 text-xs text-muted">
              {n.publisher} · <time dateTime={n.publishedAt}>{timeAgo(n.publishedAt)}</time>
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
