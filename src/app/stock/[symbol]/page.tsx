import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StockView } from "@/components/stock/StockView";
import { normalizeSymbol } from "@/lib/market/symbols";

async function getSymbol(params: PageProps<"/stock/[symbol]">["params"]) {
  return normalizeSymbol(decodeURIComponent((await params).symbol));
}

export async function generateMetadata({ params }: PageProps<"/stock/[symbol]">): Promise<Metadata> {
  const symbol = await getSymbol(params);
  return { title: symbol ?? "Unknown ticker" };
}

/**
 * The page itself is a thin server component: it validates the URL, then
 * hands off to a client component that fetches and live-refreshes data.
 */
export default async function StockPage({ params }: PageProps<"/stock/[symbol]">) {
  const symbol = await getSymbol(params);
  if (!symbol) notFound();
  return <StockView symbol={symbol} />;
}
