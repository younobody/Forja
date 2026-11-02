const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
let falhas = 0;
const ok = (cond, msg, extra) => { if (!cond) falhas++; console.log(`${cond ? 'OK    ' : 'FALHA '} ${msg}${extra ? '  ' + extra : ''}`); };

async function ctxNovo(browser, { versaoAnterior, sw } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: sw ? 'allow' : 'block' });
  if (versaoAnterior !== undefined) await ctx.addInitScript(v => { try { if (!localStorage.getItem('__seed')) { localStorage.setItem('__seed', '1'); if (v) localStorage.setItem('forja-last-version', v); } } catch (e) {} }, versaoAnterior);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  return { ctx, page, erros };
}

(async () => {
  const browser = await chromium.launch();

  console.log('--- 1. aviso "FORJA Atualizado" ---');
  for (const [nome, anterior, esperaModal] of [['1a abertura (sem versão gravada)', '', false], ['atualização (v30.30.0 gravada)', 'v30.30.0', true], ['mesma versão (a atual gravada)', VER, false]]) {
    const { ctx, page, erros } = await ctxNovo(browser, { versaoAnterior: anterior });
    await installMock(page, {});
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(1300);
    const vis = await page.evaluate(() => !document.getElementById('version-modal').classList.contains('hidden'));
    const gravada = await page.evaluate(() => localStorage.getItem('forja-last-version'));
    const txt = await page.evaluate(() => document.getElementById('version-text').textContent);
    ok(vis === esperaModal, `${nome}: modal ${vis ? 'APARECEU' : 'não apareceu'} (esperado: ${esperaModal ? 'aparecer' : 'não aparecer'})`, vis ? `texto="${txt}"` : '');
    ok(gravada === VER, `${nome}: versão gravada = ${gravada}`);
    ok(erros.length === 0, `${nome}: sem erros de JS`, erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 2. aluno: rótulos e TREINAR ---');
  {
    const { ctx, page, erros } = await ctxNovo(browser, { versaoAnterior: VER });
    await installMock(page, {});
    await page.goto(URL, { waitUntil: 'load' });
    await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    await page.evaluate(() => iniciarTreinar()); await page.waitForTimeout(900);
    for (const campo of ['carga', 'reps', 'rir', 'data']) {
      await page.evaluate(c => { const l = document.querySelector(`label[for="treinar-input-${c}"]`); if (l) l.click(); }, campo);
      const foco = await page.evaluate(() => document.activeElement && document.activeElement.id);
      ok(foco === 'treinar-input-' + campo, `clicar no rótulo foca #treinar-input-${campo}`, `activeElement=${foco}`);
    }
    await page.fill('#treinar-input-carga', '62.5'); await page.fill('#treinar-input-reps', '9'); await page.fill('#treinar-input-rir', '2');
    await page.click('#btn-treinar-registrar-serie'); await page.waitForTimeout(400);
    const lista = await page.evaluate(() => document.getElementById('treinar-series-lista').textContent);
    const cont = await page.evaluate(() => document.getElementById('treinar-series-contagem').textContent);
    ok(/62\.5×9/.test(lista) && /^1/.test(cont), 'REGISTRAR SÉRIE grava a série e atualiza a lista', `lista="${lista}" contagem="${cont}"`);
    const nomeAcessivel = await page.evaluate(() => { const b = [...document.querySelectorAll('#modal-peso button')].find(x => x.getAttribute('aria-label')); return b && b.getAttribute('aria-label'); });
    ok(nomeAcessivel === 'Fechar', 'botão de fechar do modal tem nome acessível', nomeAcessivel);
    await page.evaluate(() => encerrarTreinar()); await page.waitForTimeout(300);
    // LANÇAR SESSÃO: alternar SIM / FALTOU
    await page.evaluate(() => navigateTo('#aluno/demo')); await page.waitForTimeout(400);
    await page.evaluate(() => abrirModalRegistrar()); await page.waitForTimeout(400);
    const antes = await page.evaluate(() => { const b = document.querySelector('#modal-reg-form button[data-f="completou"]'); return [b.className, b.textContent]; });
    await page.evaluate(() => document.querySelector('#modal-reg-form button[data-f="completou"]').click());
    const meio = await page.evaluate(() => { const b = document.querySelector('#modal-reg-form button[data-f="completou"]'); return [b.className, b.textContent]; });
    await page.evaluate(() => document.querySelector('#modal-reg-form button[data-f="completou"]').click());
    const depois = await page.evaluate(() => { const b = document.querySelector('#modal-reg-form button[data-f="completou"]'); return [b.className, b.textContent]; });
    ok(/bg-emerald-700/.test(antes[0]) && /SIM/.test(antes[1]), 'LANÇAR SESSÃO: botão inicia em SIM com verde escuro (contraste)', antes.join(' | ').slice(0, 90));
    ok(/FALTOU/.test(meio[1]) && !/bg-emerald/.test(meio[0]), 'LANÇAR SESSÃO: 1 clique alterna para FALTOU');
    ok(/bg-emerald-700/.test(depois[0]) && /SIM/.test(depois[1]), 'LANÇAR SESSÃO: 2º clique volta para SIM');
    const al = await page.evaluate(() => document.querySelector('#modal-reg-form input[data-f="carga"]').getAttribute('aria-label'));
    ok(/^Carga — Supino reto barra$/.test(al), 'campos do LANÇAR SESSÃO nomeados com o exercício', al);
    ok(erros.length === 0, 'aluno: sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 3. trainer: dashboard, card e editor do plano ---');
  {
    const { ctx, page, erros } = await ctxNovo(browser, { versaoAnterior: VER });
    await installMock(page, {});
    await page.goto(URL, { waitUntil: 'load' });
    await page.fill('#home-pin', 'admin'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#trainer-alunos-list > div')].map(d => ({ id: d.dataset.alunoId, ult: (d.textContent.match(/ÚLT:[^\n]*|SEM REGISTROS/) || [''])[0].trim().slice(0, 40), at: (d.textContent.match(/@\S+/) || [''])[0] })));
    ok(cards.length === 2 && cards[0].id === 'demo', 'dashboard lista os 2 alunos com data-aluno-id', JSON.stringify(cards));
    ok(/ÚLT: [A-D]/.test(cards[0].ult), 'texto "ÚLT: <dia>" preservado para dado normal', cards[0].ult);
    await page.evaluate(() => document.querySelector('#trainer-alunos-list > div').click()); await page.waitForTimeout(1500);
    ok(await page.evaluate(() => location.hash) === '#trainer/edit/demo', 'clique no card navega para #trainer/edit/demo');
    const antes = await page.evaluate(() => APP.editPlano[APP.editDay].map(e => e.exercicio));
    await page.evaluate(() => document.querySelector('#view-edit-aluno button[data-act="down"][data-i="0"]').click()); await page.waitForTimeout(300);
    const depois = await page.evaluate(() => APP.editPlano[APP.editDay].map(e => e.exercicio));
    ok(depois[0] === antes[1] && depois[1] === antes[0], 'botão ▼ do plano ainda troca a ordem (com aria-label)', depois.slice(0, 2).join(' / '));
    await page.fill('#view-edit-aluno input[data-f="series"][data-i="0"]', '5'); await page.waitForTimeout(100);
    const serie = await page.evaluate(() => APP.editPlano[APP.editDay][0].series);
    ok(serie === '5', 'editar campo do plano atualiza APP.editPlano', 'series=' + serie);
    const nomes = await page.evaluate(() => [...document.querySelectorAll('#view-edit-aluno tbody tr:first-child [aria-label]')].map(e => e.getAttribute('aria-label')).slice(0, 4));
    ok(nomes.length >= 4 && /exercício 1/i.test(nomes[0]), 'linha 1 do plano com aria-label', nomes.join(' | '));
    ok(erros.length === 0, 'trainer: sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 4. service worker real (gate de versão do install) ---');
  {
    const { ctx, page } = await ctxNovo(browser, { versaoAnterior: VER, sw: true });
    await page.goto(URL, { waitUntil: 'load' });
    const r = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const nomes = await caches.keys();
      const shell = nomes.find(n => n.endsWith('-shell'));
      const c = shell && await caches.open(shell);
      const hit = c && await c.match('./forja.html');
      const corpo = hit && await hit.text();
      return { ativo: !!reg.active, nomes, forjaNoCache: !!hit, versaoNoCache: corpo && (/const FORJA_VERSION\s*=\s*'([^']+)'/.exec(corpo) || [])[1] };
    });
    ok(r.ativo && r.nomes.includes('forja-' + VER + '-shell'), 'SW instalou e criou o cache forja-' + VER + '-shell', JSON.stringify(r.nomes));
    ok(r.forjaNoCache && r.versaoNoCache === VER, 'forja.html cacheado declara ' + VER, r.versaoNoCache);
    await ctx.close();
  }

  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os checks OK');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
