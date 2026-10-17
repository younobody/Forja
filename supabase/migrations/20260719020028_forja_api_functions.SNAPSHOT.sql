-- SNAPSHOT reconstruido por introspeccao em 2026-07-21 (ver README.md da pasta).
-- Cobre TODAS as funcoes public.* hoje no banco (pg_get_functiondef), o que
-- inclui tanto o que a migration original "forja_api_functions" (2026-07-19)
-- criou quanto ajustes de migrations posteriores (ex: f_exercicios_json
-- ganhou campos ricos em forja_exercicios_ricos_payload; f_feed_motivacional
-- passou a excluir cardio em forja_feed_exclui_cardio). Estado real de hoje.
--
-- Seguranca (nao mudar sem entender): so api_get/api_post tem GRANT pra
-- anon (SECURITY DEFINER, expostas via /rest/v1/rpc/api_get|api_post). Todo
-- f_* e interno, SEM grant — inacessivel de fora mesmo sendo SECURITY
-- DEFINER em alguns casos (f_check_admin_key, f_validar_aluno). Os advisors
-- do Supabase avisam sobre isso (WARN "SECURITY DEFINER executavel por
-- anon" nas duas RPCs, INFO "RLS sem policy" nas tabelas) — sao avisos
-- ESPERADOS, o design e intencional.

-- ===== HELPERS =====

CREATE OR REPLACE FUNCTION public.f_slug(s text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select trim(both '-' from regexp_replace(lower(trim(extensions.unaccent(coalesce(s,'')))), '[^a-z0-9-]+', '-', 'g'))
$function$;

CREATE OR REPLACE FUNCTION public.f_now_iso()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$function$;

CREATE OR REPLACE FUNCTION public.f_today_sp()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
$function$;

CREATE OR REPLACE FUNCTION public.f_truthy(v jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when v is null then false
    when jsonb_typeof(v) = 'null' then false
    when jsonb_typeof(v) = 'boolean' then v = 'true'::jsonb
    when jsonb_typeof(v) = 'string' then (v #>> '{}') <> ''
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric <> 0
    else true
  end
$function$;

CREATE OR REPLACE FUNCTION public.f_data_treino_iso(v text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s text := trim(coalesce(v,''));
  m text[];
begin
  m := regexp_match(s, '^(\d{4})-(\d{2})-(\d{2})');
  if m is not null then return m[1] || '-' || m[2] || '-' || m[3]; end if;
  m := regexp_match(s, '^(\d{1,2})/(\d{1,2})/(\d{4})$');
  if m is not null and m[1]::int between 1 and 31 and m[2]::int between 1 and 12 then
    return m[3] || '-' || lpad(m[2], 2, '0') || '-' || lpad(m[1], 2, '0');
  end if;
  return '';
end $function$;

CREATE OR REPLACE FUNCTION public.f_data_sessao(p_data_treino text, p_ts text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  dt text := f_data_treino_iso(p_data_treino);
  d timestamptz;
begin
  if dt <> '' then return dt; end if;
  begin
    d := p_ts::timestamptz;
  exception when others then
    return '';
  end;
  return to_char(d at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
end $function$;

CREATE OR REPLACE FUNCTION public.f_check_admin_key(k text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select exists (
    select 1 from config
    where key = 'admin_key' and value = extensions.crypt(coalesce(k,''), value)
  )
$function$;

CREATE OR REPLACE FUNCTION public.f_validar_aluno(p_id text, p_pin text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from alunos
    where trim(id) = trim(coalesce(p_id,'')) and trim(pin) = trim(coalesce(p_pin,''))
  )
$function$;

CREATE OR REPLACE FUNCTION public.f_aluno_visivel(v text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(trim(coalesce(v,''))) !~ '^(false|nao|não|0)$'
$function$;

CREATE OR REPLACE FUNCTION public.f_canonizar_exercicio(nome text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  alvo text := f_slug(nome);
  g record;
begin
  if alvo = '' then return nome; end if;
  for g in select nome_atual, aliases from exercicios where trim(coalesce(nome_atual,'')) <> '' loop
    if f_slug(g.nome_atual) = alvo then return trim(g.nome_atual); end if;
    if exists (
      select 1 from unnest(string_to_array(coalesce(g.aliases,''), ';')) a
      where f_slug(a) <> '' and f_slug(a) = alvo
    ) then return trim(g.nome_atual); end if;
  end loop;
  return nome;
end $function$;

-- ===== PAYLOADS =====

CREATE OR REPLACE FUNCTION public.f_exercicios_json()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'nome_atual', nome_atual, 'aliases', aliases,
      'musculos_primarios', musculos_primarios,
      'musculos_secundarios', musculos_secundarios,
      'equipamento', equipamento, 'instrucoes', instrucoes,
      'imagem_url', imagem_url, 'video_url', video_url,
      'wger_id', wger_id
    )
    order by nome_atual
  ), '[]'::jsonb)
  from exercicios
  where trim(coalesce(nome_atual,'')) <> ''
$function$;

CREATE OR REPLACE FUNCTION public.f_aluno_payload(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

CREATE OR REPLACE FUNCTION public.f_admin_payload()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        'timestamp', "timestamp", 'aluno_id', aluno_id, 'dia', dia, 'exercicio', exercicio,
        'carga', carga, 'reps', reps, 'rir', rir, 'completou', completou, 'obs', obs,
        'data_treino', data_treino, 'modalidade', modalidade, 'local_id', local_id
      ) order by pk)
      from registro
    ), '[]'::jsonb),
    'exercicios', f_exercicios_json()
  )
$function$;

CREATE OR REPLACE FUNCTION public.f_feed_motivacional()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  hoje date := f_today_sp()::date;
  ontem date := f_today_sp()::date - 1;
  mp_last date := date_trunc('month', f_today_sp()::date)::date - 1;
  mp_first date := date_trunc('month', date_trunc('month', f_today_sp()::date)::date - 1)::date;
  a record;
  datas date[];
  mais_recente date;
  streak int; d7 int; mes_passado int;
  cur date;
  stats jsonb := '[]'::jsonb;
  maior_mes int := 0;
  s jsonb;
  saida jsonb := '[]'::jsonb;
begin
  for a in
    select trim(id) as id, trim(coalesce(nome,'')) as nome
    from alunos where f_aluno_visivel(visivel_publico) order by seq
  loop
    select coalesce(array_agg(distinct d order by d desc), '{}') into datas
    from (
      select coalesce(nullif(f_data_treino_iso(data_treino),''), nullif(f_data_treino_iso("timestamp"),''))::date as d
      from registro where trim(aluno_id) = a.id and coalesce(modalidade,'') = ''
    ) t where d is not null;

    mais_recente := case when array_length(datas,1) > 0 then datas[1] else null end;

    streak := 0;
    if mais_recente is not null and (mais_recente = hoje or mais_recente = ontem) then
      cur := mais_recente;
      while cur = any(datas) loop
        streak := streak + 1;
        cur := cur - 1;
      end loop;
    end if;

    select count(*)::int into d7 from unnest(datas) d where d between hoje - 6 and hoje;
    select count(*)::int into mes_passado from unnest(datas) d where d between mp_first and mp_last;

    stats := stats || jsonb_build_array(jsonb_build_object(
      'nome', a.nome,
      'ultimoTreino', coalesce(to_char(mais_recente, 'YYYY-MM-DD'), ''),
      'streak', streak,
      'treinos7d', d7,
      'treinosMesPassado', mes_passado,
      'treinouOntemOuHoje', (mais_recente is not null and (mais_recente = hoje or mais_recente = ontem))
    ));

    if mes_passado > maior_mes then maior_mes := mes_passado; end if;
  end loop;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'nome', e->>'nome',
      'ultimoTreino', e->>'ultimoTreino',
      'streak', (e->>'streak')::int,
      'treinos7d', (e->>'treinos7d')::int,
      'treinosMesPassado', (e->>'treinosMesPassado')::int,
      'campeaoMes', (maior_mes > 0 and (e->>'treinosMesPassado')::int = maior_mes)
    )
    order by
      (maior_mes > 0 and (e->>'treinosMesPassado')::int = maior_mes) desc,
      (e->>'streak')::int desc,
      (e->>'treinos7d')::int desc,
      e->>'ultimoTreino' desc
  ), '[]'::jsonb) into saida
  from jsonb_array_elements(stats) e
  where (e->>'treinouOntemOuHoje')::boolean
     or (e->>'streak')::int >= 2
     or (e->>'treinos7d')::int >= 3
     or (maior_mes > 0 and (e->>'treinosMesPassado')::int = maior_mes);

  return jsonb_build_object('feed', saida);
