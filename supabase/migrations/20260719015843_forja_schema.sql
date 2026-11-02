-- ############################################################################
-- SQL EXATO aplicado na migration 20260719015843 "forja_schema" (projeto FORJA, aupfamquyihqagzwmpkb).
-- Copiado em 02/11/2026 de supabase_migrations.schema_migrations.statements (o banco guarda o texto aplicado de cada
-- migration; list_migrations e que so mostra versao/nome). Substitui o antigo 20260719015843_forja_schema.SNAPSHOT.sql,
-- que era uma reconstrucao por introspeccao e tinha 3 defeitos: (1) nao registrava nenhum DEFAULT das colunas (o banco
-- tem `not null default ''`, completou 'sim', ordem 0); (2) criava as extensoes sem `with schema extensions` (as funcoes
-- chamam extensions.unaccent / extensions.crypt); (3) omitia o `alter default privileges` abaixo. O texto reconstruido
-- continua no historico do git.
-- Conferencia: o hash do texto abaixo (sem comentarios e sem espacos) e igual ao do banco. Ver README.md desta pasta.
-- ############################################################################

-- FORJA schema — espelha as abas da planilha "FORJA — Banco".
-- Valores como text (a planilha forçava texto em series/reps/carga; o frontend
-- faz todo o parsing defensivo). timestamp/data_treino como text ISO verbatim:
-- as remoções casam por igualdade de string e há timestamps legados corrompidos.

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table alunos (
  id text primary key,
  nome text not null default '',
  pin text not null default '',
  objetivo text not null default '',
  notas text not null default '',
  criado_em text not null default '',
  visivel_publico text not null default '',
  seq bigint generated always as identity  -- ordem da aba: desempate de PIN duplicado no login
);

create table plano (
  pk bigint generated always as identity primary key,
  aluno_id text not null references alunos(id) on delete cascade,
  dia text not null default '',
  ordem int not null default 0,
  exercicio text not null default '',
  series text not null default '',
  reps text not null default '',
  carga text not null default '',
  rir text not null default '',
  obs text not null default '',
  tipo text not null default '',
  meta text not null default ''
);
create index plano_aluno_idx on plano(aluno_id);

create table registro (
  pk bigint generated always as identity primary key,
  "timestamp" text not null default '',
  aluno_id text not null references alunos(id) on delete cascade,
  dia text not null default '',
  exercicio text not null default '',
  carga text not null default '',
  reps text not null default '',
  rir text not null default '',
  completou text not null default 'sim',
  obs text not null default '',
  data_treino text not null default '',
  modalidade text not null default '',
  local_id text not null default ''
);
create index registro_aluno_idx on registro(aluno_id);
create index registro_ts_idx on registro("timestamp");
-- idempotência do buffer offline do app (retry com o mesmo local_id não duplica)
create unique index registro_local_id_uniq on registro(local_id) where local_id <> '';

create table peso (
  pk bigint generated always as identity primary key,
  "timestamp" text not null default '',
  aluno_id text not null references alunos(id) on delete cascade,
  peso text not null default '',
  balanca text not null default '',
  obs text not null default '',
  data text not null default ''
);
create index peso_aluno_idx on peso(aluno_id);

create table perimetros (
  pk bigint generated always as identity primary key,
  "timestamp" text not null default '',
  aluno_id text not null references alunos(id) on delete cascade,
  cintura text not null default '',
  quadril text not null default '',
  peito text not null default '',
  braco text not null default '',
  antebraco text not null default '',
  coxa text not null default '',
  panturrilha text not null default '',
  pescoco text not null default '',
  data text not null default ''
);
create index perimetros_aluno_idx on perimetros(aluno_id);

create table exercicios (
  nome_atual text primary key,
  aliases text not null default ''  -- separados por ';'
);

create table config (
  key text primary key,
  value text not null  -- admin_key guardada como hash bcrypt (extensions.crypt)
);

-- Postura de segurança: RLS habilitado SEM policies (deny-all) + revokes.
-- O único acesso da anon key será EXECUTE em api_get/api_post (migration 2).
alter table alunos enable row level security;
alter table plano enable row level security;
alter table registro enable row level security;
alter table peso enable row level security;
alter table perimetros enable row level security;
alter table exercicios enable row level security;
alter table config enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
