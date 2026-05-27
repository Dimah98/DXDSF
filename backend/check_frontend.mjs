import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('BROWSER UNCAUGHT EXCEPTION:', error.message);
    console.log('STACK:', error.stack);
  });

  console.log('Navigating to frontend...');
  // Переходимо на актуальний порт Vite (5173, не 5175)
  await page.goto('http://localhost:5173');
  console.log('Waiting 5 seconds...');
  await page.waitForTimeout(5000);
  console.log('Done.');
  await browser.close();
})();
