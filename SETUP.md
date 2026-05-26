# FORJA — Setup Completo

Você tem 4 arquivos:

| Arquivo | Onde vai |
|---|---|
| `forja.html` | A página em si. Pode ser hospedada em qualquer lugar (GitHub Pages, Netlify, Vercel, ou aberta direto do disco) |
| `forja_apps_script.gs` | Código do Google Apps Script, cola dentro do seu Google Sheets |
| `bootstrap_marcos.json` | Plano A/B/C completo do Marcos pronto pra importar (opcional, útil pra testar e ter um exemplo de formato) |
| `SETUP.md` | Este arquivo |

---

## Passo a passo (uma única vez, ~10 minutos)

### 1. Criar a Google Sheet

1. Vá em [sheets.new](https://sheets.new) e crie uma planilha nova.
2. Renomeie para algo claro: **FORJA — Banco**.

### 2. Colar o Apps Script

1. Na planilha, menu **Extensões → Apps Script**.
2. Apague todo o conteúdo do editor (vai vir um `function myFunction()` padrão).
3. Cole o conteúdo inteiro do arquivo `forja_apps_script.gs`.
4. **Importante:** na primeira linha útil do código, troque:
   ```javascript
   const ADMIN_KEY = 'TROCAR-POR-CHAVE-FORTE-AQUI';
   ```
   Por uma chave forte de sua escolha. Essa é a senha do trainer. Exemplo:
   ```javascript
   const ADMIN_KEY = 'forja-coach-7K9p2X';
   ```
   Guarde essa chave — é o que seu irmão vai usar pra entrar como trainer.
5. Salve (Ctrl+S / ⌘+S). Dê um nome ao projeto: **FORJA backend**.

### 3. Inicializar as abas

1. No editor de Apps Script, com o arquivo aberto, no topo selecione a função **`setup`** no dropdown ao lado do botão "Executar".
2. Clique em **Executar**.
3. Vai pedir permissão (primeira vez) → "Revisar permissões" → escolha sua conta Google → "Avançado" → "Acessar (não seguro)" → "Permitir".
   - Isso é normal. O script é seu, rodando na sua conta, só editando sua própria planilha.
4. Volte na planilha — agora tem 3 abas: `alunos`, `plano`, `registro`.

### 4. Publicar como Web App

1. No editor de Apps Script, canto superior direito: **Implantar → Nova implantação**.
2. Engrenagem ao lado de "Selecionar tipo" → **App da Web**.
3. Preencha:
   - Descrição: `FORJA backend v1`
   - Executar como: **Eu mesmo** (seu email)
   - Quem pode acessar: **Qualquer pessoa**
4. Clique **Implantar**. Pode pedir permissões de novo, autorize.
5. Copie a **URL do app da Web** que aparece. Vai ser algo como:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

### 5. Configurar a página HTML

Você tem duas opções:

**Opção A — abrir direto do disco (mais simples para testar):**
1. Dê duplo-clique no `forja.html`. Abre no navegador.
2. Vai aparecer a tela de **Configuração Inicial**. Cole a URL do passo 4.
3. Clique em **TESTAR** — deve aparecer `✓ Conexao ok`.
4. Clique em **SALVAR E CONTINUAR**. A URL fica salva no localStorage do seu navegador.

**Opção B — hospedar online (recomendado para os alunos):**
1. Suba o `forja.html` em qualquer um destes (todos grátis):
   - **GitHub Pages**: cria um repositório, sobe o arquivo, ativa Pages nas configurações.
   - **Netlify Drop**: [app.netlify.com/drop](https://app.netlify.com/drop) — arrasta o arquivo, recebe URL.
   - **Vercel**: similar.
2. Acesse a URL pública e faça a configuração inicial igual à opção A.

> Cada navegador onde a página for aberta vai precisar configurar a URL do Apps Script uma vez. Para automatizar pros alunos, veja a seção "Dica avançada" no final.

### 6. Primeiro uso

1. Na home da página, clique em **TRAINER**.
2. Cole a chave admin que você definiu no passo 2.
3. Clique em **+ NOVO ALUNO** e cadastre seu primeiro aluno (id, nome, PIN, objetivo).
4. Após salvar, o aluno aparece na lista. Clique nele pra editar o plano (A/B/C).
5. Use **+ EXERCICIO** dentro de cada dia pra adicionar.
6. **SALVAR PLANO** quando terminar.
7. Botão **COMPARTILHAR** no canto superior gera o link + mensagem pra mandar no WhatsApp ou email do aluno.

### 7. Como o aluno usa

1. Aluno abre o link que você mandou (algo como `https://seu-site.com/forja.html#aluno/marcos`).
2. Se for o primeiro acesso, ele vai pra tela de login com o `id` dele já preenchido. Coloca o PIN.
3. Vê o plano nos tabs A/B/C.
4. Clica em **REGISTRAR SESSÃO** → preenche carga, reps, RIR final, se fechou ou não → **SALVAR**.
5. Você (trainer) vê esses registros voltando na sua tela de edição do aluno, na seção "REGISTROS DO ALUNO".

---

## Fluxo do dia a dia

```
TRAINER (uma vez por semana)        ALUNO (a cada treino)
       │                                    │
       ├─ abre página                       ├─ abre link salvo no celular
       ├─ ajusta cargas do plano            ├─ vê o plano do dia
       ├─ SALVAR PLANO                      ├─ executa
       │     ↓                              ├─ REGISTRAR SESSÃO
       │  Google Sheets                     │     ↓
       │     ↓                              │  Google Sheets
       │     ←──────────────────────────────┤     ↓
       └─ revisa registros                  └─ próximo treino vê plano atualizado
```

A sincronização não é instantânea (não é WebSocket), mas qualquer **SYNC** ou recarregamento da página puxa o estado atual do Sheets. Para fins práticos é tempo real.

---

## Importar dados do Marcos (caso queira começar com ele)

O dashboard atual do Marcos (no projeto FERRO) já tem o plano A/B/C estruturado. Para migrar:

1. Crie o aluno `marcos` com PIN.
2. Entre na edição dele.
3. No tab A, B, C, vá adicionando os exercícios do dashboard do FERRO (`forja_dashboard.jsx`). Cargas atuais, séries, reps e RIR do `Status atual` (ver doc do Marcos).
4. Cole no campo OBS as notas críticas (ROM 90° no desenvolvimento halter, "pegada aberta pronada" na puxada, etc.).
5. Salve plano.

Se quiser, eu posso gerar um JSON-bootstrap com o plano do Marcos já preenchido, e adapto o backend pra aceitar import em lote.

---

## Limitações conhecidas

| Limitação | Como contornar |
|---|---|
| Sem autenticação OAuth — só PIN | OK pra contexto trainer/aluno conhecido. Não use pra dados sensíveis de saúde. |
| Tempo real "por refresh" — não notifica push | Botão SYNC nas duas pontas. Suficiente pra ~10 alunos. |
| Cota gratuita Apps Script | 90 minutos de execução/dia, mais que suficiente. Cada requisição executa em ~0.5s. |
| Sem upload de fotos/vídeos | Por enquanto, só texto. Pode ser adicionado depois com Google Drive. |
| Sem app nativo | Funciona como PWA no celular se for hospedado em HTTPS. Pode-se adicionar manifest.json depois pra "instalar" como app. |

---

## Dica avançada — pré-configurar a URL pros alunos

Se você quiser que os alunos não precisem ver a tela de "Configuração Inicial", abra o `forja.html` num editor e troque, na função `init()` no final do arquivo:

```javascript
APP.appsScriptUrl = localStorage.getItem('forja-apps-url');
```

por:

```javascript
APP.appsScriptUrl = localStorage.getItem('forja-apps-url') || 'COLE_AQUI_SUA_URL_DO_APPS_SCRIPT';
```

Aí qualquer pessoa que abrir a página já tem a URL configurada por padrão.

---

## Importar aluno via JSON (atalho)

Se você já tem o plano de um aluno estruturado em JSON (caso do `bootstrap_marcos.json` que vem junto), dá pra criar o aluno + plano A/B/C completo numa única operação.

### Quando usar
- Migrar um aluno que já tem plano descrito em outro lugar.
- Testar o sistema com dados reais (o Marcos já vem pronto).
- Reaproveitar plano de um aluno para outro (copia o JSON, troca o `id` e o `nome`).

### Como fazer

1. Entre como **TRAINER**.
2. No canto superior, clique em **IMPORTAR JSON**.
3. Preencha:
   - **PIN do aluno**: você define agora (4-6 dígitos). Anota — é o que o aluno vai usar pra entrar.
   - **JSON**: cola o conteúdo de um arquivo no formato:
     ```json
     {
       "aluno": {
         "id": "marcos",
         "nome": "Marcos R. Abati",
         "objetivo": "...",
         "notas": "..."
       },
       "plano": [
         { "dia": "A", "exercicio": "Supino inclinado barra", "series": "3", "reps": "10", "carga": "34kg", "rir": "2", "obs": "..." },
         { "dia": "B", "exercicio": "...", ... },
         { "dia": "C", "exercicio": "...", ... }
       ]
     }
     ```
4. Clica em **VALIDAR** primeiro — confirma se o JSON tá no formato certo e mostra quantos exercícios tem em cada dia.
5. Clica em **IMPORTAR** — cria o aluno e sobrescreve o plano dele se já existir.

### Importar o Marcos (exemplo pronto)

Abra `bootstrap_marcos.json`, copia o conteúdo inteiro, segue o fluxo acima. O plano dele tem:
- 5 exercícios em A (Push)
- 5 exercícios em B (Pull)
- 4 exercícios em C (Legs)

Todas as notas críticas (ROM 90° no desenvolvimento halter, pegada aberta pronada na puxada, restrição do cotovelo no agachamento) vêm embutidas no campo `obs` de cada exercício.

### Atenção

- **Sobrescreve plano existente.** Se o `id` do aluno já existir, o plano A/B/C dele é apagado e reescrito com o que tá no JSON. Os **registros executados** não são apagados (continuam no histórico).
- O PIN definido no modal sobrescreve qualquer PIN que vier no JSON.

---

## Atualizar a página depois

Se eu te entregar uma versão nova do `forja.html`, é só:

1. Substituir o arquivo no servidor (ou abrir o novo localmente).
2. **Não mexe no Apps Script** (a menos que eu peça).
3. **Não mexe na planilha** — os dados continuam intactos.

Se eu te entregar versão nova do `forja_apps_script.gs`:

1. Copia o conteúdo novo, cola por cima do antigo no Apps Script (mantendo a sua `ADMIN_KEY`).
2. **Implantar → Gerenciar implantações → editar (lápis) → versão "Nova versão"** → Implantar.
3. A URL **não muda**.

---

## Quando der ruim

| Sintoma | Diagnóstico |
|---|---|
| `unauthorized` no login trainer | Chave digitada errada, ou ADMIN_KEY no script ainda é a padrão |
| `aluno/pin invalido` | ID ou PIN errado, ou aluno não existe na aba `alunos` |
| Tela em branco / erro fetch | URL do Apps Script errada, ou implantação ainda não publicada |
| Salva mas nada aparece | Abre o Sheets manualmente e confere se as abas existem (`alunos`, `plano`, `registro`). Rode `setup` no Apps Script de novo. |
| Mudei o código mas não atualiza | Esqueceu de fazer **Nova versão** ao reimplantar. URL não muda mas o código sim. |
