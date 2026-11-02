// Bateria das ABAS do aluno: painéis, histórico/voltar, TREINAR, modais, plano em colunas, load-more, desktop.
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
let falhas = 0, total = 0;
const ok = (cond, msg, extra) => { total++; if (!cond) falhas++; console.log(`${cond ? 'OK    ' : 'FALHA '} ${msg}${extra !== undefined && extra !== '' ? '  → ' + extra : ''}`); };

async function entrar(browser, { w = 390, h = 844, mutate, reduced, sw } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, locale: 'pt-BR', serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(v => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/503|net::ERR|Failed to load resource/.test(m.text())) erros.push('[console] ' + m.text().slice(0, 160)); });
  page.on('dialog', d => d.accept().catch(() => {}));
  await installMock(page, { mutateAluno: mutate });
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
  return { ctx, page, erros };
}

// visível de verdade = tem caixa e não está display:none em nenhum ancestral
const visivel = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const estado = page => page.evaluate(() => ({ aba: APP.alunoAba, attr: document.getElementById('view-aluno').dataset.aba, hash: location.hash, state: history.state, atual: [...document.querySelectorAll('#aluno-abas .aba[aria-current]')].map(b => b.dataset.aba) }));

(async () => {
  const browser = await chromium.launch();

  console.log('--- 1. estado inicial e painéis ---');
  {
    const { ctx, page, erros } = await entrar(browser);
    let st = await estado(page);
    ok(st.aba === 'treino' && st.attr === 'treino' && st.atual.join() === 'treino', 'abre no TREINO com aria-current só nele', JSON.stringify(st.atual));
    ok(await visivel(page, '#aluno-abas'), 'barra de abas visível no painel do aluno');
    const vis = {};
    for (const [k, sel] of Object.entries({ plano: '#aluno-plano', cta: '#btn-aluno-treinar', pronto: '#aluno-mapa-painel .pronto', mapa: '#aluno-mapa', peso: '#btn-aluno-peso', evolucao: '#aluno-historico-section', registrar: '#btn-aluno-registrar', notas: '#aluno-notas', sair: '.mais-conta button' })) vis[k] = await visivel(page, sel);
    ok(vis.plano && vis.cta && vis.pronto && !vis.mapa && !vis.peso && !vis.evolucao && !vis.registrar && !vis.notas && !vis.sair, 'TREINO mostra plano/CTA/pronto e esconde mapa, peso, evolução, ações e notas', JSON.stringify(vis));

    const esperado = {
      evolucao: { evolucao: true, plano: false, mapa: false, registrar: false },
      corpo: { peso: true, mapa: true, plano: false, evolucao: false, registrar: false },
      mais: { registrar: true, notas: true, sair: true, plano: false, mapa: false, evolucao: false },
    };
    const sels = { plano: '#aluno-plano', mapa: '#aluno-mapa', peso: '#btn-aluno-peso', evolucao: '#aluno-historico-section', registrar: '#btn-aluno-registrar', notas: '#aluno-notas', sair: '.mais-conta button' };
    for (const aba of ['evolucao', 'corpo', 'mais']) {
      await page.click(`#aluno-abas [data-aba="${aba}"]`); await page.waitForTimeout(350);
      st = await estado(page);
      ok(st.aba === aba && st.attr === aba && st.atual.join() === aba, `aba ${aba}: estado, data-aba e aria-current`, JSON.stringify(st.atual));
      const v = {}; for (const k of Object.keys(esperado[aba])) v[k] = await visivel(page, sels[k]);
      ok(Object.keys(esperado[aba]).every(k => v[k] === esperado[aba][k]), `aba ${aba}: painéis certos`, JSON.stringify(v));
      ok(await visivel(page, '#aluno-abas') && await visivel(page, '#view-aluno > header'), `aba ${aba}: barra e cabeçalho continuam visíveis`);
    }
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 2. botão voltar (history) ---');
  {
    const { ctx, page } = await entrar(browser);
    const len0 = await page.evaluate(() => history.length);
    await page.click('#aluno-abas [data-aba="evolucao"]'); await page.waitForTimeout(250);
    let st = await estado(page);
    ok(st.state && st.state.forjaAba === 'evolucao', 'ir pra EVOLUÇÃO empilha 1 entrada (state.forjaAba)', JSON.stringify(st.state));
    ok(await page.evaluate(l => history.length === l + 1, len0), 'história cresceu em 1 entrada');
    await page.click('#aluno-abas [data-aba="corpo"]'); await page.waitForTimeout(200);
    await page.click('#aluno-abas [data-aba="mais"]'); await page.waitForTimeout(200);
    ok(await page.evaluate(l => history.length === l + 1, len0), 'trocar entre abas não empilha mais (replaceState)');
    await page.goBack(); await page.waitForTimeout(400);
    st = await estado(page);
    ok(st.aba === 'treino' && st.hash.startsWith('#aluno/') && await visivel(page, '#view-aluno'), 'voltar na aba MAIS cai no TREINO e continua logado', `${st.aba} ${st.hash}`);
    await page.goBack(); await page.waitForTimeout(500);
    ok(await page.evaluate(() => location.hash === '' || location.hash === '#home'), 'segundo voltar sai do painel (comportamento de antes)', await page.evaluate(() => location.hash));
    await ctx.close();

    const b = await entrar(browser);
    await b.page.click('#aluno-abas [data-aba="corpo"]'); await b.page.waitForTimeout(250);
    const l1 = await b.page.evaluate(() => history.length);
    await b.page.click('#aluno-abas [data-aba="treino"]'); await b.page.waitForTimeout(450);
    st = await estado(b.page);
    ok(st.aba === 'treino' && st.state === null, 'tocar na aba TREINO desempilha a entrada (state volta a null)', JSON.stringify(st.state));
    await b.page.goBack(); await b.page.waitForTimeout(500);
    ok(await b.page.evaluate(() => location.hash === '' || location.hash === '#home'), 'depois de tocar em TREINO, UM voltar já sai do painel (sem entrada sobrando)', await b.page.evaluate(() => location.hash));
    await b.ctx.close();
  }

  console.log('--- 3. TREINAR, modais e atalhos ---');
  {
    const { ctx, page, erros } = await entrar(browser);
    await page.click('#btn-aluno-treinar'); await page.waitForTimeout(900);
    ok(await visivel(page, '#view-treinar') && !(await visivel(page, '#aluno-abas')), 'TREINAR cobre tudo e a barra some');
    await page.evaluate(() => encerrarTreinar()); await page.waitForTimeout(400);
    ok(await visivel(page, '#aluno-abas') && (await estado(page)).aba === 'treino', 'ao encerrar o TREINAR a barra volta, no TREINO');
    await page.click('#aluno-abas [data-aba="mais"]'); await page.waitForTimeout(250);
    await page.click('#btn-aluno-registrar'); await page.waitForTimeout(400);
    ok(await visivel(page, '#modal-registrar'), 'MAIS › LANÇAR SESSÃO abre o modal de sempre');
    await page.click('#modal-registrar button[aria-label="Fechar"]'); await page.waitForTimeout(200);
    ok(!(await visivel(page, '#modal-registrar')) && (await estado(page)).aba === 'mais', 'fechar o modal mantém a aba MAIS');
    await page.click('#btn-aluno-cardio'); await page.waitForTimeout(300);
    ok(await visivel(page, '#modal-cardio'), 'MAIS › CARDIO abre o modal');
    await page.click('#modal-cardio button[aria-label="Fechar"]'); await page.waitForTimeout(200);
    await page.click('#btn-aluno-console'); await page.waitForTimeout(900);
    ok((await estado(page)).hash === '#console' && !(await visivel(page, '#aluno-abas')), 'MAIS › CONSOLE abre a tela de console e a barra some', (await estado(page)).hash);
    await page.goBack(); await page.waitForTimeout(700);
    st = await estado(page);
    ok(st.hash.startsWith('#aluno/') && await visivel(page, '#aluno-abas'), 'voltar do CONSOLE traz o painel e a barra de volta', `${st.hash} aba=${st.aba}`);
    await page.click('#aluno-abas [data-aba="corpo"]'); await page.waitForTimeout(250);
    await page.click('#btn-aluno-peso'); await page.waitForTimeout(300);
    ok(await visivel(page, '#modal-peso'), 'CORPO › REGISTRAR abre o modal de peso');
    const resumo = await page.evaluate(() => [document.getElementById('pr-valor').textContent, document.getElementById('pr-sub').textContent]);
    ok(resumo[0] === '81.8' && /02\/11\/26/.test(resumo[1]) && /▼ 0\.2 kg/.test(resumo[1]), 'resumo de peso: último valor, data e variação', resumo.join(' | '));
    await page.click('#modal-peso button[aria-label="Fechar"]'); await page.waitForTimeout(200);
    await page.click('#aluno-abas [data-aba="treino"]'); await page.waitForTimeout(300);
    await page.click('#aluno-mapa-painel .pronto'); await page.waitForTimeout(300);
    ok((await estado(page)).aba === 'corpo', 'faixa "PRONTO PRA TREINAR" leva ao mapa (aba CORPO)');
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 3b. LANÇAR SESSÃO: o dia se escolhe dentro do modal (a ação fica na aba MAIS) ---');
  {
    const { ctx, page, erros } = await entrar(browser);
    await page.click('#aluno-abas [data-aba="mais"]'); await page.waitForTimeout(250);
    await page.click('#btn-aluno-registrar'); await page.waitForTimeout(400);
    let r = await page.evaluate(() => ({ titulo: document.getElementById('modal-reg-day').textContent, chips: [...document.querySelectorAll('#modal-reg-dias button')].map(b => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')).join(','), cards: document.querySelectorAll('#modal-reg-form [data-idx]').length }));
    ok(r.titulo === 'DIA A' && r.chips === 'A*,B,C,D' && r.cards === 6, 'abre no dia selecionado (A) com os 4 dias como opção', JSON.stringify(r));
    await page.click('#modal-reg-dias button:has-text("C")'); await page.waitForTimeout(400);
    r = await page.evaluate(() => ({ titulo: document.getElementById('modal-reg-day').textContent, chips: [...document.querySelectorAll('#modal-reg-dias button')].map(b => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')).join(','), cards: document.querySelectorAll('#modal-reg-form [data-idx]').length, dia: APP.alunoDay, visivel: !document.getElementById('modal-registrar').classList.contains('hidden') }));
    ok(r.titulo === 'DIA C' && r.chips === 'A,B,C*,D' && r.cards === 5 && r.dia === 'C' && r.visivel, 'tocar em C troca o formulário para o plano do dia C (5 exercícios) e mantém o modal aberto', JSON.stringify(r));
    await page.click('#modal-registrar button[aria-label="Fechar"]'); await page.waitForTimeout(200);
    await page.click('#aluno-abas [data-aba="treino"]'); await page.waitForTimeout(300);
    r = await page.evaluate(() => ({ cta: document.getElementById('btn-aluno-treinar-lbl').textContent, ativo: document.querySelector('#aluno-day-tabs .tab-btn.active').dataset.day, linhas: document.querySelectorAll('#aluno-plano .pl-row').length }));
    ok(/C$/.test(r.cta) && r.ativo === 'C' && r.linhas === 5, 'o dia escolhido no modal vale também no TREINO (CTA, seletor e plano)', JSON.stringify(r));
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
    const u = await entrar(browser, { mutate(o) { o.plano = o.plano.filter(p => p.dia === 'A'); } });
    await u.page.click('#aluno-abas [data-aba="mais"]'); await u.page.waitForTimeout(200);
    await u.page.click('#btn-aluno-registrar'); await u.page.waitForTimeout(300);
    ok(!(await visivel(u.page, '#modal-reg-dias')) && !(await visivel(u.page, '#aluno-day-tabs')), 'conta com um dia só: sem seletor de dia no modal nem no TREINO');
    await u.ctx.close();
  }

  console.log('--- 4. plano em colunas ---');
  {
    const { ctx, page, erros } = await entrar(browser, { w: 360, h: 740, mutate(out) {
      out.plano.forEach(p => { if (p.dia === 'A' && p.ordem === 4) p.exercicio = 'Elevação lateral máquina ou cross'; if (p.dia === 'A' && p.ordem === 3) p.carga = '35kg por lado'; if (p.dia === 'A' && p.ordem === 5) p.exercicio = 'Glúteo 4 apoios ou chute na polia baixa'; });
    } });
    const linhas = await page.evaluate(() => [...document.querySelectorAll('#aluno-plano .pl-row')].map(r => ({ h: Math.round(r.getBoundingClientRect().height), cols: [...r.querySelectorAll('.pl-grid > div')].map(d => Math.round(d.getBoundingClientRect().left)), over: r.scrollWidth > r.clientWidth + 1 })));
    ok(linhas.length === 6, 'dia A: 6 linhas', String(linhas.length));
    const semObs = linhas.filter((_, i) => i >= 3).map(l => l.h);
    ok(linhas.every(l => !l.over), 'nenhuma linha estoura a largura em 360px (nomes longos e carga "35kg por lado")');
    ok(linhas.every(l => l.cols.join() === linhas[0].cols.join()), 'as 4 colunas ficam alinhadas (mesmo x) em todas as linhas', JSON.stringify(linhas[0].cols));
    ok(Math.min(...linhas.map(l => l.h)) < 125, 'linha mais baixa < 125px (cartão antigo ~125px)', 'min=' + Math.min(...linhas.map(l => l.h)) + 'px');
    const sem = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(sem, 'página sem rolagem horizontal');
    // seletor de dia
    const labelAntes = await page.evaluate(() => document.getElementById('btn-aluno-treinar-lbl').textContent);
    await page.click('#aluno-day-tabs [data-day="B"]'); await page.waitForTimeout(250);
    const depois = await page.evaluate(() => ({ lbl: document.getElementById('btn-aluno-treinar-lbl').textContent, n: document.querySelectorAll('#aluno-plano .pl-row').length, pressed: [...document.querySelectorAll('#aluno-day-tabs .tab-btn')].map(b => b.getAttribute('aria-pressed')).join(), cab: document.getElementById('aluno-plano-cab').textContent.replace(/\s+/g, ' ').trim() }));
    ok(/B$/.test(depois.lbl) && depois.n === 5 && depois.pressed === 'false,true,false,false', 'dia B: CTA, 5 linhas, aria-pressed', JSON.stringify(depois));
    ok(/PLANO · DIA B · 5 exercícios/.test(depois.cab) && /COMPOSTO 2-3min · ISOLADO 1-2min/.test(depois.cab), 'cabeçalho do plano com contagem e legenda do descanso', depois.cab);
    await page.click('#aluno-day-tabs [data-day="A"]'); await page.waitForTimeout(200);
    // ficha ⓘ (delegado) e acordeão de regras
    await page.click('#aluno-plano button.pl-ex >> nth=0'); await page.waitForTimeout(350);
    ok(await visivel(page, '#modal-exinfo'), 'tocar no nome abre a ficha do exercício (clique delegado)');
    await page.click('#modal-exinfo button[aria-label="Fechar"]'); await page.waitForTimeout(150);
    const btn = page.locator('#aluno-plano .obs-fold-btn').first();
    await btn.click(); await page.waitForTimeout(200);
    const aberto = await page.evaluate(() => { const b = document.querySelector('#aluno-plano .obs-fold-btn'); return [b.getAttribute('aria-expanded'), !document.getElementById(b.getAttribute('aria-controls')).hasAttribute('hidden')]; });
    ok(aberto[0] === 'true' && aberto[1], 'acordeão "REGRA E OBSERVAÇÕES" abre dentro da nova linha', aberto.join());
    // teclado: Enter no botão do nome
    await page.focus('#aluno-plano button.pl-ex >> nth=1'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    ok(await visivel(page, '#modal-exinfo'), 'Enter no nome do exercício abre a ficha (é <button>)');
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 5. EVOLUÇÃO: 12 sessões + carregar mais ---');
  {
    const { ctx, page, erros } = await entrar(browser);
    await page.click('#aluno-abas [data-aba="evolucao"]'); await page.waitForTimeout(700);
    const n0 = await page.evaluate(() => document.querySelectorAll('#evo-historico-aluno > .glass').length);
    const btnTxt = await page.evaluate(() => (document.querySelector('#evo-historico-aluno .btn-evo-load-more') || {}).textContent);
    ok(n0 === 12 && /CARREGAR MAIS \(16 sessoes restantes\)/.test(btnTxt || ''), 'abre com 12 sessões e botão "CARREGAR MAIS (16 …)"', `n=${n0} | ${btnTxt}`);
    await page.click('#evo-historico-aluno .btn-evo-load-more'); await page.waitForTimeout(300);
    const todos = await page.evaluate(() => [...document.querySelectorAll('#evo-historico-aluno > .glass')].map(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)));
    ok(todos.length === 28 && new Set(todos).size === 28, 'carregar mais traz as 28 sessões, sem repetir nenhuma', `n=${todos.length} únicas=${new Set(todos).size}`);
    ok(await page.evaluate(() => !document.querySelector('#evo-historico-aluno .btn-evo-load-more')), 'botão some quando acabou');
    // v30.31.1: o CARREGAR MAIS religava os botões dos cards já renderizados (2º listener): 1 toque na lixeira = 2 confirm() e 2 remoções
    let dialogos = 0, remocoes = 0;
    page.on('dialog', () => { dialogos++; });
    page.on('request', r => { if (/rpc\/api_post/.test(r.url()) && /removerRegistroAluno/.test(r.postData() || '')) remocoes++; });
    await page.evaluate(() => document.querySelector('#evo-historico-aluno .btn-del-reg').click()); await page.waitForTimeout(900);
    ok(dialogos === 1 && remocoes === 1, 'apagar um registro depois do CARREGAR MAIS pede 1 confirmação e faz 1 remoção', `confirms=${dialogos} remocoes=${remocoes}`);
    const dias = await page.evaluate(() => { const c = [...document.querySelectorAll('#evo-stats-aluno .glass')].find(x => /A \/ B/.test(x.textContent)); const v = c.querySelector('.display span'); return { h: Math.round(v.getBoundingClientRect().height), fs: getComputedStyle(v).fontSize }; });
    ok(dias.h < 40, 'card "sessões por dia" fica em 1 linha em 390px', JSON.stringify(dias));
    // refresh em background com a aba aberta não derruba nada
    await page.click('#aluno-abas [data-aba="treino"]'); await page.waitForTimeout(200);
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();
  }

  console.log('--- 6. cada aba lembra a rolagem + toque repetido volta ao topo ---');
  {
    const { ctx, page } = await entrar(browser);
    await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(150);
    await page.click('#aluno-abas [data-aba="corpo"]'); await page.waitForTimeout(250);
    ok(await page.evaluate(() => window.scrollY) === 0, 'trocar de aba abre no topo');
    await page.evaluate(() => window.scrollTo(0, 300)); await page.click('#aluno-abas [data-aba="treino"]'); await page.waitForTimeout(300);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    ok(Math.abs(y - 400) <= 2, 'voltar ao TREINO restaura onde parou (400px)', 'scrollY=' + y);
    await page.click('#aluno-abas [data-aba="treino"]'); await page.waitForTimeout(700);
    ok(await page.evaluate(() => window.scrollY) < 5, 'tocar na aba ativa leva ao topo', 'scrollY=' + await page.evaluate(() => Math.round(window.scrollY)));
    await ctx.close();
  }

  console.log('--- 7. desktop 1280, banner de instalar, logout, movimento reduzido ---');
  {
    const { ctx, page, erros } = await entrar(browser, { w: 1280, h: 800 });
    const r = await page.evaluate(() => { const n = document.getElementById('aluno-abas').getBoundingClientRect(); return { w: Math.round(n.width), centro: Math.round(n.left + n.width / 2), b: Math.round(innerHeight - n.bottom) }; });
    ok(r.w <= 544 && Math.abs(r.centro - 640) <= 2, 'barra centralizada e limitada a 34rem no desktop', JSON.stringify(r));
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal em 1280');
    await page.evaluate(() => document.getElementById('install-banner').classList.remove('hidden'));
    const sobrepoe = await page.evaluate(() => { const b = document.getElementById('install-banner').getBoundingClientRect(), n = document.getElementById('aluno-abas').getBoundingClientRect(); return b.bottom > n.top + 1; });
    ok(!sobrepoe, 'aviso de instalar fica acima da barra (não a cobre)');
    await page.evaluate(() => document.getElementById('install-banner').classList.add('hidden'));
    await page.click('#aluno-abas [data-aba="mais"]'); await page.waitForTimeout(250);
    await page.click('.mais-conta button'); await page.waitForTimeout(700);
    ok(await page.evaluate(() => !!document.getElementById('view-home') && !document.getElementById('view-home').classList.contains('hidden')) && !(await visivel(page, '#aluno-abas')), 'SAIR DA CONTA volta ao login e a barra some');
    ok(await page.evaluate(() => !document.body.classList.contains('tem-abas')), 'classe tem-abas removida do body');
    await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    ok((await estado(page)).aba === 'treino' && await visivel(page, '#aluno-abas'), 'novo login abre de novo no TREINO');
    ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
    await ctx.close();

    const rm = await entrar(browser, { reduced: true });
    await rm.page.click('#aluno-abas [data-aba="evolucao"]'); await rm.page.waitForTimeout(300);
    const trans = await rm.page.evaluate(() => getComputedStyle(document.querySelector('#aluno-abas .aba')).transitionDuration);
    ok(/^0s/.test(trans), 'prefers-reduced-motion: sem transição nas abas', trans);
    ok(rm.erros.length === 0, 'sem erros de JS (movimento reduzido)', rm.erros.join(' | '));
    await rm.ctx.close();
  }

  await browser.close();
  console.log(`\n${total - falhas}/${total} checagens OK${falhas ? ' — ' + falhas + ' FALHA(S)' : ''}`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
