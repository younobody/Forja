// Varredura 2: feed público, telas do aluno chamadas diretamente, plano/peso/exercícios com payload.
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
const P = f => `"'><img src=x onerror=__pwn.push('${f}')>`;
const INIT = () => {
  window.__pwn = []; window.__PWN = window.__pwn; Array.prototype.PUSH = Array.prototype.push; window.__sinks = [];
  const re = /<img\s+src=x\s+onerror=/i;
  const log = (kind, html) => { if (typeof html !== 'string') return; const i = html.search(re); if (i < 0) return;
    const m = /__pwn\.push\('([^']*)'\)/i.exec(html.slice(i));
    window.__sinks.push({ kind, campo: m && m[1], stack: new Error().stack.split('\n').slice(2, 7).map(s => s.trim().replace(/\(?https?:\/\/[^/]+\/forja\.html:?/, '(').replace(/^at /, '')).join(' < ') }); };
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { set(v) { log('innerHTML', v); return d.set.call(this, v); }, get() { return d.get.call(this); }, configurable: true });
  const ia = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (p, h) { log('insertAdjacentHTML', h); return ia.call(this, p, h); };
  try { localStorage.setItem('forja-last-version', 'v30.28.0'); } catch (e) {}
};
async function novo(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', e => erros.push(String(e).slice(0, 140))); page.on('dialog', d => d.dismiss().catch(() => {}));
  await installMock(page, opts); return { ctx, page, erros };
}
let achados = 0;   // payloads executados + sinks com payload sem escape; qualquer um faz o processo sair com 1
function rel(t, sinks, pwn, erros) {
  achados += (pwn || []).length + (sinks || []).length;
  console.log(`\n##### ${t}`);
  console.log('EXECUTADOS:', JSON.stringify([...new Set((pwn || []).map(x => String(x).toLowerCase()))]));
  const by = {}; (sinks || []).forEach(s => { const k = (s.campo || '?').toLowerCase(); (by[k] = by[k] || new Set()).add(s.kind + ' @ ' + s.stack.split(' < ').slice(0, 3).join(' < ')); });
  Object.entries(by).forEach(([k, v]) => { console.log('  campo', k); [...v].slice(0, 3).forEach(x => console.log('     -', x)); });
  if (!(sinks || []).length) console.log('  (nenhum sink)');
  if (erros && erros.length) console.log('  pageerrors:', JSON.stringify([...new Set(erros)].slice(0, 3)));
}
(async () => {
  const browser = await chromium.launch();
  // 1) FEED PÚBLICO (pré-login) com payload no nome
  {
    const { ctx, page, erros } = await novo(browser, { feed: [
      { nome: P('feed.nome'), ultimoTreino: '2026-11-01', streak: 4, treinos7d: 5, treinosMesPassado: 17, campeaoMes: true },
      { nome: P('feed.nome2'), ultimoTreino: P('feed.ultimo'), streak: P('feed.streak'), treinos7d: P('feed.t7'), treinosMesPassado: 3, campeaoMes: false },
    ] });
    await page.goto(URL, { waitUntil: 'load' }); await page.waitForTimeout(1800);
    rel('FEED PÚBLICO (login, sem autenticação)', await page.evaluate(() => window.__sinks), await page.evaluate(() => window.__pwn), erros);
    await ctx.close();
  }
  // 2) ALUNO: chama diretamente cada render com payload em registros, peso, perimetros, plano, exercicios, aluno
  {
    const { ctx, page, erros } = await novo(browser, { mutateAluno(out) {
      const idx = out.registros.map((r, i) => [r.timestamp, i]).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10).map(x => x[1]);
      ['exercicio', 'obs', 'carga', 'reps', 'rir', 'dia', 'modalidade', 'data_treino', 'local_id', 'completou'].forEach((c, k) => { out.registros[idx[k]][c] = P('A.reg.' + c); });
      out.peso[0].balanca = P('A.peso.balanca'); out.peso[0].obs = P('A.peso.obs'); out.peso[0].peso = P('A.peso.peso');
      Object.keys(out.perimetros[0]).forEach(k => { if (!['timestamp', 'aluno_id', 'data'].includes(k)) out.perimetros[0][k] = P('A.perim.' + k); });
      ['exercicio', 'series', 'reps', 'carga', 'rir', 'obs', 'tipo', 'meta'].forEach(c => { out.plano[['exercicio', 'series', 'reps', 'carga', 'rir', 'obs', 'tipo', 'meta'].indexOf(c)][c] = P('A.plano.' + c); });
      out.aluno.nome = P('A.aluno.nome'); out.aluno.objetivo = P('A.aluno.objetivo'); out.aluno.notas = 'LESOES:\n(1) ' + P('A.aluno.notas');
      ['nome_atual', 'aliases', 'musculos_primarios', 'equipamento', 'instrucoes', 'imagem_url'].forEach((c, k) => { out.exercicios[k][c] = P('A.exerc.' + c); });
    } });
    await page.goto(URL, { waitUntil: 'load' });
    await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(2200);
    const chama = async (js) => { try { await page.evaluate(js); } catch (e) { /* ignora */ } await page.waitForTimeout(250); };
    await chama(() => renderAlunoHistorico());
    await chama(() => abrirModalPeso());
    await chama(() => abrirModalCardio());
    await chama(() => abrirModalRegistrar());
    await chama(() => { navigateTo('#console'); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { document.querySelectorAll('#view-console button, #view-console summary').forEach(b => { try { b.click(); } catch (e) {} }); });
    await chama(() => { navigateTo('#aluno/demo'); });
    await page.evaluate(() => { document.querySelectorAll('#view-aluno button, #view-aluno summary, #view-aluno [onclick]').forEach(b => { const t = (b.textContent || '') + (b.getAttribute('onclick') || ''); if (/sair|remover|logout/i.test(t)) return; try { b.click(); } catch (e) {} }); });
    await page.waitForTimeout(500);
    await chama(() => iniciarTreinar());
    await page.waitForTimeout(500);
    await chama(() => { try { abrirListaDia(); } catch (e) {} });
    await chama(() => { try { abrirTrocaExercicio(); } catch (e) {} });
    await chama(() => { try { abrirModalExtra(); } catch (e) {} });
    // percorre os exercícios do TREINAR
    for (let i = 0; i < 6; i++) { await chama(() => { try { proximoExercicio(); } catch (e) { try { document.getElementById('btn-treinar-proximo').click(); } catch (e2) {} } }); }
    rel('ALUNO (payload em registros, peso, perímetros, plano, exercícios, nome/objetivo/notas)', await page.evaluate(() => window.__sinks), await page.evaluate(() => window.__pwn), erros);
    await ctx.close();
  }
  await browser.close();
  console.log(achados ? `\n${achados} ACHADO(S): ha payload executando ou HTML sem escape` : '\nNenhum payload executou e nenhum sink recebeu HTML sem escape');
  process.exit(achados ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
