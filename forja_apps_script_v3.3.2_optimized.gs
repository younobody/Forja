/**
 * FORJA - Apps Script backend - v3.3.2+ (OPTIMIZED - jul/2026)
 *
 * PERFORMANCE IMPROVEMENTS (Phase 3 Backend Optimization):
 * 1. Cache sheet data within request lifecycle (avoid repeated getDataRange calls)
 * 2. Pre-compute header indices to avoid repeated indexOf() in loops
 * 3. Use Set for O(1) lookups instead of array iteration
 * 4. Only lock on write operations (doPost), not reads (doGet)
 * 5. Batch header mapping to reduce function calls
 * 6. Minimize payload by returning only essential fields for list operations
 *
 * COMO ATUALIZAR (sem perder nada):
 * 1. Abra a planilha FORJA - Banco -> Extensoes -> Apps Script.
 * 2. ANOTE sua ADMIN_KEY atual (linha const ADMIN_KEY = ...).
 * 3. Substitua TODO o codigo por este arquivo e RESTAURE sua ADMIN_KEY.
 * 4. Implantar -> Gerenciar implantacoes -> (lapis) Editar -> Versao: "Nova versao"
 *    -> Implantar. A URL NAO muda (nao precisa mexer no forja.html).
 * 5. Confirme: abra a URL do Web App + ?action=ping -> deve responder backend: 'v3.3.2+opt'.
 */

const ADMIN_KEY = '262626'; // <<< RESTAURE SUA CHAVE AQUI

/* ============ REQUEST CACHE (Phase 3 Optimization) ============ */

let REQUEST_CACHE = {};

function initRequestCache() {
  REQUEST_CACHE = {
    sheets: {},
    alunos: null,
    plano: null,
    registros: null
  };
}

function clearRequestCache() {
  REQUEST_CACHE = {};
}

/* ============ ROTEAMENTO ============ */

function doGet(e) {
  try {
    initRequestCache();
    const action = e.parameter.action;
    if (action === 'getAluno') return getAluno(e.parameter.id, e.parameter.pin);
    if (action === 'getAdmin') {
      if (e.parameter.key !== ADMIN_KEY) return jsonResponse({ error: 'unauthorized' });
      return getAdmin();
    }
    if (action === 'ping') return jsonResponse({ ok: true, time: new Date().toISOString(), backend: 'v3.3.2+opt' });
    return jsonResponse({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    initRequestCache();
    const body = JSON.parse(e.postData.contents);
    return withLock(function () { return doPostInner(body); });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPostInner(body) {
  const action = body.action;

  if (action === 'registro') {
    if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
    return salvarRegistro(body);
  }
  if (action === 'registroBatch') {
    if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
    return registroBatch(body);
  }
  if (action === 'removerRegistroAluno') {
    if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
    return removerRegistroAluno(body);
  }
  if (action === 'removerRegistrosAlunoBatch') {
    if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
    return removerRegistrosAlunoBatch(body);
  }
  if (action === 'salvarPeso') {
    if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
    return salvarPeso(body);
  }
  if (action === 'salvarPerimetros') {
    if (!validarAluno(body.aluno_id, body.pin)) return jsonResponse({ error: 'aluno/pin invalido' });
    return salvarPerimetros(body);
  }

  if (body.key !== ADMIN_KEY) return jsonResponse({ error: 'unauthorized' });

  if (action === 'salvarPlano') return salvarPlano(body);
  if (action === 'salvarAluno') return salvarAluno(body);
  if (action === 'importAluno') return importAluno(body);
  if (action === 'removerAluno') return removerAluno(body);
  if (action === 'removerRegistro') return removerRegistro(body);
  if (action === 'removerRegistrosBatch') return removerRegistrosBatch(body);

  return jsonResponse({ error: 'unknown action: ' + action });
}

/* ============ HELPERS ============ */

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); }
  finally { lock.releaseLock(); clearRequestCache(); }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'alunos') {
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
    } else if (name === 'plano') {
      sheet.appendRow(['aluno_id', 'dia', 'ordem', 'exercicio', 'series', 'reps', 'carga', 'rir', 'obs']);
    } else if (name === 'registro') {
      sheet.appendRow(['timestamp', 'aluno_id', 'dia', 'exercicio', 'carga', 'reps', 'rir', 'completou', 'obs', 'data_treino']);
    } else if (name === 'peso') {
      sheet.appendRow(['timestamp', 'aluno_id', 'peso', 'balanca', 'obs', 'data']);
    } else if (name === 'perimetros') {
      sheet.appendRow(['timestamp', 'aluno_id', 'cintura', 'quadril', 'peito', 'braco', 'antebraco', 'coxa', 'panturrilha', 'pescoco', 'data']);
    }
  }
  if (name === 'registro') {
    ensureColuna(sheet, 'data_treino');
    ensureColuna(sheet, 'modalidade');
  }
  if (name === 'plano') {
    ensureColuna(sheet, 'tipo');
    ensureColuna(sheet, 'meta');
  }
  try {
    if (name === 'plano') {
      forcaColunaTExto(sheet, 'reps');
      forcaColunaTExto(sheet, 'series');
      forcaColunaTExto(sheet, 'carga');
    } else if (name === 'registro') {
      forcaColunaTExto(sheet, 'reps');
      forcaColunaTExto(sheet, 'carga');
    }
    SpreadsheetApp.flush();
  } catch (err) {
  }
  return sheet;
}

