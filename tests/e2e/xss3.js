// Varredura de sinks: instrumenta innerHTML/outerHTML/insertAdjacentHTML e registra qualquer HTML
// que chegue ao DOM com o payload NÃO escapado. Percorre trainer e aluno, com payload em todos os campos livres.
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
const P = f => `"'><img src=x onerror=__pwn.push('${f}')>`;
const CAMPOS_REG = ['exercicio', 'obs', 'carga', 'reps', 'rir', 'dia', 'modalidade', 'data_treino', 'local_id', 'completou'];

const INIT = () => {
  window.__pwn = []; window.__PWN = window.__pwn; Array.prototype.PUSH = Array.prototype.push;
  window.__sinks = [];
  const re = /<img\s+src=x\s+onerror=/i;
  const log = (kind, html) => {
    if (typeof html !== 'string') return;
    const i = html.search(re); if (i < 0) return;
    const m = /__pwn\.push\('([^']*)'\)/i.exec(html.slice(i));
    window.__sinks.push({ kind, campo: m && m[1], stack: new Error().stack.split('\n').slice(2, 7).map(s => s.trim().replace(/\(?https?:\/\/[^/]+\/forja\.html:?/, '(').replace(/^at /, '')).join(' < ') });
  };
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { set(v) { log('innerHTML', v); return d.set.call(this, v); }, get() { return d.get.call(this); }, configurable: true });
  const o = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');
  Object.defineProperty(Element.prototype, 'outerHTML', { set(v) { log('outerHTML', v); return o.set.call(this, v); }, get() { return o.get.call(this); }, configurable: true });
  const ia = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (p, h) { log('insertAdjacentHTML', h); return ia.call(this, p, h); };
  try { localStorage.setItem('forja-last-version', 'v30.28.0'); } catch (e) {}
};

function mutReg(registros, pref) {
  const idx = registros.map((r, i) => [r.timestamp, i]).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, CAMPOS_REG.length).map(x => x[1]);
  CAMPOS_REG.forEach((campo, k) => { registros[idx[k]][campo] = P(pref + campo); });
}

async function sessao(browser, papel, opts, passos) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e).slice(0, 140)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await installMock(page, opts);
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', papel === 'trainer' ? 'admin' : '1234');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  await passos(page);
  const sinks = await page.evaluate(() => window.__sinks);
  const pwn = await page.evaluate(() => window.__pwn);
  await ctx.close();
  return { sinks, pwn, erros };
}

// clica (sem esperar muito) em todos os controles "seguros" visíveis de um container
async function clicaTudo(page, seletor, evita) {
  const n = await page.evaluate(s => document.querySelectorAll(s).length, seletor);
  for (let i = 0; i < n; i++) {
    await page.evaluate(({ s, i, evita }) => {
      const el = document.querySelectorAll(s)[i]; if (!el) return;
      const t = ((el.textContent || '') + ' ' + (el.getAttribute('onclick') || '') + ' ' + el.id).toLowerCase();
      if (new RegExp(evita).test(t)) return;
      const r = el.getBoundingClientRect(); if (!r.width) return;
      try { el.click(); } catch (e) {}
    }, { s: seletor, i, evita });
    await page.waitForTimeout(25);
  }
}

const EVITA = 'remover|excluir|apagar|deletar|sair|logout|importar|compartilhar|exportar|salvar|enviar|✕|fechei|faltei';

let achados = 0;   // payloads executados + HTML com payload sem escape que chegou ao DOM; qualquer um faz o processo sair com 1
function relatorio(titulo, r) {
  achados += r.pwn.length + r.sinks.length;
  console.log(`\n##### ${titulo}`);
  console.log('payloads EXECUTADOS (campos):', JSON.stringify([...new Set(r.pwn.map(x => String(x).toLowerCase()))]));
  const porCampo = {};
  r.sinks.forEach(s => { const k = (s.campo || '?').toLowerCase(); (porCampo[k] = porCampo[k] || new Set()).add(s.kind + ' @ ' + s.stack.split(' < ').slice(0, 3).join(' < ')); });
  Object.entries(porCampo).forEach(([k, v]) => { console.log(`  campo ${k}:`); [...v].slice(0, 4).forEach(x => console.log('     -', x)); });
  if (!r.sinks.length) console.log('  (nenhum HTML com payload sem escape chegou ao DOM)');
  if (r.erros.length) console.log('  pageerrors:', JSON.stringify([...new Set(r.erros)].slice(0, 4)));
}

(async () => {
  const browser = await chromium.launch();

  // ---------- TRAINER ----------
  const tr = await sessao(browser, 'trainer', {
    mutateAdmin(out) { mutReg(out.registros, 'T.'); out.alunos[1].nome = P('T.aluno.nome'); out.alunos[1].objetivo = P('T.aluno.objetivo'); },
  }, async page => {
    for (const id of ['demo', 'maria']) {
      await page.evaluate(i => navigateTo('#trainer/edit/' + i), id);
      await page.waitForTimeout(1500);
      await clicaTudo(page, '#view-edit-aluno button, #view-edit-aluno summary, #view-edit-aluno [onclick]', EVITA);
      await page.waitForTimeout(400);
      // abre os seletores de exercício da evolução
      await page.evaluate(() => { document.querySelectorAll('#view-edit-aluno select').forEach(s => { for (let k = 0; k < s.options.length; k++) { s.selectedIndex = k; s.dispatchEvent(new Event('change', { bubbles: true })); } }); });
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => navigateTo('#trainer'));
    await page.waitForTimeout(800);
    await clicaTudo(page, '#view-trainer button', EVITA);
  });
  relatorio('TRAINER (payload nos registros e no nome do aluno)', tr);

  // ---------- ALUNO ----------
  const al = await sessao(browser, 'aluno', {
    mutateAluno(out) {
      mutReg(out.registros, 'A.');
      out.peso[0].balanca = P('A.peso.balanca'); out.peso[0].obs = P('A.peso.obs');
      out.aluno.nome = P('A.aluno.nome');
    },
  }, async page => {
    await clicaTudo(page, '#view-aluno button, #view-aluno summary, #view-aluno [onclick]', EVITA);
    await page.waitForTimeout(500);
    await page.evaluate(() => { document.querySelectorAll('select').forEach(s => { for (let k = 0; k < s.options.length; k++) { s.selectedIndex = k; s.dispatchEvent(new Event('change', { bubbles: true })); } }); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { try { navigateTo('#console'); } catch (e) {} });
    await page.waitForTimeout(800);
    await clicaTudo(page, '#view-console button, #view-console summary', EVITA);
    await page.evaluate(() => { try { navigateTo('#aluno/demo'); iniciarTreinar(); } catch (e) {} });
    await page.waitForTimeout(800);
  });
  relatorio('ALUNO (payload nos próprios registros, peso e nome)', al);

  await browser.close();
  console.log(achados ? `\n${achados} ACHADO(S): ha payload executando ou HTML sem escape` : '\nNenhum payload executou e nenhum HTML sem escape chegou ao DOM');
  process.exit(achados ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
