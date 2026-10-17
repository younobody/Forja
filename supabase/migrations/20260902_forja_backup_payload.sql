-- FORJA — ação getBackup: dump completo para backup local
-- STATUS: PROPOSTA - NAO APLICADA. Conferido em 18/09/2026: nao consta em
-- list_migrations do projeto aupfamquyihqagzwmpkb. A tentativa de aplicar em
-- 02/09/2026 foi bloqueada; DDL em producao e decisao do Marcos, nao minha.
-- Enquanto nao for aplicada, backup/exportar.ps1 usa o getAdmin (que nao traz
-- peso nem perimetros; esses ficam salvos a parte em backup/dados/).
--
-- Motivo: f_admin_payload() (usada por action=getAdmin) devolve só
-- alunos, plano, registros e exercicios. peso, perimetros e config
-- ficavam de fora — um "backup" pelo getAdmin perderia peso corporal,
-- medidas e a chave de admin (hash). Esta migration adiciona uma função
-- separada que devolve TODAS as tabelas com TODAS as colunas, inclusive
-- as chaves técnicas (pk/seq), para que a restauração seja fiel.
--
-- Aditiva: não altera schema, não altera dado, não muda nenhuma ação
-- existente de api_get. A ação nova é protegida pela mesma
-- f_check_admin_key() do getAdmin.

CREATE OR REPLACE FUNCTION public.f_backup_payload()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'gerado_em', f_now_iso(),
      'projeto', 'FORJA',
      'ref', 'aupfamquyihqagzwmpkb',
      'formato', 1
    ),
    'alunos',     coalesce((select jsonb_agg(to_jsonb(a) order by a.seq) from alunos a), '[]'::jsonb),
    'config',     coalesce((select jsonb_agg(to_jsonb(c) order by c.key) from config c), '[]'::jsonb),
    'exercicios', coalesce((select jsonb_agg(to_jsonb(e) order by e.nome_atual) from exercicios e), '[]'::jsonb),
    'perimetros', coalesce((select jsonb_agg(to_jsonb(p) order by p.pk) from perimetros p), '[]'::jsonb),
    'peso',       coalesce((select jsonb_agg(to_jsonb(p) order by p.pk) from peso p), '[]'::jsonb),
    'plano',      coalesce((select jsonb_agg(to_jsonb(p) order by p.pk) from plano p), '[]'::jsonb),
    'registro',   coalesce((select jsonb_agg(to_jsonb(r) order by r.pk) from registro r), '[]'::jsonb)
  )
$function$;

-- Confere: md5 por tabela (para rodar no SQL Editor; o exportar.ps1 ainda nao chama isto).
CREATE OR REPLACE FUNCTION public.f_backup_checksums()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_object_agg(n, jsonb_build_object('linhas', linhas, 'md5', md5_json))
  from (
    select 'alunos' n, (select count(*) from alunos) linhas,
           md5((select coalesce(jsonb_agg(to_jsonb(a) order by a.seq),'[]') from alunos a)::text) md5_json
    union all select 'config', (select count(*) from config),
           md5((select coalesce(jsonb_agg(to_jsonb(c) order by c.key),'[]') from config c)::text)
    union all select 'exercicios', (select count(*) from exercicios),
           md5((select coalesce(jsonb_agg(to_jsonb(e) order by e.nome_atual),'[]') from exercicios e)::text)
    union all select 'perimetros', (select count(*) from perimetros),
           md5((select coalesce(jsonb_agg(to_jsonb(p) order by p.pk),'[]') from perimetros p)::text)
    union all select 'peso', (select count(*) from peso),
           md5((select coalesce(jsonb_agg(to_jsonb(p) order by p.pk),'[]') from peso p)::text)
    union all select 'plano', (select count(*) from plano),
           md5((select coalesce(jsonb_agg(to_jsonb(p) order by p.pk),'[]') from plano p)::text)
    union all select 'registro', (select count(*) from registro),
           md5((select coalesce(jsonb_agg(to_jsonb(r) order by r.pk),'[]') from registro r)::text)
  ) t
$function$;

-- Porta de entrada dedicada. NÃO mexe em api_get (entrada do app, usada
-- pelos alunos) — se algo aqui estiver errado, o app segue funcionando.
-- Mesma proteção do getAdmin: sem a chave de admin, devolve unauthorized.
CREATE OR REPLACE FUNCTION public.api_backup(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  action text := payload->>'action';
begin
  if not f_check_admin_key(payload->>'key') then
    perform pg_sleep(0.3);
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if action = 'checksums' then
    return f_backup_checksums();
  end if;
  return f_backup_payload();
end $function$;

-- As funcoes auxiliares nao devem ser chamaveis pelo papel publico: so a api_backup
-- (SECURITY DEFINER, que checa a chave de admin) as usa. Sem isto o Supabase concede
-- EXECUTE a anon por padrao em funcoes novas do schema public. A api_backup em si
-- fica executavel pelo anon DE PROPOSITO, como a api_get: a chave de admin e checada la dentro.
revoke execute on function public.f_backup_payload()   from public, anon, authenticated;
revoke execute on function public.f_backup_checksums() from public, anon, authenticated;
