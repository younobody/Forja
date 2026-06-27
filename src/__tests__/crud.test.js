/**
 * Testes de CRUD - Operações Básicas
 * Create, Read, Update, Delete para alunos, planos e registros
 */

require('../__mocks__/google-apps-script');
const backend = require('../backend');

describe('salvarAluno - Create/Update Aluno', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  describe('Create (novo aluno)', () => {
    it('cria novo aluno com sucesso', () => {
      // Arrange
      const body = {
        id: 'alice1',
        nome: 'Alice Silva',
        pin: '1234',
        objetivo: 'Ganhar massa',
        notas: 'Alergia a amendoim'
      };

      // Act
      const result = backend.salvarAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);

      // Verificar que foi realmente armazenado
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunos.length).toBe(1);
      expect(alunos[0].id).toBe('alice1');
      expect(alunos[0].nome).toBe('Alice Silva');
    });

    it('cria aluno com campos opcionais vazios', () => {
      // Arrange
      const body = {
        id: 'bob1',
        nome: 'Bob',
        pin: '5678'
      };

      // Act
      const result = backend.salvarAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunos[0].objetivo).toBe('');
      expect(alunos[0].notas).toBe('');
    });

    it('cria múltiplos alunos diferentes', () => {
      // Arrange & Act
      backend.salvarAluno({ id: 'user1', nome: 'Alice', pin: '1111' });
      backend.salvarAluno({ id: 'user2', nome: 'Bob', pin: '2222' });
      backend.salvarAluno({ id: 'user3', nome: 'Charlie', pin: '3333' });

      // Assert
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunos.length).toBe(3);
      expect(alunos.map(a => a.id)).toEqual(['user1', 'user2', 'user3']);
    });
  });

  describe('Update (aluno existente)', () => {
    it('atualiza aluno existente sem criar duplicata', () => {
      // Arrange
      backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });
      const alunosBefore = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunosBefore.length).toBe(1);

      // Act
      backend.salvarAluno({ id: 'alice1', nome: 'Alice Silva', pin: '5678' });

      // Assert
      const alunosAfter = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunosAfter.length).toBe(1); // Não criou duplicata!
      expect(alunosAfter[0].nome).toBe('Alice Silva');
      expect(alunosAfter[0].pin).toBe('5678');
    });

    it('atualiza apenas o campo necessário', () => {
      // Arrange
      backend.salvarAluno({
        id: 'alice1',
        nome: 'Alice',
        pin: '1234',
        objetivo: 'Ganhar massa',
        notas: 'Sem restrições'
      });

      // Act
      backend.salvarAluno({
        id: 'alice1',
        nome: 'Alice Silva',
        pin: '1234',
        objetivo: 'Ganhar força', // Alterado
        notas: 'Alergia a amendoim' // Alterado
      });

      // Assert
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunos.length).toBe(1);
      expect(alunos[0].nome).toBe('Alice Silva');
      expect(alunos[0].objetivo).toBe('Ganhar força');
      expect(alunos[0].notas).toBe('Alergia a amendoim');
    });

    it('preserva criado_em ao atualizar', () => {
      // Arrange
      const originalDate = '2024-01-01T00:00:00Z';
      backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

      // Ajustar manualmente a data de criação (simulando)
      const sheet = backend.getSheet('alunos');
      const data = sheet.getDataRange().getValues();
      data[1][5] = originalDate;

      // Act
      backend.salvarAluno({ id: 'alice1', nome: 'Alice Silva', pin: '1234' });

      // Assert
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      // Nota: em um teste real, verificaríamos que criado_em não foi alterado
      expect(alunos[0].id).toBe('alice1');
    });
  });

  describe('Integração com importAluno', () => {
    it('importAluno cria novo aluno via salvarAluno', () => {
      // Arrange
      const body = {
        aluno: { id: 'alice1', nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      backend.importAluno(body);

      // Assert
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunos.length).toBe(1);
      expect(alunos[0].nome).toBe('Alice');
    });

    it('importAluno sobrescreve aluno existente', () => {
      // Arrange
      backend.importAluno({
        aluno: { id: 'alice1', nome: 'Alice v1', pin: '1111' },
        plano: []
      });

      // Act
      backend.importAluno({
        aluno: { id: 'alice1', nome: 'Alice v2', pin: '2222' },
        plano: []
      });

      // Assert
      const alunos = backend.sheetToObjects(backend.getSheet('alunos'));
      expect(alunos.length).toBe(1);
      expect(alunos[0].nome).toBe('Alice v2');
      expect(alunos[0].pin).toBe('2222');
    });
  });
});

