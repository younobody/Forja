/**
 * Testes de Validação de Dados
 * Verifica que campos obrigatórios são validados e dados inválidos são rejeitados
 */

require('../__mocks__/google-apps-script');
const backend = require('../backend');

describe('importAluno - Validação de Dados', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  describe('Validação de campos obrigatórios', () => {
    it('rejeita quando falta aluno.id', () => {
      // Arrange
      const body = {
        aluno: { nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('id');
    });

    it('rejeita quando falta aluno.nome', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('nome');
    });

    it('rejeita quando falta aluno.pin', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('pin');
    });

    it('rejeita quando aluno.id é vazio string', () => {
      // Arrange
      const body = {
        aluno: { id: '', nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
    });

    it('rejeita quando aluno.nome é vazio string', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: '', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
    });

    it('rejeita quando aluno.pin é vazio string', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
    });

    it('rejeita quando aluno é null', () => {
      // Arrange
      const body = {
        aluno: null,
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
    });

    it('rejeita quando aluno é undefined', () => {
      // Arrange
      const body = {
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.error).toBeDefined();
    });
  });

  describe('Aceitação de valores válidos', () => {
    it('aceita aluno mínimo com plano vazio', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      expect(parsed.aluno_id).toBe('user1');
      expect(parsed.exercicios_importados).toBe(0);
    });

    it('aceita aluno com campos opcionais preenchidos', () => {
      // Arrange
      const body = {
        aluno: {
          id: 'user1',
          nome: 'Alice',
          pin: '1234',
          objetivo: 'Ganhar massa',
          notas: 'Alergia a amendoim'
        },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });

    it('aceita ID numérico', () => {
      // Arrange
      const body = {
        aluno: { id: 123, nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });

    it('aceita PIN numérico', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: 1234 },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('Validação de plano', () => {
    it('aceita plano vazio', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      expect(parsed.exercicios_importados).toBe(0);
    });

    it('aceita plano com múltiplos exercícios', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: [
          { dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100 },
          { dia: 'A', exercicio: 'Rosca Direta', series: 3, reps: 10, carga: 30 },
          { dia: 'B', exercicio: 'Agachamento', series: 4, reps: 6, carga: 140 }
        ]
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      expect(parsed.exercicios_importados).toBe(3);
    });

    it('aceita exercício com campos opcionais', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: [
          {
            dia: 'A',
            exercicio: 'Supino',
            series: 4,
            reps: 8,
            carga: 100,
            rir: 2,
            obs: 'Usar pegada um pouco mais larga'
          }
        ]
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('Validação de registros (histórico)', () => {
    it('aceita sem registros', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: []
        // registros omitido
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      expect(parsed.registros_importados).toBe(0);
    });

    it('aceita registros vazio array', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: [],
        registros: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      expect(parsed.registros_importados).toBe(0);
    });

    it('aceita múltiplos registros', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: '1234' },
        plano: [],
        registros: [
          { timestamp: '2024-01-01T10:00:00Z', dia: 'A', exercicio: 'Supino', carga: 100, reps: 8, completou: true },
          { timestamp: '2024-01-02T10:00:00Z', dia: 'B', exercicio: 'Agachamento', carga: 140, reps: 6, completou: true }
        ]
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
      expect(parsed.registros_importados).toBe(2);
    });
  });

  describe('Tratamento de dados anormais', () => {
    it('aceita nome muito longo (1000+ caracteres)', () => {
      // Arrange
      const longName = 'A'.repeat(1000);
      const body = {
        aluno: { id: 'user1', nome: longName, pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });

    it('aceita PIN com caracteres especiais', () => {
      // Arrange
      const body = {
        aluno: { id: 'user1', nome: 'Alice', pin: 'abc-123!@#' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });

    it('aceita ID com caracteres especiais', () => {
      // Arrange
      const body = {
        aluno: { id: 'user@example.com', nome: 'Alice', pin: '1234' },
        plano: []
      };

      // Act
      const result = backend.importAluno(body);
      const responseText = result.getText();
      const parsed = JSON.parse(responseText);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });
});
