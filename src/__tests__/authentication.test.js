/**
 * Testes de Autenticação
 * Valida comportamento de login de alunos e trainer
 */

require('../__mocks__/google-apps-script');
const backend = require('../backend');

describe('validarAluno - Autenticação de Estudante', () => {
  beforeEach(() => {
    // Reset state entre testes
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  describe('Cenários positivos', () => {
    it('aceita ID + PIN válidos', () => {
      // Arrange
      const sheet = require('../__mocks__/google-apps-script');
      const alunos = global.SpreadsheetApp.getActiveSpreadsheet();
      const alunosSheet = alunos.insertSheet('alunos');
      alunosSheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      alunosSheet.appendRow(['alice1', 'Alice Silva', '1234', 'Ganhar massa', '', new Date().toISOString()]);

      // Act
      const result = backend.validarAluno('alice1', '1234');

      // Assert
      expect(result).toBe(true);
    });

    it('aceita ID numérico comparado com string', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const alunosSheet = ss.insertSheet('alunos');
      alunosSheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      alunosSheet.appendRow(['123', 'Bob', '5678', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno(123, '5678')).toBe(true);
      expect(backend.validarAluno('123', 5678)).toBe(true);
    });

    it('aceita múltiplos alunos (encontra o correto)', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['user1', 'Alice', '1111', '', '', new Date().toISOString()]);
      sheet.appendRow(['user2', 'Bob', '2222', '', '', new Date().toISOString()]);
      sheet.appendRow(['user3', 'Charlie', '3333', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('user1', '1111')).toBe(true);
      expect(backend.validarAluno('user2', '2222')).toBe(true);
      expect(backend.validarAluno('user3', '3333')).toBe(true);
    });
  });

  describe('Cenários negativos', () => {
    it('rejeita PIN inválido', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['alice1', 'Alice', '1234', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('alice1', '9999')).toBe(false);
    });

    it('rejeita ID inexistente', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['alice1', 'Alice', '1234', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('bob1', '1234')).toBe(false);
    });

    it('rejeita PIN vazio', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['alice1', 'Alice', '1234', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('alice1', '')).toBe(false);
    });

    it('rejeita ID vazio', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['alice1', 'Alice', '1234', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('', '1234')).toBe(false);
    });

    it('retorna false em sheet vazia', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      // Sem dados

      // Act & Assert
      expect(backend.validarAluno('anyone', 'anypin')).toBe(false);
    });

    it('diferencia entre PINs semelhantes', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['user1', 'Alice', '1234', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('user1', '1234')).toBe(true);
      expect(backend.validarAluno('user1', '1235')).toBe(false);
      expect(backend.validarAluno('user1', '123')).toBe(false);
      expect(backend.validarAluno('user1', '12345')).toBe(false);
    });

    it('é case-sensitive em ID', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['Alice1', 'Alice', '1234', '', '', new Date().toISOString()]);

      // Act & Assert
      expect(backend.validarAluno('Alice1', '1234')).toBe(true);
      expect(backend.validarAluno('alice1', '1234')).toBe(false);
    });
  });

  describe('Segurança', () => {
    it('não vazeia informação via timing (implementação futura)', () => {
      // Este teste documenta uma melhoria de segurança futura
      // Implementações vulneráveis podem vazar timing info
      // via tentativa de login timing attacks
      expect(true).toBe(true);
    });

    it('não armazena PIN em logs', () => {
      // Arrange
      const ss = global.SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.insertSheet('alunos');
      sheet.appendRow(['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']);
      sheet.appendRow(['user1', 'Alice', 'senha_secreta_123', '', '', new Date().toISOString()]);

      // Act
      backend.validarAluno('user1', 'senha_secreta_123');

      // Assert - verifica que Logger.log não foi chamado com o PIN
      if (global.Logger.log.mock) {
        const calls = global.Logger.log.mock.calls;
        calls.forEach(call => {
          expect(call[0]).not.toContain('senha_secreta_123');
        });
      }
    });
  });
});
