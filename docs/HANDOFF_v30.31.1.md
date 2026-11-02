# HANDOFF — FORJA v30.31.1 (02/11/2026)

Escrito para quem pegar o projeto sem ter visto a conversa que o produziu (ela foi apagada). Tudo aqui foi conferido no repositório ou no
banco nesta data; o que é inferência está marcado como **(inferido)** ou **(não verificado)**.

## 1. O que é

FORJA: PWA de treino de academia em português. **Um arquivo só**, `forja.html` (~735 KB, CSS e JS inline), mais `sw.js` (Service Worker),
`manual.html`, `privacidade.html`, `manifest.json`, `img/`. Backend: Supabase (projeto `aupfamquyihqagzwmpkb`, RPCs `api_get`/`api_post`/`api_google`).
Hospedagem: Cloudflare Worker `forja` (só arquivos estáticos; `wrangler.jsonc` + `.assetsignore`), endereço **https://forja.imovelmedia.workers.dev/forja.html**
(a raiz dá 404, não há index). Repositório: `younobody/Forja`. Quem usa: o trainer (dono do projeto) e os alunos.

## 2. Estado no momento da escrita

- **Produção estava na v30.28.0**, com o XSS armazenado ainda aberto no front. Estas mudanças só chegam à produção com o merge em `main`
  (Workers Builds publica a cada push em `main` — **inferido** do histórico: commit "Dispara o primeiro build do Workers Builds").
- **Banco já alterado ao vivo** (não depende do deploy): migration `20261102143559 forja_valida_dia_modalidade` (seção 5).
- Branch de trabalho: `claude/gifted-hawking-hpty3g`.
- Para saber se já foi publicado: abra `https://forja.imovelmedia.workers.dev/forja.html`, procure `const FORJA_VERSION` (deve ser `v30.31.1`) e `…/sw.js`
  (`CACHE_VERSION = 'forja-v30.31.1'`). Se estiver em `v30.28.0`, o merge ou o build ainda não aconteceu.

## 3. O que mudou da v30.28.0 até a v30.31.1

| Versão | Mudança |
|---|---|
| **v30.29.0** | **Segurança:** 4 pontos do painel do trainer montavam HTML com texto livre vindo do banco sem `escapeHtml` (`ÚLT: ${last.dia}` no dashboard, id do aluno dentro do `onclick`, rótulo do cardio e dia da sessão na EVOLUÇÃO) — XSS armazenado que permitia ler a chave do trainer (`sessionStorage`; prova de conceito local, dados fictícios). **Acessibilidade:** rótulos e nomes acessíveis em TREINAR, modais e edição; contraste do botão SIM (5,38:1). "FORJA Atualizado" só aparece quando havia versão anterior (não na 1ª abertura) |
| **v30.30.0** | **Painel do aluno em 4 abas fixas no pé da tela** — TREINO · EVOLUÇÃO · CORPO · MAIS (antes: uma rolagem de ~3000 px; o plano só começava em y≈1448). O voltar do Android leva de qualquer aba ao TREINO. Plano do dia em linhas compactas (SÉRIES/REPS/CARGA/RIR alinhados em 12 colunas proporcionais). EVOLUÇÃO abre com 12 sessões + CARREGAR MAIS. Medido em 360 px: linha do exercício ~115 → ~92 px, lista do dia 926 → 736 px (a mensagem do commit diz "~125 → ~90"; vale o medido). axe sem violações |
| **v30.31.0** | (1) **Dia sugerido:** o TREINO abre no PRÓXIMO da rotação (`frcRotacao`, "o dia mais atrasado vence", a mesma regra do CONSOLE), com pílula "PRÓXIMO: X" e ponto no segmento. (2) **Editor do plano do trainer no celular:** 1 cartão por exercício abaixo de 768 px, cabeçalho que não estoura a página (486 → 360 px). (3) **Bug de dados:** `loadEditAluno` nunca carregava `meta` (ALVO) e o SALVAR PLANO zerava o ALVO de **todos** os exercícios do aluno (`f_salvar_plano` apaga as linhas e reinsere com `coalesce(meta,'')`) |
| **v30.31.1** | **Bug:** o CARREGAR MAIS religava os botões dos cards já renderizados (`_attachEvoHistoricoListeners` rodava de novo sobre o mesmo container): 1 toque na lixeira abria 2 `confirm()` e mandava 2 remoções. Antes da v30.30.0 era raro (50 sessões iniciais); com 12 ficou comum. Corrigido com marca `_evoLigado` |

