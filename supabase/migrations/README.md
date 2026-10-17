# Backup das migrations do Supabase (projeto FORJA, `aupfamquyihqagzwmpkb`)

Cópia local do que existe hoje só dentro do Supabase (`list_migrations` no MCP
não devolve o SQL, só nome/versão) — motivo de existir esta pasta: se o
projeto Supabase sumir ou algo quebrar, dá pra reconstruir o banco do zero
a partir daqui, sem depender só da nuvem.

## Arquivos

- `20260719015843_forja_schema.SNAPSHOT.sql` e
  `20260719020028_forja_api_functions.SNAPSHOT.sql` — essas duas migrations
  foram aplicadas numa sessão anterior a esta conversa; o SQL exato usado
  naquele momento não está disponível. Em vez de reconstruir de memória (o
  que poderia divergir do banco real), o conteúdo foi gerado por
  **introspecção do banco ao vivo em 2026-07-21** (`pg_get_functiondef`,
  `information_schema`/`pg_catalog` para tabelas/constraints/índices/grants).
  Ou seja: reflete o **estado atual e real**, já incluindo qualquer ajuste
  posterior das migrations seguintes — é mais confiável como ponto de
  restauração do que o texto original teria sido.
- `20260719200105_forja_exercicios_ricos_schema.sql`,
  `20260719200948_forja_exercicios_ricos_payload.sql`,
  `20260720032404_forja_feed_exclui_cardio.sql` — SQL exato aplicado via
  `apply_migration`, copiado verbatim desta conversa.

## Convenção daqui pra frente

Toda vez que uma migration nova for aplicada no FORJA via `apply_migration`,
um arquivo `<version>_<name>.sql` correspondente é criado nesta pasta na
mesma resposta — sem precisar pedir. Ver também `HANDOFF_FASE6.md`.

## Como restaurar (se um dia precisar)

Num projeto Supabase novo, rodar os arquivos NUMERADOS em ordem
(1_schema → 2_api_functions → 3_exercicios_ricos_schema →
4_exercicios_ricos_payload → 5_feed_exclui_cardio) via SQL Editor ou
`execute_sql`. Os SNAPSHOTs cobrem schema + funções + constraints + índices
+ RLS deny-all + grants mínimos (só `api_get`/`api_post` executáveis por
`anon` — os `f_*` são internos, sem grant, por design). Depois disso falta
só popular dados (alunos/plano/registro/exercicios) a partir de um backup
de dados separado — esta pasta é só ESTRUTURA, não dados.
