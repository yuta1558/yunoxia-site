/**
 * Standalone accessibility audit script
 * Runs axe-core against all pages and generates a report
 */

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { url: '/', name: 'Home' },
  { url: '/about.html', name: 'About' },
  { url: '/works.html', name: 'Works' },
  { url: '/log.html', name: 'Log' },
  { url: '/links.html', name: 'Links' }
];

const themes = ['light', 'dark'];

async function runAudit() {
  console.log('🔍 Starting accessibility audit...\n');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let totalViolations = 0;
  const results = [];

  for (const pageInfo of pages) {
    for (const theme of themes) {
      process.stdout.write(`Auditing ${pageInfo.name} (${theme})... `);

      await page.goto(`http://localhost:8000${pageInfo.url}`);

      // Set theme
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);

      // Run axe
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      const violations = accessibilityScanResults.violations;

      results.push({
        page: pageInfo.name,
        theme,
        url: pageInfo.url,
        violations: violations.length,
        issues: violations
      });

      totalViolations += violations.length;

      if (violations.length === 0) {
        console.log('✅ PASS');
      } else {
        console.log(`❌ FAIL (${violations.length} violations)`);
      }
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('ACCESSIBILITY AUDIT RESULTS');
  console.log('='.repeat(60) + '\n');

  for (const result of results) {
    if (result.violations > 0) {
      console.log(`\n📄 ${result.page} (${result.theme}): ${result.violations} violations`);
      console.log('-'.repeat(60));

      result.issues.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id}: ${violation.help}`);
        console.log(`   Impact: ${violation.impact}`);
        console.log(`   Description: ${violation.description}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);

        violation.nodes.forEach((node, nodeIndex) => {
          if (nodeIndex < 3) { // Show first 3 elements
            console.log(`     - ${node.html.substring(0, 100)}...`);
          }
        });

        if (violation.nodes.length > 3) {
          console.log(`     ... and ${violation.nodes.length - 3} more`);
        }

        console.log(`   Learn more: ${violation.helpUrl}`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));

  if (totalViolations === 0) {
    console.log('✅ All pages passed accessibility audit!');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.log(`❌ Total violations: ${totalViolations}`);
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:8000/');
    if (!response.ok) throw new Error('Server not responding');
    return true;
  } catch (error) {
    console.error('❌ Error: Development server not running on http://localhost:8000');
    console.error('   Please run: npm run serve');
    process.exit(1);
  }
}

await checkServer();
await runAudit();