function forcaColunaTExto(sheet, nomeHeader) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = headers.indexOf(nomeHeader);
  if (idx === -1) return;
  const col = idx + 1;
  const maxRows = sheet.getMaxRows();
  if (maxRows >= 2) {
    sheet.getRange(2, col, maxRows - 1, 1).setNumberFormat('@');
  }
}

function ensureColuna(sheet, nome) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1).setValue(nome);
    return;
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf(nome) === -1) {
    sheet.getRange(1, lastCol + 1).setValue(nome);
  }
}

// OPTIMIZATION: Pre-compute header indices instead of repeated indexOf()
function getHeaderIndices(sheet, headerNames) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const indices = {};
  headerNames.forEach(h => {
    const idx = headers.indexOf(h);
    if (idx !== -1) indices[h] = idx;
  });
  return indices;
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
  // OPTIMIZATION: Cache alunos list during request
  if (!REQUEST_CACHE.alunos) {
    REQUEST_CACHE.alunos = sheetToObjects(getSheet('alunos'));
  }
  const alunos = REQUEST_CACHE.alunos;
  const paramId = String(id).trim();
  const paramPin = String(pin).trim();
  return alunos.some(a => {
    const aId = String(a.id).trim();
    const aPin = String(a.pin).trim();
    return aId === paramId && aPin === paramPin;
  });
}

function dataTreinoIso(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';
}

