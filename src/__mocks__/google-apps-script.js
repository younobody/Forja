/**
 * Mock para Google Apps Script APIs
 * Simula o comportamento real para testes unitários
 */

class MockRange {
  constructor(values = [], sheet = null, row = 0, col = 0) {
    this.values = values;
    this.sheet = sheet;
    this.row = row;
    this.col = col;
  }

  setValue(value) {
    if (this.sheet) {
      // Atualizar no sheet
      if (this.row > 0 && this.col > 0) {
        this.sheet.data[this.row - 1][this.col - 1] = value;
      } else {
        this.values[0] = value;
      }
    } else {
      this.values[0] = value;
    }
  }

  setValues(values) {
    if (this.sheet && this.row > 0 && this.col > 0) {
      // Atualizar no sheet
      for (let i = 0; i < values.length; i++) {
        if (!this.sheet.data[this.row - 1 + i]) {
          this.sheet.data[this.row - 1 + i] = new Array(this.sheet.data[0].length).fill('');
        }
        for (let j = 0; j < values[i].length; j++) {
          this.sheet.data[this.row - 1 + i][this.col - 1 + j] = values[i][j];
        }
      }
    } else {
      this.values = values;
    }
  }

  getValues() {
    if (this.sheet && this.row > 0 && this.col > 0) {
      return [[this.sheet.data[this.row - 1][this.col - 1]]];
    }
    return this.values;
  }
}

class MockSheet {
  constructor(name = 'Sheet1') {
    this.name = name;
    this.data = [];
    this.initializeHeaders(name);
  }

  initializeHeaders(name) {
    if (name === 'alunos') {
      this.data = [['id', 'nome', 'pin', 'objetivo', 'notas', 'criado_em']];
    } else if (name === 'plano') {
      this.data = [['aluno_id', 'dia', 'ordem', 'exercicio', 'series', 'reps', 'carga', 'rir', 'obs']];
    } else if (name === 'registro') {
      this.data = [['timestamp', 'aluno_id', 'dia', 'exercicio', 'carga', 'reps', 'rir', 'completou', 'obs']];
    }
  }

  getDataRange() {
    return new MockRange(this.data);
  }

  appendRow(row) {
    this.data.push(row);
  }

  clear() {
    // Mantém apenas o header
    this.data = [this.data[0]];
  }

  getRange(row, col, numRows, numCols) {
    const result = new MockRange([], this, row, col);
    result.rowIndex = row - 1;
    result.colIndex = col - 1;
    result.numRows = numRows;
    result.numCols = numCols;
    return result;
  }

  getName() {
    return this.name;
  }

  getSheetByName(name) {
    return this.name === name ? this : null;
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets[name] = sheet;
    return sheet;
  }

  getSheets() {
    return Object.values(this.sheets);
  }
}

let currentSpreadsheet = new MockSpreadsheet();

global.SpreadsheetApp = {
  getActiveSpreadsheet: () => currentSpreadsheet,
  resetForTesting: () => {
    currentSpreadsheet = new MockSpreadsheet();
  },
};

global.ContentService = {
  MimeType: {
    JSON: 'application/json',
  },
  createTextOutput: (text) => ({
    setMimeType: function(mimeType) {
      this.mimeType = mimeType;
      return this;
    },
    getText: () => text,
    getContent: () => text,
  }),
};

global.Logger = {
  log: jest.fn(),
};