## 4. Decisões e por quê

- **Abas em vez de rolagem:** o problema era distância até as ações, não falta de funções. Nenhum render mudou de lugar: só visibilidade por painel (`data-pane`).
- **Dia sugerido = rotação, não mapa de recuperação.** A faixa "PRONTO PRA TREINAR" (mapa muscular, `mapaSugerirDia`) **pode sugerir outro dia**. Hoje as duas coexistem. É
  decisão de produto em aberto: se incomodar, unificar numa só regra.
- **Defesa em profundidade no XSS:** além de escapar no front, o banco recusa `dia` fora de A–E e `modalidade` fora de pedal/esteira/remo/corrida/outro. Por quê: `google_signup='sim'`
  deixa qualquer conta Google criar aluno e escrever direto na RPC; e quem tem o front antigo em cache segue vulnerável até atualizar.
- **`escapeHtml` não protege dentro de `onclick="…"`** (o navegador decodifica entidades antes de executar o JS). Padrão adotado: `data-*` + `this.dataset`.

## 5. Banco de dados (Supabase `aupfamquyihqagzwmpkb`)

**Backup e prova de restauração:** ver `supabase/migrations/README.md`. Resumo: os 12 arquivos aplicáveis da pasta (todos menos a proposta `20260902_forja_backup_payload.sql`) reproduzem, num Postgres 16 limpo, um schema `public` com as 7 impressões
digitais idênticas às do banco vivo (`bash supabase/replay/replay.sh`), e o texto de cada migration tem o mesmo hash do SQL aplicado (`supabase/comparar_com_banco.py`).
Isso corrigiu o backup antigo, que **não restaurava**: o SNAPSHOT do schema não tinha os DEFAULTs, o de funções quebrava na ordem e deixava `api_get`/`api_post` executáveis por PUBLIC, e faltavam
as 4 migrations do login Google/limites/validação.

**Migration aplicada nesta rodada:** `forja_valida_dia_modalidade` (`f_valores_item` + 2 linhas em `f_checar_limites_aluno`; nada de tabela ou dado). **Rollback** (bloco comentado no fim do
arquivo): recriar `f_checar_limites_aluno` sem as duas linhas e `drop function public.f_valores_item(jsonb)`.

**Achados da leitura (somente leitura, 02/11/2026):**

- `plano.meta` está **vazio nas 93 linhas**. É coerente com o bug da v30.31.0 já ter rodado, mas o banco não diz se algum dia houve valor, e não há backup de dados no repositório.
  **Decisão do dono do projeto:** reinserir os ALVOs à mão, ou restaurar da planilha antiga (congelada desde 18/07/2026; a skill de treino do dono do projeto manda não lê-la, então não toquei).
- Nenhum registro suspeito de XSS: nos 1103 registros, `dia` está em A–E ou vazio, e `modalidade` vazia ou da lista. Por isso a whitelist não rejeita nada que exista.
- **Cadastro pelo Google está aberto** (`google_signup='sim'`) e há 1 identidade Google no banco. Tetos: 50 contas Google, 20 cadastros/24 h, 80 registros/24 h por conta Google (300 nas demais).
  Para fechar: `update config set value='nao' where key='google_signup';`.
- Advisors de segurança: só o esperado — "RLS sem policy" (deny-all é o desenho), `api_get`/`api_post` executáveis por anon e `api_google` por authenticated (são as portas de entrada), e
  "Leaked password protection" desligado no Auth (**não verificado** se login por senha está habilitado; se não está em uso, é irrelevante).
