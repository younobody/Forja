-- Impressao digital do schema public (7 linhas: tipo | quantidade | md5). Rode no banco vivo (execute_sql) e compare com ESPERADO.txt / com a
-- saida do replay.sh. funcs_corpo = md5 dos corpos das funcoes; funcs_attrs = security definer/volatilidade/search_path/assinatura;
-- funcs_privs = quem executa o que; colunas inclui tipos, NOT NULL, DEFAULT e identity; tabelas_rls_privs = RLS e acesso de anon/authenticated/service_role.
select 'funcs_corpo' as k, count(*)::text as n, md5(string_agg(p.proname || ':' || md5(p.prosrc), '|' order by p.proname)) as h from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
union all
select 'funcs_attrs', count(*)::text, md5(string_agg(p.proname || ':' || p.prosecdef::text || ':' || p.provolatile::text || ':' || coalesce(p.proconfig::text, '') || ':' || pg_get_function_identity_arguments(p.oid) || ':' || pg_get_function_result(p.oid), '|' order by p.proname)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
union all
select 'funcs_privs', count(*)::text, md5(string_agg(p.proname || ':' || has_function_privilege('anon', p.oid, 'execute')::text || ':' || has_function_privilege('authenticated', p.oid, 'execute')::text || ':' || has_function_privilege('service_role', p.oid, 'execute')::text, '|' order by p.proname)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
union all
select 'colunas', count(*)::text, md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') || ':' || is_identity || ':' || ordinal_position::text, '|' order by table_name, ordinal_position)) from information_schema.columns where table_schema = 'public'
union all
select 'indices', count(*)::text, md5(string_agg(indexdef, '|' order by indexname)) from pg_indexes where schemaname = 'public'
union all
select 'constraints', count(*)::text, md5(string_agg(conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid), '|' order by conrelid::regclass::text, conname)) from pg_constraint where connamespace = 'public'::regnamespace
union all
select 'tabelas_rls_privs', count(*)::text, md5(string_agg(c.relname || ':' || c.relkind::text || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text || ':' || has_table_privilege('anon', c.oid, 'select,insert,update,delete')::text || ':' || has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')::text || ':' || has_table_privilege('service_role', c.oid, 'select,insert,update,delete')::text, '|' order by c.relname)) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm')
order by 1;
