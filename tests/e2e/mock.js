// Backend falso do FORJA para a auditoria (dados 100% fictícios).
// Intercepta POST /rest/v1/rpc/api_get e api_post e devolve payloads no mesmo formato do Supabase.

const DIA_MS = 86400000;
function iso(d) { return d.toISOString(); }
function ymd(d) { return d.toISOString().slice(0, 10); }

const EXERCICIOS = [
  ['Supino reto barra', 'peito', 'triceps;ombro', 'Barra', 'supino-reto-barra'],
  ['Supino inclinado halter', 'peito', 'ombro;triceps', 'Halter', 'supino-inclinado-halter'],
  ['Desenvolvimento máquina', 'ombro', 'triceps', 'Máquina', 'desenvolvimento-maquina'],
  ['Elevação lateral halter', 'ombro', '', 'Halter', 'elevacao-lateral-halter'],
  ['Tríceps corda', 'triceps', '', 'Polia', 'triceps-corda'],
  ['Prancha', 'core', '', 'Peso corporal', 'prancha'],
  ['Puxada frontal', 'costas', 'biceps', 'Polia', 'puxada-frontal'],
  ['Remada baixa V', 'costas', 'biceps', 'Polia', 'remada-baixa-v'],
  ['Remada serrote', 'costas', 'biceps', 'Halter', 'remada-serrote'],
  ['Face pull', 'ombro', 'costas', 'Polia', 'face-pull'],
  ['Rosca alternada halter', 'biceps', '', 'Halter', 'rosca-alternada-halter'],
  ['Rosca alternada martelo', 'biceps', '', 'Halter', 'rosca-alternada-martelo'],
  ['Leg press 45°', 'quadriceps', 'posterior', 'Máquina', 'leg-press-45'],
  ['Cadeira extensora', 'quadriceps', '', 'Máquina', 'cadeira-extensora'],
  ['Cadeira flexora', 'posterior', '', 'Máquina', 'cadeira-flexora'],
  ['Stiff halter', 'posterior', 'costas', 'Halter', 'stiff-halter'],
  ['Panturrilha em pé', 'panturrilha', '', 'Máquina', 'panturrilha-em-pe'],
  ['Abdominal remador', 'core', '', 'Peso corporal', 'abdominal-remador'],
  ['Hack squat', 'quadriceps', 'posterior', 'Máquina', 'hack-squat'],
  ['Elevação pélvica', 'posterior', 'core', 'Barra', 'elevacao-pelvica'],
].map(([nome, prim, sec, equip, slug]) => ({
  nome_atual: nome, aliases: '', musculos_primarios: prim, musculos_secundarios: sec,
  equipamento: equip, instrucoes: '1) Ajuste o equipamento.\n2) Controle a descida.\n3) Suba sem roubar com o tronco.',
  imagem_url: 'img/exercicios/' + slug + '.webp', video_url: null, wger_id: null,
}));

const PLANO_BASE = {
  A: [['Supino reto barra', '4', '8-10', '60', '2', 'Pico de carga. Sem falha.', 'composto', '80kg'],
      ['Supino inclinado halter', '3', '10-12', '22', '2', '', 'composto', '30kg'],
      ['Desenvolvimento máquina', '3', '10', '40', '2', 'banco a 70', 'composto', '55kg'],
      ['Elevação lateral halter', '3', '12-15', '8', '1', '', 'isolador', '12kg'],
      ['Tríceps corda', '3', '12', '25', '1', '', 'isolador', '35kg'],
      ['Prancha', '3', '40s', 'peso corp.', '', '', 'core', '']],
  B: [['Puxada frontal', '4', '10', '55', '2', '', 'composto', '70kg'],
      ['Remada baixa V', '3', '10-12', '50', '2', '', 'composto', '65kg'],
      ['Remada serrote', '3', '10', '28', '2', '', 'composto', '36kg'],
      ['Face pull', '3', '15-20', '25', '2', 'teto de carga 30kg, progride só em reps. Carro-chefe postural', 'postural', '30kg'],
      ['Rosca alternada halter', '3', '10-12', '12', '1', '', 'isolador', '16kg']],
  C: [['Leg press 45°', '4', '10-12', '180', '2', '', 'composto', '240kg'],
      ['Cadeira extensora', '3', '12-15', '55', '1', '', 'isolador', '70kg'],
      ['Cadeira flexora', '3', '12', '45', '1', '', 'isolador', '60kg'],
      ['Panturrilha em pé', '4', '15', '60', '1', '', 'isolador', '80kg'],
      ['Abdominal remador', '3', '15', 'peso corp.', '', '', 'core', '']],
  D: [['Hack squat', '4', '8-10', '100', '2', 'TETO 90 graus de amplitude', 'composto', '140kg'],
      ['Stiff halter', '3', '10', '26', '2', '', 'composto', '34kg'],
      ['Elevação pélvica', '3', '10-12', '60', '2', '', 'composto', '100kg'],
      ['Rosca alternada martelo', '3', '12', '14', '1', '', 'isolador', '18kg']],
};

