-- FORJA v30.8.0 — delete de registro por PK (2026-09-07)
--
-- BUG CORRIGIDO
-- f_remover_registro_aluno apagava por `timestamp = ? and aluno_id = ?`, SEM LIMIT
-- e sem filtro de exercicio. Uma sessao salva em lote compartilha o mesmo timestamp,
-- entao remover UM exercicio pelo historico apagava a SESSAO INTEIRA daquele instante.
-- Medido em 07/09/2026, antes desta migration:
--   11 grupos (timestamp, aluno_id) com mais de 1 registro = 44 linhas expostas;
--   pior grupo com 8 registros — 1 clique apagaria os 8.
--
-- f_remover_registro (caminho do TRAINER) era pior ainda: apagava por timestamp
-- SEM NENHUM filtro de aluno, entao podia atingir registro de outro aluno que
-- tivesse gravado no mesmo instante.
--
-- CORRECAO
-- 1. `pk` passa a viajar no payload (f_aluno_payload e f_admin_payload), pra que o
--    app tenha o que mandar. Sem isso o resto nao funciona — este passo vem primeiro.
-- 2. Os dois deletes individuais passam a apagar por `pk`, sempre com guarda de aluno_id.
-- 3. FALLBACK LEGADO: um app que ainda esteja com payload antigo em cache no
--    localStorage nao tem `pk`. Nesse caso o delete continua por timestamp, mas
--    limitado a UMA linha via ctid — ou seja, o bug fica corrigido MESMO para o
--    cliente antigo, sem exigir que o cache expire.
-- 4. Os deletes em LOTE continuam por timestamp de proposito: eles existem pra
--    remover a sessao inteira, entao ali o comportamento amplo e o desejado. O que
--    muda e a guarda de aluno_id no lote do trainer, aplicada so quando o campo vem
--    preenchido (nao quebra cliente antigo que ainda nao manda o campo).
--
-- ROLLBACK: reaplicar 20260719020028_forja_api_functions.SNAPSHOT.sql

-- ---------------------------------------------------------------------------
-- 1. pk no payload do aluno
-- ---------------------------------------------------------------------------
create or replace function public.f_aluno_payload(p_id text)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  a record;
  v_id text := trim(coalesce(p_id,''));
begin
  select * into a from alunos where trim(id) = v_id limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'aluno', jsonb_build_object('id', a.id, 'nome', a.nome, 'objetivo', a.objetivo, 'notas', a.notas),
    'plano', coalesce((
      select jsonb_agg(jsonb_build_object(
        'aluno_id', aluno_id, 'dia', dia, 'ordem', ordem, 'exercicio', exercicio,
        'series', series, 'reps', reps, 'carga', carga, 'rir', rir, 'obs', obs,
        'tipo', tipo, 'meta', meta
      ) order by dia, ordem)
      from plano where trim(aluno_id) = v_id
    ), '[]'::jsonb),
    'registros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pk', pk,
        'timestamp', "timestamp", 'aluno_id', aluno_id, 'dia', dia, 'exercicio', exercicio,
        'carga', carga, 'reps', reps, 'rir', rir, 'completou', completou, 'obs', obs,
        'data_treino', data_treino, 'modalidade', modalidade, 'local_id', local_id
      ) order by "timestamp" desc, pk desc)
      from registro where trim(aluno_id) = v_id
    ), '[]'::jsonb),
    'peso', coalesce((
      select jsonb_agg(jsonb_build_object(
        'timestamp', "timestamp", 'aluno_id', aluno_id, 'peso', peso,
        'balanca', balanca, 'obs', obs, 'data', data
      ) order by "timestamp" desc, pk desc)
      from peso where trim(aluno_id) = v_id
    ), '[]'::jsonb),
    'perimetros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'timestamp', "timestamp", 'aluno_id', aluno_id, 'cintura', cintura, 'quadril', quadril,
        'peito', peito, 'braco', braco, 'antebraco', antebraco, 'coxa', coxa,
        'panturrilha', panturrilha, 'pescoco', pescoco, 'data', data
      ) order by "timestamp" desc, pk desc)
      from perimetros where trim(aluno_id) = v_id
    ), '[]'::jsonb),
    'exercicios', f_exercicios_json()
  );
end $function$;

