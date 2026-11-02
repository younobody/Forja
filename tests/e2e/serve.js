// Servidor estático mínimo da raiz do repositório (sem dependências).
// Esconde as mesmas pastas que o .assetsignore esconde do Worker, então o teste enxerga o que a produção serviria.
//   node serve.js            -> http://127.0.0.1:8765/forja.html   (PORT=... troca a porta; ROOT=... serve outra pasta, p.ex. uma versao antiga)
const http = require('http');
const fs = require('fs');
const path = require('path');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4',
};
const ESCONDIDAS = /(^|[\\/])(\.git|node_modules|supabase|tests|docs)([\\/]|$)/;

function servir(raiz, porta = 0) {
  const srv = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('400'); }
    if (rel.endsWith('/')) rel += 'forja.html';
    const arq = path.normalize(path.join(raiz, rel));
    if (!arq.startsWith(raiz + path.sep) || ESCONDIDAS.test(path.relative(raiz, arq))) { res.writeHead(404); return res.end('404'); }
    fs.readFile(arq, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise(ok => srv.listen(porta, '127.0.0.1', () => ok(srv)));
}

module.exports = { servir };

if (require.main === module) {
  servir(path.resolve(process.env.ROOT || path.join(__dirname, '..', '..')), Number(process.env.PORT) || 8765)
    .then(s => console.log('http://127.0.0.1:' + s.address().port + '/forja.html'));
}
