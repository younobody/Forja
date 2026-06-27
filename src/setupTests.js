/**
 * Setup para testes - executado antes de cada teste
 */

require('./__mocks__/google-apps-script');

beforeEach(() => {
  global.SpreadsheetApp.resetForTesting();
});
