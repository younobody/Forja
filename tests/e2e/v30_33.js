// v30.33.0: dia F, obs do plano (parte atual x historico), card ULTIMO TREINO sem marcador,
// troca que nao herda carga, 'calibrar' que nao vira carga, Graviton sem sugestao de "subir".
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');
let falhas = 0, total = 0;
const ok = (c, m, x) => { total++; if (!c) falhas++; console.log(`${c ? 'OK    ' : 'FALHA '} ${m}${x !== undefined && x !== '' ? '  → ' + x : ''}`); };

const HIST = 'Regra atual: pegada neutra.\n--- HISTORICO (plano anterior) ---\nTravar em 15 reps. TETO RIR 3. Falha PROIBIDA.';
const SETS = [{ carga: '50', reps: '10', rir: '2' }, { carga: '50', reps: '9', rir: '1' }];
const OBS_REG = '10/9 · Séries: 50×10 (RIR 2) · 50×9 (RIR 1) · senti o ombro [[FORJA_SETS:' + encodeURIComponent(JSON.stringify(SETS)) + ']]';

function mutate(o) {
  const a0 = o.plano.find(p => p.dia === 'A');
  a0.obs = HIST;
  // registro mais recente do 1o exercicio do A com series detalhadas
  o.registros.unshift({ timestamp: new Date().toISOString(), aluno_id: 'demo', dia: 'A', exercicio: a0.exercicio, carga: '50', reps: '10/9', rir: '1', completou: 'sim', obs: OBS_REG, data_treino: new Date().toISOString().slice(0, 10), modalidade: '', local_id: 'v3033a' });
  // 2o exercicio do A: plano diz 'calibrar' e nao ha historico dele
  const a1 = o.plano.filter(p => p.dia === 'A')[1];
  a1.exercicio = 'Exercicio Novo Calibrar'; a1.carga = 'calibrar';
  // dia F
  o.plano.push({ aluno_id: 'demo', dia: 'F', ordem: 99, exercicio: 'Leg press 45', series: '2', reps: '10-15', carga: '160kg', rir: '3', obs: '', tipo: 'composto', meta: '' });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
  await ctx.addInitScript((v) => { try { localStorage.setItem('forja-last-version', v); } catch (e) {} }, VER);
  const page = await ctx.newPage(); page.on('dialog', d => d.accept().catch(() => {}));
  const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  await installMock(page, { mutateAluno: mutate });
  await page.goto(URL, { waitUntil: 'load' });
  await page.fill('#home-pin', '1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(1800);

  // --- dia F ---
  const dias = await page.evaluate(() => [...document.querySelectorAll('#aluno-day-tabs .tab-btn')].map(b => b.dataset.day).join(''));
  ok(/F$/.test(dias), 'o seletor de dias do aluno mostra o dia F', dias);

  // --- helpers da obs ---
  const h = await page.evaluate((t) => ({ a: obsAtual(t), h: obsHistorico(t), sem: obsAtual('so texto') }), HIST);
  ok(h.a === 'Regra atual: pegada neutra.' && /Travar em 15 reps/.test(h.h) && h.sem === 'so texto', 'obsAtual/obsHistorico separam no "--- HISTORICO"', JSON.stringify(h));

  // --- regras velhas do historico NAO disparam aviso ---
  const c = await page.evaluate((t) => ({
    hist: conflitosDoPlano({ obs: t, carga: '50' }, { carga: 50, reps: 20, rir: 0 }).length,
    atual: conflitosDoPlano({ obs: 'TETO RIR 2\n--- HISTORICO ---\nnada', carga: '50' }, { carga: 50, reps: 10, rir: 0 }).length,
  }), HIST);
  ok(c.hist === 0, 'regra que so existe no historico (travar 15 reps, teto RIR 3, falha proibida) nao vira aviso', c.hist);
  ok(c.atual === 1, 'regra da parte atual continua avisando (caso-controle)', c.atual);

  // --- plano: historico atras de um toque ---
  await page.click('#aluno-day-tabs [data-day="A"]'); await page.waitForTimeout(250);
  const fold = await page.evaluate(() => {
    const b = document.querySelector('#aluno-plano .obs-fold-btn'); if (b) b.click();
    const box = document.querySelector('#aluno-plano .obs-fold');
    const det = box && box.querySelector('details.obs-hist');
    return { visivel: box ? box.innerText.split('VER HIST')[0] : '', temDet: !!det, aberto: det ? det.open : null };
  });
  ok(fold.temDet && fold.aberto === false && /Regra atual/.test(fold.visivel) && !/Travar em 15/.test(fold.visivel), 'obs do plano mostra a parte atual; historico fica num "VER HISTÓRICO" fechado', JSON.stringify(fold));

  // --- TREINAR: card ULTIMO TREINO ---
  await page.click('#btn-aluno-treinar'); await page.waitForTimeout(900);
  const card = await page.evaluate(() => ({ nums: document.getElementById('treinar-ultimo-nums').textContent, obs: document.getElementById('treinar-ultimo-obs').textContent, obsPlano: document.getElementById('treinar-obs').textContent, ws: getComputedStyle(document.getElementById('treinar-obs')).whiteSpace }));
  ok(!/FORJA_SETS|%5B/.test(card.obs) && /senti o ombro/.test(card.obs) && !/Séries:/.test(card.obs), 'card ÚLTIMO TREINO mostra só a nota do aluno (sem marcador, sem resumo repetido)', card.obs);
  ok(/50 × 10\/9/.test(card.nums) && /RIR 1/.test(card.nums), 'linha de números mostra as séries: "50 × 10/9 · RIR 1"', card.nums);
  ok(!/Travar em 15/.test(card.obsPlano) && /Regra atual/.test(card.obsPlano) && card.ws === 'pre-line', 'obs do plano no TREINAR sem o histórico e com quebra de linha', JSON.stringify({ t: card.obsPlano, ws: card.ws }));

  // --- troca: carga vem do substituto ---
  const troca = await page.evaluate(() => {
    const antes = document.getElementById('treinar-input-carga').value;
    TREINAR._trocaOpcoes = ['Nome Que Nunca Treinou'];
    TREINAR.seriesLog[TREINAR.idx] = [{ carga: '50', reps: '10', rir: '2' }];
    trocarExercicioIdx(0);
    return { antes, depois: document.getElementById('treinar-input-carga').value, series: (TREINAR.seriesLog[TREINAR.idx] || []).length };
  });
  ok(troca.antes !== '' && troca.depois === '' && troca.series === 0, 'trocar por exercício sem histórico: carga não herda a do plano e as séries lançadas são zeradas', JSON.stringify(troca));
  await page.evaluate(() => { TREINAR._trocaOpcoes = [TREINAR.plano[TREINAR.idx].exercicio]; trocarExercicioIdx(0); });

  // --- 'calibrar' nao vira carga ---
  const cal = await page.evaluate(() => { TREINAR.idx = 1; mostrarExercicioAtual(); const i = document.getElementById('treinar-input-carga'); return { v: i.value, ph: i.placeholder }; });
  ok(cal.v === '' && /calibrar/.test(cal.ph), 'plano com carga "calibrar": campo vazio e o aviso vai pro placeholder', JSON.stringify(cal));

  // --- Graviton: carga assistida sem sugestao de subir ---
  const g = await page.evaluate(() => { const s = sugestaoProgressao('Graviton', { carga: '21kg assist.', reps: '8-12' }); return s ? (s.novaCarga || 'null') + '|' + s.texto : 'sem-historico'; });
  ok(g === 'sem-historico' || /^null\|$/.test(g), 'Graviton (carga = ajuda) nunca recebe sugestão de subir carga', g);

  ok(erros.length === 0, 'sem erros de JS', erros.join(' | '));
  await browser.close();
  console.log(`\n${total - falhas}/${total} OK`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
