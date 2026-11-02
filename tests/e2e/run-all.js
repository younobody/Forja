// Roda as baterias de navegador contra o forja.html desta árvore de trabalho.
//   node run-all.js                    todas
//   node run-all.js abas xss           só as que tiverem "abas" ou "xss" no nome do arquivo
//   node run-all.js -v                 mostra a saída completa de cada bateria (padrão: só das que falham)
//   URL_APP=https://SEU-SITE/forja.html FORJA_VER=v30.31.1 node run-all.js
//                                      contra um endereço já publicado (não sobe servidor local)
// Requer `npm install` nesta pasta e o Chromium do Playwright (`npx playwright install chromium`). Sai com 1 se alguma falhar.
const { spawn } = require('child_process');
const path = require('path');
const { servir } = require('./serve');
const { RAIZ, VER } = require('./common');

const BATERIAS = [
  ['verify.js', 'aviso de versão, login, rotação, Service Worker'],
  ['verify_abas.js', 'abas do aluno, voltar, TREINAR, modais, plano em colunas, histórico'],
  ['dia_prox.js', 'dia sugerido pela rotação'],
  ['trainer_editor.js', 'editor do plano do trainer + ALVO (meta) preservado'],
  ['axe_abas.js', 'acessibilidade (axe) das 4 abas'],
  ['audit5.js', 'acessibilidade (axe) de modais, TREINAR e trainer'],
  ['xss_proof.js', 'XSS armazenado no painel do trainer (4 pontos)'],
  ['xss3.js', 'varredura de sinks de HTML: trainer e aluno'],
  ['xss4.js', 'varredura de sinks de HTML: feed público e telas do aluno'],
];

const args = process.argv.slice(2);
const verboso = args.includes('-v');
const filtros = args.filter(a => a !== '-v');

function roda(arquivo, url) {
  return new Promise(ok => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join(__dirname, arquivo)], { env: { ...process.env, URL_APP: url }, cwd: __dirname });
    let saida = '';
    p.stdout.on('data', d => { saida += d; });
    p.stderr.on('data', d => { saida += d; });
    p.on('close', codigo => ok({ codigo, saida, seg: ((Date.now() - t0) / 1000).toFixed(0) }));
  });
}

(async () => {
  let srv = null;
  let url = process.env.URL_APP;
  if (!url) {
    srv = await servir(RAIZ, 0);
    url = `http://127.0.0.1:${srv.address().port}/forja.html`;
  }
  console.log(`Alvo: ${url}   (versão esperada: ${VER})\n`);
  const lista = BATERIAS.filter(([a]) => !filtros.length || filtros.some(f => a.includes(f)));
  if (!lista.length) { console.log('Nenhuma bateria casa com o filtro.'); process.exit(2); }
  let falharam = 0;
  for (const [arquivo, desc] of lista) {
    const r = await roda(arquivo, url);
    const resumo = (r.saida.match(/^\d+\/\d+ checagens OK.*$/m) || [''])[0];
    console.log(`${r.codigo === 0 ? 'OK    ' : 'FALHA '} ${arquivo.padEnd(18)} ${String(r.seg).padStart(3)}s  ${desc}${resumo ? '  [' + resumo + ']' : ''}`);
    if (r.codigo !== 0) falharam++;
    if (verboso || r.codigo !== 0) console.log(r.saida.split('\n').map(l => '      ' + l).join('\n'));
  }
  if (srv) srv.close();
  console.log(falharam ? `\n${falharam} bateria(s) com FALHA` : '\nTodas as baterias passaram');
  process.exit(falharam ? 1 : 0);
})();
