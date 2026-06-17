import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:4177';
const matchId = '2026-001-mexico-vs-south-africa';

const routes = [
  { name: 'matches', path: '/' },
  { name: 'detail', path: `/tran-dau/${matchId}` },
  { name: 'legacy-analysis', path: '/phan-tich-du-doan' },
  { name: 'legacy-prediction', path: '/du-doan' },
  { name: 'matches-shortcut', path: '/matches' },
];

const breakpoints = [
  { name: 'mobile-360', width: 360, height: 760 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-land-640', width: 640, height: 360 },
];

function shortText(value) {
  if (!value) return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function getRouteLabel(route) {
  return `${route.name} (${route.path})`;
}

async function getReport(page) {
  return page.evaluate(() => {
    const selectors = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
    ];

    const nodes = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => nodes.add(node));
    }

    const offenders = [];
    const seen = new Set();

    for (const node of nodes) {
      const styles = window.getComputedStyle(node);
      if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0 || styles.pointerEvents === 'none') {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        continue;
      }

      if (node.tagName && node.tagName.toLowerCase() === 'input') {
        const type = (node.getAttribute('type') || 'text').toLowerCase();
        if (type === 'hidden') {
          continue;
        }
      }

      let text = '';
      if (node instanceof HTMLInputElement) {
        text = `${node.type || 'input'} ${node.placeholder || node.name || ''}`;
      } else if (node instanceof HTMLButtonElement || node.getAttribute('role') === 'button') {
        text = node.textContent || '';
      } else if (node instanceof HTMLAnchorElement) {
        text = node.textContent || '';
      } else {
        text = node.getAttribute('aria-label') || node.getAttribute('title') || '';
      }

      if (rect.width >= 44 && rect.height >= 44) {
        continue;
      }

      const path = node.getAttribute('id')
        ? `#${node.getAttribute('id')}`
        : node.className
          ? `${node.tagName.toLowerCase()}.${String(node.className).split(/\s+/).slice(0, 2).join('.')}`
          : node.tagName
            ? node.tagName.toLowerCase()
            : 'element';
      const key = `${path}|${Math.round(rect.width)}x${Math.round(rect.height)}|${shortText(text)}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      offenders.push({
        tag: node.tagName ? node.tagName.toLowerCase() : 'unknown',
        role: node.getAttribute('role') || '',
        path,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        text: shortText(text),
        disabled: node instanceof HTMLButtonElement ? node.disabled : false,
        classes: node.className ? String(node.className) : '',
      });
    }

    const overflow = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth;

    return {
      overflowX: Math.max(0, Math.round(overflow * 100) / 100),
      hasLanguageGate: !!document.querySelector('[aria-labelledby="language-gate-title"]'),
      touchTargetOffenders: offenders.sort((a, b) => (a.width * a.height) - (b.width * b.height)),
      totalInteractive: nodes.size,
      docWidth: Math.round(document.documentElement.scrollWidth),
      bodyWidth: Math.round(document.body.scrollWidth),
      viewportWidth: window.innerWidth,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const all = [];

  for (const viewport of breakpoints) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true,
      locale: 'en-US',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    console.log(`\n===== ${viewport.name} =====`);

    for (const route of routes) {
      const url = `${base}${route.path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      try {
        const langGate = page.locator('[aria-labelledby="language-gate-title"]');
        await langGate.waitFor({ timeout: 800 });
        await page.getByRole('button', { name: /English/i }).first().click({ timeout: 1000 });
        await page.waitForTimeout(300);
      } catch {
        // no language gate
      }

      await page.waitForTimeout(700);
      const report = await getReport(page);
      all.push({ viewport: viewport.name, route: getRouteLabel(route), ...report });

      if (report.hasLanguageGate) {
        failures.push({
          type: 'language-gate',
          viewport: viewport.name,
          route: getRouteLabel(route),
        });
      }

      if (report.overflowX > 0.5) {
        failures.push({
          type: 'overflow',
          viewport: viewport.name,
          route: getRouteLabel(route),
          value: report.overflowX,
          docWidth: report.docWidth,
          bodyWidth: report.bodyWidth,
          viewportWidth: report.viewportWidth,
        });
      }

      if (report.touchTargetOffenders.length > 0) {
        failures.push({
          type: 'touch',
          viewport: viewport.name,
          route: getRouteLabel(route),
          count: report.touchTargetOffenders.length,
          items: report.touchTargetOffenders,
        });

        const top = report.touchTargetOffenders
          .slice(0, 8)
          .map((item) => `${item.tag} ${item.path} ${item.width}x${item.height}`)
          .join('; ');
        console.log(`[${viewport.name}] ${route.name}: ${report.touchTargetOffenders.length} issue(s): ${top}`);
      }
    }

    await context.close();
  }

  await browser.close();

  if (failures.length === 0) {
    console.log('\nAll viewport checks passed.');
    return;
  }

  console.log(`\nTOTAL ISSUE GROUPS: ${failures.length}`);
  for (const fail of failures) {
    if (fail.type === 'overflow') {
      console.log(`OVERFLOW ${fail.viewport} ${fail.route}: ${fail.value}px (doc:${fail.docWidth} body:${fail.bodyWidth} viewport:${fail.viewportWidth})`);
      continue;
    }

    if (fail.type === 'language-gate') {
      console.log(`LANGUAGE-GATE ${fail.viewport} ${fail.route}`);
      continue;
    }

    console.log(`TOUCH ${fail.viewport} ${fail.route}: ${fail.count}`);
    for (const item of fail.items.slice(0, 20)) {
      console.log(`  - ${item.tag} ${item.path} ${item.width}x${item.height} text=${item.text}`);
    }
  }

  // Optional compact dump for scripting if needed:
  // console.log(JSON.stringify(all, null, 2));
})();