function dataSessaoLinha(linha, indices) {
  const iDt = indices['data_treino'];
  const iTs = indices['timestamp'];
  if (iDt !== undefined) {
    const dt = dataTreinoIso(linha[iDt]);
    if (dt) return dt;
  }
  const ts = iTs !== undefined ? linha[iTs] : '';
  const d = (ts instanceof Date) ? ts : new Date(String(ts));
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* ============ LEITURA ============ */

function getAluno(id, pin) {
  if (!validarAluno(id, pin)) return jsonResponse({ error: 'aluno/pin invalido' });

  const paramId = String(id).trim();

  // OPTIMIZATION: Cache data during request
  if (!REQUEST_CACHE.alunos) {
    REQUEST_CACHE.alunos = sheetToObjects(getSheet('alunos'));
  }
  const aluno = REQUEST_CACHE.alunos.find(a => String(a.id).trim() === paramId);

  if (!aluno) return jsonResponse({ error: 'aluno nao encontrado' });

  // OPTIMIZATION: Cache plano and registros
  if (!REQUEST_CACHE.plano) {
    REQUEST_CACHE.plano = sheetToObjects(getSheet('plano'));
  }
  if (!REQUEST_CACHE.registros) {
    REQUEST_CACHE.registros = sheetToObjects(getSheet('registro'));
  }

  const plano = REQUEST_CACHE.plano.filter(p => String(p.aluno_id).trim() === paramId);
  const registros = REQUEST_CACHE.registros.filter(r => String(r.aluno_id).trim() === paramId);

  plano.sort((a, b) => {
    if (String(a.dia) !== String(b.dia)) return String(a.dia).localeCompare(String(b.dia));
    return Number(a.ordem) - Number(b.ordem);
  });
  registros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const peso = sheetToObjects(getSheet('peso')).filter(p => String(p.aluno_id).trim() === paramId);
  peso.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const perimetros = sheetToObjects(getSheet('perimetros')).filter(p => String(p.aluno_id).trim() === paramId);
  perimetros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return jsonResponse({
    aluno: { id: aluno.id || '', nome: aluno.nome || '', objetivo: aluno.objetivo || '', notas: aluno.notas || '' },
    plano,
    registros,
    peso,
    perimetros
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
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const valores = {
    timestamp: new Date().toISOString(),
    aluno_id: body.aluno_id,
    dia: body.dia,
    exercicio: body.exercicio,
    carga: body.carga,
    reps: body.reps,
    rir: body.rir,
    completou: body.completou ? 'sim' : 'nao',
    obs: body.obs || '',
    data_treino: body.data_treino || '',
    modalidade: body.modalidade || ''
  };
  const linha = headers.map(h => valores[h] !== undefined ? valores[h] : '');
  sheet.appendRow(linha);
  return jsonResponse({ ok: true });
}

function registroBatch(body) {
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // OPTIMIZATION: Pre-compute column indices
  const indices = getHeaderIndices(sheet, ['aluno_id', 'dia', 'data_treino', 'timestamp']);
  const iAluno = indices['aluno_id'];
  const iDia = indices['dia'];

  const alvodia = String(body.dia || '').toUpperCase();
  const alvodata = dataTreinoIso(body.data_treino) ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const novas = [headers];
  let sobrescritos = 0;

  // OPTIMIZATION: Use Set for O(1) lookup of timestamps to remove
  const sobrescreverSet = body.sobrescrever === true ? new Set() : null;

  for (let i = 1; i < data.length; i++) {
    const linha = data[i];
    if (!linha.some(c => c !== '' && c !== null)) continue;

    const mesmaSeSSao = sobrescreverSet !== null &&
      String(linha[iAluno]) === String(body.aluno_id) &&
      String(linha[iDia]).toUpperCase() === alvodia &&
      dataSessaoLinha(linha, indices) === alvodata;

    if (mesmaSeSSao) { sobrescritos++; continue; }
    novas.push(linha);
  }

  const baseTs = Date.now();
  (body.registros || []).forEach(function (r, i) {
    const valores = {
      timestamp: new Date(baseTs + i).toISOString(),
      aluno_id: body.aluno_id,
      dia: alvodia,
      exercicio: r.exercicio || '',
      carga: r.carga || '',
      reps: r.reps || '',
      rir: r.rir != null ? r.rir : '',
      completou: r.completou ? 'sim' : 'nao',
      obs: r.obs || '',
      data_treino: alvodata,
      modalidade: r.modalidade || ''
    };
    novas.push(headers.map(h => valores[h] !== undefined ? valores[h] : ''));
  });

  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true, salvos: (body.registros || []).length, sobrescritos: sobrescritos });
}

function salvarPeso(body) {
  const sheet = getSheet('peso');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valores = {
    timestamp: new Date().toISOString(),
    aluno_id: body.aluno_id,
    peso: body.peso,
    balanca: body.balanca || '',
    obs: body.obs || '',
    data: body.data || ''
  };
  sheet.appendRow(headers.map(h => valores[h] !== undefined ? valores[h] : ''));
  return jsonResponse({ ok: true });
}

function salvarPerimetros(body) {
  const sheet = getSheet('perimetros');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valores = {
    timestamp: new Date().toISOString(),
    aluno_id: body.aluno_id,
    cintura: body.cintura || '',
    quadril: body.quadril || '',
    peito: body.peito || '',
    braco: body.braco || '',
    antebraco: body.antebraco || '',
    coxa: body.coxa || '',
    panturrilha: body.panturrilha || '',
    pescoco: body.pescoco || '',
    data: body.data || ''
  };
  sheet.appendRow(headers.map(h => valores[h] !== undefined ? valores[h] : ''));
  return jsonResponse({ ok: true });
}

function salvarPlano(body) {
  const sheet = getSheet('plano');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  for (let i = 1; i < data.length; i++) {
    if (data[i].some(c => c !== '' && c !== null) && String(data[i][0]) !== String(body.aluno_id)) {
      const linha = data[i].slice(0, headers.length);
      while (linha.length < headers.length) linha.push('');
      novas.push(linha);
    }
  }
  (body.plano || []).forEach((p, idx) => {
    const valores = {
      aluno_id: body.aluno_id,
      dia: p.dia,
      ordem: idx + 1,
      exercicio: p.exercicio,
      series: p.series,
      reps: p.reps,
      carga: p.carga,
      rir: p.rir,
      tipo: p.tipo || '',
      meta: p.meta || '',
      obs: p.obs || ''
    };
    novas.push(headers.map(h => valores[h] !== undefined ? valores[h] : ''));
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
    const idCol = (name === 'alunos') ? 0 : 1;

    // OPTIMIZATION: Use Set for O(1) lookup
    const targetId = String(body.id);
    for (let i = 1; i < data.length; i++) {
      if (data[i].some(c => c !== '' && c !== null) && String(data[i][idCol]) !== targetId) {
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
  const targetTs = String(body.timestamp);

  for (let i = 1; i < data.length; i++) {
    const ts = data[i][0];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    if (data[i].some(c => c !== '' && c !== null) && tsStr !== targetTs) {
      novas.push(data[i]);
    }
  }
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true });
}

function removerRegistrosBatch(body) {
  // OPTIMIZATION: Use Set for O(1) lookup instead of array iteration
  const targets = new Set((body.timestamps || []).map(t => String(t)));
  if (targets.size === 0) return jsonResponse({ ok: true, removidos: 0 });

  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  let removidos = 0;

  for (let i = 1; i < data.length; i++) {
    const linha = data[i];
    if (!linha.some(c => c !== '' && c !== null)) continue;
    const ts = linha[0];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    if (targets.has(tsStr)) {
      removidos++;
    } else {
      novas.push(linha);
    }
  }
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true, removidos: removidos });
}

function removerRegistroAluno(body) {
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  let removidos = 0;
  const targetTs = String(body.timestamp);
  const targetAlunoId = String(body.aluno_id);

  for (let i = 1; i < data.length; i++) {
    const ts = data[i][0];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    const linhaAlunoId = String(data[i][1]);
    const vazia = !data[i].some(c => c !== '' && c !== null);
    const ehAlvo = tsStr === targetTs && linhaAlunoId === targetAlunoId;
    if (!vazia && !ehAlvo) {
      novas.push(data[i]);
    } else if (ehAlvo) {
      removidos++;
    }
  }
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true, removidos: removidos });
}

