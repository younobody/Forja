/**
 * FORJA - Apps Script backend - v3.3.2 (jul/2026, p/ FORJA v29+)
 *
 * COMO ATUALIZAR (sem perder nada):
 * 1. Abra a planilha FORJA - Banco -> Extensoes -> Apps Script.
 * 2. ANOTE sua ADMIN_KEY atual (linha const ADMIN_KEY = ...).
 * 3. Substitua TODO o codigo por este arquivo e RESTAURE sua ADMIN_KEY.
 * 4. Implantar -> Gerenciar implantacoes -> (lapis) Editar -> Versao: "Nova versao"
 *    -> Implantar. A URL NAO muda (nao precisa mexer no forja.html).
 * 5. Confirme: abra a URL do Web App + ?action=ping -> deve responder backend: 'v3.3.2'.
 * 6. (Opcional, 1x) Rode limpezaOrfaos() e limpezaDuplicatasJun2026() no editor
 *    e confira o Logger (Ctrl+Enter / Ver registros).
 *
 * NOVIDADES v3.3.2 (fix critico - definitivo):
 * - A aba "registro" virou uma Tabela do Sheets (tipo fixo por coluna). setNumberFormat
 *   lancava excecao e derrubava TODA request (login de aluno e trainer davam "codigo
 *   invalido"). No Rhino o erro era "lazy" (estourava num flush posterior, fora do
 *   try/catch). Agora: o bloco de forcaColunaTExto roda dentro de try/catch com
 *   SpreadsheetApp.flush() que forca o erro a materializar e ser engolido ali.
 *   ping responde backend: 'v3.3.2'.
 *
 * NOVIDADES v3.3 (v29 + perimetros):
 * - Coluna "modalidade" no registro (bilateral/unilateral, opcional).
 * - Aba "perimetros" nova (8 medidas: cintura★, quadril, peito, braco, antebraco, coxa, panturrilha, pescoco).
 * - Acao salvarPerimetros (autenticada por PIN).
 * - getAluno tambem devolve o historico de perimetros.
 *
 * NOVIDADES v3:
 * - Coluna "meta" no plano (carga-alvo de 1 ano) - migra sozinha (ensureColuna).
 * - Aba "peso" nova + acao salvarPeso (pesagem: peso + balanca + obs).
 * - getAluno tambem devolve o historico de peso.
 *
 * NOVIDADES v2:
 * - LockService em TODAS as escritas: dois saves simultaneos nao se atropelam mais.
 * - getAluno devolve o historico INTEIRO (sem corte em 100).
 * - registroBatch: salva sessao inteira numa unica chamada.
 * - Coluna "tipo" no plano (composto/isolado) - migra sozinha.
 * - Funcoes de manutencao: limpezaOrfaos, listarDuplicatas, etc.
 */

const ADMIN_KEY = '262626'; // <<< RESTAURE SUA CHAVE AQUI

