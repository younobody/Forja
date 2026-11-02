// axe em cada modal e no TREINAR (campos sem rótulo, nomes de botões, etc.)
const { chromium } = require('playwright');
const fs = require('fs');
const { installMock } = require('./mock');
const { URL, VER, AXE } = require('./common');

async function sessao(browser, papel) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript((v) => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await installMock(page, {});
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', papel === 'trainer' ? 'admin' : '1234');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  await page.evaluate(AXE);
  return { ctx, page };
}
let violacoes = 0;   // falha (exit 1) se o axe achar qualquer violação ou se algum alvo não existir
async function axeEm(page, rotulo, seletor) {
  const r = await page.evaluate(async sel => {
    const alvo = sel ? document.querySelector(sel) : document;
    if (!alvo) return { erro: 'sem alvo ' + sel };
    const res = await axe.run(alvo, { resultTypes: ['violations'], rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false }, 'landmark-one-main': { enabled: false } } });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 6).map(n => (n.target || []).join(' ').slice(0, 70)) }));
  }, seletor);
  if (r.erro) { violacoes++; console.log(`- ${rotulo}: ${r.erro}`); return; }
  violacoes += r.length;
  console.log(`- ${rotulo}: ${r.length ? '' : 'sem violações'}`);
  r.forEach(v => console.log(`    [${v.impact}] ${v.id} (${v.n}): ${v.ex.join(' | ')}`));
}
(async () => {
  const browser = await chromium.launch();
  console.log('== ALUNO ==');
  let { ctx, page } = await sessao(browser, 'aluno');
  const modais = await page.evaluate(() => [...document.querySelectorAll('[id^="modal-"]')].map(m => m.id));
  console.log('modais no DOM:', modais.join(', '));
  await page.evaluate(() => iniciarTreinar()); await page.waitForTimeout(900);
  await axeEm(page, 'TREINAR', '#view-treinar');
  await page.evaluate(() => { try { abrirModalExtra(); } catch (e) {} }); await page.waitForTimeout(300);
  await axeEm(page, 'modal extra', '#modal-extra-exercicio');
  await page.evaluate(() => { try { abrirTrocaExercicio(); } catch (e) {} }); await page.waitForTimeout(300);
  await axeEm(page, 'modal trocar', '#modal-trocar');
  await page.evaluate(() => { try { encerrarTreinar(); } catch (e) {} }); await page.waitForTimeout(300);
  await page.evaluate(() => navigateTo('#aluno/demo')); await page.waitForTimeout(500);
  for (const [fn, sel, nome] of [['abrirModalPeso()', '#modal-peso', 'modal peso'], ['abrirModalCardio()', '#modal-cardio', 'modal cardio'], ['abrirModalRegistrar()', '#modal-registrar', 'modal lançar sessão'], ['abrirExInfo("Supino reto barra")', '#modal-exinfo', 'modal ficha']]) {
    await page.evaluate(fn).catch(() => {}); await page.waitForTimeout(300);
    const existe = await page.evaluate(s => !!document.querySelector(s), sel);
    await axeEm(page, nome, existe ? sel : null);
  }
  await ctx.close();
  console.log('== TRAINER ==');
  ({ ctx, page } = await sessao(browser, 'trainer'));
  await page.evaluate(() => { document.getElementById('btn-trainer-novo').click(); }); await page.waitForTimeout(300);
  const modaisT = await page.evaluate(() => [...document.querySelectorAll('[id^="modal-"]')].filter(m => !m.classList.contains('hidden')).map(m => m.id));
  console.log('modais abertos (trainer, novo aluno):', modaisT.join(', '));
  for (const id of modaisT) await axeEm(page, 'trainer ' + id, '#' + id);
  await page.keyboard.press('Escape');
  await page.evaluate(() => navigateTo('#trainer/edit/demo')); await page.waitForTimeout(1500);
  await axeEm(page, 'edição do aluno (tela inteira)', '#view-edit-aluno');
  await ctx.close();
  await browser.close();
  console.log(violacoes ? `\n${violacoes} VIOLAÇÃO(ÕES)` : '\nTodos os alvos sem violações');
  process.exit(violacoes ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
