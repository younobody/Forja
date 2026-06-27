/**
 * Servidor HTTP simples para testes E2E
 * Serve o forja.html e fornece API mock para testes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ADMIN_KEY = 'test-admin-key-e2e';

// Mock database
const db = {
  alunos: [],
  plano: [],
  registro: []
};

function createServer() {
  return http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API endpoints
    if (req.url.startsWith('/api/')) {
      handleAPI(req, res);
      return;
    }

    // Serve HTML
    if (req.url === '/' || req.url === '/forja.html') {
      const html = fs.readFileSync(path.join(__dirname, '../forja.html'), 'utf8');
      // Replace API URL placeholder
      const modified = html.replace(
        /const APPS_SCRIPT_URL = '[^']*'/,
        `const APPS_SCRIPT_URL = 'http://localhost:${PORT}/api'`
      );
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(modified);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });
}

function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const action = url.searchParams.get('action');

  if (req.method === 'GET') {
    handleGET(action, url.searchParams, res);
  } else if (req.method === 'POST') {
    handlePOST(action, req, res);
  }
}

function handleGET(action, params, res) {
  if (action === 'ping') {
    return jsonResponse(res, { ok: true, time: new Date().toISOString() });
  }

  if (action === 'getAluno') {
    const id = params.get('id');
    const pin = params.get('pin');
    const aluno = db.alunos.find(a => a.id === id && a.pin === pin);
    if (!aluno) {
      return jsonResponse(res, { error: 'aluno/pin invalido' });
    }
    const plano = db.plano.filter(p => p.aluno_id === id);
    const registros = db.registro.filter(r => r.aluno_id === id).slice(0, 100);
    return jsonResponse(res, {
      aluno: { id: aluno.id, nome: aluno.nome, objetivo: aluno.objetivo, notas: aluno.notas },
      plano,
      registros
    });
  }

  if (action === 'getAdmin') {
    const key = params.get('key');
    if (key !== ADMIN_KEY) {
      return jsonResponse(res, { error: 'unauthorized' });
    }
    return jsonResponse(res, {
      alunos: db.alunos,
      plano: db.plano,
      registros: db.registro
    });
  }

  jsonResponse(res, { error: 'unknown action: ' + action });
}

function handlePOST(action, req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      if (action === 'registro') {
        const aluno = db.alunos.find(a => a.id === data.aluno_id && a.pin === data.pin);
        if (!aluno) {
          return jsonResponse(res, { error: 'aluno/pin invalido' });
        }
        db.registro.push({
          timestamp: new Date().toISOString(),
          aluno_id: data.aluno_id,
          dia: data.dia,
          exercicio: data.exercicio,
          carga: data.carga,
          reps: data.reps,
          rir: data.rir,
          completou: data.completou ? 'sim' : 'nao',
          obs: data.obs || ''
        });
        return jsonResponse(res, { ok: true });
      }

      if (data.key !== ADMIN_KEY) {
        return jsonResponse(res, { error: 'unauthorized' });
      }

      if (action === 'salvarAluno') {
        const existing = db.alunos.find(a => a.id === data.id);
        if (existing) {
          existing.nome = data.nome;
          existing.pin = data.pin;
          existing.objetivo = data.objetivo || '';
          existing.notas = data.notas || '';
        } else {
          db.alunos.push({
            id: data.id,
            nome: data.nome,
            pin: data.pin,
            objetivo: data.objetivo || '',
            notas: data.notas || '',
            criado_em: new Date().toISOString()
          });
        }
        return jsonResponse(res, { ok: true });
      }

      if (action === 'salvarPlano') {
        db.plano = db.plano.filter(p => p.aluno_id !== data.aluno_id);
        (data.plano || []).forEach((p, idx) => {
          db.plano.push({
            aluno_id: data.aluno_id,
            dia: p.dia,
            ordem: idx + 1,
            exercicio: p.exercicio,
            series: p.series,
            reps: p.reps,
            carga: p.carga,
            rir: p.rir,
            obs: p.obs || ''
          });
        });
        return jsonResponse(res, { ok: true });
      }

      if (action === 'removerAluno') {
        db.alunos = db.alunos.filter(a => a.id !== data.id);
        db.plano = db.plano.filter(p => p.aluno_id !== data.id);
        db.registro = db.registro.filter(r => r.aluno_id !== data.id);
        return jsonResponse(res, { ok: true });
      }

      if (action === 'importAluno') {
        const a = data.aluno || {};
        if (!a.id || !a.nome || !a.pin) {
          return jsonResponse(res, { error: 'aluno precisa de id, nome e pin' });
        }
        const existing = db.alunos.find(u => u.id === a.id);
        if (existing) {
          existing.nome = a.nome;
          existing.pin = a.pin;
          existing.objetivo = a.objetivo || '';
          existing.notas = a.notas || '';
        } else {
          db.alunos.push({
            id: a.id,
            nome: a.nome,
            pin: a.pin,
            objetivo: a.objetivo || '',
            notas: a.notas || '',
            criado_em: new Date().toISOString()
          });
        }
        db.plano = db.plano.filter(p => p.aluno_id !== a.id);
        (data.plano || []).forEach((p, idx) => {
          db.plano.push({
            aluno_id: a.id,
            dia: p.dia,
            ordem: idx + 1,
            exercicio: p.exercicio,
            series: p.series,
            reps: p.reps,
            carga: p.carga,
            rir: p.rir,
            obs: p.obs || ''
          });
        });
        return jsonResponse(res, { ok: true, aluno_id: a.id });
      }

      jsonResponse(res, { error: 'unknown action: ' + action });
    } catch (err) {
      jsonResponse(res, { error: err.message });
    }
  });
}

function jsonResponse(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = createServer();
server.listen(PORT, () => {
  console.log(`Test server listening on http://localhost:${PORT}`);
});

module.exports = { server, PORT, ADMIN_KEY };