/* ============ ROTEAMENTO ============ */

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getAluno') return getAluno(e.parameter.id, e.parameter.pin);
    if (action === 'getAdmin') {
      if (e.parameter.key !== ADMIN_KEY) return jsonResponse({ error: 'unauthorized' });
      return getAdmin();
    }
    if (action === 'ping') return jsonResponse({ ok: true, time: new Date().toISOString(), backend: 'v3.3.2' });
    return jsonResponse({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
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
  finally { lock.releaseLock(); }
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
  return alunos.some(a => {
    const aId = String(a.id).trim();
    const aPin = String(a.pin).trim();
    const paramId = String(id).trim();
    const paramPin = String(pin).trim();
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

function dataSessaoLinha(linha, headers) {
  const iDt = headers.indexOf('data_treino');
  const iTs = headers.indexOf('timestamp');
  const dt = iDt >= 0 ? dataTreinoIso(linha[iDt]) : '';
  if (dt) return dt;
  const ts = linha[iTs];
  const d = (ts instanceof Date) ? ts : new Date(String(ts));
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* ============ LEITURA ============ */

function getAluno(id, pin) {
  if (!validarAluno(id, pin)) return jsonResponse({ error: 'aluno/pin invalido' });

  const paramId = String(id).trim();
  const aluno = sheetToObjects(getSheet('alunos')).find(a => String(a.id).trim() === paramId);

  if (!aluno) return jsonResponse({ error: 'aluno nao encontrado' });

  const plano = sheetToObjects(getSheet('plano')).filter(p => String(p.aluno_id).trim() === paramId);
  const registros = sheetToObjects(getSheet('registro')).filter(r => String(r.aluno_id).trim() === paramId);

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
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
  const iAluno = headers.indexOf('aluno_id');
  const iDia = headers.indexOf('dia');
  const alvodia = String(body.dia || '').toUpperCase();
  const alvodata = dataTreinoIso(body.data_treino) ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const novas = [headers];
  let sobrescritos = 0;
  for (let i = 1; i < data.length; i++) {
    const linha = data[i];
    if (!linha.some(c => c !== '' && c !== null)) continue;
    const mesmaSeSSao = body.sobrescrever === true &&
      String(linha[iAluno]) === String(body.aluno_id) &&
      String(linha[iDia]).toUpperCase() === alvodia &&
      dataSessaoLinha(linha, headers) === alvodata;
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

function removerRegistrosBatch(body) {
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
  for (let i = 1; i < data.length; i++) {
    const ts = data[i][0];
    const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
    const linhaAlunoId = String(data[i][1]);
    const vazia = !data[i].some(c => c !== '' && c !== null);
    const ehAlvo = tsStr === String(body.timestamp) && linhaAlunoId === String(body.aluno_id);
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
    const ehAlvo = targets.has(tsStr) && String(linha[1]) === String(body.aluno_id);
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
  for (let i = 1; i < data.length; i++) {
    if (data[i].some(c => c !== '' && c !== null) && String(data[i][1]) !== String(alunoId)) {
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
  const iAluno = headers.indexOf('aluno_id');
  const iDia = headers.indexOf('dia');
  const iEx = headers.indexOf('exercicio');
  const iTs = headers.indexOf('timestamp');
  const visto = {};
  for (let i = 1; i < data.length; i++) {
    const linha = data[i];
    if (!linha.some(c => c !== '' && c !== null)) continue;
    const k = [linha[iAluno], String(linha[iDia]).toUpperCase(), dataSessaoLinha(linha, headers), linha[iEx]].join('|');
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

function limpezaDuplicatasJun2026() {
  const remover = [
    '2026-06-08T21:10:56.339Z',
    '2026-06-09T21:16:23.695Z',
    '2026-06-09T21:21:49.076Z',
    '2026-06-09T21:21:52.619Z'
  ];
  return withLock(function() {
    const sheet = getSheet('registro');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const targets = new Set(remover);
    const novas = [headers];
    let removidos = 0;
    for (let i = 1; i < data.length; i++) {
      const linha = data[i];
      if (!linha.some(c => c !== '' && c !== null)) continue;
      const ts = linha[0];
      const tsStr = (ts instanceof Date) ? ts.toISOString() : String(ts);
      if (targets.has(tsStr)) {
        Logger.log('DUPLICATA removida: ' + JSON.stringify(linha));
        removidos++;
      } else {
        novas.push(linha);
      }
    }
    sheet.clear();
    sheet.getRange(1, 1, novas.length, headers.length).setValues(novas);
    Logger.log('limpezaDuplicatasJun2026: ' + removidos + ' de ' + remover.length + ' removida(s).');
    return removidos;
  });
}

function limpezaObsPedal() {
  return withLock(function() {
    const sheet = getSheet('plano');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const iAluno = headers.indexOf('aluno_id');
    const iObs = headers.indexOf('obs');
    if (iObs === -1) { Logger.log('coluna obs nao encontrada'); return 0; }
    let limpos = 0;
    for (let i = 1; i < data.length; i++) {
      const linha = data[i];
      if (!linha.some(c => c !== '' && c !== null)) continue;
      if (String(linha[iAluno]) !== 'marcos') continue;
      const obs = String(linha[iObs] || '');
      if (/pedal/i.test(obs) && /modificad/i.test(obs)) {
        sheet.getRange(i + 1, iObs + 1).setValue('');
        Logger.log('obs limpo na linha ' + (i + 1) + ': "' + obs + '"');
        limpos++;
      }
    }
    Logger.log('limpezaObsPedal: ' + limpos + ' obs limpo(s) (esperado 5).');
    return limpos;
  });
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
