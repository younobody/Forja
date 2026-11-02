const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER, AXE } = require('./common');
let violacoes = 0;   // falha (exit 1) se o axe achar qualquer violação em alguma aba
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[360, 740], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, locale: 'pt-BR', serviceWorkers: 'block' });
    await ctx.addInitScript((v) => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
    const page = await ctx.newPage(); page.on('dialog', d => d.accept().catch(() => {}));
    await installMock(page, {});
    await page.goto(URL, { waitUntil: 'load' });
    await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    await page.evaluate(AXE);
    console.log(`=== ${w}px ===`);
    for (const aba of ['treino', 'evolucao', 'corpo', 'mais']) {
      if (aba !== 'treino') { await page.click(`#aluno-abas [data-aba="${aba}"]`); await page.waitForTimeout(700); }
      const r = await page.evaluate(async () => {
        const res = await axe.run(document, { resultTypes: ['violations'] });
        return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => (n.target || []).join(' ').slice(0, 70) + ' :: ' + ((n.any[0] && n.any[0].message) || '').slice(0, 110)) }));
      });
      violacoes += r.length;
      console.log(`- ${aba}: ${r.length ? '' : 'sem violações'}`);
      r.forEach(v => console.log(`    [${v.impact}] ${v.id} (${v.n})\n        ${v.ex.join('\n        ')}`));
    }
    await ctx.close();
  }
  await browser.close();
  console.log(violacoes ? `\n${violacoes} VIOLAÇÃO(ÕES)` : '\nTodas as abas sem violações');
  process.exit(violacoes ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