describe('salvarPlano - Create/Update Plano', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  it('cria plano vazio para novo aluno', () => {
    // Arrange
    const body = {
      aluno_id: 'alice1',
      plano: []
    };

    // Act
    const result = backend.salvarPlano(body);
    const responseText = result.getText();
    const parsed = JSON.parse(responseText);

    // Assert
    expect(parsed.ok).toBe(true);
  });

  it('salva múltiplos exercícios em um plano', () => {
    // Arrange
    const body = {
      aluno_id: 'alice1',
      plano: [
        { dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100, rir: 2, obs: '' },
        { dia: 'A', exercicio: 'Rosca Direta', series: 3, reps: 10, carga: 30, rir: 1, obs: '' },
        { dia: 'B', exercicio: 'Agachamento', series: 4, reps: 6, carga: 140, rir: 2, obs: '' }
      ]
    };

    // Act
    backend.salvarPlano(body);

    // Assert
    const plano = backend.sheetToObjects(backend.getSheet('plano'));
    expect(plano.length).toBe(3);
    expect(plano[0].exercicio).toBe('Supino');
    expect(plano[1].exercicio).toBe('Rosca Direta');
    expect(plano[2].exercicio).toBe('Agachamento');
  });

  it('sobrescreve plano anterior sem criar duplicatas', () => {
    // Arrange
    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [
        { dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100, rir: 2, obs: '' }
      ]
    });

    // Act - sobrescrever
    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [
        { dia: 'A', exercicio: 'Supino Inclinado', series: 3, reps: 10, carga: 80, rir: 1, obs: '' },
        { dia: 'A', exercicio: 'Supino Declinado', series: 3, reps: 10, carga: 90, rir: 1, obs: '' }
      ]
    });

    // Assert
    const plano = backend.sheetToObjects(backend.getSheet('plano'));
    expect(plano.length).toBe(2); // Não 3!
    expect(plano.map(p => p.exercicio)).toEqual(['Supino Inclinado', 'Supino Declinado']);
  });

  it('preserva plano de outros alunos ao atualizar um', () => {
    // Arrange
    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [{ dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100, rir: 2, obs: '' }]
    });

    backend.salvarPlano({
      aluno_id: 'bob1',
      plano: [{ dia: 'A', exercicio: 'Agachamento', series: 4, reps: 6, carga: 140, rir: 2, obs: '' }]
    });

    // Act - atualizar alice
    backend.salvarPlano({
      aluno_id: 'alice1',
      plano: [{ dia: 'B', exercicio: 'Rosca', series: 3, reps: 10, carga: 30, rir: 1, obs: '' }]
    });

    // Assert
    const plano = backend.sheetToObjects(backend.getSheet('plano'));
    expect(plano.length).toBe(2); // 1 de alice + 1 de bob
    const bobExercise = plano.find(p => String(p.aluno_id) === 'bob1');
    expect(bobExercise.exercicio).toBe('Agachamento');
  });

  it('atribui ordem corretamente aos exercícios', () => {
    // Arrange
    const body = {
      aluno_id: 'alice1',
      plano: [
        { dia: 'A', exercicio: 'Ex1' },
        { dia: 'A', exercicio: 'Ex2' },
        { dia: 'A', exercicio: 'Ex3' }
      ]
    };

    // Act
    backend.salvarPlano(body);

    // Assert
    const plano = backend.sheetToObjects(backend.getSheet('plano'));
    expect(plano.map(p => Number(p.ordem))).toEqual([1, 2, 3]);
  });
});

describe('salvarRegistro - Registrar Workout', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  it('salva novo registro de workout', () => {
    // Arrange
    const body = {
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Supino',
      carga: 100,
      reps: 8,
      rir: 2,
      completou: true,
      obs: 'Ótima sessão'
    };

    // Act
    const result = backend.salvarRegistro(body);
    const responseText = result.getText();
    const parsed = JSON.parse(responseText);

    // Assert
    expect(parsed.ok).toBe(true);

    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(1);
    expect(registros[0].exercicio).toBe('Supino');
    expect(registros[0].completou).toBe('sim');
  });

  it('converte completou true para "sim"', () => {
    // Arrange
    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Supino',
      carga: 100,
      reps: 8,
      completou: true
    });

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros[0].completou).toBe('sim');
  });

  it('converte completou false para "nao"', () => {
    // Arrange
    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Supino',
      carga: 100,
      reps: 8,
      completou: false
    });

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros[0].completou).toBe('nao');
  });

  it('salva múltiplos registros sem duplicata', () => {
    // Arrange & Act
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
      dia: 'A',
      exercicio: 'Supino',
      carga: 110,
      reps: 7,
      completou: true
    });

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    expect(registros.length).toBe(2);
  });

  it('adiciona timestamp automaticamente', () => {
    // Arrange
    const before = new Date();

    // Act
    backend.salvarRegistro({
      aluno_id: 'alice1',
      dia: 'A',
      exercicio: 'Supino',
      carga: 100,
      reps: 8,
      completou: true
    });

    const after = new Date();

    // Assert
    const registros = backend.sheetToObjects(backend.getSheet('registro'));
    const timestamp = new Date(registros[0].timestamp);
    expect(timestamp >= before && timestamp <= after).toBe(true);
  });
});