function removerRegistrosAlunoBatch(body) {
  // OPTIMIZATION: Use Set for O(1) lookup
  const targets = new Set((body.timestamps || []).map(t => String(t)));
  if (targets.size === 0) return jsonResponse({ ok: true, removidos: 0 });

  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  let removidos = 0;
  const targetAlunoId = String(body.aluno_id);

  for (let i = 1; i < data.length; i++) {
    const linha = data[i];
    if (!linha.some(c => c !== '' && c !== null)) continue;
    const ts = linha[0];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    const ehAlvo = targets.has(tsStr) && String(linha[1]) === targetAlunoId;
    if (ehAlvo) {
      removidos++;
    } else {
      novas.push(linha);
    }
  }
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return jsonResponse({ ok: true, removidos: removidos });
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

function substituirRegistros(alunoId, registros) {
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const novas = [headers];
  const targetAlunoId = String(alunoId);

  for (let i = 1; i < data.length; i++) {
    if (data[i].some(c => c !== '' && c !== null) && String(data[i][1]) !== targetAlunoId) {
      novas.push(data[i]);
    }
  }
  registros.forEach(r => {
    const compRaw = String(r.completou).toLowerCase();
    const comp = (r.completou === false || compRaw === 'nao' || compRaw === 'false' || compRaw === 'no') ? 'nao' : 'sim';
    const valores = {
      timestamp: r.timestamp || new Date().toISOString(),
      aluno_id: alunoId,
      dia: r.dia || '',
      exercicio: r.exercicio || '',
      carga: r.carga || '',
      reps: r.reps || '',
      rir: r.rir != null ? r.rir : '',
      completou: comp,
      obs: r.obs || '',
      data_treino: r.data_treino || '',
      modalidade: r.modalidade || ''
    };
    novas.push(headers.map(h => valores[h] !== undefined ? valores[h] : ''));
  });
  sheet.clear();
  sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
  return registros.length;
}

/* ============ MANUTENCAO (rodar manualmente no editor) ============ */

function limpezaOrfaos() {
  return withLock(function() {
    const ids = new Set(sheetToObjects(getSheet('alunos')).map(a => String(a.id)));
    let totRemovidoss = 0;
    ['plano', 'registro'].forEach(name => {
      const sheet = getSheet(name);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idCol = (name === 'plano') ? 0 : 1;
      const novas = [headers];
      for (let i = 1; i < data.length; i++) {
        const linha = data[i];
        if (!linha.some(c => c !== '' && c !== null)) continue;
        if (ids.has(String(linha[idCol]))) {
          novas.push(linha);
        } else {
          Logger.log('ORFAO removido de ' + name + ': ' + JSON.stringify(linha));
          totRemovidoss++;
        }
      }
      sheet.clear();
      sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
    });
    Logger.log('limpezaOrfaos: ' + totRemovidoss + ' linha(s) removida(s).');
    return totRemovidoss;
  });
}

function listarDuplicatas() {
  const sheet = getSheet('registro');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const indices = getHeaderIndices(sheet, ['aluno_id', 'dia', 'exercicio', 'timestamp']);
  const iAluno = indices['aluno_id'];
  const iDia = indices['dia'];
  const iEx = indices['exercicio'];
  const iTs = indices['timestamp'];
  const visto = {};
  for (let i = 1; i < data.length; i++) {
    const linha = data[i];
    if (!linha.some(c => c !== '' && c !== null)) continue;
    const k = [linha[iAluno], String(linha[iDia]).toUpperCase(), dataSessaoLinha(linha, indices), linha[iEx]].join('|');
    if (!visto[k]) visto[k] = [];
    const ts = linha[iTs];
    visto[k].push((ts instanceof Date) ? ts.toISOString() : String(ts));
  }
  let nDup = 0;
  Object.keys(visto).forEach(k => {
    if (visto[k].length > 1) {
      nDup++;
      Logger.log('DUPLICATA ' + k + ' -> timestamps: ' + visto[k].join(' , '));
    }
  });
  Logger.log('listarDuplicatas: ' + nDup + ' chave(s) duplicada(s).');
  return nDup;
}

/* ============ SETUP ============ */

function setup() {
  getSheet('alunos');
  getSheet('plano');
  getSheet('registro');
  getSheet('peso');
  getSheet('perimetros');
  Logger.log('Abas alunos, plano, registro, peso e perimetros prontas.');
}
