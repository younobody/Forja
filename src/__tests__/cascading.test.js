/**
 * Testes de Operações em Cascata
 * Verifica que deletar um aluno remove dados relacionados corretamente
 * Verifica isolamento entre alunos (dados de um não afetam o outro)
 */

require('../__mocks__/google-apps-script');
const backend = require('../backend');

describe('removerAluno - Cascading Delete', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  it('remove aluno de alunos sheet', () => {
    // Arrange
    backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });
    backend.salvarAluno({ id: 'bob1', nome: 'Bob', pin: '5678' });
    expect(backend.sheetToObjects(backend.getSheet('alunos')).length).toBe(2);

    // Act
    backend.removerAluno({ id: 'alice1' });

    // Assert
    const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
    expect(alunos.length).toBe(1);
    expect(alunos[0].id).toBe('bob1');
  });

  it('remove planos do aluno de plano sheet', () => {
    // Arrange
    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [
        { dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100, rir: 2, obs: '' },
        { dia: 'B', exercicio: 'Agachamento', series: 4, reps: 6, carga: 140, rir: 2, obs: '' }
      ]
    });

    backend.salvarPlano({
      aluno_id: 'bob1',
      plano: [
        { dia: 'A', exercicio: 'Rosca', series: 3, reps: 10, carga: 30, rir: 1, obs: '' }
      ]
    });

    expect(backend.sheetToObjects(backend.getSheet('plano')).length).toBe(3);

    // Act
    backend.removerAluno({ id: 'alice1' });

    // Assert
    const plano = backend.sheetToObjects(backend.getSheet('plano'));
    expect(plano.length).toBe(1);
    expect(plano[0].aluno_id).toBe('bob1');
  });

  it('remove registros do aluno de registro sheet', () => {
    // Arrange
    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Supino',
      carga: 100,
      reps: 8,
      completou: true
    });

    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'B',
      exercicio: 'Agachamento',
      carga: 140,
      reps: 6,
      completou: true
    });

    backend.salvarRegistro({
      aluno_id: 'bob1',
      dia: 'A',
      exercicio: 'Rosca',
      carga: 30,
      reps: 10,
      completou: true
    });

    expect(backend.sheetToObjects(backend.getSheet('registro')).length).toBe(3);

    // Act
    backend.removerAluno({ id: 'alice1' });

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(1);
    expect(registros[0].aluno_id).toBe('bob1');
  });

  it('remove aluno completamente (todas as 3 sheets)', () => {
    // Arrange - Setup dados complexos
    backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });
    backend.salvarAluno({ id: 'bob1', nome: 'Bob', pin: '5678' });

    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [{ dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100, rir: 2, obs: '' }]
    });

    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Supino',
      carga: 100,
      reps: 8,
      completou: true
    });

    // Act
    backend.removerAluno({ id: 'alice1' });

    // Assert
    expect(backend.sheetToObjects(backend.getSheet('alunos')).length).toBe(1);
    expect(backend.sheetToObjects(backend.getSheet('plano')).length).toBe(0);
    expect(backend.sheetToObjects(backend.getSheet('registro')).length).toBe(0);
  });

  it('não afeta dados de outros alunos', () => {
    // Arrange
    backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });
    backend.salvarAluno({ id: 'bob1', nome: 'Bob', pin: '5678' });
    backend.salvarAluno({ id: 'charlie1', nome: 'Charlie', pin: '9012' });

    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [{ dia: 'A', exercicio: 'Ex1', series: 1, reps: 1, carga: 1, rir: 1, obs: '' }]
    });
    backend.salvarPlano({
      aluno_id: 'bob1',
      plano: [{ dia: 'A', exercicio: 'Ex2', series: 1, reps: 1, carga: 1, rir: 1, obs: '' }]
    });
    backend.salvarPlano({
      aluno_id: 'charlie1',
      plano: [{ dia: 'A', exercicio: 'Ex3', series: 1, reps: 1, carga: 1, rir: 1, obs: '' }]
    });

    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Ex1',
      carga: 1,
      reps: 1,
      completou: true
    });
    backend.salvarRegistro({
      aluno_id: 'bob1',
      dia: 'A',
      exercicio: 'Ex2',
      carga: 1,
      reps: 1,
      completou: true
    });
    backend.salvarRegistro({
      aluno_id: 'charlie1',
      dia: 'A',
      exercicio: 'Ex3',
      carga: 1,
      reps: 1,
      completou: true
    });

    // Act
    backend.removerAluno({ id: 'bob1' });

    // Assert
    const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
    const plano = backend.sheetToObjects(backend.getSheet('plano'));
    const registros = backend.sheetToObjects(backend.getSheet('registro'));

    expect(alunos.length).toBe(2);
    expect(alunos.map(a => a.id)).toEqual(['alice1', 'charlie1']);

    expect(plano.length).toBe(2);
    expect(plano.map(p => p.aluno_id)).toEqual(['alice1', 'charlie1']);

    expect(registros.length).toBe(2);
    expect(registros.map(r => r.aluno_id)).toEqual(['alice1', 'charlie1']);
  });

  it('remove aluno mesmo se não existe planos', () => {
    // Arrange
    backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

    // Act & Assert - não deve throw
    expect(() => backend.removerAluno({ id: 'alice1' })).not.toThrow();
  });

  it('remove aluno mesmo se não existe registros', () => {
    // Arrange
    backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

    // Act & Assert
    expect(() => backend.removerAluno({ id: 'alice1' })).not.toThrow();
  });

  it('é idempotente (remover duas vezes é seguro)', () => {
    // Arrange
    backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

    // Act
    backend.removerAluno({ id: 'alice1' });
    backend.removerAluno({ id: 'alice1' }); // Remover novamente

    // Assert - não deve crash
    const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
    expect(alunos.length).toBe(0);
  });
});

