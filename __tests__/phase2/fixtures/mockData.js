/**
 * Mock data fixtures for Phase 2 frontend integration tests
 * Simulates backend API responses
 */

export const mockStudents = [
  {
    id: 'student1',
    nome: 'João Silva',
    pin: '1234',
    status: 'ativo',
  },
  {
    id: 'student2',
    nome: 'Maria Santos',
    pin: '5678',
    status: 'ativo',
  },
  {
    id: 'student3',
    nome: 'Carlos Oliveira',
    pin: '9012',
    status: 'inativo',
  },
];

export const mockPlano = {
  'student1': {
    'A': [
      { ordem: 1, exercicio: 'Agachamento', tipo: 'Composto', carga: '50', reps: '8', rir: '2' },
      { ordem: 2, exercicio: 'Leg Press', tipo: 'Composto', carga: '100', reps: '10', rir: '2' },
      { ordem: 3, exercicio: 'Cadeira Extensora', tipo: 'Isolado', carga: '80', reps: '12', rir: '1' },
    ],
    'B': [
      { ordem: 1, exercicio: 'Supino', tipo: 'Composto', carga: '60', reps: '8', rir: '2' },
      { ordem: 2, exercicio: 'Rosca Direta', tipo: 'Isolado', carga: '20', reps: '12', rir: '1' },
    ],
    'C': [
      { ordem: 1, exercicio: 'Unilateral Direita', tipo: 'Isolado', carga: '35', reps: '10', rir: '2' },
      { ordem: 2, exercicio: 'Unilateral Esquerda', tipo: 'Isolado', carga: '35', reps: '10', rir: '2' },
    ],
    'D': [
      { ordem: 1, exercicio: 'Pulley Frontal', tipo: 'Composto', carga: '80', reps: '8', rir: '2' },
    ],
    'E': [],
  },
};

export const mockRegistros = {
  'student1': [
    {
      id: 'reg1',
      aluno_id: 'student1',
      dia: 'A',
      data_treino: '2026-07-10',
      timestamp: '2026-07-10T10:00:00Z',
      exercicio: 'Agachamento',
      carga: '50',
      reps: '8',
      rir: '2',
      completou: 'sim',
      obs: 'Sentiu cansaço no final',
    },
    {
      id: 'reg2',
      aluno_id: 'student1',
      dia: 'A',
      data_treino: '2026-07-10',
      timestamp: '2026-07-10T10:05:00Z',
      exercicio: 'Leg Press',
      carga: '100',
      reps: '10',
      rir: '2',
      completou: 'sim',
      obs: '',
    },
    {
      id: 'reg3',
      aluno_id: 'student1',
      dia: 'A',
      data_treino: '2026-07-10',
      timestamp: '2026-07-10T10:15:00Z',
      exercicio: 'Cadeira Extensora',
      carga: '80',
      reps: '12',
      rir: '1',
      completou: 'sim',
      obs: '',
    },
    // Previous day workout
    {
      id: 'reg4',
      aluno_id: 'student1',
      dia: 'B',
      data_treino: '2026-07-09',
      timestamp: '2026-07-09T14:00:00Z',
      exercicio: 'Supino',
      carga: '60',
      reps: '8',
      rir: '2',
      completou: 'sim',
      obs: 'Ótima forma',
    },
    // Older workout
    {
      id: 'reg5',
      aluno_id: 'student1',
      dia: 'A',
      data_treino: '2026-07-08',
      timestamp: '2026-07-08T10:00:00Z',
      exercicio: 'Agachamento',
      carga: '45',
      reps: '8',
      rir: '3',
      completou: 'nao',
      obs: 'Dor no joelho',
    },
  ],
  'student2': [
    {
      id: 'reg6',
      aluno_id: 'student2',
      dia: 'C',
      data_treino: '2026-07-10',
      timestamp: '2026-07-10T16:00:00Z',
      exercicio: 'Unilateral Direita',
      carga: '35',
      reps: '10',
      rir: '2',
      completou: 'sim',
      obs: '',
    },
  ],
};

/**
 * Student login response
 */
export function createAlunoResponse(alunoId) {
  const student = mockStudents.find(s => s.id === alunoId);
  if (!student) {
    return { error: 'Aluno não encontrado' };
  }

  return {
    ok: true,
    aluno: {
      id: student.id,
      nome: student.nome,
    },
    plano: mockPlano[alunoId] || {},
    registros: mockRegistros[alunoId] || [],
  };
}

/**
 * Trainer login response
 */
export function createAdminResponse() {
  return {
    ok: true,
    alunos: mockStudents,
    plano: mockPlano,
    registros: mockRegistros,
  };
}

/**
 * Save registro response
 */
export function createSalvarRegistroResponse(success = true) {
  if (!success) {
    return { error: 'Falha ao salvar registro' };
  }
  return { ok: true };
}

/**
 * Save plano response
 */
export function createSalvarPlanoResponse(success = true) {
  if (!success) {
    return { error: 'Falha ao salvar plano' };
  }
  return { ok: true };
}

/**
 * Admin register workout response (v28.6)
 */
export function createRegistroAdminResponse(success = true) {
  if (!success) {
    return { error: 'Admin key inválida' };
  }
  return { ok: true, registrado_em: new Date().toISOString() };
}

/**
 * Test admin key for testing
 */
export const TEST_ADMIN_KEY = 'test-admin-key-12345';

/**
 * Test student credentials
 */
export const TEST_CREDENTIALS = {
  id: 'student1',
  pin: '1234',
};

/**
 * Create time-stamped workout data for session testing
 */
export function createSessionData(dia, date, exercises = 3) {
  const baseTime = new Date(`${date}T10:00:00Z`).getTime();
  const registros = [];

  for (let i = 0; i < exercises; i++) {
    registros.push({
      id: `reg-session-${i}`,
      aluno_id: 'student1',
      dia,
      data_treino: date,
      timestamp: new Date(baseTime + i * 5 * 60 * 1000).toISOString(), // 5min apart
      exercicio: `Exercício ${i + 1}`,
      carga: '50',
      reps: '8',
      rir: '2',
      completou: 'sim',
      obs: '',
    });
  }

  return registros;
}

/**
 * Create workout data spanning multiple sessions
 */
export function createMultiSessionData() {
  return [
    ...createSessionData('A', '2026-07-10', 3), // Today
    ...createSessionData('B', '2026-07-09', 2), // Yesterday
    ...createSessionData('A', '2026-07-08', 3), // 2 days ago
    ...createSessionData('C', '2026-07-07', 4), // 3 days ago
  ];
}
