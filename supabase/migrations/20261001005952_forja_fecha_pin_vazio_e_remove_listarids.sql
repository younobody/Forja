-- v30.10.0: endurece f_validar_aluno (PIN vazio nao pode validar contra PIN
-- vazio - hoje aceitaria qualquer chamada que mandasse pin='' pra um id com
-- pin='', e os ids sao descobriveis via listarIds, publico) e remove a acao
-- listarIds (so existia pro fluxo pre-Supabase loginCodigoLegado, que nunca
-- roda contra este backend - a acao 'login' ja existe desde o v3.8 do Apps
-- Script, entao o fallback nunca dispara). Achados do advisor ao revisar o
-- plano de login com Google, antes de qualquer linha do Google ser escrita.
--
-- Aplicada ao vivo via Supabase MCP em 01/10/2026 (projeto aupfamquyihqagzwmpkb),
-- migration version 20261001005952.

create or replace function public.f_validar_aluno(p_id text, p_pin text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from alunos
    where trim(id) = trim(coalesce(p_id,''))
      and trim(pin) = trim(coalesce(p_pin,''))
      and trim(pin) <> ''
  )
$function$;

create or replace function public.api_get(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
