// v30.34.0: EDITAR registro ja feito, pelo aluno (editarRegistroAluno + PIN) e pelo trainer
// (editarRegistro + chave). Com series detalhadas, o modal edita as series e refaz carga/reps/RIR/obs.
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
let falhas = 0, total = 0;
const ok = (c, m, x) => { total++; if (!c) falhas++; console.log(`${c ? 'OK    ' : 'FALHA '} ${m}${x !== undefined && x !== '' ? '  → ' + x : ''}`); };

const SETS = [{ carga: '21', reps: '10', rir: '0' }, { carga: '21', reps: '9', rir: '0' }];
const OBS = '10/9 · Séries: 21×10 (RIR 0) · 21×9 (RIR 0) · costas boas [[FORJA_SETS:' + encodeURIComponent(JSON.stringify(SETS)) + ']]';
function mutate(o) {
  o.registros.forEach((r, i) => { r.pk = 1000 + i; });
  const r0 = o.registros[0];
  Object.assign(r0, { exercicio: 'Graviton', carga: '21', reps: '10/9', rir: '0', obs: OBS });
  delete o.registros[1].pk; // ainda no buffer: lapis desabilitado
}

async function abre(browser, codigo) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript((v) => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
  const page = await ctx.newPage(); page.on('dialog', d => d.accept().catch(() => {}));
  const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  const calls = await installMock(page, { mutateAluno: mutate, mutateAdmin: mutate });
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', codigo); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
  return { ctx, page, erros, calls };
}
const ultimoPost = (calls, acao) => (calls.filter(c => c[0] === 'api_post' && c[1] === acao).slice(-1)[0] || [])[2];

