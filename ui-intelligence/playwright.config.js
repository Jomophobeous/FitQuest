/**
 * Playwright Configuration — Phase 29.5: UI Intelligence Layer
 *
 * Browser: Firefox (headless)
 * Viewport: iPhone 14 Pro (390×844) — mobile-first
 * Screenshots: PNG, full page
 */
'use strict';

module.exports = {
  use: {
    browserName: 'firefox',
    headless: true,
    viewport: { width: 390, height: 844 },
    screenshot: 'on',
    trace: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  timeout: 60000,
  retries: 1,
  outputDir: './screenshots/current',
};
