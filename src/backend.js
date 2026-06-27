/**
 * FORJA — Backend Business Logic
 *
 * Lógica de negócio do Google Apps Script
 * Separada das APIs do Google para permitir testes unitários
 */

let ADMIN_KEY = 'TROCAR-POR-CHAVE-FORTE-AQUI';

function setAdminKey(key) {
  ADMIN_KEY = key;
}

function getAdminKey() {
  return ADMIN_KEY;
}

/* ============ HELPERS ============ */

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Mock já inicializa headers via initializeHeaders, não precisamos appendRow
    // Em Google Apps Script real, a sheet não tem headers ao ser criada
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function validarAluno(id, pin) {
  const alunos = sheetToObjects(getSheet('alunos'));
  return alunos.some(a => String(a.id) === String(id) && String(a.pin) === String(pin));
}

/* ============ LEITURA ============ */

function getAluno(id, pin) {
  if (!validarAluno(id, pin)) return jsonResponse({ error: 'aluno/pin invalido' });

  const aluno = sheetToObjects(getSheet('alunos')).find(a => String(a.id) === String(id));
  const plano = sheetToObjects(getSheet('plano')).filter(p => String(p.aluno_id) === String(id));
  const registros = sheetToObjects(getSheet('registro')).filter(r => String(r.aluno_id) === String(id));

  plano.sort((a, b) => {
    if (String(a.dia) !== String(b.dia)) return String(a.dia).localeCompare(String(b.dia));
    return Number(a.ordem) - Number(b.ordem);
  });
  registros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return jsonResponse({
    aluno: { id: aluno.id, nome: aluno.nome, objetivo: aluno.objetivo, notas: aluno.notas },
    plano,
    registros: registros.slice(0, 100)
  });
}

function getAdmin() {
  const alunos = sheetToObjects(getSheet('alunos'));
  const plano = sheetToObjects(getSheet('plano'));
  const registros = sheetToObjects(getSheet('registro'));
  return jsonResponse({ alunos, plano, registros });
}

/* ============ ESCRITA ============ */

function salvarRegistro(body) {
  getSheet('registro').appendRow([
    new Date().toISOString(),
    body.aluno_id,
    body.dia,
    body.exercicio,
    body.carga,
    body.reps,
    body.rir,
    body.completou ? 'sim' : 'nao',
    body.obs || ''
  ]);
  return jsonResponse({ ok: true });
}

function salvarPlano(body) {
  const sheet = getSheet('plano');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  for (let i = 1; i < data.length; i++) {
    if (data[i].some(c => c !== '' && c !== null) && String(data[i][0]) !== String(body.aluno_id)) {
      novas.push(data[i]);
    }
  }
  (body.plano || []).forEach((p, idx) => {
    novas.push([
      body.aluno_id, p.dia, idx + 1, p.exercicio, p.series, p.reps, p.carga, p.rir, p.obs || ''
    ]);
  });
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true });
}

function salvarAluno(body) {
  const sheet = getSheet('alunos');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) {
      sheet.getRange(i + 1, 2).setValue(body.nome);
      sheet.getRange(i + 1, 3).setValue(body.pin);
      sheet.getRange(i + 1, 4).setValue(body.objetivo || '');
      sheet.getRange(i + 1, 5).setValue(body.notas || '');
      return jsonResponse({ ok: true });
    }
  }
  sheet.appendRow([body.id, body.nome, body.pin, body.objetivo || '', body.notas || '', new Date().toISOString()]);
  return jsonResponse({ ok: true });
}

function removerAluno(body) {
  ['alunos', 'plano', 'registro'].forEach(name => {
    const sheet = getSheet(name);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const novas = [headers];
    const idCol = (name === 'alunos') ? 0 : (name === 'plano') ? 0 : 1;
    for (let i = 1; i < data.length; i++) {
      if (data[i].some(c => c !== '' && c !== null) && String(data[i][idCol]) !== String(body.id)) {
        novas.push(data[i]);
      }
    }
    sheet.clear();
    sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  });
  return jsonResponse({ ok: true });
}

function removerRegistro(body) {
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  for (let i = 1; i < data.length; i++) {
    const ts = data[i][0];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    if (data[i].some(c => c !== '' && c !== null) && tsStr !== String(body.timestamp)) {
      novas.push(data[i]);
    }
  }
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true });
}

function substituirRegistros(alunoId, registros) {
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  for (let i = 1; i < data.length; i++) {
    if (data[i].some(c => c !== '' && c !== null) && String(data[i][1]) !== String(alunoId)) {
      novas.push(data[i]);
    }
  }
  registros.forEach(r => {
    const compRaw = String(r.completou).toLowerCase();
    const comp = (r.completou === false || compRaw === 'nao' || compRaw === 'false' || compRaw === 'no') ? 'nao' : 'sim';
    novas.push([
      r.timestamp || new Date().toISOString(),
      alunoId,
      r.dia || '',
      r.exercicio || '',
      r.carga || '',
      r.reps || '',
      r.rir != null ? r.rir : '',
      comp,
      r.obs || ''
    ]);
  });
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return registros.length;
}

function importAluno(body) {
  const a = body.aluno || {};
  if (!a.id || !a.nome || !a.pin) {
    return jsonResponse({ error: 'aluno precisa de id, nome e pin' });
  }
  salvarAluno({
    id: a.id, nome: a.nome, pin: a.pin,
    objetivo: a.objetivo || '', notas: a.notas || ''
  });
  salvarPlano({ aluno_id: a.id, plano: body.plano || [] });
  let regCount = 0;
  if (Array.isArray(body.registros) && body.registros.length > 0) {
    regCount = substituirRegistros(a.id, body.registros);
  }
  return jsonResponse({
    ok: true,
    aluno_id: a.id,
    exercicios_importados: (body.plano || []).length,
    registros_importados: regCount
  });
}

/* ============ SETUP ============ */

function setup() {
  getSheet('alunos');
  getSheet('plano');
  getSheet('registro');
  Logger.log('Abas alunos, plano e registro prontas.');
}

/* ============ HTTP HANDLERS ============ */

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getAluno') return getAluno(e.parameter.id, e.parameter.pin);
    if (action === 'getAdmin') {
      if (e.parameter.key !== ADMIN_KEY) return jsonResponse({ error: 'unauthorized' });
      return getAdmin();
    }
    if (action === 'ping') return jsonResponse({ ok: true, time: new Date().toISOString() });
    return jsonResponse({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'registro') {
      if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
      return salvarRegistro(body);
    }

    if (body.key !== ADMIN_KEY) return jsonResponse({ error: 'unauthorized' });

    if (action === 'salvarPlano') return salvarPlano(body);
    if (action === 'salvarAluno') return salvarAluno(body);
    if (action === 'importAluno') return importAluno(body);
    if (action === 'removerAluno') return removerAluno(body);
    if (action === 'removerRegistro') return removerRegistro(body);

    return jsonResponse({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// Exports para testes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setAdminKey,
    getAdminKey,
    validarAluno,
    salvarAluno,
    salvarRegistro,
    salvarPlano,
    removerAluno,
    removerRegistro,
    importAluno,
    substituirRegistros,
    getAluno,
    getAdmin,
    getSheet,
    sheetToObjects,
    doGet,
    doPost,
  };
}
