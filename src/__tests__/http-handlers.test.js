/**
 * Testes para Handlers HTTP
 * Testa as funções doGet() e doPost() que lidam com requisições HTTP
 */

require('../__mocks__/google-apps-script');
const backend = require('../backend');

// Fazer funções disponíveis globalmente (como estão no Google Apps Script)
global.doGet = backend.doGet;
global.doPost = backend.doPost;

describe('doGet - Handler GET', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
    backend.setAdminKey('test-admin-key');
  });

  it('responde action=ping com sucesso', () => {
    // Arrange
    const e = {
      parameter: {
        action: 'ping'
      }
    };

    // Act
    const result = global.doGet(e);
    const content = result.getText();
    const parsed = JSON.parse(content);

    // Assert
    expect(parsed.ok).toBe(true);
    expect(parsed.time).toBeDefined();
  });

  it('rejeita action=getAdmin sem chave', () => {
    // Arrange
    const e = {
      parameter: {
        action: 'getAdmin'
        // sem key
      }
    };

    // Act
    const result = global.doGet(e);
    const content = result.getText();
    const parsed = JSON.parse(content);

    // Assert
    expect(parsed.error).toContain('unauthorized');
  });

  it('rejeita action=getAdmin com chave errada', () => {
    // Arrange
    const e = {
      parameter: {
        action: 'getAdmin',
        key: 'wrong-key'
      }
    };

    // Act
    const result = global.doGet(e);
    const content = result.getText();
    const parsed = JSON.parse(content);

    // Assert
    expect(parsed.error).toContain('unauthorized');
  });

  it('aceita action=getAdmin com chave correta', () => {
    // Arrange
    backend.salvarAluno({ id: 'user1', nome: 'Alice', pin: '1234' });

    const e = {
      parameter: {
        action: 'getAdmin',
        key: 'test-admin-key'
      }
    };

    // Act
    const result = global.doGet(e);
    const content = result.getText();
    const parsed = JSON.parse(content);

    // Assert
    expect(parsed.alunos).toBeDefined();
    expect(parsed.alunos.length).toBe(1);
  });

  it('retorna erro para action desconhecido', () => {
    // Arrange
    const e = {
      parameter: {
        action: 'unknown-action'
      }
    };

    // Act
    const result = global.doGet(e);
    const content = result.getText();
    const parsed = JSON.parse(content);

    // Assert
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('unknown action');
  });

  it('trata exceções e retorna como JSON', () => {
    // Arrange
    const e = {
      parameter: {
        action: 'getAluno',
        id: null,
        pin: null
      }
    };

    // Act - não deve throw
    expect(() => {
      const result = global.doGet(e);
      const content = result.getText();
      JSON.parse(content);
    }).not.toThrow();
  });
});

describe('doPost - Handler POST', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
    backend.setAdminKey('test-admin-key');
  });

  describe('action=registro (estudante registra workout)', () => {
    it('aceita registro com ID + PIN válidos', () => {
      // Arrange
      backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'registro',
            aluno_id: 'alice1',
            pin: '1234',
            dia: 'A',
            exercicio: 'Supino',
            carga: 100,
            reps: 8,
            completou: true
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });

    it('rejeita registro com PIN inválido', () => {
      // Arrange
      backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'registro',
            aluno_id: 'alice1',
            pin: 'wrong-pin',
            dia: 'A',
            exercicio: 'Supino',
            carga: 100,
            reps: 8,
            completou: true
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.error).toContain('invalido');
    });

    it('não precisa de admin key', () => {
      // Arrange
      backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'registro',
            aluno_id: 'alice1',
            pin: '1234',
            dia: 'A',
            exercicio: 'Supino',
            carga: 100,
            reps: 8,
            completou: true
            // sem key
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('action=salvarAluno (admin)', () => {
    it('rejeita sem admin key', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'salvarAluno',
            id: 'alice1',
            nome: 'Alice',
            pin: '1234'
            // sem key
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.error).toContain('unauthorized');
    });

    it('rejeita com admin key errada', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'salvarAluno',
            id: 'alice1',
            nome: 'Alice',
            pin: '1234',
            key: 'wrong-key'
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.error).toContain('unauthorized');
    });

    it('aceita com admin key correta', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'salvarAluno',
            key: 'test-admin-key',
            id: 'alice1',
            nome: 'Alice',
            pin: '1234'
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('action=salvarPlano (admin)', () => {
    it('aceita com admin key correta', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'salvarPlano',
            key: 'test-admin-key',
            aluno_id: 'alice1',
            plano: [
              { dia: 'A', exercicio: 'Supino', series: 4, reps: 8, carga: 100, rir: 2, obs: '' }
            ]
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('action=importAluno (admin)', () => {
    it('aceita com admin key correta', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'importAluno',
            key: 'test-admin-key',
            aluno: { id: 'alice1', nome: 'Alice', pin: '1234' },
            plano: []
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('action=removerAluno (admin)', () => {
    it('aceita com admin key correta', () => {
      // Arrange
      backend.salvarAluno({ id: 'alice1', nome: 'Alice', pin: '1234' });

      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'removerAluno',
            key: 'test-admin-key',
            id: 'alice1'
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('action=removerRegistro (admin)', () => {
    it('aceita com admin key correta', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'removerRegistro',
            key: 'test-admin-key',
            timestamp: '2024-01-01T10:00:00Z'
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.ok).toBe(true);
    });
  });

  describe('Tratamento de erros', () => {
    it('trata JSON inválido no body', () => {
      // Arrange
      const e = {
        postData: {
          contents: 'invalid json {'
        }
      };

      // Act & Assert
      expect(() => {
        const result = global.doPost(e);
        const content = result.getText();
        JSON.parse(content);
      }).not.toThrow();
    });

    it('retorna erro para action desconhecido', () => {
      // Arrange
      const e = {
        postData: {
          contents: JSON.stringify({
            action: 'unknown-action',
            key: 'test-admin-key'
          })
        }
      };

      // Act
      const result = global.doPost(e);
      const content = result.getText();
      const parsed = JSON.parse(content);

      // Assert
      expect(parsed.error).toBeDefined();
    });
  });
});
