-- SNAPSHOT (nao e migration registrada), conferido no banco vivo em 02/11/2026 (projeto FORJA, aupfamquyihqagzwmpkb).
--
-- Tres colunas EXISTEM no banco vivo mas nao foram criadas por nenhuma migration registrada
-- (supabase_migrations.schema_migrations nao tem nenhuma que as mencione), e as migrations deste repositorio, sozinhas,
-- NAO as recriam:
--   peso.fc_repouso        text, aceita nulo  (2 de 25 linhas preenchidas)
--   perimetros.envergadura text, aceita nulo  (1 de 3 linhas preenchidas)
--   perimetros.obs         text, aceita nulo  (3 de 3 linhas preenchidas)
-- O app FORJA nao le nem grava essas colunas: f_salvar_peso, f_salvar_perimetros e f_aluno_payload nao as citam e o
-- forja.html tambem nao. HIPOTESE (origem nao confirmada): criadas por DDL direto, feito por outra ferramenta do dono do
-- projeto (por exemplo a skill de treino que le/escreve o banco pelo MCP do Supabase). Como ha dado nelas, NAO apague.
--
-- Uso: so para quem reconstruir o banco do zero DEPOIS de rodar a cadeia de migrations. No banco vivo nao precisa rodar
-- (ja existem); e idempotente de qualquer forma. Os valores (fc_repouso etc.) so voltam a partir de um backup de DADOS.

alter table public.peso add column if not exists fc_repouso text;
alter table public.perimetros add column if not exists envergadura text;
alter table public.perimetros add column if not exists obs text;
