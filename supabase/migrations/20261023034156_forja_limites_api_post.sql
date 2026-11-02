-- Migration 20261023034156 "forja_limites_api_post" (projeto FORJA, aupfamquyihqagzwmpkb, 23/10/2026).
-- Este arquivo nao existia no repositorio; copiado em 02/11/2026 de supabase_migrations.schema_migrations.statements.
-- Limites de tamanho e de volume nas acoes do ALUNO em api_post (importante porque o cadastro pelo Google deixa qualquer
-- conta Google escrever direto na RPC): 64 KB por pedido, textos de registro ate 120/60/120/60/4000 caracteres, lote de
-- ate 40 registros, 80 registros/24 h por conta Google (300 nas demais), exclusao em lote ate 100, peso/perimetros com
-- campos de ate 200 caracteres e no maximo 30 por 24 h. Tambem baixa config.google_max_alunos para 50.
-- Em 02/11/2026 a migration 20261102143559 acrescentou a validacao de dia/modalidade dentro de f_checar_limites_aluno.

create or replace function public.f_limites_item(r jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(length(r->>'exercicio'), 0) <= 120
     and coalesce(length(r->>'carga'), 0) <= 60
     and coalesce(length(r->>'reps'), 0) <= 120
     and coalesce(length(r->>'rir'), 0) <= 60
     and coalesce(length(r->>'obs'), 0) <= 4000
$function$;

create or replace function public.f_checar_limites_aluno(p jsonb)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  act text := p->>'action';
  v_aluno text := trim(coalesce(p->>'aluno_id', ''));
  v_goog boolean;
  v_lim int;
  v_corte text := to_char((now() - interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_novos int := 0;
  v_ja int := 0;
  r jsonb;
begin
  if octet_length(p::text) > 65536 then return 'limite: pedido grande demais'; end if;

  if act in ('registro', 'registroBatch') then
    if act = 'registro' then
      if not f_limites_item(p) then return 'limite: texto grande demais'; end if;
      v_novos := 1;
    else
      if jsonb_typeof(coalesce(p->'registros', '[]'::jsonb)) <> 'array' then return 'limite: formato invalido'; end if;
      v_novos := jsonb_array_length(coalesce(p->'registros', '[]'::jsonb));
      if v_novos > 40 then return 'limite: lote grande demais'; end if;
      for r in select * from jsonb_array_elements(coalesce(p->'registros', '[]'::jsonb)) loop
        if not f_limites_item(r) then return 'limite: texto grande demais'; end if;
      end loop;
    end if;
    select exists (select 1 from alunos where trim(id) = v_aluno and google_sub is not null) into v_goog;
    v_lim := case when v_goog then 80 else 300 end;
    select count(*) into v_ja from registro where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
    if v_ja + v_novos > v_lim then return 'limite: registros demais nas ultimas 24 h'; end if;

  elsif act = 'removerRegistrosAlunoBatch' then
    if jsonb_typeof(coalesce(p->'timestamps', '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p->'timestamps', '[]'::jsonb)) > 100 then
      return 'limite: lote grande demais';
    end if;

  elsif act in ('salvarPeso', 'salvarPerimetros') then
    if exists (select 1 from jsonb_each_text(p) e where length(e.value) > 200) then return 'limite: texto grande demais'; end if;
    if act = 'salvarPeso' then
      select count(*) into v_ja from peso where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
    else
      select count(*) into v_ja from perimetros where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
    end if;
    if v_ja >= 30 then return 'limite: medidas demais nas ultimas 24 h'; end if;
  end if;

  return null;
end $function$;

revoke all on function public.f_limites_item(jsonb) from public, anon, authenticated;
revoke all on function public.f_checar_limites_aluno(jsonb) from public, anon, authenticated;

create or replace function public.api_post(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  action text := payload->>'action';
  v_limite text;
begin
  if action in ('registro','registroBatch','removerRegistroAluno','removerRegistrosAlunoBatch','salvarPeso','salvarPerimetros') then
    if not f_validar_aluno(payload->>'aluno_id', payload->>'pin') then
      perform pg_sleep(0.3);
      return jsonb_build_object('error', 'aluno/pin invalido');
    end if;
    v_limite := f_checar_limites_aluno(payload);
    if v_limite is not null then return jsonb_build_object('error', v_limite); end if;
    if action = 'registro' then return f_registro(payload); end if;
    if action = 'registroBatch' then return f_registro_batch(payload); end if;
    if action = 'removerRegistroAluno' then return f_remover_registro_aluno(payload); end if;
    if action = 'removerRegistrosAlunoBatch' then return f_remover_registros_aluno_batch(payload); end if;
    if action = 'salvarPeso' then return f_salvar_peso(payload); end if;
    if action = 'salvarPerimetros' then return f_salvar_perimetros(payload); end if;
  end if;

  if not f_check_admin_key(payload->>'key') then
    perform pg_sleep(0.3);
    return jsonb_build_object('error', 'unauthorized');
  end if;

  if action = 'registroAdmin' then return f_registro_admin(payload); end if;
  if action = 'salvarPlano' then return f_salvar_plano(payload); end if;
  if action = 'salvarAluno' then return f_salvar_aluno(payload); end if;
  if action = 'importAluno' then return f_import_aluno(payload); end if;
  if action = 'removerAluno' then return f_remover_aluno(payload); end if;
  if action = 'removerRegistro' then return f_remover_registro(payload); end if;
  if action = 'removerRegistrosBatch' then return f_remover_registros_batch(payload); end if;

  return jsonb_build_object('error', 'unknown action: ' || coalesce(action, 'undefined'));
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $function$;

update public.config set value = '50' where key = 'google_max_alunos';
