# Backup das migrations do Supabase (projeto FORJA, `aupfamquyihqagzwmpkb`)

Cópia local do SQL que está no Supabase. Motivo de existir esta pasta: se o projeto sumir ou algo quebrar, dá pra
reconstruir o banco do zero a partir daqui, sem depender só da nuvem. **É só ESTRUTURA (tabelas, funções, privilégios), não dados.**

## Estado conferido em 02/11/2026

Duas verificações independentes, as duas passam:

1. **Texto das migrations.** O banco guarda o SQL aplicado de cada migration em `supabase_migrations.schema_migrations.statements`
   (o `list_migrations` do MCP só devolve versão e nome). Cada arquivo abaixo tem o mesmo hash — do texto sem comentários e sem espaços —
   que o SQL aplicado. Conferir de novo: `python3 supabase/comparar_com_banco.py resultado.json` (a consulta está no cabeçalho do script).
2. **Replay do zero.** Rodar os arquivos, em ordem, num PostgreSQL 16 limpo (com o mínimo do Supabase simulado) produz um schema `public`
   cujas 7 impressões digitais (colunas, constraints, índices, corpo/atributos/privilégios das 34 funções, RLS e acesso das tabelas)
   são **idênticas** às do banco vivo. Refazer: `bash supabase/replay/replay.sh` (precisa de PostgreSQL local; apaga tudo ao terminar).
   Limites desta prova: Postgres 16 local contra 17 na produção; stubs mínimos de `auth`; dados e `config` não entram; o painel Auth não entra.

## Arquivos (ordem de aplicação = ordem do nome)

| Arquivo | Origem | Situação |
|---|---|---|
| `20260719015843_forja_schema.sql` | migration `20260719015843` | **exato**. Substituiu o antigo `…_forja_schema.SNAPSHOT.sql` (reconstrução que não tinha os DEFAULTs, criava as extensões fora do schema `extensions` e omitia o `alter default privileges`; continua no histórico do git) |
| `20260719020028_forja_api_functions.SNAPSHOT.sql` | migration `20260719020028` | **reconstrução** por introspecção (21/07/2026), não o texto aplicado. Corrigida em 02/11/2026 após o replay: ganhou `set check_function_bodies = off` (senão `f_exercicios_json` falha, pois lê colunas criadas na migration seguinte) e o `revoke` de `api_get`/`api_post` de PUBLIC; os grants eram `anon, authenticated` e agora são só `anon`, como no banco |
| `20260719200105_forja_exercicios_ricos_schema.sql` | `20260719200105` | exato |
| `20260719200948_forja_exercicios_ricos_payload.sql` | `20260719200948` | exato |
| `20260720032404_forja_feed_exclui_cardio.sql` | `20260720032404` | exato |
| `20260902_forja_backup_payload.sql` | — | **PROPOSTA NÃO APLICADA** (`getBackup`); não existe no banco e o replay a ignora |
| `20260907000000_forja_delete_por_pk.sql` | aplicada como `20260907205603` | exato (comentários explicativos movidos do corpo das funções para antes delas, para o replay ficar idêntico) |
| `20261001005952_forja_fecha_pin_vazio_e_remove_listarids.sql` | `20261001005952` | exato |
| `20261023001907_forja_login_google.sql` | `20261023001907` | exato, **menos o e-mail do trainer** (trocado por `<EMAIL-DO-TRAINER>` e o `UPDATE` ficou comentado; o valor real já está em `alunos.google_email`). Cria as colunas `google_*`, a tabela `google_bloqueados`, `api_google` (só `authenticated` executa), abre o cadastro por Google (`google_signup='sim'`) e recusa PIN vazio em `f_salvar_aluno` |
| `20261023005141_forja_imagens_relativas.sql` | `20261023005141` | exato; só dado (URLs de imagem do GitHub Pages viram relativas) |
| `20261023034156_forja_limites_api_post.sql` | `20261023034156` | exato. Limites de tamanho/volume nas ações do aluno; baixa `google_max_alunos` para 50 |
| `20261102000000_forja_colunas_fora_de_migration.SNAPSHOT.sql` | — | **colunas que existem no banco e não vieram de nenhuma migration**: `peso.fc_repouso`, `perimetros.envergadura`, `perimetros.obs` (têm dado; o app não usa; origem não confirmada) |
| `20261102143559_forja_valida_dia_modalidade.sql` | `20261102143559` | exato + **bloco de ROLLBACK comentado** no fim. Whitelist de `dia` (A–E) e `modalidade` na RPC |

**De propósito fora do repositório:** `20260918155121 create_schema_imoveis` e `20260918155245 create_views_imoveis` — schema `imoveis`,
de outro aplicativo que divide este projeto Supabase. Não são do FORJA e não foram tocadas.

## Como restaurar (se um dia precisar)

1. Projeto Supabase novo → rodar os arquivos desta pasta **em ordem de nome**, menos `20260902_forja_backup_payload.sql`
   (é o que `replay.sh` faz). Via SQL Editor, um arquivo por vez, ou `execute_sql`.
2. O que **não** está no SQL e precisa de mão:
   - **Chave do trainer** (`config.admin_key`, guardada como hash bcrypt, nunca no repositório):
     `insert into config (key, value) values ('admin_key', extensions.crypt('NOVA-CHAVE', extensions.gen_salt('bf'))) on conflict (key) do update set value = excluded.value;`
   - **Config do login Google**, estado vivo em 02/11/2026: `google_signup='sim'` (**auto-cadastro aberto**), `google_max_alunos='50'`, `google_max_24h='20'`.
     Para fechar o cadastro: `update config set value = 'nao' where key = 'google_signup';`
   - **E-mail do trainer** em `alunos.google_email` (id `marcos`), se for restaurar o vínculo do login Google.
   - **Painel Auth**: provedor Google ligado (Client ID/Secret) e as URLs de redirecionamento — no painel do Supabase e no Google Cloud. Não está em SQL e
     eu não consegui conferir daqui (a rede bloqueou o endpoint de settings); só sei que existe 1 identidade Google no banco.
   - O `forja.html` tem a URL do projeto e a chave anon: trocar se o projeto mudar.
3. **Dados** (alunos, plano, registro, peso, perímetros, exercícios) vêm de um backup de dados à parte.

## Convenção daqui pra frente

Toda migration aplicada no FORJA via `apply_migration` ganha, **na mesma resposta**, um arquivo `<versão>_<nome>.sql` aqui, copiado de
`supabase_migrations.schema_migrations.statements` (texto exato, não de memória). Depois: atualizar a tabela acima, rodar
`fingerprint.sql` no banco vivo e atualizar `supabase/replay/ESPERADO.txt`, e rodar `bash supabase/replay/replay.sh`.
DDL feito fora de migration (execute_sql) some deste backup: foi assim que `fc_repouso`/`envergadura`/`obs` ficaram de fora.

O antigo `HANDOFF_FASE6.md`, citado em versões anteriores deste README, nunca esteve neste repositório. O handoff atual está em `docs/`.