- Existem 3 colunas sem migration (`peso.fc_repouso`, `perimetros.envergadura`, `perimetros.obs`), com dado e fora do app. Origem **não confirmada** (suspeita: a skill de treino do dono do projeto, via MCP).
- O `getAdmin` (EXPORTAR) **não traz peso nem perímetros**; a proposta `20260902_forja_backup_payload.sql` que resolveria isso nunca foi aplicada.

## 6. Como rodar os testes

`tests/e2e/README.md`. Em resumo: `cd tests/e2e && npm install && npx playwright install chromium && npm test` (~3,5 min, 9 baterias, backend simulado, nenhum dado real).
Cobertura: abas (65 checagens), dia sugerido (23), editor do trainer (58), aviso de versão/Service Worker, axe nas abas e nos modais, 3 varreduras de XSS. Têm dente: contra a v30.28.0 as de XSS falham, e o
check novo do histórico falha na v30.31.0. **Não há CI**; rodar à mão antes de cada release.

## 7. Como publicar uma versão

1. Editar `forja.html`. Subir `const FORJA_VERSION` (linha ~6065).
2. Subir `CACHE_VERSION` em `sw.js` (`'forja-' + versão`) e acrescentar a nota no comentário do topo. O SW trava se as duas versões divergirem; dentro do comentário **não pode haver `*/`**.
3. `manual.html` só muda se mudar texto de navegação (está na lista de cache do SW).
4. `npm test` em `tests/e2e`. 5. Commit `vX.Y.Z: …` (português, sem acento) e push em `main`. 6. Conferir o endereço da seção 2.

## 8. Armadilhas (já custaram tempo)

- O CSS é **Tailwind pré-compilado**: classe nova não existe. Todo CSS novo é escrito à mão no bloco `<style>`.
- Editar `forja.html` com a ferramenta de edição comeu um espaço (`id="x"type=`). Use script Python com `count == 1` antes de trocar.
- Com Service Worker ativo, o teste que mocka rede recebe 503: abrir contexto com `serviceWorkers: 'block'`. Semear `forja-last-version` com a versão atual, senão o modal de atualização cobre a tela.
- `getComputedStyle(el,'::before').content` devolve `counter()` sem resolver.
- Não use `pkill -f "http.server 8765"` dentro do comando que também contém essa string: mata o próprio shell.

## 9. Pendências e riscos (do mais frágil ao irrelevante)

| Item | Classe | Nota |
|---|---|---|
| Publicação depende do Workers Builds, **inferido** e não verificado | **gerenciável** (era o ponto mais frágil) | até o merge, a produção segue na v30.28.0; o banco já protege `dia`/`modalidade` |
| ALVOs zerados no banco (seção 5) | **gerenciável**, mas é perda de dado real | exige decisão do dono do projeto |
| Cadastro Google aberto | **gerenciável** | tetos e whitelist mitigam; decidir se mantém |
| Sem CSP; 59 `onclick` inline; chave admin em `sessionStorage` | gerenciável | próximo passo de segurança: delegação de eventos + CSP. Sem isso, qualquer XSS futuro lê a chave |
| Login por senha no Auth possivelmente habilitado (**não verificado**) | gerenciável | conferir no painel; desligar se não usa |
| Sem teste em aparelho real nem leitor de tela (TalkBack/VoiceOver); sem CI | gerenciável | só Chromium emulado + axe |
| Sugestão de dia: rotação × mapa de recuperação podem divergir | gerenciável | decisão de produto |
| Ilustrações do `manual.html` ainda no desenho claro antigo; kicker/rodapé dizem v30.7.0 | irrelevante | textos de navegação já atualizados; propositalmente não mexi no resto |
| Colunas fora de migration; `getAdmin` sem peso/perímetros | irrelevante hoje | documentado; ver seção 5 |
