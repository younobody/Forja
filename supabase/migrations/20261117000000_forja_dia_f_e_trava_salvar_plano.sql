-- v30.33.0 (17/11/2026): dia F no banco + trava no SALVAR PLANO.
--
-- Por que: o plano PPL 6x do aluno marcos (gravado em 07/11/2026) tem dias A-F, mas
-- (1) f_valores_item so aceitava A-E (whitelist anti-XSS da v30.31.1), entao um
--     registro com dia F seria recusado; e
-- (2) o front ate a v30.32.0 so conhece A-E: o editor do trainer monta o payload a
--     partir de DAYS e f_salvar_plano apaga tudo e reinsere. Salvar o plano num front
--     velho apagaria em silencio todo o dia F.
-- A trava: o front novo manda `dias` (as letras que ele conhece). Se o plano gravado
-- tem uma letra que o payload nao conhece (nem em `dias`, nem nos itens), recusa.
-- Front velho nao manda `dias` -> conhece so A-E.

create or replace function public.f_valores_item(r jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select upper(trim(coalesce(r->>'dia', ''))) in ('', 'A', 'B', 'C', 'D', 'E', 'F')
     and lower(trim(coalesce(r->>'modalidade', ''))) in ('', 'pedal', 'esteira', 'remo', 'corrida', 'outro')
$function$;

create or replace function public.f_salvar_plano(body jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_aluno text := coalesce(body->>'aluno_id','');
  p jsonb;
  i int := 0;
  v_conhecidos text[];
  v_perdidos text;
begin
  if jsonb_typeof(body->'dias') = 'array' then
    select array_agg(upper(trim(e #>> '{}'))) into v_conhecidos from jsonb_array_elements(body->'dias') e;
  else
    v_conhecidos := array['A','B','C','D','E'];
  end if;
  v_conhecidos := v_conhecidos || coalesce((
    select array_agg(distinct upper(trim(coalesce(e->>'dia',''))))
    from jsonb_array_elements(coalesce(body->'plano','[]'::jsonb)) e), '{}');

  select string_agg(distinct upper(trim(dia)), ',') into v_perdidos
  from plano
  where aluno_id = v_aluno and upper(trim(dia)) <> all(v_conhecidos);
  if v_perdidos is not null then
    return jsonb_build_object('error', 'o plano tem o dia ' || v_perdidos
      || ', que esta versao do app nao conhece. Atualize o FORJA antes de salvar (nada foi apagado).');
  end if;

  delete from plano where aluno_id = v_aluno;
  for p in select * from jsonb_array_elements(coalesce(body->'plano','[]'::jsonb)) loop
    i := i + 1;
    insert into plano (aluno_id, dia, ordem, exercicio, series, reps, carga, rir, obs, tipo, meta)
    values (
      v_aluno,
      coalesce(p->>'dia',''),
      i,
      coalesce(p->>'exercicio',''),
      coalesce(p->>'series',''),
      coalesce(p->>'reps',''),
      coalesce(p->>'carga',''),
      coalesce(p->>'rir',''),
      coalesce(p->>'obs',''),
      coalesce(p->>'tipo',''),
      coalesce(p->>'meta','')
    );
  end loop;
  return jsonb_build_object('ok', true);
end $function$;

-- Rollback: recriar f_valores_item sem 'F' (ver 20261102143559) e f_salvar_plano sem o bloco
-- v_conhecidos/v_perdidos (ver 20260719020028_forja_api_functions.SNAPSHOT.sql).
