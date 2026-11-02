// Bateria do editor do plano do trainer (v30.31.0): cartões no celular, tabela no desktop, meta preservada ao salvar.
const { chromium } = require('playwright');
const fs = require('fs');
const { installMock } = require('./mock');
const { URL, VER, AXE } = require('./common');
let falhas = 0, total = 0;
const ok = (c, m, x) => { total++; if (!c) falhas++; console.log(`${c ? 'OK    ' : 'FALHA '} ${m}${x !== undefined && x !== '' ? '  → ' + x : ''}`); };

async function abre(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript((v) => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
  const page = await ctx.newPage();
  const erros = [], posts = [];
  page.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('request', r => { if (r.method() === 'POST' && /rpc\/api_post/.test(r.url())) { try { posts.push(JSON.parse(r.postData()).payload); } catch (e) {} } });
  await installMock(page, {});
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', 'admin'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  await page.evaluate(() => navigateTo('#trainer/edit/demo')); await page.waitForTimeout(1600);
  return { ctx, page, erros, posts };
}
const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);

(async () => {
  const browser = await chromium.launch();

  for (const [w, h] of [[360, 740], [390, 844], [320, 640]]) {
    console.log(`--- celular ${w}px ---`);
    const { ctx, page, erros } = await abre(browser, w, h);
    const g = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, iw: innerWidth,
      botoes: ['btn-export-aluno', 'btn-share-aluno', 'btn-remover-aluno'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id.replace('btn-', '').replace('-aluno', ''), Math.round(r.left), Math.round(r.right)]; }),
      headerPos: getComputedStyle(document.querySelector('#view-edit-aluno > header')).position,
      titulo: document.getElementById('edit-aluno-title').textContent,
    }));
    ok(g.sw <= g.iw, 'a página não rola na horizontal (antes: 486px numa tela de 360)', `${g.sw} ≤ ${g.iw}`);
    ok(g.botoes.every(b => b[1] >= 0 && b[2] <= g.iw), 'EXPORTAR, COMPARTILHAR e REMOVER cabem na tela', JSON.stringify(g.botoes));
    const corte = await page.evaluate(() => ['btn-export-aluno', 'btn-share-aluno', 'btn-remover-aluno'].map(id => { const b = document.getElementById(id); return [b.textContent.trim(), b.scrollWidth - b.clientWidth, Math.round(b.getBoundingClientRect().width)]; }));
    ok(corte.every(c => c[1] <= 0), 'o texto dos 3 botões do cabeçalho não é cortado (antes "COMPARTILHAR" encostava na borda)', JSON.stringify(corte));
    ok(g.headerPos === 'static' && /Aluno Demo/i.test(g.titulo), 'cabeçalho em 2 linhas, sem sticky; título "Aluno Demo" visível', g.headerPos);

    const c = await page.evaluate(() => {
      const trs = [...document.querySelectorAll('#plano-tbody > tr')];
      const t0 = trs[0];
      const campos = [...t0.querySelectorAll('input, select')];
      const rot = [...t0.querySelectorAll('td')].map(td => getComputedStyle(td, '::before').content);
      return {
        n: trs.length, grid: getComputedStyle(t0).display, thead: getComputedStyle(document.querySelector('#plano-table thead')).display,
        minAlt: Math.min(...[...document.querySelectorAll('#plano-tbody input, #plano-tbody select')].map(i => Math.round(i.getBoundingClientRect().height))),
        larg: campos.map(i => Math.round(i.getBoundingClientRect().width)),
        cortados: campos.filter(i => i.tagName === 'INPUT' && i.scrollWidth > i.clientWidth + 1 && ['series', 'reps', 'carga', 'rir', 'meta'].includes(i.dataset.f)).map(i => i.dataset.f + '=' + i.value),
        rot, meta0: campos.find(i => i.dataset.f === 'meta').value, nome0: campos[0].value,
        ordemDOM: campos.map(i => i.dataset.f),
        leitura: campos.map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.top / 20), r.left]; }),
      };
    });
    ok(c.n === 6 && c.grid === 'grid' && c.thead === 'none', 'cada exercício é um cartão (grid) e o cabeçalho da tabela some', `${c.n} cartões, display=${c.grid}`);
    ok(c.minAlt >= 44, 'todos os campos têm ≥ 44px de altura', 'min=' + c.minAlt);
    ok(c.larg[0] >= w - 120, 'nome do exercício com a largura do cartão (antes: 71px, "Supir")', `${c.larg[0]}px`);
    ok(c.cortados.length === 0, 'séries, reps, carga, RIR e alvo mostram o valor inteiro (sem cortar)', c.cortados.join(', '));
    ok(c.rot.filter(x => x !== 'none' && x !== 'normal').length >= 8 && c.rot.includes('"SÉRIES"') && c.rot.includes('"ALVO (KG)"') && c.rot.some(x => /EXERCÍCIO .*counter\(exn/.test(x)), 'cada campo tem rótulo visível (SÉRIES, REPS, CARGA, RIR, TIPO, ALVO, OBSERVAÇÃO; EXERCÍCIO 01)', c.rot.join(' '));
    ok(c.meta0 === '80kg', 'ALVO carregado do plano (antes abria vazio)', c.meta0);
    // ordem de leitura (linha, depois coluna) == ordem do DOM => o foco do teclado não pula
    const idx = c.leitura.map((p, i) => [p[0], p[1], i]);
    const lida = [...idx].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
    ok(lida.every((v, i) => v === i), 'a ordem visual dos campos é a do DOM (Tab não pula)', c.ordemDOM.join('>'));
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- edição, botões e salvar (390px) ---');
  {
    const { ctx, page, erros, posts } = await abre(browser, 390, 844);
    const campo = (i, f) => `#plano-tbody input[data-i="${i}"][data-f="${f}"]`;
    await page.fill(campo(0, 'exercicio'), 'Supino reto com barra'); await page.fill(campo(0, 'series'), '5'); await page.fill(campo(0, 'reps'), '6-8');
    await page.fill(campo(0, 'carga'), '65'); await page.fill(campo(0, 'rir'), '1-2'); await page.fill(campo(0, 'meta'), '90kg'); await page.fill(campo(0, 'obs'), 'sem falha');
    await page.selectOption('#plano-tbody select[data-i="0"]', 'isolado');
    let e0 = await page.evaluate(() => APP.editPlano.A[0]);
    ok(e0.exercicio === 'Supino reto com barra' && e0.series === '5' && e0.reps === '6-8' && e0.carga === '65' && e0.rir === '1-2' && e0.meta === '90kg' && e0.obs === 'sem falha' && e0.tipo === 'isolado', 'digitar nos 8 campos do cartão atualiza APP.editPlano', JSON.stringify(e0));
    await page.click('#plano-tbody button[data-act="down"][data-i="0"]'); await page.waitForTimeout(150);
    let nomes = await page.evaluate(() => APP.editPlano.A.map(e => e.exercicio).slice(0, 2));
    ok(nomes[1] === 'Supino reto com barra', '▼ desce o exercício', nomes.join(' / '));
    await page.click('#plano-tbody button[data-act="up"][data-i="1"]'); await page.waitForTimeout(150);
    nomes = await page.evaluate(() => APP.editPlano.A.map(e => e.exercicio).slice(0, 2));
    ok(nomes[0] === 'Supino reto com barra', '▲ sobe de volta', nomes.join(' / '));
    await page.click('#plano-tbody button[data-act="lancar"][data-i="0"]'); await page.waitForTimeout(350);
    ok(await vis(page, '#modal-lancar-individual'), 'LANÇAR abre o modal de lançamento individual'); await page.click('#modal-lancar-individual button[aria-label="Fechar"]'); await page.waitForTimeout(150);
    await page.click('#plano-tbody button[data-act="del"][data-i="5"]'); await page.waitForTimeout(150);
    ok(await page.evaluate(() => APP.editPlano.A.length) === 5, '✕ remove o último exercício (5 restam)');
    await page.click('#btn-add-exercise'); await page.waitForTimeout(500);
    let foco = await page.evaluate(() => { const a = document.activeElement; return { f: a.dataset.f, i: a.dataset.i, n: APP.editPlano.A.length, topo: Math.round(a.getBoundingClientRect().top), h: innerHeight }; });
    ok(foco.n === 6 && foco.f === 'exercicio' && foco.i === '5' && foco.topo > 0 && foco.topo < foco.h, '"+ EXERCICIO" do topo adiciona o cartão novo, põe o cursor no nome e o traz pra tela', JSON.stringify(foco));
    await page.evaluate(() => document.querySelector('.ed-fim').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
    ok(await vis(page, '.ed-fim .btn-success') && await vis(page, '.ed-fim .btn:not(.btn-success)'), 'botões do fim da lista visíveis no celular');
    await page.click('.ed-fim .btn:not(.btn-success)'); await page.waitForTimeout(500);
    foco = await page.evaluate(() => ({ n: APP.editPlano.A.length, i: document.activeElement.dataset.i, f: document.activeElement.dataset.f }));
    ok(foco.n === 7 && foco.i === '6' && foco.f === 'exercicio', '"+ EXERCICIO" do fim também adiciona e foca', JSON.stringify(foco));
    await page.fill(campo(6, 'exercicio'), 'Crucifixo máquina');
    posts.length = 0;
    await page.evaluate(() => document.querySelector('.ed-fim .btn-success').scrollIntoView({ block: 'center' })); await page.click('.ed-fim .btn-success'); await page.waitForTimeout(600);
    const sp = posts.find(p => p.action === 'salvarPlano');
    ok(!!sp && sp.aluno_id === 'demo', 'SALVAR PLANO do fim dispara salvarPlano para o aluno certo', sp && sp.aluno_id);
    if (sp) {
      const A = sp.plano.filter(x => x.dia === 'A'), B = sp.plano.filter(x => x.dia === 'B');
      ok(sp.plano.length === 20 && A.length === 6 && B.length === 5, 'o payload leva os 4 dias: A = 5 originais (1 removido) + o novo com nome (o cartão novo sem nome fica de fora); B 5, C 5, D 4 = 20', `${sp.plano.length} itens (A=${A.length}, B=${B.length})`);
      ok(A[0].exercicio === 'Supino reto com barra' && A[0].meta === '90kg', 'meta editada vai no payload (90kg)', A[0].meta);
      ok(B.length === 5 && B.every(x => x.meta && x.meta !== ''), 'os dias NÃO editados (B) mandam a meta que já tinham (antes iam sem meta e o banco zerava)', B.map(x => x.meta).join(','));
      ok(sp.plano.filter(x => x.exercicio === 'Crucifixo máquina').length === 1 && sp.plano.every(x => x.exercicio.trim()), 'exercício novo vai e linhas sem nome ficam de fora');
    }
    await page.click('#view-edit-aluno .tab-btn[data-day="B"]'); await page.waitForTimeout(250);
    ok(await page.evaluate(() => document.querySelectorAll('#plano-tbody > tr').length) === 5, 'aba B do editor: 5 cartões');
    await page.click('#view-edit-aluno .tab-btn[data-day="E"]'); await page.waitForTimeout(250);
    const vazio = await page.evaluate(() => { const tr = document.querySelector('#plano-tbody > tr.pl-vazio'); const r = tr && tr.getBoundingClientRect(); return tr ? { disp: getComputedStyle(tr).display, w: Math.round(r.width), txt: tr.textContent.trim().slice(0, 40) } : null; });
    ok(vazio && vazio.disp === 'block' && vazio.w > 200 && /Sem exercicios/.test(vazio.txt), 'dia sem exercícios mostra o aviso (não vira cartão vazio)', JSON.stringify(vazio));
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- tablet 768 e desktop 1280: segue a tabela ---');
  for (const [w, h] of [[768, 1024], [1280, 800]]) {
    const { ctx, page, erros } = await abre(browser, w, h);
    const d = await page.evaluate(() => ({
      thead: getComputedStyle(document.querySelector('#plano-table thead')).display, tr: getComputedStyle(document.querySelector('#plano-tbody > tr')).display,
      fim: getComputedStyle(document.querySelector('.ed-fim')).display, hd: getComputedStyle(document.querySelector('#view-edit-aluno > header')).position,
      sw: document.documentElement.scrollWidth <= innerWidth, meta: document.querySelector('#plano-tbody input[data-f="meta"]').value, linhaH: Math.round(document.querySelector('#plano-tbody > tr').getBoundingClientRect().height),
    }));
    ok(d.thead !== 'none' && d.tr === 'table-row' && d.fim === 'none' && d.hd === 'sticky' && d.sw && d.meta === '80kg', `${w}px: tabela, cabeçalho sticky, botões do fim ocultos, meta carregada`, JSON.stringify(d));
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- axe na tela de edição ---');
  for (const [w, h] of [[360, 740], [1280, 800]]) {
    const { ctx, page } = await abre(browser, w, h);
    await page.evaluate(AXE);
    const r = await page.evaluate(async () => { const res = await axe.run(document.getElementById('view-edit-aluno'), { resultTypes: ['violations'], rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } } }); return res.violations.map(v => v.id + ' [' + v.impact + '] x' + v.nodes.length + ' ' + (v.nodes[0].target || []).join(' ').slice(0, 60)); });
    ok(r.length === 0, `axe ${w}px: sem violações`, r.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${total - falhas}/${total} checagens OK${falhas ? ' — ' + falhas + ' FALHA(S)' : ''}`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
