/**
 * Captures every page at desktop and mobile widths for the thesis documentation.
 *
 *   npm run screenshots            # against http://localhost:3000
 *   BASE_URL=https://... npm run screenshots
 *
 * Output: screenshot/<viewport>/<NN>-<name>.png
 *
 * Automated rather than manual so the images stay consistent across runs and
 * can be regenerated wholesale whenever the UI changes — the alternative is a
 * documentation folder that silently drifts out of date.
 *
 * The mobile pass doubles as evidence for the "basic responsive web interface"
 * requirement and for the accessibility evaluation.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT_ROOT = 'screenshot';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  // Roughly an entry-level Android handset — the realistic device for the
  // target users, and the width most likely to break a dashboard layout.
  { name: 'mobile', width: 390, height: 844 },
] as const;

/**
 * Must list every route reachable from the navigation.
 *
 * This drifted once already: /subscribe was added to the nav but not here, so
 * the notification flow — the feature the whole alert system exists for — was
 * silently absent from the documentation. If you add a nav item, add it here.
 */
interface PageSpec {
  path: string;
  name: string;
  /**
   * Extra captures taken after clicking a tab. Without these, a tabbed page
   * only ever documents its default tab — which on /rainfall would omit the
   * 24-hour forecast chart, the one genuinely hourly visual in the system.
   */
  tabs?: Array<{ label: string; name: string }>;
}

const PAGES: PageSpec[] = [
  { path: '/', name: 'dashboard' },
  {
    path: '/rainfall',
    name: 'rainfall',
    tabs: [{ label: 'Rainfall Data|Datos ng Ulan', name: 'rainfall-data' }],
  },
  { path: '/water-level', name: 'water-level' },
  { path: '/dam-advisory', name: 'dam-advisory' },
  { path: '/flood-info', name: 'flood-info' },
  { path: '/alerts', name: 'alerts' },
  { path: '/subscribe', name: 'subscribe' },
];

/** The map needs its tiles and GeoJSON settled before it is worth capturing. */
async function settle(page: Page, isMapPage: boolean) {
  await page.waitForLoadState('networkidle').catch(() => {});
  if (isMapPage) {
    // MapLibre paints asynchronously after the GeoJSON parses in its worker.
    await page.waitForTimeout(3500);
  } else {
    await page.waitForTimeout(600);
  }
}

async function capture(browser: Browser, lang: 'en' | 'tl') {
  for (const vp of VIEWPORTS) {
    const dir = join(OUT_ROOT, vp.name, lang);
    mkdirSync(dir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2, // retina-quality images for print documentation
      locale: 'en-PH',
      timezoneId: 'Asia/Manila',
    });

    // Drive the language via the same cookie the app reads server-side.
    await context.addCookies([
      { name: 'lang', value: lang, url: BASE_URL },
    ]);

    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    for (const [i, spec] of PAGES.entries()) {
      const url = `${BASE_URL}${spec.path}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await settle(page, spec.path === '/');

        const order = String(i + 1).padStart(2, '0');
        const file = join(dir, `${order}-${spec.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ${vp.name}/${lang}  ${spec.name.padEnd(14)} -> ${file}`);

        for (const tab of spec.tabs ?? []) {
          // Labels differ by language, so accept a pipe-separated set.
          const names = tab.label.split('|');
          let clicked = false;
          for (const n of names) {
            const el = page.getByRole('tab', { name: n, exact: false });
            if (await el.count()) {
              await el.first().click();
              clicked = true;
              break;
            }
          }
          if (!clicked) {
            console.warn(`  ! ${vp.name}/${lang} could not find tab "${tab.label}"`);
            continue;
          }
          await page.waitForTimeout(900);
          const tabFile = join(dir, `${order}b-${tab.name}.png`);
          await page.screenshot({ path: tabFile, fullPage: true });
          console.log(`  ${vp.name}/${lang}  ${tab.name.padEnd(14)} -> ${tabFile}`);
        }
      } catch (err) {
        console.error(`  FAILED ${vp.name}/${lang} ${spec.name}: ${(err as Error).message}`);
      }
    }

    if (errors.length) {
      console.warn(`  ! ${vp.name}/${lang} page errors: ${[...new Set(errors)].join(' | ')}`);
    }

    await context.close();
  }
}

/**
 * Fails loudly when a navigation entry has no corresponding screenshot.
 *
 * Reads navItems.ts as text rather than importing it, because that module
 * pulls in MUI icon components which have no place in a CLI script. A regex is
 * acceptable here: this is a documentation check, and its failure mode is a
 * visible warning rather than a broken build.
 */
function checkNavCoverage(): void {
  try {
    const src = readFileSync('src/components/layout/navItems.ts', 'utf8');
    const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
    const captured = new Set(PAGES.map((p) => p.path));
    const missing = hrefs.filter((h) => !captured.has(h as (typeof PAGES)[number]['path']));

    if (missing.length) {
      console.warn(`WARNING: these nav routes are not being captured: ${missing.join(', ')}`);
      console.warn('         Add them to PAGES in this file.\n');
    } else {
      console.log(`Nav coverage: all ${hrefs.length} navigation routes are captured.\n`);
    }
  } catch {
    // Never let the check itself break screenshot generation.
  }
}

async function main() {
  console.log(`Capturing ${BASE_URL}\n`);
  checkNavCoverage();

  // Fail fast with a clear message instead of 24 confusing timeouts.
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    console.error(`Cannot reach ${BASE_URL}. Start the app first (npm run dev).`);
    process.exit(1);
  }

  // Clear only the generated subfolders, so any hand-made images kept at the
  // top level of screenshot/ survive.
  for (const vp of VIEWPORTS) {
    rmSync(join(OUT_ROOT, vp.name), { recursive: true, force: true });
  }

  const browser = await chromium.launch();
  try {
    await capture(browser, 'en');
    await capture(browser, 'tl');
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${VIEWPORTS.length * PAGES.length * 2} images in ${OUT_ROOT}/`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
