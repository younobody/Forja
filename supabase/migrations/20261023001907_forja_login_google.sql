-- ############################################################################
-- SQL aplicado na migration 20261023001907 "forja_login_google" (projeto FORJA, aupfamquyihqagzwmpkb, 23/10/2026).
-- Este arquivo nao existia no repositorio; copiado em 02/11/2026 de supabase_migrations.schema_migrations.statements.
-- UNICA alteracao em relacao ao aplicado: o e-mail pessoal do trainer, que estava literal no UPDATE de `alunos`
-- (comentado mais abaixo), foi trocado por <EMAIL-DO-TRAINER> para nao ficar num repositorio versionado. No banco o valor
-- real ja esta gravado em alunos.google_email (id 'marcos'); ao reconstruir o banco, rode esse UPDATE com o e-mail certo.
-- O que esta migration faz: colunas google_* em alunos, tabela google_bloqueados, chaves de config do cadastro pelo Google
-- (google_signup='sim' ABRE o auto-cadastro por qualquer conta Google; google_max_alunos foi baixado de 200 para 50 na
-- migration 20261023034156), f_salvar_aluno (recusa PIN vazio), f_admin_payload (campos google/google_email) e api_google
-- (executavel so por `authenticated`, nunca por anon).
-- ############################################################################

alter table public.alunos
  add column if not exists google_sub text,
  add column if not exists google_email text not null default '',
  add column if not exists google_criado_em timestamptz;

create unique index if not exists alunos_google_sub_uniq on public.alunos (google_sub) where google_sub is not null;

create table if not exists public.google_bloqueados (
  sub text primary key,
  motivo text not null default '',
  em timestamptz not null default now()
);
alter table public.google_bloqueados enable row level security;
revoke all on table public.google_bloqueados from anon, authenticated;

insert into public.config (key, value) values
  ('google_signup', 'sim'),
  ('google_max_alunos', '200'),
  ('google_max_24h', '20')
on conflict (key) do nothing;

-- (e-mail omitido; era o do trainer)  update public.alunos set google_email = '<EMAIL-DO-TRAINER>' where id = 'marcos' and google_email = '';

create or replace function public.f_salvar_aluno(body jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id text := coalesce(body->>'id','');
begin
  if trim(coalesce(body->>'pin','')) = '' then
    return jsonb_build_object('error', 'codigo vazio');
  end if;
  if exists (select 1 from alunos where id = v_id) then
    update alunos set
      nome = coalesce(body->>'nome',''),
      pin = coalesce(body->>'pin',''),
      objetivo = coalesce(body->>'objetivo',''),
      notas = coalesce(body->>'notas','')
    where id = v_id;
  else
    insert into alunos (id, nome, pin, objetivo, notas, criado_em, visivel_publico)
    values (v_id, coalesce(body->>'nome',''), coalesce(body->>'pin',''),
            coalesce(body->>'objetivo',''), coalesce(body->>'notas',''), f_now_iso(), '');
  end if;
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.f_admin_payload()
returns jsonb
language sql
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'alunos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'pin', pin, 'objetivo', objetivo, 'notas', notas,
        'criado_em', criado_em, 'visivel_publico', visivel_publico,
        'google', (google_sub is not null), 'google_email', google_email
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

create or replace function public.api_google(payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.jwt() ->> 'role', '');
  ident record;
  a record;
  v_sub text;
  v_email text;
  v_nome text;
  v_cfg text;
  v_max int;
  v_max24 int;
  v_id text;
  v_pin text;
  v_try int := 0;
begin
  if v_uid is null or v_role <> 'authenticated' then
    return jsonb_build_object('error', 'nao autenticado');
  end if;

  select provider_id, identity_data into ident
  from auth.identities
  where user_id = v_uid and provider = 'google'
  limit 1;
  if not found then
    return jsonb_build_object('error', 'conta Google nao encontrada');
  end if;

  v_sub := trim(coalesce(ident.provider_id, ''));
  v_email := lower(trim(coalesce(ident.identity_data ->> 'email', '')));
  if v_sub = '' or v_email = '' or lower(coalesce(ident.identity_data ->> 'email_verified', '')) not in ('true', 't') then
    return jsonb_build_object('error', 'e-mail do Google nao verificado');
  end if;

  if exists (select 1 from google_bloqueados where sub = v_sub) then
    return jsonb_build_object('error', 'acesso bloqueado - fale com o seu instrutor');
  end if;

  select * into a from alunos where google_sub = v_sub limit 1;
  if found then
    return f_aluno_payload(a.id) || jsonb_build_object('role', 'aluno', 'id', trim(a.id), 'pin', trim(a.pin), 'novo', false);
  end if;

  select * into a from alunos
  where google_sub is null
    and nullif(trim(google_email), '') is not null
    and lower(trim(google_email)) = v_email
  order by seq
  limit 1
  for update;
  if found then
    update alunos set google_sub = v_sub where id = a.id and google_sub is null;
    return f_aluno_payload(a.id) || jsonb_build_object('role', 'aluno', 'id', trim(a.id), 'pin', trim(a.pin), 'novo', false);
  end if;

  select value into v_cfg from config where key = 'google_signup';
  if lower(trim(coalesce(v_cfg, 'nao'))) <> 'sim' then
    return jsonb_build_object('error', 'o cadastro pelo Google ainda nao esta aberto - fale com o seu instrutor');
  end if;
  v_max := coalesce((select nullif(trim(value), '')::int from config where key = 'google_max_alunos'), 200);
  v_max24 := coalesce((select nullif(trim(value), '')::int from config where key = 'google_max_24h'), 20);
  if (select count(*) from alunos where google_sub is not null) >= v_max then
    return jsonb_build_object('error', 'limite de contas atingido - fale com o seu instrutor');
  end if;
  if (select count(*) from alunos where google_criado_em > now() - interval '24 hours') >= v_max24 then
    return jsonb_build_object('error', 'muitos cadastros hoje - tente de novo amanha');
  end if;

  v_nome := left(regexp_replace(trim(coalesce(
              nullif(ident.identity_data ->> 'full_name', ''),
              nullif(ident.identity_data ->> 'name', ''),
              split_part(v_email, '@', 1))), '[[:cntrl:]]', '', 'g'), 60);

  loop
    v_try := v_try + 1;
    v_id := 'g' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 9);
    v_pin := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    begin
      if exists (select 1 from alunos where trim(pin) = v_pin) then
        raise exception 'pin repetido' using errcode = 'unique_violation';
      end if;
      insert into alunos (id, nome, pin, objetivo, notas, criado_em, visivel_publico, google_sub, google_email, google_criado_em)
      values (v_id, v_nome, v_pin, '', 'conta criada pelo login Google', f_now_iso(), 'nao', v_sub, v_email, now());
      exit;
    exception when unique_violation then
      select * into a from alunos where google_sub = v_sub limit 1;
      if found then
        return f_aluno_payload(a.id) || jsonb_build_object('role', 'aluno', 'id', trim(a.id), 'pin', trim(a.pin), 'novo', false);
      end if;
      if v_try >= 5 then
        return jsonb_build_object('error', 'nao foi possivel criar a conta - tente de novo');
      end if;
    end;
  end loop;

  return f_aluno_payload(v_id) || jsonb_build_object('role', 'aluno', 'id', v_id, 'pin', v_pin, 'novo', true);
exception when others then
  raise warning 'api_google: %', sqlerrm;
  return jsonb_build_object('error', 'erro ao entrar com o Google');
end $function$;

revoke all on function public.api_google(jsonb) from public, anon, authenticated;
grant execute on function public.api_google(jsonb) to authenticated;