describe('removerRegistro - Remove Workout Specific', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  it('remove registro específico por timestamp', () => {
    // Arrange - usar timestamps explícitos para evitar conflitos de timing
    const sheet = backend.getSheet('registro');
    sheet.appendRow(['2024-01-01T10:00:00Z', 'alice1', 'A', 'Supino', 100, 8, 2, 'sim', '']);
    sheet.appendRow(['2024-01-02T10:00:00Z', 'alice1', 'B', 'Agachamento', 140, 6, 2, 'sim', '']);

    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(2);

    // Act
    backend.removerRegistro({ timestamp: '2024-01-01T10:00:00Z' });

    // Assert
    const registrosAfter = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registrosAfter.length).toBe(1);
    expect(registrosAfter[0].timestamp).toBe('2024-01-02T10:00:00Z');
  });

  it('não remove registros de outros alunos', () => {
    // Arrange
    const sheet = backend.getSheet('registro');
    sheet.appendRow(['2024-01-01T10:00:00Z', 'alice1', 'A', 'Supino', 100, 8, 2, 'sim', '']);
    sheet.appendRow(['2024-01-02T10:00:00Z', 'bob1', 'A', 'Rosca', 30, 10, 1, 'sim', '']);

    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(2);

    // Act
    backend.removerRegistro({ timestamp: '2024-01-01T10:00:00Z' });

    // Assert
    const registrosAfter = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registrosAfter.length).toBe(1);
    expect(registrosAfter[0].aluno_id).toBe('bob1');
  });
});

describe('substituirRegistros - Replace All Records for Student', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  it('substitui histórico completo de aluno', () => {
    // Arrange
    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Old Exercise',
      carga: 50,
      reps: 5,
      completou: true
    });

    expect(backend.sheetToObjects(backend.getSheet('registro')).length).toBe(1);

    // Act
    backend.substituirRegistros('alice1', [
      { dia: 'A', exercicio: 'New Ex 1', carga: 100, reps: 8, completou: true },
      { dia: 'B', exercicio: 'New Ex 2', carga: 140, reps: 6, completou: true }
    ]);

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(2);
    expect(registros.map(r => r.exercicio)).toEqual(['New Ex 1', 'New Ex 2']);
  });

  it('preserva registros de outros alunos', () => {
    // Arrange
    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Alice Ex',
      carga: 100,
      reps: 8,
      completou: true
    });

    backend.salvarRegistro({
      aluno_id: 'bob1',
      dia: 'A',
      exercicio: 'Bob Ex',
      carga: 30,
      reps: 10,
      completou: true
    });

    // Act
    backend.substituirRegistros('alice1', [
      { dia: 'B', exercicio: 'Alice New Ex', carga: 120, reps: 6, completou: true }
    ]);

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(2);
    expect(registros.find(r => r.aluno_id === 'bob1').exercicio).toBe('Bob Ex');
  });

  describe('Conversão de completou', () => {
    it('converte completou boolean para string', () => {
      // Act
      backend.substituirRegistros('alice1', [
        { dia: 'A', exercicio: 'Ex', carga: 100, reps: 8, completou: true },
        { dia: 'A', exercicio: 'Ex2', carga: 100, reps: 8, completou: false }
      ]);

      // Assert
      const registros = backend.sheetToObjects(backend.getSheet('registro'));
      expect(registros[0].completou).toBe('sim');
      expect(registros[1].completou).toBe('nao');
    });

    it('converte string "false" corretamente', () => {
      // Act
      backend.substituirRegistros('alice1', [
        { dia: 'A', exercicio: 'Ex', carga: 100, reps: 8, completou: 'false' }
      ]);

      // Assert
      const registros = backend.sheetToObjects(backend.getSheet('registro'));
      expect(registros[0].completou).toBe('nao');
    });

    it('converte string "no" corretamente', () => {
      // Act
      backend.substituirRegistros('alice1', [
        { dia: 'A', exercicio: 'Ex', carga: 100, reps: 8, completou: 'no' }
      ]);

      // Assert
      const registros = backend.sheetToObjects(backend.getSheet('registro'));
      expect(registros[0].completou).toBe('nao');
    });
  });
});
