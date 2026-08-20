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
   * Set for any page containing a MapLibre canvas.
   *
   * This was previously inferred as `path === '/'`, which quietly captured
   * /rainfall while its map was still the loading skeleton — the documentation
   * showed a grey box where the radar should be.
   */
  hasMap?: boolean;
  /**
   * Extra captures taken after clicking a tab. Without these, a tabbed page
   * only ever documents its default tab — which on /rainfall would omit the
   * 24-hour forecast chart, the one genuinely hourly visual in the system.
   */
  tabs?: Array<{ label: string; name: string }>;
}

const PAGES: PageSpec[] = [
  { path: '/', name: 'dashboard', hasMap: true },
  {
    path: '/rainfall',
    name: 'rainfall',
    hasMap: true,
    tabs: [{ label: 'Rainfall Data|Datos ng Ulan', name: 'rainfall-data' }],
  },
  { path: '/water-level', name: 'water-level' },
  { path: '/dam-advisory', name: 'dam-advisory' },
  {
    path: '/flood-info',
    name: 'flood-info',
    // The safety-critical tab; worth documenting alongside the landing view.
    tabs: [{ label: 'During a Flood|Habang Bumabaha', name: 'flood-info-during' }],
  },
  { path: '/alerts', name: 'alerts' },
  { path: '/subscribe', name: 'subscribe' },
  { path: '/about', name: 'about' },
];

/**
 * Waits for real content, not for a fixed duration.
 *
 * A timeout was tried first and produced documentation showing loading
 * skeletons: /rainfall fetches radar frames server-side, so it can take longer
 * than any interval short enough to be worth waiting. Worse, the map's own tile
 * requests keep the connection busy, so `networkidle` never fires and its
 * rejection was being swallowed.
 *
 * Waiting on the absence of skeletons and the presence of a painted canvas is
 * both faster in the common case and correct in the slow one.
 */
async function settle(page: Page, isMapPage: boolean) {
  await page.waitForLoadState('networkidle').catch(() => {});

  // Every loading state in the app renders MuiSkeleton; when none remain, the
  // data has arrived.
  await page
    .waitForFunction(() => document.querySelectorAll('.MuiSkeleton-root').length === 0, null, {
      timeout: 20_000,
    })
    .catch(() => console.warn('    (skeletons still present at capture time)'));

  if (isMapPage) {
    await page
      .waitForSelector('canvas.maplibregl-canvas', { timeout: 20_000 })
      .catch(() => console.warn('    (no map canvas found)'));
    // MapLibre paints asynchronously after the worker parses the GeoJSON.
    await page.waitForTimeout(2500);
  } else {
    await page.waitForTimeout(400);
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
        await settle(page, Boolean(spec.hasMap));

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

  // Fail fast with a clear message instead of a page of confusing timeouts.
  //
  // Probes IPv4 and IPv6 literals as well as the given host. `next dev` binds
  // to `::`, and on Windows there is no IPv4 listener behind it; Node 17+
  // resolves "localhost" verbatim, gets 127.0.0.1 first, and hangs. curl and
  // Chromium both try each address in turn, so the app was serving fine while
  // this check declared it down.
  const probes = [
    BASE_URL,
    BASE_URL.replace('localhost', '127.0.0.1'),
    BASE_URL.replace('localhost', '[::1]'),
  ];
  // Retries with a generous timeout: `next dev` compiles a route on first
  // request, and a cold start regularly takes longer than a few seconds. A
  // short single-shot probe reported the app as down purely because it was
  // still building.
  let reachable = false;
  outer: for (let attempt = 0; attempt < 3 && !reachable; attempt += 1) {
    for (const probe of new Set(probes)) {
      try {
        const res = await fetch(probe, { signal: AbortSignal.timeout(20_000) });
        if (res.ok) {
          reachable = true;
          break outer;
        }
      } catch {
        // Try the next candidate, then retry the round.
      }
    }
  }
  if (!reachable) {
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
