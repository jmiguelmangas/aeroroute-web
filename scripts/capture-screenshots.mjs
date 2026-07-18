// One-off portfolio asset capture: drives the real local stack (dev server +
// live API) with Playwright and saves PNG screenshots. Not part of the test
// suite -- run manually when refreshing portfolio README screenshots.
//
// Usage:
//   pnpm exec playwright install chromium   # first time only
//   node scripts/capture-screenshots.mjs [output-dir]
//
// Requires: aeroroute-web dev server reachable (this script does not start
// one), aeroroute-api + PostGIS running with an imported airport bundle.

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const baseUrl = process.env.AEROROUTE_WEB_URL ?? "http://127.0.0.1:5173";
const outputDir = resolve(process.argv[2] ?? "screenshots");
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
  console.log(`Loading ${baseUrl} ...`);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(500); // let the map preview settle

  const landingPath = resolve(outputDir, "landing-search-form.png");
  await page.screenshot({ path: landingPath, fullPage: false });
  console.log(`Saved ${landingPath}`);

  await page
    .getByRole("combobox", { name: "Aeronave" })
    .selectOption("B788");
  await page.waitForTimeout(300);

  const dashboardPath = resolve(outputDir, "dashboard-mad-jfk.png");
  await page.screenshot({ path: dashboardPath, fullPage: false });
  console.log(`Saved ${dashboardPath}`);

  const generateButton = page.getByRole("button", {
    name: "Generar plan de vuelo",
  });
  await generateButton.click();

  // Submitting navigates to the Resultados screen; wait for the comparison
  // table's first data row rather than just the panel shell.
  await page
    .getByRole("cell", { name: /^\d/ })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500); // let the map settle its render/animation

  const resultsPath = resolve(outputDir, "results-comparison.png");
  await page.screenshot({ path: resultsPath, fullPage: false });
  console.log(`Saved ${resultsPath}`);

  const openOfp = page.getByRole("button", {
    name: "Ver plan de vuelo completo",
  });
  await openOfp.waitFor({ state: "visible", timeout: 15_000 });
  await openOfp.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const ofpPath = resolve(outputDir, "flight-plan-ofp.png");
  await page.screenshot({ path: ofpPath, fullPage: true });
  console.log(`Saved ${ofpPath}`);
} finally {
  await browser.close();
}