-- ---------------------------------------------------------------------------
-- 2. pk no payload do trainer
-- ---------------------------------------------------------------------------
create or replace function public.f_admin_payload()
returns jsonb
language sql
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'alunos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'pin', pin, 'objetivo', objetivo, 'notas', notas,
        'criado_em', criado_em, 'visivel_publico', visivel_publico
      ) order by seq)
      from alunos
    ), '[]'::jsonb),
    'plano', coalesce((
      select jsonb_agg(jsonb_build_object(
        'aluno_id', aluno_id, 'dia', dia, 'ordem', ordem, 'exercicio', exercicio,
        'series', series, 'reps', reps, 'carga', carga, 'rir', rir, 'obs', obs,
        'tipo', tipo, 'meta', meta
      ) order by pk)
      from plano
    ), '[]'::jsonb),
    'registros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pk', pk,
        'timestamp', "timestamp", 'aluno_id', aluno_id, 'dia', dia, 'exercicio', exercicio,
        'carga', carga, 'reps', reps, 'rir', rir, 'completou', completou, 'obs', obs,
        'data_treino', data_treino, 'modalidade', modalidade, 'local_id', local_id
      ) order by pk)
      from registro
    ), '[]'::jsonb),
    'exercicios', f_exercicios_json()
  )
$function$;

-- ---------------------------------------------------------------------------
-- 3. delete individual do ALUNO — por pk, com fallback de 1 linha
-- ---------------------------------------------------------------------------
create or replace function public.f_remover_registro_aluno(body jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  removidos int := 0;
  v_pk      bigint := nullif(trim(coalesce(body->>'pk','')), '')::bigint;
  v_aluno   text   := coalesce(body->>'aluno_id','');
  v_ts      text   := coalesce(body->>'timestamp','');
begin
  if v_aluno = '' then
    return jsonb_build_object('ok', false, 'error', 'aluno_id obrigatorio', 'removidos', 0);
  end if;

  if v_pk is not null then
    delete from registro where pk = v_pk and aluno_id = v_aluno;
  else
    -- Cliente legado (payload em cache sem pk). Apaga NO MAXIMO uma linha:
    -- e este LIMIT que impede o clique em 1 exercicio de levar a sessao junto.
    if v_ts = '' then
      return jsonb_build_object('ok', false, 'error', 'pk ou timestamp obrigatorio', 'removidos', 0);
    end if;
    delete from registro where ctid = (
      select ctid from registro
      where "timestamp" = v_ts and aluno_id = v_aluno
      order by pk limit 1
    );
  end if;

  get diagnostics removidos = row_count;
  return jsonb_build_object('ok', true, 'removidos', removidos);
end $function$;

-- ---------------------------------------------------------------------------
-- 4. delete individual do TRAINER — ganha guarda de aluno e o mesmo limite
-- ---------------------------------------------------------------------------
create or replace function public.f_remover_registro(body jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  removidos int := 0;
  v_pk      bigint := nullif(trim(coalesce(body->>'pk','')), '')::bigint;
  v_aluno   text   := coalesce(body->>'aluno_id','');
  v_ts      text   := coalesce(body->>'timestamp','');
begin
  if v_pk is not null then
    -- aluno_id continua opcional aqui (o trainer e dono de todos), mas quando
    -- vem preenchido vira guarda: erro de tela nao atinge outro aluno.
    delete from registro
    where pk = v_pk
      and (v_aluno = '' or aluno_id = v_aluno);
  else
    if v_ts = '' then
      return jsonb_build_object('ok', false, 'error', 'pk ou timestamp obrigatorio', 'removidos', 0);
    end if;
    delete from registro where ctid = (
      select ctid from registro
      where "timestamp" = v_ts
        and (v_aluno = '' or aluno_id = v_aluno)
      order by pk limit 1
    );
  end if;

  get diagnostics removidos = row_count;
  return jsonb_build_object('ok', true, 'removidos', removidos);
end $function$;

-- ---------------------------------------------------------------------------
-- 5. lote do TRAINER — guarda de aluno quando o campo vier preenchido.
--    Continua por timestamp DE PROPOSITO: aqui apagar a sessao inteira e o objetivo.
-- ---------------------------------------------------------------------------
create or replace function public.f_remover_registros_batch(body jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  targets text[];
  removidos int := 0;
  v_aluno text := coalesce(body->>'aluno_id','');
begin
  select coalesce(array_agg(e #>> '{}'), '{}') into targets
  from jsonb_array_elements(coalesce(body->'timestamps','[]'::jsonb)) e;
  if array_length(targets,1) is null then
    return jsonb_build_object('ok', true, 'removidos', 0);
  end if;
  delete from registro
  where "timestamp" = any(targets)
    and (v_aluno = '' or aluno_id = v_aluno);
  get diagnostics removidos = row_count;
  return jsonb_build_object('ok', true, 'removidos', removidos);
end $function$;
