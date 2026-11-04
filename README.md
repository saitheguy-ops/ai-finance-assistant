# 🤖 AI Finance Assistant

A Jarvis-style chat assistant for stock research, plus a paper-trading portfolio. Ask "how did NVDA do this month?", compare stocks, or say "buy 10 TSLA" with $100,000 of fake money. Every number comes from real market data.

> ⚠️ Educational project, not financial advice. Paper trading only: the app never places real trades.

| Chat | Portfolio | Mobile |
| --- | --- | --- |
| ![Jarvis chat](docs/screenshots/chat.png) | ![Paper portfolio](docs/screenshots/portfolio.png) | <img src="docs/screenshots/mobile-chat.png" alt="Chat on a phone in dark mode" width="220"> |

## Why I built it

I wanted to build something bigger than my first app: an assistant like Jarvis that you can just talk to. Finance was a good fit, because stock questions have real answers you can check. I chose paper trading on purpose: you get the full experience of buying and selling without risking real money.

## Features

- **Jarvis chat:** plain-English commands like `price of NVDA`, `compare AAPL MSFT`, `buy $500 of NVDA` and `show my portfolio`, answered with quote cards and charts
- **Optional Claude mode:** add an Anthropic API key and Claude handles any question, using the same tools, so it can't make up prices
- **Paper trading:** buy and sell with fake cash, and track holdings, cost basis, profit and loss, and value over time
- **Watchlist and stock pages:** live-ish prices, charts from 1 day to 5 years, key stats and news
- **Built to fail gracefully:** bad tickers, data outages and AI errors all show clear messages
- **Works on phones**, with dark mode; 80+ automated tests

## How I built it

I wrote one detailed prompt that worked like a spec: the features, plus rules like "never invent a price," "must run with no API keys," and "commit after each phase." Then I had Claude Code build it overnight in five phases: data layer, dashboard, trading, chat, and polish. The finished work came in as a pull request, and automated checks (lint, type check, tests and build) ran on it before I merged.

## What I learned

- **A clear spec is most of the work.** The rules in my prompt shaped the whole design: because the app had to run without a key, the chat got a built-in command mode that Claude mode now falls back to.
- **AI tool use stops made-up numbers.** Claude never states a price directly. It calls functions like `get_quote` that fetch real data, and answers from what they return.
- **Keep secrets on the server.** The API key is read in one server-only file, is never sent to the browser, and is never committed. `.env.example` shows what's needed without exposing anything.
- **Data has trade-offs.** Most market-data APIs need keys because exchanges charge for data and providers limit usage. Yahoo Finance needs no key but is unofficial and can break, so all data fetching lives in one place where it's easy to swap out.
- **Plan for things to fail.** Yahoo was blocked in the cloud environment where the app was built, which made the error handling the first thing I saw working.
- **The professional Git workflow:** feature branches, pull requests, and CI checks that must pass before merging.

## Run it

Requires Node.js 22+.

```bash
git clone https://github.com/saitheguy-ops/ai-finance-assistant.git
cd ai-finance-assistant
npm install
npm run dev
```

Open http://localhost:3000. No keys or database are needed.

**Optional AI mode:** copy `.env.example` to `.env.local`, add your `ANTHROPIC_API_KEY`, and restart. To use a cheaper model, set `ANTHROPIC_MODEL` (e.g. `claude-sonnet-5-5`).

**Deploy:** import the repo on [Vercel](https://vercel.com/new) and click Deploy. It works on the free tier, and any keys go in Settings → Environment Variables.

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Recharts · SWR · Zod · Anthropic SDK · yahoo-finance2 · Vitest · Playwright · GitHub Actions

For how the pieces fit together, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Disclaimer

For learning only. Not investment advice, not affiliated with Yahoo or Anthropic, and data may be delayed or wrong.
