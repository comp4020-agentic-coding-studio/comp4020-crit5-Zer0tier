import { chromium } from "playwright";

const label = process.argv[2] ?? "play";
const cases = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "mobile", width: 390, height: 844 },
];
const reports = [];

const browser = await chromium.launch({ headless: true });

for (const viewport of cases) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle" });
  await page.locator("#start-button").click();

  const centreX = viewport.width / 2;
  const centreY = viewport.height * (viewport.height < 560 ? 0.55 : 0.535);
  const nearEdgeAngle = (28 * Math.PI) / 180;
  await page.mouse.move(
    centreX + Math.cos(nearEdgeAngle) * 180,
    centreY + Math.sin(nearEdgeAngle) * 180,
  );

  await page.waitForTimeout(5800);
  const report = await page.evaluate(() => ({
    integrity: document.querySelector("#integrity-meter")?.getAttribute("aria-label"),
    charge: document.querySelector("#charge-meter")?.getAttribute("aria-label"),
    endVisible: getComputedStyle(document.querySelector("#end-screen")).display !== "none",
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  await page.screenshot({ path: `/tmp/orbital-${viewport.name}-${label}.png` });
  reports.push({ viewport: viewport.name, ...report, errors });
  await page.close();
}

await browser.close();
process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