function montarAluno(hojeMs) {
  const plano = [];
  Object.entries(PLANO_BASE).forEach(([dia, itens]) => {
    itens.forEach((it, i) => plano.push({
      aluno_id: 'demo', dia, ordem: i + 1, exercicio: it[0], series: it[1], reps: it[2], carga: it[3],
      rir: it[4], obs: it[5], tipo: it[6], meta: it[7],
    }));
  });
  const registros = [];
  const rot = ['A', 'D', 'B', 'C'];
  let k = 0;
  for (let d = 38; d >= 1; d--) {
    if (d % 7 === 0 || d % 7 === 4) continue; // dias de descanso
    const dia = rot[k++ % 4];
    const dt = new Date(hojeMs - d * DIA_MS);
    PLANO_BASE[dia].forEach((it, i) => {
      const prog = Math.floor((38 - d) / 7) * 2.5;
      const base = parseFloat(it[3]);
      const carga = isNaN(base) ? 'peso corp.' : String(base + prog);
      registros.push({
        timestamp: iso(new Date(dt.getTime() + i * 240000)), aluno_id: 'demo', dia, exercicio: it[0],
        carga, reps: it[2], rir: it[4] || '', completou: (i === 4 && d % 5 === 0) ? 'nao' : 'sim',
        obs: '10/10/9', data_treino: ymd(dt), modalidade: '', local_id: 'l' + d + '-' + i,
      });
    });
  }
  registros.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  const peso = [];
  for (let w = 8; w >= 0; w--) {
    const dt = new Date(hojeMs - w * 7 * DIA_MS);
    peso.push({ timestamp: iso(dt), aluno_id: 'demo', peso: String((83.4 - (8 - w) * 0.2).toFixed(1)), balanca: 'casa', obs: '', data: ymd(dt) });
  }
  peso.reverse();
  const perimetros = [30, 0].map(d => {
    const dt = new Date(hojeMs - d * DIA_MS);
    return { timestamp: iso(dt), aluno_id: 'demo', cintura: d ? '88' : '87', quadril: '99', peito: '104', braco: '36', antebraco: '29', coxa: '58', panturrilha: '38', pescoco: '39', data: ymd(dt) };
  });
  return {
    aluno: { id: 'demo', nome: 'Aluno Demo', objetivo: 'Hipertrofia e correção postural', notas: 'LESÕES:\n(1) Ombro direito: evitar elevação frontal.\n\nGATILHOS:\n(1) Dor no cotovelo acima de 30kg no face pull.' },
    plano, registros, peso, perimetros, exercicios: EXERCICIOS,
  };
}

function montarAdmin(hojeMs) {
  const a = montarAluno(hojeMs);
  return {
    alunos: [
      { id: 'demo', nome: 'Aluno Demo', pin: '1234', objetivo: a.aluno.objetivo, notas: a.aluno.notas, criado_em: iso(new Date(hojeMs - 90 * DIA_MS)), visivel_publico: true },
      { id: 'maria', nome: 'Maria <b>XSS</b>', pin: '5678', objetivo: 'Emagrecimento', notas: '', criado_em: iso(new Date(hojeMs - 20 * DIA_MS)), visivel_publico: true },
    ],
    plano: a.plano, registros: a.registros, exercicios: EXERCICIOS,
  };
}

async function installMock(page, opts = {}) {
  const hojeMs = Date.now();
  const calls = [];
  await page.route('**/rest/v1/rpc/api_get', async route => {
    const body = JSON.parse(route.request().postData() || '{}').payload || {};
    calls.push(['api_get', body.action]);
    let out;
    switch (body.action) {
      case 'ping': out = { ok: true, time: iso(new Date()), backend: 'supabase-v1' }; break;
      case 'feedMotivacional': out = { feed: opts.feed || [
        { nome: 'Aluno Demo', ultimoTreino: ymd(new Date(hojeMs)), streak: 4, treinos7d: 5, treinosMesPassado: 17, campeaoMes: true },
        { nome: 'Maria', ultimoTreino: ymd(new Date(hojeMs - DIA_MS)), streak: 2, treinos7d: 3, treinosMesPassado: 9, campeaoMes: false },
      ] }; break;
      case 'login':
        if (body.codigo === '1234') { out = Object.assign(montarAluno(hojeMs), { role: 'aluno', id: 'demo' }); if (opts.mutateAluno) opts.mutateAluno(out); }
        else if (body.codigo === 'admin') { out = Object.assign(montarAdmin(hojeMs), { role: 'trainer' }); if (opts.mutateAdmin) opts.mutateAdmin(out); }
        else out = { error: 'codigo invalido' };
        break;
      case 'getAluno': out = body.pin === '1234' ? montarAluno(hojeMs) : { error: 'aluno/pin invalido' }; if (body.pin === '1234' && opts.mutateAluno) opts.mutateAluno(out); break;
      case 'getAdmin': out = body.key === 'admin' ? montarAdmin(hojeMs) : { error: 'unauthorized' }; if (body.key === 'admin' && opts.mutateAdmin) opts.mutateAdmin(out); break;
      case 'listarIds': out = { ids: ['demo', 'maria'] }; break;
      default: out = { error: 'unknown action: ' + body.action };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('**/rest/v1/rpc/api_post', async route => {
    const body = JSON.parse(route.request().postData() || '{}').payload || {};
    calls.push(['api_post', body.action]);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('**/auth/v1/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { google: false } }), headers: { 'access-control-allow-origin': '*' } }));
  return calls;
}

module.exports = { installMock };
