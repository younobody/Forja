// Parte 1: o dia que abre selecionado é o "próximo treino" da rotação (frcRotacao).
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
let falhas = 0, total = 0;
const ok = (c, m, x) => { total++; if (!c) falhas++; console.log(`${c ? 'OK    ' : 'FALHA '} ${m}${x !== undefined && x !== '' ? '  → ' + x : ''}`); };
const hoje = new Date();
const ymd = n => { const d = new Date(hoje.getTime() - n * 86400000); return d.toISOString().slice(0, 10); };

// reescreve os registros: um treino por dia do plano, com "há N dias" definido por dia (null = nunca treinado)
function regsPorDia(out, ha, extra) {
  const regs = [];
  Object.entries(ha).forEach(([dia, n]) => {
    if (n == null) return;
    out.plano.filter(p => p.dia === dia).forEach((p, i) => regs.push({ timestamp: new Date(hoje.getTime() - n * 86400000 + i * 60000).toISOString(), aluno_id: 'demo', dia, exercicio: p.exercicio, carga: '50', reps: '10', rir: '2', completou: 'sim', obs: '', data_treino: ymd(n), modalidade: '', local_id: `t${dia}${n}${i}` }));
  });
  (extra || []).forEach(e => regs.push(e));
  out.registros = regs.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

async function abre(browser, mutate) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript((v) => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
  const page = await ctx.newPage(); page.on('dialog', d => d.accept().catch(() => {}));
  const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  await installMock(page, { mutateAluno: mutate });
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
  return { ctx, page, erros };
}
const estado = page => page.evaluate(() => ({
  dia: APP.alunoDay,
  cta: document.getElementById('btn-aluno-treinar-lbl').textContent,
  ativo: (document.querySelector('#aluno-day-tabs .tab-btn.active') || {}).dataset && document.querySelector('#aluno-day-tabs .tab-btn.active').dataset.day,
  pilula: document.getElementById('aluno-prox').classList.contains('hidden') ? null : document.getElementById('aluno-prox').textContent,
  ponto: [...document.querySelectorAll('#aluno-day-tabs .tab-btn')].filter(b => b.querySelector('.dia-prox')).map(b => b.dataset.day).join(','),
  linhas: document.querySelectorAll('#aluno-plano .pl-row').length,
  rot: frcRotacao().map(r => r.d + ':' + (r.dias == null ? 'nunca' : r.dias)).join(' '),
}));

(async () => {
  const browser = await chromium.launch();
  const cenarios = [
    ['ciclo A→D→B→C, último foi C (dados do mock)', null, 'A'],
    ['A treinado ontem; D é o mais antigo (9d)', o => regsPorDia(o, { A: 1, B: 5, C: 3, D: 9 }), 'D'],
    ['dia D nunca treinado vence de todos', o => regsPorDia(o, { A: 8, B: 6, C: 4, D: null }), 'D'],
    ['empate B e C (5d): desempata pela letra', o => regsPorDia(o, { A: 1, B: 5, C: 5, D: 2 }), 'B'],
    ['cardio recente não conta (A segue o mais atrasado)', o => regsPorDia(o, { A: 7, B: 3, C: 2, D: 1 }, [{ timestamp: new Date().toISOString(), aluno_id: 'demo', dia: '', exercicio: 'Pedal', carga: '', reps: '', rir: '', completou: 'sim', obs: '30min', data_treino: ymd(0), modalidade: 'pedal', local_id: 'cardio1' }]), 'A'],
  ];
  for (const [nome, mut, esperado] of cenarios) {
    const { ctx, page, erros } = await abre(browser, mut || undefined);
    const e = await estado(page);
    const plano = { A: 6, B: 5, C: 5, D: 4 }[esperado];
    ok(e.dia === esperado && e.ativo === esperado && /· ?([A-E])$/.exec(e.cta)[1] === esperado && e.pilula === 'PRÓXIMO: ' + esperado && e.ponto === esperado && e.linhas === plano, `abre no dia ${esperado}: ${nome}`, `dia=${e.dia} cta="${e.cta}" pílula=${e.pilula} ponto=${e.ponto} linhas=${e.linhas} | rotação: ${e.rot}`);
    ok(erros.length === 0, '   sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- escolha manual x dado novo x fim do treino ---');
  {
    const { ctx, page, erros } = await abre(browser, o => regsPorDia(o, { A: 1, B: 5, C: 3, D: 9 }));   // próximo = D
    await page.click('#aluno-day-tabs [data-day="B"]'); await page.waitForTimeout(250);
    let e = await estado(page);
    ok(e.dia === 'B' && e.ponto === 'D' && e.pilula === 'PRÓXIMO: D', 'tocar em B muda o dia, mas o ponto e a pílula seguem no D (a sugestão)', JSON.stringify({ dia: e.dia, ponto: e.ponto, pilula: e.pilula }));
    await page.evaluate(() => { APP.data = JSON.parse(JSON.stringify(APP.data)); renderAlunoDashboard(); });   // refresh em background, mesmo dado
    e = await estado(page);
    ok(e.dia === 'B', 'refresh em background com o mesmo dado NÃO desfaz a escolha manual (B)', e.dia);
    await page.click('#aluno-day-tabs [data-day="C"]'); await page.waitForTimeout(200);
    ok((await estado(page)).dia === 'C', 'escolher C manualmente (a sugestão é D)');
    await page.evaluate(() => { const d = JSON.parse(JSON.stringify(APP.data)); const hoje = new Date().toISOString().slice(0, 10); d.plano.filter(p => p.dia === 'D').forEach((p, i) => d.registros.unshift({ timestamp: new Date(Date.now() + i * 1000).toISOString(), aluno_id: 'demo', dia: 'D', exercicio: p.exercicio, carga: '40', reps: '10', rir: '2', completou: 'sim', obs: '', data_treino: hoje, modalidade: '', local_id: 'novo' + i })); APP.data = d; renderAlunoDashboard(); });
    e = await estado(page);
    ok(e.dia === 'B' && e.ponto === 'B' && e.pilula === 'PRÓXIMO: B' && /^B:5/.test(e.rot), 'dado novo (treinou D) muda o próximo para B (o mais atrasado: 5d): o dia sai do C manual e acompanha a sugestão', JSON.stringify({ dia: e.dia, ponto: e.ponto, rot: e.rot }));
    await page.click('#aluno-day-tabs [data-day="C"]'); await page.waitForTimeout(200);
    ok((await estado(page)).dia === 'C', 'escolher C de novo, manualmente (sugestão: B)');
    await page.evaluate(async () => { try { await finalizarTreinar(); } catch (e) { window.__erroFinalizar = String(e); } });
    await page.waitForTimeout(700);
    e = await estado(page);
    const vencedor = e.rot.split(' ')[0].split(':')[0];
    ok(e.dia !== 'C' && e.dia === vencedor && e.ativo === vencedor && !(await page.evaluate(() => window.__erroFinalizar)), 'ao terminar um treino o dia volta a seguir a rotação (dados recarregados do servidor), mesmo com C escolhido a mão', JSON.stringify({ dia: e.dia, vencedor, rot: e.rot }));
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- sem plano / um dia só ---');
  {
    const a = await abre(browser, o => { o.plano = []; o.registros = []; });
    const ea = await a.page.evaluate(() => ({ pilula: !document.getElementById('aluno-prox').classList.contains('hidden'), ponto: document.querySelectorAll('.dia-prox').length, seletor: !document.getElementById('aluno-day-tabs').classList.contains('hidden') }));
    ok(!ea.pilula && ea.ponto === 0 && !ea.seletor, 'conta sem plano: sem pílula, sem ponto e sem seletor', JSON.stringify(ea));
    ok(a.erros.length === 0, 'sem erros de JS', a.erros.join(' | ')); await a.ctx.close();
    const b = await abre(browser, o => { o.plano = o.plano.filter(p => p.dia === 'B'); o.registros = o.registros.filter(r => r.dia === 'B'); });
    const eb = await b.page.evaluate(() => ({ dia: APP.alunoDay, pilula: !document.getElementById('aluno-prox').classList.contains('hidden'), seletor: !document.getElementById('aluno-day-tabs').classList.contains('hidden'), cta: document.getElementById('btn-aluno-treinar-lbl').textContent, linhas: document.querySelectorAll('#aluno-plano .pl-row').length }));
    ok(eb.dia === 'B' && !eb.pilula && !eb.seletor && /B$/.test(eb.cta) && eb.linhas === 5, 'conta com um dia só (B): abre no B, sem pílula nem seletor', JSON.stringify(eb));
    ok(b.erros.length === 0, 'sem erros de JS', b.erros.join(' | ')); await b.ctx.close();
  }

  console.log('--- troca de conta no mesmo navegador ---');
  {
    const { ctx, page, erros } = await abre(browser, o => regsPorDia(o, { A: 1, B: 5, C: 3, D: 9 }));
    await page.click('#aluno-day-tabs [data-day="B"]'); await page.waitForTimeout(150);
    await page.evaluate(() => logout()); await page.waitForTimeout(400);
    await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    ok((await estado(page)).dia === 'D', 'depois de sair e entrar de novo, volta ao próximo da rotação (D), não ao B escolhido antes', (await estado(page)).dia);
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${total - falhas}/${total} checagens OK${falhas ? ' — ' + falhas + ' FALHA(S)' : ''}`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
