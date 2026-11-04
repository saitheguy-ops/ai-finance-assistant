// Captures the README screenshots from a running copy of the app.
//
//   npm run dev                 # in one terminal
//   npm run screenshots         # in another
//
// Options (environment variables):
//   BASE_URL       where the app is running (default http://localhost:3000)
//   CHAT_PROMPTS   "|"-separated messages to send to Jarvis
//   SKIP_TRADES=1  don't place sample paper trades
//
// The browser profile is fresh, so the sample trades only touch this
// throwaway session's localStorage, never your own portfolio.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url);
const PROMPTS = (process.env.CHAT_PROMPTS ?? "how did NVDA do this month?|compare AAPL MSFT").split("|").filter(Boolean);
const SAMPLE_TRADES = [
  ["AAPL", 15],
  ["NVDA", 25],
  ["MSFT", 8],
];

await mkdir(OUT, { recursive: true });
const shot = (page, name, fullPage = false) => page.screenshot({ path: new URL(name, OUT).pathname, fullPage });
const settle = (page, ms = 2500) => page.waitForLoadState("load").then(() => page.waitForTimeout(ms));

async function askJarvis(page, prompts) {
  await page.getByRole("button", { name: /Ask Jarvis/ }).click();
  for (const prompt of prompts) {
    const before = await page.locator("[data-role=assistant]").count();
    await page.getByLabel("Message Jarvis").fill(prompt);
    await page.getByRole("button", { name: "Send" }).click();
    await page.locator("[data-role=assistant]").nth(before).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);
  }
}

const browser = await chromium.launch();
try {
  // Desktop, light theme.
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
  const page = await desktop.newPage();

  if (!process.env.SKIP_TRADES) {
    await page.goto(`${BASE}/portfolio`);
    await settle(page, 500);
    for (const [symbol, shares] of SAMPLE_TRADES) {
      await page.getByLabel("Ticker").fill(symbol);
      await page.getByLabel("Shares").fill(String(shares));
      await page.getByRole("button", { name: "Buy", exact: true }).click();
      await page.getByRole("status").waitFor({ timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  await page.goto(BASE);
  await settle(page);
  await shot(page, "dashboard.png");

  await page.goto(`${BASE}/stock/NVDA`);
  await settle(page);
  await shot(page, "stock.png");

  await page.goto(`${BASE}/portfolio`);
  await settle(page, 4000);
  await shot(page, "portfolio.png");

  await page.goto(BASE);
  await settle(page, 1000);
  await askJarvis(page, PROMPTS);
  await shot(page, "chat.png");
  await desktop.close();

  // Phone, dark theme.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
  const mobile = await phone.newPage();
  await mobile.goto(BASE);
  await settle(mobile);
  await shot(mobile, "mobile-dashboard.png");
  await askJarvis(mobile, PROMPTS.slice(0, 1));
  await shot(mobile, "mobile-chat.png");
  await phone.close();

  console.log(`Saved screenshots to ${OUT.pathname}`);
} finally {
  await browser.close();
}
