import { chromium } from "playwright";

const viewports = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "mobile", width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true });
let failed = false;

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle" });
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const report = await page.evaluate(async () => {
    const axeReport = await window.axe.run(document);
    return {
      violations: axeReport.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target),
      })),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });

  process.stdout.write(
    `${JSON.stringify({ viewport: viewport.name, ...report, errors }, null, 2)}\n`,
  );
  if (
    report.violations.length > 0 ||
    report.scrollWidth !== report.innerWidth ||
    errors.length > 0
  ) {
    failed = true;
  }
  await page.close();
}

await browser.close();
if (failed) process.exitCode = 1;
