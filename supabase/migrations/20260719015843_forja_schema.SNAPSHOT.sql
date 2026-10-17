-- SNAPSHOT reconstruido por introspeccao em 2026-07-21 (ver README.md da pasta).
-- Cobre o que a migration original "forja_schema" (2026-07-19) criou:
-- extensoes, tabelas, constraints, indices, RLS deny-all, revokes.

create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- ===== TABELAS =====

create table if not exists alunos (
  id text NOT NULL,
  nome text NOT NULL,
  pin text NOT NULL,
  objetivo text NOT NULL,
  notas text NOT NULL,
  criado_em text NOT NULL,
  visivel_publico text NOT NULL,
  seq bigint generated always as identity,
  constraint alunos_pkey primary key (id)
);

create table if not exists config (
  key text NOT NULL,
  value text NOT NULL,
  constraint config_pkey primary key (key)
);

create table if not exists exercicios (
  nome_atual text NOT NULL,
  aliases text NOT NULL,
  constraint exercicios_pkey primary key (nome_atual)
  -- colunas musculos_primarios/musculos_secundarios/equipamento/instrucoes/
  -- imagem_url/video_url/wger_id vieram depois, na migration
  -- forja_exercicios_ricos_schema (ver arquivo separado nesta pasta)
);

create table if not exists plano (
  pk bigint generated always as identity,
  aluno_id text NOT NULL,
  dia text NOT NULL,
  ordem integer NOT NULL,
  exercicio text NOT NULL,
  series text NOT NULL,
  reps text NOT NULL,
  carga text NOT NULL,
  rir text NOT NULL,
  obs text NOT NULL,
  tipo text NOT NULL,
  meta text NOT NULL,
  constraint plano_pkey primary key (pk),
  constraint plano_aluno_id_fkey foreign key (aluno_id) references alunos(id) on delete cascade
);
create index if not exists plano_aluno_idx on plano (aluno_id);

create table if not exists registro (
  pk bigint generated always as identity,
  "timestamp" text NOT NULL,
  aluno_id text NOT NULL,
  dia text NOT NULL,
  exercicio text NOT NULL,
  carga text NOT NULL,
  reps text NOT NULL,
  rir text NOT NULL,
  completou text NOT NULL,
  obs text NOT NULL,
  data_treino text NOT NULL,
  modalidade text NOT NULL,
  local_id text NOT NULL,
  constraint registro_pkey primary key (pk),
  constraint registro_aluno_id_fkey foreign key (aluno_id) references alunos(id) on delete cascade
);
create index if not exists registro_aluno_idx on registro (aluno_id);
create index if not exists registro_ts_idx on registro ("timestamp");
-- idempotencia do buffer offline: retry com mesmo local_id nao duplica
create unique index if not exists registro_local_id_uniq on registro (local_id) where (local_id <> '');

create table if not exists peso (
  pk bigint generated always as identity,
  "timestamp" text NOT NULL,
  aluno_id text NOT NULL,
  peso text NOT NULL,
  balanca text NOT NULL,
  obs text NOT NULL,
  data text NOT NULL,
  constraint peso_pkey primary key (pk),
  constraint peso_aluno_id_fkey foreign key (aluno_id) references alunos(id) on delete cascade
);
create index if not exists peso_aluno_idx on peso (aluno_id);

create table if not exists perimetros (
  pk bigint generated always as identity,
  "timestamp" text NOT NULL,
  aluno_id text NOT NULL,
  cintura text NOT NULL,
  quadril text NOT NULL,
  peito text NOT NULL,
  braco text NOT NULL,
  antebraco text NOT NULL,
  coxa text NOT NULL,
  panturrilha text NOT NULL,
  pescoco text NOT NULL,
  data text NOT NULL,
  constraint perimetros_pkey primary key (pk),
  constraint perimetros_aluno_id_fkey foreign key (aluno_id) references alunos(id) on delete cascade
);
create index if not exists perimetros_aluno_idx on perimetros (aluno_id);

-- ===== RLS: habilitado em TODAS as tabelas, SEM NENHUMA POLICY = deny-all.
-- (design intencional — nao "corrigir" adicionando policies sem entender.
-- Unico acesso e via as RPCs api_get/api_post, SECURITY DEFINER.) =====
alter table alunos enable row level security;
alter table config enable row level security;
alter table exercicios enable row level security;
alter table plano enable row level security;
alter table registro enable row level security;
alter table peso enable row level security;
alter table perimetros enable row level security;

-- revoke tudo de anon/authenticated nas tabelas (acesso so via RPC)
revoke all on alunos, config, exercicios, plano, registro, peso, perimetros
  from anon, authenticated;