end $function$;

CREATE OR REPLACE FUNCTION public.f_login(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  cod text := trim(coalesce(p_codigo,''));
  v_id text;
  payload jsonb;
begin
  if cod = '' then return jsonb_build_object('error', 'codigo vazio'); end if;

  select id into v_id from alunos
  where trim(pin) = cod and trim(id) <> ''
  order by seq limit 1;

  if found then
    payload := f_aluno_payload(v_id);
    if payload is not null then
      return payload || jsonb_build_object('role', 'aluno', 'id', trim(v_id));
    end if;
  end if;

  if f_check_admin_key(cod) then
    return f_admin_payload() || jsonb_build_object('role', 'trainer');
  end if;

  perform pg_sleep(0.3);
  return jsonb_build_object('error', 'codigo invalido');
end $function$;

-- ===== ACOES (registro/salvar/remover) =====

CREATE OR REPLACE FUNCTION public.f_registro(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_local_id text := coalesce(body->>'local_id','');
begin
  if v_local_id <> '' and exists (select 1 from registro where local_id = v_local_id) then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;
  insert into registro ("timestamp", aluno_id, dia, exercicio, carga, reps, rir, completou, obs, data_treino, modalidade, local_id)
  values (
    f_now_iso(),
    coalesce(body->>'aluno_id',''),
    coalesce(body->>'dia',''),
    f_canonizar_exercicio(coalesce(body->>'exercicio','')),
    coalesce(body->>'carga',''),
    coalesce(body->>'reps',''),
    coalesce(body->>'rir',''),
    case when f_truthy(body->'completou') then 'sim' else 'nao' end,
    coalesce(body->>'obs',''),
    coalesce(body->>'data_treino',''),
    coalesce(body->>'modalidade',''),
    v_local_id
  )
  on conflict (local_id) where local_id <> '' do nothing;
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_registro_admin(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into registro ("timestamp", aluno_id, dia, exercicio, carga, reps, rir, completou, obs, data_treino, modalidade, local_id)
  values (
    f_now_iso(),
    coalesce(body->>'aluno_id',''),
    coalesce(body->>'dia',''),
    f_canonizar_exercicio(coalesce(body->>'exercicio','')),
    coalesce(body->>'carga',''),
    coalesce(body->>'reps',''),
    coalesce(body->>'rir',''),
    case when f_truthy(body->'completou') then 'sim' else 'nao' end,
    coalesce(body->>'obs',''),
    coalesce(body->>'data_treino',''),
    coalesce(body->>'modalidade',''),
    coalesce(body->>'local_id','')
  )
  on conflict (local_id) where local_id <> '' do nothing;
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_registro_batch(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  alvodia text := upper(coalesce(body->>'dia',''));
  alvodata text := f_data_treino_iso(coalesce(body->>'data_treino',''));
  sobrescritos int := 0;
  regs jsonb := coalesce(body->'registros', '[]'::jsonb);
  r jsonb;
  i int := 0;
  base timestamptz := now();
begin
  if alvodata = '' then alvodata := f_today_sp(); end if;

  if body->'sobrescrever' = 'true'::jsonb then
    delete from registro
    where aluno_id = coalesce(body->>'aluno_id','')
      and upper(dia) = alvodia
      and f_data_sessao(data_treino, "timestamp") = alvodata;
    get diagnostics sobrescritos = row_count;
  end if;

  for r in select * from jsonb_array_elements(regs) loop
    insert into registro ("timestamp", aluno_id, dia, exercicio, carga, reps, rir, completou, obs, data_treino, modalidade, local_id)
    values (
      to_char((base + (i * interval '1 millisecond')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      coalesce(body->>'aluno_id',''),
      alvodia,
      f_canonizar_exercicio(coalesce(r->>'exercicio','')),
      coalesce(r->>'carga',''),
      coalesce(r->>'reps',''),
      coalesce(r->>'rir',''),
      case when f_truthy(r->'completou') then 'sim' else 'nao' end,
      coalesce(r->>'obs',''),
      alvodata,
      coalesce(r->>'modalidade',''),
      coalesce(r->>'local_id','')
    )
    on conflict (local_id) where local_id <> '' do nothing;
    i := i + 1;
  end loop;

  return jsonb_build_object('ok', true, 'salvos', jsonb_array_length(regs), 'sobrescritos', sobrescritos);
end $function$;

CREATE OR REPLACE FUNCTION public.f_remover_registro(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from registro where "timestamp" = coalesce(body->>'timestamp','');
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_remover_registro_aluno(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  removidos int := 0;
begin
  delete from registro
  where "timestamp" = coalesce(body->>'timestamp','')
    and aluno_id = coalesce(body->>'aluno_id','');
  get diagnostics removidos = row_count;
  return jsonb_build_object('ok', true, 'removidos', removidos);
end $function$;

CREATE OR REPLACE FUNCTION public.f_remover_registros_batch(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  targets text[];
  removidos int := 0;
begin
  select coalesce(array_agg(e #>> '{}'), '{}') into targets
  from jsonb_array_elements(coalesce(body->'timestamps','[]'::jsonb)) e;
  if array_length(targets,1) is null then
    return jsonb_build_object('ok', true, 'removidos', 0);
  end if;
  delete from registro where "timestamp" = any(targets);
  get diagnostics removidos = row_count;
  return jsonb_build_object('ok', true, 'removidos', removidos);
end $function$;

CREATE OR REPLACE FUNCTION public.f_remover_registros_aluno_batch(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  targets text[];
  removidos int := 0;
begin
  select coalesce(array_agg(e #>> '{}'), '{}') into targets
  from jsonb_array_elements(coalesce(body->'timestamps','[]'::jsonb)) e;
  if array_length(targets,1) is null then
    return jsonb_build_object('ok', true, 'removidos', 0);
  end if;
  delete from registro
  where "timestamp" = any(targets)
    and aluno_id = coalesce(body->>'aluno_id','');
  get diagnostics removidos = row_count;
  return jsonb_build_object('ok', true, 'removidos', removidos);
end $function$;

CREATE OR REPLACE FUNCTION public.f_salvar_peso(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into peso ("timestamp", aluno_id, peso, balanca, obs, data)
  values (
    f_now_iso(),
    coalesce(body->>'aluno_id',''),
    coalesce(body->>'peso',''),
    coalesce(body->>'balanca',''),
    coalesce(body->>'obs',''),
    coalesce(body->>'data','')
  );
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_salvar_perimetros(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into perimetros ("timestamp", aluno_id, cintura, quadril, peito, braco, antebraco, coxa, panturrilha, pescoco, data)
  values (
    f_now_iso(),
    coalesce(body->>'aluno_id',''),
    coalesce(body->>'cintura',''),
    coalesce(body->>'quadril',''),
    coalesce(body->>'peito',''),
    coalesce(body->>'braco',''),
    coalesce(body->>'antebraco',''),
    coalesce(body->>'coxa',''),
    coalesce(body->>'panturrilha',''),
    coalesce(body->>'pescoco',''),
    coalesce(body->>'data','')
  );
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_salvar_plano(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_aluno text := coalesce(body->>'aluno_id','');
  p jsonb;
  i int := 0;
begin
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

CREATE OR REPLACE FUNCTION public.f_salvar_aluno(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id text := coalesce(body->>'id','');
begin
  if exists (select 1 from alunos where id = v_id) then
    update alunos set
      nome = coalesce(body->>'nome',''),
      pin = coalesce(body->>'pin',''),
      objetivo = coalesce(body->>'objetivo',''),
      notas = coalesce(body->>'notas','')
    where id = v_id;
  else
    insert into alunos (id, nome, pin, objetivo, notas, criado_em)
    values (v_id, coalesce(body->>'nome',''), coalesce(body->>'pin',''),
            coalesce(body->>'objetivo',''), coalesce(body->>'notas',''), f_now_iso());
  end if;
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_remover_aluno(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from alunos where id = coalesce(body->>'id','');  -- cascade limpa plano/registro/peso/perimetros
  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.f_import_aluno(body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  a jsonb := coalesce(body->'aluno','{}'::jsonb);
  reg_count int := 0;
  r jsonb;
  comp_raw text;
  comp text;
begin
  if coalesce(a->>'id','') = '' or coalesce(a->>'nome','') = '' or coalesce(a->>'pin','') = '' then
    return jsonb_build_object('error', 'aluno precisa de id, nome e pin');
  end if;

  perform f_salvar_aluno(jsonb_build_object(
    'id', a->>'id', 'nome', a->>'nome', 'pin', a->>'pin',
    'objetivo', coalesce(a->>'objetivo',''), 'notas', coalesce(a->>'notas','')
  ));
  perform f_salvar_plano(jsonb_build_object(
    'aluno_id', a->>'id', 'plano', coalesce(body->'plano','[]'::jsonb)
  ));

  if jsonb_typeof(body->'registros') = 'array' and jsonb_array_length(body->'registros') > 0 then
    delete from registro where aluno_id = a->>'id';
    for r in select * from jsonb_array_elements(body->'registros') loop
      comp_raw := lower(coalesce(r->>'completou',''));
      comp := case
        when r->'completou' = 'false'::jsonb or comp_raw in ('nao','false','no') then 'nao'
        else 'sim'
      end;
      insert into registro ("timestamp", aluno_id, dia, exercicio, carga, reps, rir, completou, obs, data_treino, modalidade, local_id)
      values (
        coalesce(nullif(r->>'timestamp',''), f_now_iso()),
        a->>'id',
        coalesce(r->>'dia',''),
        coalesce(r->>'exercicio',''),
        coalesce(r->>'carga',''),
        coalesce(r->>'reps',''),
        coalesce(r->>'rir',''),
        comp,
        coalesce(r->>'obs',''),
        coalesce(r->>'data_treino',''),
        coalesce(r->>'modalidade',''),
        coalesce(r->>'local_id','')
      )
      on conflict (local_id) where local_id <> '' do nothing;
      reg_count := reg_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'aluno_id', a->>'id',
    'exercicios_importados', jsonb_array_length(coalesce(body->'plano','[]'::jsonb)),
    'registros_importados', reg_count
  );
end $function$;

-- ===== RPCs PUBLICAS (unico ponto de entrada externo) =====

CREATE OR REPLACE FUNCTION public.api_get(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  action text := payload->>'action';
  p jsonb;
begin
  if action = 'getAluno' then
    if not f_validar_aluno(payload->>'id', payload->>'pin') then
      perform pg_sleep(0.3);
      return jsonb_build_object('error', 'aluno/pin invalido');
    end if;
    p := f_aluno_payload(payload->>'id');
    if p is null then return jsonb_build_object('error', 'aluno nao encontrado'); end if;
    return p;
  elsif action = 'getAdmin' then
    if not f_check_admin_key(payload->>'key') then
      perform pg_sleep(0.3);
      return jsonb_build_object('error', 'unauthorized');
    end if;
    return f_admin_payload();
  elsif action = 'listarIds' then
    return jsonb_build_object('ids', coalesce((
      select jsonb_agg(trim(id) order by seq) from alunos where trim(id) <> ''
    ), '[]'::jsonb));
  elsif action = 'feedMotivacional' then
    return f_feed_motivacional();
  elsif action = 'login' then
    return f_login(payload->>'codigo');
  elsif action = 'ping' then
    return jsonb_build_object('ok', true, 'time', f_now_iso(), 'backend', 'supabase-v1');
  end if;
  return jsonb_build_object('error', 'unknown action: ' || coalesce(action, 'undefined'));
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $function$;

CREATE OR REPLACE FUNCTION public.api_post(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  action text := payload->>'action';
begin
  if action in ('registro','registroBatch','removerRegistroAluno','removerRegistrosAlunoBatch','salvarPeso','salvarPerimetros') then
    if not f_validar_aluno(payload->>'aluno_id', payload->>'pin') then
      perform pg_sleep(0.3);
      return jsonb_build_object('error', 'aluno/pin invalido');
    end if;
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

-- ===== GRANTS: SO as duas RPCs sao executaveis por anon. f_* internas =====
revoke all on function
  f_slug, f_now_iso, f_today_sp, f_truthy, f_data_treino_iso, f_data_sessao,
  f_check_admin_key, f_validar_aluno, f_aluno_visivel, f_canonizar_exercicio,
  f_exercicios_json, f_aluno_payload, f_admin_payload, f_feed_motivacional,
  f_login, f_registro, f_registro_admin, f_registro_batch, f_remover_registro,
  f_remover_registro_aluno, f_remover_registros_batch, f_remover_registros_aluno_batch,
  f_salvar_peso, f_salvar_perimetros, f_salvar_plano, f_salvar_aluno,
  f_remover_aluno, f_import_aluno
  from public, anon, authenticated;

grant execute on function api_get(jsonb) to anon, authenticated;
grant execute on function api_post(jsonb) to anon, authenticated;

-- admin_key inicial (hash bcrypt; troca real: ver f_check_admin_key acima)
-- insert into config (key, value) values ('admin_key', extensions.crypt('SUACHAVE', extensions.gen_salt('bf')));
