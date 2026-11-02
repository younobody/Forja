// Prova de conceito LOCAL (backend simulado, dados fictícios): 4 pontos de XSS armazenado que atingem o trainer.
// Uso: node xss_proof.js  -> imprime, por caso, se o payload EXECUTOU e se leu a chave do trainer.
const { chromium } = require('playwright');
const { installMock } = require('./mock');
const { URL, VER } = require('./common');

// payload que tenta ler a chave do trainer da sessionStorage (o que um atacante faria)
const EXFIL = tag => `"'><img src=x onerror="__pwn.push('${tag}:'+sessionStorage.getItem('forja-trainer-key'))">`;
const hoje = () => new Date().toISOString().slice(0, 10);

function regAtacante(campos) {
  return Object.assign({
    timestamp: new Date().toISOString(), aluno_id: 'maria', dia: 'A', exercicio: 'Supino reto barra', carga: '40', reps: '10',
    rir: '2', completou: 'sim', obs: '', data_treino: hoje(), modalidade: '', local_id: 'atk-' + Math.random().toString(36).slice(2),
  }, campos);
}

const CASOS = [
  { nome: '1. dashboard do trainer: ÚLT: ${last.dia}  (zero cliques após o login)',
    mutate(out) { out.registros.push(regAtacante({ dia: EXFIL('dashboard.dia') })); },
    passos: async () => {} },
  { nome: '2. dashboard do trainer: id do aluno dentro do onclick  (1 clique no card)',
    mutate(out) { out.alunos[1].id = `x');__pwn.push('onclick.id:'+sessionStorage.getItem('forja-trainer-key'));('`; },
    passos: async page => { await page.evaluate(() => { const c = [...document.querySelectorAll('[data-aluno-id],[onclick*="trainer/edit"]')]; const alvo = c[c.length - 1]; if (alvo) alvo.click(); }); } },
  { nome: '3. tela de edição do aluno: cartão CARDIO (campo modalidade)',
    mutate(out) { out.registros.push(regAtacante({ dia: '', exercicio: 'Pedal', modalidade: EXFIL('evo.modalidade'), carga: '', reps: '', rir: '' })); },
    passos: async page => { await page.evaluate(() => navigateTo('#trainer/edit/maria')); await page.waitForTimeout(1500); } },
  { nome: '4. tela de edição do aluno: histórico de sessões (campo dia)',
    mutate(out) { out.registros.push(regAtacante({ dia: EXFIL('sessao.dia'), data_treino: '2026-10-20' })); },
    passos: async page => { await page.evaluate(() => navigateTo('#trainer/edit/maria')); await page.waitForTimeout(1500); } },
  { nome: '5. controle: dados normais, clique no card leva à tela de edição',
    mutate() {},
    passos: async page => { await page.evaluate(() => { const c = [...document.querySelectorAll('#trainer-alunos-list > div')]; c[c.length - 1].click(); }); await page.waitForTimeout(800); } },
];

(async () => {
  const browser = await chromium.launch();
  let falhou = 0;
  for (const caso of CASOS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.__pwn = []; try { localStorage.setItem('forja-last-version', 'v30.28.0'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await installMock(page, { mutateAdmin: caso.mutate });
    await page.goto(URL, { waitUntil: 'load' });
    await page.fill('#home-pin', 'admin');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
    await caso.passos(page);
    await page.waitForTimeout(500);
    const pwn = await page.evaluate(() => window.__pwn.slice());
    const hash = await page.evaluate(() => location.hash);
    const executou = pwn.length > 0;
    const leuChave = pwn.some(x => /:admin$/.test(String(x)));
    const ehControle = caso.nome.startsWith('5.');
    const ok = ehControle ? (hash.startsWith('#trainer/edit/') && !executou) : !executou;
    if (!ok) falhou++;
    console.log(`${ok ? 'OK    ' : 'FALHA '} ${caso.nome}`);
    console.log(`        executou=${executou}  leu_chave_do_trainer=${leuChave}  hash=${hash}  pwn=${JSON.stringify(pwn).slice(0, 120)}`);
    await ctx.close();
  }
  await browser.close();
  console.log(falhou ? `\n${falhou} caso(s) com FALHA` : '\nTodos os casos OK');
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
