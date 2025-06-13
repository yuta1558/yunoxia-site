const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const url = 'file://' + path.join(__dirname, 'runner.html');
  await page.goto(url);
  const failures = await page.evaluate(() => new Promise(resolve => {
    mocha.run(resolve);
  }));
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
