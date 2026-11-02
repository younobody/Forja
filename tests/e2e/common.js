// Configuração comum das baterias de navegador.
//   URL_APP   endereço do forja.html a testar. O run-all.js sobe um servidor estático da raiz do repositório e define isto sozinho.
//   VER       versão corrente, lida do próprio forja.html (FORJA_VERSION). As baterias semeiam a versão ATUAL no localStorage para o
//             aviso "FORJA Atualizado" não cobrir a tela, então nada precisa ser editado a cada versão nova. FORJA_VER força outra.
//   AXE       texto do axe-core (só é lido quando uma bateria o pede; requer `npm install` nesta pasta)
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const URL = process.env.URL_APP || 'http://127.0.0.1:8765/forja.html';
const achou = /const FORJA_VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'forja.html'), 'utf8'));
if (!achou && !process.env.FORJA_VER) throw new Error('FORJA_VERSION não encontrada em forja.html');
const VER = process.env.FORJA_VER || achou[1];

module.exports = { URL, VER, RAIZ };
Object.defineProperty(module.exports, 'AXE', {
  enumerable: true,
  get() { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); },
});