(async () => {
  const browser = await chromium.launch();

  console.log('--- aluno ---');
  {
    const { ctx, page, erros, calls } = await abre(browser, '1234');
    await page.click('#aluno-abas [data-aba="evolucao"]'); await page.waitForTimeout(500);
    const bt = await page.evaluate(() => ({
      com: (document.querySelector('#evo-historico-aluno .btn-edit-reg[data-pk="1000"]') || {}).disabled,
      sem: [...document.querySelectorAll('#evo-historico-aluno .btn-edit-reg[data-pk=""]')].map(b => b.disabled),
    }));
    ok(bt.com === false && bt.sem.length === 1 && bt.sem[0] === true, 'lápis em cada registro; desabilitado no que não tem pk (buffer offline)', JSON.stringify(bt));
    await page.click('#evo-historico-aluno .btn-edit-reg[data-pk="1000"]'); await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({
      aberto: !document.getElementById('modal-editreg').classList.contains('hidden'),
      ex: document.getElementById('editreg-ex').value,
      series: document.querySelectorAll('#editreg-series .er-serie').length,
      simples: document.getElementById('editreg-simples-box').hidden,
      nota: document.getElementById('editreg-nota').value,
      data: document.getElementById('editreg-data').value,
      dias: [...document.getElementById('editreg-dia').options].map(o => o.value).join(''),
    }));
    ok(m.aberto && m.ex === 'Graviton' && m.series === 2 && m.simples && m.nota === 'costas boas' && /^\d{4}-\d{2}-\d{2}$/.test(m.data) && m.dias === 'ABCDEF',
      'modal abre com o exercício, 2 séries editáveis, a nota livre (sem marcador), a data e os dias A–F', JSON.stringify(m));
    // muda a 2a serie para 8 reps, acrescenta uma 3a, muda a nota
    await page.fill('#editreg-series .er-serie[data-i="1"] [data-k="reps"]', '8');
    await page.click('#editreg-add');
    await page.fill('#editreg-series .er-serie[data-i="2"] [data-k="reps"]', '7');
    await page.fill('#editreg-nota', 'costas boas, sem strap');
    await page.click('#editreg-salvar'); await page.waitForTimeout(1200);
    const p = ultimoPost(calls, 'editarRegistroAluno') || {};
    ok(p.pk === '1000' && p.pin === '1234' && p.aluno_id && !p.key, 'salva com editarRegistroAluno, pk e PIN (sem chave de trainer)', JSON.stringify({ pk: p.pk, pin: !!p.pin, key: !!p.key }));
    ok(p.reps === '10/8/7' && p.carga === '21' && p.rir === '0', 'reps/carga/RIR derivados das séries (como o TREINAR grava)', JSON.stringify({ reps: p.reps, carga: p.carga, rir: p.rir }));
    const sets = await page.evaluate(o => seriesDetalhadasDoRegistro(o), p.obs || '');
    ok(sets && sets.length === 3 && sets[2].reps === '7' && /sem strap/.test(p.obs) && /^10\/8\/7 · Séries:/.test(p.obs), 'obs refeita: resumo + nota + marcador com as 3 séries', p.obs);
    ok(await page.evaluate(() => document.getElementById('modal-editreg').classList.contains('hidden')), 'modal fecha depois de salvar');
    // nome vazio e bloqueado no cliente
    await page.click('#evo-historico-aluno .btn-edit-reg[data-pk="1000"]'); await page.waitForTimeout(300);
    const n0 = calls.length;
    await page.fill('#editreg-ex', ''); await page.click('#editreg-salvar'); await page.waitForTimeout(300);
    const err = await page.evaluate(() => document.getElementById('editreg-erro').textContent);
    ok(calls.length === n0 && /vazio/.test(err), 'nome vazio não vai pro servidor', err);
    await page.evaluate(() => fecharEditarRegistro());
    // registro sem series detalhadas: campos simples
    const pk2 = await page.evaluate(() => { const r = APP.data.registros.find(x => x.pk != null && !/FORJA_SETS/.test(x.obs || '')); abrirEditarRegistro(String(r.pk), false); return String(r.pk); });
    const s2 = await page.evaluate(() => ({ series: document.getElementById('editreg-series-box').hidden, simples: document.getElementById('editreg-simples-box').hidden }));
    ok(s2.series && !s2.simples, 'registro antigo (sem séries) edita carga/reps/RIR direto', JSON.stringify(s2));
    await page.fill('#editreg-carga', '55kg'); await page.click('#editreg-salvar'); await page.waitForTimeout(1000);
    const p2 = ultimoPost(calls, 'editarRegistroAluno') || {};
    ok(p2.pk === pk2 && p2.carga === '55kg', 'salva a carga nova no registro simples', JSON.stringify({ pk: p2.pk, carga: p2.carga }));
    const trava = await page.evaluate(() => {
      const r = APP.data.registros.find(x => x.pk != null && x.local_id);
      TREINAR.localIds = [String(r.local_id)];
      abrirEditarRegistro(String(r.pk), false);
      const aberto = !document.getElementById('modal-editreg').classList.contains('hidden');
      TREINAR.localIds = [];
      return aberto;
    });
    ok(trava === false, 'registro do treino em andamento não abre a edição (o REABRIR regravaria o valor antigo)', trava);
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- trainer ---');
  {
    const { ctx, page, erros, calls } = await abre(browser, 'admin');
    await page.evaluate(() => navigateTo('#trainer/edit/demo')); await page.waitForTimeout(1800);
    const tem = await page.evaluate(() => document.querySelectorAll('#evo-historico-trainer .btn-edit-reg:not([disabled])').length);
    ok(tem > 0, 'trainer vê o lápis no histórico do aluno', tem);
    await page.evaluate(() => document.querySelector('#evo-historico-trainer .btn-edit-reg[data-pk="1000"]').click()); await page.waitForTimeout(300);
    await page.fill('#editreg-ex', 'Puxada frontal');
    await page.click('#editreg-salvar'); await page.waitForTimeout(1200);
    const p = ultimoPost(calls, 'editarRegistro') || {};
    ok(p.key === 'admin' && p.aluno_id === 'demo' && p.pk === '1000' && p.exercicio === 'Puxada frontal' && !p.pin, 'trainer salva com editarRegistro, chave e aluno_id do dono do registro', JSON.stringify({ key: !!p.key, aluno: p.aluno_id, pk: p.pk, ex: p.exercicio }));
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${total - falhas}/${total} OK`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
