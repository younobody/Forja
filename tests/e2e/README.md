# Testes de navegador (e2e) do FORJA

Baterias em Playwright (Chromium) contra o `forja.html` **com um backend simulado**: `mock.js` intercepta as chamadas
`/rest/v1/rpc/api_get` e `api_post` e devolve dados 100% fictícios (aluno "Aluno Demo", PIN `1234`; trainer com a chave
`admin`). **Nenhuma bateria toca o Supabase de verdade nem usa dado real.**

## Como rodar

```bash
cd tests/e2e
npm install                       # playwright 1.63.0 + axe-core 4.10.2 (versões fixadas)
npx playwright install chromium
npm test                          # sobe um servidor estático local e roda tudo (~3,5 min)
```

```bash
npm test -- abas xss              # só as baterias cujo nome de arquivo contém "abas" ou "xss"
npm test -- -v                    # saída completa de todas (padrão: só das que falham)
node serve.js                     # só o servidor, em http://127.0.0.1:8765/forja.html (PORT=... troca a porta)
```

Contra um endereço já publicado (não sobe servidor; a versão esperada vem do `forja.html` local, ou de `FORJA_VER`):

```bash
URL_APP=https://forja.imovelmedia.workers.dev/forja.html FORJA_VER=v30.31.1 npm test -- verify_abas
```

Cada bateria sai com **0 = passou, 1 = falhou, 2 = quebrou**. Todas leem a versão atual de `FORJA_VERSION` no `forja.html`
(`common.js`), então **nada precisa ser editado a cada versão nova**.

## O que cada bateria cobre

| Arquivo | Cobre |
|---|---|
| `verify.js` | aviso "FORJA Atualizado" (só em atualização, não na 1ª abertura), login por PIN, rotação, instalação do Service Worker (cache `forja-<versão>-shell`) |
| `verify_abas.js` (65 checagens) | painel do aluno em 4 abas (TREINO · EVOLUÇÃO · CORPO · MAIS), botão voltar, TREINAR, modais, plano em colunas, histórico com 12 sessões + CARREGAR MAIS (inclui: 1 toque na lixeira = 1 confirmação e 1 remoção), desktop |
| `dia_prox.js` (23) | o dia que abre selecionado é o PRÓXIMO da rotação (`frcRotacao`), pílula "PRÓXIMO: X", escolha manual preservada até o dado mudar |
| `trainer_editor.js` (58) | editor do plano do trainer: cartões no celular, tabela no desktop, **ALVO (`meta`) preservado ao salvar**, axe |
| `axe_abas.js` | axe-core nas 4 abas, 360 px e 1280 px (falha com qualquer violação) |
| `audit5.js` | axe-core no TREINAR, nos modais do aluno e do trainer e na edição do aluno |
| `xss_proof.js` | XSS armazenado no painel do trainer: 4 pontos onde texto do banco virava HTML; checa se o payload executou e se leu a chave do trainer |
| `xss3.js`, `xss4.js` | varredura de "sinks": instrumentam `innerHTML`/`outerHTML`/`insertAdjacentHTML` e falham se HTML com payload **sem escape** chegar ao DOM (trainer, aluno, feed público) |

As baterias **têm dente**: contra a v30.28.0 (antes da correção de XSS) `xss_proof.js` e `xss3.js` saem com 1; e o check novo do
histórico falha na v30.31.0, que tinha o bug de listeners duplicados (2 confirmações e 2 remoções por toque).

## Como o `mock.js` funciona

- `installMock(page, opts)` registra `page.route` para `api_get`/`api_post` (e para `/auth/v1/settings`, com Google desligado).
  `api_post` sempre responde `{ ok: true }`: o que o front **envia** é o que se testa (conte as requisições com `page.on('request')`).
- `opts.mutateAluno(out)` e `opts.mutateAdmin(out)` alteram o payload antes de responder (é assim que os testes de XSS injetam payload
  em `dia`, `modalidade`, `obs`, nome do aluno etc., e que os testes de rotação forjam o histórico).
- O plano fictício tem os dias A–D (com `meta`/ALVO preenchidos) e ~28 sessões em ordem de rotação A → D → B → C.

## Armadilhas (já custaram tempo)

- Abra o contexto com `serviceWorkers: 'block'`; senão o Service Worker intercepta as chamadas simuladas e devolve 503. Só `verify.js`
  usa `serviceWorkers: 'allow'`, de propósito, para testar a instalação.
- Semeie `localStorage['forja-last-version']` com a versão **atual** (`addInitScript`), ou o aviso "FORJA Atualizado" cobre a tela e
  engole os cliques.
- `confirm()` precisa de `page.on('dialog', d => d.accept())`.
- `getComputedStyle(el, '::before').content` devolve `counter()` sem resolver; confira o rótulo pelo DOM.
- Um teste que clica em tudo (`xss4.js`) pode clicar em nós já removidos e gerar `pageerror` ("The element has no parent"): é artefato
  do teste, não bug do app.

## Fora daqui (de propósito)

Não há CI configurado, nem teste em aparelho real, nem em leitor de tela (TalkBack/VoiceOver). As capturas de tela usadas na revisão
visual eram scripts avulsos do scratchpad e não foram trazidas para o repositório.
