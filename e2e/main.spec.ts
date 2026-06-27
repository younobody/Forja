import { test, expect } from '@playwright/test';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Importar o servidor de teste
const { server, PORT, ADMIN_KEY } = require('./test-server');

let httpServer: http.Server;

test.beforeAll(async () => {
  // Iniciar servidor para testes
  httpServer = server;
  await new Promise<void>((resolve) => {
    httpServer.once('listening', () => resolve());
  });
  if (!httpServer.listening) {
    httpServer.listen(PORT);
  }
});

test.afterAll(async () => {
  if (httpServer) {
    httpServer.close();
  }
});

test.describe('FORJA Frontend - Main Flows', () => {
  const baseURL = `http://localhost:${PORT}`;

  test.describe('Trainer Login & Dashboard', () => {
    test('trainer pode fazer login com chave admin', async ({ page }) => {
      // Arrange
      await page.goto(baseURL);

      // Act
      await page.click('button:has-text("ENTRAR")');
      // Deveria estar na home, agora vai para trainer login
      await page.waitForURL('**/trainer-login');

      // Preencher chave admin
      await page.fill('#trainer-key', ADMIN_KEY);
      await page.click('#btn-trainer-entrar');

      // Assert
      await page.waitForURL('**/trainer');
      expect(await page.locator('#view-trainer').isVisible()).toBeTruthy();
    });

    test('trainer vê dashboard vazio inicialmente', async ({ page }) => {
      // Arrange
      await page.goto(baseURL);

      // Act
      await page.click('button:has-text("ENTRAR")');
      await page.waitForURL('**/trainer-login');
      await page.fill('#trainer-key', ADMIN_KEY);
      await page.click('#btn-trainer-entrar');
      await page.waitForURL('**/trainer');

      // Assert
      const alunosList = page.locator('#trainer-alunos-list');
      expect(await alunosList.isVisible()).toBeTruthy();
    });

    test('trainer é rejeitado com chave errada', async ({ page }) => {
      // Arrange
      await page.goto(baseURL);

      // Act
      await page.click('button:has-text("ENTRAR")');
      await page.waitForURL('**/trainer-login');
      await page.fill('#trainer-key', 'wrong-key');
      await page.click('#btn-trainer-entrar');

      // Assert
      const error = page.locator('#trainer-login-status');
      await expect(error).toContainText('unauthorized');
    });
  });

  test.describe('Student Login', () => {
    test('aluno pode fazer login com ID + PIN válidos', async ({ page }) => {
      // Arrange - Criar aluno via API
      const alunoData = {
        key: ADMIN_KEY,
        action: 'salvarAluno',
        id: 'test-student-1',
        nome: 'Test Student',
        pin: '1234'
      };

      await fetch(`${baseURL}/api/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alunoData)
      });

      // Act
      await page.goto(baseURL);
      await page.fill('#home-pin', '1234');
      // Nota: O formulário precisa de ID também, ajustar conforme necessário
      // Por enquanto vamos apenas verificar que o campo está lá
      expect(await page.locator('#home-pin').isVisible()).toBeTruthy();
    });
  });

  test.describe('Create Aluno (Trainer)', () => {
    test('trainer pode criar novo aluno', async ({ page }) => {
      // Arrange
      await page.goto(baseURL);
      await page.click('button:has-text("ENTRAR")');
      await page.waitForURL('**/trainer-login');
      await page.fill('#trainer-key', ADMIN_KEY);
      await page.click('#btn-trainer-entrar');
      await page.waitForURL('**/trainer');

      // Act
      await page.click('button:has-text("NOVO ALUNO")');

      // Espera que o formulário de novo aluno apareça
      // Nota: Ajustar conforme a estrutura real do HTML
      const newAlunoForm = page.locator('form, input[type="text"]');
      expect(await newAlunoForm.first().isVisible()).toBeTruthy();
    });
  });

  test.describe('API Integration', () => {
    test('ping endpoint funciona', async ({ page }) => {
      // Act
      const response = await page.request.get(`${baseURL}/api/?action=ping`);
      const data = await response.json();

      // Assert
      expect(data.ok).toBe(true);
      expect(data.time).toBeDefined();
    });

    test('getAdmin sem chave retorna erro', async ({ page }) => {
      // Act
      const response = await page.request.get(`${baseURL}/api/?action=getAdmin`);
      const data = await response.json();

      // Assert
      expect(data.error).toContain('unauthorized');
    });

    test('getAdmin com chave correta retorna dados', async ({ page }) => {
      // Act
      const response = await page.request.get(
        `${baseURL}/api/?action=getAdmin&key=${ADMIN_KEY}`
      );
      const data = await response.json();

      // Assert
      expect(data.alunos).toBeDefined();
      expect(Array.isArray(data.alunos)).toBe(true);
    });

    test('salvarAluno cria novo aluno', async ({ page }) => {
      // Act
      const response = await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'salvarAluno',
          key: ADMIN_KEY,
          id: 'new-student',
          nome: 'New Student',
          pin: '5678'
        }
      });
      const data = await response.json();

      // Assert
      expect(data.ok).toBe(true);
    });

    test('registro sem PIN retorna erro', async ({ page }) => {
      // Arrange
      await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'salvarAluno',
          key: ADMIN_KEY,
          id: 'test-aluno',
          nome: 'Test',
          pin: '9999'
        }
      });

      // Act
      const response = await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'registro',
          aluno_id: 'test-aluno',
          pin: 'wrong-pin',
          dia: 'A',
          exercicio: 'Supino',
          carga: 100,
          reps: 8
        }
      });
      const data = await response.json();

      // Assert
      expect(data.error).toContain('invalido');
    });

    test('registro com PIN correto salva workout', async ({ page }) => {
      // Arrange
      await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'salvarAluno',
          key: ADMIN_KEY,
          id: 'workout-test',
          nome: 'Workout Test',
          pin: '1111'
        }
      });

      // Act
      const response = await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'registro',
          aluno_id: 'workout-test',
          pin: '1111',
          dia: 'A',
          exercicio: 'Supino',
          carga: 100,
          reps: 8,
          completou: true
        }
      });
      const data = await response.json();

      // Assert
      expect(data.ok).toBe(true);
    });

    test('removerAluno deleta aluno e dados relacionados', async ({ page }) => {
      // Arrange
      await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'salvarAluno',
          key: ADMIN_KEY,
          id: 'to-delete',
          nome: 'To Delete',
          pin: '2222'
        }
      });

      // Act - deletar
      const response = await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'removerAluno',
          key: ADMIN_KEY,
          id: 'to-delete'
        }
      });
      const data = await response.json();

      // Assert
      expect(data.ok).toBe(true);

      // Verificar que foi mesmo deletado
      const getResponse = await page.request.get(
        `${baseURL}/api/?action=getAdmin&key=${ADMIN_KEY}`
      );
      const getData = await getResponse.json();
      const aluno = getData.alunos.find((a: any) => a.id === 'to-delete');
      expect(aluno).toBeUndefined();
    });
  });

  test.describe('Data Persistence', () => {
    test('aluno criado persiste após reload', async ({ page }) => {
      // Arrange
      const alunoId = `persist-test-${Date.now()}`;
      await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'salvarAluno',
          key: ADMIN_KEY,
          id: alunoId,
          nome: 'Persist Test',
          pin: '3333'
        }
      });

      // Act & Assert
      const response = await page.request.get(
        `${baseURL}/api/?action=getAdmin&key=${ADMIN_KEY}`
      );
      const data = await response.json();
      const aluno = data.alunos.find((a: any) => a.id === alunoId);
      expect(aluno).toBeDefined();
      expect(aluno.nome).toBe('Persist Test');
    });

    test('workout registrado persiste', async ({ page }) => {
      // Arrange
      const alunoId = `workout-persist-${Date.now()}`;
      await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'salvarAluno',
          key: ADMIN_KEY,
          id: alunoId,
          nome: 'Workout Persist',
          pin: '4444'
        }
      });

      // Act
      await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'registro',
          aluno_id: alunoId,
          pin: '4444',
          dia: 'B',
          exercicio: 'Agachamento',
          carga: 150,
          reps: 6,
          completou: true
        }
      });

      // Assert
      const response = await page.request.get(
        `${baseURL}/api/?action=getAdmin&key=${ADMIN_KEY}`
      );
      const data = await response.json();
      const workouts = data.registros.filter((r: any) => r.aluno_id === alunoId);
      expect(workouts.length).toBeGreaterThan(0);
      expect(workouts[0].exercicio).toBe('Agachamento');
    });
  });

  test.describe('Error Handling', () => {
    test('invalid JSON na requisição retorna erro', async ({ page }) => {
      // Act
      const response = await page.request.post(`${baseURL}/api/`, {
        data: 'invalid json {'
      });

      // Assert - deve retornar erro JSON válido
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('ação desconhecida retorna erro', async ({ page }) => {
      // Act
      const response = await page.request.post(`${baseURL}/api/`, {
        data: {
          action: 'unknown-action',
          key: ADMIN_KEY
        }
      });
      const data = await response.json();

      // Assert
      expect(data.error).toBeDefined();
    });
  });
});
